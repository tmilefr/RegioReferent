'use strict';

/**
 * helpers.js
 * ──────────
 * Fonctions utilitaires partagées entre les routes.
 */

const DAYS_FR = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/**
 * Normalise une date (string ISO ou objet Date) en "YYYY-MM-DD".
 * @param {string|Date} v
 */
function toIsoDate(v) {
  if (!v) return '';
  if (v instanceof Date) return isNaN(v) ? '' : v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

/**
 * Formate une date ISO (YYYY-MM-DD) en "Lundi 12 mai 2025".
 * @param {string|Date} dateStr
 */
function formatDateFr(dateStr) {
  dateStr = toIsoDate(dateStr);
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00Z');
  const dayIndex = (d.getUTCDay() === 0 ? 7 : d.getUTCDay()); // 1=Lun..7=Dim
  return `${DAYS_FR[dayIndex]} ${d.getUTCDate()} ${MONTHS_FR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Retourne true si la date de la session est aujourd'hui ou passée
 * (la validation des présences est ouverte).
 *
 * @param {string} dateStr  YYYY-MM-DD
 */
function isValidationOpen(dateStr) {
  dateStr = toIsoDate(dateStr);
  if (!dateStr) return false;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const sessionDate = new Date(dateStr + 'T00:00:00Z');
  return sessionDate <= today;
}

/**
 * Nombre de jours restants avant la session (peut être négatif).
 * @param {string} dateStr  YYYY-MM-DD
 */
function daysUntil(dateStr) {
  dateStr = toIsoDate(dateStr);
  if (!dateStr) return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00Z');
  return Math.round((d - today) / 86_400_000);
}

/**
 * Valide et parse un nombre d'unités saisi dans le formulaire.
 * Accepte 0.5 comme pas minimum.
 *
 * @param {*}      raw        Valeur brute (chaîne ou nombre)
 * @param {number} fallback   Valeur si invalide
 * @param {number} maxUnits   Plafond (2 × nb_units de la session)
 */
function parseUnits(raw, fallback = 0, maxUnits = 99) {
  const v = parseFloat(raw);
  if (isNaN(v) || v < 0) return fallback;
  if (v > maxUnits) return maxUnits;
  return Math.round(v * 2) / 2; // arrondi au demi le plus proche
}

/**
 * Échappe les entités HTML pour éviter les XSS dans les templates.
 * @param {*} str
 */
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Retourne le libellé lisible du type de participant.
 * @param {string} type  'Mr' | 'Mme' | 'Both'
 */
function labelTypeParticipant(type) {
  const map = { Mr: 'M.', Mme: 'Mme', Both: 'Les deux' };
  return map[type] || type || '';
}

module.exports = { formatDateFr, isValidationOpen, daysUntil, parseUnits, esc, labelTypeParticipant };
