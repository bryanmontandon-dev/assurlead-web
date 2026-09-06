/** Routes CRUD des calls (création, contexte, transcript, consultation). */
import { Router } from 'express';
import { db, nowISO, hydrateCall, updateRow, ENUMS } from '../db.js';
import { badRequest, notFound, checkEnum, checkNumber, checkText } from '../http.js';
import multer from 'multer';
import { analyserCall } from '../analyze.js';
import { lancerTranscription, lireJob, etatWhisper } from '../transcribe.js';
import { enregistrerPoints } from '../points.js';

export const callsRouter = Router();
export const transcriptionRouter = Router();

// L'audio transite en mémoire puis est écrit par transcribe.js, jamais ailleurs.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 300 * 1024 * 1024 } });

const CHAMPS_MODIFIABLES = [
  'client_id',
  'etiquette',
  'client_type',
  'produit_vise',
  'resultat',
  'montant_mapro',
  'transcript',
  'duree_secondes',
  'statut',
  'marque_travaille',
  'updated_at',
];

/** Normalise le corps d'une requête de création / mise à jour. */
function normaliserContexte(body) {
  return {
    client_id: checkNumber('client_id', body.client_id, { min: 1, max: 1e9 }),
    etiquette: checkText('etiquette', body.etiquette, 120),
    client_type: checkEnum('client_type', body.client_type, ENUMS.client_type),
    produit_vise: checkEnum('produit_vise', body.produit_vise, ENUMS.produit_vise),
    resultat: checkEnum('resultat', body.resultat, ENUMS.resultat),
    montant_mapro: checkNumber('montant_mapro', body.montant_mapro, { min: 0, max: 1_000_000 }),
    transcript: checkText('transcript', body.transcript),
    duree_secondes: checkNumber('duree_secondes', body.duree_secondes, { min: 0, max: 86_400 }),
  };
}

/* --- Création --------------------------------------------------------------- */

callsRouter.post('/', (req, res) => {
  const body = req.body ?? {};
  const mode = checkEnum('mode', body.mode, ENUMS.mode);
  if (!mode) throw badRequest('Le champ "mode" est obligatoire (debrief | enregistrement)');

  const ctx = normaliserContexte(body);
  const ts = nowISO();

  const info = db
    .prepare(
      `INSERT INTO calls (created_at, updated_at, mode, statut, client_id, etiquette, client_type,
                          produit_vise, resultat, montant_mapro, transcript, duree_secondes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      ts,
      ts,
      mode,
      ctx.transcript ? 'transcrit' : 'brouillon',
      ctx.client_id,
      ctx.etiquette,
      ctx.client_type,
      ctx.produit_vise,
      ctx.resultat,
      ctx.montant_mapro,
      ctx.transcript,
      ctx.duree_secondes,
    );

  const call = db.prepare('SELECT * FROM calls WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(hydrateCall(call));
});

/* --- Liste ------------------------------------------------------------------ */

callsRouter.get('/', (req, res) => {
  const limit = checkNumber('limit', req.query.limit, { min: 1, max: 500 }) ?? 50;
  const filtres = [];
  const params = [];

  for (const champ of ['statut', 'produit_vise', 'resultat', 'client_type', 'mode']) {
    const valeur = checkEnum(champ, req.query[champ], ENUMS[champ]);
    if (valeur) {
      filtres.push(`${champ} = ?`);
      params.push(valeur);
    }
  }
  if (req.query.depuis) {
    filtres.push('created_at >= ?');
    params.push(String(req.query.depuis));
  }

  const where = filtres.length ? `WHERE ${filtres.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT id, created_at, updated_at, mode, statut, etiquette, client_type, produit_vise,
              resultat, montant_mapro, duree_secondes, marque_travaille,
              score_decouverte, score_objections, score_closing, score_produit, score_rythme,
              score_global, score_why, action_prioritaire,
              substr(COALESCE(transcript, ''), 1, 180) AS extrait,
              length(COALESCE(transcript, '')) AS longueur_transcript
       FROM calls ${where} ORDER BY created_at DESC LIMIT ?`,
    )
    .all(...params, limit);

  res.json({ total: rows.length, calls: rows.map(hydrateCall) });
});

/* --- Détail ----------------------------------------------------------------- */

callsRouter.get('/:id', (req, res) => {
  const call = db.prepare('SELECT * FROM calls WHERE id = ?').get(Number(req.params.id));
  if (!call) throw notFound('Call introuvable');
  res.json(hydrateCall(call));
});

/* --- Mise à jour ------------------------------------------------------------ */

callsRouter.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existant = db.prepare('SELECT id FROM calls WHERE id = ?').get(id);
  if (!existant) throw notFound('Call introuvable');

  const body = req.body ?? {};
  const patch = {};
  const ctx = normaliserContexte(body);

  for (const [champ, valeur] of Object.entries(ctx)) {
    if (champ in body) patch[champ] = valeur;
  }
  if ('statut' in body) patch.statut = checkEnum('statut', body.statut, ENUMS.statut);
  if ('marque_travaille' in body) patch.marque_travaille = body.marque_travaille ? 1 : 0;
  if ('transcript' in body && patch.transcript && existant.statut === 'brouillon') {
    patch.statut = 'transcrit';
  }

  const changes = updateRow('calls', id, patch, CHAMPS_MODIFIABLES);
  if (changes === 0 && Object.keys(patch).length === 0) {
    throw badRequest('Aucun champ modifiable fourni');
  }

  res.json(hydrateCall(db.prepare('SELECT * FROM calls WHERE id = ?').get(id)));
});

/* --- Transcription locale ---------------------------------------------------- */

callsRouter.post('/:id/audio', upload.single('audio'), async (req, res) => {
  const id = Number(req.params.id);
  const call = db.prepare('SELECT id FROM calls WHERE id = ?').get(id);
  if (!call) throw notFound('Call introuvable');
  if (!req.file?.buffer?.length) throw badRequest('Aucun fichier audio reçu');

  const duree = checkNumber('duree_secondes', req.body?.duree_secondes, { min: 0, max: 86_400 });
  if (duree !== null) updateRow('calls', id, { duree_secondes: duree }, CHAMPS_MODIFIABLES);

  const jobId = await lancerTranscription(id, req.file.buffer);
  res.status(202).json({ job_id: jobId, taille_octets: req.file.buffer.length });
});

transcriptionRouter.get('/etat', (req, res) => res.json(etatWhisper()));

transcriptionRouter.get('/:jobId', (req, res) => {
  const job = lireJob(req.params.jobId);
  if (!job) throw notFound('Transcription inconnue ou expirée');

  // Dès que le texte est là, on le range dans le call : plus rien à perdre.
  if (job.etat === 'termine' && !job.enregistre) {
    updateRow(
      'calls',
      job.call_id,
      { transcript: job.transcript, statut: 'transcrit', audio_supprime: 1 },
      [...CHAMPS_MODIFIABLES, 'audio_supprime'],
    );
    job.enregistre = true;
  }

  res.json({
    etat: job.etat,
    progression: job.progression,
    transcript: job.transcript ?? null,
    erreur: job.erreur ?? null,
    duree_ms: job.duree_ms ?? null,
    call_id: job.call_id,
  });
});

/* --- Analyse IA -------------------------------------------------------------- */

callsRouter.post('/:id/analyser', async (req, res) => {
  const id = Number(req.params.id);
  const call = db.prepare('SELECT * FROM calls WHERE id = ?').get(id);
  if (!call) throw notFound('Call introuvable');

  const { analyse, brut, latence_ms, modele, usage } = await analyserCall(call);

  db.prepare(
    `UPDATE calls SET
       score_decouverte = ?, score_objections = ?, score_closing = ?,
       score_produit = ?, score_rythme = ?, score_global = ?,
       score_courtier_comparaison = ?, score_courtier_independance = ?,
       score_courtier_portefeuille = ?, score_courtier_global = ?, observation_courtier = ?,
       points_forts = ?, points_ameliorer = ?, citations_precises = ?, action_prioritaire = ?,
       score_why = ?, conseil_why = ?, phrase_why = ?,
       analyse_brute_json = ?, analyse_at = ?, modele_utilise = ?, latence_ms = ?,
       statut = 'analyse', marque_travaille = 0, updated_at = ?
     WHERE id = ?`,
  ).run(
    analyse.score_decouverte,
    analyse.score_objections,
    analyse.score_closing,
    analyse.score_produit,
    analyse.score_rythme,
    analyse.score_global,
    analyse.score_courtier_comparaison,
    analyse.score_courtier_independance,
    analyse.score_courtier_portefeuille,
    analyse.score_courtier_global,
    analyse.observation_courtier,
    JSON.stringify(analyse.points_forts),
    JSON.stringify(analyse.points_ameliorer),
    JSON.stringify(analyse.citations_precises),
    analyse.action_prioritaire,
    analyse.score_why,
    analyse.conseil_why,
    analyse.phrase_why,
    JSON.stringify(brut),
    nowISO(),
    modele,
    latence_ms,
    nowISO(),
    id,
  );

  // Ce qui a coincé rejoint le carnet, pour être retravaillé aux prochains RDV.
  const carnet = enregistrerPoints(id, analyse);

  res.json({
    call: hydrateCall(db.prepare('SELECT * FROM calls WHERE id = ?').get(id)),
    meta: { latence_ms, modele, usage, carnet },
  });
});

/* --- Suppression ------------------------------------------------------------ */

callsRouter.delete('/:id', (req, res) => {
  const changes = db.prepare('DELETE FROM calls WHERE id = ?').run(Number(req.params.id)).changes;
  if (changes === 0) throw notFound('Call introuvable');
  res.status(204).end();
});
