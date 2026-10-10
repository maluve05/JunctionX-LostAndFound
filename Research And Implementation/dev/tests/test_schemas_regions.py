import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from regions import ALLOWLIST, REGIONS, normalise, region_of, validate_code
from schemas import Clue, Hint, Result, SpecialistReport

MOCKS = Path(__file__).parent.parent / "mocks"


def test_allowlist_size():
    assert sum(c.startswith("PT-") for c in REGIONS) == 20
    assert sum(c.startswith("ES-") for c in REGIONS) == 19
    assert sum(c.startswith("FR-") for c in REGIONS) == 13
    assert {"PT", "ES", "FR"} <= ALLOWLIST


@pytest.mark.parametrize("path", sorted(MOCKS.glob("*.json")), ids=lambda p: p.name)
def test_mocks_validate(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    model = Result if path.name.startswith("result_") else SpecialistReport
    model.model_validate(data)


@pytest.mark.parametrize("bad", ["ES-LU", "Galicia", "Galiza", "FR-29", "FR-6AE", "es-ga"])
def test_validator_rejects_non_allowlist(bad):
    with pytest.raises(ValueError):
        validate_code(bad)
    with pytest.raises(ValidationError):
        Clue(category="text", observation="x", view_id="v", implies=[bad], confidence=0.5)


@pytest.mark.parametrize("raw,code", [
    ("Andalucía", "ES-AN"), ("Andalusia", "ES-AN"), ("ES-LU", "ES-GA"), ("Galiza", "ES-GA"),
    ("FR-6AE", "FR-GES"), ("FR-29", "FR-BRE"), ("es-ga", "ES-GA"), ("Lisbon", "PT-11"),
    ("Bretagne", "FR-BRE"), ("Spain", "ES"), ("Açores", "PT-20"),
])
def test_normalise(raw, code):
    assert normalise(raw) == code


def test_normalise_rejects_unknown():
    with pytest.raises(ValueError):
        normalise("Atlantis")


def test_hint_granularity():
    Hint(type="country", value="ES")
    Hint(type="region", value="ES-AN")
    Hint(type="city", value="Ribadeo")
    with pytest.raises(ValidationError):
        Hint(type="country", value="ES-AN")
    with pytest.raises(ValidationError):
        Hint(type="region", value="Andalucía")


def test_result_probabilities_capped():
    base = json.loads((MOCKS / "result_galicia.json").read_text(encoding="utf-8"))
    base["region_probs"] = {"ES-GA": 0.8, "ES-AS": 0.4}
    with pytest.raises(ValidationError):
        Result.model_validate(base)


def test_mock_invariant_top_candidate_matches_top_region():
    for path in MOCKS.glob("result_*.json"):
        r = Result.model_validate_json(path.read_text(encoding="utf-8"))
        assert min(r.candidates, key=lambda c: c.rank).region == r.top_region(), path.name


@pytest.mark.parametrize("lat,lon,code", [
    (38.72, -9.14, "PT-11"),   # Lisbon
    (37.39, -5.98, "ES-AN"),   # Seville
    (48.11, -1.68, "FR-BRE"),  # Rennes
    (52.52, 13.40, None),      # Berlin
    (38.60, -9.75, None),      # ~50 km off Cabo da Roca
])
def test_region_of(lat, lon, code):
    assert region_of(lat, lon) == code
