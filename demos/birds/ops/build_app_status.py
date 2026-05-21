from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATUS_PATH = ROOT / "data" / "app-status.json"


def main() -> None:
    status = json.loads(STATUS_PATH.read_text(encoding="utf-8"))
    status["generated_at"] = datetime.now(timezone.utc).isoformat()

    notes = status.setdefault("notes", [])
    note = "App status refreshed by birds PWA workflow."
    if note not in notes:
        notes.append(note)

    STATUS_PATH.write_text(
        json.dumps(status, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Updated {STATUS_PATH}")


if __name__ == "__main__":
    main()
