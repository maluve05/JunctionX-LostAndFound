"""PLONK as a queryable probability map over PT/ES/FR (plan §4b).

Self-contained: views (PIL images) in; region shares, candidate likelihoods and
localizability out. The model sits behind a small ``Backend`` protocol so that
tests (and teammates without torch) can use ``StubBackend``.

    engine = PlonkEngine()                        # loads PLONK lazily, once per process
    report = engine.region_report("round_07", views)            # Layer-1 SpecialistReport
    scores = engine.score_candidates(views, [(43.5, -7.0), ...])  # mean log-likelihood per point
    lat, lon, ll = engine.best_in_region(views, "ES-GA")         # grid search fallback
    probs = combine(report.region_scores, reasoning_probs, alpha=0.5)
"""
from __future__ import annotations

import hashlib
import math
from typing import Any, Protocol, Sequence

import numpy as np

from regions import REGIONS, country_of, haversine_km, region_of
from schemas import SpecialistReport

Coord = tuple[float, float]  # (lat, lon)
COUNTRY_BBOX = (27.5, -31.5, 51.2, 9.7)  # lat_min, lon_min, lat_max, lon_max: covers PT/ES/FR incl. islands
DEFAULT_CFG = 0.0  # PLONK guidance scale (library default 0); higher = sharper samples. Tune on the eval set.


class Backend(Protocol):
    def embed(self, image: Any) -> Any: ...
    def sample(self, image: Any, n: int, cfg: float) -> np.ndarray: ...       # (n, 2) lat, lon in degrees
    def log_likelihood(self, emb: Any, coords: np.ndarray) -> np.ndarray: ...  # (k,) for (k, 2) coords
    def localizability(self, image: Any) -> float: ...


# ------------------------------------------------------------------ pure helpers
def region_shares(samples: Sequence[Coord]) -> dict[str, float]:
    """Map samples to regions, drop those outside PT/ES/FR, return share per region (sums to 1)."""
    counts: dict[str, int] = {}
    for lat, lon in samples:
        r = region_of(float(lat), float(lon))
        if r is not None:
            counts[r] = counts.get(r, 0) + 1
    total = sum(counts.values())
    return {r: c / total for r, c in sorted(counts.items(), key=lambda kv: -kv[1])} if total else {}


def combine(p_plonk: dict[str, float], p_reasoning: dict[str, float], alpha: float = 0.5,
            floor: float = 1e-3, hard_filter: set[str] | None = None) -> dict[str, float]:
    """p(region) ∝ p_plonk(region)^alpha · p_reasoning(region), renormalised to sum to 1.

    ``floor`` keeps a region PLONK never sampled from being zeroed out by it.
    ``hard_filter`` (allowlist codes, regions or countries) sets p = 0 outside it.
    Country-level codes in ``p_reasoning`` are spread over that country's regions.
    """
    reasoning: dict[str, float] = {}
    for code, p in p_reasoning.items():
        if "-" in code:
            reasoning[code] = reasoning.get(code, 0.0) + p
        else:
            members = [r for r in REGIONS if country_of(r) == code]
            for r in members:
                reasoning[r] = reasoning.get(r, 0.0) + p / len(members)
    out = {}
    for r, pr in reasoning.items():
        if hard_filter and r not in hard_filter and country_of(r) not in hard_filter:
            continue
        out[r] = max(p_plonk.get(r, 0.0), floor) ** alpha * pr
    z = sum(out.values())
    return {r: v / z for r, v in sorted(out.items(), key=lambda kv: -kv[1])} if z > 0 else {}


def grid_points(region: str | None = None, spacing_km: float = 5.0,
                center: Coord | None = None, radius_km: float | None = None) -> list[Coord]:
    """Grid ~spacing_km apart inside ``region`` and/or within ``radius_km`` of ``center``."""
    if center is not None and radius_km is not None:
        lat0, lon0 = center
        dlat = radius_km / 111.0
        dlon = radius_km / (111.0 * max(math.cos(math.radians(lat0)), 0.1))
        bbox = (lat0 - dlat, lon0 - dlon, lat0 + dlat, lon0 + dlon)
    elif region is not None:
        _, lat0, lon0 = REGIONS[region]
        r = 450.0  # generous; region_of() filtering trims it
        bbox = (lat0 - r / 111, lon0 - r / (111 * math.cos(math.radians(lat0))),
                lat0 + r / 111, lon0 + r / (111 * math.cos(math.radians(lat0))))
    else:
        raise ValueError("need a region or a center + radius")
    lat_min, lon_min, lat_max, lon_max = bbox
    step_lat = spacing_km / 111.0
    pts = []
    lat = lat_min
    while lat <= lat_max:
        step_lon = spacing_km / (111.0 * max(math.cos(math.radians(lat)), 0.1))
        lon = lon_min
        while lon <= lon_max:
            ok = True
            if center is not None and radius_km is not None:
                ok = haversine_km(lat, lon, *center) <= radius_km
            if ok and region is not None:
                ok = region_of(lat, lon) == region
            if ok:
                pts.append((round(lat, 5), round(lon, 5)))
            lon += step_lon
        lat += step_lat
    return pts


def _haversine_matrix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """(len(a), len(b)) great-circle distances in km between (lat, lon) degree arrays."""
    la1, lo1 = np.radians(a[:, :1]), np.radians(a[:, 1:2])
    la2, lo2 = np.radians(b[:, 0])[None, :], np.radians(b[:, 1])[None, :]
    h = np.sin((la2 - la1) / 2) ** 2 + np.cos(la1) * np.cos(la2) * np.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371.0088 * np.arcsin(np.sqrt(np.clip(h, 0, 1)))


def kde_log_density(samples: np.ndarray, coords: np.ndarray, bandwidth_km: float = 30.0) -> np.ndarray:
    """log of a Gaussian-kernel density of ``samples`` at ``coords`` (up to a constant)."""
    if len(samples) == 0:
        return np.full(len(coords), -np.inf)
    d = _haversine_matrix(np.asarray(coords, float).reshape(-1, 2), np.asarray(samples, float).reshape(-1, 2))
    logk = -0.5 * (d / bandwidth_km) ** 2
    m = logk.max(axis=1, keepdims=True)
    return (m + np.log(np.exp(logk - m).mean(axis=1, keepdims=True))).reshape(-1)


def concentration(samples: np.ndarray, radius_km: float = 150.0) -> float:
    """Share of samples within ``radius_km`` of the densest sample: a cheap localizability proxy (0–1)."""
    samples = np.asarray(samples, float).reshape(-1, 2)
    if len(samples) == 0:
        return 0.0
    if len(samples) > 1000:
        samples = samples[np.linspace(0, len(samples) - 1, 1000).astype(int)]
    near = _haversine_matrix(samples, samples) < radius_km
    return float(near.sum(axis=1).max() / len(samples))


def _thin(points: list[Coord], cap: int) -> list[Coord]:
    if len(points) <= cap:
        return points
    idx = np.linspace(0, len(points) - 1, cap).round().astype(int)
    return [points[i] for i in idx]


def _image_key(image: Any) -> str:
    try:
        data = image.tobytes()  # PIL image
    except AttributeError:
        data = repr(image).encode()
    return hashlib.sha1(data).hexdigest()


# ------------------------------------------------------------------ engine
class PlonkEngine:
    """``scorer``: "exact" = PLONK ODE likelihood; "kde" = density of PLONK's own samples
    (cheap; the only practical option on CPU, where exact costs ~2 s per point); "auto" picks
    exact when the backend reports ``is_fast`` (GPU). In kde mode ``localizability`` is a proxy:
    the share of samples within 150 km of the densest sample (0–1), not PLONK's own measure, so
    tune the low-confidence threshold separately per mode.
    """

    def __init__(self, backend: Backend | None = None, max_points_per_round: int = 2000,
                 scorer: str = "auto", n_samples: int | None = None, kde_bandwidth_km: float = 30.0):
        self._backend = backend
        self.max_points = max_points_per_round
        self._scorer = scorer
        self._n_samples = n_samples
        self.bandwidth = kde_bandwidth_km
        self._emb_cache: dict[str, Any] = {}
        self._sample_cache: dict[tuple[str, int, float], np.ndarray] = {}
        self._loc_cache: dict[str, float] = {}

    @property
    def backend(self) -> Backend:
        if self._backend is None:
            self._backend = PlonkBackend()
        return self._backend

    @property
    def exact(self) -> bool:
        if self._scorer == "auto":
            return bool(getattr(self.backend, "is_fast", True))
        return self._scorer == "exact"

    @property
    def n_samples(self) -> int:
        """Samples per view: 1000 with exact scoring (GPU), 300 otherwise (~10 s per view on CPU)."""
        return self._n_samples or (1000 if self.exact else 300)

    # --- cached primitives
    def embed(self, image) -> Any:
        k = _image_key(image)
        if k not in self._emb_cache:
            self._emb_cache[k] = self.backend.embed(image)
        return self._emb_cache[k]

    def sample(self, image, n: int | None = None, cfg: float = DEFAULT_CFG) -> np.ndarray:
        k = (_image_key(image), n or self.n_samples, cfg)
        if k not in self._sample_cache:
            self._sample_cache[k] = np.asarray(self.backend.sample(image, k[1], cfg), dtype=float).reshape(-1, 2)
        return self._sample_cache[k]

    def localizability(self, image) -> float:
        k = _image_key(image)
        if k not in self._loc_cache:
            if self.exact:
                self._loc_cache[k] = float(self.backend.localizability(image))
            else:
                self._loc_cache[k] = concentration(self.sample(image))
        return self._loc_cache[k]

    def pooled_samples(self, views: Sequence[Any], max_views: int = 3) -> np.ndarray:
        """Samples of the ``max_views`` most localizable views, concatenated."""
        views = list(views)
        locs = [self.localizability(v) for v in views]
        order = sorted(range(len(views)), key=lambda i: -locs[i])[:max_views]
        return np.concatenate([self.sample(views[i]) for i in order])

    # --- Layer 1: image-only vote
    def region_report(self, image_id: str, views: Sequence[Any], max_views: int = 3) -> SpecialistReport:
        """Sample per view (one call per view), pool, map to regions -> SpecialistReport('plonk').

        Uses the ``max_views`` views PLONK finds most localizable.
        """
        views = list(views)
        if not views:
            return SpecialistReport(specialist="plonk", image_id=image_id, clues=[])
        locs = [self.localizability(v) for v in views]
        samples = self.pooled_samples(views, max_views)
        return SpecialistReport(
            specialist="plonk",
            image_id=image_id,
            clues=[],
            region_scores=region_shares([tuple(s) for s in samples]),
            localizability=float(np.mean(locs)),
        )

    # --- candidate scoring
    def score_candidates(self, views: Sequence[Any], coords: Sequence[Coord]) -> list[float]:
        """Mean (over views) PLONK log-likelihood of each coordinate. Capped per round.

        In kde mode: log density of the pooled samples at each point (no cap; cheap).
        """
        coords = list(coords)
        if not coords or not views:
            return [float("-inf")] * len(coords)
        arr = np.asarray(coords, dtype=float)
        if not self.exact:
            return list(kde_log_density(self.pooled_samples(views), arr, self.bandwidth))
        if len(coords) > self.max_points:
            raise ValueError(f"{len(coords)} points > cap {self.max_points}; thin them first")
        total = np.zeros(len(coords))
        for v in views:
            total += np.asarray(self.backend.log_likelihood(self.embed(v), arr), dtype=float).reshape(-1)
        return list(total / len(views))

    def rank_candidates(self, views: Sequence[Any], coords: Sequence[Coord],
                        log_p_reasoning: Sequence[float] | None = None) -> list[tuple[Coord, float]]:
        """Rank by log p_plonk + log p_reasoning (descending)."""
        ll = self.score_candidates(views, coords)
        if log_p_reasoning is not None:
            ll = [a + b for a, b in zip(ll, log_p_reasoning)]
        return sorted(zip(coords, ll), key=lambda t: -t[1])

    def best_in_region(self, views: Sequence[Any], region: str | None = None, spacing_km: float = 5.0,
                       center: Coord | None = None, radius_km: float | None = None) -> tuple[float, float, float] | None:
        """Grid search (plan §4b point 4): best (lat, lon, mean log-lik) or None if the grid is empty.

        Grids larger than the per-round cap are thinned uniformly, then refined around
        the coarse winner at full ``spacing_km`` resolution.
        """
        pts = grid_points(region, spacing_km, center, radius_km)
        if not pts:
            return None
        coarse = _thin(pts, self.max_points)
        (lat, lon), ll = self.rank_candidates(views, coarse)[0]
        if len(pts) > len(coarse):
            approx_spacing = spacing_km * math.sqrt(len(pts) / len(coarse))
            fine = grid_points(region, spacing_km, center=(lat, lon), radius_km=approx_spacing * 1.5)
            fine = _thin(fine, self.max_points)
            if fine:
                (lat, lon), ll = self.rank_candidates(views, fine)[0]
        return lat, lon, ll


# ------------------------------------------------------------------ backends
class StubBackend:
    """Deterministic fake: samples are fixed; log-likelihood is a Gaussian bump around ``peak``."""

    def __init__(self, samples: Sequence[Coord] = (), peak: Coord = (40.4, -3.7),
                 sigma_km: float = 200.0, localizability: float = 0.5):
        self.samples = np.asarray(samples, dtype=float).reshape(-1, 2)
        self.peak, self.sigma, self.loc = peak, sigma_km, localizability
        self.is_fast = True
        self.calls = {"embed": 0, "sample": 0, "log_likelihood": 0}

    def embed(self, image):
        self.calls["embed"] += 1
        return _image_key(image)

    def sample(self, image, n, cfg):
        self.calls["sample"] += 1
        if len(self.samples) == 0:
            return np.tile(self.peak, (n, 1))
        reps = int(math.ceil(n / len(self.samples)))
        return np.tile(self.samples, (reps, 1))[:n]

    def log_likelihood(self, emb, coords):
        self.calls["log_likelihood"] += 1
        d = np.array([haversine_km(la, lo, *self.peak) for la, lo in coords])
        return -0.5 * (d / self.sigma) ** 2

    def localizability(self, image):
        return self.loc


class PlonkBackend:
    """Real PLONK (``pip install diff-plonk``), checkpoint ``nicolas-dufour/PLONK_OSV_5M``."""

    def __init__(self, checkpoint: str = "nicolas-dufour/PLONK_OSV_5M", device: str | None = None,
                 localizability_samples: int = 128, likelihood_batch: int = 256,
                 sample_steps: int | None = None, ode_tol: float | None = None):
        """``sample_steps`` and ``ode_tol`` trade accuracy for speed. Defaults: library settings on GPU;
        on CPU 32 steps (5x faster, same sample quality) and tol 1e-3 (7x faster, same ranking) —
        measured 2026-10-10 on a Santiago de Compostela panorama, see day0_plonk.py."""
        import torch
        from plonk.pipe import PlonkPipeline

        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.pipe = PlonkPipeline(checkpoint, device=self.device)
        cpu = self.device == "cpu"
        self.is_fast = not cpu
        self.loc_samples = localizability_samples if not cpu else 16
        self.batch = likelihood_batch
        self.sample_steps = sample_steps if sample_steps is not None else (32 if cpu else None)
        self.tol = ode_tol if ode_tol is not None else (1e-3 if cpu else 1e-6)

    def embed(self, image):
        # the only way to get PLONK's embedding: the same preprocessing its methods call internally
        return self.pipe.cond_preprocessing({"img": [image]})["emb"]

    def sample(self, image, n, cfg):
        out = self.pipe(image, batch_size=n, cfg=cfg, num_steps=self.sample_steps)
        return np.asarray(out, dtype=float).reshape(-1, 2)  # degrees (lat, lon)

    def log_likelihood(self, emb, coords):
        coords = np.asarray(coords, dtype=float).reshape(-1, 2)
        out = [_to_numpy(self.pipe.compute_likelihood(emb=emb, coordinates=coords[i:i + self.batch],
                                                      atol=self.tol, rtol=self.tol)).reshape(-1)
               for i in range(0, len(coords), self.batch)]
        return np.concatenate(out) if out else np.zeros(0)

    def localizability(self, image):
        val = self.pipe.compute_localizability(image, number_monte_carlo_samples=self.loc_samples,
                                               atol=self.tol, rtol=self.tol)
        return float(_to_numpy(val).reshape(-1).mean())


def _to_numpy(x) -> np.ndarray:
    try:
        return x.detach().cpu().numpy()
    except AttributeError:
        return np.asarray(x)
