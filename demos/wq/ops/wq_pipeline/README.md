# WQ pipeline

Backend refactor target for Catchment Pulse Ireland.

The current public harvester remains in `demos/wq/ops/harvest_wq.py` until each source adapter is migrated safely.

Target architecture:

- `core/http.py`: timeout-safe JSON fetching and pagination
- `core/status.py`: source status records
- `core/records.py`: shared record helpers and schema checks
- `adapters/`: one source adapter per public dataset
- `harvest.py`: orchestration and last-good-payload handling

Refactor rule:

No adapter may block the whole refresh. Each source must have its own timeout, source status, and error boundary.
