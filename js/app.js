'use strict';
(function () {
  const KEY = 'miregistro.v1';
  const MAX = 999999;
  const TYPES = { faltante: 'Faltante', sobrante: 'Sobrante', cruce: 'Cruce' };
  const $ = id => document.getElementById(id);

  const state = { items: [], filter: 'pendiente', q: '' };
  let storageOk = true;

  /* ---------- utilidades ---------- */
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const fmtDate = iso => { try { return new Date(iso).toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  const fmtDay = iso => { try { return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };
  const fmtNum = iso => { try { return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (e) { return ''; } };
  const dayKey = iso => new Date(iso).toLocaleDateString('en-CA');
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const parseQty = (v, min) => {
    const t = String(v).trim();
    if (!/^\d+$/.test(t)) return null;
    const n = parseInt(t, 10);
    return (n >= min && n <= MAX) ? n : null;
  };
  let toastTimer;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------- almacenamiento ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      state.items = sanitizeList(data.items || data);
    } catch (e) {
      try { localStorage.setItem(KEY + '.corrupto', localStorage.getItem(KEY)); } catch (_) {}
      toast('Los datos guardados estaban dañados. Se conservó una copia aparte.');
    }
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, items: state.items }));
      storageOk = true; return true;
    } catch (e) {
      storageOk = false;
      toast('⚠️ No se pudo guardar. Haz una copia de seguridad ya.');
      return false;
    }
  }
  function sanitizeHistory(h, created, pending) {
    const out = [];
    if (Array.isArray(h)) for (const e of h) {
      if (!e || isNaN(Date.parse(e.d))) continue;
      const q = parseQty(e.q, 0); if (q === null) continue;
      out.push({ d: new Date(e.d).toISOString(), q });
    }
    out.sort((a, b) => Date.parse(a.d) - Date.parse(b.d));
    if (!out.length) out.push({ d: created, q: pending });
    return out.slice(-400);
  }
  function sanitizeList(arr) {
    if (!Array.isArray(arr)) throw new Error('formato');
    const seen = new Set(), out = [];
    for (const r of arr) {
      if (!r || typeof r !== 'object') continue;
      const name = String(r.name || '').trim().slice(0, 120);
      const initial = parseQty(r.initial, 0), pending = parseQty(r.pending, 0);
      if (!name || initial === null || pending === null) continue;
      let id = String(r.id || uid()); if (seen.has(id)) id = uid(); seen.add(id);
      const created = isNaN(Date.parse(r.createdAt)) ? new Date().toISOString() : r.createdAt;
      out.push({
        id, name, type: TYPES[r.type] ? r.type : 'faltante', initial, pending,
        notes: String(r.notes || '').slice(0, 500),
        status: pending === 0 ? 'resuelto' : 'pendiente',
        createdAt: created,
        updatedAt: isNaN(Date.parse(r.updatedAt)) ? created : r.updatedAt,
        resolvedAt: pending === 0 ? (isNaN(Date.parse(r.resolvedAt)) ? created : r.resolvedAt) : null,
        history: sanitizeHistory(r.history, created, pending)
      });
    }
    return out;
  }
  function record(it, hist) {
    const now = new Date().toISOString(); it.updatedAt = now;
    if (hist === false) return;
    const last = it.history[it.history.length - 1];
    if (last && dayKey(last.d) === dayKey(now)) { last.d = now; last.q = it.pending; }
    else it.history.push({ d: now, q: it.pending });
    if (it.history.length > 400) it.history = it.history.slice(-400);
  }
  function applyStatus(it) {
    if (it.pending === 0) { if (it.status !== 'resuelto') { it.status = 'resuelto'; it.resolvedAt = new Date().toISOString(); } }
    else { it.status = 'pendiente'; it.resolvedAt = null; }
  }

  /* ---------- render ---------- */
  function visible() {
    const q = norm(state.q.trim()), f = state.filter;
    return state.items.filter(it => {
      if (f === 'pendiente' && it.status !== 'pendiente') return false;
      if (f === 'resuelto' && it.status !== 'resuelto') return false;
      if (TYPES[f] && it.type !== f) return false;
      if (q && !(norm(it.name).includes(q) || norm(it.notes).includes(q))) return false;
      return true;
    }).sort((a, b) => {
      if (a.status !== b.status) return a.status === 'pendiente' ? -1 : 1;
      const da = a.status === 'resuelto' ? a.resolvedAt : a.createdAt, db = b.status === 'resuelto' ? b.resolvedAt : b.createdAt;
      return Date.parse(db) - Date.parse(da);
    });
  }
  const openHist = new Set();
  const CHIPS = { pendiente: 'Pendientes', todos: 'Todos', resuelto: 'Resueltos', faltante: 'Faltantes', sobrante: 'Sobrantes', cruce: 'Cruces' };
  function histHtml(it) {
    const h = it.history.slice().reverse();
    return '<ul class="hist">' + h.map((e, i) => {
      const prev = h[i + 1], dl = prev ? e.q - prev.q : 0;
      return `<li><span class="hd">${esc(fmtDay(e.d))}</span><span class="hq">${e.q}</span>` +
        (dl ? `<span class="hdl ${dl < 0 ? 'down' : 'up'}">${dl > 0 ? '+' : ''}${dl}</span>` : '<span class="hdl"></span>') + '</li>';
    }).join('') + '</ul>';
  }
  function render() {
    const pend = state.items.filter(i => i.status === 'pendiente');
    $('sPend').textContent = pend.length;
    $('sUnits').textContent = pend.reduce((s, i) => s + i.pending, 0);
    $('sDone').textContent = state.items.length - pend.length;
    const counts = { pendiente: pend.length, todos: state.items.length, resuelto: state.items.length - pend.length };
    Object.keys(TYPES).forEach(t => counts[t] = state.items.filter(i => i.type === t).length);
    document.querySelectorAll('#chips button').forEach(b => {
      const f = b.dataset.f; b.classList.toggle('on', f === state.filter);
      b.innerHTML = CHIPS[f] + ' <i>' + counts[f] + '</i>';
    });
    const list = visible();
    if (!list.length) {
      let msg = 'No hay registros que mostrar.';
      if (!state.items.length) msg = '<b>Aún no tienes registros</b>Pulsa «＋ Nuevo registro» para empezar.';
      else if (state.q) msg = '<b>Sin resultados</b>Prueba con otra palabra.';
      else if (state.filter === 'pendiente') msg = '<b>¡Todo al día!</b>No tienes pendientes.';
      $('list').innerHTML = '<div class="empty"><div class="ico">📋</div>' + msg + '</div>'; return;
    }
    $('list').innerHTML = list.map(it => {
      const done = it.status === 'resuelto', open = openHist.has(it.id);
      const controls = done
        ? `<div class="resolved-box"><span class="ok-dot">✓</span><span>Resuelto el ${esc(fmtDay(it.resolvedAt))}</span></div>`
        : `<div class="qty-row">
             <button class="step" data-act="dec" aria-label="Restar una unidad" ${it.pending <= 0 ? 'disabled' : ''}>−</button>
             <button class="qty" data-act="setqty" aria-label="Cambiar cantidad pendiente"><b>${it.pending}</b><small>pendientes de ${it.initial}</small></button>
             <button class="step plus" data-act="inc" aria-label="Sumar una unidad" ${it.pending >= MAX ? 'disabled' : ''}>＋</button>
           </div>`;
      return `<article class="card t-${it.type}${done ? ' done' : ''}" data-id="${esc(it.id)}">
        <div class="row1"><span class="tag">${TYPES[it.type]}</span><span class="date">Registrado ${esc(fmtDay(it.createdAt))}</span></div>
        <h3>${esc(it.name)}</h3>${it.notes ? `<p class="notes">${esc(it.notes)}</p>` : ''}
        ${controls}
        <div class="meta">Última modificación: ${esc(fmtDate(it.updatedAt))}</div>
        ${open ? histHtml(it) : ''}
        <div class="actions">${done ? '<button class="reopen" data-act="reopen">Reabrir</button>' : ''}
          <button data-act="hist">${open ? 'Ocultar historial' : 'Historial'}</button>
          <button data-act="edit">Editar</button><button class="danger" data-act="del">Eliminar</button></div>
      </article>`;
    }).join('');
  }
  function commit() { save(); render(); }

  /* ---------- acciones sobre registros ---------- */
  const find = id => state.items.find(i => i.id === id);
  function adjust(it, delta) {
    const n = Math.min(MAX, Math.max(0, it.pending + delta));
    if (n === it.pending) return;
    it.pending = n; applyStatus(it); record(it); commit();
    if (n === 0) toast('✓ Resuelto. Pasó al historial.');
  }

  /* ---------- diálogos ---------- */
  const openD = d => { if (!d.open) d.showModal(); };
  const closeD = d => { if (d.open) d.close(); };
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

  let confirmCb = null;
  function ask(title, text, yesLabel, cb) {
    $('cTitle').textContent = title; $('cText').textContent = text; $('cYes').textContent = yesLabel; confirmCb = cb; openD($('confirmDlg'));
  }
  $('cNo').onclick = () => { confirmCb = null; closeD($('confirmDlg')); };
  $('cYes').onclick = () => { const cb = confirmCb; confirmCb = null; closeD($('confirmDlg')); if (cb) cb(); };

  /* formulario */
  let editId = null, formType = 'faltante', pendTouched = false, saving = false;
  function setType(t) { formType = t; document.querySelectorAll('#fType button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); }
  document.querySelectorAll('#fType button').forEach(b => b.onclick = () => setType(b.dataset.t));
  $('fInit').addEventListener('input', () => { if (!editId && !pendTouched) $('fPend').value = $('fInit').value; });
  $('fPend').addEventListener('input', () => { pendTouched = true; });

  function openForm(it) {
    editId = it ? it.id : null; pendTouched = !!it; saving = false; $('fSave').disabled = false; $('fErr').textContent = '';
    $('formTitle').textContent = it ? 'Editar registro' : 'Nuevo registro';
    $('fName').value = it ? it.name : ''; setType(it ? it.type : 'faltante');
    $('fInit').value = it ? it.initial : ''; $('fPend').value = it ? it.pending : ''; $('fNotes').value = it ? it.notes : '';
    openD($('formDlg')); if (!it) setTimeout(() => $('fName').focus(), 80);
  }
  $('addBtn').onclick = () => openForm(null);
  $('fCancel').onclick = () => closeD($('formDlg'));
  $('form').addEventListener('submit', e => {
    e.preventDefault(); if (saving) return;
    const name = $('fName').value.trim();
    const initial = parseQty($('fInit').value, 1);
    const pRaw = $('fPend').value.trim();
    const pending = pRaw === '' ? initial : parseQty(pRaw, 0);
    if (!name) return ($('fErr').textContent = 'Escribe el nombre del producto.');
    if (initial === null) return ($('fErr').textContent = 'La cantidad inicial debe ser un número entero de 1 en adelante.');
    if (pending === null) return ($('fErr').textContent = 'La cantidad pendiente debe ser un número entero, 0 o más.');
    saving = true; $('fSave').disabled = true;
    const notes = $('fNotes').value.trim();
    if (editId) {
      const it = find(editId);
      if (it) { const old = it.pending; Object.assign(it, { name, type: formType, initial, pending, notes }); applyStatus(it); record(it, old !== pending); }
    } else {
      const nowIso = new Date().toISOString();
      const it = { id: uid(), name, type: formType, initial, pending, notes, status: 'pendiente', createdAt: nowIso, updatedAt: nowIso, resolvedAt: null, history: [{ d: nowIso, q: pending }] };
      applyStatus(it); state.items.push(it);
    }
    closeD($('formDlg')); commit(); toast(editId ? 'Registro actualizado' : 'Registro guardado');
  });

  /* cantidad manual */
  let qtyId = null;
  $('qtyCancel').onclick = () => closeD($('qtyDlg'));
  $('qtyForm').addEventListener('submit', e => {
    e.preventDefault();
    const n = parseQty($('qtyInput').value, 0), it = find(qtyId);
    if (n === null) return ($('qtyErr').textContent = 'Escribe un número entero de 0 en adelante.');
    if (it) { const old = it.pending; it.pending = n; applyStatus(it); record(it, old !== n); commit(); if (n === 0) toast('✓ Resuelto. Pasó al historial.'); }
    closeD($('qtyDlg'));
  });

  /* lista: delegación de eventos */
  $('list').addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]'); if (!btn) return;
    const card = btn.closest('.card'), it = card && find(card.dataset.id); if (!it) return;
    switch (btn.dataset.act) {
      case 'dec': adjust(it, -1); break;
      case 'inc': adjust(it, 1); break;
      case 'setqty': qtyId = it.id; $('qtyName').textContent = it.name; $('qtyErr').textContent = ''; $('qtyInput').value = it.pending; openD($('qtyDlg')); setTimeout(() => $('qtyInput').select(), 80); break;
      case 'edit': openForm(it); break;
      case 'hist': if (openHist.has(it.id)) openHist.delete(it.id); else openHist.add(it.id); render(); break;
      case 'reopen': it.pending = Math.max(1, it.pending); applyStatus(it); record(it); commit(); toast('Registro reabierto: ajusta la cantidad pendiente'); break;
      case 'del': ask('¿Eliminar registro?', `«${it.name}» se borrará definitivamente. Esta acción no se puede deshacer.`, 'Eliminar', () => {
        state.items = state.items.filter(x => x.id !== it.id); commit(); toast('Registro eliminado'); }); break;
    }
  });

  /* búsqueda y filtros */
  $('q').addEventListener('input', e => { state.q = e.target.value; render(); });
  $('chips').addEventListener('click', e => { const b = e.target.closest('button[data-f]'); if (b) { state.filter = b.dataset.f; render(); } });

  /* ---------- exportar / respaldo ---------- */
  function download(name, text, mime) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1500);
  }
  const stamp = () => new Date().toISOString().slice(0, 10);
  const csvCell = v => { let s = String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  $('menuBtn').onclick = () => {
    $('mInfo').textContent = 'Tus datos se guardan solo en este teléfono (en el navegador). No se sincronizan con otros dispositivos: usa la copia de seguridad para pasarlos o protegerlos. Registros guardados: ' + state.items.length + '.';
    openD($('menuDlg'));
  };
  $('mClose').onclick = () => closeD($('menuDlg'));
  $('mCsv').onclick = () => {
    if (!state.items.length) return toast('No hay registros para exportar');
    const head = ['Producto', 'Tipo', 'Cantidad inicial', 'Cantidad pendiente', 'Estado', 'Fecha de registro', 'Última modificación', 'Fecha de resolución', 'Historial de cantidades pendientes', 'Observaciones'];
    const rows = state.items.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map(i =>
      [i.name, TYPES[i.type], i.initial, i.pending, i.status === 'resuelto' ? 'Resuelto' : 'Pendiente', fmtDate(i.createdAt), fmtDate(i.updatedAt), i.resolvedAt ? fmtDate(i.resolvedAt) : '',
       i.history.map(h => fmtNum(h.d) + ': ' + h.q).join(' | '), i.notes]);
    const csv = '\uFEFF' + [head].concat(rows).map(r => r.map(csvCell).join(';')).join('\r\n');
    download('mi-registro-' + stamp() + '.csv', csv, 'text/csv;charset=utf-8'); closeD($('menuDlg')); toast('CSV exportado');
  };
  $('mBackup').onclick = () => {
    const data = { app: 'mi-registro', version: 2, exportedAt: new Date().toISOString(), items: state.items };
    download('mi-registro-respaldo-' + stamp() + '.json', JSON.stringify(data, null, 2), 'application/json'); closeD($('menuDlg')); toast('Copia de seguridad creada');
  };
  $('mRestore').onclick = () => $('fileIn').click();
  $('fileIn').addEventListener('change', e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const r = new FileReader();
    r.onerror = () => toast('No se pudo leer el archivo');
    r.onload = () => {
      let items;
      try {
        const d = JSON.parse(r.result);
        if (d && d.app && d.app !== 'mi-registro') throw new Error('otro');
        items = sanitizeList(d.items || d);
      } catch (err) { return toast('El archivo no es una copia válida de Mi Registro'); }
      closeD($('menuDlg'));
      ask('¿Restaurar copia?', `Se reemplazarán los ${state.items.length} registros actuales por los ${items.length} de la copia. Si quieres conservar los actuales, crea antes una copia de seguridad.`, 'Restaurar', () => {
        state.items = items; commit(); toast('Copia restaurada');
      });
    };
    r.readAsText(f);
  });

  /* ---------- instalación y service worker ---------- */
  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('mInstall').hidden = false; });
  window.addEventListener('appinstalled', () => { deferred = null; $('mInstall').hidden = true; toast('Aplicación instalada'); });
  $('mInstall').onclick = async () => { if (!deferred) return; closeD($('menuDlg')); deferred.prompt(); await deferred.userChoice; deferred = null; $('mInstall').hidden = true; };
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  /* ---------- inicio ---------- */
  load(); render();
})();
