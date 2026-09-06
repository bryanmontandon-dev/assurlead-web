/**
 * Transcription locale via whisper.cpp.
 *
 * L'audio ne quitte JAMAIS cette machine : il est écrit dans data/recordings/,
 * transcrit par le binaire local, puis supprimé dès que le texte est obtenu.
 *
 * Le navigateur envoie déjà du WAV 16 kHz mono (converti côté client avec
 * l'API Web Audio), donc aucun ffmpeg n'est nécessaire.
 */
import { spawn } from 'node:child_process';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { cpus } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RECORDINGS_DIR } from './db.js';
import { ApiError } from './http.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const chemin = (valeur, defaut) => {
  const v = valeur || defaut;
  return v.startsWith('/') ? v : resolve(ROOT, v);
};

export const WHISPER_BIN = () => chemin(process.env.WHISPER_BIN, 'vendor/whisper.cpp/main');
export const WHISPER_MODEL = () =>
  chemin(process.env.WHISPER_MODEL, 'vendor/whisper.cpp/models/ggml-small.bin');
const LANGUE = () => process.env.WHISPER_LANG || 'fr';

/** Whisper est-il utilisable ? (binaire compilé + modèle téléchargé) */
export function etatWhisper() {
  const bin = WHISPER_BIN();
  const modele = WHISPER_MODEL();
  return {
    pret: existsSync(bin) && existsSync(modele),
    binaire: bin,
    binaire_present: existsSync(bin),
    modele,
    modele_present: existsSync(modele),
  };
}

/* -------------------------------------------------------------------------- */
/* Registre des transcriptions en cours                                        */
/* -------------------------------------------------------------------------- */

/** @type {Map<string, {call_id:number, etat:string, progression:number, transcript?:string, erreur?:string, debut:number, fin?:number}>} */
const jobs = new Map();

export const lireJob = (id) => jobs.get(id) ?? null;

/** Purge les jobs terminés depuis plus d'une heure. */
function purger() {
  const limite = Date.now() - 3_600_000;
  for (const [id, job] of jobs) {
    if (job.fin && job.fin < limite) jobs.delete(id);
  }
}

/* -------------------------------------------------------------------------- */
/* Transcription                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Lance la transcription d'un buffer WAV. Retourne immédiatement un identifiant
 * de job ; le front interroge ensuite GET /api/transcription/:id.
 */
export async function lancerTranscription(callId, bufferWav) {
  const etat = etatWhisper();
  if (!etat.pret) {
    throw new ApiError(
      503,
      `Whisper n'est pas prêt (binaire : ${etat.binaire_present ? 'OK' : 'manquant'}, modèle : ${
        etat.modele_present ? 'OK' : 'manquant'
      }). Voir le README, section Transcription.`,
    );
  }

  purger();
  const jobId = randomUUID();
  const base = join(RECORDINGS_DIR, `call-${callId}-${jobId}`);
  const fichierWav = `${base}.wav`;

  await writeFile(fichierWav, bufferWav);
  jobs.set(jobId, { call_id: callId, etat: 'en_cours', progression: 0, debut: Date.now() });

  executer(jobId, base, fichierWav).catch((e) => {
    const job = jobs.get(jobId);
    if (job) Object.assign(job, { etat: 'erreur', erreur: e.message, fin: Date.now() });
  });

  return jobId;
}

function executer(jobId, base, fichierWav) {
  return new Promise((resolveJob, rejectJob) => {
    const job = jobs.get(jobId);

    const args = [
      '-m', WHISPER_MODEL(),
      '-f', fichierWav,
      '-l', LANGUE(),
      '-t', String(Math.max(2, Math.min(8, cpus().length))),
      '-otxt',
      '-of', base,
      '-nt',                   // pas d'horodatage dans le texte
      '--print-progress',
    ];

    const proc = spawn(WHISPER_BIN(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let journal = '';

    // whisper.cpp écrit sa progression sur stderr : "progress =  42%"
    proc.stderr.on('data', (chunk) => {
      const texte = chunk.toString();
      journal += texte;
      const trouve = [...texte.matchAll(/progress\s*=\s*(\d+)%/g)].pop();
      if (trouve && job) job.progression = Number(trouve[1]);
    });
    proc.stdout.on('data', (chunk) => {
      journal += chunk.toString();
    });

    proc.on('error', (e) => rejectJob(new Error(`Impossible de lancer whisper : ${e.message}`)));

    proc.on('close', async (code) => {
      // L'audio est supprimé quoi qu'il arrive : il n'a pas vocation à être conservé.
      await unlink(fichierWav).catch(() => {});

      if (code !== 0) {
        rejectJob(new Error(`whisper a échoué (code ${code}). ${journal.slice(-300)}`));
        return;
      }

      try {
        const texte = (await readFile(`${base}.txt`, 'utf8')).trim();
        await unlink(`${base}.txt`).catch(() => {});
        if (job) {
          Object.assign(job, {
            etat: 'termine',
            progression: 100,
            transcript: texte,
            fin: Date.now(),
            duree_ms: Date.now() - job.debut,
          });
        }
        resolveJob(texte);
      } catch (e) {
        rejectJob(new Error(`Transcription illisible : ${e.message}`));
      }
    });
  });
}
