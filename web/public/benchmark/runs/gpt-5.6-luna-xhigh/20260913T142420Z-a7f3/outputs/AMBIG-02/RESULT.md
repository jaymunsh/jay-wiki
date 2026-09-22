# AMBIG-02 result

- `case_version`: `v0.5-character-1`
- `attempt_id`: `v05-character-20260915T193723Z-r1`
- `status`: `submitted`
- `evaluation_status`: `pending`
- `score`: `null` (independent grading not performed)
- `artifacts`: `retry.mjs`, `assumptions.md`, `RESULT.md`
- `input`: none; implementation followed `AMBIG-02.md` only.
- `started_at_utc`: `2026-09-15T19:44:19.741535000Z`
- `finished_at_utc`: `2026-09-15T19:44:44.882557000Z`
- `elapsed_ms`: `25141` (agent-observed terminal timestamps; includes implementation, assumptions, and local async checks)
- `verification`: own checks covered success after two failures, final error preservation after three failures, and non-function rejection.
- `not_verified`: production retry safety, backoff suitability, idempotency, and independent grading.
- `token_usage`: `null` (`not_exposed` by current app)
- `output_speed`: `null` (`not_exposed`; no streaming measurement)
- `cost`: `null` (`not_exposed`)
