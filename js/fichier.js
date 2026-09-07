/**
 * Liaison à un vrai fichier sur le disque (iCloud Drive, Dropbox…).
 *
 * Repose sur l'API File System Access : le navigateur ne peut pas fouiller ton
 * disque, mais TU peux lui désigner un fichier, et il garde l'autorisation.
 *
 * Disponible dans Chrome et Edge sur ordinateur. Safari ne l'implémente pas —
 * ni sur Mac, ni sur iPhone. Sur ces navigateurs on retombe donc sur
 * l'export / import manuel, qui marche partout.
 */

export const supporte = () => typeof window.showSaveFilePicker === 'function';

const BD = 'assurlead-fichier';
const MAGASIN = 'poignees';

function ouvrirBase() {
  return new Promise((resoudre, rejeter) => {
    const requete = indexedDB.open(BD, 1);
    requete.onupgradeneeded = () => requete.result.createObjectStore(MAGASIN);
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
}

async function transaction(mode, action) {
  const base = await ouvrirBase();
  return new Promise((resoudre, rejeter) => {
    const t = base.transaction(MAGASIN, mode);
    const requete = action(t.objectStore(MAGASIN));
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
}

/** La poignée du fichier survit à la fermeture de l'onglet, contrairement à un chemin. */
export const memoriserPoignee = (poignee) =>
  transaction('readwrite', (m) => m.put(poignee, 'fichier'));

export const lirePoignee = () =>
  transaction('readonly', (m) => m.get('fichier')).catch(() => null);

export const oublierPoignee = () =>
  transaction('readwrite', (m) => m.delete('fichier')).catch(() => {});

/** L'autorisation d'écriture est-elle encore valable ? (redemandée après redémarrage) */
export async function autorisation(poignee, demander = false) {
  if (!poignee?.queryPermission) return false;
  const options = { mode: 'readwrite' };
  if ((await poignee.queryPermission(options)) === 'granted') return true;
  if (!demander) return false;
  return (await poignee.requestPermission(options)) === 'granted';
}

/** Ouvre le sélecteur : l'utilisateur choisit son dossier iCloud et le nom du fichier. */
export async function choisirFichier() {
  const poignee = await window.showSaveFilePicker({
    suggestedName: 'assurlead-base.json',
    types: [{ description: 'Base AssurLead', accept: { 'application/json': ['.json'] } }],
  });
  await memoriserPoignee(poignee);
  return poignee;
}

export async function ecrire(poignee, texte) {
  const flux = await poignee.createWritable();
  await flux.write(texte);
  await flux.close();
}

export async function lire(poignee) {
  const fichier = await poignee.getFile();
  return fichier.text();
}
