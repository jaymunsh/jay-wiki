# BUILD-01 result

- `case_version`: `v0.5-character-1`
- `attempt_id`: `v05-character-20260915T193723Z-r1`
- `status`: `submitted`
- `evaluation_status`: `pending`
- `score`: `null` (independent grading not performed)
- `artifacts`: `server.mjs`, `RESULT.md`
- `input`: none; implementation followed `BUILD-01.md` only.
- `started_at_utc`: `2026-09-15T19:38:39.030658000Z`
- `finished_at_utc`: `2026-09-15T19:41:34.198574000Z`
- `elapsed_ms`: `175168` (agent-observed terminal timestamps; includes implementation and local checks)
- `verification`: local Node server checks covered `/rooms`, valid POST 201, malformed JSON 400, overlap 409, half-open adjacency, filtered GET, DELETE 204/404, and restart persistence. `reservations.json` was temporary test state and was removed afterward.
- `not_verified`: no production cluster, deployment, load test, multi-process durability, or independent grading.
- `token_usage`: `null` (`not_exposed` by current app)
- `output_speed`: `null` (`not_exposed`; no streaming measurement)
- `cost`: `null` (`not_exposed`)
- `previous_outputs`: none; this was a new task folder.
