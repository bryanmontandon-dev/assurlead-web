/**
 * Base de données locale — SQLite via le module natif `node:sqlite` (Node >= 22.13).
 * Aucune dépendance native à compiler, aucun serveur externe.
 * Le fichier `data/mentor.db` ne quitte jamais cette machine.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DB_PATH = resolve(ROOT, 'data', 'mentor.db');
export const RECORDINGS_DIR = resolve(ROOT, 'data', 'recordings');

mkdirSync(dirname(DB_PATH), { recursive: true });
mkdirSync(RECORDINGS_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

/* -------------------------------------------------------------------------- */
/* Migrations                                                                  */
/* -------------------------------------------------------------------------- */

const MIGRATIONS = [
  // v1 — schéma initial
  () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        mode TEXT NOT NULL,                    -- 'debrief' | 'enregistrement'
        statut TEXT NOT NULL DEFAULT 'brouillon', -- 'brouillon' | 'transcrit' | 'analyse'
        etiquette TEXT,                        -- libellé court anonymisé, ex. "M.R. Villeneuve"

        client_type TEXT,                      -- 'portefeuille_existant' | 'nouveau_prospect' | 'recommandation'
        produit_vise TEXT,                     -- 'vie_3a' | 'pme' | 'non_vie' | 'bilan_general' | 'autre'
        resultat TEXT,                         -- 'signe' | 'a_relancer' | 'perdu' | 'rdv2_planifie'
        montant_mapro REAL,

        transcript TEXT,
        duree_secondes INTEGER,
        audio_path TEXT,
        audio_supprime INTEGER NOT NULL DEFAULT 0,

        score_decouverte INTEGER,
        score_objections INTEGER,
        score_closing INTEGER,
        score_produit INTEGER,
        score_rythme INTEGER,
        score_global INTEGER,

        points_forts TEXT,                     -- JSON array
        points_ameliorer TEXT,                 -- JSON array
        citations_precises TEXT,               -- JSON array
        action_prioritaire TEXT,
        marque_travaille INTEGER NOT NULL DEFAULT 0,

        analyse_brute_json TEXT,
        analyse_at TEXT,
        modele_utilise TEXT,
        latence_ms INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_calls_statut ON calls(statut);

      CREATE TABLE IF NOT EXISTS daily_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT UNIQUE NOT NULL,             -- 'YYYY-MM-DD'
        nb_calls INTEGER,
        score_moyen_jour REAL,
        synthese TEXT,
        pattern_detecte TEXT,
        action_demain TEXT,
        mapro_jour REAL,
        genere_at TEXT
      );

      CREATE TABLE IF NOT EXISTS objectifs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mois TEXT UNIQUE NOT NULL,             -- '2026-09'
        mapro_cible REAL,
        mapro_reel REAL,
        nb_rdv_cible INTEGER,
        nb_rdv_reel INTEGER
      );
    `);
  },

  // v2 — grille secondaire « compétences courtier » (trajectoire Swiss Courtage)
  () => {
    db.exec(`
      ALTER TABLE calls ADD COLUMN score_courtier_comparaison INTEGER;
      ALTER TABLE calls ADD COLUMN score_courtier_independance INTEGER;
      ALTER TABLE calls ADD COLUMN score_courtier_portefeuille INTEGER;
      ALTER TABLE calls ADD COLUMN score_courtier_global REAL;
      ALTER TABLE calls ADD COLUMN observation_courtier TEXT;
    `);
  },

  // v3 — fiches clients du portefeuille + rattachement des calls
  () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,

        nom TEXT NOT NULL,
        type TEXT,                      -- portefeuille_existant | nouveau_prospect | recommandation
        telephone TEXT,
        email TEXT,
        localite TEXT,

        situation_familiale TEXT,
        profession TEXT,
        annee_naissance INTEGER,

        produits_detenus TEXT,          -- JSON array de clés produit
        potentiel TEXT,                 -- faible | moyen | fort
        echeance_prochaine TEXT,        -- 'YYYY-MM-DD'
        prochaine_action TEXT,
        date_prochaine_action TEXT,     -- 'YYYY-MM-DD'
        origine TEXT,                   -- comment il est arrivé (recommandé par…, campagne…)
        notes TEXT,
        archive INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_clients_nom ON clients(nom);
      CREATE INDEX IF NOT EXISTS idx_clients_action ON clients(date_prochaine_action);

      ALTER TABLE calls ADD COLUMN client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_calls_client ON calls(client_id);
    `);
  },

  // v4 — méthode « Start With Why » : le conseiller a-t-il ancré le POURQUOI
  // du client avant de parler produit ?
  () => {
    db.exec(`
      ALTER TABLE calls ADD COLUMN score_why INTEGER;
      ALTER TABLE calls ADD COLUMN conseil_why TEXT;
      ALTER TABLE calls ADD COLUMN phrase_why TEXT;
    `);
  },

  // v5 — carnet des points à travailler : ce qui a bloqué revient au RDV suivant,
  // et ne disparaît qu'après avoir été réutilisé plusieurs fois.
  () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS points_travail (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,

        categorie TEXT NOT NULL,        -- decouverte | objections | closing | produit | rythme | why | courtier | autre
        libelle TEXT NOT NULL,          -- ce qui a coincé, en une phrase
        reformulation TEXT,             -- la phrase à réutiliser au prochain RDV
        citation TEXT,                  -- ce qui avait été dit, pour se souvenir du contexte

        cle TEXT NOT NULL,              -- forme normalisée, sert à repérer les doublons
        occurrences INTEGER NOT NULL DEFAULT 1,   -- combien de fois l'IA l'a relevé
        fois_travaille INTEGER NOT NULL DEFAULT 0,
        objectif_repetitions INTEGER NOT NULL DEFAULT 3,
        statut TEXT NOT NULL DEFAULT 'actif',     -- actif | acquis | archive

        source_call_id INTEGER REFERENCES calls(id) ON DELETE SET NULL,
        dernier_travail_at TEXT,
        derniere_detection_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_points_statut ON points_travail(statut, categorie);
      CREATE INDEX IF NOT EXISTS idx_points_cle ON points_travail(cle);
    `);
  },
];

function migrate() {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  for (let v = current; v < MIGRATIONS.length; v++) {
    MIGRATIONS[v]();
    db.exec(`PRAGMA user_version = ${v + 1}`);
  }
  return { from: current, to: MIGRATIONS.length };
}

export const migrationState = migrate();

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

export const nowISO = () => new Date().toISOString();

/** Date locale 'YYYY-MM-DD' (et non UTC : un call de 23h reste dans sa journée). */
export function localDay(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse un champ JSON stocké en TEXT sans jamais faire planter la requête. */
export function parseJSON(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Ligne `calls` brute -> objet exploitable par le front (JSON déjà parsé). */
export function hydrateCall(row) {
  if (!row) return null;
  return {
    ...row,
    marque_travaille: Boolean(row.marque_travaille),
    audio_supprime: Boolean(row.audio_supprime),
    points_forts: parseJSON(row.points_forts, []),
    points_ameliorer: parseJSON(row.points_ameliorer, []),
    citations_precises: parseJSON(row.citations_precises, []),
  };
}

/**
 * UPDATE partiel sécurisé : seules les colonnes de `allowed` sont acceptées,
 * les noms de colonnes ne viennent jamais de l'entrée utilisateur.
 */
export function updateRow(table, id, patch, allowed) {
  const cols = Object.keys(patch).filter((k) => allowed.includes(k));
  if (cols.length === 0) return 0;
  const sets = cols.map((c) => `${c} = ?`);
  const values = cols.map((c) => patch[c]);
  if (allowed.includes('updated_at')) {
    sets.push('updated_at = ?');
    values.push(nowISO());
  }
  const stmt = db.prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`);
  return stmt.run(...values, id).changes;
}

/* -------------------------------------------------------------------------- */
/* Valeurs autorisées (validation côté serveur)                                */
/* -------------------------------------------------------------------------- */

export const ENUMS = {
  potentiel: ['faible', 'moyen', 'fort'],
  mode: ['debrief', 'enregistrement'],
  statut: ['brouillon', 'transcrit', 'analyse'],
  client_type: ['portefeuille_existant', 'nouveau_prospect', 'recommandation'],
  produit_vise: ['vie_3a', 'pme', 'non_vie', 'bilan_general', 'autre'],
  resultat: ['signe', 'a_relancer', 'perdu', 'rdv2_planifie'],
};

export const SCORE_FIELDS = [
  'score_decouverte',
  'score_objections',
  'score_closing',
  'score_produit',
  'score_rythme',
];

/** Grille secondaire « compétences courtier » — non pondérée, moyenne simple. */
export const SCORE_FIELDS_COURTIER = [
  'score_courtier_comparaison',
  'score_courtier_independance',
  'score_courtier_portefeuille',
];

/** Pondération de la grille (CLAUDE.md §6). */
export const POIDS = {
  score_decouverte: 0.25,
  score_objections: 0.2,
  score_closing: 0.25,
  score_produit: 0.15,
  score_rythme: 0.15,
};

export function scoreGlobalPondere(scores) {
  let total = 0;
  let poidsUtilises = 0;
  for (const [champ, poids] of Object.entries(POIDS)) {
    const v = scores[champ];
    if (typeof v === 'number' && Number.isFinite(v)) {
      total += v * poids;
      poidsUtilises += poids;
    }
  }
  if (poidsUtilises === 0) return null;
  return Math.round((total / poidsUtilises) * 10) / 10;
}
