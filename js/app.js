/** Démarrage : verrou, navigation, rendu de la vue courante. */
import * as D from './donnees.js';
import { VUES } from './modules.js';

const el = (id) => document.getElementById(id);
const CLE_VERROU = 'assurlead:code';

/* --- Verrou ------------------------------------------------------------------- */

async function empreinte(texte) {
  const octets = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
  return [...new Uint8Array(octets)].map((o) => o.toString(16).padStart(2, '0')).join('');
}

function afficherVerrou(premiereFois) {
  el('verrou').hidden = false;
  el('app').hidden = true;
  el('verrou-titre').textContent = premiereFois ? 'Choisis ton code' : 'AssurLead';
  el('verrou-aide').textContent = premiereFois
    ? 'Il protège l’accès sur cet appareil. Note-le : il n’est récupérable nulle part.'
    : 'Saisis ton code d’accès';
  el('verrou-bouton').textContent = premiereFois ? 'Définir le code' : 'Déverrouiller';
  el('verrou-code').focus();
}

function ouvrirApp() {
  el('verrou').hidden = true;
  el('app').hidden = false;
  afficherVue(location.hash.slice(1) || 'dashboard');
}

async function initVerrou() {
  const enregistre = localStorage.getItem(CLE_VERROU);
  const premiereFois = !enregistre;
  afficherVerrou(premiereFois);

  const valider = async () => {
    const saisie = el('verrou-code').value.trim();
    if (saisie.length < 4) {
      el('verrou-message').innerHTML = '<span class="erreur">4 caractères minimum.</span>';
      return;
    }
    const hash = await empreinte(saisie);

    if (premiereFois) {
      localStorage.setItem(CLE_VERROU, hash);
      ouvrirApp();
      return;
    }
    if (hash === enregistre) {
      ouvrirApp();
    } else {
      el('verrou-code').value = '';
      el('verrou-message').innerHTML = '<span class="erreur">Code incorrect.</span>';
    }
  };

  el('verrou-bouton').addEventListener('click', valider);
  el('verrou-code').addEventListener('keydown', (e) => e.key === 'Enter' && valider());
}

/* --- Navigation ---------------------------------------------------------------- */

function afficherVue(nom) {
  const vue = VUES[nom] ? nom : 'dashboard';
  document.querySelectorAll('nav button').forEach((b) =>
    b.classList.toggle('actif', b.dataset.vue === vue));
  history.replaceState(null, '', `#${vue}`);
  VUES[vue].rendre(el('contenu'));
  window.scrollTo({ top: 0 });
}

function construireNav() {
  el('nav').innerHTML = Object.entries(VUES)
    .map(([cle, v]) => `<button data-vue="${cle}">${v.libelle}</button>`).join('');
  el('nav').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) afficherVue(b.dataset.vue);
  });
}

/* --- Démarrage ------------------------------------------------------------------ */

D.charger();
construireNav();
initVerrou();

el('verrouiller').addEventListener('click', () => {
  el('verrou-code').value = '';
  el('verrou-message').textContent = '';
  afficherVerrou(false);
});

// La base a changé (import, réinitialisation) : on rafraîchit l'en-tête.
D.surChangement(() => {
  const n = D.base.prospects.length;
  el('compteur').textContent = n ? `${n} prospect${n > 1 ? 's' : ''}` : 'aucun prospect';
});
