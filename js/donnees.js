/**
 * Base de données — un seul objet, un seul fichier.
 *
 * L'app est une page statique : il n'y a aucun serveur pour stocker quoi que ce
 * soit. Tout vit dans le navigateur (localStorage) et s'exporte en UN fichier
 * JSON unique, que tu peux poser sur iCloud et réimporter sur un autre appareil.
 *
 * Conséquence directe : tes données clients ne quittent jamais ton téléphone ou
 * ton Mac — même si la page, elle, est hébergée publiquement sur GitHub.
 */

const CLE = 'assurlead:base';
const VERSION = 1;

const BASE_VIDE = {
  version: VERSION,
  cree_le: null,
  modifie_le: null,
  prospects: [],
  evenements: [],
  activites: [],
  documents: [],
  reglages: { objectif_portefeuille: 600, portefeuille_actuel: 0, signature: 'Bryan' },
};

export let base = structuredClone(BASE_VIDE);

const ecouteurs = new Set();
export const surChangement = (fn) => ecouteurs.add(fn);
const prevenir = () => ecouteurs.forEach((fn) => fn());

/* --- Chargement / écriture ---------------------------------------------------- */

export function charger() {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) {
      const lu = JSON.parse(brut);
      // Fusion avec la structure vide : une base ancienne ne casse pas l'app.
      base = { ...structuredClone(BASE_VIDE), ...lu };
      base.reglages = { ...BASE_VIDE.reglages, ...(lu.reglages ?? {}) };
    } else {
      base.cree_le = new Date().toISOString();
      sauver();
    }
  } catch {
    // localStorage illisible (navigation privée, quota) : on continue en mémoire.
    base = structuredClone(BASE_VIDE);
  }
  return base;
}

export function sauver() {
  base.modifie_le = new Date().toISOString();
  try {
    localStorage.setItem(CLE, JSON.stringify(base));
  } catch (e) {
    console.warn('Sauvegarde impossible :', e.message);
  }
  prevenir();
}

/* --- Manipulation ------------------------------------------------------------- */

const identifiant = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function ajouter(collection, objet) {
  const entree = { id: identifiant(), cree_le: new Date().toISOString(), ...objet };
  base[collection].unshift(entree);
  sauver();
  return entree;
}

export function modifier(collection, id, champs) {
  const entree = base[collection].find((e) => e.id === id);
  if (!entree) return null;
  Object.assign(entree, champs);
  sauver();
  return entree;
}

export function supprimer(collection, id) {
  const avant = base[collection].length;
  base[collection] = base[collection].filter((e) => e.id !== id);
  if (base[collection].length !== avant) sauver();
}

export function reglage(cle, valeur) {
  if (valeur === undefined) return base.reglages[cle];
  base.reglages[cle] = valeur;
  sauver();
  return valeur;
}

/** Trace une action d'acquisition — alimente les KPI du dashboard. */
export const journaliser = (type, detail = '') => ajouter('activites', { type, detail });

/* --- Le fichier unique --------------------------------------------------------- */

function telecharger(nom, contenu, type) {
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(new Blob([contenu], { type }));
  lien.download = nom;
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 2000);
}

const horodatage = () => new Date().toISOString().slice(0, 10);

export function exporterTout() {
  telecharger(`assurlead-${horodatage()}.json`,
    JSON.stringify(base, null, 2), 'application/json');
}

export function exporterCsv(collection, colonnes) {
  const lignes = base[collection];
  if (lignes.length === 0) return false;

  const echapper = (v) => {
    const t = String(v ?? '');
    return /[",;\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const contenu = [
    colonnes.map((c) => c.titre).join(';'),
    ...lignes.map((l) => colonnes.map((c) => echapper(l[c.cle])).join(';')),
  ].join('\n');

  // BOM : sans lui, Excel massacre les accents.
  telecharger(`${collection}-${horodatage()}.csv`, '﻿' + contenu, 'text/csv;charset=utf-8');
  return true;
}

/**
 * Réimporte le fichier unique. `fusion` conserve l'existant et n'ajoute que
 * les entrées absentes ; sinon la base est remplacée.
 */
export async function importerTout(fichier, { fusion = true } = {}) {
  const lu = JSON.parse(await fichier.text());
  if (!lu || typeof lu !== 'object' || !Array.isArray(lu.prospects)) {
    throw new Error("Ce fichier n'est pas une sauvegarde AssurLead.");
  }

  if (!fusion) {
    base = { ...structuredClone(BASE_VIDE), ...lu };
    sauver();
    return { prospects: base.prospects.length, remplace: true };
  }

  let ajoutes = 0;
  for (const collection of ['prospects', 'evenements', 'activites', 'documents']) {
    const connus = new Set(base[collection].map((e) => e.id));
    for (const entree of lu[collection] ?? []) {
      if (!connus.has(entree.id)) {
        base[collection].push(entree);
        ajoutes++;
      }
    }
  }
  base.reglages = { ...base.reglages, ...(lu.reglages ?? {}) };
  sauver();
  return { ajoutes, remplace: false };
}

export function reinitialiser() {
  base = structuredClone(BASE_VIDE);
  base.cree_le = new Date().toISOString();
  sauver();
}

/** Supprime les prospects en double (même nom + même contact). */
export function dedoublonner() {
  const vus = new Set();
  const avant = base.prospects.length;
  base.prospects = base.prospects.filter((p) => {
    const cle = `${(p.nom ?? '').toLowerCase().trim()}|${(p.contact ?? '').toLowerCase().trim()}`;
    if (vus.has(cle)) return false;
    vus.add(cle);
    return true;
  });
  sauver();
  return avant - base.prospects.length;
}

export const poids = () => new Blob([JSON.stringify(base)]).size;
