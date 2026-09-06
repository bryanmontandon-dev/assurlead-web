import { api, libelle, chf, monterNav, echapper } from './api.js';

monterNav();

const el = (id) => document.getElementById(id);

/** Date locale au format AAAA-MM-JJ (jamais UTC : un call de 23h reste dans sa journée). */
function jourLocal(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const decaler = (date, jours) =>
  jourLocal(new Date(new Date(`${date}T12:00:00`).getTime() + jours * 86_400_000));

let dateCourante = new URLSearchParams(location.search).get('date') || jourLocal();

/* --- Rendu -------------------------------------------------------------------- */

function carteKpi({ etiquette, valeur, detail, delta }) {
  const signe = delta > 0 ? 'pos' : delta < 0 ? 'neg' : 'neutre';
  const fleche = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  return `
    <div class="carte kpi">
      <div class="etiquette">${etiquette}</div>
      <div class="valeur">${valeur}</div>
      <div class="detail">
        ${detail ?? ''}
        ${delta !== null && delta !== undefined ? `<span class="delta ${signe}">${fleche} ${Math.abs(delta)}</span>` : ''}
      </div>
    </div>`;
}

const ligneCall = (c) => `
  <a class="ligne-call" href="call-detail.html?id=${c.id}">
    <div style="min-width:0">
      <div style="font-weight:600">
        ${echapper(c.etiquette || libelle('produit_vise', c.produit_vise))}
        ${c.resultat ? `<span class="puce ${c.resultat === 'signe' ? 'ok' : ''}" style="margin-left:6px">${libelle('resultat', c.resultat)}</span>` : ''}
      </div>
      <div style="color:var(--gris-texte);font-size:13px;margin-top:3px">
        ${new Date(c.created_at).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
        ${c.action_prioritaire ? ` · ${echapper(c.action_prioritaire)}` : ' · pas encore analysé'}
      </div>
    </div>
    <div style="text-align:right;min-width:70px">
      <div style="font-size:20px;font-weight:700;font-variant-numeric:tabular-nums">${c.score_global ?? '—'}</div>
      <div style="font-size:11px;color:var(--gris-texte)">${c.score_global !== null ? '/ 10' : 'à analyser'}</div>
    </div>
  </a>`;

function rendreSynthese(jour) {
  const section = el('section-synthese');
  const s = jour.synthese;
  const analyses = jour.nb_analyses;

  if (s?.synthese) {
    section.innerHTML = `
      <div class="synthese-bloc">
        <h2>Le point du jour</h2>
        <p>${echapper(s.synthese)}</p>
        ${s.pattern_detecte ? `<div class="pattern"><strong>Pattern repéré :</strong> ${echapper(s.pattern_detecte)}</div>` : ''}
        <div class="action">
          <div class="etiquette">Demain — une seule priorité</div>
          <p>${echapper(s.action_demain ?? '—')}</p>
        </div>
      </div>
      <p class="sous-titre" style="margin-top:10px">
        Généré le ${s.genere_at ? new Date(s.genere_at).toLocaleString('fr-CH') : '—'} ·
        <a href="#" id="regenerer">régénérer</a>
      </p>`;
    el('regenerer').addEventListener('click', (e) => {
      e.preventDefault();
      genererSynthese(e.target);
    });
    return;
  }

  section.innerHTML = `
    <div class="carte" style="text-align:center;padding:34px 20px">
      <p style="margin:0 0 6px;font-weight:600">Pas encore de point du jour pour cette date.</p>
      <p class="sous-titre" style="margin:0 0 16px">
        ${
          analyses > 0
            ? `${analyses} call(s) analysé(s) — de quoi faire une synthèse.`
            : jour.nb_calls > 0
              ? "Aucun call analysé ce jour-là : lance d'abord l'analyse d'un débrief."
              : 'Aucun call ce jour-là.'
        }
      </p>
      <button class="btn primaire" id="generer" ${analyses > 0 ? '' : 'disabled'}>
        Générer le point du jour
      </button>
      <p class="sous-titre" id="etat-synthese" style="min-height:20px;margin-top:12px"></p>
    </div>`;

  el('generer')?.addEventListener('click', (e) => genererSynthese(e.target));
}

async function genererSynthese(bouton) {
  const etat = el('etat-synthese');
  bouton.disabled = true;
  const ancienTexte = bouton.textContent;
  bouton.textContent = 'Génération…';
  if (etat) etat.textContent = 'Claude analyse ta journée (20 à 40 secondes)…';

  try {
    await api(`/daily/${dateCourante}/generer`, { method: 'POST' });
    charger();
  } catch (e) {
    bouton.disabled = false;
    bouton.textContent = ancienTexte;
    if (etat) etat.textContent = `Erreur : ${e.message}`;
    else alert(`Erreur : ${e.message}`);
  }
}

/* --- Chargement ---------------------------------------------------------------- */

async function charger() {
  el('date').value = dateCourante;
  const jour = await api(`/daily/${dateCourante}`);

  const estAujourdhui = dateCourante === jourLocal();
  const libelleDate = new Date(`${dateCourante}T12:00:00`).toLocaleDateString('fr-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  el('titre-jour').textContent = estAujourdhui ? "Point du jour" : 'Point du jour';
  el('sous-titre').textContent = `${libelleDate}${estAujourdhui ? " (aujourd'hui)" : ''}`;
  el('suiv').disabled = estAujourdhui;

  el('kpis').innerHTML = [
    carteKpi({
      etiquette: 'Calls du jour',
      valeur: jour.nb_calls,
      detail: `${jour.nb_analyses} analysé(s)`,
    }),
    carteKpi({
      etiquette: 'Score moyen',
      valeur: jour.score_moyen_jour ?? '—',
      detail: jour.veille.score_moyen_jour !== null ? `veille : ${jour.veille.score_moyen_jour}` : 'pas de veille',
      delta: jour.delta_score,
    }),
    carteKpi({
      etiquette: 'Signatures',
      valeur: jour.nb_signes,
      detail: `sur ${jour.nb_calls} call(s)`,
    }),
    carteKpi({
      etiquette: 'MAPRO du jour',
      valeur: `${chf(jour.mapro_jour)} CHF`,
      detail: jour.synthese?.mapro_jour != null ? 'saisie manuelle' : 'calculé depuis les calls',
    }),
  ].join('');

  el('calls-jour').innerHTML = jour.calls.length
    ? jour.calls.map(ligneCall).join('')
    : '<div class="vide">Aucun call ce jour-là.</div>';

  el('mapro').value = jour.synthese?.mapro_jour ?? '';
  el('message-mapro').textContent = '';

  rendreSynthese(jour);
}

/* --- Navigation ---------------------------------------------------------------- */

function allerA(date) {
  dateCourante = date;
  history.replaceState(null, '', `daily.html?date=${date}`);
  charger();
}

el('prec').addEventListener('click', () => allerA(decaler(dateCourante, -1)));
el('suiv').addEventListener('click', () => allerA(decaler(dateCourante, 1)));
el('aujourdhui').addEventListener('click', () => allerA(jourLocal()));
el('date').addEventListener('change', (e) => e.target.value && allerA(e.target.value));

el('enregistrer-mapro').addEventListener('click', async (e) => {
  e.target.disabled = true;
  try {
    await api(`/daily/${dateCourante}/mapro`, {
      method: 'PUT',
      body: { mapro_jour: el('mapro').value || 0 },
    });
    el('message-mapro').textContent = 'Enregistré.';
    charger();
  } catch (err) {
    el('message-mapro').textContent = `Erreur : ${err.message}`;
  } finally {
    e.target.disabled = false;
  }
});

charger().catch((e) => {
  el('sous-titre').textContent = `Erreur : ${e.message}`;
});
