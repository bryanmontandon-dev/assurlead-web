/** Connexion du compte Claude (aucun secret n'est renvoyé au navigateur). */
import { Router } from 'express';
import { etatAuth, demarrerConnexion, validerCode, deconnecter } from '../auth.js';

export const authRouter = Router();

authRouter.get('/', async (req, res) => res.json(await etatAuth()));

authRouter.post('/connexion', async (req, res) => {
  const { url, etape } = await demarrerConnexion();
  res.status(202).json({ url, etape });
});

authRouter.post('/code', async (req, res) => {
  await validerCode(req.body?.code);
  res.json(await etatAuth());
});

authRouter.post('/deconnexion', async (req, res) => {
  await deconnecter();
  res.json(await etatAuth());
});
