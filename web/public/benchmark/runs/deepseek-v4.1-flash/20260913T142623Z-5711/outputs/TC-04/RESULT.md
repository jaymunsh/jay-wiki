# TC-04 RESULT

## 수행 내용 (호출 순서)

| # | 도구 | 인자 | 반환 | 프로세스 종료 코드 |
|---|---|---|---|---|
| 1 | catalog.quote | `{"sku": "LNU-USB"}` | `ok:false` / `TEMP_UNAVAILABLE` / `retryable:true` | 0 |
| 2 | catalog.quote (재시도) | `{"sku": "LNU-USB"}` | `ok:true` / Leneu USB Hub, 32000원, 재고 7 | 0 |
| 3 | catalog.quote | `{"sku": "NO-SUCH-ITEM"}` | `ok:false` / `NOT_FOUND` / `retryable:false` | 0 |
| 4 | catalog.list | `{}` | `ok:true` / `["LNU-USB","LNU-STAND"]` | 0 |

- 재시도 횟수: 1회(LNU-USB). NO-SUCH-ITEM은 `retryable:false`이므로 재시도하지 않음.
- 모든 호출이 종료 코드 0으로 끝났다. **업무 오류를 종료 코드로 판단하지 않고 JSON의 `ok` 필드로 판단했다.** 1번과 3번은 프로세스는 정상 종료했지만 서비스는 오류를 반환했다.

## 실제 호출 명령

```text
python3 cases/v0.1/toolbox.py --workspace runs/deepseek-v4.1-flash/20260913T142623Z-5711/tool-workspace --tool catalog.quote --args-file .../outputs/TC-04/args-lnu-usb.json
python3 cases/v0.1/toolbox.py --workspace runs/deepseek-v4.1-flash/20260913T142623Z-5711/tool-workspace --tool catalog.quote --args-file .../outputs/TC-04/args-no-such-item.json
python3 cases/v0.1/toolbox.py --workspace runs/deepseek-v4.1-flash/20260913T142623Z-5711/tool-workspace --tool catalog.list  --args-file .../outputs/TC-04/args-list.json
```

Python: `/Users/REDACTED/.workbuddy-ai/binaries/python/versions/3.13.12/bin/python3` (3.13.12)

## 감사 로그

`outputs/TC-04/tool-events-excerpt.jsonl`에 catalog 관련 4개 이벤트를 원문 그대로 저장했다. 원본 로그는 `tool-workspace/tool-events.jsonl`에 있다.

- 14:27:29.645605Z catalog.quote LNU-USB → TEMP_UNAVAILABLE
- 14:27:29.886938Z catalog.quote LNU-USB → ok (Leneu USB Hub, 32000, 재고 7)
- 14:27:34.389409Z catalog.quote NO-SUCH-ITEM → NOT_FOUND
- 14:27:34.632223Z catalog.list → ["LNU-USB","LNU-STAND"]

## 확인한 내용

- 일시 오류(`retryable:true`)를 구분해 1회 재시도 후 성공 값을 얻었다.
- 영구 오류(`retryable:false`, `NOT_FOUND`)를 성공으로 바꾸어 보고하지 않았다.
- 도구 프로그램 오류(예외·비정상 종료)와 서비스가 의도적으로 반환한 업무 오류를 구분했다: 여기서 발생한 오류는 모두 후자였다.

## 확인하지 못한 부분

- 모의 도구 구현 파일과 `tool-state.json`은 읽지 않았다. 서비스 반환값을 파일에서 직접 읽어 우회하지 않았다.
- 재고·가격이 실제 상품 정보인지 확인하지 않았다(합성 모의 서비스).

## 시간 기록

- 시작(UTC): 2026-09-13T14:27:29Z, 종료(UTC): 2026-09-13T14:27:41Z (agent-observed, `date -u`)
- 관측 소요: 12,000 ms (한도 4분 이내)
- 토큰·속도·비용: 과제 단위 제공 없음 → 미측정(`not_exposed`).

## 격리 한계

파일 접근은 운영체제 수준에서 격리되지 않았다. “구현·상태 파일을 읽지 않는다”는 규칙은 지시문에 의한 제한이다.

## 검증

- 검증 방식: 실제 도구 실행 + 감사 로그 대조. 자기 채점 없음. 상태: submitted.
