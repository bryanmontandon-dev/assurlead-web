/**
 * Connexion du compte Claude — tout se fait depuis l'app, sans Terminal.
 *
 * Le flux de `claude auth login` est en deux temps :
 *   1. il ouvre le navigateur sur la page de connexion Claude
 *   2. la page affiche un code que l'utilisateur recolle
 * On garde donc le processus vivant entre les deux requêtes HTTP, et on lui
 * transmet le code sur son entrée standard.
 *
 * Le code d'autorisation transite par le serveur local uniquement pour être
 * remis au CLI : il n'est ni stocké, ni journalisé. Les identifiants eux-mêmes
 * restent gérés par Claude Code.
 */
import { spawn } from 'node:child_process';
import { ApiError } from './http.js';
import { reinitialiserClient, moteurActif } from './analyze.js';
import { etatCli, cheminCli, environnementPropre, viderCacheCli } from './claude-cli.js';

/** Connexion en cours : le processus attend le code de l'utilisateur. */
let session = { etape: 'inactif', url: null, erreur: null, proc: null, journal: '' };

// Large : le code d'autorisation a sa propre expiration, inutile d'être le maillon court.
const DELAI_MAX = 30 * 60 * 1000;

/** Le processus de connexion est-il encore en vie ? */
const procVivant = () => Boolean(session.proc) && session.proc.exitCode === null && !session.proc.killed;

function reinitialiser(erreur = null) {
  if (session.proc && !session.proc.killed) session.proc.kill();
  session = { etape: 'inactif', url: null, erreur, proc: null, journal: '' };
}

/** Exécution simple d'une commande, sortie ignorée (jamais journalisée). */
function executer(commande, args) {
  return new Promise((resoudre) => {
    let proc;
    try {
      proc = spawn(commande, args, { env: environnementPropre(), stdio: 'ignore' });
    } catch {
      resoudre(false);
      return;
    }
    const minuteur = setTimeout(() => proc.kill(), 20_000);
    proc.on('error', () => {
      clearTimeout(minuteur);
      resoudre(false);
    });
    proc.on('close', (code) => {
      clearTimeout(minuteur);
      resoudre(code === 0);
    });
  });
}

/* -------------------------------------------------------------------------- */
/* État                                                                        */
/* -------------------------------------------------------------------------- */

export function cleApiPresente() {
  const cle = (process.env.ANTHROPIC_API_KEY ?? '').trim();
  return cle.startsWith('sk-ant-') && cle.length > 30;
}

export async function etatAuth() {
  const moteur = moteurActif();

  if (moteur === 'api') {
    return { moteur: 'api', connecte: cleApiPresente(), methode: cleApiPresente() ? 'cle_api' : null };
  }

  const cli = await etatCli();
  return {
    moteur: 'cli',
    connecte: cli.connecte && cli.abonnement_claude_ai !== false,
    methode: cli.connecte ? 'claude_code' : null,
    cli,
    connexion: { etape: session.etape, url: session.url, erreur: session.erreur },
  };
}

/* -------------------------------------------------------------------------- */
/* Connexion                                                                   */
/* -------------------------------------------------------------------------- */

/** Étape 1 : ouvre la page de connexion Claude et renvoie l'URL affichée. */
export async function demarrerConnexion() {
  reinitialiser();

  viderCacheCli();

  // Un profil « plateforme développeur » masquerait l'abonnement : on le retire d'abord.
  await executer('ant', ['auth', 'logout']);

  const proc = spawn(cheminCli(), ['auth', 'login', '--claudeai'], {
    env: environnementPropre(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  session = { etape: 'attente_url', url: null, erreur: null, proc, journal: '' };

  const lire = (donnee) => {
    const texte = donnee.toString();
    session.journal += texte;
    const url = texte.match(/https:\/\/[^\s"']+/);
    if (url && !session.url) {
      session.url = url[0];
      session.etape = 'attente_code';
    }
  };

  proc.stdout.on('data', lire);
  proc.stderr.on('data', lire);
  proc.on('error', (e) => reinitialiser(`Lancement impossible : ${e.message}`));

  const expiration = setTimeout(() => {
    if (session.etape === 'attente_code') {
      session.etape = 'expire';
      session.erreur = 'La session de connexion a expiré. Relance-la pour obtenir un nouveau code.';
    }
  }, DELAI_MAX);

  // Si le CLI s'arrête de lui-même avant qu'on lui donne le code, on le dit
  // explicitement plutôt que de laisser croire que l'attente continue.
  proc.on('close', () => {
    clearTimeout(expiration);
    if (session.etape === 'attente_code') {
      session.etape = 'expire';
      session.erreur = 'La session de connexion s’est fermée. Relance-la pour obtenir un nouveau code.';
    }
  });

  // Laisse au CLI le temps d'imprimer l'URL avant de répondre au navigateur.
  for (let i = 0; i < 40 && !session.url; i++) {
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!session.url) {
    const journal = session.journal.slice(0, 200);
    reinitialiser("Le CLI n'a pas fourni de lien de connexion.");
    throw new ApiError(502, `Connexion impossible. ${journal}`);
  }

  return { etape: session.etape, url: session.url };
}

/** Étape 2 : transmet le code collé par l'utilisateur au CLI. */
export async function validerCode(code) {
  const propre = String(code ?? '').trim();
  if (!propre) throw new ApiError(400, 'Colle le code affiché par Claude.');

  // Cas fréquent : la page est restée ouverte longtemps et le CLI s'est arrêté
  // entre-temps. Le code est alors inutilisable — il faut en régénérer un.
  if (!procVivant()) {
    const message =
      session.etape === 'expire'
        ? session.erreur
        : 'La session de connexion n’est plus active. Relance-la pour obtenir un nouveau code.';
    reinitialiser(message);
    throw new ApiError(409, message);
  }

  const proc = session.proc;
  session.etape = 'verification';

  const termine = new Promise((resoudre) => {
    if (proc.exitCode !== null) {
      resoudre(false);
      return;
    }
    proc.on('close', (code) => resoudre(code === 0));
    setTimeout(() => resoudre(false), 90_000);
  });

  try {
    proc.stdin.write(`${propre}\n`);
  } catch (e) {
    reinitialiser('La session de connexion s’est fermée. Relance-la pour obtenir un nouveau code.');
    throw new ApiError(409, 'La session de connexion s’est fermée. Relance-la pour obtenir un nouveau code.');
  }

  await termine;
  viderCacheCli();
  reinitialiserClient();

  const cli = await etatCli();
  const reussi = cli.connecte && cli.abonnement_claude_ai !== false;
  reinitialiser(reussi ? null : "La connexion n'a pas abouti. Vérifie le code et recommence.");

  if (!reussi) throw new ApiError(401, "La connexion n'a pas abouti. Vérifie le code et recommence.");
  return { connecte: true };
}

/** Déconnexion : Claude Code, plus le profil API s'il traîne encore. */
export async function deconnecter() {
  reinitialiser();
  const ok = await executer(cheminCli(), ['auth', 'logout']);
  await executer('ant', ['auth', 'logout']);
  viderCacheCli();
  reinitialiserClient();
  if (!ok) throw new ApiError(500, 'Déconnexion impossible.');
}
