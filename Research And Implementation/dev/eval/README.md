# Eval set

Target: **60+ panoramas** spread across PT / ES / FR regions. Your own past challenge rounds come first, then Wikimedia/Mapillary 360° images.

## Adding an image

1. Put the image in this folder (`dev/eval/`). It can be an equirectangular `.jpg`, or a **folder** of viewer screenshots taken while turning 360°.
2. Add a row to `labels.csv`:

| column | meaning |
|---|---|
| `image_id` | unique, no spaces (e.g. `round_07`) |
| `path` | relative to `dev/eval/` (`round_07.jpg` or `round_07/`) |
| `lat`, `lon` | true location, decimal degrees |
| `region` | allowlist code (`ES-GA`, `PT-11`, `FR-BRE` …). Never a country or province code: use `python -c "import regions; print(regions.normalise('Lugo'))"` |
| `source` | `own_round` / `wikimedia` / `mapillary` |
| `notes` | free text (file title + licence for Commons images) |

3. Check: `python eval.py --check-labels`. It rejects bad codes and duplicates, and warns when `region` disagrees with the coordinates.

## Topping up from Wikimedia Commons

```
python dev/scripts/fetch_wikimedia.py --per-region 2              # all 52 regions
python dev/scripts/fetch_wikimedia.py --regions FR-BRE ES-AN --per-region 4
```

Commons rate-limits hard, so the script backs off on 429 and is slow. Look through what it downloads: drop indoor shots, drone shots and anything that doesn't look like a road or street view.

## Running

```
python eval.py --arm plonk --limit 5      # smoke test
python eval.py --arm plonk                # full run, cached in dev/eval/runs/plonk/
python eval.py --compare plonk baseline   # paired McNemar test on cached runs
```
