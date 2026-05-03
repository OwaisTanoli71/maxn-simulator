"""
engine.py
─────────────────────────────────────────────────────────────
3-Player Minimax Engine with Alliance System
All game tree algorithms live here — pure Python, no JS logic.

Algorithms:
  minimax()    — classic maxN, alliance-aware
  alpha_beta() — shallow pruning (Luckhardt & Irani, AAAI-86)

Strategy modes:
  rational     — utility = own
  cooperative  — utility = own + w * ally
  spiteful     — utility = own - w * enemy
  zero_sum     — utility = own - sum(others)
"""

from __future__ import annotations
import math
from dataclasses import dataclass, field
from typing import Optional

INF = math.inf


# ─────────────────────────────────────────────────────────────
# NODE
# ─────────────────────────────────────────────────────────────

@dataclass
class Node:
    node_id:  int
    children: list["Node"]        = field(default_factory=list)
    leaf:     list[float]         = field(default_factory=lambda: [0.0, 0.0, 0.0])
    value:    Optional[list[float]] = None
    pruned:   bool                = False
    optimal:  bool                = False

    def is_leaf(self) -> bool:
        return len(self.children) == 0

    def reset(self):
        """Clear algorithm results — call before each solve."""
        self.value   = None
        self.pruned  = False
        self.optimal = False
        for c in self.children:
            c.reset()

    def to_dict(self) -> dict:
        return {
            "id":       self.node_id,
            "leaf":     self.leaf,
            "value":    self.value,
            "pruned":   self.pruned,
            "optimal":  self.optimal,
            "children": [c.to_dict() for c in self.children],
        }

    @staticmethod
    def from_dict(d: dict) -> "Node":
        n = Node(
            node_id  = d["id"],
            leaf     = d.get("leaf", [0.0, 0.0, 0.0]),
        )
        for cd in d.get("children", []):
            n.children.append(Node.from_dict(cd))
        return n


# ─────────────────────────────────────────────────────────────
# PLAYER CONFIG
# ─────────────────────────────────────────────────────────────

@dataclass
class PlayerConfig:
    player:  int
    mode:    str   = "rational"   # rational | cooperative | spiteful | zero_sum
    ally:    int   = -1
    enemy:   int   = -1
    coop_w:  float = 1.0
    spite_w: float = 1.0

    def utility(self, scores: list[float]) -> float:
        """Compute scalar utility from (P1, P2, P3) score tuple."""
        own = scores[self.player]

        if self.mode == "cooperative":
            ally_score = scores[self.ally] if 0 <= self.ally < 3 else 0.0
            return own + self.coop_w * ally_score

        if self.mode == "spiteful":
            enemy_score = scores[self.enemy] if 0 <= self.enemy < 3 else 0.0
            return own - self.spite_w * enemy_score

        if self.mode in ("zero_sum", "zero-sum"):
            others = sum(s for i, s in enumerate(scores) if i != self.player)
            return own - others

        return own  # rational (default)

    @staticmethod
    def from_dict(d: dict) -> "PlayerConfig":
        return PlayerConfig(
            player  = int(d.get("player", 0)),
            mode    = d.get("mode", "rational"),
            ally    = int(d.get("ally", -1)),
            enemy   = int(d.get("enemy", -1)),
            coop_w  = float(d.get("coop_w",  1.0)),
            spite_w = float(d.get("spite_w", 1.0)),
        )


def default_configs() -> list[PlayerConfig]:
    return [PlayerConfig(i) for i in range(3)]


# ─────────────────────────────────────────────────────────────
# MINIMAX  (maxN — alliance-aware)
# ─────────────────────────────────────────────────────────────

def minimax(
    node:    Node,
    depth:   int,
    configs: list[PlayerConfig],
    opt_edges: set,
) -> list[float]:
    """
    Recursive maxN minimax.
    Sets node.value and marks node.optimal on the chosen child.
    Returns the propagated [p1, p2, p3] tuple.
    """
    node.pruned  = False
    node.optimal = False

    if node.is_leaf():
        node.value = list(node.leaf)
        return node.value

    player = depth % 3
    cfg    = configs[player]

    best_val:   Optional[list[float]] = None
    best_child: Optional[Node]        = None
    best_util:  float                 = -INF

    for child in node.children:
        v    = minimax(child, depth + 1, configs, opt_edges)
        util = cfg.utility(v)
        if util > best_util:
            best_util  = util
            best_val   = v
            best_child = child

    node.value = best_val
    if best_child is not None:
        opt_edges.add(f"{node.node_id}-{best_child.node_id}")
        best_child.optimal = True

    return node.value


# ─────────────────────────────────────────────────────────────
# ALPHA-BETA  (shallow pruning for 3 non-zero-sum players)
# ─────────────────────────────────────────────────────────────

def _mark_subtree_pruned(node: Node, pru_nodes: set, pru_edges: set, parent_id: int):
    node.pruned = True
    pru_nodes.add(node.node_id)
    for child in node.children:
        pru_edges.add(f"{node.node_id}-{child.node_id}")
        _mark_subtree_pruned(child, pru_nodes, pru_edges, node.node_id)


def alpha_beta(
    node:         Node,
    depth:        int,
    configs:      list[PlayerConfig],
    parent_floor: list[float],          # best utility each player secured above
    opt_edges:    set,
    pru_nodes:    set,
    pru_edges:    set,
) -> tuple[list[float], int]:
    """
    Alpha-Beta with shallow pruning for 3 non-zero-sum players.

    parent_floor[k] = best scalar utility player k has secured at the
    nearest ancestor where player k moved (their personal alpha).

    Pruning condition (immediate / shallow cut):
      If best_util >= parent_floor[player], the caller won't prefer
      this subtree — prune remaining siblings.

    Returns (value_tuple, pruned_count).
    """
    node.pruned  = False
    node.optimal = False

    if node.is_leaf():
        node.value = list(node.leaf)
        return node.value, 0

    player   = depth % 3
    cfg      = configs[player]
    my_floor = list(parent_floor)   # local copy — update as we search

    best_val:   Optional[list[float]] = None
    best_child: Optional[Node]        = None
    best_util:  float                 = -INF
    pruned_count = 0

    for i, child in enumerate(node.children):
        v, pc = alpha_beta(
            child, depth + 1, configs, my_floor,
            opt_edges, pru_nodes, pru_edges
        )
        pruned_count += pc

        util = cfg.utility(v)
        if util > best_util:
            best_util  = util
            best_val   = v
            best_child = child

        my_floor[player] = best_util

        # ── Shallow pruning ──────────────────────────────────
        if parent_floor[player] > -INF and best_util >= parent_floor[player]:
            remaining = node.children[i + 1:]
            for sib in remaining:
                pru_edges.add(f"{node.node_id}-{sib.node_id}")
                _mark_subtree_pruned(sib, pru_nodes, pru_edges, node.node_id)
                pruned_count += 1
            break

    node.value = best_val
    if best_child is not None:
        opt_edges.add(f"{node.node_id}-{best_child.node_id}")
        best_child.optimal = True

    return node.value, pruned_count


# ─────────────────────────────────────────────────────────────
# HIGH-LEVEL SOLVERS  (called by app.py)
# ─────────────────────────────────────────────────────────────

def solve_minimax(root: Node, configs: list[PlayerConfig]) -> dict:
    """Run minimax and return serialisable result dict."""
    root.reset()
    root.optimal = True
    opt_edges: set = set()

    minimax(root, 0, configs, opt_edges)

    total = _count_nodes(root)
    return {
        "algo":        "minimax",
        "root_value":  root.value,
        "opt_edges":   list(opt_edges),
        "pru_nodes":   [],
        "pru_edges":   [],
        "total_nodes": total,
        "pruned":      0,
        "explored":    total,
        "tree":        root.to_dict(),
    }


def solve_alpha_beta(root: Node, configs: list[PlayerConfig]) -> dict:
    """Run alpha-beta and return serialisable result dict."""
    root.reset()
    root.optimal = True
    opt_edges: set = set()
    pru_nodes: set = set()
    pru_edges: set = set()

    _, pruned_count = alpha_beta(
        root, 0, configs,
        [-INF, -INF, -INF],
        opt_edges, pru_nodes, pru_edges
    )

    total    = _count_nodes(root)
    explored = total - len(pru_nodes)
    return {
        "algo":        "alphabeta",
        "root_value":  root.value,
        "opt_edges":   list(opt_edges),
        "pru_nodes":   list(pru_nodes),
        "pru_edges":   list(pru_edges),
        "total_nodes": total,
        "pruned":      len(pru_nodes),
        "explored":    explored,
        "tree":        root.to_dict(),
    }


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────

def _count_nodes(root: Node) -> int:
    count = [0]
    def dfs(n):
        count[0] += 1
        for c in n.children:
            dfs(c)
    dfs(root)
    return count[0]


def build_example_tree(idx: int = 0) -> Node:
    """Return an example tree for demo/testing. Supports multiple different trees via idx."""
    nid  = [0]

    def mk(leaf=None):
        n = Node(nid[0], leaf=leaf or [0.0, 0.0, 0.0])
        nid[0] += 1
        return n

    root = mk()
    
    if idx % 6 == 0:
        branches = [
            [[5, 2, 1], [3, 4, 2], [1, 1, 6]],
            [[2, 3, 4], [4, 1, 3]],
            [[3, 5, 2], [2, 2, 5], [6, 1, 1]],
        ]
    elif idx % 6 == 1:
        branches = [
            [[8, 1, 2], [2, 7, 3]],
            [[1, 2, 9], [6, 4, 2], [3, 5, 5]],
            [[4, 4, 4]]
        ]
    elif idx % 6 == 2:
        branches = [
            [[3, 3, 3], [5, 1, 2]],
            [[2, 8, 1], [1, 2, 7]],
        ]
    elif idx % 6 == 3:
        # Example 3: P1 Pruning Demonstration (Depth 4)
        c_left = mk()
        root.children.append(c_left)
        p3_left = mk()
        c_left.children.append(p3_left)
        p1_left = mk()
        p3_left.children.append(p1_left)
        p1_left.children.append(mk([10, 0, 0]))

        c_right = mk()
        root.children.append(c_right)
        p3_right = mk()
        c_right.children.append(p3_right)
        p1_right = mk()
        p3_right.children.append(p1_right)
        p1_right.children.append(mk([12, 0, 0]))
        p1_right.children.append(mk([15, 0, 0]))

        return root
    elif idx % 6 == 4:
        # Example 4: P2 Pruning Demonstration (Depth 5)
        p2_node = mk()
        root.children.append(p2_node)

        # Left Branch (secures 20 for P2)
        p3_left = mk()
        p2_node.children.append(p3_left)
        p1_left = mk()
        p3_left.children.append(p1_left)
        p1_left.children.append(mk([0, 20, 0]))

        # Right Branch (P2 finds 25, prunes 30)
        p3_right = mk()
        p2_node.children.append(p3_right)
        p1_right = mk()
        p3_right.children.append(p1_right)
        p2_right = mk()
        p1_right.children.append(p2_right)
        
        p2_right.children.append(mk([0, 25, 0]))
        p2_right.children.append(mk([0, 30, 0]))

        return root
    else:
        # Example 5: P3 Pruning Demonstration (Depth 6)
        p2_node = mk()
        root.children.append(p2_node)
        p3_node = mk()
        p2_node.children.append(p3_node)

        # Left Branch (secures 50 for P3)
        p1_left = mk()
        p3_node.children.append(p1_left)
        p2_left = mk()
        p1_left.children.append(p2_left)
        p2_left.children.append(mk([0, 0, 50]))

        # Right Branch (P3 finds 60, prunes 70)
        p1_right = mk()
        p3_node.children.append(p1_right)
        p2_right = mk()
        p1_right.children.append(p2_right)
        p3_right = mk()
        p2_right.children.append(p3_right)
        
        p3_right.children.append(mk([0, 0, 60]))
        p3_right.children.append(mk([0, 0, 70]))

        return root

    for branch in branches:
        child = mk()
        root.children.append(child)
        for lv in branch:
            leaf = mk(lv)
            child.children.append(leaf)

    return root
