/**
 * static/js/ui.js
 * UI helpers — sidebar panels, result rendering, modal.
 * Zero game logic — that lives in Python (engine.py).
 */

const UI_MODE = {
  rational:    { tag: 'rational',    tagBg: 'var(--bg-card)',    tagFg: 'var(--ink4)'   },
  cooperative: { tag: 'cooperative', tagBg: 'var(--coop-pale)',  tagFg: 'var(--coop)'   },
  spiteful:    { tag: 'spiteful',    tagBg: 'var(--spite-pale)', tagFg: 'var(--spite)'  },
  'zero-sum':  { tag: 'zero-sum',    tagBg: 'var(--zero-pale)',  tagFg: 'var(--zero)'   },
};

/* ── STRIPE COLOURS ──────────────────────────────── */
const STRIPE_COLORS = ['var(--p1)', 'var(--p2)', 'var(--p3)'];

function initPlayerCards() {
  for (let i = 0; i < 3; i++) {
    document.getElementById(`stripe${i}`).style.background = STRIPE_COLORS[i];
  }
}

/* ── READ PLAYER CONFIGS FROM DOM ────────────────── */
function getCfgs() {
  return [0, 1, 2].map(i => ({
    player:  i,
    mode:    document.getElementById(`mode${i}`).value,
    ally:    parseInt(document.getElementById(`ally${i}`)?.value  ?? -1),
    enemy:   parseInt(document.getElementById(`en${i}`)?.value    ?? -1),
    coop_w:  parseFloat(document.getElementById(`cw${i}`)?.value  ?? 1),
    spite_w: parseFloat(document.getElementById(`sw${i}`)?.value  ?? 1),
  }));
}

/* ── MODE DROPDOWN HANDLER ───────────────────────── */
function onMode(i) {
  const mode = document.getElementById(`mode${i}`).value;
  const mm   = UI_MODE[mode] || UI_MODE.rational;

  const tag = document.getElementById(`tag${i}`);
  tag.textContent      = mm.tag;
  tag.style.background = mm.tagBg;
  tag.style.color      = mm.tagFg;

  const isCoop  = mode === 'cooperative';
  const isSpite = mode === 'spiteful';
  _show(`er-ally${i}`, isCoop);
  _show(`er-cw${i}`,   isCoop);
  _show(`er-en${i}`,   isSpite);
  _show(`er-sw${i}`,   isSpite);

  document.getElementById(`ex${i}`).style.display = (isCoop || isSpite) ? 'flex' : 'none';
}

function _show(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? 'flex' : 'none';
}

/* ── PRESETS ─────────────────────────────────────── */
const PRESETS = {
  rational: [
    { m: 'rational' }, { m: 'rational' }, { m: 'rational' },
  ],
  p1p2coop: [
    { m: 'cooperative', ally: 1, cw: 1.0 },
    { m: 'cooperative', ally: 0, cw: 1.0 },
    { m: 'rational' },
  ],
  p1spite: [
    { m: 'spiteful', en: 1, sw: 1.5 },
    { m: 'rational' },
    { m: 'rational' },
  ],
  zerosum: [
    { m: 'zero-sum' }, { m: 'zero-sum' }, { m: 'zero-sum' },
  ],
  chaos: [
    { m: 'cooperative', ally: 2, cw: 0.8 },
    { m: 'spiteful',    en: 0,  sw: 1.2  },
    { m: 'zero-sum' },
  ],
};

function applyPreset(name) {
  const cfg = PRESETS[name];
  if (!cfg) return;
  cfg.forEach((c, i) => {
    document.getElementById(`mode${i}`).value = c.m;
    if (c.ally !== undefined) { const el = document.getElementById(`ally${i}`); if (el) el.value = c.ally; }
    if (c.en   !== undefined) { const el = document.getElementById(`en${i}`);   if (el) el.value = c.en; }
    if (c.cw   !== undefined) { const el = document.getElementById(`cw${i}`);   if (el) el.value = c.cw; }
    if (c.sw   !== undefined) { const el = document.getElementById(`sw${i}`);   if (el) el.value = c.sw; }
    onMode(i);
  });
}

/* ── NODE CARD ───────────────────────────────────── */
function syncNodeCard(node, pruNodes, depthMap, cfgs) {
  const card = document.getElementById('node-card');
  const ed   = document.getElementById('leaf-ed');

  if (!node) {
    card.innerHTML   = '<span class="empty">— select a node</span>';
    ed.style.display = 'none';
    return;
  }

  const depth  = depthMap[node.id] ?? 0;
  const player = depth % 3;
  const pcol   = `var(${P_CVARS[player]})`;
  const isLeaf = !node.children || !node.children.length;
  const isPru  = pruNodes.has(node.id);
  const cfg    = cfgs[player];
  const mm     = UI_MODE[cfg?.mode] || UI_MODE.rational;

  const valueRow = node.value
    ? `<hr class="nc-div"/>
       <div class="nc-row">
         <span class="nc-key">value</span>
         <span style="font-family:var(--mono);font-size:11px">
           <span style="color:var(${P_CVARS[0]})">${node.value[0]}</span><span style="color:var(--rule2)">,</span><span style="color:var(${P_CVARS[1]})">${node.value[1]}</span><span style="color:var(--rule2)">,</span><span style="color:var(${P_CVARS[2]})">${node.value[2]}</span>
         </span>
       </div>`
    : '';

  const pruRow = isPru
    ? `<div class="nc-row"><span class="nc-key">status</span>
         <span style="color:var(--pruned);font-family:var(--mono);font-size:10px">pruned ✂</span>
       </div>` : '';

  card.innerHTML = `
    <div class="nc-row"><span class="nc-key">node</span><span class="nc-val" style="font-family:var(--mono)">#${node.id}</span></div>
    <div class="nc-row"><span class="nc-key">depth</span><span class="nc-val">${depth}</span></div>
    <div class="nc-row"><span class="nc-key">moves</span>
      <span class="nc-badge" style="background:${pcol}22;color:${pcol};border:1px solid ${pcol}44">${P_NAMES[player]}</span>
    </div>
    <div class="nc-row"><span class="nc-key">strategy</span>
      <span class="nc-badge" style="background:${mm.tagBg};color:${mm.tagFg}">${mm.tag}</span>
    </div>
    <div class="nc-row"><span class="nc-key">children</span><span class="nc-val">${node.children?.length ?? 0}</span></div>
    <div class="nc-row"><span class="nc-key">type</span><span class="nc-val" style="font-style:italic">${isLeaf ? 'leaf' : 'internal'}</span></div>
    ${pruRow}${valueRow}
  `;

  if (isLeaf) {
    ed.style.display = 'flex';
    document.getElementById('v1').value = node.leaf?.[0] ?? 0;
    document.getElementById('v2').value = node.leaf?.[1] ?? 0;
    document.getElementById('v3').value = node.leaf?.[2] ?? 0;
  } else {
    ed.style.display = 'none';
  }
}

/* ── RESULT CARD ─────────────────────────────────── */
function renderResult(data, cfgs, ms) {
  const card  = document.getElementById('result-card');
  const r     = data.root_value;
  const maxV  = Math.max(...r, 1);
  const isAB  = data.algo === 'alphabeta';

  const algoBg = isAB ? 'var(--p1-pale)' : 'var(--p2-pale)';
  const algoFg = isAB ? 'var(--p1)'      : 'var(--p2)';
  const algoLbl = isAB ? '✂ alpha-beta' : '▶ minimax';

  const bars = r.map((v, i) => `
    <div class="score-bar-row">
      <span class="sbar-label" style="color:var(${P_CVARS[i]})">${P_NAMES[i]}</span>
      <div class="sbar-track">
        <div class="sbar-fill" style="width:${Math.max(4, (v / maxV) * 100).toFixed(1)}%;background:var(${P_CVARS[i]})"></div>
      </div>
      <span class="sbar-val" style="color:var(${P_CVARS[i]})">${v}</span>
    </div>`).join('');

  const stratLine = cfgs.map((c, i) => {
    const mm = UI_MODE[c.mode] || UI_MODE.rational;
    return `<span style="color:var(${P_CVARS[i]})">${P_NAMES[i]}</span>&thinsp;<span style="color:${mm.tagFg}">${mm.tag}</span>`;
  }).join(' · ');

  card.innerHTML = `
    <div class="rc-head">
      <span class="rc-algo" style="background:${algoBg};color:${algoFg}">${algoLbl}</span>
      <span class="rc-time">${ms} ms (Python)</span>
    </div>
    ${bars}
    <div class="rc-strat">${stratLine}</div>
    <div class="rc-stats">
      <div class="rc-stat"><span class="rc-stat-n">${data.total_nodes}</span><span class="rc-stat-l">total</span></div>
      <div class="rc-stat"><span class="rc-stat-n">${data.explored}</span><span class="rc-stat-l">explored</span></div>
      <div class="rc-stat"><span class="rc-stat-n" style="color:${data.pruned > 0 ? 'var(--pruned)' : 'inherit'}">${data.pruned}</span><span class="rc-stat-l">pruned</span></div>
    </div>
  `;
}

/* ── STATUS / FOOTER ─────────────────────────────── */
function setStatus(msg) {
  const el = document.getElementById('hdr-status');
  if (el) el.textContent = msg;
}

function syncFooter(count) {
  const el = document.getElementById('ftr-count');
  if (el) el.textContent = `${count} node${count !== 1 ? 's' : ''}`;
}

/* ── SOLVING INDICATOR ───────────────────────────── */
function setSolving(on) {
  const badge = document.getElementById('solving-badge');
  if (badge) badge.classList.toggle('show', on);
  ['btn-mm', 'btn-ab'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = on;
  });
}

/* ── TOAST ───────────────────────────────────────── */
let _toastTimer = null;
function showToast(msg) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

/* ── MODAL ───────────────────────────────────────── */
function openModal()  { document.getElementById('modal-overlay').classList.add('open'); }
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }
