"""
MindFlow API v2 — Non-linear Markov Chain Cognitive Model

Mathematical features:
  - Sigmoidal transition modifiers (logistic instead of linear)
  - State-dependent circadian sensitivity
  - Flow-entry warmup period
  - Optimal break duration computation
  - Recovery state computation

⚠️  Reference implementation of the v2 engine.  The frontend
(src/utils/markovEngine.js) runs v5 — trajectories and break
durations differ between the two.  Do not treat this API as a
mirror of the current engine until v5 is ported.
"""

from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
import math
import numpy as np
from typing import Optional

from pydantic import BaseModel

app = FastAPI(title="MindFlow API", version="0.2.0")

# CORS: local dev (Vite) + deployed production frontend.
#
# The frontend runs client-side by default (no API calls), but if you
# import api.js and call these endpoints, the browser enforces CORS.
# Origins allowed:
#   1. localhost:5173 / 127.0.0.1:5173 — Vite dev server
#   2. MDFLOW_FRONTEND_ORIGIN env var — your deployed frontend URL
#      (e.g. https://myapp.netlify.app).  Set this in the Render
#      dashboard (render.yaml declares it with sync:false).
#   3. RENDER_EXTERNAL_URL — auto-set by Render; covers the case
#      where both frontend and backend are on the same Render project.
#
# ⚠️  MDFLOW_FRONTEND_ORIGIN *must* be set manually when the frontend
# is on Netlify/Vercel/etc. — there is no way for the backend to
# auto-discover a separately-deployed frontend's URL.
import os as _os
_cors_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
_frontend_env = _os.environ.get("MDFLOW_FRONTEND_ORIGIN", "")
if _frontend_env:
    # Accept a comma-separated list of origins.  A raw append would treat
    # "https://a.com,https://b.com" as one literal origin, which never
    # matches a real Origin header (Starlette does exact membership checks).
    _cors_origins.extend(o.strip() for o in _frontend_env.split(",") if o.strip())
if not _frontend_env:
    print(
        "[MindFlow] WARNING: MDFLOW_FRONTEND_ORIGIN is not set — "
        "the deployed frontend will be CORS-blocked until it is configured.",
        flush=True,
    )
_render_url = _os.environ.get("RENDER_EXTERNAL_URL", "")
if _render_url:
    _cors_origins.append(_render_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -- Constants ---------------------------------------------------------------

P_BASE = np.array([
    [0.80, 0.15, 0.05, 0.00],  # From Flow
    [0.20, 0.60, 0.20, 0.00],  # From Distracted
    [0.05, 0.15, 0.80, 0.00],  # From Fatigued
    [0.70, 0.10, 0.00, 0.20],  # From Recovery
])

INITIAL_STATE = np.array([1.0, 0.0, 0.0, 0.0])

WARMUP_TICKS = 3
WARMUP_TAU = 1.5
WARMUP_MIN = 0.70
RECOVERY_TAU_MINUTES = 120

# -- Validation --------------------------------------------------------------

def validate_params(alpha: float, beta: float, gamma: float, steps: int) -> Optional[str]:
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

# -- Math helpers ------------------------------------------------------------

def sigmoid(x: float, center: float, steepness: float) -> float:
    """Logistic sigmoid: σ(x) = 1 / (1 + e^(−k(x − x₀)))."""
    return 1.0 / (1.0 + math.exp(-steepness * (x - center)))

def clamp(x: float) -> float:
    """Clamp to [0, 1] with NaN guard."""
    if not math.isfinite(x):
        return 0.0
    if x < 0:
        return 0.0
    if x > 1:
        return 1.0
    if x < 1e-10:
        return 0.0
    return x

# -- Matrix construction -----------------------------------------------------

def build_transition_matrix(
    alpha: float, beta: float, gamma: float,
    tick: int = 0, current_fatigue: float = 0.0
) -> np.ndarray:
    """
    Build 4×4 dynamic transition matrix using sigmoidal modifiers.

    This is the Python equivalent of markovEngine.js:buildDynamicMatrix() v2.
    """
    a = max(0.3, min(3.0, alpha)) if math.isfinite(alpha) else 1.0
    b = max(1.0, min(5.0, beta)) if math.isfinite(beta) else 3.0
    g = max(0.5, min(2.0, gamma)) if math.isfinite(gamma) else 1.0

    # Sigmoidal modifiers
    alpha_flow_mod = sigmoid(a, 1.0, 5.0)
    alpha_recovery_mod = sigmoid(a, 1.0, 3.5)
    beta_fatigue_mod = sigmoid(b, 3.0, 1.2)
    beta_distract_mod = sigmoid(b, 3.5, 1.5)

    # State-dependent gamma: hits harder when already fatigued
    gamma_state_boost = 1.0 + current_fatigue * 0.6
    effective_gamma = 1.0 + (g - 1.0) * gamma_state_boost
    gamma_mod = max(0.5, min(2.0, effective_gamma))

    # Warmup factor
    if tick < WARMUP_TICKS:
        warmup_factor = WARMUP_MIN + (1.0 - WARMUP_MIN) * (1.0 - math.exp(-tick / WARMUP_TAU))
    else:
        warmup_factor = 1.0

    P = P_BASE.copy()

    # Row 0 — Flow
    P[0, 0] *= alpha_flow_mod * warmup_factor
    P[0, 1] *= (1.0 + beta_distract_mod)
    P[0, 2] *= (1.0 + beta_fatigue_mod) * gamma_mod

    # Row 1 — Distracted
    P[1, 0] *= alpha_flow_mod
    P[1, 1] *= (2.0 - alpha_flow_mod)
    P[1, 2] *= gamma_mod

    # Row 2 — Fatigued
    P[2, 0] *= (0.3 + alpha_flow_mod * 0.2)
    P[2, 1] *= gamma_mod
    P[2, 2] *= gamma_mod
    P[2, 3] *= alpha_recovery_mod

    # Row 3 — Recovery
    P[3, 0] *= alpha_recovery_mod
    P[3, 1] *= (1.5 - alpha_flow_mod * 0.5)
    P[3, 3] *= alpha_flow_mod

    # Normalise rows
    for i in range(4):
        row_sum = P[i].sum()
        if row_sum <= 0 or not math.isfinite(row_sum):
            P[i] = np.array([0.25, 0.25, 0.25, 0.25])
        elif abs(row_sum - 1.0) > 1e-12:
            P[i] /= row_sum

    return P

# -- Simulation --------------------------------------------------------------

def simulate(v0: np.ndarray, alpha: float, beta: float, gamma: float,
             steps: int) -> np.ndarray:
    """Evolve state vector for `steps` ticks with state-dependent matrix."""
    trajectory = np.zeros((steps + 1, 4))
    trajectory[0] = v0
    v = v0.copy()

    for t in range(steps):
        current_fatigue = float(v[2])
        P = build_transition_matrix(alpha, beta, gamma, t, current_fatigue)
        v = v @ P
        v = np.clip(v, 0.0, 1.0)
        s = float(v.sum())
        if s > 0:
            v /= s
        trajectory[t + 1] = v

    return trajectory

def find_optimal_break(trajectory: np.ndarray) -> Optional[int]:
    """Return tick where P(Fatigue) first exceeds 50%, or None."""
    fatigue_probs = trajectory[:, 2]
    crossings = np.where(fatigue_probs > 0.50)[0]
    return int(crossings[0]) if len(crossings) > 0 else None

# -- Break optimization ------------------------------------------------------

def compute_optimal_break_duration(
    trajectory: np.ndarray, burnout_tick: int, target_fatigue: float = 0.30
) -> int:
    """
    Compute optimal break duration to reduce fatigue below target.

    Inverts recovery curve: t = −τ × ln(target / current)
    """
    if burnout_tick <= 0 or burnout_tick >= len(trajectory):
        return 15

    current_fatigue = float(trajectory[burnout_tick, 2])
    current_flow = float(trajectory[burnout_tick, 0])

    if current_fatigue <= target_fatigue:
        return 5

    ratio = target_fatigue / current_fatigue
    if ratio <= 0 or ratio >= 1:
        return 15

    raw_minutes = -RECOVERY_TAU_MINUTES * math.log(ratio)
    recovery_capacity = current_flow * 0.8 + 0.2
    adjusted_minutes = raw_minutes / recovery_capacity

    return max(5, min(60, round(adjusted_minutes / 5) * 5))


def compute_recovery_state(
    current_state: np.ndarray, break_minutes: float = 15.0
) -> np.ndarray:
    """
    Compute post-break cognitive state using non-linear recovery.

    Fatigue decays exponentially; flow rebuilds proportionally.
    """
    flow, distracted, fatigue, recovery = current_state

    decay_factor = math.exp(-break_minutes / RECOVERY_TAU_MINUTES)
    new_fatigue = fatigue * decay_factor
    fatigue_reduced = fatigue - new_fatigue

    conversion_efficiency = 0.7 if flow > 0.3 else 0.4
    to_flow = fatigue_reduced * conversion_efficiency
    to_recovery = fatigue_reduced * (1.0 - conversion_efficiency)

    new_flow = flow + to_flow
    new_distracted = distracted * decay_factor
    distracted_reduced = distracted - new_distracted
    new_flow += distracted_reduced * 0.5
    new_recovery = recovery + to_recovery + distracted_reduced * 0.5

    result = np.array([
        clamp(new_flow),
        clamp(new_distracted),
        clamp(new_fatigue),
        clamp(new_recovery),
    ])

    s = float(result.sum())
    if s > 0 and math.isfinite(s):
        result /= s

    return result

# -- Request models -----------------------------------------------------------
# Endpoints accept a JSON body (what src/utils/api.js sends) OR query params
# (curl / older callers).  The body takes precedence when present.

class SimulateRequest(BaseModel):
    alpha: float = 1.0
    beta: float = 3.0
    gamma: float = 1.0
    steps: int = 18


class RecoveryRequest(BaseModel):
    flow: float = 0.3
    distracted: float = 0.2
    fatigue: float = 0.4
    recovery: float = 0.1
    break_minutes: float = 15.0


# -- API Routes --------------------------------------------------------------

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.2.0"}


@app.post("/api/simulate")
def simulate_endpoint(
    body: Optional[SimulateRequest] = Body(default=None),
    alpha: float = 1.0,
    beta: float = 3.0,
    gamma: float = 1.0,
    steps: int = 18,
):
    if body is not None:
        alpha, beta, gamma, steps = body.alpha, body.beta, body.gamma, body.steps
    """
    Run a non-linear Markov-chain simulation.

    Returns:
      - trajectory: probability vectors at each 10-min tick
      - break_tick: optimal break insertion tick (or null)
      - optimal_break_minutes: computed optimal break duration
      - matrix: transition matrix built at tick 0
      - params: input parameters
    """
    err = validate_params(alpha, beta, gamma, steps)
    if err:
        raise HTTPException(status_code=422, detail=err)

    P = build_transition_matrix(alpha, beta, gamma)
    trajectory = simulate(INITIAL_STATE, alpha, beta, gamma, steps)
    break_tick = find_optimal_break(trajectory)

    optimal_break_minutes = None
    if break_tick is not None:
        optimal_break_minutes = compute_optimal_break_duration(
            trajectory, break_tick
        )

    return {
        "trajectory": trajectory.tolist(),
        "break_tick": break_tick,
        "optimal_break_minutes": optimal_break_minutes,
        "matrix": P.tolist(),
        "params": {
            "alpha": alpha,
            "beta": beta,
            "gamma": gamma,
            "steps": steps,
        },
    }


@app.post("/api/recovery")
def recovery_endpoint(
    body: Optional[RecoveryRequest] = Body(default=None),
    flow: float = 0.3,
    distracted: float = 0.2,
    fatigue: float = 0.4,
    recovery: float = 0.1,
    break_minutes: float = 15.0,
):
    """
    Compute post-break cognitive state after a rest period.

    Body (or query params): current state vector + break duration in minutes.
    Returns: new state vector after recovery.
    """
    if body is not None:
        flow, distracted, fatigue, recovery, break_minutes = (
            body.flow, body.distracted, body.fatigue, body.recovery, body.break_minutes
        )
    vals = [flow, distracted, fatigue, recovery, break_minutes]
    if not all(math.isfinite(v) for v in vals):
        raise HTTPException(status_code=422, detail="all inputs must be finite numbers")
    if any(v < 0 for v in vals):
        raise HTTPException(status_code=422, detail="all inputs must be >= 0")
    current = np.array([flow, distracted, fatigue, recovery])
    # Normalize input
    s = float(current.sum())
    if s > 0 and math.isfinite(s):
        current /= s

    new_state = compute_recovery_state(current, break_minutes)

    return {
        "before": {
            "flow": round(float(current[0]), 4),
            "distracted": round(float(current[1]), 4),
            "fatigue": round(float(current[2]), 4),
            "recovery": round(float(current[3]), 4),
        },
        "after": {
            "flow": round(float(new_state[0]), 4),
            "distracted": round(float(new_state[1]), 4),
            "fatigue": round(float(new_state[2]), 4),
            "recovery": round(float(new_state[3]), 4),
        },
        "break_minutes": break_minutes,
    }


if __name__ == "__main__":
    import uvicorn
    # Bind to 0.0.0.0 in production (Render sets PORT), 127.0.0.1 locally.
    # Render's startCommand overrides this entirely — this is only for
    # `python main.py` during local development.
    uvicorn.run(app, host="127.0.0.1", port=8000)
