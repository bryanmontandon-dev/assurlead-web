import { api, chf, monterNav, echapper } from './api.js';

monterNav();

const el = (id) => document.getElementById(id);
const moisCourant = () => new Date().toISOString().slice(0, 7);

const libelleMois = (mois) =>
  new Date(`${mois}-01T12:00:00`).toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' });

/* --- Jauges -------------------------------------------------------------------- */

/**
 * `realise` et `cible` sont des NOMBRES (le calcul du pourcentage en dépend) ;
 * `afficheRealise` / `afficheCible` portent la mise en forme.
 */
function jauge({ etiquette, realise, cible, afficheRealise, afficheCible, unite, reste }) {
  const aCible = Number.isFinite(cible) && cible > 0;
  const pct = aCible ? Math.min(100, Math.round((realise / cible) * 100)) : null;
  const couleur = pct === null ? 'var(--gris-bord)' : pct >= 100 ? 'var(--vert)' : pct >= 60 ? 'var(--bleu)' : 'var(--ambre)';

  return `
    <div class="jauge">
      <div class="entete">
        <span>${etiquette}</span>
        <span>
          <span class="chiffre">${afficheRealise}</span>
          <span class="cible">${aCible ? ` / ${afficheCible} ${unite}` : ` ${unite} · pas d'objectif`}</span>
        </span>
      </div>
      <div class="piste">
        <div class="remplissage" style="width:${pct ?? 0}%;background:${couleur}"></div>
      </div>
      ${aCible ? `<div class="reste">${pct}% de l'objectif · ${reste}</div>` : ''}
    </div>`;
}

/** Jours ouvrés restants dans le mois (lundi-vendredi), pour rendre l'écart concret. */
function joursOuvresRestants(mois) {
  const maintenant = new Date();
  if (mois !== moisCourant()) return null;

  const fin = new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 0);
  let jours = 0;
  for (let d = new Date(maintenant); d <= fin; d.setDate(d.getDate() + 1)) {
    const jour = d.getDay();
    if (jour !== 0 && jour !== 6) jours++;
  }
  return jours;
}

/* --- Chargement ---------------------------------------------------------------- */

async function charger(mois = el('mois').value || moisCourant()) {
  const [vue, objectifs] = await Promise.all([api(`/stats/overview?mois=${mois}`), api('/stats/objectifs')]);

  el('titre-mois').textContent = libelleMois(mois);
  el('sous-titre').textContent = `Suivi de ${libelleMois(mois)}`;

  const restants = joursOuvresRestants(mois);
  const ecartMapro = vue.mapro.cible ? Math.max(0, vue.mapro.cible - vue.mapro.realise) : 0;
  const ecartRdv = vue.rdv.cible ? Math.max(0, vue.rdv.cible - vue.rdv.realise) : 0;

  el('jauges').innerHTML =
    jauge({
      etiquette: 'MAPRO',
      realise: vue.mapro.realise,
      cible: vue.mapro.cible,
      afficheRealise: chf(vue.mapro.realise),
      afficheCible: chf(vue.mapro.cible),
      unite: 'CHF',
      reste:
        ecartMapro === 0
          ? 'objectif atteint 🎯'
          : restants
            ? `${chf(ecartMapro)} CHF restants · ${chf(Math.ceil(ecartMapro / restants))} CHF par jour ouvré (${restants} j)`
            : `${chf(ecartMapro)} CHF restants`,
    }) +
    jauge({
      etiquette: 'RDV / calls débriefés',
      realise: vue.rdv.realise,
      cible: vue.rdv.cible,
      afficheRealise: vue.rdv.realise,
      afficheCible: vue.rdv.cible,
      unite: 'RDV',
      reste:
        ecartRdv === 0
          ? 'objectif atteint 🎯'
          : restants
            ? `${ecartRdv} RDV restants · ${(ecartRdv / restants).toFixed(1)} par jour ouvré (${restants} j)`
            : `${ecartRdv} RDV restants`,
    }) +
    `<div style="border-top:1px solid var(--gris-bord);padding-top:14px;margin-top:4px;font-size:13.5px;color:var(--gris-texte)">
       Série en cours : <strong style="color:var(--bleu-nuit)">${vue.streak.jours} jour(s)</strong>
       ${vue.streak.actif_aujourdhui ? '· déjà débriefé aujourd’hui' : '· rien débriefé aujourd’hui'}
       ${vue.semaine.score_moyen !== null ? `<br>Score moyen sur 7 jours : <strong style="color:var(--bleu-nuit)">${vue.semaine.score_moyen}/10</strong>` : ''}
     </div>`;

  const actuel = objectifs.find((o) => o.mois === mois);
  el('mapro_cible').value = actuel?.mapro_cible ?? '';
  el('nb_rdv_cible').value = actuel?.nb_rdv_cible ?? '';

  rendreHistorique(objectifs);
}

function rendreHistorique(objectifs) {
  if (objectifs.length === 0) {
    el('historique').innerHTML =
      '<tr><td class="vide" style="border:none">Aucun objectif enregistré pour l’instant.</td></tr>';
    return;
  }

  el('historique').innerHTML = `
    <thead>
      <tr>
        <th>Mois</th>
        <th class="nombre">MAPRO réalisée</th>
        <th class="nombre">Cible</th>
        <th class="nombre">Écart</th>
        <th class="nombre">RDV cible</th>
      </tr>
    </thead>
    <tbody>
      ${objectifs
        .map((o) => {
          const ecart = o.mapro_cible ? o.mapro_reel - o.mapro_cible : null;
          const couleur = ecart === null ? 'var(--gris-texte)' : ecart >= 0 ? 'var(--vert)' : 'var(--rouge)';
          return `
            <tr>
              <td>${echapper(libelleMois(o.mois))}</td>
              <td class="nombre">${chf(o.mapro_reel)} CHF</td>
              <td class="nombre">${o.mapro_cible ? `${chf(o.mapro_cible)} CHF` : '—'}</td>
              <td class="nombre" style="color:${couleur};font-weight:600">
                ${ecart === null ? '—' : `${ecart >= 0 ? '+' : ''}${chf(ecart)}`}
              </td>
              <td class="nombre">${o.nb_rdv_cible ?? '—'}</td>
            </tr>`;
        })
        .join('')}
    </tbody>`;
}

/* --- Enregistrement ------------------------------------------------------------ */

el('enregistrer').addEventListener('click', async (e) => {
  const mois = el('mois').value || moisCourant();
  e.target.disabled = true;
  el('message').textContent = 'Enregistrement…';
  try {
    await api(`/stats/objectifs/${mois}`, {
      method: 'PUT',
      body: {
        mapro_cible: el('mapro_cible').value || null,
        nb_rdv_cible: el('nb_rdv_cible').value || null,
      },
    });
    el('message').textContent = 'Objectifs enregistrés.';
    await charger(mois);
  } catch (err) {
    el('message').textContent = `Erreur : ${err.message}`;
  } finally {
    e.target.disabled = false;
  }
});

el('mois').addEventListener('change', (e) => charger(e.target.value || moisCourant()));

el('mois').value = moisCourant();
charger().catch((e) => {
  el('sous-titre').textContent = `Erreur : ${e.message}`;
});
