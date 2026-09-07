/**
 * Démarrage en deux temps :
 *   1. où ranger la base (fichier iCloud, ou stockage de l'appareil)
 *   2. le code d'accès — saisi deux fois la première fois
 *
 * Toute erreur est affichée à l'écran. Un échec silencieux serait pire
 * qu'un message d'erreur : on ne saurait pas quoi corriger.
 */
import * as D from './donnees.js';
import * as F from './fichier.js';
import { VUES } from './modules.js';

export const VERSION = '2026.09.07-5';

const el = (id) => document.getElementById(id);
const CLE_CODE = 'assurlead:code';
const CLE_MODE = 'assurlead:mode-stockage'; // 'fichier' | 'appareil'

/* --- Empreinte du code --------------------------------------------------------- */

/**
 * SHA-256 quand c'est possible. `crypto.subtle` n'existe QUE dans un contexte
 * sécurisé (https ou localhost) : ouverte en http simple, la page tomberait
 * sinon en panne sans rien dire. On garde alors une empreinte plus faible,
 * ce qui reste cohérent — sur une page statique, le code protège d'un curieux,
 * pas d'un attaquant déterminé.
 */
async function empreinte(texte) {
  if (window.crypto?.subtle) {
    const octets = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
    return [...new Uint8Array(octets)].map((o) => o.toString(16).padStart(2, '0')).join('');
  }
  let h = 5381;
  for (let i = 0; i < texte.length; i++) h = ((h << 5) + h + texte.charCodeAt(i)) | 0;
  return `simple:${(h >>> 0).toString(16)}`;
}

/* --- Étape 1 : où ranger la base ------------------------------------------------ */

function montrerEtape(nom) {
  ['etape-stockage', 'etape-code'].forEach((id) => (el(id).hidden = id !== nom));
  el('verrou').hidden = false;
  el('app').hidden = true;
}

function etapeStockage() {
  montrerEtape('etape-stockage');

  const dispo = F.supporte();
  el('stockage-fichier').hidden = !dispo;
  el('stockage-explication').innerHTML = dispo
    ? `Choisis le fichier <code>assurlead-base.json</code> dans ton dossier iCloud.
       L'app y écrira toute seule à chaque modification.`
    : `Ce navigateur ne permet pas d'écrire directement dans un fichier
       (c'est le cas de Safari, sur Mac comme sur iPhone).
       Tes données seront gardées sur cet appareil, et tu les enverras vers iCloud
       avec le bouton <strong>Exporter</strong> de l'onglet « Import &amp; base ».`;

  el('stockage-fichier').onclick = async () => {
    el('stockage-message').textContent = '';
    try {
      const poignee = await F.choisirFichier();
      D.lierFichier(poignee);

      // Le fichier existe déjà et contient une base : on la reprend.
      const texte = await F.lire(poignee).catch(() => '');
      if (texte.trim()) {
        try {
          D.adopter(texte);
          el('stockage-message').innerHTML =
            `<span class="reussite">Base reprise : ${D.base.prospects.length} prospect(s).</span>`;
        } catch {
          el('stockage-message').innerHTML =
            '<span class="erreur">Fichier existant illisible — il sera remplacé.</span>';
        }
      }
      localStorage.setItem(CLE_MODE, 'fichier');
      D.sauver();
      setTimeout(etapeCode, 700);
    } catch (e) {
      // L'utilisateur a annulé le sélecteur : ce n'est pas une erreur.
      if (e.name !== 'AbortError') {
        el('stockage-message').innerHTML = `<span class="erreur">${e.message}</span>`;
      }
    }
  };

  el('stockage-appareil').onclick = () => {
    localStorage.setItem(CLE_MODE, 'appareil');
    etapeCode();
  };
}

/* --- Étape 2 : le code ---------------------------------------------------------- */

function etapeCode() {
  montrerEtape('etape-code');
  const premiereFois = !localStorage.getItem(CLE_CODE);

  el('code-titre').textContent = premiereFois ? 'Choisis ton code' : 'AssurLead';
  el('code-aide').textContent = premiereFois
    ? 'Saisis-le deux fois. Note-le : il n’est récupérable nulle part.'
    : 'Saisis ton code d’accès';
  el('code-confirmation').hidden = !premiereFois;
  el('code-bouton').textContent = premiereFois ? 'Définir le code' : 'Déverrouiller';
  el('code-message').textContent = '';
  el('code-saisie').value = '';
  el('code-confirmation').value = '';
  el('code-saisie').focus();

  const erreur = (texte) => {
    el('code-message').innerHTML = `<span class="erreur">${texte}</span>`;
  };

  const valider = async () => {
    try {
      const saisie = el('code-saisie').value.trim();
      if (saisie.length < 4) return erreur('4 caractères minimum.');

      if (premiereFois) {
        if (saisie !== el('code-confirmation').value.trim()) {
          el('code-confirmation').value = '';
          return erreur('Les deux codes ne correspondent pas.');
        }
        localStorage.setItem(CLE_CODE, await empreinte(saisie));
        return ouvrirApp();
      }

      if ((await empreinte(saisie)) === localStorage.getItem(CLE_CODE)) return ouvrirApp();
      el('code-saisie').value = '';
      erreur('Code incorrect.');
    } catch (e) {
      erreur(`Erreur : ${e.message}`);
    }
  };

  el('code-bouton').onclick = valider;

  // Accolades obligatoires : un handler « on* » qui renvoie false annule
  // l'événement — la forme « condition && action » empêchait toute frappe.
  el('code-saisie').onkeydown = (e) => {
    if (e.key !== 'Enter') return;
    if (premiereFois) el('code-confirmation').focus();
    else valider();
  };
  el('code-confirmation').onkeydown = (e) => {
    if (e.key === 'Enter') valider();
  };
}

/* --- Ouverture ------------------------------------------------------------------ */

function ouvrirApp() {
  el('verrou').hidden = true;
  el('app').hidden = false;
  majEntete();
  const pied = el('version');
  if (pied) pied.textContent = `version ${VERSION}`;
  afficherVue(location.hash.slice(1) || 'dashboard');
}

function afficherVue(nom) {
  const vue = VUES[nom] ? nom : 'dashboard';
  document.querySelectorAll('nav button').forEach((b) =>
    b.classList.toggle('actif', b.dataset.vue === vue));
  history.replaceState(null, '', `#${vue}`);
  try {
    VUES[vue].rendre(el('contenu'));
  } catch (e) {
    el('contenu').innerHTML = `<div class="carte"><span class="erreur">Erreur d'affichage : ${e.message}</span></div>`;
  }
  window.scrollTo({ top: 0 });
}

function majEntete() {
  const n = D.base.prospects.length;
  const lie = D.fichierLie() ? ' · 📄 fichier lié' : '';
  el('compteur').textContent = (n ? `${n} prospect${n > 1 ? 's' : ''}` : 'aucun prospect') + lie;
}

/* --- Démarrage ------------------------------------------------------------------ */

async function demarrer() {
  D.charger();

  el('nav').innerHTML = Object.entries(VUES)
    .map(([cle, v]) => `<button data-vue="${cle}">${v.libelle}</button>`).join('');
  el('nav').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) afficherVue(b.dataset.vue);
  });

  el('verrouiller').addEventListener('click', etapeCode);
  D.surChangement(majEntete);

  // Première ouverture : on demande d'abord où ranger la base.
  if (!localStorage.getItem(CLE_MODE)) return etapeStockage();

  // Fichier déjà lié : on le retrouve, quitte à redemander l'autorisation.
  if (localStorage.getItem(CLE_MODE) === 'fichier') {
    const poignee = await F.lirePoignee().catch(() => null);
    if (poignee && (await F.autorisation(poignee, true))) {
      D.lierFichier(poignee);
      const texte = await F.lire(poignee).catch(() => '');
      if (texte.trim()) { try { D.adopter(texte); } catch { /* fichier abîmé : on garde le local */ } }
    }
  }
  etapeCode();
}

demarrer().catch((e) => {
  document.body.innerHTML =
    `<div style="padding:40px;text-align:center">
       <h1>Démarrage impossible</h1>
       <p class="erreur">${e.message}</p>
     </div>`;
});
