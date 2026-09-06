/**
 * Mentor Call — serveur local.
 * Tourne uniquement sur cette machine. Aucune donnée client ne sort d'ici,
 * à l'exception du texte transcrit envoyé à l'API Anthropic au moment de l'analyse.
 */
import express from 'express';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Charge .env s'il existe (API native Node, pas de dépendance dotenv).
if (existsSync(resolve(ROOT, '.env'))) {
  process.loadEnvFile(resolve(ROOT, '.env'));
}

// Une variable vide n'est pas « absente » pour le SDK : elle l'empêcherait de
// retomber sur le compte Claude connecté. On les efface donc si elles sont vides.
for (const cle of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN']) {
  if (!(process.env[cle] ?? '').trim()) delete process.env[cle];
}

const { db, migrationState, DB_PATH } = await import('./db.js');
const { callsRouter, transcriptionRouter } = await import('./routes/calls.js');
const { clientsRouter } = await import('./routes/clients.js');
const { pointsRouter } = await import('./routes/points.js');
const { dailyRouter } = await import('./routes/daily.js');
const { statsRouter } = await import('./routes/stats.js');
const { etatWhisper } = await import('./transcribe.js');
const { authRouter } = await import('./routes/auth.js');
const { etatAuth } = await import('./auth.js');
const { ApiError } = await import('./http.js');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '5mb' }));

// Journal minimal des appels API, utile pour debug local.
app.use('/api', (req, res, next) => {
  const debut = Date.now();
  res.on('finish', () => {
    console.log(`${res.statusCode} ${req.method} ${req.originalUrl} — ${Date.now() - debut}ms`);
  });
  next();
});

/* --- Santé / configuration --------------------------------------------------- */

app.get('/api/health', async (req, res) => {
  // On expose l'état de l'authentification, jamais le moindre secret.
  res.json({
    ok: true,
    version: '0.1.0',
    db: { chemin: DB_PATH, schema_version: migrationState.to },
    nb_calls: db.prepare('SELECT COUNT(*) AS n FROM calls').get().n,
    config: {
      auth: await etatAuth(),
      modele: process.env.ANTHROPIC_MODEL ?? 'claude-opus-5',
      whisper: etatWhisper(),
    },
    heure_serveur: new Date().toISOString(),
  });
});

/* --- Routes API -------------------------------------------------------------- */

app.use('/api/auth', authRouter);
app.use('/api/calls', callsRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/points', pointsRouter);
app.use('/api/transcription', transcriptionRouter);
app.use('/api/daily', dailyRouter);
app.use('/api/stats', statsRouter);

/* --- Frontend statique -------------------------------------------------------- */

app.use(express.static(resolve(ROOT, 'public'), { extensions: ['html'] }));

app.use('/api', (req, res) => {
  res.status(404).json({ erreur: `Route inconnue : ${req.method} ${req.originalUrl}` });
});

/* --- Gestion d'erreurs --------------------------------------------------------- */

app.use((err, req, res, _next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ erreur: 'Fichier audio trop volumineux (300 Mo maximum).' });
    return;
  }
  const status = err instanceof ApiError ? err.status : 500;
  if (status >= 500) console.error('Erreur serveur :', err);
  res.status(status).json({
    erreur: err.message || 'Erreur interne',
    ...(err.details ? { details: err.details } : {}),
  });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Mentor Call — prêt sur http://localhost:${PORT}`);
  console.log(`  Base locale : ${DB_PATH} (schéma v${migrationState.to})`);
  console.log(
    `  Clé Anthropic : ${process.env.ANTHROPIC_API_KEY ? 'configurée' : 'ABSENTE (voir .env)'}\n`,
  );

  // Interroger le CLI coûte quelques secondes : on le fait tout de suite pour que
  // le premier chargement du tableau de bord soit instantané.
  etatAuth().catch(() => {});
});
