/**
 * Fiches clients du portefeuille.
 *
 * Ces données ne quittent jamais la machine : le nom d'un client n'est JAMAIS
 * envoyé à l'API d'analyse, qui ne reçoit que le contexte anonymisé du call.
 */
import { Router } from 'express';
import { db, nowISO, parseJSON, updateRow, ENUMS, localDay } from '../db.js';
import { badRequest, notFound, checkEnum, checkNumber, checkText } from '../http.js';

export const clientsRouter = Router();

const CHAMPS = [
  'nom',
  'type',
  'telephone',
  'email',
  'localite',
  'situation_familiale',
  'profession',
  'annee_naissance',
  'produits_detenus',
  'potentiel',
  'echeance_prochaine',
  'prochaine_action',
  'date_prochaine_action',
  'origine',
  'notes',
  'archive',
  'updated_at',
];

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;

function checkDate(champ, valeur) {
  const t = checkText(champ, valeur, 10);
  if (t === null) return null;
  if (!RE_DATE.test(t)) throw badRequest(`"${champ}" attend une date au format AAAA-MM-JJ`);
  return t;
}

function normaliser(body) {
  const produits = body.produits_detenus;
  return {
    nom: checkText('nom', body.nom, 160),
    type: checkEnum('type', body.type, ENUMS.client_type),
    telephone: checkText('telephone', body.telephone, 40),
    email: checkText('email', body.email, 160),
    localite: checkText('localite', body.localite, 120),
    situation_familiale: checkText('situation_familiale', body.situation_familiale, 200),
    profession: checkText('profession', body.profession, 160),
    annee_naissance: checkNumber('annee_naissance', body.annee_naissance, { min: 1900, max: 2100 }),
    produits_detenus: Array.isArray(produits)
      ? JSON.stringify(produits.filter((p) => ENUMS.produit_vise.includes(p)))
      : undefined,
    potentiel: checkEnum('potentiel', body.potentiel, ENUMS.potentiel),
    echeance_prochaine: checkDate('echeance_prochaine', body.echeance_prochaine),
    prochaine_action: checkText('prochaine_action', body.prochaine_action, 400),
    date_prochaine_action: checkDate('date_prochaine_action', body.date_prochaine_action),
    origine: checkText('origine', body.origine, 300),
    notes: checkText('notes', body.notes, 20_000),
  };
}

const hydrater = (row) =>
  row && { ...row, produits_detenus: parseJSON(row.produits_detenus, []), archive: Boolean(row.archive) };

/* --- Liste ------------------------------------------------------------------- */

clientsRouter.get('/', (req, res) => {
  const recherche = checkText('recherche', req.query.recherche, 120);
  const filtres = [req.query.archives === '1' ? '1=1' : 'c.archive = 0'];
  const params = [];

  if (recherche) {
    filtres.push('(c.nom LIKE ? OR c.localite LIKE ? OR c.notes LIKE ?)');
    params.push(`%${recherche}%`, `%${recherche}%`, `%${recherche}%`);
  }

  const lignes = db
    .prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM calls WHERE client_id = c.id) AS nb_calls,
              (SELECT MAX(created_at) FROM calls WHERE client_id = c.id) AS dernier_contact,
              (SELECT SUM(COALESCE(montant_mapro, 0)) FROM calls WHERE client_id = c.id) AS mapro_total
       FROM clients c
       WHERE ${filtres.join(' AND ')}
       ORDER BY
         CASE WHEN c.date_prochaine_action IS NULL THEN 1 ELSE 0 END,
         c.date_prochaine_action ASC,
         c.nom COLLATE NOCASE ASC`,
    )
    .all(...params);

  const aujourdhui = localDay();

  res.json({
    total: lignes.length,
    // Ce qui doit être fait aujourd'hui ou aurait déjà dû l'être.
    a_relancer: lignes.filter((c) => c.date_prochaine_action && c.date_prochaine_action <= aujourdhui).length,
    clients: lignes.map(hydrater),
  });
});

/* --- Détail (fiche + historique des calls) ------------------------------------ */

clientsRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!client) throw notFound('Client introuvable');

  const calls = db
    .prepare(
      `SELECT id, created_at, mode, produit_vise, resultat, montant_mapro, score_global, action_prioritaire
       FROM calls WHERE client_id = ? ORDER BY created_at DESC`,
    )
    .all(id);

  res.json({ ...hydrater(client), calls });
});

/* --- Création ----------------------------------------------------------------- */

clientsRouter.post('/', (req, res) => {
  const donnees = normaliser(req.body ?? {});
  if (!donnees.nom) throw badRequest('Le nom du client est obligatoire');

  const ts = nowISO();
  const colonnes = Object.keys(donnees).filter((c) => donnees[c] !== undefined);
  const info = db
    .prepare(
      `INSERT INTO clients (created_at, updated_at, ${colonnes.join(', ')})
       VALUES (?, ?, ${colonnes.map(() => '?').join(', ')})`,
    )
    .run(ts, ts, ...colonnes.map((c) => donnees[c]));

  res.status(201).json(hydrater(db.prepare('SELECT * FROM clients WHERE id = ?').get(info.lastInsertRowid)));
});

/* --- Mise à jour --------------------------------------------------------------- */

clientsRouter.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT id FROM clients WHERE id = ?').get(id)) throw notFound('Client introuvable');

  const body = req.body ?? {};
  const donnees = normaliser(body);
  const patch = {};
  for (const [champ, valeur] of Object.entries(donnees)) {
    if (champ in body && valeur !== undefined) patch[champ] = valeur;
  }
  if ('archive' in body) patch.archive = body.archive ? 1 : 0;
  if (patch.nom === null) throw badRequest('Le nom du client ne peut pas être vidé');

  updateRow('clients', id, patch, CHAMPS);
  res.json(hydrater(db.prepare('SELECT * FROM clients WHERE id = ?').get(id)));
});

/* --- Suppression --------------------------------------------------------------- */

clientsRouter.delete('/:id', (req, res) => {
  const changes = db.prepare('DELETE FROM clients WHERE id = ?').run(Number(req.params.id)).changes;
  if (changes === 0) throw notFound('Client introuvable');
  res.status(204).end();
});
