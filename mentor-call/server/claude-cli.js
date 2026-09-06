/**
 * Moteur d'analyse alternatif : le CLI Claude Code, couvert par ton abonnement
 * Claude — donc sans crédits d'API à recharger.
 *
 * Différence avec le moteur API : le CLI ne garantit pas la structure de sortie
 * (pas de schéma JSON imposé côté serveur). On demande donc le JSON dans le
 * prompt et on l'extrait ici de façon défensive.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError } from './http.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Emplacements possibles du binaire, du plus explicite au plus général. */
export function cheminCli() {
  const candidats = [
    process.env.CLAUDE_BIN,
    resolve(homedir(), '.local/bin/claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
  ].filter(Boolean);

  return candidats.find((c) => existsSync(c)) ?? 'claude';
}

/** Modèle utilisé par le CLI : alias court (`sonnet`, `opus`, `haiku`) ou identifiant complet. */
const MODELE_CLI = () => process.env.CLAUDE_CLI_MODEL || 'sonnet';

/**
 * Environnement d'exécution du CLI, débarrassé des variables qui pourraient le
 * détourner : celles injectées par une session Claude Code hôte (ANTHROPIC_BASE_URL,
 * CLAUDE_CODE_*) et les identifiants d'API. Sans ce nettoyage, le CLI se croit
 * « non connecté » alors que ses propres identifiants sont valides.
 */
export function environnementPropre() {
  const env = {};
  for (const [cle, valeur] of Object.entries(process.env)) {
    if (/^(CLAUDE|CLAUDECODE|ANTHROPIC)/.test(cle)) continue;
    env[cle] = valeur;
  }
  return env;
}

function executer(args, { entree = null, timeout = 5 * 60 * 1000 } = {}) {
  return new Promise((resoudre, rejeter) => {
    let proc;
    try {
      // cwd volontairement à la racine du projet : le CLI n'a rien à faire ailleurs.
      proc = spawn(cheminCli(), args, {
        cwd: ROOT,
        env: environnementPropre(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (e) {
      rejeter(new ApiError(503, `CLI Claude Code introuvable : ${e.message}`));
      return;
    }

    let stdout = '';
    let stderr = '';
    const minuteur = setTimeout(() => {
      proc.kill();
      rejeter(new ApiError(504, "Le CLI Claude Code n'a pas répondu dans le temps imparti."));
    }, timeout);

    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr += d));
    proc.on('error', (e) => {
      clearTimeout(minuteur);
      rejeter(new ApiError(503, `Lancement du CLI impossible : ${e.message}`));
    });
    proc.on('close', (code) => {
      clearTimeout(minuteur);
      resoudre({ code: code ?? 1, stdout, stderr });
    });

    if (entree !== null) {
      proc.stdin.write(entree);
      proc.stdin.end();
    }
  });
}

/* -------------------------------------------------------------------------- */
/* État                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * L'interrogation du CLI coûte ~2 s (démarrage de son runtime). Comme le
 * tableau de bord demande cet état à chaque chargement, on le garde en cache
 * quelques secondes. Toute connexion/déconnexion le vide immédiatement.
 */
let cacheEtat = { valeur: null, expire: 0 };
const DUREE_CACHE = 15_000;

function memoriser(etat) {
  cacheEtat = { valeur: etat, expire: Date.now() + DUREE_CACHE };
  return etat;
}

export function viderCacheCli() {
  cacheEtat = { valeur: null, expire: 0 };
}

export async function etatCli() {
  if (cacheEtat.valeur && Date.now() < cacheEtat.expire) return cacheEtat.valeur;

  const chemin = cheminCli();
  const installe = existsSync(chemin);
  if (!installe) return memoriser({ installe: false, connecte: false, chemin, modele: MODELE_CLI() });

  try {
    const [json, texte] = await Promise.all([
      executer(['auth', 'status'], { timeout: 15_000 }),
      executer(['auth', 'status', '--text'], { timeout: 15_000 }),
    ]);
    const etat = JSON.parse(json.stdout.trim());
    const profil = texte.stdout.trim();

    return memoriser({
      installe: true,
      connecte: Boolean(etat.loggedIn),
      methode_auth: etat.authMethod ?? null,
      profil,
      // Un profil « credentials-file » vient de la plateforme développeur (crédits d'API),
      // pas d'une connexion claude.ai : l'abonnement ne sera pas utilisé.
      abonnement_claude_ai: Boolean(etat.loggedIn) && !/credentials-file/i.test(profil),
      chemin,
      modele: MODELE_CLI(),
    });
  } catch {
    return memoriser({ installe: true, connecte: false, chemin, modele: MODELE_CLI() });
  }
}

/* -------------------------------------------------------------------------- */
/* Appel                                                                       */
/* -------------------------------------------------------------------------- */

/** Extrait le premier objet JSON complet d'un texte (tolère ```json et le bavardage autour). */
export function extraireJson(texte) {
  const sansCloture = texte.replace(/```json\s*/gi, '').replace(/```/g, '');
  const debut = sansCloture.indexOf('{');
  if (debut === -1) return null;

  let profondeur = 0;
  let dansChaine = false;
  let echappe = false;

  for (let i = debut; i < sansCloture.length; i++) {
    const c = sansCloture[i];
    if (echappe) {
      echappe = false;
      continue;
    }
    if (c === '\\') {
      echappe = true;
      continue;
    }
    if (c === '"') dansChaine = !dansChaine;
    if (dansChaine) continue;
    if (c === '{') profondeur++;
    if (c === '}') {
      profondeur--;
      if (profondeur === 0) {
        try {
          return JSON.parse(sansCloture.slice(debut, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export async function appelerClaudeCli({ systeme, message }) {
  const etat = await etatCli();
  if (!etat.installe) {
    throw new ApiError(503, "CLI Claude Code introuvable. Réinstalle-le (voir README, section Connexion).");
  }
  if (!etat.connecte) {
    throw new ApiError(
      503,
      "CLI Claude Code non connecté. Lance une fois dans le Terminal : ~/.local/bin/claude setup-token",
    );
  }

  const debut = Date.now();
  const { code, stdout, stderr } = await executer([
    '--print',
    '--output-format', 'json',
    '--model', MODELE_CLI(),
    '--system-prompt', systeme,
    // Aucune raison de toucher au disque ou au réseau pour analyser un texte fourni.
    '--disallowed-tools', 'Bash', 'Edit', 'Write', 'WebFetch', 'WebSearch',
  ], { entree: message });

  const latence_ms = Date.now() - debut;

  let enveloppe;
  try {
    enveloppe = JSON.parse(stdout.trim());
  } catch {
    throw new ApiError(
      502,
      `Réponse illisible du CLI Claude Code (code ${code}). ${(stderr || stdout).slice(0, 200)}`,
    );
  }

  if (enveloppe.is_error) {
    const message = String(enveloppe.result ?? 'erreur inconnue');
    if (/not logged in|login/i.test(message)) {
      throw new ApiError(
        503,
        "CLI Claude Code non connecté. Lance une fois dans le Terminal : ~/.local/bin/claude setup-token",
      );
    }
    if (/credit balance|too low|billing/i.test(message)) {
      // Cause la plus fréquente : Claude Code lit le profil « plateforme développeur »
      // (~/.config/anthropic, facturé en crédits) au lieu du compte claude.ai abonné.
      throw new ApiError(
        402,
        "Claude Code est connecté au mauvais compte : il utilise un profil API sans crédit, " +
          'pas ton abonnement claude.ai. Dans le Terminal, lance dans cet ordre : ' +
          '`ant auth logout` puis `~/.local/bin/claude auth login` en choisissant ton compte claude.ai.',
      );
    }
    throw new ApiError(502, `Claude Code : ${message.slice(0, 300)}`);
  }

  const brut = extraireJson(String(enveloppe.result ?? ''));
  if (!brut) {
    throw new ApiError(502, "Claude Code n'a pas renvoyé de JSON exploitable. Relance l'analyse.");
  }

  return {
    brut,
    latence_ms,
    modele: `${MODELE_CLI()} (Claude Code)`,
    usage: { cout_usd: enveloppe.total_cost_usd ?? 0, ...(enveloppe.usage ?? {}) },
  };
}
