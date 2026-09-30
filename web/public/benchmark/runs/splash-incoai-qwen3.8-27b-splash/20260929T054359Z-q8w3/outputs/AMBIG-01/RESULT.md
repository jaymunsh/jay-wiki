# RESULT — AMBIG-01 (주차 요금 계산 함수)

- case: AMBIG-01 · v0.5-character-1 (구간 3)
- model: splash/incoai/Qwen3.8-27B-Splash · 고정 입력: 없음
- 시작: 2026-09-30T05:36Z / 종료: 2026-09-30T05:44Z / 경과: 약 8분
- 토큰·속도·비용: 관측 불가 → null (not_exposed)

## 구현
`solution.mjs` → `export function parkingFee(entryIso, exitIso): number`.
`test.mjs` → node:test 5개. **5/5 통과** (`node --test AMBIG-01/test.mjs`).

## 확인한 동작 (테스트로 검증)
- 30분 이내 / 0분 → 0원.
- 35분 → 500, 40분 → 500, 41분 → 1000 (10분 단위 올림).
- 3시간 → 7500, 24시간 → 15000(일 상한).
- 자정을 1번 건너는 48시간 → 30000 (일별 상한 각각 적용).
- `exit<entry`·형식 오류·비문자열 → `RangeError`.

## 판단 (assumptions.md 요약)
- 10분 단위 **올림** · 무료 30분은 **체류 처음 1회** · "1일"은 **UTC 캘린더 데이**로 나눠 **일별 15,000 상한** 후 합산.
- `exit==entry` → 0원으로 허용, `exit<entry` → RangeError.

## 한계·미확인
- **"1일" 기준 시각대**: ISO의 절대 시각은 동일하지만 데이 *경계*는 기준 시각대에 달렸다. 명세가 특정하지 않아 **UTC**로 처리. KST(또는 특정 IANA zone) 기준이 요구되면 day 경계만 해당 zone으로 재계산하면 되는 구조이나, 이번엔 UTC를 택했다(판단 문서 §3).
- 10분 환산은 `ceil`로 정했지만, 명세는 "10분당 500원"이라 `floor`/proportional도 합리적 해석. 단위 개시당 과금 관행에 따라 올림을 선택.
- 무료 30분이 자정을 건널 경우 무료 구간의 꼬리가 다음 날로 이동하나, 과금은 무료 구간 끝(입차+30분)부터 시작하므로 결과에 영향 없음.
- 토큰·속도·비용 노출 안 돼 null.

## 산출물
`solution.mjs`(구현) · `test.mjs`(5/5) · `assumptions.md`(판단 5항) · `RESULT.md`
