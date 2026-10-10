import pytest
from PIL import Image

import run
from plonk_engine import PlonkEngine, StubBackend
from schemas import Hint

SEVILLE, CORDOBA, LISBON = (37.39, -5.98), (37.88, -4.78), (38.72, -9.14)


@pytest.mark.parametrize("text,hint", [
    ("region: Andalucía", Hint(type="region", value="ES-AN")),
    ("Region: ES-LU", Hint(type="region", value="ES-GA")),
    ("country: Spain", Hint(type="country", value="ES")),
    ("text: Concello", Hint(type="text", value="Concello")),
])
def test_parse_hint(text, hint):
    assert run.parse_hint(text) == hint


@pytest.mark.parametrize("bad", ["region: Atlantis", "country: Germany", "region: Spain", "Andalucia", "colour: red"])
def test_parse_hint_rejects(bad):
    with pytest.raises(ValueError):
        run.parse_hint(bad)


def test_advise_fallback_rule():
    assert run.advise({"ES-GA": 0.6, "ES-AS": 0.3}, False) == ("submit", None)
    assert run.advise({"ES-GA": 0.6, "ES-AS": 0.3}, True)[0] == "take_hint"
    advice, hint = run.advise({"ES-GA": 0.45, "PT-16": 0.40}, False)
    assert advice == "take_hint" and hint.startswith("country hint")
    advice, hint = run.advise({"ES-GA": 0.45, "ES-AS": 0.40}, False)
    assert hint == "region hint: splits ES-GA vs ES-AS"


@pytest.fixture
def stub_engine(monkeypatch):
    engine = PlonkEngine(StubBackend(samples=[SEVILLE] * 6 + [CORDOBA] * 2 + [LISBON] * 2, localizability=0.5), n_samples=10)
    monkeypatch.setattr(run, "_ENGINE", engine)
    return engine


def views():
    return [Image.new("RGB", (64, 64), (i * 40, 100, 100)) for i in range(3)]


def test_predict_plonk_invariants(stub_engine):
    r = run.predict_plonk(views(), "img", hints=[])
    assert r.top_region() == "ES-AN"
    assert r.candidates[0].region == r.top_region()
    assert r.region_probs["ES-AN"] == pytest.approx(0.8)
    assert sum(c.probability for c in r.candidates) <= 1 + 1e-9
    assert "source: plonk" in r.candidates[0].evidence


def test_predict_plonk_country_hint_filters(stub_engine):
    r = run.predict_plonk(views(), "img", hints=[Hint(type="country", value="PT")])
    assert set(r.region_probs) == {"PT-11"}
    assert all(c.region.startswith("PT") for c in r.candidates)


def test_predict_plonk_hint_excluding_all_samples(stub_engine):
    r = run.predict_plonk(views(), "img", hints=[Hint(type="region", value="FR-BRE")])
    assert r.candidates[0].region == "FR-BRE"
    assert "source: region_centroid" in r.candidates[0].evidence


def test_load_views_folder(tmp_path):
    for i in range(3):
        Image.new("RGB", (32, 32)).save(tmp_path / f"shot{i}.jpg")
    (tmp_path / "notes.txt").write_text("x")
    assert len(run.load_views(tmp_path)) == 3


def test_format_result_has_map_links(stub_engine):
    out = run.format_result(run.predict_plonk(views(), "img", hints=[]))
    assert "https://www.google.com/maps?q=" in out and "Advice" in out
