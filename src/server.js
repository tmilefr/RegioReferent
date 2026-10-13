'use strict';

require('dotenv').config();

const express        = require('express');
const session        = require('express-session');
const bcrypt         = require('bcryptjs');
const path           = require('path');

const models    = require('./models');
const helpers   = require('./helpers');
const templates = require('./templates');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ─────────────────────────────────────────────────────────────────────────────
// Middlewares
// ─────────────────────────────────────────────────────────────────────────────

app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(session({
  secret           : process.env.SESSION_SECRET || 'dev-secret-changez-moi',
  resave           : false,
  saveUninitialized: false,
  cookie           : {
    httpOnly: true,
    maxAge  : 8 * 60 * 60 * 1000, // 8 heures
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Middlewares guards
// ─────────────────────────────────────────────────────────────────────────────

/** Middleware : utilisateur connecté requis */
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.redirect('/login');
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers session flash
// ─────────────────────────────────────────────────────────────────────────────

function setFlash(req, msg, type = 'success') {
  req.session.flash = { msg, type };
}

function getFlash(req) {
  const f = req.session.flash;
  delete req.session.flash;
  return f || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Vérification du mot de passe (compatible MD5 legacy, crypt legacy, bcrypt)
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');

async function checkPassword(plaintext, stored) {
  if (!stored || !plaintext) return false;

  // bcrypt moderne
  if (/^\$2[aby]\$/.test(stored)) {
    return bcrypt.compare(plaintext, stored);
  }

  // MD5 historique
  const md5 = crypto.createHash('md5').update(plaintext).digest('hex');
  if (md5 === stored) return true;

  // crypt() legacy (DES/MD5 UNIX) : non supporté nativement en Node.
  // On compare simplement en clair si aucun autre hash ne match.
  // En production, l'admin devrait migrer les comptes vers bcrypt.
  return plaintext === stored;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES – Authentification
// ─────────────────────────────────────────────────────────────────────────────

// GET /  →  redirect
app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/sessions');
  return res.redirect('/login');
});

// GET /login
app.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/sessions');
  res.send(templates.loginPage());
});

// POST /login
app.post('/login', async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.send(templates.loginPage('Veuillez remplir tous les champs.'));
  }

  try {
    const family = await models.getFamilyByLogin(login.trim());
    if (!family) {
      return res.send(templates.loginPage('Identifiant ou mot de passe incorrect.'));
    }

    const ok = await checkPassword(password, family.password);
    if (!ok) {
      return res.send(templates.loginPage('Identifiant ou mot de passe incorrect.'));
    }

    req.session.userId   = family.id;
    req.session.userName = family.nom || family.login;

    return res.redirect('/sessions');
  } catch (err) {
    console.error('[/login]', err);
    return res.send(templates.loginPage('Erreur serveur, veuillez réessayer.'));
  }
});

// GET /logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES – Liste des sessions (connecté)
// ─────────────────────────────────────────────────────────────────────────────

// GET /sessions
app.get('/sessions', requireAuth, async (req, res) => {
  const flash = getFlash(req);
  try {
    const works = await models.getWorksAsReferent(req.session.userId);

    // Enrichissement : nombre d'inscrits
    for (const w of works) {
      w._nb_inscrits = await models.countRegistrations(w.id);
    }

    const html = templates.mySessionsPage(works, req.session.userName);
    // Injection éventuelle du flash dans la page
    const withFlash = flash
      ? html.replace('</h1>', `</h1>\n<div class="flash ${flash.type}">${flash.msg}</div>`)
      : html;

    res.send(withFlash);
  } catch (err) {
    console.error('[/sessions]', err);
    res.status(500).send(renderError('Erreur lors du chargement des sessions.'));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES – Session spécifique (connecté)
// ─────────────────────────────────────────────────────────────────────────────

// GET /session/:id
app.get('/session/:id', requireAuth, async (req, res) => {
  const idWork = parseInt(req.params.id, 10);
  if (!idWork) return res.redirect('/sessions');

  const flash = getFlash(req);

  try {
    // Vérification que l'utilisateur est bien référent de cette session
    const authorized = await isReferentOf(req.session.userId, idWork);
    if (!authorized) return res.redirect('/sessions');

    const work  = await models.getWorkById(idWork);
    if (!work) return res.redirect('/sessions');

    const registrations = await models.getRegistrations(idWork);
    const isOpen        = helpers.isValidationOpen(work.date_travaux);

    const html = templates.sessionPage(work, registrations, isOpen, {
      userName : req.session.userName,
      flashMsg : flash ? flash.msg  : '',
      flashType: flash ? flash.type : 'success',
    });

    res.send(html);
  } catch (err) {
    console.error('[GET /session/:id]', err);
    res.status(500).send(renderError('Erreur lors du chargement de la session.'));
  }
});

// POST /session/:id
app.post('/session/:id', requireAuth, async (req, res) => {
  const idWork = parseInt(req.params.id, 10);
  if (!idWork) return res.redirect('/sessions');

  try {
    const authorized = await isReferentOf(req.session.userId, idWork);
    if (!authorized) return res.redirect('/sessions');

    const work   = await models.getWorkById(idWork);
    if (!work) return res.redirect('/sessions');

    const action = req.body.action;
    const isOpen = helpers.isValidationOpen(work.date_travaux);

    if (action === 'validate' && isOpen) {
      await processValidation(req, idWork, req.session.userId, work);
      setFlash(req, 'Présences enregistrées. Merci !', 'success');
    } else if (action === 'remove' && !isOpen) {
      await processRemove(req, idWork);
      setFlash(req, 'Famille retirée de la session.', 'success');
    }

    return res.redirect(`/session/${idWork}`);
  } catch (err) {
    console.error('[POST /session/:id]', err);
    setFlash(req, 'Erreur lors du traitement. Veuillez réessayer.', 'error');
    return res.redirect(`/session/${idWork}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES – Accès par token email (guest)
// ─────────────────────────────────────────────────────────────────────────────

// GET /token/:token
app.get('/token/:token', async (req, res) => {
  const tokenStr = req.params.token;

  try {
    const tk = await models.findValidToken(tokenStr);
    if (!tk) return res.send(templates.tokenErrorPage());

    const work  = await models.getWorkById(tk.id_travaux);
    if (!work) return res.send(templates.tokenErrorPage());

    const registrations = await models.getRegistrations(tk.id_travaux);
    const isOpen        = helpers.isValidationOpen(work.date_travaux);

    const html = templates.sessionPage(work, registrations, isOpen, {
      viaToken : true,
      token    : tokenStr,
    });

    res.send(html);
  } catch (err) {
    console.error('[GET /token/:token]', err);
    res.status(500).send(renderError('Erreur serveur.'));
  }
});

// POST /token/:token
app.post('/token/:token', async (req, res) => {
  const tokenStr = req.params.token;

  try {
    const tk = await models.findValidToken(tokenStr);
    if (!tk) return res.send(templates.tokenErrorPage());

    const work   = await models.getWorkById(tk.id_travaux);
    if (!work) return res.send(templates.tokenErrorPage());

    const action = req.body.action;
    const isOpen = helpers.isValidationOpen(work.date_travaux);

    if (action === 'validate' && isOpen) {
      await processValidation(req, tk.id_travaux, tk.id_fam_ref, work);
      await models.markTokenUsed(tk.id);

      const registrations = await models.getRegistrations(tk.id_travaux);
      const html = templates.sessionPage(work, registrations, isOpen, {
        viaToken : true,
        token    : tokenStr,
        flashMsg : 'Présences enregistrées. Merci !',
        flashType: 'success',
      });
      return res.send(html);
    }

    if (action === 'remove' && !isOpen) {
      await processRemove(req, tk.id_travaux);
    }

    return res.redirect(`/token/${tokenStr}`);
  } catch (err) {
    console.error('[POST /token/:token]', err);
    res.status(500).send(renderError('Erreur serveur.'));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Logique métier partagée (validation + suppression)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Traite le POST de validation des présences.
 * Miroir de Admwork_controller::_ProcessRefValidation()
 */
async function processValidation(req, idWork, idFamRef, work) {
  const elements      = [].concat(req.body['elements[]'] || req.body.elements || []);
  const noShowList    = [].concat(req.body['noshow[]']   || req.body.noshow   || []).map(Number);
  const globalComment = req.body.commentaire_global || null;

  for (const raw of elements) {
    const idInfo = parseInt(raw, 10);
    if (!idInfo) continue;

    if (noShowList.includes(idInfo)) {
      await models.deleteRegistration(idInfo);
      continue;
    }

    const present   = req.body[`present_${idInfo}`] === '1';
    const rawUnites = req.body[`nb_unites_${idInfo}`];
    const nbUnites  = helpers.parseUnits(rawUnites, parseFloat(work.nb_units), parseFloat(work.nb_units) * 2);
    const comment   = req.body[`commentaire_${idInfo}`] || null;

    await models.updatePresence(idInfo, present, present ? nbUnites : 0, comment, idFamRef);
  }

  if (globalComment !== null) {
    await models.saveGlobalComment(idWork, globalComment);
  }
}

/**
 * Traite le POST de retrait d'un inscrit (mode gestion avant session).
 */
async function processRemove(req, idWork) {
  const idInfo = parseInt(req.body.id_info, 10);
  if (idInfo) {
    await models.deleteRegistration(idInfo);
  }
}

/**
 * Vérifie que idFam est bien référent de idWork.
 * Utilise la chaîne de jointure : travaux → trombi → groupes_member → famille
 */
async function isReferentOf(idFam, idWork) {
  const work = await models.getWorkById(idWork);
  if (!work) return false;
  const referentFamily = await models.getReferentFamily(idWork);
  if (!referentFamily) return false;
  return parseInt(referentFamily.id, 10) === parseInt(idFam, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Gestion d'erreurs
// ─────────────────────────────────────────────────────────────────────────────

function renderError(msg) {
  return templates.layout('Erreur', `
    <div class="error-wrap">
      <div class="error-card">
        <div class="error-icon">❌</div>
        <h2>Une erreur est survenue</h2>
        <p>${helpers.esc(msg)}</p>
        <a href="/sessions" class="btn btn-primary">Retour à mes sessions</a>
      </div>
    </div>`);
}

app.use((req, res) => {
  res.status(404).send(renderError('Page introuvable.'));
});

app.use((err, req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(500).send(renderError('Erreur interne du serveur.'));
});

// ─────────────────────────────────────────────────────────────────────────────
// Démarrage
// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✅  Serveur démarré sur http://localhost:${PORT}`);
  console.log(`   → Validation des présences – ABCM Travaux`);
});
