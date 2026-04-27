"""Fuzzy membership functions and linguistic variable definitions.

All membership functions return a value in [0, 1] indicating the degree to
which a crisp value belongs to a fuzzy set. Implementations are deliberately
hand-written (no external libraries) so the agent can be reasoned about and
evaluated for academic purposes.
"""

from __future__ import annotations

from typing import Callable, Dict


def triangular(x: float, a: float, b: float, c: float) -> float:
    """Triangular MF with feet at a, c and peak at b."""
    if x <= a or x >= c:
        return 0.0
    if x == b:
        return 1.0
    if x < b:
        return (x - a) / (b - a) if b != a else 1.0
    return (c - x) / (c - b) if c != b else 1.0


def trapezoidal(x: float, a: float, b: float, c: float, d: float) -> float:
    """Trapezoidal MF with feet at a, d and shoulders at b, c."""
    if x <= a or x >= d:
        return 0.0
    if b <= x <= c:
        return 1.0
    if x < b:
        return (x - a) / (b - a) if b != a else 1.0
    return (d - x) / (d - c) if d != c else 1.0


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


# ---------------------------------------------------------------------------
# Linguistic variables. Each variable maps a fuzzy set name to a callable
# that takes a crisp value and returns the membership degree.
# ---------------------------------------------------------------------------

# Shuttle height in metres (court net ~1.55m).
SHUTTLE_HEIGHT: Dict[str, Callable[[float], float]] = {
    "low":    lambda x: trapezoidal(x, -0.1, 0.0, 0.6, 1.2),
    "medium": lambda x: triangular(x, 0.8, 1.6, 2.4),
    "high":   lambda x: trapezoidal(x, 2.0, 2.8, 5.0, 6.0),
}

# Lateral interpretation of zones 1..8.
SHUTTLE_LATERAL: Dict[str, Callable[[float], float]] = {
    "left":   lambda x: trapezoidal(x, 0.5, 1.0, 2.5, 3.5),
    "center": lambda x: triangular(x, 3.0, 4.5, 6.0),
    "right":  lambda x: trapezoidal(x, 5.5, 6.5, 8.0, 8.5),
}

# Depth interpretation of zones 1..8.
SHUTTLE_DEPTH: Dict[str, Callable[[float], float]] = {
    "front": lambda x: trapezoidal(x, 0.5, 1.0, 3.0, 4.5),
    "back":  lambda x: trapezoidal(x, 4.5, 6.0, 8.0, 8.5),
}

# Stamina 0..100.
STAMINA: Dict[str, Callable[[float], float]] = {
    "low":    lambda x: trapezoidal(x, -1.0, 0.0, 25.0, 45.0),
    "medium": lambda x: triangular(x, 30.0, 55.0, 80.0),
    "high":   lambda x: trapezoidal(x, 65.0, 85.0, 100.0, 101.0),
}

# Power bar 0..100.
POWER: Dict[str, Callable[[float], float]] = {
    "empty":    lambda x: trapezoidal(x, -1.0, 0.0, 15.0, 35.0),
    "charging": lambda x: triangular(x, 25.0, 55.0, 85.0),
    "full":     lambda x: trapezoidal(x, 75.0, 95.0, 100.0, 101.0),
}

# Distance to opponent in normalised court units (0..~1.4).
OPPONENT_DISTANCE: Dict[str, Callable[[float], float]] = {
    "near": lambda x: trapezoidal(x, -0.1, 0.0, 0.25, 0.45),
    "far":  lambda x: trapezoidal(x, 0.35, 0.55, 1.5, 2.0),
}

# Score difference (own minus opponent), roughly -21..21.
SCORE_DIFF: Dict[str, Callable[[float], float]] = {
    "losing":   lambda x: trapezoidal(x, -25.0, -21.0, -3.0, -1.0),
    "balanced": lambda x: triangular(x, -3.0, 0.0, 3.0),
    "winning":  lambda x: trapezoidal(x, 1.0, 3.0, 21.0, 25.0),
}


def evaluate_variable(
    value: float,
    sets: Dict[str, Callable[[float], float]],
) -> Dict[str, float]:
    """Return {set_name: membership} for a crisp value. None -> all zeros."""
    if value is None:
        return {name: 0.0 for name in sets}
    out: Dict[str, float] = {}
    v = float(value)
    for name, fn in sets.items():
        out[name] = float(_clamp(fn(v), 0.0, 1.0))
    return out
