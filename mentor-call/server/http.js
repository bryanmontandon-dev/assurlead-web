/** Petits utilitaires HTTP partagés par les routes. */

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new ApiError(400, message, details);
export const notFound = (message = 'Ressource introuvable') => new ApiError(404, message);

/** Vérifie qu'une valeur fait partie d'une liste autorisée (null/undefined = OK). */
export function checkEnum(champ, valeur, autorisees) {
  if (valeur === undefined || valeur === null || valeur === '') return null;
  if (!autorisees.includes(valeur)) {
    throw badRequest(`Valeur invalide pour "${champ}" : ${valeur}`, { autorisees });
  }
  return valeur;
}

/** Nombre optionnel, borné. Rejette les valeurs non numériques. */
export function checkNumber(champ, valeur, { min = -Infinity, max = Infinity } = {}) {
  if (valeur === undefined || valeur === null || valeur === '') return null;
  const n = Number(valeur);
  if (!Number.isFinite(n)) throw badRequest(`"${champ}" doit être un nombre`);
  if (n < min || n > max) throw badRequest(`"${champ}" doit être entre ${min} et ${max}`);
  return n;
}

/** Texte optionnel, trimé et tronqué à une longueur max. */
export function checkText(champ, valeur, maxLen = 200_000) {
  if (valeur === undefined || valeur === null) return null;
  if (typeof valeur !== 'string') throw badRequest(`"${champ}" doit être du texte`);
  const t = valeur.trim();
  if (t.length > maxLen) throw badRequest(`"${champ}" dépasse ${maxLen} caractères`);
  return t === '' ? null : t;
}
