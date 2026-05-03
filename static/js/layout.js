/**
 * static/js/layout.js
 * Tree layout — positions nodes for rendering.
 * NOTE: All GAME LOGIC runs in Python (engine.py).
 *       This file only handles visual positioning.
 */

const LAYOUT = {
  NODE_R: 27,
  H_SEP:  76,
  V_SEP:  94,
  TOP:    62,
  LEFT:   58,
};

/** Count leaf descendants (or 1 if leaf). Used for x-spacing. */
function leafCount(node) {
  if (!node.children || !node.children.length) return 1;
  return node.children.reduce((s, c) => s + leafCount(c), 0);
}

/** Assign x, y to every node using Reingold-Tilford positioning. */
function layoutTree(root) {
  if (!root) return;
  
  const wrap = document.getElementById('canvas-wrap');
  const wrapW = wrap ? wrap.clientWidth : 800;
  
  const minLeft = 200; // Safe distance to prevent overlap with depth labels
  const treeW = leafCount(root) * LAYOUT.H_SEP;
  const actualLeft = Math.max(minLeft, (wrapW - treeW) / 2);

  function place(node, leftOffset, depth) {
    const lc = leafCount(node);
    node.x   = actualLeft + (leftOffset + lc / 2) * LAYOUT.H_SEP;
    node.y   = LAYOUT.TOP  + depth * LAYOUT.V_SEP;
    let cur  = leftOffset;
    if (node.children) {
      for (const child of node.children) {
        place(child, cur, depth + 1);
        cur += leafCount(child);
      }
    }
  }
  place(root, 0, 0);
}

/** Build { nodeId: depth } map from a nested tree object. */
function buildDepthMap(root) {
  const map = {};
  if (!root) return map;
  function dfs(node, depth) {
    map[node.id] = depth;
    if (node.children) node.children.forEach(c => dfs(c, depth + 1));
  }
  dfs(root, 0);
  return map;
}

/** Flatten nested tree into array. */
function flattenTree(root) {
  const arr = [];
  function dfs(node) {
    arr.push(node);
    if (node.children) node.children.forEach(dfs);
  }
  if (root) dfs(root);
  return arr;
}

/** Compute canvas dimensions needed. */
function canvasBounds(nodes, wrapW, wrapH) {
  let w = wrapW, h = wrapH;
  for (const n of nodes) {
    w = Math.max(w, n.x + LAYOUT.NODE_R + 64);
    h = Math.max(h, n.y + LAYOUT.NODE_R + 64);
  }
  return { w, h };
}
