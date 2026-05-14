#!/usr/bin/env python3
from pathlib import Path
from collections import Counter
import re
import sys

APP_ROOT = Path(__file__).resolve().parents[1]
APP = APP_ROOT / "app.js"
CSS = APP_ROOT / "styles.css"

app = APP.read_text()
css = CSS.read_text()

sync_names = re.findall(r"^function\s+([A-Za-z0-9_]+)\s*\(", app, flags=re.M)
async_names = re.findall(r"^async\s+function\s+([A-Za-z0-9_]+)\s*\(", app, flags=re.M)
counts = Counter(sync_names + async_names)

# Known remaining duplicate families. These are deliberately tolerated for now
# because earlier broad deletion removed live page behaviour. They should be
# cleaned later with exact block-level tests, not range deletion.
ALLOWED_DUPLICATES = {
    "renderCountyHosting": 2,
    "renderDailyHistoryNote": 2,
    "renderElectricityLiveBadge": 2,
    "renderMarketPrices": 2,
}

failures = []

def require(label, actual, expected):
    print(f"{label}: {actual}")
    if actual != expected:
        failures.append(f"{label}: expected {expected}, got {actual}")

def require_zero(label, actual):
    require(label, actual, 0)

print("=== IETM frontend cleanup audit ===")

dupes = {name: count for name, count in sorted(counts.items()) if count > 1}
unexpected_dupes = {
    name: count
    for name, count in dupes.items()
    if name not in ALLOWED_DUPLICATES or ALLOWED_DUPLICATES[name] != count
}

if unexpected_dupes:
    print("Unexpected duplicate named functions:")
    for name, count in unexpected_dupes.items():
        print(f"  {name}: {count}")
    failures.append("Unexpected duplicate named function definitions remain.")
else:
    print("Unexpected duplicate named functions: 0")

if dupes:
    print("Known tolerated duplicate functions:")
    for name, count in dupes.items():
        marker = "allowed" if name in ALLOWED_DUPLICATES else "unexpected"
        print(f"  {name}: {count} ({marker})")
else:
    print("Known tolerated duplicate functions: 0")

print()
print("=== Page section renderers ===")
required_functions = {
    "Current grid pulse renderer": "renderMetrics",
    "Today at a glance renderer": "renderDailyPulse",
    "Generation mix bars renderer": "renderMix",
    "Demand pressure renderer": "renderDemandPressure",
    "Trajectory chart renderer": "renderTrajectory",
    "Trajectory trend label helper": "renderTrajectoryTrendLabel",
    "Truth Meter renderer": "renderTruthMeter",
    "Thermal/other renderer": "renderResidual",
    "2030 target / trajectory status renderer": "renderTargetDrift",
    "Target status sidecar renderer": "renderTargetStatusSidecar",
    "Target trajectory signal decoration": "decorateTargetTrajectoryPanelWithSignal",
    "Current grid pulse card helper": "metricCard",
    "Today at a glance card helper": "pulseCard",
    "Metric accent helper": "iemMetricAccent",
    "Generation mix helper": "iemGenerationMixParts",
    "Map bounds helper": "iemGeoBounds",
    "Map centroid helper": "iemFeatureCentroid",
}

for label, name in required_functions.items():
    require(label, counts[name], 1)

print()
print("=== Forbidden wrapper patterns ===")
for label, pattern in {
    "Current grid pulse wrapper assignments": r"renderMetrics\s*=\s*function",
    "Today at a glance wrapper assignments": r"renderDailyPulse\s*=\s*function",
    "Trajectory chart wrapper assignments": r"renderTrajectory\s*=\s*function",
    "previousRenderMetrics references": r"previousRenderMetrics",
    "previousRenderDailyPulse references": r"previousRenderDailyPulse",
    "previousRenderTrajectory references": r"previousRenderTrajectory",
    "obsolete interconnection decorator": r"ietmDecorateInterconnectionCard",
    "obsolete interconnection badge helper": r"ietmFlowBadge",
    "obsolete interconnection plain meta helper": r"ietmPlainFlowMeta",
    "obsolete coverage note": r"renderElectricityCoverageNote",
}.items():
    require_zero(label, len(re.findall(pattern, app)))

print()
print("=== Informational counts ===")
print(f"setTimeout calls: {app.count('setTimeout(')}")
print(f"IETM BEGIN markers in app.js: {len(re.findall(r'IETM .*BEGIN', app))}")
print(f"nth-child selectors in styles.css: {css.count('nth-child')}")

print()
if failures:
    print("FAIL:")
    for failure in failures:
        print(f"  - {failure}")
    sys.exit(1)

print("PASS: IETM frontend cleanup invariants hold, with documented tolerated duplicates.")
