/** Client HTTP minimal + helpers partagés par toutes les pages. */

export async function api(chemin, options = {}) {
  const reponse = await fetch(`/api${chemin}`, {
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (reponse.status === 204) return null;

  const data = await reponse.json().catch(() => ({}));
  if (!reponse.ok) throw new Error(data.erreur || `Erreur ${reponse.status}`);
  return data;
}

export const LIBELLES = {
  mode: { debrief: 'Débrief oral', enregistrement: 'Enregistrement' },
  client_type: {
    portefeuille_existant: 'Portefeuille existant',
    nouveau_prospect: 'Nouveau prospect',
    recommandation: 'Recommandation',
  },
  produit_vise: {
    vie_3a: 'Vie / 3a',
    pme: 'PME',
    non_vie: 'Non-vie',
    bilan_general: 'Bilan général',
    autre: 'Autre',
  },
  resultat: {
    signe: 'Signé',
    a_relancer: 'À relancer',
    perdu: 'Perdu',
    rdv2_planifie: 'RDV 2 planifié',
  },
  dimension: {
    score_decouverte: 'Découverte',
    score_objections: 'Objections',
    score_closing: 'Closing',
    score_produit: 'Produit',
    score_rythme: 'Rythme / écoute',
  },
};

export const libelle = (groupe, cle) => LIBELLES[groupe]?.[cle] ?? cle ?? '—';

export const chf = (n) =>
  n === null || n === undefined
    ? '—'
    : new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 0 }).format(n);

export function dateCourte(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: 'short' });
}

export function dateHeure(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-CH', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Classe couleur d'un score 0-10. */
export const classeScore = (v) => (v === null || v === undefined ? '' : v < 5 ? 'faible' : v < 7.5 ? 'moyen' : 'bon');

/** Une seule source de vérité pour la navigation, partagée par toutes les pages. */
const PAGES = [
  ['/', 'Tableau de bord'],
  ['record.html', 'Nouveau débrief'],
  ['daily.html', 'Point du jour'],
  ['clients.html', 'Clients'],
  ['objectifs.html', 'Objectifs'],
  ['stats.html', 'Statistiques'],
];

/** Construit l'en-tête et marque la page courante. */
export function monterNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  const entete = document.querySelector('header.app');
  if (!entete) return;

  entete.innerHTML = `
    <span class="marque">Mentor Call</span>
    <nav>
      ${PAGES.map(([href, libelle]) => {
        const actif = href === page || (page === 'index.html' && href === '/');
        return `<a href="${href}"${actif ? ' class="actif"' : ''}>${libelle}</a>`;
      }).join('')}
    </nav>`;
}

export function echapper(texte) {
  const d = document.createElement('div');
  d.textContent = texte ?? '';
  return d.innerHTML;
}
