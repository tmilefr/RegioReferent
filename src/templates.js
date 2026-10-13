'use strict';

/**
 * templates.js
 * ────────────
 * Génération HTML côté serveur sans moteur de templates externe.
 * Toutes les fonctions retournent une chaîne HTML complète ou un fragment.
 */

const { esc, formatDateFr, daysUntil, labelTypeParticipant } = require('./helpers');

// ─────────────────────────────────────────────────────────────────────────────
// Layout principal
// ─────────────────────────────────────────────────────────────────────────────

function layout(title, content, options = {}) {
  const { userName = '', flashMsg = '', backUrl = null } = options;

  const nav = userName
    ? `<div class="nav-user">
         <span class="nav-icon">👤</span>
         <span>${esc(userName)}</span>
         <a href="/logout" class="btn-link">Se déconnecter</a>
       </div>`
    : '';

  const flash = flashMsg
    ? `<div class="flash ${options.flashType || 'success'}">${flashMsg}</div>`
    : '';

  const back = backUrl
    ? `<a href="${esc(backUrl)}" class="btn btn-ghost back-link">← Mes sessions</a>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} – ABCM Travaux</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&family=Raleway:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <header class="app-header">
    <div class="topbar">
      <div class="header-inner">
        <span class="topbar-title">ABCM Travaux</span>
        ${nav}
      </div>
    </div>
    <div class="gradient-band"></div>
    <div class="brandbar">
      <div class="header-inner">
        <a href="/" class="logo">
          <img src="/regio.png" alt="ABCM Zweisprachigkeit" class="logo-img">
          <div>
            <span class="logo-title">Validation des présences</span>
            <span class="logo-sub">Espace référent</span>
          </div>
        </a>
      </div>
    </div>
  </header>

  <main class="app-main">
    <div class="container">
      ${back}
      ${flash}
      ${content}
    </div>
  </main>

  <footer class="app-footer">
    <p>ABCM – Gestion des sessions de travaux</p>
  </footer>
  <script src="/app.js"></script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page de connexion
// ─────────────────────────────────────────────────────────────────────────────

function loginPage(error = '') {
  const errorHtml = error
    ? `<div class="alert alert-error">${esc(error)}</div>`
    : '';

  const content = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-header">
          <div class="login-icon">🔑</div>
          <h1>Espace référent</h1>
          <p>Connectez-vous pour accéder à vos sessions à valider.</p>
        </div>
        ${errorHtml}
        <form method="POST" action="/login" class="login-form">
          <div class="form-group">
            <label for="login">Identifiant</label>
            <input type="text" id="login" name="login" required autofocus
                   placeholder="Votre identifiant famille" class="form-control">
          </div>
          <div class="form-group">
            <label for="password">Mot de passe</label>
            <input type="password" id="password" name="password" required
                   placeholder="••••••••" class="form-control">
          </div>
          <button type="submit" class="btn btn-primary btn-full">Se connecter</button>
        </form>
      </div>
    </div>`;

  return layout('Connexion', content);
}

// ─────────────────────────────────────────────────────────────────────────────
// Erreur token
// ─────────────────────────────────────────────────────────────────────────────

function tokenErrorPage() {
  const content = `
    <div class="error-wrap">
      <div class="error-card">
        <div class="error-icon">⚠️</div>
        <h2>Lien invalide ou expiré</h2>
        <p>Ce lien de validation n'est plus valide. Il a peut-être expiré (durée de 30 jours après la session) ou il est incorrect.</p>
        <p>Vous pouvez vous connecter à votre espace pour retrouver vos sessions à valider, ou contacter le bureau.</p>
        <a href="/login" class="btn btn-primary">Se connecter</a>
      </div>
    </div>`;
  return layout('Lien invalide', content);
}

// ─────────────────────────────────────────────────────────────────────────────
// Liste "Mes sessions"
// ─────────────────────────────────────────────────────────────────────────────

function mySessionsPage(works, userName) {
  if (!works.length) {
    const content = `
      <h1 class="page-title">Mes sessions à animer</h1>
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>Vous n'êtes référent d'aucune session pour le moment.</p>
      </div>`;
    return layout('Mes sessions', content, { userName, backUrl: null });
  }

  const cards = works.map(w => {
    const open = require('./helpers').isValidationOpen(w.date_travaux);
    const days = daysUntil(w.date_travaux);

    let statusBadge, actionBtn;
    if (open) {
      statusBadge = `<span class="badge badge-validate">Validation ouverte</span>`;
      actionBtn   = `<a href="/session/${w.id}" class="btn btn-primary btn-sm">Valider les présences</a>`;
    } else if (days === 1) {
      statusBadge = `<span class="badge badge-soon">Demain</span>`;
      actionBtn   = `<a href="/session/${w.id}" class="btn btn-secondary btn-sm">Voir les inscrits</a>`;
    } else if (days === 0) {
      statusBadge = `<span class="badge badge-today">Aujourd'hui !</span>`;
      actionBtn   = `<a href="/session/${w.id}" class="btn btn-primary btn-sm">Valider les présences</a>`;
    } else {
      statusBadge = `<span class="badge badge-upcoming">Dans ${days} jour${days > 1 ? 's' : ''}</span>`;
      actionBtn   = `<a href="/session/${w.id}" class="btn btn-secondary btn-sm">Gérer les inscrits</a>`;
    }

    return `
      <article class="session-card ${open ? 'session-card--open' : ''}">
        <div class="session-card-body">
          <div class="session-date">${formatDateFr(w.date_travaux)}</div>
          <h3 class="session-title">${esc(w.titre)}</h3>
          <div class="session-meta">
            <span>🕐 ${esc(w.heure_deb_trav || '')} – ${esc(w.heure_fin_trav || '')}</span>
            <span>🏷️ ${esc(w.type || '')} · ${w.nb_units} unité${w.nb_units > 1 ? 's' : ''}</span>
            <span>👥 max ${w.nb_inscrits_max || '—'}</span>
          </div>
        </div>
        <div class="session-card-footer">
          ${statusBadge}
          ${actionBtn}
        </div>
      </article>`;
  }).join('');

  const content = `
    <div class="page-header">
      <h1 class="page-title">Mes sessions à animer</h1>
      <p class="page-sub">Retrouvez ici les sessions où vous êtes référent&nbsp;: gérez les inscrits avant la session, validez les présences le jour&nbsp;J.</p>
    </div>
    <div class="sessions-list">${cards}</div>`;

  return layout('Mes sessions', content, { userName });
}

// ─────────────────────────────────────────────────────────────────────────────
// Page de validation / aperçu d'une session
// ─────────────────────────────────────────────────────────────────────────────

function sessionPage(work, registrations, isOpen, options = {}) {
  const { userName = '', flashMsg = '', flashType = 'success', viaToken = false, token = null } = options;

  const formAction = viaToken ? `/token/${token}` : `/session/${work.id}`;
  const days = daysUntil(work.date_travaux);

  // ── Bandeau d'information ──
  let infoBanner;
  if (!isOpen) {
    let dayMsg;
    if (days === 1)       dayMsg = 'Elle aura lieu demain.';
    else if (days === 0)  dayMsg = 'Elle a lieu aujourd\'hui !';
    else                  dayMsg = `Elle aura lieu dans <strong>${days}</strong> jours.`;

    infoBanner = `
      <div class="alert alert-info">
        <strong>Vous êtes référent de cette session.</strong> ${dayMsg}<br>
        Vous pouvez ajouter ou retirer des parents inscrits jusqu'à la veille de la session. Le jour J, ce même lien vous permettra de valider les présences réelles.
      </div>`;
  } else {
    infoBanner = `
      <div class="alert alert-validate">
        <strong>Validation des présences</strong><br>
        En tant que référent de cette session, merci de valider la présence des parents inscrits. Cochez les parents présents, ajustez le nombre d'unités effectives si besoin, ajoutez un commentaire, et signalez les absences non excusées.
      </div>`;
  }

  // ── Tableau des inscrits ──
  const tableRows = registrations.map(r => {
    const alreadyValid  = parseFloat(r.nb_unites_valides) > 0;
    const defaultUnits  = alreadyValid ? r.nb_unites_valides : (parseFloat(work.nb_units) * (r.nb_participants || 1));
    const checked       = alreadyValid ? 'checked' : '';
    const disabledClass = alreadyValid ? ' row--validated' : '';

    if (isOpen) {
      return `
        <tr class="inscrit-row${disabledClass}" data-id="${r.id}">
          <td class="col-check">
            <input type="hidden" name="elements[]" value="${r.id}">
            <label class="checkbox-wrap">
              <input type="checkbox"
                     name="present_${r.id}"
                     value="1"
                     class="presence-check"
                     data-id="${r.id}"
                     ${checked}>
              <span class="checkmark"></span>
            </label>
          </td>
          <td class="col-family">
            <span class="family-name">${esc(r.family_nom || '—')}</span>
            <span class="participant-type">${labelTypeParticipant(r.type_participant)}</span>
          </td>
          <td class="col-units">
            <input type="number"
                   step="0.5" min="0" max="${parseFloat(work.nb_units) * 2}"
                   name="nb_unites_${r.id}"
                   value="${defaultUnits}"
                   class="unit-input form-control-sm"
                   data-id="${r.id}">
          </td>
          <td class="col-comment">
            <input type="text"
                   name="commentaire_${r.id}"
                   value="${esc(r.commentaire_ref || '')}"
                   placeholder="ex: en retard, reparti plus tôt…"
                   class="form-control-sm comment-input">
          </td>
          <td class="col-noshow">
            <label class="noshow-wrap" title="Désinscrire (no-show)">
              <input type="checkbox"
                     name="noshow[]"
                     value="${r.id}"
                     class="noshow-check">
              <span class="noshow-label">✕ No-show</span>
            </label>
          </td>
        </tr>`;
    } else {
      // Mode aperçu : lecture seule
      return `
        <tr class="inscrit-row${disabledClass}" data-id="${r.id}">
          <td class="col-family">
            <span class="family-name">${esc(r.family_nom || '—')}</span>
            <span class="participant-type">${labelTypeParticipant(r.type_participant)}</span>
          </td>
          <td class="col-units">${defaultUnits} u.</td>
          <td class="col-actions">
            <form method="POST" action="${formAction}" style="display:inline">
              <input type="hidden" name="action" value="remove">
              <input type="hidden" name="id_info" value="${r.id}">
              <button type="button"
                      class="btn btn-danger btn-xs btn-remove"
                      data-confirm="Retirer cette famille de la session ?"
                      data-form="remove-${r.id}">
                Retirer
              </button>
            </form>
          </td>
        </tr>`;
    }
  }).join('');

  const emptyMsg = registrations.length === 0
    ? `<tr><td colspan="5" class="empty-td">Aucun inscrit pour le moment.</td></tr>`
    : '';

  const thead = isOpen
    ? `<tr>
         <th class="col-check">Présent</th>
         <th>Famille</th>
         <th>Unités</th>
         <th>Commentaire</th>
         <th>No-show</th>
       </tr>`
    : `<tr>
         <th>Famille</th>
         <th>Unités prévues</th>
         <th>Action</th>
       </tr>`;

  // ── Commentaire global ──
  const globalCommentField = isOpen
    ? `<div class="form-group mt-3">
         <label for="commentaire_global">Commentaire général sur la session (optionnel)</label>
         <textarea name="commentaire_global" id="commentaire_global"
                   rows="3" class="form-control"
                   placeholder="Ambiance, points à signaler au bureau…">${esc(work.commentaire_ref || '')}</textarea>
       </div>`
    : '';

  // ── Formulaire de validation ──
  const validateBtn = isOpen && registrations.length > 0
    ? `<div class="form-actions">
         <button type="button" id="btn-validate-confirm" class="btn btn-primary btn-lg">
           ✔ Enregistrer les présences
         </button>
       </div>
       <div id="confirm-overlay" class="confirm-overlay hidden">
         <div class="confirm-box">
           <p>Confirmer l'enregistrement des présences ?</p>
           <button type="submit" name="action" value="validate" class="btn btn-primary">Confirmer</button>
           <button type="button" id="btn-cancel-confirm" class="btn btn-ghost">Annuler</button>
         </div>
       </div>`
    : '';

  // ── Récap session ──
  const recap = `
    <div class="session-recap">
      <div class="recap-date">
        <span class="recap-label">📅</span>
        <span>${formatDateFr(work.date_travaux)}</span>
      </div>
      <div class="recap-horaire">
        <span class="recap-label">🕐</span>
        <span>${esc(work.heure_deb_trav || '')} – ${esc(work.heure_fin_trav || '')}</span>
      </div>
      <div class="recap-type">
        <span class="recap-label">🏷️</span>
        <span>${esc(work.type || '')} · ${work.nb_units} unité${parseFloat(work.nb_units) > 1 ? 's' : ''} / parent</span>
      </div>
      <div class="recap-inscrits">
        <span class="recap-label">👥</span>
        <span>${registrations.length} inscrit${registrations.length > 1 ? 's' : ''} / ${work.nb_inscrits_max || '?'} max</span>
      </div>
    </div>`;

  const flash = flashMsg
    ? `<div class="flash ${flashType}">${flashMsg}</div>`
    : '';

  const content = `
    <div class="page-header">
      <h1 class="page-title">${esc(work.titre)}</h1>
      ${recap}
    </div>

    ${flash}
    ${infoBanner}

    <form method="POST" action="${formAction}" id="validation-form">
      <div class="table-wrap">
        <table class="inscrit-table">
          <thead>${thead}</thead>
          <tbody>
            ${tableRows}
            ${emptyMsg}
          </tbody>
        </table>
      </div>

      ${globalCommentField}
      ${validateBtn}
    </form>`;

  return layout(work.titre, content, {
    userName,
    backUrl: viaToken ? null : '/sessions',
    flashMsg: '',
  });
}

module.exports = { layout, loginPage, tokenErrorPage, mySessionsPage, sessionPage };
