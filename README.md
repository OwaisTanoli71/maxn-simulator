# maxN · 3-Player Game Tree Simulator

![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python)
![Flask](https://img.shields.io/badge/Flask-3.0.3-black?logo=flask)
![License](https://img.shields.io/badge/License-MIT-green)
![Deploy](https://img.shields.io/badge/Deploy-Render%20%7C%20Railway%20%7C%20PythonAnywhere-purple)
![Algorithm](https://img.shields.io/badge/Algorithm-maxN%20%2B%20Alpha--Beta-orange)

A full-stack Python/Flask web app for visualising **3-player Minimax** and **Alpha-Beta Pruning** with a complete alliance system.

Features a modern, responsive, glassmorphic UI, and 6 built-in examples specifically designed to demonstrate the mechanics of MaxN "shallow pruning".

**All game logic runs server-side in Python. The browser only handles rendering and user input.**

---

## Project Structure

```
maxn-project/
├── app.py                  ← Flask routes & API endpoints
├── engine.py               ← All game algorithms (Minimax, Alpha-Beta)
├── requirements.txt        ← Python dependencies
├── Procfile                ← For Render / Railway deployment
├── templates/
│   └── index.html          ← Jinja2 HTML template
└── static/
    ├── css/
    │   └── style.css       ← All styling
    └── js/
        ├── layout.js       ← Tree positioning (visual only)
        ├── draw.js         ← Canvas rendering (visual only)
        ├── ui.js           ← Sidebar, result panel, modal
        └── app.js          ← Main controller, calls Python API
```

---

## Run Locally

### Step 1 — Install Python dependencies

```bash
pip install -r requirements.txt
```

### Step 2 — Run the Flask server

```bash
python app.py
```

### Step 3 — Open in browser

```
http://localhost:5000
```

---

## API Endpoints

| Method | URL             | Description               |
| ------ | --------------- | ------------------------- |
| `GET`  | `/`             | Main simulator page       |
| `POST` | `/api/solve`    | Run Minimax or Alpha-Beta |
| `GET`  | `/api/example`  | Get built-in example tree |
| `POST` | `/api/validate` | Validate tree structure   |

### POST /api/solve — Request Body

```json
{
  "algo": "minimax",
  "tree": {
    "id": 0,
    "leaf": [0, 0, 0],
    "children": [
      { "id": 1, "leaf": [5, 2, 1], "children": [] },
      { "id": 2, "leaf": [3, 4, 2], "children": [] }
    ]
  },
  "configs": [
    { "player": 0, "mode": "rational" },
    { "player": 1, "mode": "cooperative", "ally": 0, "coop_w": 1.0 },
    { "player": 2, "mode": "spiteful", "enemy": 0, "spite_w": 1.5 }
  ]
}
```

### Strategy Modes

| Mode          | Utility Function        |
| ------------- | ----------------------- |
| `rational`    | `own`                   |
| `cooperative` | `own + w × ally_score`  |
| `spiteful`    | `own − w × enemy_score` |
| `zero_sum`    | `own − Σ(other_scores)` |

---

## Deploying — Step by Step

---

### Option A · Render (Recommended — free tier, no credit card)

**Step 1 — Push to GitHub**

1. Go to [github.com](https://github.com) → sign in → click **+** → **New repository**
2. Name it `maxn-simulator`, set **Public**, click **Create repository**
3. Upload all files:

```bash
cd maxn-project
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/maxn-simulator.git
git push -u origin main
```

**Step 2 — Deploy on Render**

1. Go to [render.com](https://render.com) → sign up free (use GitHub login)
2. Click **New +** → **Web Service**
3. Connect your GitHub account → select `maxn-simulator` repo
4. Fill in settings:
   - **Name:** `maxn-simulator`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app`
5. Click **Create Web Service**
6. Wait ~2 minutes → get your URL: `https://maxn-simulator.onrender.com`

✅ **Free tier:** spins down after 15 min of inactivity, wakes on request.

---

### Option B · Railway (fast, $5 free credit)

1. Go to [railway.app](https://railway.app) → sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `maxn-simulator` repo
4. Railway auto-detects Python and reads `Procfile`
5. Click **Deploy** → get URL in ~1 minute

---

### Option C · PythonAnywhere (100% free, always on)

1. Go to [pythonanywhere.com](https://pythonanywhere.com) → sign up free
2. Go to **Files** tab → upload your project files
3. Go to **Web** tab → click **Add a new web app**
4. Choose **Flask** → Python 3.10
5. Set **Source code:** `/home/YOUR_USERNAME/maxn-project`
6. Set **WSGI file** to point to your `app.py`
7. In the WSGI config file, change:
   ```python
   from app import app as application
   ```
8. Click **Reload**
9. Your URL: `https://YOUR_USERNAME.pythonanywhere.com`

✅ **Always free** — no sleep, 512MB storage, custom domain supported.

---

### Option D · GitHub Pages (static only — NOT for Python)

GitHub Pages only serves static files. Since this app needs a Python backend, use one of the options above instead.

---

## Keyboard Shortcuts

| Key   | Action                        |
| ----- | ----------------------------- |
| `A`   | Add child to selected node    |
| `Del` | Remove selected node          |
| `M`   | Run Minimax (calls Python)    |
| `B`   | Run Alpha-Beta (calls Python) |
| `E`   | Load example from Python      |
| `R`   | Reset view                    |
| `Esc` | Close modal                   |

---

## Algorithm Notes

### Why Python handles the algorithms

All game tree logic — Minimax, Alpha-Beta, utility calculations — runs in `engine.py`. The browser sends your tree as JSON, Python solves it, and returns an annotated result. This means:

- Algorithms are easy to test in isolation (`python engine.py`)
- You can extend logic without touching frontend code
- The Python implementation matches standard CS textbooks exactly

### 3-Player Minimax (maxN)

No MIN player. Each player picks the child that maximises their own utility from the `(P1, P2, P3)` score tuple. Depth cycles `P1 → P2 → P3 → P1 …`

### Alpha-Beta (Shallow Pruning)

Standard 2-player α-β requires zero-sum. For 3 non-zero-sum players this uses **shallow pruning** (Luckhardt & Irani, AAAI-86): each player tracks a floor — the best utility they secured at the nearest ancestor where they moved. A branch is pruned when the current player's best meets that floor.

---

## Reference

> Luckhardt, C. A., & Irani, K. B. (1986). An algorithmic solution of N-person games. _AAAI-86_, 158–162.

---
