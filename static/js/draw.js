/**
 * static/js/draw.js
 * Canvas rendering — visual only, zero game logic.
 * All game-tree values come from the Python backend.
 */

const P_CVARS  = ['--p1', '--p2', '--p3'];
const P_PALES  = ['--p1-pale', '--p2-pale', '--p3-pale'];
const P_NAMES  = ['P1', 'P2', 'P3'];

const MODE_META = {
  rational:    { tag: 'rational',    bg: '--paper3',     fg: '--ink4'   },
  cooperative: { tag: 'cooperative', bg: '--coop-pale',  fg: '--coop'   },
  spiteful:    { tag: 'spiteful',    bg: '--spite-pale', fg: '--spite'  },
  zero_sum:    { tag: 'zero-sum',    bg: '--zero-pale',  fg: '--zero'   },
};

function cv(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Render the full tree onto ctx.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object|null} root         - nested tree object (from Python)
 * @param {object}      viewState    - { selected, optEdges, pruNodes, pruEdges, lastAlgo }
 * @param {object[]}    cfgs         - player configs
 * @param {object}      depthMap     - { nodeId: depth }
 */
function drawTree(ctx, root, viewState, cfgs, depthMap) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  if (!root) {
    ctx.save();
    ctx.font         = `italic 15px ${cv('--serif') || 'Georgia, serif'}`;
    ctx.fillStyle    = cv('--ink4');
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Click anywhere to place the root node', ctx.canvas.width / 2, ctx.canvas.height / 2);
    ctx.restore();
    return;
  }

  const { selected, optEdges, pruNodes, pruEdges, lastAlgo } = viewState;

  _drawEdges(ctx, root, optEdges, pruEdges);
  if (lastAlgo === 'alphabeta') _drawCuts(ctx, root, pruEdges);
  _drawNodes(ctx, root, selected, pruNodes, cfgs, depthMap);
  _drawDepthLabels(ctx, root, cfgs, depthMap);
}

/* ── EDGES ──────────────────────────────────────── */
function _drawEdges(ctx, node, optEdges, pruEdges) {
  if (!node.children) return;
  for (const child of node.children) {
    const key   = `${node.id}-${child.id}`;
    const isOpt = optEdges.has(key);
    const isPru = pruEdges.has(key);
    const midY  = node.y + (child.y - node.y) * 0.5;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(node.x, node.y + LAYOUT.NODE_R);
    ctx.lineTo(node.x, midY);
    ctx.lineTo(child.x, midY);
    ctx.lineTo(child.x, child.y - LAYOUT.NODE_R);

    if (isPru) {
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = cv('--pruned') + '66';
      ctx.lineWidth   = 1.5;
    } else if (isOpt) {
      ctx.setLineDash([]);
      ctx.strokeStyle = cv('--opt-stroke');
      ctx.lineWidth   = 2.2;
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = cv('--rule2');
      ctx.lineWidth   = 1.5;
    }
    ctx.stroke();
    ctx.restore();

    // Elbow junction dots
    if (!isPru) {
      const dotColor = isOpt ? cv('--opt-stroke') : cv('--rule2');
      _dot(ctx, node.x, midY, 2.5, dotColor);
      _dot(ctx, child.x, midY, 2.5, dotColor);
    }

    _drawEdges(ctx, child, optEdges, pruEdges);
  }
}

function _dot(ctx, x, y, r, color) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/* ── PRUNING SCISSORS ───────────────────────────── */
function _drawCuts(ctx, node, pruEdges) {
  if (!node.children) return;
  for (const child of node.children) {
    if (pruEdges.has(`${node.id}-${child.id}`)) {
      const mx = child.x;
      const my = (node.y + child.y) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(mx, my, 8, 0, Math.PI * 2);
      ctx.fillStyle   = cv('--paper');
      ctx.fill();
      ctx.strokeStyle = cv('--pruned') + 'aa';
      ctx.lineWidth   = 1;
      ctx.stroke();
      ctx.fillStyle    = cv('--pruned');
      ctx.font         = '10px serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✂', mx, my + 0.5);
      ctx.restore();
    }
    _drawCuts(ctx, child, pruEdges);
  }
}

/* ── NODES ──────────────────────────────────────── */
function _drawNodes(ctx, root, selected, pruNodes, cfgs, depthMap) {
  function draw(node) {
    const depth  = depthMap[node.id] ?? 0;
    const player = depth % 3;
    const pcol   = cv(P_CVARS[player]);
    const ppale  = cv(P_PALES[player]);
    const isSel  = selected && selected.id === node.id;
    const isPru  = pruNodes.has(node.id);
    const isLeaf = !node.children || !node.children.length;
    const isOpt  = node.optimal && !isPru;
    const cfg    = cfgs[player];
    const mm     = MODE_META[cfg?.mode] || MODE_META.rational;

    ctx.save();

    // Selection ring
    if (isSel) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, LAYOUT.NODE_R + 6, 0, Math.PI * 2);
      ctx.strokeStyle = pcol + '44';
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Strategy inner ring (non-rational)
    if (!isPru && cfg?.mode && cfg.mode !== 'rational') {
      ctx.beginPath();
      ctx.arc(node.x, node.y, LAYOUT.NODE_R - 6, 0, Math.PI * 2);
      ctx.strokeStyle = cv(mm.fg) + '77';
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, LAYOUT.NODE_R, 0, Math.PI * 2);
    ctx.fillStyle = isPru ? cv('--pruned-pale') : (isOpt ? ppale : cv('--paper'));
    ctx.fill();
    ctx.strokeStyle = isPru ? cv('--pruned') + '55' : pcol;
    ctx.lineWidth   = (isOpt || isSel) ? 2.5 : 1.5;
    ctx.stroke();

    // Leaf corner dot
    if (isLeaf && !isPru) {
      ctx.beginPath();
      ctx.arc(node.x + LAYOUT.NODE_R - 6, node.y - LAYOUT.NODE_R + 6, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = pcol + 'cc';
      ctx.fill();
    }

    // Player label
    ctx.font         = `500 9px ${cv('--mono') || 'monospace'}`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle    = isPru ? cv('--pruned') + '55' : pcol;
    ctx.fillText(P_NAMES[player], node.x, node.y - 11);

    // Value tuple (from Python result, or leaf raw value)
    const vals = node.value ?? (isLeaf ? node.leaf : null);
    if (vals) {
      _drawTuple(ctx, node.x, node.y + 7, vals, isPru);
    } else {
      ctx.font         = `300 11px ${cv('--mono') || 'monospace'}`;
      ctx.fillStyle    = cv('--ink4');
      ctx.textBaseline = 'middle';
      ctx.fillText('?', node.x, node.y + 4);
    }

    ctx.restore();

    if (node.children) node.children.forEach(draw);
  }
  draw(root);
}

function _drawTuple(ctx, cx, cy, vals, isPru) {
  const parts = [String(vals[0]), ',', String(vals[1]), ',', String(vals[2])];
  const cols  = isPru
    ? Array(5).fill(cv('--pruned') + '44')
    : [cv(P_CVARS[0]), cv('--rule2'), cv(P_CVARS[1]), cv('--rule2'), cv(P_CVARS[2])];

  ctx.font         = `400 8px ${cv('--mono') || 'monospace'}`;
  ctx.textBaseline = 'middle';

  const full = parts.join('');
  const tw   = ctx.measureText(full).width;
  let xc     = cx - tw / 2;

  ctx.textAlign = 'left';
  parts.forEach((p, i) => {
    ctx.fillStyle = cols[i];
    ctx.fillText(p, xc, cy);
    xc += ctx.measureText(p).width;
  });
  ctx.textAlign = 'center';
}

/* ── DEPTH LABELS ───────────────────────────────── */
function _drawDepthLabels(ctx, root, cfgs, depthMap) {
  const depthY = {};
  flattenTree(root).forEach(n => {
    const d = depthMap[n.id] ?? 0;
    if (depthY[d] === undefined) depthY[d] = n.y;
  });

  for (const [dStr, y] of Object.entries(depthY)) {
    const d   = Number(dStr);
    const p   = d % 3;
    const cfg = cfgs[p];
    const pc  = cv(P_CVARS[p]);
    const lbl = `d${d} · ${P_NAMES[p]} · ${(cfg?.mode || 'rational').replace('_', '-')}`;

    ctx.save();
    ctx.font = `400 9px ${cv('--mono') || 'monospace'}`;
    const tw = ctx.measureText(lbl).width;
    const bx = 5, by = y - 10, bw = tw + 14, bh = 20;

    _roundRect(ctx, bx, by, bw, bh, 3);
    ctx.fillStyle   = cv('--paper');
    ctx.fill();
    ctx.strokeStyle = cv('--rule');
    ctx.lineWidth   = 1;
    ctx.stroke();

    _roundRect(ctx, bx, by, 3, bh, 1);
    ctx.fillStyle = pc;
    ctx.fill();

    ctx.fillStyle    = cv('--ink3');
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(lbl, bx + 9, y);
    ctx.restore();
  }
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
