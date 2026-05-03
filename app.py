"""
app.py
─────────────────────────────────────────────────────────────
Flask web application for the maxN 3-Player Game Tree Simulator.

Routes:
  GET  /                    → serves the main HTML page
  POST /api/solve           → runs minimax or alpha-beta, returns JSON
  GET  /api/example         → returns the built-in example tree as JSON
  POST /api/validate        → validates a tree structure (node count, depth)

Run locally:
  python app.py
  → http://localhost:5000

Deploy to Render / Railway / PythonAnywhere — see README.md
"""

from flask import Flask, render_template, request, jsonify
from engine import (
    Node,
    PlayerConfig,
    solve_minimax,
    solve_alpha_beta,
    build_example_tree,
)

app = Flask(__name__)


# ─────────────────────────────────────────────────────────────
# MAIN PAGE
# ─────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


# ─────────────────────────────────────────────────────────────
# API — SOLVE
# ─────────────────────────────────────────────────────────────

@app.route("/api/solve", methods=["POST"])
def api_solve():
    """
    Accepts JSON:
    {
      "algo": "minimax" | "alphabeta",
      "tree": { ...node dict... },
      "configs": [
        { "player": 0, "mode": "rational" },
        { "player": 1, "mode": "cooperative", "ally": 0, "coop_w": 1.0 },
        { "player": 2, "mode": "spiteful",    "enemy": 1, "spite_w": 1.5 }
      ]
    }

    Returns JSON result with tree, opt_edges, pru_nodes, pru_edges, stats.
    """
    data = request.get_json(force=True)

    if not data:
        return jsonify({"error": "No JSON body received"}), 400

    # Parse tree
    try:
        root = Node.from_dict(data["tree"])
    except (KeyError, TypeError) as e:
        return jsonify({"error": f"Invalid tree: {e}"}), 400

    # Parse configs — fall back to rational if missing
    raw_cfgs = data.get("configs", [{}, {}, {}])
    configs  = []
    for i, rc in enumerate(raw_cfgs):
        rc.setdefault("player", i)
        configs.append(PlayerConfig.from_dict(rc))

    # Ensure exactly 3 configs
    while len(configs) < 3:
        configs.append(PlayerConfig(player=len(configs)))

    # Run algorithm
    algo = data.get("algo", "minimax")
    try:
        if algo == "alphabeta":
            result = solve_alpha_beta(root, configs)
        else:
            result = solve_minimax(root, configs)
    except Exception as e:
        return jsonify({"error": f"Solver error: {e}"}), 500

    return jsonify(result)


# ─────────────────────────────────────────────────────────────
# API — EXAMPLE TREE
# ─────────────────────────────────────────────────────────────

@app.route("/api/example", methods=["GET"])
def api_example():
    """Return the built-in 3-level example tree as JSON."""
    idx = request.args.get("idx", default=0, type=int)
    tree = build_example_tree(idx)
    return jsonify({
        "tree": tree.to_dict(),
        "node_count": _count(tree),
    })


# ─────────────────────────────────────────────────────────────
# API — VALIDATE
# ─────────────────────────────────────────────────────────────

@app.route("/api/validate", methods=["POST"])
def api_validate():
    """
    Validates the tree and returns basic stats.
    Useful for the frontend to show info before solving.
    """
    data = request.get_json(force=True)
    if not data or "tree" not in data:
        return jsonify({"error": "No tree provided"}), 400

    try:
        root = Node.from_dict(data["tree"])
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    stats = _tree_stats(root)
    return jsonify(stats)


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────

def _count(node: Node) -> int:
    return 1 + sum(_count(c) for c in node.children)


def _tree_stats(root: Node) -> dict:
    depths, leaves, internals = [], 0, 0

    def dfs(n, d):
        nonlocal leaves, internals
        depths.append(d)
        if n.is_leaf():
            leaves += 1
        else:
            internals += 1
        for c in n.children:
            dfs(c, d + 1)

    dfs(root, 0)
    return {
        "total_nodes": len(depths),
        "leaf_nodes":  leaves,
        "internal_nodes": internals,
        "max_depth":   max(depths) if depths else 0,
        "branching_factor": round(internals and (len(depths) - 1) / internals, 2),
    }


# ─────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("─" * 50)
    print("  maxN · 3-Player Game Tree Simulator")
    print("  http://localhost:5000")
    print("─" * 50)
    app.run(debug=True, port=5000)
