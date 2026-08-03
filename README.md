# 🧠 MindFlow — Dynamic Markov Chain Study Optimizer

Adaptive study-session optimizer using **Markov Chain stochastic models** to predict cognitive fatigue and recommend optimal break windows.

> Built for STEM fairs, hackathons, or anyone who wants to study smarter.

---

## 🚀 Quick Start

### 1. Frontend (React)

```bash
cd mindflow
npm install        # one-time
npm run dev        # starts at http://localhost:5173
```

### 2. Backend (Python API)

```bash
cd mindflow/backend
source venv/bin/activate   # macOS / Linux
pip install -r requirements.txt   # one-time
python main.py             # starts at http://127.0.0.1:8000
```

The Vite dev server automatically proxies `/api` requests to the Python backend.

### 3. Open the app

Visit **http://localhost:5173** — move the sliders and click "Run Simulation" to see the Markov chain in action.

---

## 📐 How It Works

MindFlow models a student's cognitive state as a **4-state Discrete-Time Markov Chain**:

| State | Meaning |
|-------|---------|
| **S₁ Flow** | High focus, high retention |
| **S₂ Distracted** | Low efficiency, mind-wandering |
| **S₃ Fatigue** | Burnout — high error rate |
| **S₄ Recovery** | Rest & cognitive reset |

The transition matrix is dynamically scaled by three parameters:

| Parameter | Symbol | Range | Meaning |
|-----------|--------|-------|---------|
| Personal calibration | α | 0.5 – 2.0 | Stroop-test score (higher = more stamina) |
| Task difficulty | β | 1 – 5 | 1 = light reading, 5 = hard math |
| Circadian coefficient | γ | 0.8 – 1.3 | Time-of-day alertness |

The app simulates 18 ten-minute ticks (3 hours) and flags the first tick where **P(Fatigue) > 40%** — your optimal break window.

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend** | React, Vite, Tailwind CSS v4, Recharts, Lucide Icons |
| **Backend** | Python, FastAPI, NumPy, SciPy |
| **Math** | Discrete-Time Markov Chains, Probability Vector Evolution |

---

## 📁 Project Structure

```
mindflow/
├── index.html
├── vite.config.js
├── src/
│   ├── main.jsx          # React entry
│   ├── App.jsx           # Main dashboard + chart
│   └── index.css         # Tailwind + MindFlow theme
├── backend/
│   ├── main.py           # FastAPI server + Markov model
│   ├── requirements.txt  # Python dependencies
│   └── venv/             # Virtual environment (not in git)
└── README.md
```

---

## 🤝 Sharing on GitHub

### One-time: create a GitHub repo

1. Go to [github.com/new](https://github.com/new)
2. Name it `mindflow` (or whatever you like)
3. **Don't** check "Add a README" or "Add .gitignore" (we already have those)
4. Click **Create repository**

### Push your existing code

```bash
cd /Users/Jeremy/anaconda_projects/mindflow
git remote add origin https://github.com/YOUR_USERNAME/mindflow.git
git branch -M main
git commit -m "Initial MindFlow setup — React + FastAPI + Markov chain engine"
git push -u origin main
```

### Invite your partner

1. On your GitHub repo page → **Settings** → **Collaborators**
2. Click **Add people** → enter their GitHub username
3. They'll get an email invite. Once they accept, they can clone:

```bash
git clone https://github.com/YOUR_USERNAME/mindflow.git
cd mindflow
npm install
cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
```

### Daily workflow (after initial setup)

```bash
# Pull your partner's latest work
git pull

# ... make changes ...
git add -A
git commit -m "What you changed"
git push
```

> 💡 **Tip:** Work on separate branches for big features to avoid merge conflicts:
> ```bash
> git checkout -b feature/my-cool-thing
> # ... code ...
> git push -u origin feature/my-cool-thing
> ```
> Then open a Pull Request on GitHub to merge it together.

---

## 🎯 What's Next

- [ ] Stroop Color-Word micro-test for personal α calibration
- [ ] Weekly schedule / task manager UI
- [ ] User accounts & session history
- [ ] PWA offline support
