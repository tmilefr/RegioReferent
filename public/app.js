/* app.js – interactions côté client
   ABCM Travaux – Validation des présences
   ─────────────────────────────────────── */

'use strict';

document.addEventListener('DOMContentLoaded', () => {

  // ── Confirmation de validation des présences ─────────────────────────────
  const btnConfirm  = document.getElementById('btn-validate-confirm');
  const btnCancel   = document.getElementById('btn-cancel-confirm');
  const overlay     = document.getElementById('confirm-overlay');
  const form        = document.getElementById('validation-form');

  if (btnConfirm && overlay) {
    btnConfirm.addEventListener('click', () => {
      overlay.classList.remove('hidden');
    });
  }

  if (btnCancel && overlay) {
    btnCancel.addEventListener('click', () => {
      overlay.classList.add('hidden');
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  }

  // ── Interdépendance présence ↔ unités ────────────────────────────────────
  // Si on décoche "présent", les unités passent à 0.
  // Si on coche "no-show", on décoche présent et on désactive la ligne.
  document.querySelectorAll('.presence-check').forEach(chk => {
    const id       = chk.dataset.id;
    const unitInput = document.querySelector(`input[name="nb_unites_${id}"]`);

    chk.addEventListener('change', () => {
      if (unitInput) {
        unitInput.disabled = !chk.checked;
        if (!chk.checked) unitInput.value = '0';
        else if (unitInput.value === '0') unitInput.value = unitInput.dataset.default || '';
      }
      updateRowState(id, chk.checked);
    });

    // État initial
    if (unitInput) {
      unitInput.dataset.default = unitInput.value;
      if (!chk.checked) {
        unitInput.disabled = true;
        unitInput.value    = '0';
      }
    }
  });

  document.querySelectorAll('.noshow-check').forEach(chk => {
    const id = chk.value;
    chk.addEventListener('change', () => {
      const presenceChk = document.querySelector(`input[name="present_${id}"]`);
      const unitInput   = document.querySelector(`input[name="nb_unites_${id}"]`);
      const commentInput = document.querySelector(`input[name="commentaire_${id}"]`);
      const row         = document.querySelector(`tr[data-id="${id}"]`);

      if (chk.checked) {
        if (presenceChk) { presenceChk.checked = false; presenceChk.disabled = true; }
        if (unitInput)   { unitInput.value = '0'; unitInput.disabled = true; }
        if (commentInput) commentInput.disabled = true;
        if (row) row.style.opacity = '.4';
      } else {
        if (presenceChk) presenceChk.disabled = false;
        if (unitInput)   unitInput.disabled   = !presenceChk?.checked;
        if (commentInput) commentInput.disabled = false;
        if (row) row.style.opacity = '';
      }
    });
  });

  function updateRowState(id, isPresent) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;
    if (isPresent) {
      row.style.opacity = '';
    } else {
      const noShowChk = document.querySelector(`input.noshow-check[value="${id}"]`);
      if (!noShowChk?.checked) row.style.opacity = '.6';
    }
  }

  // ── Boutons "Retirer" avec confirmation ───────────────────────────────────
  document.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = btn.dataset.confirm || 'Confirmer cette action ?';
      if (window.confirm(msg)) {
        btn.closest('form').submit();
      }
    });
  });

  // ── Auto-dismiss flash messages ───────────────────────────────────────────
  const flashes = document.querySelectorAll('.flash.success');
  flashes.forEach(el => {
    setTimeout(() => {
      el.style.transition = 'opacity .5s';
      el.style.opacity    = '0';
      setTimeout(() => el.remove(), 500);
    }, 4000);
  });

});
