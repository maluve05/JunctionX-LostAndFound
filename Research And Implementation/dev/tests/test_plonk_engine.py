import math

import pytest

import numpy as np

from plonk_engine import (PlonkEngine, StubBackend, combine, concentration, grid_points, kde_log_density,
                          region_shares)

LISBON, SEVILLE, RENNES, BERLIN, NYC = (38.72, -9.14), (37.39, -5.98), (48.11, -1.68), (52.52, 13.40), (40.7, -74.0)


def test_region_shares_drops_outside_and_counts():
    shares = region_shares([LISBON, LISBON, SEVILLE, RENNES, BERLIN, NYC])
    assert shares == pytest.approx({"PT-11": 0.5, "ES-AN": 0.25, "FR-BRE": 0.25})


def test_region_shares_all_outside():
    assert region_shares([BERLIN, NYC]) == {}


def test_combine_follows_formula():
    p_plonk = {"ES-GA": 0.6, "ES-AS": 0.2}
    p_reason = {"ES-GA": 0.3, "ES-AS": 0.7}
    out = combine(p_plonk, p_reason, alpha=1.0)
    z = 0.6 * 0.3 + 0.2 * 0.7
    assert out["ES-GA"] == pytest.approx(0.18 / z)
    assert out["ES-AS"] == pytest.approx(0.14 / z)
    assert sum(out.values()) == pytest.approx(1.0)


def test_combine_alpha_zero_ignores_plonk():
    out = combine({"ES-GA": 0.99}, {"ES-GA": 0.25, "ES-AS": 0.75}, alpha=0.0)
    assert out == pytest.approx({"ES-GA": 0.25, "ES-AS": 0.75})


def test_combine_hard_filter():
    out = combine({"ES-GA": 0.5, "PT-16": 0.5}, {"ES-GA": 0.5, "PT-16": 0.5}, hard_filter={"PT"})
    assert out == pytest.approx({"PT-16": 1.0})


def test_combine_spreads_country_codes():
    out = combine({}, {"FR": 1.0}, alpha=1.0)
    assert len(out) == 13 and sum(out.values()) == pytest.approx(1.0)


def test_best_scored_candidate_wins():
    engine = PlonkEngine(StubBackend(peak=SEVILLE))
    ranked = engine.rank_candidates(["v1", "v2"], [LISBON, SEVILLE, RENNES])
    assert ranked[0][0] == SEVILLE


def test_reasoning_prior_can_flip_ranking():
    engine = PlonkEngine(StubBackend(peak=SEVILLE, sigma_km=1000))
    ranked = engine.rank_candidates(["v"], [LISBON, SEVILLE], log_p_reasoning=[0.0, -5.0])
    assert ranked[0][0] == LISBON


def test_embedding_computed_once_per_view():
    backend = StubBackend(peak=SEVILLE)
    engine = PlonkEngine(backend)
    engine.score_candidates(["v1"], [LISBON])
    engine.score_candidates(["v1"], [SEVILLE, RENNES])
    assert backend.calls["embed"] == 1
    assert backend.calls["log_likelihood"] == 2


def test_point_cap():
    engine = PlonkEngine(StubBackend(), max_points_per_round=10)
    with pytest.raises(ValueError):
        engine.score_candidates(["v"], [LISBON] * 11)


def test_region_report():
    engine = PlonkEngine(StubBackend(samples=[LISBON, LISBON, SEVILLE, BERLIN], localizability=0.7), n_samples=8)
    rep = engine.region_report("img", ["a", "b"])
    assert rep.specialist == "plonk" and rep.clues == []
    assert rep.region_scores == pytest.approx({"PT-11": 2 / 3, "ES-AN": 1 / 3})
    assert rep.localizability == pytest.approx(0.7)


def test_grid_points_within_radius():
    pts = grid_points(center=SEVILLE, radius_km=25, spacing_km=5)
    assert 50 < len(pts) < 120  # ≈ π·25²/5² ≈ 79
    from regions import haversine_km
    assert all(haversine_km(*p, *SEVILLE) <= 25 for p in pts)


def test_best_in_region_finds_peak():
    engine = PlonkEngine(StubBackend(peak=(38.0, -4.0), sigma_km=50))
    lat, lon, _ = engine.best_in_region(["v"], center=(38.0, -4.0), radius_km=40, spacing_km=5)
    assert math.hypot(lat - 38.0, lon + 4.0) < 0.1


def test_kde_mode_scores_from_samples_without_likelihood_calls():
    backend = StubBackend(samples=[SEVILLE] * 9 + [LISBON])
    engine = PlonkEngine(backend, scorer="kde", n_samples=10)
    ranked = engine.rank_candidates(["v"], [RENNES, LISBON, SEVILLE])
    assert [c for c, _ in ranked] == [SEVILLE, LISBON, RENNES]
    assert backend.calls["log_likelihood"] == 0


def test_kde_mode_localizability_is_concentration():
    engine = PlonkEngine(StubBackend(samples=[SEVILLE] * 3 + [RENNES]), scorer="kde", n_samples=4)
    assert engine.localizability("v") == pytest.approx(0.75)


def test_kde_log_density_peaks_at_samples():
    d = kde_log_density(np.array([SEVILLE] * 5), np.array([SEVILLE, CORDOBA := (37.88, -4.78), RENNES]), 30)
    assert d[0] > d[1] > d[2]


def test_concentration_bounds():
    assert concentration(np.array([SEVILLE] * 4)) == 1.0
    assert concentration(np.array([SEVILLE, RENNES, BERLIN, NYC])) == 0.25
    assert concentration(np.zeros((0, 2))) == 0.0
