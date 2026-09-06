import { api, monterNav, echapper } from './api.js';
import { versWav16k, meilleurFormat } from './audio-wav.js';

monterNav();

const el = (id) => document.getElementById(id);
const transcript = el('transcript');
const message = el('message');

/** Identifiant du call en base : créé au premier enregistrement ou à la sauvegarde. */
let callId = null;
let dureeAudio = null;

/** État de la capture — déclaré avant tout usage (les fonctions ci-dessous s'en servent). */
let recorder = null;
let morceaux = [];
let enregistre = false;
let enCours = false; // transcription en cours
let debutChrono = 0;
let minuteur = null;

/* --- Confort de saisie -------------------------------------------------------- */

transcript.addEventListener('input', () => {
  el('compteur').textContent = transcript.value.length;
});

el('resultat').addEventListener('change', (e) => {
  el('bloc-mapro').style.display = e.target.value === 'signe' ? 'block' : 'none';
});

function majConsentement() {
  const estEnregistrement = el('mode').value === 'enregistrement';
  el('bloc-consentement').style.display = estEnregistrement ? 'block' : 'none';
  majBoutonMicro();
}

function majBoutonMicro() {
  const estEnregistrement = el('mode').value === 'enregistrement';
  const bloque = estEnregistrement && !el('consentement').checked;
  el('btn-micro').disabled = bloque || enCours;
  if (bloque) el('etat-capture').textContent = 'Coche la case de consentement pour activer le micro';
  else if (!enregistre) el('etat-capture').textContent = 'Prêt à enregistrer';
}

el('mode').addEventListener('change', majConsentement);
el('consentement').addEventListener('change', majBoutonMicro);
majConsentement();

/* --- Brouillon local ---------------------------------------------------------- */

const CLE_BROUILLON = 'mentor-call:brouillon';
const CHAMPS = ['mode', 'transcript', 'etiquette', 'client_type', 'produit_vise', 'resultat', 'montant_mapro'];

/* --- Liste des clients (rattachement du call) ---------------------------------- */

async function chargerClients() {
  try {
    const { clients } = await api('/clients');
    const select = el('client_id');
    for (const c of clients) {
      const option = document.createElement('option');
      option.value = c.id;
      option.textContent = c.localite ? `${c.nom} — ${c.localite}` : c.nom;
      select.append(option);
    }
    // Arrivée depuis une fiche client : on pré-sélectionne et on reprend son type.
    const demande = new URLSearchParams(location.search).get('client_id');
    if (demande && clients.some((c) => String(c.id) === demande)) {
      select.value = demande;
      const client = clients.find((c) => String(c.id) === demande);
      if (client?.type && !el('client_type').value) el('client_type').value = client.type;
    }
  } catch {
    /* la page reste utilisable sans la liste */
  }
}

chargerClients();

const sauverBrouillon = () =>
  localStorage.setItem(
    CLE_BROUILLON,
    JSON.stringify(Object.fromEntries(CHAMPS.map((c) => [c, el(c).value]))),
  );

function restaurerBrouillon() {
  const brut = localStorage.getItem(CLE_BROUILLON);
  if (!brut) return;
  try {
    const donnees = JSON.parse(brut);
    for (const c of CHAMPS) if (donnees[c]) el(c).value = donnees[c];
    el('compteur').textContent = transcript.value.length;
    el('bloc-mapro').style.display = el('resultat').value === 'signe' ? 'block' : 'none';
    majConsentement();
    if (transcript.value) message.textContent = 'Brouillon restauré.';
  } catch {
    localStorage.removeItem(CLE_BROUILLON);
  }
}

CHAMPS.forEach((c) => el(c).addEventListener('input', sauverBrouillon));
restaurerBrouillon();


/* --- Carnet des points à travailler -------------------------------------------- */

const LIBELLE_CATEGORIE = {
  decouverte: 'Découverte',
  objections: 'Gestion des objections',
  closing: 'Closing',
  produit: 'Maîtrise produit',
  rythme: 'Rythme et écoute',
  why: 'Start with Why',
  courtier: 'Réflexe courtier',
  autre: 'Divers',
};

/** Pastilles de progression : combien d'utilisations avant que le point tombe. */
const jaugePoints = (p) =>
  Array.from({ length: p.objectif_repetitions }, (_, i) =>
    `<span class="pastille ${i < p.fois_travaille ? 'faite' : ''}"></span>`,
  ).join('');

const carteCarnet = (p) => `
  <div class="point ${p.recurrent ? 'recurrent' : ''}" data-id="${p.id}">
    <div class="libelle">${echapper(p.libelle)}</div>
    ${p.reformulation ? `<div class="phrase">« ${echapper(p.reformulation)} »</div>` : ''}
    <div class="bas">
      <div class="jauge-points">
        ${jaugePoints(p)}
        <span class="compte">${p.fois_travaille}/${p.objectif_repetitions}</span>
        ${p.recurrent ? `<span class="compte" style="color:var(--ambre)">· relevé ${p.occurrences}×</span>` : ''}
      </div>
      <button class="btn-utilise" data-id="${p.id}">Utilisé ✓</button>
    </div>
  </div>`;

async function chargerCarnet() {
  let data;
  try {
    data = await api('/points');
  } catch {
    return; // le carnet est un plus : son absence ne bloque pas le débrief
  }

  const carte = el('carte-carnet');
  if (data.total === 0) {
    carte.style.display = 'none';
    return;
  }

  carte.style.display = '';
  el('compte-carnet').textContent = `${data.total} point${data.total > 1 ? 's' : ''}`;
  el('carnet').innerHTML = data.groupes
    .map(
      (g) => `
        <div class="categorie">
          <h3>${LIBELLE_CATEGORIE[g.categorie] ?? g.categorie}</h3>
          ${g.points.map(carteCarnet).join('')}
        </div>`,
    )
    .join('');

  el('carnet')
    .querySelectorAll('.btn-utilise')
    .forEach((b) => b.addEventListener('click', () => marquerUtilise(b)));
}

async function marquerUtilise(bouton) {
  const id = bouton.dataset.id;
  bouton.disabled = true;
  try {
    const point = await api(`/points/${id}/utilise`, { method: 'POST' });
    const carte = el('carnet').querySelector(`.point[data-id="${id}"]`);

    if (point.statut === 'acquis') {
      // Objectif atteint : le point quitte la liste sous les yeux.
      carte.classList.add('acquis-anim');
      setTimeout(chargerCarnet, 380);
      return;
    }

    carte.querySelector('.jauge-points').innerHTML = `
      ${jaugePoints(point)}
      <span class="compte">${point.fois_travaille}/${point.objectif_repetitions}</span>
      ${point.recurrent ? `<span class="compte" style="color:var(--ambre)">· relevé ${point.occurrences}×</span>` : ''}`;
    bouton.disabled = false;
  } catch {
    bouton.disabled = false;
  }
}

chargerCarnet();

/* --- Enregistrement micro ------------------------------------------------------ */

const deuxChiffres = (n) => String(n).padStart(2, '0');

function majChrono() {
  const s = Math.floor((Date.now() - debutChrono) / 1000);
  el('chrono').textContent = `${deuxChiffres(Math.floor(s / 60))}:${deuxChiffres(s % 60)}`;
}

el('btn-micro').addEventListener('click', async () => {
  if (enregistre) {
    recorder.stop();
    return;
  }

  try {
    const flux = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });

    const mimeType = meilleurFormat();
    recorder = new MediaRecorder(flux, mimeType ? { mimeType } : undefined);
    morceaux = [];

    recorder.addEventListener('dataavailable', (e) => {
      if (e.data.size > 0) morceaux.push(e.data);
    });

    recorder.addEventListener('stop', async () => {
      clearInterval(minuteur);
      flux.getTracks().forEach((t) => t.stop());
      enregistre = false;
      el('btn-micro').classList.remove('enregistre');
      el('btn-micro').textContent = '●';
      await traiterAudio(new Blob(morceaux, { type: mimeType || 'audio/webm' }));
    });

    recorder.start();
    enregistre = true;
    debutChrono = Date.now();
    majChrono();
    minuteur = setInterval(majChrono, 250);
    el('btn-micro').classList.add('enregistre');
    el('btn-micro').textContent = '■';
    el('etat-capture').textContent = 'Enregistrement… (clique pour arrêter)';
  } catch (e) {
    el('etat-capture').textContent = `Micro inaccessible : ${e.message}`;
  }
});

/* --- Transcription ------------------------------------------------------------- */

async function traiterAudio(blobBrut) {
  enCours = true;
  majBoutonMicro();
  el('etat-capture').textContent = 'Conversion de l’audio…';

  try {
    const { blob, duree } = await versWav16k(blobBrut);
    dureeAudio = Math.round(duree);

    if (!callId) callId = (await creerCall()).id;

    el('etat-capture').textContent = 'Transcription locale en cours… 0 %';

    const formulaire = new FormData();
    formulaire.append('audio', blob, 'debrief.wav');
    formulaire.append('duree_secondes', String(dureeAudio));

    const reponse = await fetch(`/api/calls/${callId}/audio`, { method: 'POST', body: formulaire });
    const data = await reponse.json();
    if (!reponse.ok) throw new Error(data.erreur || 'Envoi impossible');

    const texte = await attendreTranscription(data.job_id);

    transcript.value = transcript.value ? `${transcript.value.trim()}\n\n${texte}` : texte;
    el('compteur').textContent = transcript.value.length;
    sauverBrouillon();
    el('etat-capture').textContent = `Transcription terminée (${dureeAudio}s d’audio).`;
  } catch (e) {
    el('etat-capture').textContent = `Erreur : ${e.message}`;
  } finally {
    enCours = false;
    majBoutonMicro();
  }
}

function attendreTranscription(jobId) {
  return new Promise((resoudre, rejeter) => {
    const tick = async () => {
      try {
        const job = await api(`/transcription/${jobId}`);
        if (job.etat === 'termine') {
          resoudre(job.transcript);
          return;
        }
        if (job.etat === 'erreur') {
          rejeter(new Error(job.erreur));
          return;
        }
        el('etat-capture').textContent = `Transcription locale en cours… ${job.progression} %`;
        setTimeout(tick, 1200);
      } catch (e) {
        rejeter(e);
      }
    };
    tick();
  });
}

/* --- Sauvegarde --------------------------------------------------------------- */

function corpsCall() {
  return {
    mode: el('mode').value,
    transcript: transcript.value,
    client_id: el('client_id').value || null,
    etiquette: el('etiquette').value || null,
    client_type: el('client_type').value || null,
    produit_vise: el('produit_vise').value || null,
    resultat: el('resultat').value || null,
    montant_mapro: el('resultat').value === 'signe' ? el('montant_mapro').value || null : null,
    duree_secondes: dureeAudio,
  };
}

const creerCall = () => api('/calls', { method: 'POST', body: corpsCall() });

async function sauvegarder() {
  if (transcript.value.trim().length < 40) {
    transcript.focus();
    throw new Error('Il faut au moins quelques phrases pour que l’analyse ait de la matière.');
  }
  if (callId) {
    await api(`/calls/${callId}`, { method: 'PATCH', body: corpsCall() });
  } else {
    callId = (await creerCall()).id;
  }
  localStorage.removeItem(CLE_BROUILLON);
  return callId;
}

function verrouiller(actif) {
  el('enregistrer').disabled = actif;
  el('analyser').disabled = actif;
}

el('enregistrer').addEventListener('click', async () => {
  verrouiller(true);
  try {
    const id = await sauvegarder();
    message.innerHTML = `Débrief #${id} enregistré. <a href="call-detail.html?id=${id}">Voir la fiche →</a>`;
  } catch (e) {
    message.textContent = e.message;
  } finally {
    verrouiller(false);
  }
});

el('analyser').addEventListener('click', async () => {
  verrouiller(true);
  message.textContent = 'Enregistrement…';
  try {
    const id = await sauvegarder();
    message.textContent = 'Analyse en cours (compte 30 à 60 secondes)…';
    await api(`/calls/${id}/analyser`, { method: 'POST' });
    location.href = `call-detail.html?id=${id}`;
  } catch (e) {
    message.innerHTML = `Erreur : ${e.message}${
      callId ? ` — le débrief #${callId} est enregistré, tu peux relancer l'analyse depuis sa fiche.` : ''
    }`;
    verrouiller(false);
  }
});
