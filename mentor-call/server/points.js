/**
 * Carnet des points à travailler.
 *
 * Chaque analyse alimente ce carnet. Un point reste affiché avant chaque nouveau
 * débrief tant qu'il n'a pas été réutilisé assez de fois — et s'il ressort d'une
 * analyse plus récente, sa progression repart à zéro : c'est bien qu'il n'était
 * pas acquis.
 */
import { db, nowISO } from './db.js';

export const CATEGORIES = [
  'decouverte',
  'objections',
  'closing',
  'produit',
  'rythme',
  'why',
  'courtier',
  'autre',
];

/** Ordre d'affichage : on attaque par ce qui pèse le plus dans la grille. */
const ORDRE = Object.fromEntries(CATEGORIES.map((c, i) => [c, i]));

export const REPETITIONS_PAR_DEFAUT = 3;

/* -------------------------------------------------------------------------- */
/* Détection des doublons                                                      */
/* -------------------------------------------------------------------------- */

const VIDES = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'a', 'au', 'aux',
  'en', 'dans', 'pour', 'par', 'sur', 'avec', 'sans', 'que', 'qui', 'ne', 'pas',
  'il', 'elle', 'client', 'bryan', 'plus', 'son', 'sa', 'ses', 'est', 'sont',
]);

/** Réduit une phrase à ses mots porteurs, pour comparer deux points entre eux. */
export function normaliser(texte) {
  return String(texte ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((mot) => mot.length > 2 && !VIDES.has(mot));
}

export const cleDe = (texte) => normaliser(texte).slice(0, 8).sort().join('-');

/** Proximité de deux points : part de mots porteurs en commun (indice de Jaccard). */
function similarite(a, b) {
  const A = new Set(normaliser(a));
  const B = new Set(normaliser(b));
  if (A.size === 0 || B.size === 0) return 0;
  let commun = 0;
  for (const mot of A) if (B.has(mot)) commun++;
  return commun / (A.size + B.size - commun);
}

const SEUIL_DOUBLON = 0.45;

/* -------------------------------------------------------------------------- */
/* Alimentation depuis une analyse                                             */
/* -------------------------------------------------------------------------- */

/**
 * Range les points d'une analyse dans le carnet.
 * Un point déjà connu voit son compteur d'occurrences monter et sa progression
 * remise à zéro ; un point nouveau démarre à zéro.
 */
export function enregistrerPoints(callId, analyse) {
  const entrees = [];

  for (const point of analyse.points_ameliorer ?? []) {
    if (!point?.commentaire) continue;
    entrees.push({
      categorie: CATEGORIES.includes(point.categorie) ? point.categorie : 'autre',
      libelle: point.commentaire,
      reformulation: point.reformulation_suggeree ?? null,
      citation: point.citation ?? null,
    });
  }

  // Le conseil « why » est un point de travail à part entière.
  if (analyse.conseil_why && (analyse.score_why ?? 10) < 7) {
    entrees.push({
      categorie: 'why',
      libelle: analyse.conseil_why,
      reformulation: analyse.phrase_why ?? null,
      citation: null,
    });
  }

  const ts = nowISO();
  const resultat = { crees: 0, revus: 0 };

  for (const entree of entrees) {
    const candidats = db
      .prepare(`SELECT * FROM points_travail WHERE categorie = ? AND statut != 'archive'`)
      .all(entree.categorie);

    const existant = candidats.find((c) => similarite(c.libelle, entree.libelle) >= SEUIL_DOUBLON);

    if (existant) {
      // Il ressort : la progression repart de zéro, même s'il était donné pour acquis.
      db.prepare(
        `UPDATE points_travail SET
           occurrences = occurrences + 1,
           fois_travaille = 0,
           statut = 'actif',
           reformulation = COALESCE(?, reformulation),
           citation = COALESCE(?, citation),
           source_call_id = ?,
           derniere_detection_at = ?,
           updated_at = ?
         WHERE id = ?`,
      ).run(entree.reformulation, entree.citation, callId, ts, ts, existant.id);
      resultat.revus++;
    } else {
      db.prepare(
        `INSERT INTO points_travail
           (created_at, updated_at, categorie, libelle, reformulation, citation, cle,
            source_call_id, derniere_detection_at, objectif_repetitions)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        ts, ts,
        entree.categorie,
        entree.libelle,
        entree.reformulation,
        entree.citation,
        cleDe(entree.libelle),
        callId,
        ts,
        REPETITIONS_PAR_DEFAUT,
      );
      resultat.crees++;
    }
  }

  return resultat;
}

/* -------------------------------------------------------------------------- */
/* Lecture                                                                     */
/* -------------------------------------------------------------------------- */

const hydrater = (p) => ({
  ...p,
  restant: Math.max(0, p.objectif_repetitions - p.fois_travaille),
  recurrent: p.occurrences > 1,
});

/** Points encore à travailler, groupés par catégorie. */
export function pointsActifs() {
  const lignes = db
    .prepare(
      `SELECT * FROM points_travail
       WHERE statut = 'actif'
       ORDER BY occurrences DESC, derniere_detection_at DESC`,
    )
    .all()
    .map(hydrater);

  const groupes = [];
  for (const point of lignes) {
    let groupe = groupes.find((g) => g.categorie === point.categorie);
    if (!groupe) {
      groupe = { categorie: point.categorie, points: [] };
      groupes.push(groupe);
    }
    groupe.points.push(point);
  }

  groupes.sort((a, b) => (ORDRE[a.categorie] ?? 99) - (ORDRE[b.categorie] ?? 99));
  return { total: lignes.length, groupes };
}

/** Marque un point comme réutilisé ; il devient acquis une fois l'objectif atteint. */
export function marquerUtilise(id) {
  const point = db.prepare('SELECT * FROM points_travail WHERE id = ?').get(id);
  if (!point) return null;

  const fois = point.fois_travaille + 1;
  const acquis = fois >= point.objectif_repetitions;
  const ts = nowISO();

  db.prepare(
    `UPDATE points_travail SET fois_travaille = ?, statut = ?, dernier_travail_at = ?, updated_at = ?
     WHERE id = ?`,
  ).run(fois, acquis ? 'acquis' : 'actif', ts, ts, id);

  return hydrater(db.prepare('SELECT * FROM points_travail WHERE id = ?').get(id));
}

/** Annule la dernière utilisation (clic de trop). */
export function annulerUtilisation(id) {
  const point = db.prepare('SELECT * FROM points_travail WHERE id = ?').get(id);
  if (!point) return null;
  const fois = Math.max(0, point.fois_travaille - 1);
  db.prepare(
    `UPDATE points_travail SET fois_travaille = ?, statut = 'actif', updated_at = ? WHERE id = ?`,
  ).run(fois, nowISO(), id);
  return hydrater(db.prepare('SELECT * FROM points_travail WHERE id = ?').get(id));
}

/** Points déjà acquis, pour la mémoire du chemin parcouru. */
export function pointsAcquis(limite = 50) {
  return db
    .prepare(`SELECT * FROM points_travail WHERE statut = 'acquis' ORDER BY dernier_travail_at DESC LIMIT ?`)
    .all(limite)
    .map(hydrater);
}
