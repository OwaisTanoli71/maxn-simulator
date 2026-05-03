/**
 * static/js/app.js
 * Main application controller.
 *
 * Architecture:
 *   Browser  ──(JSON tree + configs)──▶  Python/Flask (engine.py)
 *   Browser  ◀──(annotated result)────  Python/Flask
 *
 * The browser handles:
 *   - Tree building (adding/removing nodes)
 *   - Visual layout (layout.js)
 *   - Canvas rendering (draw.js)
 *   - UI updates (ui.js)
 *
 * Python handles:
 *   - Minimax algorithm
 *   - Alpha-Beta pruning
 *   - Utility calculations (rational/cooperative/spiteful/zero-sum)
 */

/* ══════════════════════════════════════════════════
   CLIENT-SIDE STATE
══════════════════════════════════════════════════ */
const S = {
  root:     null,      // nested tree object (source of truth)
  nodes:    [],        // flat array (for layout & hit-testing)
  nextId:   0,
  selected: null,      // currently selected node object ref
  exampleIdx: 0,       // current example index

  // Result state (populated by Python response)
  optEdges: new Set(), // "parentId-childId" optimal edge keys
  pruNodes: new Set(), // pruned node ids
  pruEdges: new Set(), // "parentId-childId" pruned edge keys
  lastAlgo: '',
};

/* ══════════════════════════════════════════════════
   CANVAS
══════════════════════════════════════════════════ */
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');

function applyCanvasSize() {
  const wrap = document.getElementById('canvas-wrap');
  const { w, h } = canvasBounds(S.nodes, wrap.clientWidth, wrap.clientHeight);
  canvas.width  = w;
  canvas.height = h;
}

window.addEventListener('resize', () => { refresh(); });

/* ══════════════════════════════════════════════════
   RENDER LOOP
══════════════════════════════════════════════════ */
function redraw() {
  const dm   = S.root ? buildDepthMap(S.root) : {};
  const cfgs = getCfgs();
  const vs   = {
    selected: S.selected,
    optEdges: S.optEdges,
    pruNodes: S.pruNodes,
    pruEdges: S.pruEdges,
    lastAlgo: S.lastAlgo,
  };
  drawTree(ctx, S.root, vs, cfgs, dm);
}

function refresh() {
  if (S.root) {
    layoutTree(S.root);
    S.nodes = flattenTree(S.root);
  } else {
    S.nodes = [];
  }
  applyCanvasSize();
  redraw();
  syncFooter(S.nodes.length);
}

/* ══════════════════════════════════════════════════
   PYTHON API CALLS
══════════════════════════════════════════════════ */

/** Serialise tree for sending to Python */
function treeToJSON(node) {
  if (!node) return null;
  return {
    id:       node.id,
    leaf:     node.leaf,
    children: (node.children || []).map(treeToJSON),
  };
}

/** Call Python /api/solve endpoint */
async function callSolve(algo) {
  if (!S.root) { setStatus('no tree — click canvas to place root'); return; }

  const cfgs = getCfgs();
  const payload = {
    algo,
    tree:    treeToJSON(S.root),
    configs: cfgs.map(c => ({
      player:  c.player,
      mode:    c.mode,
      ally:    c.ally,
      enemy:   c.enemy,
      coop_w:  c.coop_w,
      spite_w: c.spite_w,
    })),
  };

  setSolving(true);
  setStatus('sending to Python…');

  const t0 = performance.now();
  let data;
  try {
    const resp = await fetch('/api/solve', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error || `HTTP ${resp.status}`);
    }
    data = await resp.json();
  } catch (e) {
    showToast(`Error: ${e.message}`);
    setStatus('solve failed — check console');
    setSolving(false);
    return;
  }
  const ms = (performance.now() - t0).toFixed(0);

  setSolving(false);

  // Apply Python result to local tree
  _applyResult(data);

  redraw();
  renderResult(data, cfgs, ms);
  syncNodeCard(S.selected, S.pruNodes, buildDepthMap(S.root), cfgs);
  setStatus(`${algo === 'alphabeta' ? 'alpha-beta' : 'minimax'} · ${data.pruned} pruned · ${ms} ms round-trip · root = (${data.root_value.join(', ')})`);
}

/** Merge Python result annotations back into local tree nodes */
function _applyResult(data) {
  // Reset
  S.optEdges.clear();
  S.pruNodes.clear();
  S.pruEdges.clear();
  S.lastAlgo = data.algo;

  // Populate sets from Python response
  (data.opt_edges || []).forEach(k => S.optEdges.add(k));
  (data.pru_nodes || []).forEach(id => S.pruNodes.add(id));
  (data.pru_edges || []).forEach(k => S.pruEdges.add(k));

  // Merge values, optimal, pruned flags from Python tree into local tree
  const resultMap = {};
  function indexResult(node) {
    resultMap[node.id] = node;
    (node.children || []).forEach(indexResult);
  }
  indexResult(data.tree);

  function mergeLocal(localNode) {
    const r = resultMap[localNode.id];
    if (r) {
      localNode.value   = r.value;
      localNode.optimal = r.optimal;
      localNode.pruned  = r.pruned;
    }
    (localNode.children || []).forEach(mergeLocal);
  }
  mergeLocal(S.root);
}

/** Load example tree from Python */
async function loadExample() {
  let data;
  try {
    const resp = await fetch(`/api/example?idx=${S.exampleIdx}`);
    data = await resp.json();
    S.exampleIdx++;
  } catch (e) {
    showToast('Could not load example from server');
    return;
  }

  // Reset state
  S.root     = null;
  S.nodes    = [];
  S.nextId   = 0;
  S.selected = null;
  _clearAlgo();

  // Rebuild from Python tree dict
  S.root   = _buildLocalTree(data.tree);
  S.nextId = _maxId(S.root) + 1;

  refresh();
  document.getElementById('result-card').innerHTML = '<span class="empty">— run an algorithm</span>';
  setStatus('example loaded from Python — try a scenario preset, then solve');
}

function _buildLocalTree(dict) {
  const node = {
    id:       dict.id,
    x: 0, y: 0,
    leaf:     dict.leaf || [0, 0, 0],
    value:    null,
    optimal:  false,
    pruned:   false,
    children: (dict.children || []).map(_buildLocalTree),
  };
  return node;
}

function _maxId(node) {
  let m = node.id;
  (node.children || []).forEach(c => { m = Math.max(m, _maxId(c)); });
  return m;
}

/* ══════════════════════════════════════════════════
   TREE EDITING (client-side, no server needed)
══════════════════════════════════════════════════ */

function _mkNode(id) {
  return { id, x: 0, y: 0, children: [], leaf: [0, 0, 0], value: null, optimal: false, pruned: false };
}

function addChild() {
  if (!S.selected) { setStatus('select a node first, then click + child'); return; }
  const child = _mkNode(S.nextId++);
  S.selected.children.push(child);
  _clearAlgo();
  refresh();
  setStatus(`added node #${child.id} under #${S.selected.id}`);
}

function deleteSelected() {
  if (!S.selected)        { setStatus('select a node first'); return; }
  if (S.selected === S.root) { setStatus('cannot delete root — use clear'); return; }

  function rem(parent, target) {
    parent.children = parent.children.filter(c => c.id !== target.id);
    parent.children.forEach(c => rem(c, target));
  }
  rem(S.root, S.selected);

  setStatus(`removed node #${S.selected.id}`);
  S.selected = null;
  _clearAlgo();
  refresh();
  syncNodeCard(null, S.pruNodes, {}, getCfgs());
}

function clearTree() {
  if (S.root && !confirm('Clear the entire tree?')) return;
  S.root     = null;
  S.selected = null;
  S.nextId   = 0;
  _clearAlgo();
  refresh();
  syncNodeCard(null, S.pruNodes, {}, getCfgs());
  document.getElementById('result-card').innerHTML = '<span class="empty">— run an algorithm</span>';
  setStatus('cleared — click canvas to start a new tree');
}

function resetView() {
  _clearAlgo();
  // Remove result annotations from local nodes
  if (S.root) flattenTree(S.root).forEach(n => { n.value = null; n.optimal = false; n.pruned = false; });
  redraw();
  document.getElementById('result-card').innerHTML = '<span class="empty">— run an algorithm</span>';
  syncNodeCard(S.selected, S.pruNodes, S.root ? buildDepthMap(S.root) : {}, getCfgs());
  setStatus('reset');
}

function _clearAlgo() {
  S.optEdges.clear();
  S.pruNodes.clear();
  S.pruEdges.clear();
  S.lastAlgo = '';
}

/* ══════════════════════════════════════════════════
   HIT TESTING
══════════════════════════════════════════════════ */
function findNode(x, y) {
  const R = LAYOUT.NODE_R;
  for (let i = S.nodes.length - 1; i >= 0; i--) {
    const n = S.nodes[i];
    if (Math.hypot(n.x - x, n.y - y) <= R + 3) return n;
  }
  return null;
}

/* ══════════════════════════════════════════════════
   MOUSE
══════════════════════════════════════════════════ */
canvas.addEventListener('click', e => {
  const wrap = document.getElementById('canvas-wrap');
  const rect = canvas.getBoundingClientRect();
  const x    = e.clientX - rect.left + wrap.scrollLeft;
  const y    = e.clientY - rect.top  + wrap.scrollTop;

  const hit = findNode(x, y);
  if (hit) {
    S.selected = hit;
    const dm = S.root ? buildDepthMap(S.root) : {};
    syncNodeCard(hit, S.pruNodes, dm, getCfgs());
    redraw();
    setStatus(`node #${hit.id} · depth ${dm[hit.id] ?? 0} · ${!hit.children?.length ? 'leaf — edit scores in panel' : 'internal'}`);
  } else {
    if (!S.root) {
      S.root   = _mkNode(S.nextId++);
      S.selected = S.root;
      refresh();
      syncNodeCard(S.root, S.pruNodes, buildDepthMap(S.root), getCfgs());
      setStatus('root placed — select it, click + child to grow the tree');
    } else {
      S.selected = null;
      syncNodeCard(null, S.pruNodes, {}, getCfgs());
      redraw();
      setStatus('—');
    }
  }
});

/* ══════════════════════════════════════════════════
   LEAF EDITOR
══════════════════════════════════════════════════ */
['v1', 'v2', 'v3'].forEach((id, i) => {
  document.getElementById(id).addEventListener('input', () => {
    if (!S.selected || (S.selected.children && S.selected.children.length)) return;
    if (!S.selected.leaf) S.selected.leaf = [0, 0, 0];
    S.selected.leaf[i] = parseFloat(document.getElementById(id).value) || 0;
    redraw();
  });
});

/* ══════════════════════════════════════════════════
   TOOLBAR BUTTONS
══════════════════════════════════════════════════ */
document.getElementById('btn-add').addEventListener('click', addChild);
document.getElementById('btn-del').addEventListener('click', deleteSelected);
document.getElementById('btn-example').addEventListener('click', loadExample);
document.getElementById('btn-clear').addEventListener('click', clearTree);
document.getElementById('btn-mm').addEventListener('click', () => callSolve('minimax'));
document.getElementById('btn-ab').addEventListener('click', () => callSolve('alphabeta'));
document.getElementById('btn-reset').addEventListener('click', resetView);
document.getElementById('btn-theory').addEventListener('click', openModal);
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

/* ══════════════════════════════════════════════════
   MODE DROPDOWNS + PRESETS
══════════════════════════════════════════════════ */
[0, 1, 2].forEach(i => {
  document.getElementById(`mode${i}`).addEventListener('change', () => onMode(i));
});

document.querySelectorAll('.preset-item').forEach(btn => {
  btn.addEventListener('click', () => {
    applyPreset(btn.dataset.preset);
    setStatus(`scenario: ${btn.dataset.preset.replace(/_/g, ' ')}`);
  });
});

/* ══════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
══════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  switch (e.key) {
    case 'a': case 'A':     addChild();               break;
    case 'Delete':
    case 'Backspace':       deleteSelected();          break;
    case 'm': case 'M':     callSolve('minimax');      break;
    case 'b': case 'B':     callSolve('alphabeta');    break;
    case 'e': case 'E':     loadExample();             break;
    case 'r': case 'R':     resetView();               break;
    case 'Escape':          closeModal();              break;
  }
});

/* ══════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════ */
initPlayerCards();
refresh();
setStatus('ready — click canvas to place root node, or load example');
