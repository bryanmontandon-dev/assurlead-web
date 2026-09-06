/** Carnet des points à travailler (lecture, validation d'utilisation). */
import { Router } from 'express';
import { pointsActifs, pointsAcquis, marquerUtilise, annulerUtilisation } from '../points.js';
import { notFound } from '../http.js';

export const pointsRouter = Router();

pointsRouter.get('/', (req, res) => res.json(pointsActifs()));

pointsRouter.get('/acquis', (req, res) => res.json({ points: pointsAcquis() }));

pointsRouter.post('/:id/utilise', (req, res) => {
  const point = marquerUtilise(Number(req.params.id));
  if (!point) throw notFound('Point introuvable');
  res.json(point);
});

pointsRouter.post('/:id/annuler', (req, res) => {
  const point = annulerUtilisation(Number(req.params.id));
  if (!point) throw notFound('Point introuvable');
  res.json(point);
});
