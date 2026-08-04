from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import math
import numpy as np
from typing import Optional

app = FastAPI(title="MindFlow API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# -- Validation -----------------------------------------------------------

def validate_params(alpha: float, beta: float, gamma: float, steps: int) -> Optional[str]:
    """Return an error message string if any parameter is out of range, else None."""
    # Guard against NaN / Infinity which bypass numeric comparisons
    if not (math.isfinite(alpha) and math.isfinite(beta) and math.isfinite(gamma)):
        return "parameters must be finite numbers"
    if alpha < 0.3 or alpha > 3.0:
        return f"alpha must be in [0.3, 3.0], got {alpha}"
    if beta < 1 or beta > 5:
        return f"beta must be in [1, 5], got {beta}"
    if gamma < 0.5 or gamma > 2.0:
        return f"gamma must be in [0.5, 2.0], got {gamma}"
    if steps < 1 or steps > 144:
        return f"steps must be in [1, 144], got {steps}"
    return None


# -- Markov Chain Model ---------------------------------------------------
# This implementation matches src/utils/markovEngine.js exactly.
# Both use the multiplier-on-base-matrix approach specified in the PRD.

# Base transition matrix (PRD §3)
P_BASE = np.array([
    [0.80, 0.15, 0.05, 0.00],  # From Flow
    [0.20, 0.60, 0.20, 0.00],  # From Distracted
    [0.05, 0.15, 0.80, 0.00],  # From Fatigued
    [0.70, 0.10, 0.00, 0.20],  # From Recovery
])

INITIAL_STATE = np.array([1.0, 0.0, 0.0, 0.0])  # 100 % Flow at t=0


def build_transition_matrix(alpha: float, beta: float, gamma: float) -> np.ndarray:
    """
    Build a 4x4 dynamic transition matrix by applying alpha / beta / gamma
    multipliers to the base matrix, then normalising every row to sum = 1.

    This is the Python equivalent of markovEngine.js:buildDynamicMatrix().
    """
    # Clamp inputs to safe ranges (defence in depth)
    a = max(0.3, min(3.0, alpha)) if math.isfinite(alpha) else 1.0
    b = max(1.0, min(5.0, beta)) if math.isfinite(beta) else 3.0
    g = max(0.5, min(2.0, gamma)) if math.isfinite(gamma) else 1.0

    # Map raw difficulty (1–5) → beta factor (0.8–1.2)
    beta_factor = 0.7 + b * 0.1

    # Deep-copy base matrix
    P = P_BASE.copy()

    # Row 0 — Flow
    P[0, 0] *= a                     # stay in Flow
    P[0, 1] *= beta_factor           # → Distracted
    P[0, 2] *= beta_factor * g       # → Fatigue

    # Row 1 — Distracted
    P[1, 0] *= a                     # → Flow  (recovery pull)
    P[1, 2] *= g                     # → Fatigue

    # Row 2 — Fatigued
    # NOTE: P[2,3] *= a is intentionally a no-op (base = 0.00).
    # Natural recovery from fatigue is impossible — only an external
    # break intervention can reset the state vector.
    P[2, 3] *= a                     # → Recovery  (deliberate rest)
    P[2, 1] *= g                     # → Distracted

    # Row 3 — Recovery
    P[3, 0] *= a                     # → Flow  (return to focus)

    # Normalise every row so sum(row) === 1.0
    for i in range(4):
        row_sum = P[i].sum()
        if row_sum <= 0 or np.isnan(row_sum):
            P[i] = np.array([0.25, 0.25, 0.25, 0.25])
        elif abs(row_sum - 1.0) > 1e-12:
            P[i] /= row_sum

    return P


def simulate(v0: np.ndarray, P: np.ndarray, steps: int) -> np.ndarray:
    """Evolve the probability vector for `steps` discrete 10-min ticks."""
    trajectory = np.zeros((steps + 1, 4))
    trajectory[0] = v0
    v = v0.copy()
    for t in range(steps):
        v = v @ P
        # Clamp + renormalise to prevent floating-point drift
        v = np.clip(v, 0.0, 1.0)
        s = v.sum()
        if s > 0:
            v /= s
        trajectory[t + 1] = v
    return trajectory


def find_optimal_break(trajectory: np.ndarray) -> Optional[int]:
    """
    Return the tick index (0-based) where P(Fatigue) first exceeds 50%.
    Returns None if it never crosses threshold within the simulation window.
    """
    fatigue_probs = trajectory[:, 2]  # column 2 = Fatigue
    crossings = np.where(fatigue_probs > 0.50)[0]
    return int(crossings[0]) if len(crossings) > 0 else None


# -- API Routes -----------------------------------------------------------

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/simulate")
def simulate_endpoint(
    alpha: float = 1.0,
    beta: float = 3.0,
    gamma: float = 1.0,
    steps: int = 18,       # 18 ticks = 3 hours (10 min each)
):
    """
    Run a Markov-chain simulation and return:
      - trajectory: probability vectors at each 10-min tick
      - break_tick: the optimal break insertion point (or null)
      - matrix: the transition matrix used
    """
    err = validate_params(alpha, beta, gamma, steps)
    if err:
        raise HTTPException(status_code=422, detail=err)

    P = build_transition_matrix(alpha, beta, gamma)
    trajectory = simulate(INITIAL_STATE, P, steps)
    break_tick = find_optimal_break(trajectory)

    return {
        "trajectory": trajectory.tolist(),
        "break_tick": break_tick,
        "matrix": P.tolist(),
        "params": {
            "alpha": alpha,
            "beta": beta,
            "gamma": gamma,
            "steps": steps,
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
