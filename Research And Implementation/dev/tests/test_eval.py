import pytest

from eval import (Label, check_label_consistency, load_labels, paired_compare, score_one, summarise,
                  wilson_ci)
from schemas import Candidate, Result


def make_result(image_id, probs, lat=0.0, lon=0.0, advice="submit"):
    top = max((c for c in probs if "-" in c), key=probs.get)
    return Result(image_id=image_id, region_probs=probs, hint_advice=advice,
                  candidates=[Candidate(rank=1, lat=lat, lon=lon, radius_km=5, name="x", region=top,
                                        probability=0.5, evidence=[])])


@pytest.fixture
def toy_labels(tmp_path):
    csv = tmp_path / "labels.csv"
    csv.write_text(
        "image_id,path,lat,lon,region,source,notes\n"
        "a,a.jpg,38.72,-9.14,PT-11,own,\n"
        "b,b.jpg,37.39,-5.98,ES-AN,own,\n"
        "c,c.jpg,48.11,-1.68,FR-BRE,own,\n"
        "d,d.jpg,43.36,-8.41,ES-GA,own,\n",
        encoding="utf-8")
    return load_labels(csv, check_files=False)


def test_metrics_on_toy_set(toy_labels):
    a, b, c, d = toy_labels
    results = [
        make_result("a", {"PT-11": 0.7, "PT-15": 0.2}, 38.72, -9.14),             # region right, 0 km
        make_result("b", {"ES-EX": 0.5, "ES-AN": 0.4}, 37.39, -6.98, "take_hint"),  # wrong region, top-3, right country
        make_result("c", {"ES-PV": 0.6, "FR-NAQ": 0.3}, 43.0, -2.6),               # wrong country, not top-3
        make_result("d", {"ES-GA": 0.9}, 43.36, -8.41),                             # right
    ]
    scores = [score_one(l, r) for l, r in zip(toy_labels, results)]
    s = summarise(scores)
    assert s["region_acc"]["k"] == 2 and s["region_acc"]["n"] == 4
    assert s["country_acc"]["k"] == 3
    assert s["top3_region"]["k"] == 3
    assert s["take_hint_rate"]["k"] == 1
    assert scores[0].distance_km == pytest.approx(0, abs=1e-6)
    assert scores[1].distance_km == pytest.approx(88.4, abs=1.0)  # 1° lon at 37.4° N
    # median of [0, 0, 88, ~600]
    assert s["median_km"] == pytest.approx(scores[1].distance_km / 2, abs=1.0)


def test_wilson_ci():
    lo, hi = wilson_ci(30, 60)
    assert lo == pytest.approx(0.375, abs=0.01) and hi == pytest.approx(0.625, abs=0.01)
    assert wilson_ci(0, 0) == (0.0, 1.0)


def test_paired_compare(toy_labels):
    right = make_result("x", {"PT-11": 1.0})
    a = [score_one(toy_labels[0], right)] * 1
    b = [score_one(toy_labels[0], make_result("x", {"PT-15": 1.0}))]
    c = paired_compare(a, b)
    assert c == {"n_paired": 1, "only_a": 1, "only_b": 0, "p_value": 1.0}


def test_labels_reject_bad_rows(tmp_path):
    csv = tmp_path / "labels.csv"
    csv.write_text("image_id,path,lat,lon,region,source,notes\n"
                   "a,a.jpg,38.7,-9.1,Lisboa,own,\n"     # free text
                   "b,b.jpg,37.4,-6.0,ES,own,\n"         # country only
                   "b,b.jpg,37.4,-6.0,ES-AN,own,\n",     # duplicate id
                   encoding="utf-8")
    with pytest.raises(ValueError) as e:
        load_labels(csv, check_files=False)
    assert "line 2" in str(e.value) and "line 3" in str(e.value) and "line 4" in str(e.value)


def test_label_consistency_warning():
    labels = [Label("a", None, 38.72, -9.14, "ES-AN")]
    assert check_label_consistency(labels)
