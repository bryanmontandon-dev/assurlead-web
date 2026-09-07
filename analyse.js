/**
 * Analyse d'un débrief — entièrement locale.
 *
 * L'app est une page statique : aucun serveur, donc aucun appel à une IA
 * (il faudrait y exposer une clé, ce qui est exclu). L'analyse repose donc sur
 * des règles explicites appliquées à la grille de vente. C'est moins nuancé
 * qu'un modèle, mais c'est reproductible, instantané, gratuit, et ça marche
 * hors connexion — en événement, c'est ce qui compte.
 *
 * Chaque règle explique ce qu'elle a vu et propose une phrase réutilisable.
 */

const sansAccent = (t) => t.toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '');

const compter = (texte, motifs) =>
  motifs.reduce((n, m) => n + (texte.match(m) || []).length, 0);

/* --- Marqueurs ---------------------------------------------------------------- */

const QUESTIONS_OUVERTES = [
  /\bcomment\b/g, /\bpourquoi\b/g, /\bqu'?est[- ]ce que\b/g, /\bqu'?est[- ]ce qui\b/g,
  /\bparlez[- ]moi\b/g, /\bdites[- ]moi\b/g, /\bracontez\b/g, /\bque pensez[- ]vous\b/g,
  /\bqu'?en pensez[- ]vous\b/g, /\ben quoi\b/g, /\bde quoi\b/g,
];

const MARQUEURS_POURQUOI = [
  /\bprotege/g, /\bproteger\b/g, /\bvos enfants\b/g, /\bvotre famille\b/g,
  /\bce qui compte\b/g, /\bimportant pour vous\b/g, /\bvos projets\b/g,
  /\bvotre priorite\b/g, /\btranquillite\b/g, /\bsecurite\b/g, /\bvos proches\b/g,
  /\bqui vous tient a c(?:oe|œ)ur\b/g,
];

const MOTS_PRODUIT = [
  /\b3e? pilier\b/g, /\b3a\b/g, /\blamal\b/g, /\blca\b/g, /\blpp\b/g, /\blaa\b/g,
  /\bcomplementaire/g, /\bfranchise\b/g, /\bprime\b/g, /\bpolice\b/g, /\bcasco\b/g,
  /\brc\b/g, /\bcontrat\b/g, /\bcouverture\b/g, /\brendement\b/g,
];

const DEFENSE_PRIX = [
  /\bce n'?est pas cher\b/g, /\bc'?est pas cher\b/g, /\bun geste\b/g, /\brabais\b/g,
  /\bje peux baisser\b/g, /\bmoins cher\b/g, /\bpetit prix\b/g, /\bfaire un effort\b/g,
];

const RETOUR_BESOIN = [
  /\bpar rapport a ce que\b/g, /\bce que ca protege\b/g, /\bau regard de\b/g,
  /\bqu'?est[- ]ce que ca represente\b/g, /\bcompare a\b/g,
];

const CLOSING = [
  /\bon peut avancer\b/g, /\bon y va\b/g, /\bon signe\b/g, /\bje vous propose de\b/g,
  /\bsur cette base\b/g, /\bqu'?est[- ]ce qu'?on fait\b/g, /\bvous etes d'?accord pour\b/g,
];

const DATE_PRECISE = [
  /\blundi\b/g, /\bmardi\b/g, /\bmercredi\b/g, /\bjeudi\b/g, /\bvendredi\b/g,
  /\ble \d{1,2}\b/g, /\ba \d{1,2}h/g, /\bdans \d+ jours?\b/g,
];

const SUIVI_VAGUE = [
  /\bje vous rappelle\b/g, /\bon se rappelle\b/g, /\bla semaine prochaine\b/g,
  /\bje reviens vers vous\b/g, /\bon se recontacte\b/g, /\bprochainement\b/g,
];

const CREDIBILITE = [
  /\bje ne vais pas vous vendre\b/g, /\bvous etes bien couvert\b/g, /\bne changez rien\b/g,
  /\bje ne recommande pas\b/g, /\bc'?est deja bien\b/g, /\bfranchement\b/g,
  /\bje vous le dis\b/g, /\bpas besoin de changer\b/g, /\bgardez\b/g,
];

const PROCESSUS = [
  /\bje compare\b/g, /\bcomparaison\b/g, /\ble marche\b/g, /\bindependant\b/g,
  /\bplusieurs compagnies\b/g, /\bplusieurs assureurs\b/g, /\bma fa[çc]on de travailler\b/g,
  /\btableau comparatif\b/g, /\bje regarde ce qui existe\b/g,
];

const QUANTIFICATION = [
  /\ba votre avis\b/g, /\bca representerait combien\b/g, /\bcombien ca\b/g,
  /\bvous estimez\b/g, /\bquel montant\b/g, /\bque se passerait[- ]il si\b/g,
  /\bqu'?est[- ]ce que ca representerait\b/g, /\bcombien de temps\b/g,
];

const BOUCLAGE = [
  /\bje comprends\b/g, /\bj'?entends\b/g, /\bca a du sens\b/g, /\bca vous parle\b/g,
  /\bvous me suivez\b/g, /\bc'?est logique pour vous\b/g, /\bqu'?en pensez[- ]vous\b/g,
];

const RECOMMANDATION = [
  /\bconnaissez[- ]vous quelqu'?un\b/g, /\brecommand/g, /\bautour de vous\b/g,
  /\bdans votre entourage\b/g,
];

/* --- Règles -------------------------------------------------------------------- */

/**
 * Chaque règle renvoie une note sur 10 et, si nécessaire, un point à corriger
 * avec une phrase directement prononçable au prochain rendez-vous.
 */
const REGLES = [
  {
    cle: 'decouverte',
    methode: 'Grille de vente',
    nom: 'Découverte',
    evaluer(t) {
      const q = compter(t, QUESTIONS_OUVERTES);
      const note = Math.min(10, q * 2.5);
      if (q === 0) {
        return { note, probleme: "Aucune question ouverte repérée : l'échange ressemble à une présentation, pas à une découverte.",
          phrase: 'Avant que je vous parle de quoi que ce soit — racontez-moi comment votre situation a évolué ces dernières années.' };
      }
      if (q < 3) {
        return { note, probleme: `Seulement ${q} question(s) ouverte(s). La découverte reste courte pour un vrai RDV.`,
          phrase: "Et qu'est-ce qui vous ferait dire, dans deux ans, que vous avez bien fait ?" };
      }
      return { note };
    },
  },
  {
    cle: 'why',
    methode: 'Start with Why',
    nom: 'Ancrage du POURQUOI',
    evaluer(t) {
      const pourquoi = compter(t, MARQUEURS_POURQUOI);
      const posProduit = t.search(MOTS_PRODUIT.find((m) => m.test(t)) ?? /$^/);
      const posPourquoi = t.search(MARQUEURS_POURQUOI.find((m) => m.test(t)) ?? /$^/);

      if (pourquoi === 0) {
        return { note: 1, probleme: "Le POURQUOI du client n'apparaît nulle part : on ne sait pas ce qu'il protège.",
          phrase: "S'il y a une chose que vous tenez à protéger avant tout — pour vous ou vos proches — ce serait quoi ?" };
      }
      // Produit cité avant le pourquoi : l'ordre du cercle d'or est inversé
      if (posProduit >= 0 && posPourquoi >= 0 && posProduit < posPourquoi) {
        return { note: 4, probleme: 'Le produit arrive AVANT le pourquoi. La prime se compare alors à zéro, et toute objection prix devient imparable.',
          phrase: "Avant de parler chiffres : qu'est-ce qui compte le plus pour vous là-dedans ?" };
      }
      return { note: Math.min(10, 5 + pourquoi * 1.5) };
    },
  },
  {
    cle: 'objections',
    methode: 'Grille de vente',
    nom: 'Gestion des objections',
    evaluer(t) {
      const defense = compter(t, DEFENSE_PRIX);
      const retour = compter(t, RETOUR_BESOIN);
      if (defense > 0 && retour === 0) {
        return { note: 3, probleme: 'Le prix est défendu frontalement, sans revenir au besoin. C’est le terrain où le client gagne toujours.',
          phrase: "Je comprends. Avant de regarder le montant : qu'est-ce que ça représente pour vous, ce que ça protège ?" };
      }
      if (retour > 0) return { note: Math.min(10, 6 + retour * 2) };
      return { note: 5 };
    },
  },
  {
    cle: 'closing',
    methode: 'Ligne droite',
    nom: 'Closing',
    evaluer(t) {
      const demande = compter(t, CLOSING);
      const precise = compter(t, DATE_PRECISE);
      const vague = compter(t, SUIVI_VAGUE);

      if (demande === 0 && precise === 0) {
        return { note: 2, probleme: "Aucune demande d'engagement ni date précise : le RDV se termine sans suite verrouillée.",
          phrase: 'Sur cette base, est-ce qu’on avance ? Je regarde mon agenda : mardi 14h ou jeudi 10h ?' };
      }
      if (vague > 0 && precise === 0) {
        return { note: 4, probleme: `Suivi laissé dans le vague ("${'je vous rappelle'}" ou équivalent) sans jour ni heure.`,
          phrase: 'Je bloque un créneau tout de suite avec vous : mardi 14h ou jeudi 10h, qu’est-ce qui vous arrange ?' };
      }
      return { note: Math.min(10, 5 + demande * 2 + precise) };
    },
  },
  {
    cle: 'qualification',
    nom: 'Risque chiffré par le client',
    methode: 'Ligne droite',
    evaluer(t) {
      const q = compter(t, QUANTIFICATION);
      if (q === 0) {
        return { note: 2, probleme: "Le risque n'est jamais chiffré par le client. Tant qu'il ne pose pas le montant lui-même, il reste théorique — et négociable.",
          phrase: 'À votre avis, si ça arrivait demain, ça représenterait combien pour votre famille ?' };
      }
      return { note: Math.min(10, 4 + q * 3) };
    },
  },
  {
    cle: 'certitude_conseiller',
    nom: 'Certitude — toi',
    methode: 'Ligne droite',
    evaluer(t) {
      const c = compter(t, CREDIBILITE);
      if (c === 0) {
        return { note: 3, probleme: "Tu n'as rien dit qui ne t'arrange pas. Reconnaître qu'un contrat existant est bon construit plus de confiance que dix arguments.",
          phrase: 'Franchement, sur ce contrat-là vous êtes bien couvert — je ne vais pas vous vendre autre chose pour le plaisir.' };
      }
      return { note: Math.min(10, 5 + c * 2.5) };
    },
  },
  {
    cle: 'certitude_processus',
    nom: 'Certitude — ta méthode',
    methode: 'Ligne droite',
    evaluer(t) {
      const p = compter(t, PROCESSUS);
      if (p === 0) {
        return { note: 3, probleme: "Ta méthode de comparaison n'est jamais expliquée. Le client ne sait pas ce qui te distingue d'un agent d'une seule compagnie.",
          phrase: 'Je compare les offres du marché sur vos critères, et je vous montre aussi ce que je ne recommande pas.' };
      }
      return { note: Math.min(10, 5 + p * 2.5) };
    },
  },
  {
    cle: 'bouclage',
    nom: 'Bouclage des objections',
    methode: 'Ligne droite',
    evaluer(t) {
      const b = compter(t, BOUCLAGE);
      const defense = compter(t, DEFENSE_PRIX);
      if (defense > 0 && b === 0) {
        return { note: 2, probleme: "Objection reçue sans bouclage : ni accusé de réception, ni vérification que ça a du sens. On passe en force.",
          phrase: 'Je comprends tout à fait… (tu remontes la certitude qui manque) … ça a du sens pour vous ?' };
      }
      if (b === 0) {
        return { note: 4, probleme: "Aucune vérification en cours d'entretien. Sans « ça vous parle ? », tu avances sans savoir s'il suit.",
          phrase: 'Est-ce que ça a du sens pour vous, dit comme ça ?' };
      }
      return { note: Math.min(10, 5 + b * 2) };
    },
  },
  {
    cle: 'rythme',
    methode: 'Grille de vente',
    nom: 'Rythme et écoute',
    evaluer(t) {
      const je = compter(t, [/\bje\b/g, /\bj'/g, /\bmoi\b/g]);
      const vous = compter(t, [/\bvous\b/g, /\bvotre\b/g, /\bvos\b/g]);
      if (je + vous < 5) return { note: 5 };
      const partVous = vous / (je + vous);
      if (partVous < 0.35) {
        return { note: Math.round(partVous * 20), probleme: `Ton discours est centré sur toi (${Math.round(partVous * 100)} % de "vous"). En RDV, l'objectif est l'inverse.`,
          phrase: 'Et vous, comment vous voyez les choses de votre côté ?' };
      }
      return { note: Math.min(10, Math.round(partVous * 16)) };
    },
  },
  {
    cle: 'recommandation',
    methode: 'Grille de vente',
    nom: 'Demande de recommandation',
    evaluer(t) {
      const r = compter(t, RECOMMANDATION);
      if (r === 0) {
        return { note: 0, probleme: 'Aucune demande de recommandation. C’est le levier de volume le moins coûteux, et il est systématiquement oublié.',
          phrase: 'Vous connaissez peut-être quelqu’un autour de vous à qui ce point de situation servirait autant qu’à vous ?' };
      }
      return { note: 10 };
    },
  },
];

/** Pondération : ce qui pèse le plus sur le résultat commercial. */
const POIDS = {
  decouverte: 0.15, why: 0.15, qualification: 0.12, certitude_conseiller: 0.10,
  certitude_processus: 0.08, objections: 0.12, bouclage: 0.08, closing: 0.15,
  rythme: 0.03, recommandation: 0.02,
};

export function analyser(transcript) {
  const brut = String(transcript ?? '').trim();
  if (brut.length < 40) throw new Error('Trop court pour être analysé — dis au moins quelques phrases.');

  const t = sansAccent(brut);
  const scores = {};
  const ameliorations = [];

  for (const regle of REGLES) {
    const r = regle.evaluer(t);
    scores[regle.cle] = { nom: regle.nom, methode: regle.methode, note: Math.max(0, Math.min(10, Math.round(r.note))) };
    if (r.probleme) {
      ameliorations.push({ categorie: regle.cle, nom: regle.nom, methode: regle.methode, probleme: r.probleme, phrase: r.phrase });
    }
  }

  const global = Object.entries(POIDS)
    .reduce((s, [cle, poids]) => s + scores[cle].note * poids, 0);

  // La priorité est le point le plus mal noté parmi ceux qui pèsent le plus.
  const priorite = [...ameliorations]
    .sort((a, b) => (scores[a.categorie].note * (1 - POIDS[a.categorie]))
                  - (scores[b.categorie].note * (1 - POIDS[b.categorie])))[0] ?? null;

  return {
    scores,
    global: Math.round(global * 10) / 10,
    ameliorations,
    priorite,
    mots: brut.split(/\s+/).length,
    analyse_le: new Date().toISOString(),
  };
}

/* --- Dictée ------------------------------------------------------------------- */

export const dicteeSupportee = () =>
  Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

/**
 * Reconnaissance vocale du navigateur. Attention : sur iOS comme sur Chrome,
 * l'audio est envoyé aux serveurs de l'éditeur pour être transcrit. C'est
 * acceptable pour TON débrief (ta voix, tes mots), mais à ne pas utiliser pour
 * enregistrer un client — d'où l'avertissement affiché dans l'interface.
 */
export function demarrerDictee({ surTexte, surFin, surErreur }) {
  const Moteur = window.SpeechRecognition || window.webkitSpeechRecognition;
  const reco = new Moteur();
  reco.lang = 'fr-CH';
  reco.continuous = true;
  reco.interimResults = true;

  let acquis = '';
  reco.onresult = (e) => {
    let provisoire = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const morceau = e.results[i][0].transcript;
      if (e.results[i].isFinal) acquis += morceau + ' ';
      else provisoire += morceau;
    }
    surTexte(acquis, provisoire);
  };
  reco.onerror = (e) => surErreur(e.error === 'not-allowed'
    ? 'Micro refusé. Autorise le micro pour ce site dans les réglages du navigateur.'
    : `Dictée interrompue : ${e.error}`);
  reco.onend = () => surFin(acquis);

  reco.start();
  return reco;
}
