'use strict';

/**
 * models.js
 * ─────────
 * Couche données de l'application de validation des présences.
 * Miroir Node.js des méthodes PHP des modèles CI :
 *   - Admwork_model
 *   - Infos_model
 *   - Familys_model
 *   - ValidationToken_model
 *   - Trombi_model
 */

const { query } = require('./db');

// ─────────────────────────────────────────────────────────────────────────────
// TRAVAUX (sessions)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne les sessions où une famille est référente (non archivées).
 * Miroir de Admwork_model::GetWorksAsReferent()
 *
 * @param {number} idFam
 */
async function getWorksAsReferent(idFam) {
  const [rows] = await query(
    `SELECT t.*
     FROM travaux t
     INNER JOIN trombi tr ON tr.id = t.referent_travaux
     INNER JOIN groupes_member gm ON gm.id = tr.ref
     WHERE gm.id_fam = ?
       AND (t.archived IS NULL OR t.archived != 1)
     ORDER BY t.date_travaux DESC`,
    [idFam]
  );
  return rows;
}

/**
 * Retourne une session par son id.
 *
 * @param {number} idWork
 */
async function getWorkById(idWork) {
  const [rows] = await query(
    `SELECT * FROM travaux WHERE id = ? LIMIT 1`,
    [idWork]
  );
  return rows[0] || null;
}

/**
 * Retourne la famille référente d'une session.
 * Miroir de Admwork_model::GetReferentFamily()
 *
 * @param {number} idWork
 */
async function getReferentFamily(idWork) {
  const [rows] = await query(
    `SELECT f.*, gm.name AS gm_name, gm.surname AS gm_surname, gm.email AS gm_email
     FROM travaux t
     INNER JOIN trombi tr ON tr.id = t.referent_travaux
     INNER JOIN groupes_member gm ON gm.id = tr.ref
     INNER JOIN famille f ON f.id = gm.id_fam
     WHERE t.id = ?
     LIMIT 1`,
    [idWork]
  );
  return rows[0] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// INSCRIPTIONS (infos)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne toutes les inscriptions d'une session, enrichies du nom de famille.
 *
 * @param {number} idWork
 */
async function getRegistrations(idWork) {
  const [rows] = await query(
    `SELECT i.*,
            f.nom        AS family_nom,
            f.e_mail     AS family_email,
            f.e_mail_comp AS family_email_comp
     FROM infos i
     LEFT JOIN famille f ON f.id = i.id_famille
     WHERE i.id_travaux = ?
     ORDER BY f.nom ASC`,
    [idWork]
  );
  return rows;
}

/**
 * Compte les inscriptions (non supprimées) d'une session.
 *
 * @param {number} idWork
 */
async function countRegistrations(idWork) {
  const [rows] = await query(
    `SELECT COUNT(*) AS nb FROM infos WHERE id_travaux = ?`,
    [idWork]
  );
  return rows[0]?.nb || 0;
}

/**
 * Met à jour la présence + unités validées + commentaire d'une inscription.
 * Miroir de la logique dans Admwork_controller::_ProcessRefValidation()
 *
 * @param {number}  idInfo
 * @param {boolean} present
 * @param {number}  nbUnites
 * @param {string}  commentaire
 * @param {number}  idFamRef
 */
async function updatePresence(idInfo, present, nbUnites, commentaire, idFamRef) {
  await query(
    `UPDATE infos
     SET nb_unites_valides          = ?,
         nb_unites_valides_effectif = ?,
         commentaire_ref            = ?,
         validated_by_ref           = ?,
         validated_by_ref_at        = NOW(),
         updated                    = NOW()
     WHERE id = ?`,
    [
      present ? nbUnites : 0,
      present ? nbUnites : 0,
      commentaire || null,
      idFamRef,
      idInfo,
    ]
  );
}

/**
 * Supprime une inscription (no-show).
 *
 * @param {number} idInfo
 */
async function deleteRegistration(idInfo) {
  await query(`DELETE FROM infos WHERE id = ?`, [idInfo]);
}

/**
 * Enregistre un commentaire global sur une session (dans travaux.commentaire_ref).
 * La colonne est ajoutée par la migration si elle n'existe pas.
 *
 * @param {number} idWork
 * @param {string} commentaire
 */
async function saveGlobalComment(idWork, commentaire) {
  await query(
    `UPDATE travaux SET commentaire_ref = ?, updated = NOW() WHERE id = ?`,
    [commentaire || null, idWork]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS DE VALIDATION (validation_tokens)
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_LENGTH_BYTES = 32; // → 64 hex chars

/**
 * Recherche un token valide (non expiré, non utilisé).
 * Miroir de ValidationToken_model::findValid()
 *
 * @param {string} token
 */
async function findValidToken(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;

  const [rows] = await query(
    `SELECT * FROM validation_tokens
     WHERE token = ?
       AND expires_at >= NOW()
     LIMIT 1`,
    [token]
  );
  return rows[0] || null;
}

/**
 * Marque un token comme utilisé.
 * Miroir de ValidationToken_model::markUsed()
 *
 * @param {number} id
 */
async function markTokenUsed(id) {
  await query(
    `UPDATE validation_tokens SET used_at = NOW() WHERE id = ?`,
    [id]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FAMILLES (famille) – authentification référent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne une famille par son login.
 *
 * @param {string} login
 */
async function getFamilyByLogin(login) {
  const [rows] = await query(
    `SELECT id, nom, login, password, e_mail FROM famille WHERE login = ? LIMIT 1`,
    [login]
  );
  return rows[0] || null;
}

/**
 * Retourne une famille par son id.
 *
 * @param {number} idFam
 */
async function getFamilyById(idFam) {
  const [rows] = await query(
    `SELECT id, nom, login, e_mail FROM famille WHERE id = ? LIMIT 1`,
    [idFam]
  );
  return rows[0] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// TROMBI – info référent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne l'enregistrement trombi + groupes_member d'un référent
 * à partir de l'id trombi (referent_travaux dans travaux).
 *
 * @param {number} idTrombi
 */
async function getReferentInfo(idTrombi) {
  const [rows] = await query(
    `SELECT tr.*, gm.name, gm.surname, gm.email, gm.id_fam
     FROM trombi tr
     INNER JOIN groupes_member gm ON gm.id = tr.ref
     WHERE tr.id = ?
     LIMIT 1`,
    [idTrombi]
  );
  return rows[0] || null;
}

module.exports = {
  // travaux
  getWorksAsReferent,
  getWorkById,
  getReferentFamily,
  // infos
  getRegistrations,
  countRegistrations,
  updatePresence,
  deleteRegistration,
  saveGlobalComment,
  // tokens
  findValidToken,
  markTokenUsed,
  // famille
  getFamilyByLogin,
  getFamilyById,
  // trombi
  getReferentInfo,
};
