# AMBIG-03 result

- `case_version`: `v0.5-character-1`
- `attempt_id`: `v05-character-20260915T193723Z-r1`
- `status`: `submitted`
- `evaluation_status`: `pending`
- `score`: `null` (independent grading not performed)
- `artifacts`: `solution.mjs`, `assumptions.md`, `RESULT.md`
- `input`: `input/ambig03-spec.md`
- `input_sha256`: `f5829aeec5418ce2aee75332f3540bbe93cfe7924709fec32afeaba05c589625`
- `started_at_utc`: `2026-09-15T19:45:20.045422000Z`
- `finished_at_utc`: `2026-09-15T19:46:00.947062000Z`
- `elapsed_ms`: `40902` (agent-observed terminal timestamps; includes spec reading, implementation, assumptions, and local policy checks)
- `verification`: own checks covered transient exceptions, returned 503, permanent 401, success, final exhaustion, attempt count, and structured retry logs.
- `not_verified`: production HTTP client shape, real gateway idempotency, and independent grading.
- `token_usage`: `null` (`not_exposed` by current app)
- `output_speed`: `null` (`not_exposed`; no streaming measurement)
- `cost`: `null` (`not_exposed`)
