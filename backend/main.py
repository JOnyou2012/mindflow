from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from dataclasses import dataclass
from typing import Optional

app = FastAPI(title="MindFlow API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# -- Markov Chain Model ---------------------------------------------------

@dataclass
class MarkovParams:
    """Parameters for the dynamic Markov transition matrix."""
    alpha: float      # Personal calibration (Stroop score, 0.5–2.0)
    beta: float       # Task difficulty (1–5)
    gamma: float      # Circadian coefficient (0.8–1.3)


def build_transition_matrix(p: MarkovParams) -> np.ndarray:
    """
    Build a 4x4 transition matrix for states:
        0: Flow  |  1: Distracted  |  2: Fatigue  |  3: Recovery

    Base probabilities are scaled by alpha (personal), beta (difficulty),
    and gamma (circadian).
    """
    a, b, g = p.alpha, p.beta, p.gamma

    # Fatigue drift: harder tasks + lower personal calibration → more decay
    fatigue_drift = min(0.95, (b / 5.0) * (1.0 / a) * g * 0.25)

    # Staying in flow
    p_flow_stay = max(0.15, 0.85 - fatigue_drift * 1.5)
    p_flow_distracted = fatigue_drift * 0.8
    p_flow_fatigue = fatigue_drift * 0.2

    # From distracted
    p_dist_stay = 0.55
    p_dist_fatigue = min(0.35, 0.20 + fatigue_drift * 0.6)
    p_dist_flow = 1.0 - p_dist_stay - p_dist_fatigue

    # From fatigue (hard to escape without intervention)
    p_fat_stay = 0.75
    p_fat_recovery = 0.15
    p_fat_distracted = 0.10

    # From recovery
    p_rec_flow = 0.85
    p_rec_distracted = 0.10
    p_rec_stay = 0.05

    P = np.array([
        [p_flow_stay,      p_flow_distracted, p_flow_fatigue,   0.0             ],
        [p_dist_flow,       p_dist_stay,       p_dist_fatigue,   0.0             ],
        [0.0,               p_fat_distracted,  p_fat_stay,       p_fat_recovery  ],
        [p_rec_flow,        p_rec_distracted,  0.0,              p_rec_stay      ],
    ])
    return P


def simulate(v0: np.ndarray, P: np.ndarray, steps: int) -> np.ndarray:
    """Evolve the probability vector for `steps` discrete 10-min ticks."""
    trajectory = np.zeros((steps + 1, 4))
    trajectory[0] = v0
    v = v0.copy()
    for t in range(steps):
        v = v @ P
        trajectory[t + 1] = v
    return trajectory


def find_optimal_break(trajectory: np.ndarray) -> Optional[int]:
    """
    Return the tick index (0-based) where P(Fatigue) first exceeds 40%.
    Returns None if it never crosses threshold within the simulation window.
    """
    fatigue_probs = trajectory[:, 2]  # column 2 = Fatigue
    crossings = np.where(fatigue_probs > 0.40)[0]
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
    params = MarkovParams(alpha=alpha, beta=beta, gamma=gamma)
    P = build_transition_matrix(params)
    v0 = np.array([0.90, 0.07, 0.02, 0.01])  # start mostly in Flow
    trajectory = simulate(v0, P, steps)
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
