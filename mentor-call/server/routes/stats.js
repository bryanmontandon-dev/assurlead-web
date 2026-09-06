/**
 * Statistiques calculées depuis les données réelles (jamais déclaratif).
 * Règle MAPRO : pour un jour donné, la saisie manuelle (daily_summaries.mapro_jour)
 * fait autorité ; à défaut, on somme les montants des calls signés de ce jour.
 */
import { Router } from 'express';
import { db, localDay, SCORE_FIELDS } from '../db.js';
import { badRequest, checkNumber } from '../http.js';

export const statsRouter = Router();

const RE_MOIS = /^\d{4}-\d{2}$/;

/* --- MAPRO ------------------------------------------------------------------ */

function maproParJour(mois) {
  const auto = db
    .prepare(
      `SELECT date(created_at, 'localtime') AS jour, SUM(COALESCE(montant_mapro, 0)) AS montant
       FROM calls
       WHERE strftime('%Y-%m', created_at, 'localtime') = ?
       GROUP BY jour`,
    )
    .all(mois);

  const manuel = db
    .prepare(
      `SELECT date AS jour, mapro_jour AS montant FROM daily_summaries
       WHERE substr(date, 1, 7) = ? AND mapro_jour IS NOT NULL`,
    )
    .all(mois);

  const parJour = new Map(auto.map((r) => [r.jour, r.montant]));
  for (const r of manuel) parJour.set(r.jour, r.montant); // la saisie manuelle écrase l'auto
  return parJour;
}

function maproMois(mois) {
  let total = 0;
  for (const montant of maproParJour(mois).values()) total += montant ?? 0;
  return Math.round(total * 100) / 100;
}

/* --- Streak ----------------------------------------------------------------- */

/** Nombre de jours consécutifs avec au moins 1 call débriefé (tolère "pas encore aujourd'hui"). */
function calculerStreak() {
  const jours = new Set(
    db
      .prepare(`SELECT DISTINCT date(created_at, 'localtime') AS jour FROM calls`)
      .all()
      .map((r) => r.jour),
  );
  if (jours.size === 0) return { jours: 0, actif_aujourdhui: false };

  const aujourdhui = localDay();
  const actifAujourdhui = jours.has(aujourdhui);

  let curseur = new Date(`${aujourdhui}T12:00:00`);
  if (!actifAujourdhui) curseur = new Date(curseur.getTime() - 86_400_000); // la journée n'est pas finie

  let streak = 0;
  while (jours.has(localDay(curseur))) {
    streak++;
    curseur = new Date(curseur.getTime() - 86_400_000);
  }
  return { jours: streak, actif_aujourdhui: actifAujourdhui };
}

/* --- Vue d'ensemble (dashboard) --------------------------------------------- */

statsRouter.get('/overview', (req, res) => {
  const mois = req.query.mois && RE_MOIS.test(String(req.query.mois)) ? String(req.query.mois) : localDay().slice(0, 7);

  const fenetre = (depuisJours, jusquJours = 0) =>
    db
      .prepare(
        `SELECT COUNT(*) AS nb_calls,
                AVG(score_global) AS score_moyen,
                -- SUM() renvoie NULL quand la fenêtre est vide : on force 0.
                COALESCE(SUM(CASE WHEN resultat = 'signe' THEN 1 ELSE 0 END), 0) AS nb_signes,
                COALESCE(SUM(CASE WHEN resultat IS NOT NULL THEN 1 ELSE 0 END), 0) AS nb_avec_resultat
         FROM calls
         WHERE date(created_at, 'localtime') >= date('now', 'localtime', ?)
           AND date(created_at, 'localtime') <  date('now', 'localtime', ?)`,
      )
      .get(`-${depuisJours} days`, jusquJours === 0 ? '+1 day' : `-${jusquJours} days`);

  const semaine = fenetre(6);
  const semainePrecedente = fenetre(13, 6);

  const objectif = db.prepare('SELECT * FROM objectifs WHERE mois = ?').get(mois) ?? null;
  const mapro = maproMois(mois);

  const nbRdvMois = db
    .prepare(`SELECT COUNT(*) AS n FROM calls WHERE strftime('%Y-%m', created_at, 'localtime') = ?`)
    .get(mois).n;

  const dernierPoint = db.prepare(
    `SELECT * FROM daily_summaries WHERE synthese IS NOT NULL ORDER BY date DESC LIMIT 1`,
  ).get() ?? null;

  const arrondi = (v) => (v === null || v === undefined ? null : Math.round(v * 10) / 10);

  res.json({
    mois,
    semaine: {
      nb_calls: semaine.nb_calls,
      score_moyen: arrondi(semaine.score_moyen),
      nb_signes: semaine.nb_signes,
      taux_signature:
        semaine.nb_avec_resultat > 0
          ? Math.round((semaine.nb_signes / semaine.nb_avec_resultat) * 100)
          : null,
      delta_score:
        semaine.score_moyen !== null && semainePrecedente.score_moyen !== null
          ? arrondi(semaine.score_moyen - semainePrecedente.score_moyen)
          : null,
    },
    mapro: {
      realise: mapro,
      cible: objectif?.mapro_cible ?? null,
      ecart: objectif?.mapro_cible != null ? Math.round((mapro - objectif.mapro_cible) * 100) / 100 : null,
      progression_pct:
        objectif?.mapro_cible ? Math.round((mapro / objectif.mapro_cible) * 100) : null,
    },
    rdv: {
      realise: nbRdvMois,
      cible: objectif?.nb_rdv_cible ?? null,
    },
    streak: calculerStreak(),
    dernier_point_du_jour: dernierPoint,
    total_calls: db.prepare('SELECT COUNT(*) AS n FROM calls').get().n,
  });
});

/* --- Séries temporelles (Chart.js) ------------------------------------------ */

statsRouter.get('/series', (req, res) => {
  const jours = checkNumber('jours', req.query.jours, { min: 1, max: 365 }) ?? 30;

  const lignes = db
    .prepare(
      `SELECT date(created_at, 'localtime') AS jour,
              COUNT(*) AS nb_calls,
              AVG(score_decouverte) AS decouverte,
              AVG(score_objections) AS objections,
              AVG(score_closing) AS closing,
              AVG(score_produit) AS produit,
              AVG(score_rythme) AS rythme,
              AVG(score_global) AS global
       FROM calls
       WHERE date(created_at, 'localtime') >= date('now', 'localtime', ?)
       GROUP BY jour ORDER BY jour ASC`,
    )
    .all(`-${jours - 1} days`);

  const arrondi = (v) => (v === null ? null : Math.round(v * 10) / 10);
  res.json({
    jours,
    points: lignes.map((l) => ({
      jour: l.jour,
      nb_calls: l.nb_calls,
      decouverte: arrondi(l.decouverte),
      objections: arrondi(l.objections),
      closing: arrondi(l.closing),
      produit: arrondi(l.produit),
      rythme: arrondi(l.rythme),
      global: arrondi(l.global),
    })),
  });
});

/* --- Répartitions ----------------------------------------------------------- */

statsRouter.get('/repartition', (req, res) => {
  const moyennes = SCORE_FIELDS.map((f) => `AVG(${f}) AS ${f.replace('score_', '')}`).join(', ');

  const parDimension = (colonne) =>
    db
      .prepare(
        `SELECT COALESCE(${colonne}, 'non_renseigne') AS cle,
                COUNT(*) AS nb,
                AVG(score_global) AS score_moyen,
                ${moyennes},
                SUM(CASE WHEN resultat = 'signe' THEN 1 ELSE 0 END) AS nb_signes,
                SUM(COALESCE(montant_mapro, 0)) AS mapro
         FROM calls GROUP BY cle ORDER BY nb DESC`,
      )
      .all()
      .map((r) => {
        const out = { cle: r.cle, nb: r.nb, nb_signes: r.nb_signes, mapro: Math.round(r.mapro * 100) / 100 };
        for (const k of ['score_moyen', 'decouverte', 'objections', 'closing', 'produit', 'rythme']) {
          out[k] = r[k] === null ? null : Math.round(r[k] * 10) / 10;
        }
        return out;
      });

  const resultats = db
    .prepare(
      `SELECT COALESCE(resultat, 'non_renseigne') AS cle, COUNT(*) AS nb
       FROM calls GROUP BY cle ORDER BY nb DESC`,
    )
    .all();

  const avecResultat = resultats
    .filter((r) => r.cle !== 'non_renseigne')
    .reduce((s, r) => s + r.nb, 0);
  const signes = resultats.find((r) => r.cle === 'signe')?.nb ?? 0;

  res.json({
    par_produit: parDimension('produit_vise'),
    par_client_type: parDimension('client_type'),
    par_resultat: resultats,
    taux_signature: avecResultat > 0 ? Math.round((signes / avecResultat) * 100) : null,
  });
});

/* --- Objectifs mensuels ------------------------------------------------------ */

statsRouter.get('/objectifs', (req, res) => {
  const lignes = db.prepare('SELECT * FROM objectifs ORDER BY mois DESC').all();
  res.json(
    lignes.map((o) => ({ ...o, mapro_reel: maproMois(o.mois) })),
  );
});

statsRouter.put('/objectifs/:mois', (req, res) => {
  const mois = req.params.mois;
  if (!RE_MOIS.test(mois)) throw badRequest('Mois attendu au format YYYY-MM');

  const maproCible = checkNumber('mapro_cible', req.body?.mapro_cible, { min: 0, max: 1_000_000 });
  const nbRdvCible = checkNumber('nb_rdv_cible', req.body?.nb_rdv_cible, { min: 0, max: 2000 });

  db.prepare(
    `INSERT INTO objectifs (mois, mapro_cible, nb_rdv_cible) VALUES (?, ?, ?)
     ON CONFLICT(mois) DO UPDATE SET
       mapro_cible = COALESCE(excluded.mapro_cible, objectifs.mapro_cible),
       nb_rdv_cible = COALESCE(excluded.nb_rdv_cible, objectifs.nb_rdv_cible)`,
  ).run(mois, maproCible, nbRdvCible);

  const o = db.prepare('SELECT * FROM objectifs WHERE mois = ?').get(mois);
  res.json({ ...o, mapro_reel: maproMois(mois) });
});
