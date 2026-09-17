---
title: M1 Max에서 Qwen3.8-27B + DFlash2, 가장 빠를까?
slug: qwen38-27b-dflash2-local-experiment-update
category: 기술 실험
summary: 공개된 27.12 tok/s 수치의 재현을 M1 Max 64GB·oMLX에서 시도하고, DFlash2와 Qwen3.8 MTP 변형을 비교한 실험 기록이다. 공개 CLI 결과와 oMLX 실측의 차이, acceptance·TTFT·메모리까지 정리했다.
tags: apple-silicon,benchmark,dflash2,local-llm,mlx,omlx,qwen3.8,replication,speculative-decoding
toc: true
source: https://portfolio.leneu.cloud/api/bff/blog/posts/38 (내려받음)
---
> 이 글은 [M1 Max에서 Qwen3.8-27B를 빠르게 만드는 DFlash2의 조건](/26/qwen38-27b-dflash2-local-experiment)의 후속 실측 기록이다.
>
> 결론부터 말하면, 원문의 기술적 가설은 유효하지만 `dflash-mlx`의 공개 수치인
> **27.12 tok/s를 현재 oMLX 환경에서 그대로 재현하지는 못했다.** oMLX에서 확인된
> 최고 속도는 `Qwen3.8-27B-4bit + DFlash2`의 **16.52 tok/s**였다.

## 1. 최종 결론

이번 실험에서 확인한 결론은 “DFlash2를 구현할 수 없었다”가 아니다.

- DFlash2는 oMLX에서 정상적으로 로드되고 작동했다.
- MTP도 모든 MTP 실험에서 정상적으로 draft를 붙여 실행했다.
- 다만 원문의 `27.12 tok/s`는 oMLX GUI가 아닌 `dflash-mlx` 직접 실행의 수치다.
- 런타임, 벤치마크 프로토콜, 양자화·activation 설정, 출력 길이가 달라서 두 수치를
  동일한 숫자로 비교하면 안 된다.
- 현재 이 M1 Max 64GB 환경에서 실사용 속도 기준으로 가장 빠른 조합은
  **`Qwen3.8-27B-4bit + DFlash2`다**.
- MTP 방식만 비교하면 이번 조건에서는 **`mxfp4 + VLM MTP`가 가장 빨랐다.**

### 실무 선택

| 우선순위 | 추천 조합 | 측정 속도 | 비고 |
|---|---|---:|---|
| 순수 생성 속도 | `Qwen3.8-27B-4bit + DFlash2` | **16.52 tok/s** | draft 약 4GB와 캐시 사용 |
| MTP 방식 | `Qwen3.8-27B-mxfp4 + VLM MTP` | **14.30 tok/s** | 메모리 사용량이 가장 낮은 편 |
| 속도와 메모리 균형 | `mxfp4 + VLM MTP` | **14.30 tok/s** | 이번 MTP 비교 1위 |
| 피하는 조합 | `4bit + VLM MTP` | **11.75 tok/s** | 수용률은 높지만 target 검증이 느림 |

원문의 27 tok/s를 목표로 한다면 oMLX 설정을 조금 더 만지는 것만으로 해결된다고
보기 어렵다. 원문과 같은 직접 `dflash-mlx` 경로를 별도로 재현하거나, oMLX 쪽에서
동일한 kernel·block·prefill 경로를 제공해야 한다.

## 2. 실험 환경

- 하드웨어: Apple M1 Max, unified memory 64GB
- 실행 앱: oMLX
- oMLX 버전: `0.6.3rc3`, build `2475`
- API: `127.0.0.1:8888`
- 입력 항목: `web-landing`
- 입력 토큰: 약 51토큰
- 출력 상한: 4,096토큰
- 비교 실행: warm, repeat 1
- MTP 비교 샘플링: `temperature=0.7`, `top_p=0.95`, `top_k=20`, thinking off
- 컨텍스트 상한: `65,536`
- 스왑: 최종 실행에서 발생하지 않음

`web-landing`은 HTML 전체를 생성하는 항목이다. 네 모델 모두 4,096토큰 상한에
도달했기 때문에 이번 실행의 자동 품질 점수는 비교에 사용하지 않았다. 이번 문서의
속도·TTFT·메모리·MTP 통계만 유효하다.

## 3. 공개 원문 수치와 의미

원문에서 인용한 수치는 `dflash-mlx` Issue #60의 제3자 측정이다.

- 하드웨어: M1 Max 64GB
- target: `mlx-community/Qwen3.8-27B-4bit`
- draft: `z-lab/Qwen3.8-27B-DFlash2`
- 출력: 512토큰, EOS 없음
- 반복: 2회
- cooldown: 45초
- 핵심 설정: draft `w4a32:gs64`, block 5

공개 결과는 다음과 같다.

| draft 설정 | acceptance | 지속 속도 | 해석 |
|---|---:|---:|---|
| 기본 `w4` | 0.000 | 8.15 tok/s | speculative 효과가 사라져 오히려 느림 |
| `w4a32:gs64` | 0.701 | **27.12 tok/s** | 공개 사례의 최고 수치 |
| BF16 draft | 0.705 | 23.32 tok/s | 수용률은 비슷하지만 속도는 낮음 |

따라서 원문이 실제로 보여 준 것은 “M1 Max에서 항상 27 tok/s가 나온다”가 아니라,
**DFlash2 draft의 activation 정밀도와 block 설정이 맞으면 특정 직접 실행 경로에서
27 tok/s대가 관측될 수 있다**는 것이다.

원문 재현 명령은 다음과 같다.

```bash
dflash benchmark \
  --model mlx-community/Qwen3.8-27B-4bit \
  --draft z-lab/Qwen3.8-27B-DFlash2 \
  --draft-quant w4a32:gs64 \
  --block-tokens 5 \
  --max-tokens 512 \
  --repeat 2 \
  --cooldown 45 \
  --no-eos
```

이 명령은 oMLX의 OpenAI-compatible API를 호출하는 방식이 아니다. 따라서 아래에서
측정한 oMLX 수치와는 런타임 자체가 다르다.

## 4. oMLX에서 재현한 DFlash2

### 4.1 설정

target 모델은 `mlx-community/Qwen3.8-27B-4bit`로 두었다.

- DFlash: ON
- draft: `z-lab/Qwen3.8-27B-DFlash2`
- draft quantization: ON
- weight bits: 4bit
- activation bits: 32bit
- group size: 64
- block size: 5
- verify mode: adaptive
- in-memory cache: ON
- cache entries: 4
- in-memory cache budget: 8GiB
- SSD cache: OFF
- Lightning MTP: OFF
- VLM MTP: OFF

DFlash2와 MTP는 같은 요청에 동시에 적용하지 않았다. oMLX에서도 speculative
경로는 서로 대체 관계이므로, DFlash2 결과는 MTP 결과가 아니다.

### 4.2 결과

| run_id | target | 출력 | 속도 | TTFT | peak memory | acceptance |
|---|---|---:|---:|---:|---:|---:|
| `1bade19b` | `Qwen3.8-27B-4bit` | 4,096 | **16.52 tok/s** | 1.444s | 31.492GB | 72.1% |

같은 DFlash 설정으로 512토큰 smoke test에서는 16.37 tok/s가 측정됐다.

이 결과는 공개된 27.12 tok/s보다 약 10.60 tok/s 낮다. 비율로는 공개 수치의 약
61%이며, 공개 수치 대비 약 39% 낮은 값이다. 그러나 이 차이만으로 DFlash2가
oMLX에서 실패했다고 볼 수는 없다. oMLX 로그에 draft 로드와 speculative 통계가
남았고, acceptance도 72.1%로 확인됐기 때문이다.

### 4.3 공개 수치와 직접 비교할 때의 차이

| 항목 | 공개 Issue #60 | 이번 oMLX 실행 |
|---|---|---|
| 런타임 | `dflash-mlx` 직접 CLI | oMLX 0.6.3rc3 API/GUI 서버 |
| target | Qwen3.8-27B 4bit | Qwen3.8-27B 4bit |
| draft | DFlash2 | DFlash2 |
| draft 양자화 | w4a32:gs64 | w4a32:gs64로 설정 |
| block | 5 | 5 |
| 출력 | 512, no-EOS | web HTML, 최대 4,096 |
| 샘플링 | 공개 명령 기본값 | temperature 0.2 |
| cache | 직접 CLI 경로 | oMLX cache 및 scheduler 경로 |
| 측정 | repeat 2 + cooldown 45s | warm repeat 1 |

target과 draft 이름만 같다고 실행 경로와 비용이 같아지는 것은 아니다. 특히
`dflash-mlx`의 직접 생성 루프와 oMLX의 VLM engine·scheduler·OpenAI API 계층은
동일한 구현이 아니다.

## 5. Qwen3.8 MTP 모델 구조 정리

이번 실험에서 가장 많이 헷갈렸던 부분은 “VLM 모델”과 “VLM MTP 토글”이 서로 다른
개념이라는 점이었다.

### 5.1 Qwen3.8 본체는 oMLX에서 VLM으로 인식된다

oMLX discovery 로그는 다음 본체들을 모두 이렇게 분류했다.

```text
Qwen3.8-27B-4bit   -> type: vlm, engine: vlm
Qwen3.8-27B-nvfp4  -> type: vlm, engine: vlm
Qwen3.8-27B-mxfp4  -> type: vlm, engine: vlm
```

따라서 이름에 `4bit`, `nvfp4`, `mxfp4`가 붙었다고 해서 순수 텍스트 전용 engine을
타는 것은 아니다. 이미지를 보내지 않더라도 본체 모델은 Qwen3.8 VLM architecture로
로드된다.

### 5.2 MTP 파일은 본체가 아니라 draft다

다음 파일들은 27B target 본체가 아니다.

```text
Qwen3.8-27B-MTP-4bit
Qwen3.8-27B-MTP-nvfp4
Qwen3.8-27B-MTP-mxfp4
```

이 파일들은 MTP draft 가중치만 담고 있으며, target 본체와 함께 사용해야 한다.
예를 들어 `Qwen3.8-27B-MTP-mxfp4`는 약 226MB 정도의 draft 파일이고, 그것만으로
27B 모델을 대체할 수 없다.

### 5.3 Lightning MTP와 VLM MTP

| 경로 | 대표 모델 | oMLX 설정 |
|---|---|---|
| native/Lightning MTP | `Jundot/Qwen3.8-27B-oQ4e-mtp` | `mtp_enabled=true`, `vlm_mtp_enabled=false` |
| external VLM MTP | `Qwen3.8-27B-4bit`, `nvfp4`, `mxfp4` + MTP draft | `vlm_mtp_enabled=true`, `mtp_enabled=false` |

즉, 현재 oMLX에서 mxfp4·nvfp4·일반 4bit에 `Lightning MTP`가 보이지 않고
`VLM MTP`만 보이는 것은 모델이 external VLM MTP 경로를 사용하기 때문이다.

이것은 “VLM MTP를 켜면 이미지 입력을 해야 한다”는 뜻이 아니다. 이 토글은
Qwen3.8 VLM 본체에 external MTP draft를 붙이는 실행 경로의 이름이다.

## 6. 최종 MTP 비교

아래 네 결과는 같은 `web-landing` 항목을 사용했고, 가능한 한 같은 조건으로 맞춘
최종 비교다.

### 6.1 공통 조건

- warm 실행
- `max_tokens=4096`
- `temperature=0.7`
- `thinking=off`
- context window `65,536`
- top-p `0.95`
- top-k `20`
- DFlash OFF
- TurboQuant KV OFF
- repeat 1

### 6.2 결과

| run_id | target | MTP 경로 | draft | 속도 | TTFT | peak memory | MTP 수용률 | 토큰/라운드 |
|---|---|---|---|---:|---:|---:|---:|---:|
| `b55bd1ec` | `oQ4e-mtp` | Lightning/native | 내장 MTP | 13.61 | 1.639s | 20.86GB | 92.9% | 로그상 adaptive |
| `a751965f` | `mxfp4` | VLM MTP | `MTP-mxfp4` | **14.30** | 1.192s | **16.56GB** | 79.9% | 2.60 |
| `7922e4f7` | `nvfp4` | VLM MTP | `MTP-nvfp4` | 13.81 | 1.164s | 17.33GB | 79.3% | 2.59 |
| `ae7d1502` | `4bit` | VLM MTP | `MTP-4bit` | **11.75** | 1.245s | 19.24GB | 79.8% | 2.60 |

### 6.3 해석

#### MTP는 모두 실제 작동했다

각 모델의 oMLX 로그에 다음과 같은 형태의 기록이 남았다.

```text
VLM MTP enabled for Qwen3.8-27B-...
VLM MTP drafter loaded: ...MTP-...
vlm_mtp stats: accepted=.../... tokens_per_round=...
```

따라서 4bit MTP가 11.75 tok/s로 나온 원인을 “MTP가 꺼져 있었다”라고 볼 수
없다. draft는 로드됐고 수용률도 약 80%였다.

#### 수용률이 높아도 속도가 높다는 뜻은 아니다

수용률은 draft가 제안한 토큰 중 target이 받아들인 비율이다. 실제 속도는 여기에
다음 비용이 함께 반영된다.

- draft 한 라운드를 실행하는 비용
- target이 여러 토큰을 검증하는 비용
- MTP scheduler와 VLM wrapper 비용
- 양자화 포맷별 dequantization·kernel 비용
- 라운드당 실제로 확정되는 토큰 수

이번 결과에서 4bit MTP와 mxfp4 MTP는 수용률이 각각 79.8%, 79.9%로 거의 같았다.
그런데 속도는 11.75 대 14.30 tok/s로 크게 달랐다. 차이는 draft 수용률이 아니라
target 쪽 양자화·실행 경로 비용으로 보는 편이 타당하다.

#### oQ4e의 92.9%는 바로 20 tok/s가 되지 않았다

oQ4e native MTP는 수용률이 92.9%로 가장 높았지만 속도는 13.61 tok/s였다.
수용되는 토큰이 많아도 각 검증 라운드가 충분히 빠르지 않으면 최종 tok/s가 높아지지
않는다. 이번 결과는 acceptance를 단독 성능 지표로 사용하면 안 된다는 사례다.

## 7. 과거 실행과 최종 실행의 차이

최종 비교 이전에도 짧은 smoke test와 다른 컨텍스트 상한으로 몇 차례 실행했다.

| run_id | 모델 | 조건 | 속도 | 용도 |
|---|---|---|---:|---|
| `4c6115a2` | 4bit + VLM MTP | max 256, temperature 0.0, context 98,304 | 13.81 | smoke test |
| `041154c0` | 4bit + VLM MTP | max 4,096, temperature 0.0, context 98,304 | 12.97 | 이전 비교 |
| `48a57a05` | 4bit + DFlash2 | max 512, temperature 0.2 | 16.37 | smoke test |
| `1bade19b` | 4bit + DFlash2 | max 4,096, temperature 0.2 | 16.52 | DFlash 최종 |
| `b55bd1ec` | oQ4e native MTP | max 4,096, temperature 0.7, context 65,536 | 13.61 | MTP 최종 |
| `a751965f` | mxfp4 + VLM MTP | max 4,096, temperature 0.7, context 65,536 | 14.30 | MTP 최종 |
| `7922e4f7` | nvfp4 + VLM MTP | max 4,096, temperature 0.7, context 65,536 | 13.81 | MTP 최종 |
| `ae7d1502` | 4bit + VLM MTP | max 4,096, temperature 0.7, context 65,536 | 11.75 | MTP 최종 |

이 표에서 `041154c0`와 `ae7d1502`가 다른 것은 이상해 보일 수 있다. 두 실행은
temperature와 context 상한, 서버 재로드 시점이 달랐고, 각각 한 번만 측정했다.
따라서 11.75와 12.97의 차이를 특정 설정 하나의 효과라고 단정하지 않는다.
다만 최근 동일 조건에서 4bit MTP가 가장 낮았다는 사실과, MTP 로그가 정상이라는
점은 확인됐다.

## 8. “텍스트 전용 모델을 찾으면 빨라질까?”에 대한 결론

이번 실험을 통해 다음 오해를 정리할 수 있다.

### 8.1 gcoli oQ4e-mtp는 텍스트 전용이 아니다

`gcoli/Qwen3.8-27B-oQ4e-mtp`에는 vision encoder가 포함되어 있고, 모델 카드에도
vision-language 모델로 표시되어 있다. `Text-only mode`가 꺼져 있어 vision encoder가
배포물에 포함된다.

따라서 gcoli, Jundot, mlx-community의 Qwen3.8 계열을 서로 바꿔도 “VLM이 아닌
순수 LLM engine”으로 전환되는 것은 아니다. 이들 사이의 차이는 주로 다음이다.

- 양자화 포맷
- oQe calibration 여부
- MTP head 보존 방식
- external draft 연결 방식
- 모델 카드·변환 시점

### 8.2 Qwen3.8-27B-4bit도 VLM으로 인식된다

oMLX 로그에서 `Qwen3.8-27B-4bit`는 `type: vlm, engine: vlm`으로 분류됐다.
그러므로 4bit로 바꾸는 것만으로 VLM 경로를 피할 수는 없다.

### 8.3 mxfp4가 빨랐던 이유를 VLM 회피로 설명할 수 없다

mxfp4 결과가 14.30 tok/s로 가장 높았지만, 이 모델도 VLM engine을 사용했다.
따라서 이번 속도 차이는 VLM 여부보다 mxfp4 target의 kernel·메모리 접근·양자화
실행 비용 차이로 해석해야 한다.

## 9. 이번 실험으로 기존 가설을 어떻게 수정했나

기존 글의 핵심 가설은 “DFlash2가 M1 Max에서 Qwen3.8-27B의 디코드 속도를 높일 수
있는가”였다. 후속 측정으로 이 가설은 다음처럼 구체화됐다.

- DFlash2는 M1 Max 64GB의 oMLX 환경에서도 실제로 로드되고 작동했다.
- 다만 Issue #60의 27.12 tok/s는 특정 `dflash-mlx` 직접 실행 경로의 공개 수치다.
- 같은 머신이라도 oMLX에서 같은 조건으로 재현된 값은 아니며, 이번 실측 최고값은
  4bit+DFlash2의 16.52 tok/s였다.
- MTP는 수용률이 높아도 최종 속도가 자동으로 높아지지 않았다. 이번 비교에서는
  `mxfp4 + VLM MTP`가 14.30 tok/s로 가장 빨랐고, 일반 `4bit + VLM MTP`는
  11.75 tok/s였다.

따라서 공개 수치를 그대로 기대하기보다, 실행 경로와 출력 길이·샘플링·캐시 조건을
함께 기록한 뒤 같은 환경 안에서 조합을 비교해야 한다. 이 실험에서 현재 선택할
기준은 순수 생성 속도라면 `4bit + DFlash2`, MTP 방식이라면 `mxfp4 + VLM MTP`다.

## 10. 재현 명령

oMLX 서버가 실행 중이고 `.env.local`에 `OMLX_API_KEY`가 있다는 전제다.

```bash
set -a
source .env.local
set +a

.venv/bin/python -m bench.run \
  --backend omlx \
  --model Qwen3.8-27B-4bit \
  --id web-landing \
  --warm \
  --repeat 1 \
  --params max_tokens=4096,temperature=0.7,thinking=off \
  --timeout 900 \
  --note 'qwen38-4bit-vlm-mtp-web-4k'
```

모델명만 다음처럼 바꾸면 MTP 비교를 재현할 수 있다.

```text
Qwen3.8-27B-mxfp4
Qwen3.8-27B-nvfp4
Qwen3.8-27B-4bit
```

각 모델에 맞는 draft가 oMLX 모델 목록에 있어야 한다.

```text
Qwen3.8-27B-MTP-mxfp4
Qwen3.8-27B-MTP-nvfp4
Qwen3.8-27B-MTP-4bit
```

## 11. 로그에서 확인해야 하는 항목

### VLM MTP 조합

```text
VLM MTP drafter loaded
VLM MTP drafter attached to engine
VLM MTP enabled for Qwen3.8-27B-...
vlm_mtp stats: accepted=... tokens_per_round=...
```

### native/Lightning MTP 조합

```text
MTP path activated
MTP[...] accept=...
```

### 잘못된 비교로 보지 말아야 할 경우

- MTP draft 파일만 로드하고 target 본체를 로드하지 않은 경우
- `max_tokens`가 너무 작아 결과가 잘린 경우
- cold와 warm을 서로 다른 항목처럼 비교한 경우
- DFlash2와 MTP를 동시에 켠 경우
- MTP가 실제로 붙었는지 확인하지 않고 속도만 기록한 경우
- 컨텍스트 상한, temperature, thinking 상태가 다른 결과를 정밀 비교한 경우

## 12. 남은 미확인 사항

이번 실험으로 oMLX GUI 경로의 실제 선택은 정리했지만, 다음은 아직 별도 검증이
필요하다.

1. 원문 Issue #60의 `dflash-mlx` 명령을 이 M1 Max에서 직접 실행했을 때 27.12
   tok/s가 재현되는지
2. oMLX와 `dflash-mlx`가 같은 target·draft에서 서로 다른 kernel을 사용하는지
3. oMLX의 DFlash block size `5`와 adaptive verify가 직접 CLI와 완전히 같은지
4. 512토큰 no-EOS와 4096토큰 HTML 생성의 출력 형태 차이가 acceptance에 미치는 영향
5. M1 Max GPU core 수와 macOS·Metal 버전에 따른 차이
6. 각 모델을 3~5회 반복하고 충분한 cooldown을 둔 중앙값·분산
7. 긴 컨텍스트에서 DFlash2의 prefill 손실이 decode 이득을 상쇄하는지

따라서 현재 문서의 수치는 “이 M1 Max에서 oMLX로 실제 사용했을 때의 관측값”이고,
원문의 수치는 “다른 직접 실행 경로에서 공개된 가능성”으로 분리해서 기록하는 것이
가장 정확하다.

## 13. 최종 판단

원문의 실험은 실패한 것이 아니라, **재현 조건을 더 엄격하게 나눠야 하는 실험**이었다.

- DFlash2의 아이디어와 `w4a32:gs64` 조건은 유효하다.
- M1 Max 64GB에서 DFlash2가 실제로 작동하는 것도 확인했다.
- 그러나 oMLX에서 나온 16.52 tok/s는 공개된 27.12 tok/s와 동일한 benchmark가 아니다.
- Qwen3.8의 모든 후보는 현재 oMLX에서 VLM 본체로 로드된다.
- MTP는 켜져도 일반 4bit에서는 11.75 tok/s에 그쳤다.
- MTP 수용률만으로 최종 속도를 예측할 수 없다.
- 현재 실사용 추천은 속도 기준 `4bit + DFlash2`, MTP 기준 `mxfp4 + VLM MTP`다.

한 문장으로 줄이면 다음과 같다.

> **27.12 tok/s는 구현 불가능한 허위 수치는 아니지만, 현재 oMLX 환경에서 그대로
> 재현된 수치도 아니다. 이 머신에서 검증된 현실적인 최고 속도는 4bit+DFlash2의
> 16.52 tok/s다.**

## 참고 자료

- [원문: M1 Max에서 Qwen3.8-27B를 빠르게 만드는 DFlash2의 조건](/26/qwen38-27b-dflash2-local-experiment)
- [dflash-mlx](https://github.com/bstnxbt/dflash-mlx)
- [dflash-mlx Issue #60 — M1 Max 64GB 측정](https://github.com/bstnxbt/dflash-mlx/issues/60)
- [dflash-mlx Issue #21 — prefill 관련 논의](https://github.com/bstnxbt/dflash-mlx/issues/21)
- [oMLX](https://github.com/jundot/omlx)
- [mlx-community/Qwen3.8-27B-4bit](https://huggingface.co/mlx-community/Qwen3.8-27B-4bit)
- [mlx-community/Qwen3.8-27B-MTP-4bit](https://huggingface.co/mlx-community/Qwen3.8-27B-MTP-4bit)
- [mlx-community/Qwen3.8-27B-mxfp4](https://huggingface.co/mlx-community/Qwen3.8-27B-mxfp4)
- [mlx-community/Qwen3.8-27B-MTP-mxfp4](https://huggingface.co/mlx-community/Qwen3.8-27B-MTP-mxfp4)
- [gcoli/Qwen3.8-27B-oQ4e-mtp](https://huggingface.co/gcoli/Qwen3.8-27B-oQ4e-mtp)
