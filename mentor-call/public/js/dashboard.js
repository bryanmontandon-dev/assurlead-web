import { api, libelle, chf, dateHeure, classeScore, monterNav, echapper } from './api.js';

monterNav();

const el = (id) => document.getElementById(id);

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

function ligneCall(c) {
  const score = c.score_global;
  return `
    <a href="call-detail.html?id=${c.id}" style="display:grid;grid-template-columns:1fr auto;gap:12px;padding:13px 18px;border-top:1px solid var(--gris-bord);text-decoration:none;color:inherit">
      <div style="min-width:0">
        <div style="font-weight:600">
          ${echapper(c.etiquette || libelle('produit_vise', c.produit_vise))}
          <span class="puce" style="margin-left:6px">${libelle('mode', c.mode)}</span>
          ${c.resultat ? `<span class="puce ${c.resultat === 'signe' ? 'ok' : ''}" style="margin-left:4px">${libelle('resultat', c.resultat)}</span>` : ''}
        </div>
        <div style="color:var(--gris-texte);font-size:13px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${dateHeure(c.created_at)} · ${echapper(c.extrait || 'Pas encore de transcript')}${c.longueur_transcript > 180 ? '…' : ''}
        </div>
      </div>
      <div style="text-align:right;min-width:78px">
        <div style="font-size:20px;font-weight:700;font-variant-numeric:tabular-nums">${score ?? '—'}</div>
        <div style="font-size:11px;color:var(--gris-texte)">${score !== null ? '/ 10' : 'non analysé'}</div>
      </div>
    </a>`;
}

/* --- Connexion au compte Claude ------------------------------------------- */

function rendreAuth(auth) {
  const bloc = el('bloc-auth');
  if (!bloc) return;

  // Moteur « clé d'API » : rien à connecter, tout se joue dans .env.
  if (auth.moteur === 'api') {
    bloc.innerHTML = `<span style="font-size:13px;color:var(--gris-texte)">
      Moteur : clé d'API ${auth.connecte ? 'configurée dans <code>.env</code>' : '<strong>absente</strong> — renseigne <code>ANTHROPIC_API_KEY</code> dans <code>.env</code>'}.
    </span>`;
    return;
  }

  // Déjà connecté au bon compte.
  if (auth.connecte) {
    bloc.innerHTML = `
      <span style="font-size:13px;color:var(--gris-texte)">
        Compte Claude connecté — l'analyse tourne sur ton abonnement
        (${echapper(auth.cli?.modele ?? '—')}), sans crédits d'API.
      </span>
      <a href="#" id="deconnexion" style="font-size:13px;margin-left:8px">se déconnecter</a>`;

    el('deconnexion').addEventListener('click', async (e) => {
      e.preventDefault();
      e.target.textContent = 'déconnexion…';
      await api('/auth/deconnexion', { method: 'POST' }).catch(() => {});
      charger();
    });
    return;
  }

  // Connexion en cours : Claude a ouvert une page, l'utilisateur en rapporte un code.
  if (auth.connexion?.etape === 'attente_code' && auth.connexion.url) {
    rendreAttenteCode(auth.connexion.url);
    return;
  }

  const mauvaisCompte = auth.cli?.connecte && auth.cli?.abonnement_claude_ai === false;

  bloc.innerHTML = `
    ${
      mauvaisCompte
        ? `<p style="font-size:13.5px;margin:0 0 10px;background:#fdf1e3;border:1px solid #f3d9b8;border-radius:8px;padding:11px 13px">
             Le compte actuellement connecté est un profil de plateforme développeur (facturé en
             crédits d'API). Reconnecte-toi avec ton compte claude.ai pour utiliser ton abonnement.
           </p>`
        : ''
    }
    <button class="btn primaire" id="connexion">Connecter mon compte Claude</button>
    <p style="font-size:12.5px;color:var(--gris-texte);margin:8px 0 0">
      Claude s'ouvre dans ton navigateur, tu valides, et tu recolles ici le code affiché.
      ${auth.cli?.installe ? '' : '<br><span style="color:var(--rouge)">CLI Claude Code introuvable — voir le README.</span>'}
      ${auth.connexion?.erreur ? `<br><span style="color:var(--rouge)">${echapper(auth.connexion.erreur)}</span>` : ''}
    </p>`;

  el('connexion').addEventListener('click', async (e) => {
    e.target.disabled = true;
    e.target.textContent = 'Ouverture de Claude…';
    try {
      const { url } = await api('/auth/connexion', { method: 'POST' });
      rendreAttenteCode(url);
    } catch (err) {
      e.target.disabled = false;
      e.target.textContent = 'Connecter mon compte Claude';
      bloc.insertAdjacentHTML('beforeend', `<p style="color:var(--rouge);font-size:13px">${echapper(err.message)}</p>`);
    }
  });
}

/** Deuxième temps : Claude affiche un code, l'utilisateur le colle ici. */
function rendreAttenteCode(url) {
  const bloc = el('bloc-auth');
  bloc.innerHTML = `
    <p style="font-size:13.5px;margin:0 0 10px">
      <strong>Claude s'est ouvert dans ton navigateur.</strong> Connecte-toi avec ton compte,
      puis copie le code affiché et colle-le ici.
    </p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <input type="text" id="code-auth" placeholder="Colle le code ici" autocomplete="off"
        style="flex:1;min-width:240px;font-family:inherit;font-size:14.5px;padding:9px 11px;border:1px solid var(--gris-bord);border-radius:8px" />
      <button class="btn primaire" id="valider-code">Valider</button>
    </div>
    <p style="font-size:12.5px;color:var(--gris-texte);margin:8px 0 0">
      La page ne s'est pas ouverte ? <a href="${echapper(url)}" target="_blank" rel="noopener">Ouvre-la ici</a>.
      <span id="message-code"></span>
    </p>`;

  const valider = async () => {
    const champ = el('code-auth');
    const bouton = el('valider-code');
    if (!champ.value.trim()) return;

    bouton.disabled = true;
    bouton.textContent = 'Vérification…';
    try {
      await api('/auth/code', { method: 'POST', body: { code: champ.value } });
      charger();
    } catch (err) {
      // Session perdue : le code collé ne vaut plus rien, il faut en régénérer un.
      if (/session|attente/i.test(err.message)) {
        bloc.innerHTML = `
          <p style="font-size:13.5px;margin:0 0 10px">${echapper(err.message)}</p>
          <button class="btn primaire" id="relancer-connexion">Relancer la connexion</button>`;
        el('relancer-connexion').addEventListener('click', async (e) => {
          e.target.disabled = true;
          e.target.textContent = 'Ouverture de Claude…';
          try {
            const { url } = await api('/auth/connexion', { method: 'POST' });
            rendreAttenteCode(url);
          } catch (err2) {
            e.target.disabled = false;
            e.target.textContent = 'Relancer la connexion';
            bloc.insertAdjacentHTML('beforeend', `<p style="color:var(--rouge);font-size:13px">${echapper(err2.message)}</p>`);
          }
        });
        return;
      }
      bouton.disabled = false;
      bouton.textContent = 'Valider';
      el('message-code').innerHTML = `<br><span style="color:var(--rouge)">${echapper(err.message)}</span>`;
    }
  };

  el('valider-code').addEventListener('click', valider);
  el('code-auth').addEventListener('keydown', (e) => e.key === 'Enter' && valider());
  el('code-auth').focus();
}

async function charger() {
  const [sante, vue, calls] = await Promise.all([
    api('/health'),
    api('/stats/overview'),
    api('/calls?limit=8'),
  ]);

  const moisLibelle = new Date(`${vue.mois}-01T12:00:00`).toLocaleDateString('fr-CH', {
    month: 'long',
    year: 'numeric',
  });
  el('sous-titre').textContent = `${moisLibelle} · ${vue.total_calls} call(s) enregistré(s) au total`;

  el('kpis').innerHTML = [
    carteKpi({
      etiquette: 'Score moyen — 7 jours',
      valeur: vue.semaine.score_moyen ?? '—',
      detail: `${vue.semaine.nb_calls} call(s) `,
      delta: vue.semaine.delta_score,
    }),
    carteKpi({
      etiquette: `MAPRO ${vue.mois}`,
      valeur: `${chf(vue.mapro.realise)} CHF`,
      detail: vue.mapro.cible
        ? `objectif ${chf(vue.mapro.cible)} · ${vue.mapro.progression_pct}%`
        : 'aucun objectif défini',
    }),
    carteKpi({
      etiquette: 'Taux de signature — 7 j',
      valeur: vue.semaine.taux_signature !== null ? `${vue.semaine.taux_signature}%` : '—',
      detail: `${vue.semaine.nb_signes} signature(s)`,
    }),
    carteKpi({
      etiquette: 'Série en cours',
      valeur: `${vue.streak.jours} j`,
      detail: vue.streak.actif_aujourdhui ? 'déjà débriefé aujourd’hui' : 'rien débriefé aujourd’hui',
    }),
  ].join('');

  if (vue.dernier_point_du_jour?.synthese) {
    const p = vue.dernier_point_du_jour;
    el('dernier-point').innerHTML = `
      <div class="puce">${p.date}</div>
      <p style="margin:10px 0">${echapper(p.synthese)}</p>
      ${p.action_demain ? `<p style="margin:0"><strong>Action :</strong> ${echapper(p.action_demain)}</p>` : ''}`;
  }

  el('derniers-calls').innerHTML = calls.calls.length
    ? calls.calls.map(ligneCall).join('')
    : `<div class="vide">Aucun call pour l'instant. <a href="record.html">Débriefe ton premier RDV →</a></div>`;

  const puce = (ok, texteOk, texteKo) =>
    `<span class="puce ${ok ? 'ok' : 'alerte'}">${ok ? texteOk : texteKo}</span>`;

  const whisper = sante.config.whisper;
  const auth = sante.config.auth;
  const modeleWhisper = whisper.modele.split('/').pop();

  const libelleAuth = {
    claude_code: 'Claude Code connecté (abonnement)',
    compte_claude: 'Compte Claude connecté',
    cle_api: 'Clé d’API configurée',
  };

  el('sante').innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
      ${puce(sante.ok, 'Serveur local OK', 'Serveur KO')}
      ${puce(true, `Base SQLite v${sante.db.schema_version}`, '')}
      ${
        auth.moteur === 'cli' && auth.connecte && auth.cli?.abonnement_claude_ai === false
          ? puce(false, '', 'Claude Code sur le mauvais compte')
          : puce(
              auth.connecte,
              libelleAuth[auth.methode] ?? 'Connecté',
              auth.moteur === 'cli' ? 'Claude Code non connecté' : 'Compte Claude non connecté',
            )
      }
      ${puce(whisper.pret, `Transcription locale prête (${echapper(modeleWhisper)})`, 'Whisper incomplet')}
    </div>

    <div id="bloc-auth" style="margin-top:14px"></div>

    ${
      whisper.pret
        ? ''
        : `<p style="font-size:13px;color:var(--gris-texte);margin:10px 0 0">
             Whisper incomplet (binaire : ${whisper.binaire_present ? 'OK' : 'manquant'}, modèle :
             ${whisper.modele_present ? 'OK' : 'manquant'}). Recompile avec
             <code>cd vendor/whisper.cpp && GGML_NO_METAL=1 make -j4</code>.
           </p>`
    }

    <div style="color:var(--gris-texte);font-size:12.5px;margin-top:12px">
      Modèle d'analyse :
      <code>${echapper(auth.moteur === 'cli' ? `${auth.cli?.modele ?? '—'} · Claude Code` : sante.config.modele)}</code>
      · Base : <code>${echapper(sante.db.chemin)}</code>
    </div>`;

  rendreAuth(auth);
}

charger().catch((e) => {
  el('sous-titre').textContent = `Erreur : ${e.message}`;
});
