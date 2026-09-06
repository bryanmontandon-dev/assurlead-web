/** Les 6 modules de l'app. Chacun rend son HTML puis branche ses événements. */
import * as D from './donnees.js';
import * as C from './contenus.js';

/* --- Utilitaires -------------------------------------------------------------- */

export const h = (t) => String(t ?? '').replace(/[<>&"]/g,
  (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

const el = (id) => document.getElementById(id);
const jour = () => new Date().toISOString().slice(0, 10);
const dansNJours = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const chf = (n) => new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 0 }).format(n || 0);
const dateFr = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: 'short' }) : '—');

const options = (liste, choisi) =>
  liste.map((v) => `<option value="${h(v)}" ${v === choisi ? 'selected' : ''}>${h(v)}</option>`).join('');

function copier(texte, bouton) {
  navigator.clipboard.writeText(texte).then(() => {
    const avant = bouton.textContent;
    bouton.textContent = '✓ Copié';
    setTimeout(() => (bouton.textContent = avant), 1600);
  }).catch(() => {
    bouton.textContent = 'Copie refusée';
  });
}

/** Onglets internes : affiche un panneau à la fois. */
function brancherOnglets(racine) {
  const boutons = racine.querySelectorAll('.onglets button');
  boutons.forEach((b) => b.addEventListener('click', () => {
    boutons.forEach((x) => x.classList.remove('actif'));
    b.classList.add('actif');
    racine.querySelectorAll('[data-panneau]').forEach((p) => {
      p.hidden = p.dataset.panneau !== b.dataset.onglet;
    });
  }));
}

/* =============================================================================
   MODULE 6 — DASHBOARD (affiché en premier)
   ========================================================================== */

function dashboard(hote) {
  const b = D.base;
  const debutMois = jour().slice(0, 7);
  const messages = b.activites.filter(
    (a) => ['email', 'linkedin'].includes(a.type) && a.cree_le.startsWith(debutMois)).length;
  const evenementsFaits = b.evenements.filter((e) => e.statut === 'Effectué').length;
  const clients = b.prospects.filter((p) => p.statut === 'Client').length;
  const objectif = Number(b.reglages.objectif_portefeuille) || 600;
  const portefeuille = (Number(b.reglages.portefeuille_actuel) || 0) + clients;
  const pct = Math.min(100, Math.round((portefeuille / objectif) * 100));
  const restant = Math.max(0, objectif - portefeuille);
  const moisRestants = Math.max(1, 12 - new Date().getMonth());

  const relances = b.prospects.filter(
    (p) => p.date_relance && p.date_relance <= jour() && p.statut !== 'Clos');

  const kpi = (etiquette, valeur, detail) => `
    <div class="kpi">
      <div class="etiquette">${etiquette}</div>
      <div class="valeur">${valeur}</div>
      <div class="detail">${detail}</div>
    </div>`;

  hote.innerHTML = `
    <h2>Performance &amp; objectifs</h2>

    <div class="grille k4" style="margin-bottom:16px">
      ${kpi('Prospects', b.prospects.length, `${clients} client(s) signé(s)`)}
      ${kpi('Messages ce mois', messages, 'e-mails + LinkedIn')}
      ${kpi('Événements faits', evenementsFaits, `${b.evenements.length} au total`)}
      ${kpi('Relances dues', relances.length, relances.length ? 'à traiter aujourd’hui' : 'rien en retard')}
    </div>

    <div class="carte">
      <div class="etiquette">Cap portefeuille</div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
        <span style="font-size:24px;font-weight:700">${portefeuille}</span>
        <span class="aide" style="margin:0">/ ${objectif} clients · ${pct} %</span>
      </div>
      <div class="piste"><div class="remplissage" style="width:${pct}%"></div></div>
      <p class="aide">
        ${restant === 0
          ? 'Objectif atteint 🎯'
          : `Il reste <strong>${restant}</strong> clients. Sur ${moisRestants} mois,
             cela fait <strong>${(restant / moisRestants).toFixed(1)}</strong> par mois.`}
      </p>
    </div>

    ${relances.length ? `
      <div class="carte carte-accent">
        <div class="etiquette">À relancer maintenant</div>
        ${relances.slice(0, 5).map((p) => `
          <div style="padding:8px 0;border-top:1px solid var(--bord)">
            <strong>${h(p.prenom)} ${h(p.nom)}</strong>
            <span class="puce ${classeInteret(p.interet)}" style="margin-left:6px">${h(p.interet)}</span>
            <div class="aide" style="margin:3px 0 0">${h(p.action_suivi || 'aucune action définie')} · ${h(p.date_relance)}</div>
          </div>`).join('')}
      </div>` : ''}

    <div class="carte">
      <div class="etiquette">Objectifs</div>
      <div class="grille k2">
        <div class="champ">
          <label for="obj-cible">Objectif de portefeuille</label>
          <input type="number" id="obj-cible" min="1" value="${objectif}" />
        </div>
        <div class="champ">
          <label for="obj-actuel">Clients déjà au portefeuille (hors app)</label>
          <input type="number" id="obj-actuel" min="0" value="${Number(b.reglages.portefeuille_actuel) || 0}" />
        </div>
      </div>
      <button class="btn primaire large" id="obj-enregistrer">Enregistrer</button>
      <p class="aide" id="obj-message"></p>
    </div>`;

  el('obj-enregistrer').addEventListener('click', () => {
    D.reglage('objectif_portefeuille', Number(el('obj-cible').value) || 600);
    D.reglage('portefeuille_actuel', Number(el('obj-actuel').value) || 0);
    el('obj-message').innerHTML = '<span class="reussite">Enregistré.</span>';
    setTimeout(() => dashboard(hote), 800);
  });
}

const classeInteret = (i = '') =>
  i.startsWith('Chaud') ? 'puce-chaud' : i.startsWith('Tiède') ? 'puce-tiede' : 'puce-froid';

/* =============================================================================
   MODULE 1 — GÉNÉRATEUR D'APPROCHE DIGITALE
   ========================================================================== */

function approche(hote) {
  const signature = D.base.reglages.signature || 'Bryan';

  hote.innerHTML = `
    <h2>Générateur d’approche digitale</h2>
    <p class="aide" style="margin-bottom:16px">
      Les messages se construisent autour de la réalité du profil visé, pas d’un modèle générique.
      Le ton n’est jamais forceur : on propose, on n’insiste pas.
    </p>

    <div class="carte">
      <div class="grille k2">
        <div class="champ">
          <label for="a-profil">Profil cible</label>
          <select id="a-profil">${options(Object.keys(C.PROFILS))}</select>
        </div>
        <div class="champ">
          <label for="a-canton">Canton / zone</label>
          <select id="a-canton">${options(C.CANTONS)}</select>
        </div>
        <div class="champ">
          <label for="a-angle">Angle stratégique</label>
          <select id="a-angle">${options(Object.keys(C.ANGLES))}</select>
        </div>
        <div class="champ">
          <label for="a-ton">Ton de communication</label>
          <select id="a-ton">${options(Object.keys(C.TONS))}</select>
        </div>
        <div class="champ">
          <label for="a-prenom">Prénom du destinataire</label>
          <input type="text" id="a-prenom" placeholder="optionnel" />
        </div>
        <div class="champ">
          <label for="a-signature">Ta signature</label>
          <input type="text" id="a-signature" value="${h(signature)}" />
        </div>
      </div>
    </div>

    <div class="onglets">
      <button data-onglet="mail" class="actif">📧 E-mail</button>
      <button data-onglet="li">💼 LinkedIn — 3 étapes</button>
    </div>

    <div data-panneau="mail" id="panneau-mail"></div>
    <div data-panneau="li" id="panneau-li" hidden></div>`;

  brancherOnglets(hote);

  const champs = () => ({
    profil: el('a-profil').value,
    canton: el('a-canton').value,
    angle: el('a-angle').value,
    ton: el('a-ton').value,
    prenom: el('a-prenom').value,
    signature: el('a-signature').value || 'Bryan',
  });

  function regenerer() {
    const p = champs();
    D.reglage('signature', p.signature);
    const mail = C.genererEmail(p);

    el('panneau-mail').innerHTML = `
      <div class="carte">
        <div class="etiquette">Objets — teste-les, garde celui qui ouvre</div>
        ${mail.objets.map((o, i) => `
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
            <div class="bloc-copie" style="flex:1">${h(o)}</div>
            <button class="btn-mini" data-copier-objet="${i}">Copier</button>
          </div>`).join('')}
      </div>

      <div class="carte">
        <div class="etiquette">Corps du message</div>
        <textarea id="mail-corps" style="min-height:300px">${h(mail.corps)}</textarea>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          <button class="btn primaire" style="flex:1;min-width:160px" id="mail-copier">Copier le message</button>
          <button class="btn" style="flex:1;min-width:160px" id="mail-envoye">✓ Marquer comme envoyé</button>
        </div>
        <p class="aide" id="mail-message"></p>
      </div>`;

    el('panneau-mail').querySelectorAll('[data-copier-objet]').forEach((b) =>
      b.addEventListener('click', () => copier(mail.objets[Number(b.dataset.copierObjet)], b)));
    el('mail-copier').addEventListener('click', (e) => copier(el('mail-corps').value, e.target));
    el('mail-envoye').addEventListener('click', () => {
      D.journaliser('email', `${p.angle} · ${p.canton} · ${p.profil}`);
      el('mail-message').innerHTML = '<span class="reussite">Compté dans tes KPI du mois.</span>';
    });

    const sequence = C.genererLinkedin(p);
    el('panneau-li').innerHTML = `
      <p class="aide" style="margin:0 0 14px">
        Trois temps espacés. Si le message 3 reste sans réponse, on n’insiste pas :
        on garde le contact au chaud pour plus tard.
      </p>
      ${sequence.map((m, i) => `
        <div class="carte">
          <div class="etiquette">${h(m.titre)}</div>
          <p class="aide" style="margin:0 0 10px">${h(m.quand)}</p>
          <div class="bloc-copie">${h(m.texte)}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap">
            <span class="aide" style="margin:0">
              ${m.texte.length} caractères${m.limite && m.texte.length > m.limite
                ? ` <span class="erreur">— dépasse la limite de ${m.limite}</span>` : ''}
            </span>
            <button class="btn-mini" data-copier-li="${i}">Copier</button>
          </div>
        </div>`).join('')}
      <button class="btn primaire large" id="li-envoye">✓ Séquence lancée</button>
      <p class="aide" id="li-message"></p>`;

    el('panneau-li').querySelectorAll('[data-copier-li]').forEach((b) =>
      b.addEventListener('click', () => copier(sequence[Number(b.dataset.copierLi)].texte, b)));
    el('li-envoye').addEventListener('click', () => {
      D.journaliser('linkedin', `${p.angle} · ${p.canton} · ${p.profil}`);
      el('li-message').innerHTML = '<span class="reussite">Comptée dans tes KPI du mois.</span>';
    });
  }

  ['a-profil', 'a-canton', 'a-angle', 'a-ton', 'a-prenom', 'a-signature']
    .forEach((id) => el(id).addEventListener('input', regenerer));
  regenerer();
}

/* =============================================================================
   MODULE 2 — ANNUAIRE & AGENDA D'ÉVÉNEMENTS
   ========================================================================== */

function amorcerEvenements() {
  if (D.base.evenements.length > 0) return;
  for (const [nom, orga, lieu, canton, type, public_cible, cout, url] of C.EVENEMENTS_AMORCE) {
    D.base.evenements.push({
      id: Math.random().toString(36).slice(2, 9),
      cree_le: new Date().toISOString(),
      nom, organisateur: orga, date_event: '', heure: '', lieu, canton,
      type_event: type, public_cible, cout, prix: '', statut: 'À venir', url,
      notes: 'Repère pré-chargé : vérifie la prochaine date sur le site de l’organisateur.',
    });
  }
  D.sauver();
}

function evenements(hote) {
  amorcerEvenements();

  hote.innerHTML = `
    <h2>Annuaire &amp; agenda réseau</h2>
    <div class="onglets">
      <button data-onglet="liste" class="actif">📋 Agenda</button>
      <button data-onglet="ajout">➕ Ajouter</button>
    </div>

    <div data-panneau="liste">
      <div class="carte">
        <div class="grille k2">
          <div class="champ">
            <label for="f-canton">Canton</label>
            <select id="f-canton"><option value="">Tous</option>${options(C.CANTONS)}</select>
          </div>
          <div class="champ">
            <label for="f-type">Type</label>
            <select id="f-type"><option value="">Tous</option>${options(C.TYPES_EVENT)}</select>
          </div>
          <div class="champ">
            <label for="f-cout">Coût</label>
            <select id="f-cout"><option value="">Tous</option>${options(['Gratuit', 'Payant'])}</select>
          </div>
          <div class="champ">
            <label for="f-statut">Statut</label>
            <select id="f-statut"><option value="">Tous</option>${options(C.STATUTS_EVENT)}</select>
          </div>
        </div>
      </div>
      <div id="liste-events"></div>
    </div>

    <div data-panneau="ajout" hidden>
      <div class="carte">
        <div class="champ"><label for="e-nom">Nom de l’événement *</label><input type="text" id="e-nom" /></div>
        <div class="champ"><label for="e-orga">Organisateur</label>
          <input type="text" id="e-orga" placeholder="CVCI, FER Vaud, BNI, club local…" /></div>
        <div class="grille k2">
          <div class="champ"><label for="e-date">Date</label><input type="date" id="e-date" value="${jour()}" /></div>
          <div class="champ"><label for="e-heure">Heure</label><input type="text" id="e-heure" placeholder="18:30" /></div>
          <div class="champ"><label for="e-lieu">Lieu / ville</label><input type="text" id="e-lieu" /></div>
          <div class="champ"><label for="e-canton">Canton</label><select id="e-canton">${options(C.CANTONS)}</select></div>
          <div class="champ"><label for="e-type">Type</label><select id="e-type">${options(C.TYPES_EVENT)}</select></div>
          <div class="champ"><label for="e-cout">Coût</label><select id="e-cout">${options(['Gratuit', 'Payant'])}</select></div>
          <div class="champ"><label for="e-prix">Prix</label><input type="text" id="e-prix" placeholder="CHF 40.–" /></div>
          <div class="champ"><label for="e-statut">Statut</label><select id="e-statut">${options(C.STATUTS_EVENT)}</select></div>
        </div>
        <div class="champ"><label for="e-public">Public attendu</label>
          <input type="text" id="e-public" placeholder="Dirigeants de PME, jeunes actifs…" /></div>
        <div class="champ"><label for="e-url">Lien</label><input type="text" id="e-url" placeholder="https://" /></div>
        <div class="champ"><label for="e-notes">Notes</label>
          <textarea id="e-notes" placeholder="Qui je veux y croiser, ce que je prépare…"></textarea></div>
        <button class="btn primaire large" id="e-ajouter">Ajouter à l’agenda</button>
        <p class="aide" id="e-message"></p>
      </div>
    </div>`;

  brancherOnglets(hote);

  function rendreListe() {
    const fc = el('f-canton').value, ft = el('f-type').value;
    const fo = el('f-cout').value, fs = el('f-statut').value;

    const liste = D.base.evenements
      .filter((e) => (!fc || e.canton === fc) && (!ft || e.type_event === ft)
        && (!fo || e.cout === fo) && (!fs || e.statut === fs))
      .sort((a, b) => (a.date_event || '9999') .localeCompare(b.date_event || '9999'));

    el('liste-events').innerHTML = liste.length === 0
      ? '<div class="carte"><div class="vide">Aucun événement pour ces filtres.</div></div>'
      : liste.map((e) => `
        <div class="carte ${e.statut === 'Inscrit' ? 'carte-accent' : ''}">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <strong>${h(e.nom)}</strong>
            <span class="puce ${e.statut === 'Inscrit' ? 'puce-ok' : ''}">${h(e.statut)}</span>
          </div>
          <p class="aide">
            ${h(e.organisateur)}<br>
            📍 ${h(e.lieu)} (${h(e.canton)}) · 🗓️ ${h(`${e.date_event} ${e.heure}`.trim() || 'date à compléter')}<br>
            🏷️ ${h(e.type_event)} · 💰 ${h(e.cout)} ${h(e.prix)}<br>
            👥 ${h(e.public_cible)}
          </p>
          <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:10px">
            ${e.url ? `<a class="btn-mini" href="${h(e.url)}" target="_blank" rel="noopener">🔗 Site</a>` : ''}
            <button class="btn-mini" data-statut="Inscrit" data-id="${e.id}">✅ Inscrit</button>
            <button class="btn-mini" data-statut="Effectué" data-id="${e.id}">🏁 Effectué</button>
            <button class="btn-mini danger" data-suppr="${e.id}">🗑️</button>
          </div>
        </div>`).join('');

    el('liste-events').querySelectorAll('[data-statut]').forEach((b) =>
      b.addEventListener('click', () => {
        D.modifier('evenements', b.dataset.id, { statut: b.dataset.statut });
        if (b.dataset.statut === 'Effectué') D.journaliser('evenement', b.dataset.id);
        rendreListe();
      }));
    el('liste-events').querySelectorAll('[data-suppr]').forEach((b) =>
      b.addEventListener('click', () => { D.supprimer('evenements', b.dataset.suppr); rendreListe(); }));
  }

  ['f-canton', 'f-type', 'f-cout', 'f-statut'].forEach((id) =>
    el(id).addEventListener('change', rendreListe));

  el('e-ajouter').addEventListener('click', () => {
    const nom = el('e-nom').value.trim();
    if (!nom) { el('e-message').innerHTML = '<span class="erreur">Le nom est obligatoire.</span>'; return; }
    D.ajouter('evenements', {
      nom, organisateur: el('e-orga').value.trim(), date_event: el('e-date').value,
      heure: el('e-heure').value.trim(), lieu: el('e-lieu').value.trim(),
      canton: el('e-canton').value, type_event: el('e-type').value,
      public_cible: el('e-public').value.trim(), cout: el('e-cout').value,
      prix: el('e-prix').value.trim(), statut: el('e-statut').value,
      url: el('e-url').value.trim(), notes: el('e-notes').value.trim(),
    });
    el('e-message').innerHTML = `<span class="reussite">« ${h(nom)} » ajouté.</span>`;
    ['e-nom', 'e-orga', 'e-heure', 'e-lieu', 'e-public', 'e-url', 'e-notes', 'e-prix']
      .forEach((id) => (el(id).value = ''));
    rendreListe();
  });

  rendreListe();
}

/* =============================================================================
   MODULE 3 — PLAYBOOK TERRAIN
   ========================================================================== */

function playbook(hote) {
  hote.innerHTML = `
    <h2>Playbook terrain</h2>
    <p class="aide" style="margin-bottom:16px">
      À relire dans la voiture avant d’entrer. L’objectif d’un événement n’est pas
      de vendre : c’est d’obtenir le droit de recontacter.
    </p>

    <div class="onglets">
      <button data-onglet="glace" class="actif">1 · Briser la glace</button>
      <button data-onglet="pitch">2 · Le pitch</button>
      <button data-onglet="objections">3 · Objections</button>
      <button data-onglet="closing">4 · Closing réseau</button>
    </div>

    <div data-panneau="glace">
      <p class="aide" style="margin:0 0 14px">
        Une accroche réussie porte sur le lieu, le moment ou l’organisateur — jamais sur soi.
        On parle métier seulement quand l’autre le demande.
      </p>
      ${C.ICEBREAKERS.map(([lieu, phrase, pourquoi]) => `
        <div class="carte">
          <div class="etiquette">${h(lieu)}</div>
          <p style="font-size:15.5px;margin:0 0 8px">${h(phrase)}</p>
          <p class="aide" style="margin:0">↳ ${h(pourquoi)}</p>
        </div>`).join('')}
    </div>

    <div data-panneau="pitch" hidden>
      <div class="carte carte-accent">
        <div class="etiquette">Version courte — 12 secondes</div>
        <p style="font-size:15.5px;line-height:1.65;margin:0">
          « Je suis courtier en assurance indépendant. Concrètement, je fais le tri dans
          les contrats des gens — je regarde ce qui est utile, ce qui fait doublon,
          et ce qui manque vraiment. »
        </p>
      </div>
      <div class="carte">
        <div class="etiquette">Version longue — si on te relance</div>
        <p style="line-height:1.7;margin:0">
          « Je travaille comme un courtier local : je connais mes clients, je suis joignable,
          je me déplace. Mais je m’appuie sur des outils digitaux et de l’IA pour comparer
          beaucoup plus vite qu’avant — là où il fallait deux semaines pour un comparatif
          sérieux, j’y arrive en deux jours. Résultat : la proximité d’un courtier de
          village avec la puissance d’analyse d’une grosse structure. »
        </p>
      </div>
      <div class="carte">
        <div class="etiquette">Trois règles</div>
        <p class="aide" style="line-height:1.8;margin:0">
          <strong style="color:var(--texte)">1.</strong> Tu réponds, puis tu
          <strong style="color:var(--texte)">rends la parole</strong> : « et vous, qu’est-ce qui vous amène ici ? »<br>
          <strong style="color:var(--texte)">2.</strong> Tu ne cites
          <strong style="color:var(--texte)">aucun produit</strong>. Ni 3e pilier, ni LAMal, ni RC.
          Le produit tue la conversation.<br>
          <strong style="color:var(--texte)">3.</strong> Si l’autre enchaîne sur sa situation,
          tu <strong style="color:var(--texte)">écoutes sans vendre</strong>. C’est déjà gagné.
        </p>
      </div>
    </div>

    <div data-panneau="objections" hidden>
      ${C.OBJECTIONS.map(([question, reponse, pourquoi]) => `
        <div class="carte">
          <div class="etiquette">Objection</div>
          <p style="font-weight:600;margin:0 0 10px">${h(question)}</p>
          <p style="line-height:1.65;margin:0 0 10px">${h(reponse)}</p>
          <p class="aide" style="margin:0">↳ ${h(pourquoi)}</p>
        </div>`).join('')}
    </div>

    <div data-panneau="closing" hidden>
      <div class="carte carte-accent">
        <div class="etiquette">La formule</div>
        <p style="font-size:15.5px;line-height:1.7;margin:0">
          « Écoutez, je ne vais pas vous embêter avec ça ce soir. Mais j’ai une checklist
          d’optimisation que j’envoie aux gens que je rencontre — une page, les points à
          vérifier sur ses propres contrats. Je vous l’envoie ? »
        </p>
        <p class="aide" style="margin:10px 0 0">
          Tu ne demandes pas un rendez-vous : tu demandes l’autorisation d’envoyer quelque
          chose d’utile. Un « oui » est facile à donner — et il te donne coordonnées
          <strong style="color:var(--texte)">et</strong> accord de recontact.
        </p>
      </div>
      <div class="carte">
        <div class="etiquette">Enchaînement immédiat</div>
        <p style="line-height:1.7;margin:0">
          « Parfait. Le plus simple : on se connecte sur LinkedIn maintenant, comme ça
          on ne se perd pas. »<br><br>
          <em class="aide" style="display:inline">Tu sors ton téléphone et tu te connectes devant lui.
          Le contact est acquis sur-le-champ, sans carte de visite qui finira à la poubelle.</em>
        </p>
      </div>
      <div class="carte">
        <div class="etiquette">Dans les 5 minutes qui suivent</div>
        <p class="aide" style="line-height:1.7;margin:0 0 12px">
          Note-le pendant que c’est frais : le sujet évoqué, son niveau d’intérêt,
          la date de relance. Le lendemain tu auras oublié la moitié — et c’est
          cette moitié qui fait la différence au recontact.
        </p>
        <button class="btn primaire large" id="vers-crm">➡️ Ouvrir le CRM express</button>
      </div>
    </div>`;

  brancherOnglets(hote);
  el('vers-crm').addEventListener('click', () =>
    document.querySelector('nav button[data-vue="crm"]').click());
}

/* =============================================================================
   MODULE 4 — CRM MOBILE EXPRESS
   ========================================================================== */

function crm(hote) {
  hote.innerHTML = `
    <h2>CRM express</h2>
    <div class="onglets">
      <button data-onglet="capture" class="actif">⚡ Capture rapide</button>
      <button data-onglet="suivi">📊 Suivi &amp; export</button>
    </div>

    <div data-panneau="capture">
      <p class="aide" style="margin:0 0 14px">
        À remplir dans les 5 minutes qui suivent la rencontre.
        Seul le nom est obligatoire — le reste se complète plus tard.
      </p>
      <div class="carte">
        <div class="grille k2">
          <div class="champ"><label for="p-nom">Nom *</label><input type="text" id="p-nom" /></div>
          <div class="champ"><label for="p-prenom">Prénom</label><input type="text" id="p-prenom" /></div>
          <div class="champ"><label for="p-entreprise">Entreprise</label><input type="text" id="p-entreprise" /></div>
          <div class="champ"><label for="p-profession">Profession</label><input type="text" id="p-profession" /></div>
          <div class="champ"><label for="p-canal">Moyen de contact</label><select id="p-canal">${options(C.CANAUX)}</select></div>
          <div class="champ"><label for="p-contact">Coordonnée</label>
            <input type="text" id="p-contact" placeholder="079 … / linkedin.com/in/… / @…" /></div>
          <div class="champ"><label for="p-evenement">Événement d’origine</label><select id="p-evenement"></select></div>
          <div class="champ"><label for="p-canton">Canton</label><select id="p-canton">${options(C.CANTONS)}</select></div>
        </div>
        <div class="champ">
          <label>Niveau d’intérêt</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap" id="p-interet">
            ${C.INTERETS.map((i, n) => `
              <button type="button" class="btn ${n === 0 ? 'primaire' : ''}"
                      data-interet="${h(i)}" style="flex:1;min-width:110px">${h(i)}</button>`).join('')}
          </div>
        </div>
        <div class="champ"><label for="p-sujet">Sujet clé évoqué</label><select id="p-sujet">${options(C.SUJETS)}</select></div>
        <div class="grille k2">
          <div class="champ"><label for="p-action">Action de suivi</label>
            <input type="text" id="p-action" placeholder="Envoyer la checklist d’optimisation" /></div>
          <div class="champ"><label for="p-relance">Date de relance</label>
            <input type="date" id="p-relance" value="${dansNJours(3)}" /></div>
        </div>
        <div class="champ"><label for="p-notes">Notes</label>
          <textarea id="p-notes" placeholder="Ce qu’il a dit, ce qui compte pour lui…"></textarea></div>
        <button class="btn primaire large" id="p-enregistrer">💾 Enregistrer le prospect</button>
        <p class="aide" id="p-message"></p>
      </div>
    </div>

    <div data-panneau="suivi" hidden>
      <div class="carte">
        <div class="champ">
          <input type="search" id="p-recherche" placeholder="🔍 Rechercher un nom, une entreprise, un sujet…" />
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" style="flex:1;min-width:150px" id="p-export-csv">⬇️ Export CSV</button>
          <button class="btn" style="flex:1;min-width:150px" id="p-export-json">⬇️ Sauvegarde complète</button>
        </div>
      </div>
      <div id="liste-prospects"></div>
    </div>`;

  brancherOnglets(hote);

  el('p-evenement').innerHTML =
    `<option value="">—</option>` +
    D.base.evenements.map((e) => `<option>${h(e.nom)}</option>`).join('') +
    `<option>Hors événement</option>`;

  let interet = C.INTERETS[0];
  el('p-interet').querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => {
      el('p-interet').querySelectorAll('button').forEach((x) => x.classList.remove('primaire'));
      b.classList.add('primaire');
      interet = b.dataset.interet;
    }));

  el('p-enregistrer').addEventListener('click', () => {
    const nom = el('p-nom').value.trim();
    if (!nom) { el('p-message').innerHTML = '<span class="erreur">Le nom est obligatoire.</span>'; return; }

    D.ajouter('prospects', {
      nom, prenom: el('p-prenom').value.trim(), entreprise: el('p-entreprise').value.trim(),
      profession: el('p-profession').value.trim(), canal: el('p-canal').value,
      contact: el('p-contact').value.trim(), evenement: el('p-evenement').value,
      canton: el('p-canton').value, interet, sujet: el('p-sujet').value,
      action_suivi: el('p-action').value.trim(), date_relance: el('p-relance').value,
      statut: 'Nouveau', notes: el('p-notes').value.trim(), source: 'CRM express',
    });

    el('p-message').innerHTML = `<span class="reussite">${h(el('p-prenom').value)} ${h(nom)}
      enregistré. Relance le ${h(el('p-relance').value)}.</span>`;
    ['p-nom', 'p-prenom', 'p-entreprise', 'p-profession', 'p-contact', 'p-action', 'p-notes']
      .forEach((id) => (el(id).value = ''));
    el('p-relance').value = dansNJours(3);
    rendreProspects();
  });

  function rendreProspects() {
    const q = (el('p-recherche').value || '').toLowerCase().trim();
    const liste = D.base.prospects.filter((p) => !q ||
      [p.nom, p.prenom, p.entreprise, p.sujet, p.notes, p.evenement]
        .join(' ').toLowerCase().includes(q));

    el('liste-prospects').innerHTML = liste.length === 0
      ? '<div class="carte"><div class="vide">Aucun prospect. Capture le premier après ton prochain événement.</div></div>'
      : liste.map((p) => {
        const retard = p.date_relance && p.date_relance <= jour() && p.statut !== 'Clos';
        return `
        <div class="carte ${retard ? 'carte-accent' : ''}">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <strong>${h(p.prenom)} ${h(p.nom)}</strong>
            <span class="puce ${classeInteret(p.interet)}">${h(p.interet)}</span>
          </div>
          <p class="aide">
            ${h(p.entreprise || '—')}${p.profession ? ` · ${h(p.profession)}` : ''}<br>
            💬 ${h(p.sujet)} · 📍 ${h(p.canton)}<br>
            📞 ${h(p.canal)} : ${h(p.contact || 'à compléter')}<br>
            ${p.evenement ? `🎪 ${h(p.evenement)}<br>` : ''}
            ➡️ ${h(p.action_suivi || 'aucune action définie')} ·
            ${retard ? '⏰' : '🗓️'} ${h(p.date_relance || '—')}
          </p>
          ${p.notes ? `<p class="aide" style="font-style:italic">${h(p.notes)}</p>` : ''}
          <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:10px;align-items:center">
            <select data-statut-prospect="${p.id}" style="width:auto;flex:1;min-width:130px;padding:7px 10px;font-size:13.5px">
              ${options(C.STATUTS_PROSPECT, p.statut)}
            </select>
            <button class="btn-mini" data-reporter="${p.id}">📅 +7 j</button>
            <button class="btn-mini danger" data-suppr-prospect="${p.id}">🗑️</button>
          </div>
        </div>`;
      }).join('');

    el('liste-prospects').querySelectorAll('[data-statut-prospect]').forEach((s) =>
      s.addEventListener('change', () => {
        D.modifier('prospects', s.dataset.statutProspect, { statut: s.value });
        rendreProspects();
      }));
    el('liste-prospects').querySelectorAll('[data-reporter]').forEach((b) =>
      b.addEventListener('click', () => {
        const p = D.base.prospects.find((x) => x.id === b.dataset.reporter);
        const base = p.date_relance ? new Date(p.date_relance) : new Date();
        base.setDate(base.getDate() + 7);
        D.modifier('prospects', p.id, { date_relance: base.toISOString().slice(0, 10) });
        rendreProspects();
      }));
    el('liste-prospects').querySelectorAll('[data-suppr-prospect]').forEach((b) =>
      b.addEventListener('click', () => {
        D.supprimer('prospects', b.dataset.supprProspect);
        rendreProspects();
      }));
  }

  el('p-recherche').addEventListener('input', rendreProspects);
  el('p-export-csv').addEventListener('click', () => {
    const ok = D.exporterCsv('prospects', [
      { cle: 'cree_le', titre: 'Créé le' }, { cle: 'nom', titre: 'Nom' },
      { cle: 'prenom', titre: 'Prénom' }, { cle: 'entreprise', titre: 'Entreprise' },
      { cle: 'profession', titre: 'Profession' }, { cle: 'canal', titre: 'Canal' },
      { cle: 'contact', titre: 'Contact' }, { cle: 'evenement', titre: 'Événement' },
      { cle: 'canton', titre: 'Canton' }, { cle: 'interet', titre: 'Intérêt' },
      { cle: 'sujet', titre: 'Sujet' }, { cle: 'action_suivi', titre: 'Action' },
      { cle: 'date_relance', titre: 'Relance' }, { cle: 'statut', titre: 'Statut' },
      { cle: 'notes', titre: 'Notes' },
    ]);
    if (!ok) alert('Aucun prospect à exporter.');
  });
  el('p-export-json').addEventListener('click', D.exporterTout);

  rendreProspects();
}

/* =============================================================================
   MODULE 5 — IMPORT & BASE DE CONNAISSANCES
   ========================================================================== */

const COLONNES_CIBLE = ['nom', 'prenom', 'entreprise', 'profession', 'contact', 'canton', 'statut', 'sujet'];

const INDICES = {
  nom: ['nom', 'name', 'lastname', 'last name', 'nom de famille'],
  prenom: ['prenom', 'firstname', 'first name'],
  entreprise: ['entreprise', 'societe', 'company', 'raison sociale', 'employeur'],
  profession: ['profession', 'poste', 'fonction', 'metier', 'job title'],
  contact: ['email', 'e mail', 'mail', 'telephone', 'tel', 'phone', 'portable', 'contact'],
  canton: ['canton', 'ct', 'region', 'district'],
  statut: ['statut', 'status', 'etat'],
  sujet: ['sujet', 'besoin', 'produit', 'interet'],
};

const sansAccent = (t) => String(t ?? '').toLowerCase().trim()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Devine la colonne source. Score décroissant : égalité exacte, forme compacte
 * (« Last Name » = « lastname »), début de mot, puis simple inclusion.
 * Évite deux pièges : « Prénom » contient « nom », « Fonction » contient « ct ».
 */
function devinerColonne(colonnes, cible) {
  let meilleur = '', score = 0;
  for (const colonne of colonnes) {
    const e = sansAccent(colonne);
    INDICES[cible].forEach((indice, rang) => {
      const m = sansAccent(indice);
      let s = 0;
      if (e === m) s = 100 - rang;
      else if (e.replace(/ /g, '') === m.replace(/ /g, '')) s = 90 - rang;
      else if (e.startsWith(m) || m.startsWith(e)) s = 60 - rang;
      else if (e.includes(m)) s = 30 - rang;
      if (s > score) { meilleur = colonne; score = s; }
    });
  }
  return meilleur;
}

/** Lecture CSV tolérante : détecte le séparateur, gère les guillemets. */
function lireCsv(texte) {
  const premiere = texte.split('\n')[0] ?? '';
  const sep = [';', ',', '\t']
    .map((s) => [s, (premiere.match(new RegExp(`\\${s}`, 'g')) || []).length])
    .sort((a, b) => b[1] - a[1])[0][0];

  const lignes = [];
  let champ = '', ligne = [], guillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guillemets) {
      if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++; }
      else if (c === '"') guillemets = false;
      else champ += c;
    } else if (c === '"') guillemets = true;
    else if (c === sep) { ligne.push(champ); champ = ''; }
    else if (c === '\n') { ligne.push(champ.replace(/\r$/, '')); lignes.push(ligne); ligne = []; champ = ''; }
    else champ += c;
  }
  if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne); }

  const entetes = (lignes.shift() ?? []).map((e) => e.trim().replace(/^﻿/, ''));
  return {
    entetes,
    lignes: lignes.filter((l) => l.some((v) => v.trim()))
      .map((l) => Object.fromEntries(entetes.map((e, i) => [e, (l[i] ?? '').trim()]))),
  };
}

function importer(hote) {
  hote.innerHTML = `
    <h2>Import &amp; base de connaissances</h2>
    <div class="onglets">
      <button data-onglet="contacts" class="actif">👥 Contacts CSV</button>
      <button data-onglet="docs">📄 Notes</button>
      <button data-onglet="base">🗄️ Ma base</button>
    </div>

    <div data-panneau="contacts">
      <div class="carte">
        <p class="aide" style="margin:0 0 12px">
          Fichier CSV exporté de ton CRM, d’Excel ou de ton téléphone.
          Le séparateur et les accents sont détectés automatiquement.
        </p>
        <input type="file" id="i-fichier" accept=".csv,.txt" />
      </div>
      <div id="i-apercu"></div>
    </div>

    <div data-panneau="docs" hidden>
      <div class="carte">
        <p class="aide" style="margin:0 0 12px">
          Notes de réunion, fiches produits, modèles. Le texte est conservé dans
          ta base locale pour rester consultable ici.
        </p>
        <input type="file" id="i-doc" accept=".txt,.md,.csv" multiple />
        <p class="aide">Formats texte uniquement — un PDF ne peut pas être lu sans serveur.</p>
      </div>
      <div id="i-docs"></div>
    </div>

    <div data-panneau="base" hidden>
      <div class="grille k4" style="margin-bottom:14px">
        <div class="kpi"><div class="etiquette">Prospects</div><div class="valeur">${D.base.prospects.length}</div></div>
        <div class="kpi"><div class="etiquette">Événements</div><div class="valeur">${D.base.evenements.length}</div></div>
        <div class="kpi"><div class="etiquette">Documents</div><div class="valeur">${D.base.documents.length}</div></div>
        <div class="kpi"><div class="etiquette">Poids</div><div class="valeur">${Math.round(D.poids() / 1024)}<span style="font-size:14px"> Ko</span></div></div>
      </div>

      <div class="carte">
        <div class="etiquette">Le fichier unique</div>
        <p class="aide" style="margin:0 0 12px">
          Toute ta base tient dans un seul fichier JSON. Pose-le sur iCloud :
          tu le réimportes sur n’importe quel appareil et tu retrouves tout.
        </p>
        <button class="btn primaire large" id="b-exporter">⬇️ Exporter ma base</button>
        <div style="margin-top:12px">
          <label for="b-importer">Réimporter un fichier</label>
          <input type="file" id="b-importer" accept=".json" />
          <label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-weight:500">
            <input type="checkbox" id="b-fusion" checked style="width:auto" />
            Fusionner avec l’existant (décoche pour tout remplacer)
          </label>
        </div>
        <p class="aide" id="b-message"></p>
      </div>

      <div class="carte">
        <div class="etiquette">Entretien</div>
        <button class="btn large" id="b-dedoublonner" style="margin-bottom:8px">🧹 Supprimer les doublons</button>
        <button class="btn large" id="b-reset" style="border-color:#4a2a22;color:var(--chaud)">⚠️ Réinitialiser la base</button>
        <p class="aide" id="b-message2"></p>
      </div>
    </div>`;

  brancherOnglets(hote);

  /* Contacts CSV */
  el('i-fichier').addEventListener('change', async (e) => {
    const fichier = e.target.files[0];
    if (!fichier) return;

    let donnees;
    try {
      donnees = lireCsv(await fichier.text());
    } catch (err) {
      el('i-apercu').innerHTML = `<div class="carte"><span class="erreur">Lecture impossible : ${h(err.message)}</span></div>`;
      return;
    }
    if (donnees.lignes.length === 0) {
      el('i-apercu').innerHTML = '<div class="carte"><span class="erreur">Aucune ligne exploitable.</span></div>';
      return;
    }

    const choix = ['— ignorer —', ...donnees.entetes];
    el('i-apercu').innerHTML = `
      <div class="carte">
        <span class="reussite">${donnees.lignes.length} ligne(s), ${donnees.entetes.length} colonne(s).</span>
        <div class="etiquette" style="margin-top:14px">Correspondance des colonnes</div>
        <p class="aide" style="margin:0 0 12px">Pré-remplie automatiquement — corrige si besoin.</p>
        <div class="grille k2">
          ${COLONNES_CIBLE.map((cible) => {
            const devine = devinerColonne(donnees.entetes, cible) || '— ignorer —';
            return `<div class="champ">
              <label for="map-${cible}">${cible.charAt(0).toUpperCase() + cible.slice(1)}</label>
              <select id="map-${cible}">${options(choix, devine)}</select>
            </div>`;
          }).join('')}
        </div>
        <label style="display:flex;gap:8px;align-items:center;margin-bottom:12px;font-weight:500">
          <input type="checkbox" id="i-doublons" checked style="width:auto" />
          Ignorer les doublons (même nom + même contact)
        </label>
        <button class="btn primaire large" id="i-lancer">📤 Importer dans le CRM</button>
        <p class="aide" id="i-message"></p>
      </div>`;

    el('i-lancer').addEventListener('click', () => {
      const mapping = Object.fromEntries(COLONNES_CIBLE.map((c) => [c, el(`map-${c}`).value]));
      if (mapping.nom === '— ignorer —') {
        el('i-message').innerHTML = '<span class="erreur">La colonne « nom » est indispensable.</span>';
        return;
      }

      const connus = new Set(D.base.prospects.map(
        (p) => `${(p.nom ?? '').toLowerCase()}|${(p.contact ?? '').toLowerCase()}`));
      let ajoutes = 0, ignores = 0;

      for (const ligne of donnees.lignes) {
        const val = (champ) => mapping[champ] === '— ignorer —' ? '' : (ligne[mapping[champ]] ?? '');
        const nom = val('nom').trim();
        if (!nom) continue;

        const cle = `${nom.toLowerCase()}|${val('contact').toLowerCase()}`;
        if (el('i-doublons').checked && connus.has(cle)) { ignores++; continue; }
        connus.add(cle);

        const canton = val('canton');
        D.base.prospects.push({
          id: Math.random().toString(36).slice(2, 9),
          cree_le: new Date().toISOString(),
          nom, prenom: val('prenom'), entreprise: val('entreprise'),
          profession: val('profession'), canal: 'E-mail', contact: val('contact'),
          evenement: '', canton: C.CANTONS.includes(canton) ? canton : 'Toute la Suisse romande',
          interet: 'À nourrir ☕', sujet: val('sujet') || 'Autre', action_suivi: '',
          date_relance: dansNJours(14), statut: val('statut') || 'Nouveau',
          notes: '', source: `Import ${fichier.name}`,
        });
        ajoutes++;
      }
      D.sauver();
      el('i-message').innerHTML = `<span class="reussite">${ajoutes} contact(s) importé(s), ${ignores} doublon(s) ignoré(s).</span>`;
    });
  });

  /* Notes */
  function rendreDocs() {
    el('i-docs').innerHTML = D.base.documents.length === 0
      ? '<div class="carte"><div class="vide">Aucune note enregistrée.</div></div>'
      : D.base.documents.map((d) => `
        <div class="carte">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <strong>📄 ${h(d.nom)}</strong>
            <button class="btn-mini danger" data-suppr-doc="${d.id}">🗑️</button>
          </div>
          <p class="aide">${h(dateFr(d.cree_le))} · ${Math.round((d.taille || 0) / 1024)} Ko</p>
          <details><summary class="aide" style="cursor:pointer">Voir le contenu</summary>
            <div class="bloc-copie" style="margin-top:10px;max-height:280px;overflow:auto">${h(d.contenu.slice(0, 8000))}</div>
          </details>
        </div>`).join('');

    el('i-docs').querySelectorAll('[data-suppr-doc]').forEach((b) =>
      b.addEventListener('click', () => { D.supprimer('documents', b.dataset.supprDoc); rendreDocs(); }));
  }

  el('i-doc').addEventListener('change', async (e) => {
    for (const fichier of e.target.files) {
      const contenu = await fichier.text();
      D.ajouter('documents', { nom: fichier.name, taille: fichier.size, contenu: contenu.slice(0, 200000) });
    }
    e.target.value = '';
    rendreDocs();
  });
  rendreDocs();

  /* Ma base */
  el('b-exporter').addEventListener('click', D.exporterTout);
  el('b-importer').addEventListener('change', async (e) => {
    const fichier = e.target.files[0];
    if (!fichier) return;
    try {
      const r = await D.importerTout(fichier, { fusion: el('b-fusion').checked });
      el('b-message').innerHTML = `<span class="reussite">${r.remplace
        ? `Base remplacée : ${r.prospects} prospect(s).`
        : `${r.ajoutes} entrée(s) ajoutée(s).`}</span>`;
      setTimeout(() => importer(hote), 1200);
    } catch (err) {
      el('b-message').innerHTML = `<span class="erreur">${h(err.message)}</span>`;
    }
  });
  el('b-dedoublonner').addEventListener('click', () => {
    const n = D.dedoublonner();
    el('b-message2').innerHTML = `<span class="reussite">${n} doublon(s) supprimé(s).</span>`;
  });
  el('b-reset').addEventListener('click', () => {
    if (!confirm('Effacer TOUTES tes données ? Exporte ta base avant si tu veux la garder.')) return;
    D.reinitialiser();
    importer(hote);
  });
}

/* =============================================================================
   Table des vues
   ========================================================================== */

export const VUES = {
  dashboard: { libelle: '📈 Dashboard', rendre: dashboard },
  approche: { libelle: '✉️ Approche', rendre: approche },
  evenements: { libelle: '📅 Événements', rendre: evenements },
  playbook: { libelle: '🎯 Playbook', rendre: playbook },
  crm: { libelle: '📇 CRM express', rendre: crm },
  import: { libelle: '📥 Import & base', rendre: importer },
};
