/**
 * Point du jour — agrégation des calls d'une journée.
 * Étape 1 : les chiffres calculés depuis la DB.
 * La synthèse rédigée par Claude arrive à l'étape 6 (POST /api/daily/:date/generer).
 */
import { Router } from 'express';
import { db, localDay, hydrateCall, nowISO } from '../db.js';
import { badRequest, checkNumber } from '../http.js';
import { synthetiserJournee } from '../analyze.js';

export const dailyRouter = Router();

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;

function verifierDate(date) {
  if (!RE_DATE.test(date)) throw badRequest('Date attendue au format YYYY-MM-DD');
  return date;
}

/** Tous les calls d'une journée locale (created_at est en ISO/UTC, on filtre en JS-safe SQL). */
function callsDuJour(date) {
  return db
    .prepare(
      `SELECT * FROM calls
       WHERE date(created_at, 'localtime') = ?
       ORDER BY created_at ASC`,
    )
    .all(date)
    .map(hydrateCall);
}

function metriquesJour(date) {
  const calls = callsDuJour(date);
  const analyses = calls.filter((c) => c.score_global !== null);
  const moyenne =
    analyses.length > 0
      ? Math.round((analyses.reduce((s, c) => s + c.score_global, 0) / analyses.length) * 10) / 10
      : null;
  const mapro = calls.reduce((s, c) => s + (c.montant_mapro ?? 0), 0);

  return {
    date,
    nb_calls: calls.length,
    nb_analyses: analyses.length,
    score_moyen_jour: moyenne,
    mapro_jour: Math.round(mapro * 100) / 100,
    nb_signes: calls.filter((c) => c.resultat === 'signe').length,
    calls,
  };
}

/* --- Point du jour ---------------------------------------------------------- */

function pointDuJour(req, res) {
  const date = verifierDate(req.params.date ?? localDay());
  const jour = metriquesJour(date);

  const veille = localDay(new Date(new Date(`${date}T12:00:00`).getTime() - 86_400_000));
  const jourVeille = metriquesJour(veille);

  const stocke = db.prepare('SELECT * FROM daily_summaries WHERE date = ?').get(date) ?? null;

  const delta =
    jour.score_moyen_jour !== null && jourVeille.score_moyen_jour !== null
      ? Math.round((jour.score_moyen_jour - jourVeille.score_moyen_jour) * 10) / 10
      : null;

  res.json({
    ...jour,
    veille: { date: veille, score_moyen_jour: jourVeille.score_moyen_jour, nb_calls: jourVeille.nb_calls },
    delta_score: delta,
    synthese: stocke,
  });
}

// Express 5 n'accepte plus `/:date?` : on déclare les deux formes.
dailyRouter.get('/', pointDuJour);
dailyRouter.get('/:date', pointDuJour);

/* --- Génération de la synthèse par l'IA -------------------------------------- */

dailyRouter.post('/:date/generer', async (req, res) => {
  const date = verifierDate(req.params.date);
  const jour = metriquesJour(date);
  const analyses = jour.calls.filter((c) => c.score_global !== null);

  if (analyses.length === 0) {
    throw badRequest(
      jour.nb_calls === 0
        ? "Aucun call ce jour-là : rien à synthétiser."
        : "Aucun call analysé ce jour-là. Lance d'abord l'analyse d'au moins un débrief.",
    );
  }

  const veille = metriquesJour(
    localDay(new Date(new Date(`${date}T12:00:00`).getTime() - 86_400_000)),
  );

  const synthese = await synthetiserJournee({ date, calls: analyses, veille });

  db.prepare(
    `INSERT INTO daily_summaries (date, nb_calls, score_moyen_jour, synthese, pattern_detecte, action_demain, genere_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       nb_calls = excluded.nb_calls,
       score_moyen_jour = excluded.score_moyen_jour,
       synthese = excluded.synthese,
       pattern_detecte = excluded.pattern_detecte,
       action_demain = excluded.action_demain,
       genere_at = excluded.genere_at`,
  ).run(
    date,
    jour.nb_calls,
    jour.score_moyen_jour,
    synthese.synthese,
    synthese.pattern_detecte,
    synthese.action_demain,
    nowISO(),
  );

  res.json({
    synthese: db.prepare('SELECT * FROM daily_summaries WHERE date = ?').get(date),
    meta: { latence_ms: synthese.latence_ms, modele: synthese.modele, nb_calls_analyses: analyses.length },
  });
});

/* --- MAPRO saisie manuellement ---------------------------------------------- */

dailyRouter.put('/:date/mapro', (req, res) => {
  const date = verifierDate(req.params.date);
  const montant = checkNumber('mapro_jour', req.body?.mapro_jour, { min: 0, max: 1_000_000 });
  if (montant === null) throw badRequest('"mapro_jour" est obligatoire');

  db.prepare(
    `INSERT INTO daily_summaries (date, mapro_jour, genere_at) VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET mapro_jour = excluded.mapro_jour`,
  ).run(date, montant, nowISO());

  res.json(db.prepare('SELECT * FROM daily_summaries WHERE date = ?').get(date));
});
