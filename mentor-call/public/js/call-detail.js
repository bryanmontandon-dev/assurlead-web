import { api, libelle, chf, dateHeure, classeScore, monterNav, echapper, LIBELLES } from './api.js';

monterNav();

const contenu = document.getElementById('contenu');
const id = new URLSearchParams(location.search).get('id');

const COULEURS = { faible: 'var(--rouge)', moyen: 'var(--ambre)', bon: 'var(--vert)', '': 'var(--gris-bord)' };

const barre = (etiquette, valeur) => `
  <div class="dimension">
    <div class="entete">
      <span>${etiquette}</span>
      <span class="note">${valeur ?? '—'}<span style="color:var(--gris-texte);font-weight:400"> / 10</span></span>
    </div>
    <div class="barre-piste">
      <div class="barre-valeur ${classeScore(valeur)}" style="width:${(valeur ?? 0) * 10}%"></div>
    </div>
  </div>`;

const point = (p, type) => `
  <div class="bloc-point ${type}">
    ${p.citation ? `<div class="citation">« ${echapper(p.citation)} »</div>` : ''}
    <p class="commentaire">${echapper(p.commentaire)}</p>
    ${
      p.reformulation_suggeree
        ? `<div class="reformulation"><strong>À dire plutôt :</strong> ${echapper(p.reformulation_suggeree)}</div>`
        : ''
    }
  </div>`;

function rendu(call) {
  const analyse = call.score_global !== null;

  const enTete = `
    <div class="titre-page">
      <div>
        <h1>${echapper(call.etiquette || `Call #${call.id}`)}</h1>
        <p class="sous-titre">
          ${dateHeure(call.created_at)} · ${libelle('mode', call.mode)}
          ${call.produit_vise ? ` · ${libelle('produit_vise', call.produit_vise)}` : ''}
          ${call.client_type ? ` · ${libelle('client_type', call.client_type)}` : ''}
          ${call.resultat ? ` · <strong>${libelle('resultat', call.resultat)}</strong>` : ''}
          ${call.montant_mapro ? ` · ${chf(call.montant_mapro)} CHF` : ''}
        </p>
      </div>
      <a class="btn secondaire" href="/">← Tableau de bord</a>
    </div>`;

  if (!analyse) {
    return `${enTete}
      <div class="carte" style="text-align:center;padding:38px 20px">
        <p style="margin:0 0 16px">Ce débrief n'a pas encore été analysé.</p>
        <button class="btn primaire" id="lancer">Lancer l'analyse</button>
        <p class="sous-titre" id="etat-analyse" style="min-height:20px;margin-top:12px"></p>
      </div>
      ${blocTranscript(call)}`;
  }

  const couleur = COULEURS[classeScore(call.score_global)];

  return `${enTete}

    <section class="grille k2" style="align-items:start">
      <div class="carte">
        <h2>Grille de vente</h2>
        <div style="display:flex;gap:20px;align-items:center;margin-bottom:20px">
          <div class="score-cercle" style="background:${couleur}">
            <span class="n">${call.score_global}</span>
            <span class="l">global</span>
          </div>
          <p class="sous-titre" style="margin:0">
            Moyenne pondérée : découverte 25 %, objections 20 %, closing 25 %, produit 15 %,
            rythme 15 %.
          </p>
        </div>
        ${Object.entries(LIBELLES.dimension).map(([champ, nom]) => barre(nom, call[champ])).join('')}
      </div>

      <div class="carte">
        <h2>Réflexe courtier <span class="puce" style="margin-left:4px">Swiss Courtage</span></h2>
        <p class="sous-titre" style="margin:0 0 16px">
          Les compétences que le métier de courtier exigera, mesurées dès maintenant.
        </p>
        ${barre('Comparaison marché', call.score_courtier_comparaison)}
        ${barre('Indépendance du conseil', call.score_courtier_independance)}
        ${barre('Vision portefeuille', call.score_courtier_portefeuille)}
        ${
          call.observation_courtier
            ? `<p style="font-size:14.5px;margin:14px 0 0;padding-top:14px;border-top:1px solid var(--gris-bord)">${echapper(call.observation_courtier)}</p>`
            : ''
        }
      </div>
    </section>

    ${blocWhy(call)}

    <section style="margin-top:26px">
      <div class="action-prioritaire">
        <div class="etiquette">Action prioritaire — la seule chose à corriger d'abord</div>
        <p>${echapper(call.action_prioritaire ?? '—')}</p>
        <button class="btn ${call.marque_travaille ? 'primaire' : 'secondaire'}" id="travaille">
          ${call.marque_travaille ? '✓ Marqué comme travaillé' : 'Marquer comme travaillé'}
        </button>
      </div>
    </section>

    <section class="grille k2" style="margin-top:26px;align-items:start">
      <div class="carte">
        <h2>Ce qui a marché</h2>
        ${call.points_forts.map((p) => point(p, 'fort')).join('') || '<div class="vide">Rien de relevé.</div>'}
      </div>
      <div class="carte">
        <h2>Ce qui a coincé</h2>
        ${call.points_ameliorer.map((p) => point(p, 'ameliorer')).join('') || '<div class="vide">Rien de relevé.</div>'}
      </div>
    </section>

    <section style="margin-top:26px">
      ${blocTranscript(call)}
    </section>

    <p class="sous-titre" style="margin-top:18px">
      Analysé le ${dateHeure(call.analyse_at)} · modèle <code>${echapper(call.modele_utilise ?? '—')}</code>
      · ${call.latence_ms ? `${(call.latence_ms / 1000).toFixed(1)} s` : '—'}
      · <a href="#" id="relancer">relancer l'analyse</a>
    </p>`;
}

/**
 * Start With Why (Sinek) : le POURQUOI du client a-t-il précédé le produit ?
 * C'est l'antidote direct à l'objection prix — une prime n'est « chère »
 * que si elle ne pèse contre rien.
 */
function blocWhy(call) {
  if (call.score_why === null && !call.conseil_why) return '';

  return `
    <section style="margin-top:26px">
      <div class="carte" style="border-left:3px solid var(--bleu)">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:14px;flex-wrap:wrap">
          <h2 style="margin:0">Start with Why</h2>
          <span class="sous-titre" style="margin:0">Pourquoi → Comment → Quoi</span>
        </div>
        <p class="sous-titre" style="margin:6px 0 16px">
          Le client a-t-il exprimé <strong>ce qu'il protège</strong> avant que tu parles produit ?
        </p>
        ${barre('Ancrage du POURQUOI', call.score_why)}
        ${
          call.conseil_why
            ? `<p style="font-size:14.5px;margin:16px 0 0">${echapper(call.conseil_why)}</p>`
            : ''
        }
        ${
          call.phrase_why
            ? `<div class="reformulation" style="margin-top:12px">
                 <strong>À poser au prochain RDV :</strong> « ${echapper(call.phrase_why)} »
               </div>`
            : ''
        }
      </div>
    </section>`;
}

const blocTranscript = (call) => `
  <div class="carte">
    <details class="transcript">
      <summary>Transcription (${call.transcript?.length ?? 0} caractères)</summary>
      <pre>${echapper(call.transcript ?? '')}</pre>
    </details>
  </div>`;

/* --- Actions ------------------------------------------------------------------ */

async function lancerAnalyse(etatEl) {
  etatEl.textContent = 'Analyse en cours (30 à 60 secondes)…';
  try {
    await api(`/calls/${id}/analyser`, { method: 'POST' });
    charger();
  } catch (e) {
    etatEl.textContent = `Erreur : ${e.message}`;
  }
}

function brancherActions(call) {
  document.getElementById('lancer')?.addEventListener('click', (e) => {
    e.target.disabled = true;
    lancerAnalyse(document.getElementById('etat-analyse'));
  });

  document.getElementById('relancer')?.addEventListener('click', async (e) => {
    e.preventDefault();
    e.target.textContent = 'analyse en cours…';
    await api(`/calls/${id}/analyser`, { method: 'POST' }).catch(() => {});
    charger();
  });

  document.getElementById('travaille')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    await api(`/calls/${id}`, { method: 'PATCH', body: { marque_travaille: !call.marque_travaille } });
    charger();
  });
}

async function charger() {
  if (!id) {
    contenu.innerHTML = '<p class="vide">Aucun call sélectionné.</p>';
    return;
  }
  try {
    const call = await api(`/calls/${id}`);
    contenu.innerHTML = rendu(call);
    brancherActions(call);
  } catch (e) {
    contenu.innerHTML = `<p class="vide">Erreur : ${echapper(e.message)}</p>`;
  }
}

charger();
