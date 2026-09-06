import { api, libelle, chf, dateCourte, monterNav, echapper, LIBELLES } from './api.js';

monterNav();

const el = (id) => document.getElementById(id);

let clients = [];
let selection = null; // id du client affiché, ou 'nouveau'

const jourLocal = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/* --- Liste -------------------------------------------------------------------- */

function ligneClient(c) {
  const aujourdhui = jourLocal();
  const enRetard = c.date_prochaine_action && c.date_prochaine_action <= aujourdhui;

  return `
    <button class="liste-client ${selection === c.id ? 'actif' : ''}" data-id="${c.id}">
      <div class="nom">${echapper(c.nom)}</div>
      <div class="meta">
        ${c.localite ? `${echapper(c.localite)} · ` : ''}${c.nb_calls} call(s)
        ${c.mapro_total ? ` · ${chf(c.mapro_total)} CHF` : ''}
        ${
          c.date_prochaine_action
            ? `<br><span class="${enRetard ? 'relance' : ''}">
                 ${enRetard ? '⚠ à relancer' : 'relance'} le ${c.date_prochaine_action}
               </span>`
            : ''
        }
      </div>
    </button>`;
}

function rendreListe() {
  el('liste').innerHTML = clients.length
    ? clients.map(ligneClient).join('')
    : '<div class="vide">Aucun client. Crée le premier avec « + Nouveau client ».</div>';

  el('liste')
    .querySelectorAll('.liste-client')
    .forEach((b) => b.addEventListener('click', () => ouvrir(Number(b.dataset.id))));
}

/* --- Formulaire ---------------------------------------------------------------- */

const champTexte = (id, etiquette, valeur, type = 'text', extra = '') => `
  <div class="champ">
    <label for="${id}">${etiquette}</label>
    <input type="${type}" id="${id}" value="${valeur == null ? '' : echapper(String(valeur))}" ${extra} />
  </div>`;

const champSelect = (id, etiquette, valeur, options) => `
  <div class="champ">
    <label for="${id}">${etiquette}</label>
    <select id="${id}">
      <option value="">—</option>
      ${Object.entries(options)
        .map(([k, v]) => `<option value="${k}" ${valeur === k ? 'selected' : ''}>${v}</option>`)
        .join('')}
    </select>
  </div>`;

function formulaire(client) {
  const c = client ?? {};
  const nouveau = !client?.id;

  return `
    <div class="carte">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:16px">
        <h2 style="margin:0">${nouveau ? 'Nouveau client' : echapper(c.nom)}</h2>
        ${nouveau ? '' : `<a href="record.html?client_id=${c.id}" class="btn secondaire">Débriefer un RDV</a>`}
      </div>

      ${champTexte('nom', 'Nom *', c.nom)}

      <div class="duo">
        ${champSelect('type', 'Type', c.type, LIBELLES.client_type)}
        ${champSelect('potentiel', 'Potentiel', c.potentiel, { faible: 'Faible', moyen: 'Moyen', fort: 'Fort' })}
      </div>

      <div class="duo">
        ${champTexte('telephone', 'Téléphone', c.telephone)}
        ${champTexte('email', 'E-mail', c.email, 'email')}
      </div>

      <div class="duo">
        ${champTexte('localite', 'Localité', c.localite)}
        ${champTexte('annee_naissance', 'Année de naissance', c.annee_naissance, 'number', 'min="1900" max="2100"')}
      </div>

      <div class="duo">
        ${champTexte('situation_familiale', 'Situation familiale', c.situation_familiale)}
        ${champTexte('profession', 'Profession', c.profession)}
      </div>

      <div class="champ">
        <label>Produits détenus</label>
        <div class="produits">
          ${Object.entries(LIBELLES.produit_vise)
            .map(
              ([cle, nom]) => `
                <label>
                  <input type="checkbox" class="produit" value="${cle}"
                    ${(c.produits_detenus ?? []).includes(cle) ? 'checked' : ''} />
                  ${nom}
                </label>`,
            )
            .join('')}
        </div>
      </div>

      <div class="duo">
        ${champTexte('echeance_prochaine', 'Prochaine échéance de contrat', c.echeance_prochaine, 'date')}
        ${champTexte('date_prochaine_action', 'Date de relance', c.date_prochaine_action, 'date')}
      </div>

      ${champTexte('prochaine_action', 'Prochaine action', c.prochaine_action)}
      ${champTexte('origine', 'Origine (recommandé par…, campagne…)', c.origine)}

      <div class="champ">
        <label for="notes">Notes</label>
        <textarea id="notes">${echapper(c.notes ?? '')}</textarea>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn primaire" id="sauver">${nouveau ? 'Créer la fiche' : 'Enregistrer'}</button>
        ${nouveau ? '' : '<button class="btn secondaire" id="supprimer">Supprimer</button>'}
        <span class="aide" id="message-client" style="align-self:center"></span>
      </div>
    </div>

    ${nouveau ? '' : historique(c)}`;
}

const historique = (c) => `
  <div class="carte" style="margin-top:16px;padding:0">
    <h2 style="padding:18px 18px 12px;margin:0">Historique — ${c.calls?.length ?? 0} call(s)</h2>
    ${
      c.calls?.length
        ? c.calls
            .map(
              (call) => `
                <a href="call-detail.html?id=${call.id}" class="liste-client" style="display:grid;grid-template-columns:1fr auto;gap:12px;text-decoration:none">
                  <div>
                    <div class="nom">
                      ${dateCourte(call.created_at)}
                      ${call.produit_vise ? ` · ${libelle('produit_vise', call.produit_vise)}` : ''}
                      ${call.resultat ? `<span class="puce ${call.resultat === 'signe' ? 'ok' : ''}" style="margin-left:6px">${libelle('resultat', call.resultat)}</span>` : ''}
                    </div>
                    <div class="meta">${echapper(call.action_prioritaire ?? 'Pas encore analysé')}</div>
                  </div>
                  <div style="text-align:right;font-weight:700;font-variant-numeric:tabular-nums">
                    ${call.score_global ?? '—'}
                  </div>
                </a>`,
            )
            .join('')
        : '<div class="vide">Aucun call rattaché à ce client pour l’instant.</div>'
    }
  </div>`;

/* --- Actions ------------------------------------------------------------------- */

function lireFormulaire() {
  const val = (id) => {
    const v = el(id)?.value?.trim();
    return v === '' ? null : v;
  };
  return {
    nom: val('nom'),
    type: val('type'),
    potentiel: val('potentiel'),
    telephone: val('telephone'),
    email: val('email'),
    localite: val('localite'),
    annee_naissance: val('annee_naissance'),
    situation_familiale: val('situation_familiale'),
    profession: val('profession'),
    produits_detenus: [...document.querySelectorAll('.produit:checked')].map((i) => i.value),
    echeance_prochaine: val('echeance_prochaine'),
    date_prochaine_action: val('date_prochaine_action'),
    prochaine_action: val('prochaine_action'),
    origine: val('origine'),
    notes: val('notes'),
  };
}

function brancherFormulaire(client) {
  const nouveau = !client?.id;

  el('sauver')?.addEventListener('click', async (e) => {
    const donnees = lireFormulaire();
    if (!donnees.nom) {
      el('message-client').textContent = 'Le nom est obligatoire.';
      return;
    }
    e.target.disabled = true;
    try {
      const enregistre = nouveau
        ? await api('/clients', { method: 'POST', body: donnees })
        : await api(`/clients/${client.id}`, { method: 'PATCH', body: donnees });
      await rafraichirListe();
      ouvrir(enregistre.id);
    } catch (err) {
      el('message-client').textContent = `Erreur : ${err.message}`;
      e.target.disabled = false;
    }
  });

  el('supprimer')?.addEventListener('click', async (e) => {
    if (!confirm(`Supprimer la fiche de ${client.nom} ? Ses calls seront conservés.`)) return;
    e.target.disabled = true;
    await api(`/clients/${client.id}`, { method: 'DELETE' });
    selection = null;
    await rafraichirListe();
    el('panneau').innerHTML = '<div class="carte"><div class="vide">Fiche supprimée.</div></div>';
  });
}

async function ouvrir(id) {
  selection = id;
  rendreListe();
  const client = await api(`/clients/${id}`);
  el('panneau').innerHTML = formulaire(client);
  brancherFormulaire(client);
}

function nouveauClient() {
  selection = 'nouveau';
  rendreListe();
  el('panneau').innerHTML = formulaire(null);
  brancherFormulaire(null);
  el('nom').focus();
}

/* --- Chargement ---------------------------------------------------------------- */

async function rafraichirListe(recherche = el('recherche').value.trim()) {
  const data = await api(`/clients${recherche ? `?recherche=${encodeURIComponent(recherche)}` : ''}`);
  clients = data.clients;
  el('sous-titre').textContent =
    `${data.total} fiche(s)` + (data.a_relancer ? ` · ${data.a_relancer} à relancer` : '');
  rendreListe();
}

let minuteurRecherche = null;
el('recherche').addEventListener('input', () => {
  clearTimeout(minuteurRecherche);
  minuteurRecherche = setTimeout(() => rafraichirListe(), 250);
});

el('nouveau').addEventListener('click', nouveauClient);

rafraichirListe()
  .then(() => {
    const id = new URLSearchParams(location.search).get('id');
    if (id) ouvrir(Number(id));
    else
      el('panneau').innerHTML =
        '<div class="carte"><div class="vide">Sélectionne un client à gauche, ou crée une fiche.</div></div>';
  })
  .catch((e) => {
    el('sous-titre').textContent = `Erreur : ${e.message}`;
  });
