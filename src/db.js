'use strict';

const mysql = require('mysql2/promise');

let pool = null;

/**
 * Retourne le pool de connexions (singleton).
 * Crée le pool à la première utilisation.
 */
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host     : process.env.DB_HOST     || 'localhost',
      port     : parseInt(process.env.DB_PORT || '3306', 10),
      user     : process.env.DB_USER     || 'root',
      password : process.env.DB_PASS     || '',
      database : process.env.DB_NAME     || 'site_travaux',
      waitForConnections : true,
      connectionLimit    : 10,
      queueLimit         : 0,
      timezone           : '+00:00',
      charset            : 'utf8mb4',
    });
  }
  return pool;
}

/**
 * Exécute une requête SQL paramétrée et retourne [rows, fields].
 * @param {string} sql
 * @param {Array}  params
 */
async function query(sql, params = []) {
  const db = getPool();
  return db.execute(sql, params);
}

module.exports = { query };
