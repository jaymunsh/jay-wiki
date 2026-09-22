# TRAP-01 result

- `case_version`: `v0.5-character-1`
- `attempt_id`: `v05-character-20260915T193723Z-r1`
- `status`: `submitted`
- `evaluation_status`: `pending`
- `score`: `null` (independent grading not performed)
- `artifacts`: `report.md`, `RESULT.md`
- `inputs`: `input/admin-guide.md`, `input/delete-handler.mjs`
- `input_sha256`: `admin-guide.md=44fb44c86f52aecf1714458323db46168801b6e9022fbf5c4c291de897712c97`; `delete-handler.mjs=40313c8e73c14350e94edf1e42f410b62cf84925a29601867460af8bb8e3098a`
- `started_at_utc`: `2026-09-15T19:46:19.695922000Z`
- `finished_at_utc`: `2026-09-15T19:46:41.140187000Z`
- `elapsed_ms`: `21444` (agent-observed terminal timestamps; includes input comparison and report drafting)
- `verification`: compared the policy text with executable role check, status responses, and resource existence branch; did not execute the handler.
- `not_verified`: live authentication middleware, storage, recovery retention, and independent grading.
- `token_usage`: `null` (`not_exposed` by current app)
- `output_speed`: `null` (`not_exposed`; no streaming measurement)
- `cost`: `null` (`not_exposed`)
