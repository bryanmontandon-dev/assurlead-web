/**
 * Moteur d'analyse — appel à l'API Anthropic.
 *
 * Confidentialité : seul le TEXTE (transcript + contexte du call) est envoyé.
 * Jamais l'audio, jamais le fichier de base, jamais rien d'autre.
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError } from './http.js';
import { appelerClaudeCli } from './claude-cli.js';
import { scoreGlobalPondere, SCORE_FIELDS, SCORE_FIELDS_COURTIER } from './db.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER_PROMPTS = resolve(ROOT, 'prompts');

export const MODELE_DEFAUT = 'claude-opus-5';

/* -------------------------------------------------------------------------- */
/* Schéma de sortie — l'API garantit une réponse conforme (structured outputs)  */
/* -------------------------------------------------------------------------- */

const objet = (proprietes) => ({
  type: 'object',
  properties: proprietes,
  required: Object.keys(proprietes),
  additionalProperties: false,
});

const SCHEMA_ANALYSE = objet({
  score_decouverte: { type: 'integer', description: 'Note 0 à 10' },
  score_objections: { type: 'integer', description: 'Note 0 à 10' },
  score_closing: { type: 'integer', description: 'Note 0 à 10' },
  score_produit: { type: 'integer', description: 'Note 0 à 10' },
  score_rythme: { type: 'integer', description: 'Note 0 à 10' },
  score_global: { type: 'integer', description: 'Moyenne pondérée, 0 à 10' },
  points_forts: {
    type: 'array',
    description: '2 à 3 points forts, chacun appuyé par une citation exacte du transcript',
    items: objet({
      citation: { type: 'string' },
      commentaire: { type: 'string' },
    }),
  },
  points_ameliorer: {
    type: 'array',
    description: '2 à 3 points à corriger, avec une reformulation directement réutilisable',
    items: objet({
      categorie: {
        type: 'string',
        enum: ['decouverte', 'objections', 'closing', 'produit', 'rythme', 'why', 'courtier'],
        description: 'La dimension de la grille à laquelle ce point se rattache',
      },
      citation: { type: 'string' },
      commentaire: { type: 'string' },
      reformulation_suggeree: { type: 'string' },
    }),
  },
  score_why: { type: 'integer', description: 'Note 0 à 10 : le POURQUOI du client a-t-il précédé le produit ?' },
  conseil_why: {
    type: 'string',
    description: 'Conseil « start with why » propre à ce call, appuyé sur la transcription',
  },
  phrase_why: {
    type: 'string',
    description: 'Question ouverte prête à l’emploi pour ancrer le POURQUOI au prochain RDV',
  },
  action_prioritaire: { type: 'string', description: 'UNE seule phrase, la priorité absolue' },
  grille_courtier: objet({
    score_comparaison_marche: { type: 'integer', description: 'Note 0 à 10' },
    score_independance_conseil: { type: 'integer', description: 'Note 0 à 10' },
    score_vision_portefeuille: { type: 'integer', description: 'Note 0 à 10' },
    observation: { type: 'string', description: '1 à 2 phrases sur le réflexe courtier' },
  }),
});

/* -------------------------------------------------------------------------- */
/* Prompt système — rechargé automatiquement quand le fichier change           */
/* -------------------------------------------------------------------------- */

const cachePrompts = new Map();

export async function chargerPrompt(fichier = 'system-analysis.md') {
  const chemin = resolve(DOSSIER_PROMPTS, fichier);
  const { mtimeMs } = await stat(chemin);
  const cache = cachePrompts.get(fichier);
  if (!cache || cache.mtime !== mtimeMs) {
    const contenu = await readFile(chemin, 'utf8');
    cachePrompts.set(fichier, { mtime: mtimeMs, contenu });
    return contenu;
  }
  return cache.contenu;
}

/* -------------------------------------------------------------------------- */
/* Client                                                                      */
/* -------------------------------------------------------------------------- */

let client = null;

/**
 * Aucun identifiant n'est passé explicitement : le SDK résout tout seul, dans
 * l'ordre, la clé ANTHROPIC_API_KEY puis le compte Claude connecté via `ant auth
 * login` (~/.config/anthropic), en renouvelant le jeton quand il expire.
 */
function obtenirClient() {
  if (!client) {
    client = new Anthropic({
      maxRetries: 3, // le SDK gère seul les 429 et les erreurs serveur
      timeout: 5 * 60 * 1000,
    });
  }
  return client;
}

/** Réinitialise le client après une connexion / déconnexion. */
export function reinitialiserClient() {
  client = null;
}

const MESSAGE_SANS_IDENTIFIANT =
  'Aucun compte Claude connecté. Clique sur « Se connecter avec Claude » sur le tableau de bord.';

/* -------------------------------------------------------------------------- */
/* Construction du message                                                     */
/* -------------------------------------------------------------------------- */

const LIB = {
  mode: {
    debrief: "DÉBRIEF ORAL — Bryan raconte lui-même ce qui s'est passé. L'information est indirecte : reste prudent sur les scores.",
    enregistrement: "ENREGISTREMENT DU CALL — transcription mot à mot de l'échange réel avec le client.",
  },
  client_type: {
    portefeuille_existant: 'client déjà au portefeuille',
    nouveau_prospect: 'nouveau prospect',
    recommandation: 'issu d’une recommandation',
  },
  produit_vise: {
    vie_3a: 'prévoyance vie / 3e pilier a',
    pme: 'assurances PME / entreprise',
    non_vie: 'non-vie (RC, ménage, véhicule…)',
    bilan_general: 'bilan général / analyse de couverture',
    autre: 'autre',
  },
  resultat: {
    signe: 'signé',
    a_relancer: 'à relancer',
    perdu: 'perdu',
    rdv2_planifie: 'RDV 2 planifié',
  },
};

function construireMessage(call) {
  const contexte = [
    `Type de capture : ${LIB.mode[call.mode] ?? call.mode}`,
    call.client_type && `Type de client : ${LIB.client_type[call.client_type]}`,
    call.produit_vise && `Produit visé : ${LIB.produit_vise[call.produit_vise]}`,
    call.resultat && `Issue annoncée par Bryan : ${LIB.resultat[call.resultat]}`,
    call.montant_mapro && `MAPRO générée : ${call.montant_mapro} CHF`,
    call.duree_secondes && `Durée de la capture : ${Math.round(call.duree_secondes / 60)} min`,
  ]
    .filter(Boolean)
    .join('\n');

  return [
    '<contexte>',
    contexte,
    '</contexte>',
    '',
    '<transcription>',
    call.transcript,
    '</transcription>',
    '',
    "Analyse cet échange selon la grille. Chaque point doit s'appuyer sur une citation exacte tirée de la transcription ci-dessus.",
  ].join('\n');
}

/* -------------------------------------------------------------------------- */
/* Normalisation                                                               */
/* -------------------------------------------------------------------------- */

const borner = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(10, Math.round(n)));
};

const moyenne = (valeurs) => {
  const valides = valeurs.filter((v) => v !== null);
  if (valides.length === 0) return null;
  return Math.round((valides.reduce((s, v) => s + v, 0) / valides.length) * 10) / 10;
};

/**
 * Le score global est recalculé côté serveur avec la pondération de la grille
 * (Découverte 25 / Objections 20 / Closing 25 / Produit 15 / Rythme 15).
 * On ne dépend pas de l'arithmétique du modèle : la note affichée est reproductible.
 */
function normaliser(brut) {
  const scores = {};
  for (const champ of SCORE_FIELDS) scores[champ] = borner(brut[champ]);

  const courtier = brut.grille_courtier ?? {};
  const scoresCourtier = {
    score_courtier_comparaison: borner(courtier.score_comparaison_marche),
    score_courtier_independance: borner(courtier.score_independance_conseil),
    score_courtier_portefeuille: borner(courtier.score_vision_portefeuille),
  };

  const nettoyerListe = (liste, champs) =>
    Array.isArray(liste)
      ? liste
          .filter((e) => e && typeof e === 'object')
          .map((e) => Object.fromEntries(champs.map((c) => [c, String(e[c] ?? '').trim()])))
          .filter((e) => e.commentaire)
      : [];

  const points_forts = nettoyerListe(brut.points_forts, ['citation', 'commentaire']);
  const points_ameliorer = nettoyerListe(brut.points_ameliorer, [
    'categorie', // sert au regroupement dans le carnet d'entraînement
    'citation',
    'commentaire',
    'reformulation_suggeree',
  ]);

  return {
    ...scores,
    score_global: scoreGlobalPondere(scores),
    ...scoresCourtier,
    score_courtier_global: moyenne(SCORE_FIELDS_COURTIER.map((c) => scoresCourtier[c])),
    observation_courtier: String(courtier.observation ?? '').trim() || null,
    points_forts,
    points_ameliorer,
    // Vue unifiée des citations, pratique pour la recherche et le playbook (§ à venir).
    citations_precises: [
      ...points_forts.map((p) => ({ ...p, type: 'fort' })),
      ...points_ameliorer.map((p) => ({ ...p, type: 'ameliorer' })),
    ],
    score_why: borner(brut.score_why),
    conseil_why: String(brut.conseil_why ?? '').trim() || null,
    phrase_why: String(brut.phrase_why ?? '').trim() || null,
    action_prioritaire: String(brut.action_prioritaire ?? '').trim() || null,
  };
}

/* -------------------------------------------------------------------------- */
/* Appel générique                                                             */
/* -------------------------------------------------------------------------- */

/** 'cli' = abonnement Claude via Claude Code · 'api' = crédits de l'API Anthropic. */
export const moteurActif = () => (process.env.MOTEUR_IA || 'cli').toLowerCase();

/**
 * Le CLI ne peut pas imposer un schéma de sortie comme l'API : on renforce
 * l'exigence dans le prompt, et claude-cli.js extrait le JSON de façon défensive.
 */
const CONSIGNE_JSON =
  "\n\nIMPÉRATIF : réponds UNIQUEMENT avec l'objet JSON demandé. Aucun texte avant, aucun texte après, aucune balise de code.";

async function appelerClaude({ systeme, message, schema }) {
  if (moteurActif() === 'cli') {
    return appelerClaudeCli({ systeme: systeme + CONSIGNE_JSON, message });
  }

  const anthropic = obtenirClient();
  const modele = process.env.ANTHROPIC_MODEL || MODELE_DEFAUT;
  const debut = Date.now();

  let reponse;
  try {
    reponse = await anthropic.messages.create({
      model: modele,
      max_tokens: 16000,
      system: systeme,
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema },
      },
      messages: [{ role: 'user', content: message }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      throw new ApiError(
        401,
        'Identifiants refusés par Anthropic. Reconnecte ton compte Claude depuis le tableau de bord.',
      );
    }
    if (e instanceof Anthropic.RateLimitError) {
      throw new ApiError(429, 'Limite de débit atteinte côté Anthropic. Réessaie dans une minute.');
    }
    if (e instanceof Anthropic.APIConnectionError) {
      throw new ApiError(503, 'Pas de connexion à l’API Anthropic. Vérifie ton accès internet.');
    }
    if (e instanceof Anthropic.APIError) {
      throw new ApiError(502, `Erreur API Anthropic (${e.status}) : ${e.message}`);
    }
    // Le SDK n'a trouvé aucun identifiant à résoudre (ni clé, ni compte connecté).
    if (/api[ _-]?key|credential|auth|not logged in/i.test(e?.message ?? '')) {
      client = null; // pour reprendre la résolution à zéro à la prochaine tentative
      throw new ApiError(503, MESSAGE_SANS_IDENTIFIANT);
    }
    throw e;
  }

  const latence_ms = Date.now() - debut;

  if (reponse.stop_reason === 'refusal') {
    throw new ApiError(422, "Le modèle a refusé de traiter ce contenu. Reformule le texte.");
  }
  if (reponse.stop_reason === 'max_tokens') {
    throw new ApiError(502, 'Réponse tronquée par la limite de tokens. Raccourcis le texte source.');
  }

  const texte = reponse.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  let brut;
  try {
    brut = JSON.parse(texte);
  } catch {
    throw new ApiError(502, "Réponse de l'IA illisible (JSON invalide). Relance l'opération.");
  }

  return { brut, latence_ms, modele: reponse.model ?? modele, usage: reponse.usage };
}

/* -------------------------------------------------------------------------- */
/* Analyse d'un call                                                           */
/* -------------------------------------------------------------------------- */

export async function analyserCall(call) {
  if (!call.transcript || call.transcript.trim().length < 40) {
    throw new ApiError(400, 'Transcript trop court pour être analysé.');
  }

  const resultat = await appelerClaude({
    systeme: await chargerPrompt('system-analysis.md'),
    message: construireMessage(call),
    schema: SCHEMA_ANALYSE,
  });

  return { ...resultat, analyse: normaliser(resultat.brut) };
}

/* -------------------------------------------------------------------------- */
/* Synthèse de la journée                                                      */
/* -------------------------------------------------------------------------- */

const SCHEMA_JOURNEE = objet({
  synthese: { type: 'string', description: '2 à 3 phrases sur la tendance de la journée' },
  pattern_detecte: { type: 'string', description: 'Le pattern le plus répété, ou "" si aucun' },
  action_demain: { type: 'string', description: 'UNE seule action pour demain' },
});

export async function synthetiserJournee({ date, calls, veille }) {
  if (calls.length === 0) throw new ApiError(400, 'Aucun call analysé ce jour-là.');

  // On n'envoie que les scores et les conclusions — pas les transcripts entiers.
  const resume = calls.map((c) => ({
    produit_vise: c.produit_vise,
    client_type: c.client_type,
    resultat: c.resultat,
    mapro: c.montant_mapro,
    scores: {
      decouverte: c.score_decouverte,
      objections: c.score_objections,
      closing: c.score_closing,
      produit: c.score_produit,
      rythme: c.score_rythme,
      global: c.score_global,
    },
    points_ameliorer: c.points_ameliorer?.map((p) => p.commentaire) ?? [],
    points_forts: c.points_forts?.map((p) => p.commentaire) ?? [],
    action_prioritaire: c.action_prioritaire,
  }));

  const message = [
    `<journee date="${date}">`,
    `Nombre de calls analysés : ${calls.length}`,
    veille?.score_moyen_jour != null ? `Score moyen de la veille : ${veille.score_moyen_jour}/10` : '',
    '</journee>',
    '',
    '<calls>',
    JSON.stringify(resume, null, 2),
    '</calls>',
  ]
    .filter(Boolean)
    .join('\n');

  const { brut, latence_ms, modele } = await appelerClaude({
    systeme: await chargerPrompt('daily-synthesis.md'),
    message,
    schema: SCHEMA_JOURNEE,
  });

  return {
    synthese: String(brut.synthese ?? '').trim(),
    pattern_detecte: String(brut.pattern_detecte ?? '').trim() || null,
    action_demain: String(brut.action_demain ?? '').trim(),
    latence_ms,
    modele,
  };
}
