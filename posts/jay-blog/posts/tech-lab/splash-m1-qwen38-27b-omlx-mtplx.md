---
title: 우연히 발견한 Qwen 3.8 27B의 Splash 엔진 — M1 Max에서 17 tok/s를 넘길 수 있을까
slug: splash-m1-qwen38-27b-omlx-mtplx
category: 기술 실험
summary: DFlash 2를 붙여도 17 tok/s 언저리였던 M1 Max의 Qwen3.8-27B를, Reddit에서 발견한 Splash M1 포트로 직접 재측정했다. 27.2 tok/s라는 나의 수치와 oMLX·MTPLX와의 비교, 테트리스 생성 실패와 긴 세션의 Metal 중단 사례까지.
tags: apple-silicon,benchmark,dflash2,local-llm,mtp,mtplx,omlx,qwen3.8,splash
toc: true
source: http://127.0.0.1:18080/api/blog/posts/114 (내려받음)
---
M1 Max에서 Qwen3.8-27B를 oMLX로 돌릴 때 생성 속도는 DFlash 2 초안 모델까지 붙여 튜닝해도 대략 16~18 tok/s 언저리였다. 코딩 에이전트가 파일을 오래 쓰는 동안 기다리는 일이 잦아 다른 경로를 찾았다. 앞서 같은 Mac에서 Qwen3.8 Flash-Next를 MTPLX의 SSD 스트리밍 팩으로 돌려 약 30 tok/s를 본 [이전 기록](/111/m1max-external-ssd-qwen38-flash-next)이 있다. 그러다 우연히 Reddit에서 같은 M1 Max 64GB로 **27B를 약 39~41.5 tok/s로 실행했다는 기록**을 발견했다. 어떤 모델과 설정으로 얻은 수치인지 확인한 뒤 내 Mac에서도 Splash를 시험했다.

여기서 다룰 중심 모델은 **Qwen3.8-27B**다. Reddit 작성자가 보고한 27B의 속도 변화, Splash·oMLX·MTPLX의 실행 구성, 이 Mac의 재측정과 실패한 코딩 작업을 순서대로 본다. 원문 제목에 나온 35B-A3B의 144 tok/s는 다른 모델이므로 뒤에서 이전 버전과 비교하는 별도 사례로 다룬다. [Reddit 1편](https://www.reddit.com/r/LocalLLM/comments/1woq7cd/you_can_now_run_qwen3827b_on_a_2021_m1_max_at_39/), [2편](https://www.reddit.com/r/LocalLLM/comments/1wqngu9/splash_on_m1_part_2_35ba3b_at_144_toks_on_a_2021/)

## 27B의 짧은 요청은 첫 M1 포트에서 크게 빨라졌다

Reddit 1편의 비교가 27B 속도 변화의 출발점이다. 작성자는 **같은 M1 Max, 같은 27B 4비트 모델, 같은 다섯 프롬프트**에서 기존 Splash 커널 평균 18.9 tok/s, M1 전용 커널 평균 39.1 tok/s를 보고했다. 이는 약 2.1배다. M1이 기본 Splash의 BF16 연산 경로에 맞지 않아 발생한 비용을 전용 행렬 커널로 줄인 결과라고 설명한다. [Reddit 1편의 조건과 결과](https://www.reddit.com/r/LocalLLM/comments/1woq7cd/you_can_now_run_qwen3827b_on_a_2021_m1_max_at_39/)

| 27B 조건 | 측정된 생성 속도 | 측정의 뜻 |
|---|---:|---|
| [기존 Splash 커널, Reddit 1편](https://www.reddit.com/r/LocalLLM/comments/1woq7cd/you_can_now_run_qwen3827b_on_a_2021_m1_max_at_39/) | 18.9 tok/s | 짧은 프롬프트 5개, 서버 측 지표 |
| [첫 M1 전용 커널, Reddit 1편](https://www.reddit.com/r/LocalLLM/comments/1woq7cd/you_can_now_run_qwen3827b_on_a_2021_m1_max_at_39/) | 39.1 tok/s | 바로 위 행과 같은 실험의 개선 후 |
| [후속 M1 포트, Reddit 2편](https://www.reddit.com/r/LocalLLM/comments/1wqngu9/splash_on_m1_part_2_35ba3b_at_144_toks_on_a_2021/) | 41.5 tok/s | 5분 반복, 클라이언트 스트림 지표 |
| 내 M1 Max 재측정 | 27.2 tok/s | 5개 프롬프트를 2회씩, 서버 측 지표 |

후속 `1.0.2-m1.1` 포트에서 27B의 **짧은 입력 속도는 거의 그대로**였고, 주로 긴 문맥 처리가 개선됐다. 51K 문맥에서 생성은 20→25 tok/s, 캐시 없는 38K 입력의 첫 토큰 대기는 359→312초였다. 위 표의 39.1과 41.5는 측정 지점과 반복 시간이 달라 6% 개선의 증거로 읽기 어렵다. [Reddit 2편](https://www.reddit.com/r/LocalLLM/comments/1wqngu9/splash_on_m1_part_2_35ba3b_at_144_toks_on_a_2021/)

## 내가 실행한 27B의 본 모델은 Q4, 그룹 크기 64다

내가 내려받은 `incoai/Qwen3.8-27B-Splash`는 원본 Qwen의 BF16 전체 가중치를 그대로 올린 구성이 아니다. 패키지 모델 카드에는 **4비트 본 모델**이라고 적혀 있다. 실제 다운로드의 `manifest.json`에는 형식이 `splash-packed-q4`, `q4_bits=4`, `q4_group_size=64`로 기록돼 있고, 본 모델의 출처가 `mlx-community/Qwen3.8-27B-4bit`의 특정 커밋으로 고정돼 있다. 그 [고정된 원본 `config.json`](https://huggingface.co/mlx-community/Qwen3.8-27B-4bit/blob/3e6447f082e89cc7f0bc6e5441afd38dfce760ff/config.json)도 `bits=4`, `group_size=64`, `mode=affine`을 가리킨다. 즉 주요 양자화 가중치는 **64개 값씩 묶는 4비트 affine/Q4**이며, Splash가 이를 자체 바이너리 배치로 다시 묶어 읽는다. 이것을 GGUF의 임의의 `Q4_K` 변형과 동일한 파일 형식이라고 부르지는 않는다. [Splash 27B 패키지와 원본 커밋](https://huggingface.co/incoai/Qwen3.8-27B-Splash)

| 내 Splash 패키지의 부분 | 저장 형식 또는 역할 | 크기·설정 |
|---|---|---|
| 27B 본 모델 `target/` | Q4로 포장한 4비트 본체. 임베딩·출력 헤드 등까지 모든 텐서가 4비트라는 뜻은 아님 | 약 14.1GiB |
| `draft/` | 본 모델의 다음 토큰을 제안하는 별도 DFlash 2 모델 | 약 1.2GiB |
| `vision/` | 이미지 입력용 BF16 비전 인코더 | 약 0.9GiB; 이 실험에서는 이미지 입력 미시험 |
| 실행 중 KV 캐시 | 생성하며 누적되는 키·값의 저장 정밀도 | 기본 INT8; 본 모델 가중치의 Q4와 별개 |

파일 전체 다운로드는 약 17.4GB이며, 실행 중 메모리 사용량과 같은 숫자는 아니다. **27B 4비트**는 본 모델 가중치의 양자화 설명이고, **INT8 KV**는 대화 문맥을 저장하는 캐시 설정이다. 또 DFlash 2는 양자화 이름이 아니라 속도를 높이기 위한 초안·검증 방식이다. 세 항목을 각각 바꿀 수 있으므로 `4비트 + DFlash 2 + INT8 KV`라고 적는 편이 정확하다. [모델 카드의 구성](https://huggingface.co/incoai/Qwen3.8-27B-Splash), [Splash KV 기본값](https://github.com/incoai/splash)

## Splash·oMLX·MTPLX는 모두 모델을 실행하는 엔진이다

처음에는 Splash가 모델을 빌드하는 도구인지 헷갈렸다. 셋 다 Mac에서 모델을 로드하고 토큰을 생성하며 API 서버로 제공하는 **추론 엔진**이다. 코딩 에이전트는 이 서버에 연결된다. 모델 가중치, 초안 모델, KV 캐시, 요청 처리 방식을 엔진마다 다르게 묶는다. [Splash](https://github.com/incoai/splash), [oMLX](https://github.com/jundot/omlx), [MTPLX](https://github.com/youssofal/MTPLX)

| 항목 | Splash | oMLX | MTPLX |
|---|---|---|---|
| 중심 가속 방식 | DFlash 2 초안 모델 + 맞춤 Metal 커널 | MLX 기반 서버. 모델별 DFlash 2 또는 MTP 경로 선택 가능 | 모델에 포함된 MTP 헤드로 초안 생성·검증 |
| 이 Reddit 비교의 27B 모델 | Splash용 4비트 본체 + 별도 DFlash 초안 | `Qwen3.8-27B-oQ4e-fp16-mtp` 4비트 + MTP | Optimized Speed 프로필의 MTPLX용 모델 |
| 운영 초점 | 모델별 메모리 계획, 긴 문맥, 프리픽스 재사용, 에이전트 연결 | 여러 모델 제공, 동시 요청, RAM·SSD 계층형 KV 캐시와 관리 UI | MTP 추측 디코딩과 모델별 속도·품질 프로필 |
| Mac 연결 | OpenAI·Anthropic 호환 API, OpenCode 등 연결 명령 | OpenAI·Anthropic 호환 API, 메뉴 막대 앱·관리 UI | OpenAI·Anthropic 호환 서버, 앱·CLI |
| M1 Max에서의 경로 | 공식 배포는 M3+; 이번 실험은 비공식 M1 포트 | 공식 지원 범위에 M1 포함 | M1/M2용 FP16 변형 제공 |

이 표의 차이는 제품의 초점이지 기능의 독점 목록이 아니다. 예를 들어 oMLX도 DFlash 2를 쓸 수 있고, Splash도 요청 배칭과 디스크 캐시 옵션을 제공한다. MLX 엔진 역시 Metal 커널을 사용한다. 최근 oMLX 저장소는 Splash와 MTPLX의 커널 아이디어를 차용했다고 명시한다. 따라서 “Splash만 Metal을 쓰고 oMLX는 쓰지 않는다”처럼 나누면 구현을 잘못 설명하게 된다. [Splash 기능과 설정](https://github.com/incoai/splash), [oMLX 기능과 기여 표기](https://github.com/jundot/omlx)

세 엔진의 Reddit 27B 조합은 모두 넓게는 4비트 계열이지만 **같은 양자화 파일은 아니다**. Splash의 Q4 그룹 64 패키지, oMLX의 `oQ4e-fp16-mtp`, MTPLX의 동적 4비트 `Optimized Speed`는 본 모델 구성과 초안 경로가 다르다. 따라서 41.5·25.9·19.8 tok/s의 차이를 커널 하나의 효과로 환원할 수 없다. [Reddit의 모델 설정](https://www.reddit.com/r/LocalLLM/comments/1wqngu9/splash_on_m1_part_2_35ba3b_at_144_toks_on_a_2021/), [MTPLX 모델 카드](https://huggingface.co/Youssofal/Qwen3.8-27B-MTPLX-Optimized-Speed-FP16)

## 빠른 생성의 핵심은 다음 토큰을 미리 제안하고 검증하는 방식이다

일반 생성에서는 큰 모델이 토큰 하나를 확정할 때마다 다음 단계를 실행한다. 추측 디코딩은 가벼운 경로가 여러 토큰을 먼저 제안하고, 본 모델이 그 묶음을 검증해 채택 가능한 토큰을 한 번에 진행한다. 제안이 잘 맞고 검증이 충분히 빠를 때 이득이 난다. 제안이 빗나가거나 검증 자체가 느리면 기대한 배율이 나오지 않는다.

Splash의 이 실험용 패키지에는 **27B 4비트 본체, 별도 DFlash 2 초안 모델, 비전 인코더와 토크나이저**가 함께 들어 있다. 다운로드 크기는 약 17.4GB다. 이 특정 `incoai/Qwen3.8-27B-Splash` 패키지는 Splash 전용이어서 MLX 체크포인트처럼 oMLX에 그대로 넣을 수 없다. 다만 현재 Splash 엔진 자체는 별도의 GGUF·MLX 4비트 입력도 지원한다. **패키지의 호환성과 엔진의 지원 형식을 혼동하면 안 된다.** [Splash 27B 모델 카드](https://huggingface.co/incoai/Qwen3.8-27B-Splash), [Splash 지원 형식](https://github.com/incoai/splash)

MTPLX는 별도 DFlash 모델 대신 **본 모델의 MTP 헤드**를 초안 경로로 쓴다. 제작자는 제안 토큰을 본 모델로 검증하고, 거절 시 보정 샘플링을 적용해 원래 샘플링 분포를 유지한다고 설명한다. M1/M2 권장 `Optimized-Speed-FP16`은 이름과 달리 27B 전체가 16비트라는 뜻이 아니다. 4비트 동적 양자화를 바탕으로 남는 부동소수점 텐서를 FP16으로 저장한 변형이다. 모델 카드의 다운로드 크기는 20.4GB, 기본 MTP 깊이는 3이다. 카드에 적힌 60~80 tok/s대 수치는 **M5 Max 측정**이며, 제작자도 그 카드에는 M1/M2 실측치를 발표하지 않았다고 썼다. [MTPLX 원리](https://github.com/youssofal/MTPLX), [M1/M2용 모델 카드](https://huggingface.co/Youssofal/Qwen3.8-27B-MTPLX-Optimized-Speed-FP16)

MTPLX 앱은 기기에서 MTP 깊이별 실제 속도를 재서 유리한 값을 저장할 수 있다. 현재 서버 설명에는 재시작 후 복구하는 SSD 세션 캐시와 임베딩·재순위화 모델 제공도 들어 있다. 그러므로 “캐시는 oMLX만의 기능”이라는 식으로 구분하지 않는다. oMLX의 차별점은 여러 모델과 동시 요청을 한 서버에서 운영하는 관리 방식, MTPLX의 차별점은 맞는 MTP 헤드를 포함한 패키지와 그 깊이 튜닝에 가깝다. [MTPLX 자동 튜닝과 서버 기능](https://github.com/youssofal/MTPLX), [oMLX 기능](https://github.com/jundot/omlx)

oMLX는 MLX를 바탕으로 여러 모델과 요청을 관리한다. DFlash 2와 MTP를 모델별로 고를 수 있고, RAM의 뜨거운 KV 블록과 SSD의 차가운 블록을 나눠 저장한다. 맞는 접두어가 다시 오면 SSD의 캐시를 복구할 수 있으며, 서버를 재시작한 뒤에도 활용할 수 있다고 설명한다. 긴 코딩 대화와 여러 모델을 오가며 운영할 때 중요한 기능이다. 내 기존 조합은 `mlx-community/Qwen3.8-27B-4bit`에 `z-lab/Qwen3.8-27B-DFlash2`를 붙였지만, **Reddit의 oMLX 19.8 tok/s는 그 조합이 아니라 MTP 모델**을 썼다. 같은 엔진 이름만 보고 내 DFlash 2 수치와 곧바로 배율을 계산할 수 없는 이유다. [oMLX 설명](https://github.com/jundot/omlx), [Reddit 비교 조건](https://www.reddit.com/r/LocalLLM/comments/1wqngu9/splash_on_m1_part_2_35ba3b_at_144_toks_on_a_2021/)

## Reddit의 41.5 대 25.9 대 19.8은 같은 Mac의 엔진 구성 비교다

Reddit 작성자는 M1 Max 64GB에서 엔진을 하나씩 실행했다. Qwen3.8-27B로 같은 다섯 프롬프트를 5분간 반복했고, 각 요청의 출력 상한은 250토큰, 추론 강도는 `xhigh`였다. 속도는 서버 내부 값이 아니라 **클라이언트가 받은 스트림**에서 계산했다. 각 엔진에는 작성자가 고른 빠른 모델 패키지와 설정이 적용됐다. 그러므로 이 결과는 사용자 입장에서 각 구성의 비교이지, 같은 가중치·같은 양자화에서 엔진 코드 한 요소만 바꾼 실험은 아니다. [측정 방법과 결과](https://www.reddit.com/r/LocalLLM/comments/1wqngu9/splash_on_m1_part_2_35ba3b_at_144_toks_on_a_2021/)

| Reddit 작성자의 27B 측정 | Splash | MTPLX | oMLX |
|---|---:|---:|---:|
| 5분 반복 생성 | **41.5 tok/s** | 25.9 tok/s | 19.8 tok/s |
| 생성 중 GPU 평균 온도 | 75.3°C | 78.8°C | 77.7°C |
| 생성 토큰당 패키지 에너지 | 1.06J | 1.69J | 2.20J |
| 44K 입력 후 보고된 메모리, 괄호는 최대 | 21GB (21GB) | 35GB (40GB) | 23GB (31GB) |

이 조건에서 Splash의 생성 속도는 MTPLX의 약 1.6배, oMLX의 약 2.1배다. 온도와 에너지 수치도 작성자 장비에서는 Splash가 낮았다. 다만 팬은 모든 실험에서 최대 속도였고, 작성자는 GPU 50°C부터 팬을 올려 80°C에 최대가 되는 사용자 곡선을 썼다. 다른 Mac의 기본 팬 정책에 수치를 그대로 적용할 수 없다. 작성자는 5분 동안 GPU 클럭 저하를 관찰하지 않았다고 썼지만, 그것이 모든 기기의 발열 결과를 보증하지도 않는다. [Reddit 실측](https://www.reddit.com/r/LocalLLM/comments/1wqngu9/splash_on_m1_part_2_35ba3b_at_144_toks_on_a_2021/)

메모리 행도 **완전히 같은 계측기로 잰 값이 아니다**. oMLX와 MTPLX는 macOS 프로세스의 physical footprint이고, Splash는 메모리 매핑된 가중치가 그 footprint에 빠진다는 이유로 엔진이 센 GPU 할당량이다. 보고값은 유용하지만, 21GB와 23GB의 차이를 정밀한 메모리 우위로 읽기는 어렵다. [Reddit 메모리 측정 설명](https://www.reddit.com/r/LocalLLM/comments/1wqngu9/splash_on_m1_part_2_35ba3b_at_144_toks_on_a_2021/)

원문은 27B에서 기존 커널과 M1 포트의 다음 토큰 선택이 99.84% 일치하고, 두 모델이 산술·물리 문항 54개를 모두 맞혔다고도 보고한다. 이는 커널 변경 전후의 좁은 회귀 확인이다. 양자화된 세 엔진의 코딩 품질이 같거나, 장시간 에이전트가 만든 프로그램이 정상 동작한다는 검증은 아니다. [Reddit 품질 확인 범위](https://www.reddit.com/r/LocalLLM/comments/1wqngu9/splash_on_m1_part_2_35ba3b_at_144_toks_on_a_2021/)

## 긴 입력의 첫 토큰은 다른 결과를 만든다

같은 글에서 **캐시 없는 44K 입력의 prefill**은 Splash 102 tok/s, MLX 기반 두 엔진은 125~127 tok/s였다. 이 구간에서는 생성 속도 순위가 뒤집힌다. 38K 입력에 대한 Splash 27B의 첫 토큰 대기 시간도 개선 후 312초다. 41.5 tok/s라는 생성 속도만 보면 긴 문서를 처음 읽힐 때의 수 분 대기를 놓친다. [Reddit 긴 입력 측정](https://www.reddit.com/r/LocalLLM/comments/1wqngu9/splash_on_m1_part_2_35ba3b_at_144_toks_on_a_2021/)

반복 요청에서는 접두어 캐시가 중요해진다. 코딩 에이전트는 앞선 대화와 파일 내용을 여러 차례 다시 보내기 때문이다. Reddit의 실제 OpenCode 세션에서 27B의 중앙 생성 속도는 30~64K 문맥 약 30 tok/s, 64~96K 약 20 tok/s, 128~157K 약 14 tok/s였다. 이때도 이전 입력의 대부분은 Splash 프리픽스 캐시에서 왔다. 내 서버는 최대 문맥을 **64K**로 설정했으므로 그 글의 128K 이상 구간을 현재 설정에서 그대로 재현한 것은 아니다. [Reddit OpenCode 세션](https://www.reddit.com/r/LocalLLM/comments/1wqngu9/splash_on_m1_part_2_35ba3b_at_144_toks_on_a_2021/)

여기서 세 값을 따로 기록해야 한다. `prefill tok/s`는 입력을 읽는 속도, `time to first token`은 처음 응답을 볼 때까지의 시간, `decode tok/s`는 생성이 시작된 뒤의 속도다. 캐시 적중률과 실제 입력 길이를 빼고 하나의 tok/s만 남기면 체감 속도를 설명하기 어렵다.

## 35B-A3B는 별도 최적화로 99에서 144 tok/s가 됐다

Reddit 제목의 144 tok/s는 **Qwen3.6-35B-A3B**다. 27B와 달리 전문가 일부만 토큰마다 활성화하는 MoE 모델이며, 제작자 카드에는 총 35B 중 약 3B가 토큰당 활성화된다고 적혀 있다. 두 모델 모두 Splash 패키지에서는 4비트 본체와 DFlash 2 초안을 사용하지만, 매 토큰에 계산하는 구조가 다르다. 따라서 144를 27B의 속도로 읽을 수 없다. [35B-A3B Splash 모델 카드](https://huggingface.co/incoai/Qwen3.6-35B-A3B-Splash)

“일반적인 35B 속도”는 기기와 엔진, 양자화, 입력 길이를 정하지 않으면 하나로 말하기 어렵다. 이 글에서 쓸 수 있는 기준선은 **같은 작성자·같은 M1 Max·같은 다섯 프롬프트의 이전 Splash M1 포트**다. 그 조건에서 35B-A3B는 이전 `1.0.2-m1`의 약 **99 tok/s**에서 새 `1.0.2-m1.1`의 약 **144 tok/s**로 올랐다. 약 1.45배다. 38K 입력의 첫 토큰 대기도 106초에서 72초로 줄었다. 작성자는 이번 버전에서 MoE 전문가 층의 M1용 Metal 커널을 교체한 효과라고 설명한다. 이 변화는 앞서 본 27B의 짧은 입력 개선과 구분해야 한다. [Reddit 2편의 이전·이후 측정](https://www.reddit.com/r/LocalLLM/comments/1wqngu9/splash_on_m1_part_2_35ba3b_at_144_toks_on_a_2021/)

같은 작성자의 OpenCode 세션에서는 30~64K 문맥에서 35B-A3B가 약 75 tok/s, 27B가 약 30 tok/s였다. 128~157K에서는 각각 약 45와 14 tok/s였다. 이 값은 35B가 코드 작업을 더 잘 끝낸다는 품질 비교가 아니라 **서로 다른 모델의 생성 속도 기록**이다. 나는 이 Mac에 35B-A3B를 내려받아 직접 돌리지는 않았다. [Reddit OpenCode 기록](https://www.reddit.com/r/LocalLLM/comments/1wqngu9/splash_on_m1_part_2_35ba3b_at_144_toks_on_a_2021/)

## 내 M1 Max에서는 27.2 tok/s를 측정했다

내 기기는 14인치 MacBook Pro의 M1 Max, 32코어 GPU, 통합 메모리 64GB이며 macOS 26.6.2에서 전원 어댑터를 연결하고 저전력 모드를 껐다. 공식 Splash 배포는 M3 이상을 대상으로 하므로, M1에서는 커뮤니티의 비공식 `splash-m1` 1.0.2-m1.1 포트를 설치했다. `incoai/Qwen3.8-27B-Splash`를 64K 문맥 상한, 기본 INT8 KV 캐시로 실행했다. [M1 포트 릴리스](https://github.com/paperniuk/splash/releases/tag/1.0.2-m1.1), [Splash 공식 요구 사항](https://github.com/incoai/splash)

실행 명령은 `splash-m1 serve --model incoai/Qwen3.8-27B-Splash --port 8001 --max-context 64K --default-reasoning-effort medium`이었다. 64K는 입력과 출력의 합계 상한이다. OpenCode 연결기가 이 상한에서 입력 예산 49,152토큰과 최대 출력 16,384토큰으로 나누었고, 출력 예산에는 보이는 답변뿐 아니라 추론 토큰도 들어간다. 서버 기본 추론 강도 `medium`과 아래 벤치마크 요청의 `xhigh`, 테트리스 재시도의 `none`은 서로 다른 조건이다. `--max-context`나 최대 출력값을 크게 잡는다고 초당 생성 속도가 자동으로 올라가지는 않는다. [Splash 모델 카드의 추론 설정](https://huggingface.co/incoai/Qwen3.8-27B-Splash)

Reddit 1편의 다섯 프롬프트와 `temperature=0`, `reasoning_effort=xhigh`, 출력 상한 250토큰을 맞춰 한 번 워밍업한 다음, 순방향·역방향으로 두 차례 측정했다. 서버가 보고한 생성 속도의 평균은 **27.2 tok/s**였다. 첫 회 평균은 30.3, 두 번째는 24.2 tok/s였다. 프롬프트별 차이도 커서 수학은 두 회에 55.6과 34.1 tok/s, 기술 설명은 16.1과 15.3 tok/s였다. 원자료는 작업 디렉터리의 `REDDIT_MATCHED_BENCH.json`에 보관했다.

이는 Reddit 1편의 서버 측 평균 39.1 tok/s보다 약 30% 낮다. 하지만 Reddit 2편의 **41.5 tok/s는 5분 반복의 클라이언트 스트림 측정**이므로 내 서버 지표 27.2와 동일한 방식의 A/B가 아니다. 당시 내 Mac에서는 다른 앱도 실행 중이었고 GPU 온도·클럭·팬 회전수를 기록하지 않았다. 두 회 사이의 속도 하락은 관측했지만, 이를 열에 의한 클럭 저하라고 확정할 자료는 없다. [Reddit 1편](https://www.reddit.com/r/LocalLLM/comments/1woq7cd/you_can_now_run_qwen3827b_on_a_2021_m1_max_at_39/), [Reddit 2편](https://www.reddit.com/r/LocalLLM/comments/1wqngu9/splash_on_m1_part_2_35ba3b_at_144_toks_on_a_2021/)

기존 MLX + DFlash 2 조합에서는 다른 시점의 512토큰 번들 CLI 시험이 17.53 tok/s, 4,096토큰을 출력한 oMLX 0.6.3rc3 API 시험이 16.52 tok/s였다. 모델 패키지, 프롬프트, 출력 길이, 샘플링과 런타임 버전이 모두 위 Splash 시험과 다르다. **Splash 27.2를 oMLX 16.52로 나눠 엔진의 확정적 향상 배율이라고 부르지 않는다.** MTPLX는 아직 이 Mac에서 직접 측정하지 않았다.

## 추론을 꺼서 얻은 속도는 작업 성공률과 함께 봐야 한다

짧은 요청 세 가지를 따로 골라 `none`과 `medium`, 다시 `none`과 `xhigh`를 교차 측정했다. 모두 250토큰 상한에 도달한 실험에서 서버 생성 속도 평균은 `none` 36.0 대 `medium` 31.7 tok/s, 다른 회차에서는 `none` 35.3 대 `xhigh` 28.5 tok/s였다. 각각 약 14%, 24% 빠른 셈이다. 이 차이는 특정 프롬프트와 250토큰 상한에서 얻은 결과이며 답변 품질은 평가하지 않았다. 원자료는 `REASONING_AB_BENCH_MEDIUM.json`, `REASONING_AB_BENCH_XHIGH.json`에 있다.

실제 OpenCode 작업에서는 결과가 더 까다로웠다. Splash 서버와 에이전트를 연결해 홀드 기능이 있는 테트리스를 생성하도록 했는데, `medium` 추론의 첫 호출은 긴 추론만 출력하다 파일을 만들지 못해 중단했다. 추론을 끈(`none`) 재시도에서는 HTML 초안이 시작 후 약 7분 만에 나왔다.

별도 Chrome 검사에서 초안의 홀드 직후 재사용 버그를 찾아 수동으로 고친 뒤 최종 검사를 통과했지만, 다음 날 `none`으로 새 폴더에서 다시 만든 시도는 다르게 실패했다. 시작 버튼이 첫 조각을 만들지 못했고, 수정 요청 뒤에도 `rotatedCells`가 회전값을 무시해 회전 모양이 같거나, 충돌 검사가 회전 전 셀을 보거나, 렌더링에서 x 좌표를 두 번 더하는 결함이 남았다. 모델이 짠 자체 테스트는 사용자 경로를 건너뛰어 이 결함을 못 잡았다. 사용자 확인에서도 **작동하는 게임으로 판정하지 못했다**. 생성 tok/s가 높아도 결과를 수정하고 다시 검증해야 한다면 전체 작업 시간은 짧아지지 않을 수 있다. 이 기록은 모델 품질의 일반 평가가 아니라 한 작업의 실패 사례다.

![OpenCode가 만든 테트리스 — 홀드·다음 조각·점수 판은 갖췄지만 회전과 충돌 결함으로 미완성](/api/wiki-assets/9afcc09f-e6c4-4bc4-b263-5592baae6368)

## 긴 에이전트 세션에서는 Metal 오류로 엔진이 멈췄다

속도보다 먼저 실사용에서 걸린 것은 안정성이었다. leneu-benchmark의 `RUN_PROMPT`를 OpenCode에서 길게 돌리는 동안 Splash의 Metal GPU 명령이 이틀에 걸쳐 반복해서 실패했다.

```text
Metal backend is unhealthy: Metal command 69680 failed (sparse event 0):
Impacting Interactivity (0000000e:kIOGPUCommandBufferCallbackErrorImpactingInteractivity)

engine is recovering; retry shortly
```

`Impacting Interactivity`는 macOS가 화면 반응성을 해치는 긴 GPU 작업을 중단시키는 계열의 오류다. MLX와 oMLX 저장소에도 장문 prefill에서 같은 오류 코드의 재현 보고가 있어 Splash만의 문제로 보기 어렵다. 다만 다른 엔진·모델·기기의 사례이므로 이번 실패의 구체적인 커널까지 증명된 것은 아니다. [MLX 보고](https://github.com/ml-explore/mlx/issues/3302), [oMLX 보고](https://github.com/jundot/omlx/issues/1387)

멈춤의 양상이 특이했다. 서버는 엔진을 자동 재시작해 곧 `ready=true`로 돌아오지만, OpenCode는 서버의 `Retry-After: 1`을 따라 약 1초 간격으로 재시도하다 5회를 소진해 그 턴을 오류로 끝낸다. 엔진 복구에 걸리는 시간보다 재시도 예산이 먼저 떨어지는 것이다. 게다가 엔진이 재시작되면 이전 캐시가 사라져 같은 큰 입력을 처음부터 다시 처리해야 한다. 그래서 서버 상태만 보면 멀쩡한데 에이전트는 멈춰 있는 화면이 만들어졌다. 첫 실패는 9월 29일 17:12였고, 같은 세션의 재요청·이튿날 재시도를 거치며 엔진 자동 재시작은 누적 5회가 됐다.

압축(문맥 줄이기)만으로는 막지 못했다. 세션의 자동 압축은 한 차례 성공했지만 이후 문맥이 다시 84K까지 커졌고, 다음 압축 기준(86,496토큰) 직전에 Metal 오류가 먼저 왔다. 입력 예산을 81,920으로 낮춰 압축 기준을 61,920으로 당긴 뒤에는 수동 1회·자동 5회 압축이 전부 성공했는데도 재발했다. 이유가 두 가지로 보인다. 하나는 OpenCode가 **마지막 완료 응답의 토큰 합계**로만 압축 여부를 판단해서, 응답 뒤에 붙은 도구 결과는 계산 밖이라는 것 — 실제로 44,045토큰의 응답 뒤 웹 도구 결과 3건이 약 22,940토큰을 더해 다음 요청이 6만 토큰대로 커진 채 실패했다. 다른 하나는 51,487토큰에서 1,355자 파일 읽기 뒤에도 같은 오류가 난 사례가 있어, 요청 크기만으로는 설명되지 않는다는 것. 압축 없이 같은 문맥을 재시도한 경로는 17분 동안 돌다가 두 번 연속 실패했다.

다만 `/compact`는 실제로 통했다. 중단된 세션에서 수동 `/compact`로 문맥을 줄인 뒤에는 작업이 다시 이어졌고, 벤치마크 실행은 manifest 기준 28개 과제 완료까지 도달했다. 큰 도구 결과로 부풀은 대화를 새 세션에서 실행 폴더만 참조해 이어가는 절차도 우회책으로 정리해 두었다. 즉 이 오류는 "한 번 난 세션은 버려야 하는" 종류가 아니라 문맥을 줄이면 다시 갈 수 있는 종류였다. 근본 원인(특정 GPU 커널, 당시 GPU 경합·발열)은 로그만으로 식별되지 않아, 장기적으로는 서버 버전·macOS·하드웨어·오류 로그·직전 요청 크기를 묶어 M1 포트 관리자에게 재현 보고하는 편이 맞다.

## 지금은 엔진별 강점과 남은 검증 범위를 나눠 선택한다

내 사용 목적이 한 모델의 긴 코드 생성을 빠르게 받는 것이라면 Splash M1 포트가 시험할 만한 후보가 됐다. 공개 비교에서 27B 생성·전력은 유리했고, 내 Mac에서도 기존 oMLX 실험보다 빠른 짧은 요청이 있었다. 반면 첫 장문 입력은 느렸고, M1 실행 경로는 공식 지원이 아닌 커뮤니티 포트다. 엔진의 현재 기능은 늘어나고 있으므로 “Splash는 전용 패키지만 된다”는 옛 설명도 그대로 쓰지 않는다. [Splash 저장소](https://github.com/incoai/splash), [M1 포트](https://github.com/paperniuk/splash/releases/tag/1.0.2-m1.1)

여러 모델을 관리하고 긴 대화의 KV 캐시를 재사용하려면 oMLX의 메뉴 막대 관리, 동시 요청, RAM·SSD 캐시가 실용적이다. MTP 기반 조합을 집중적으로 튜닝하려면 MTPLX가 분명한 선택지다. MTPLX의 M1용 FP16 패키지는 따로 제공되지만, 내 Mac의 같은 작업으로 재측정하기 전에는 Reddit의 25.9 tok/s를 개인 기기의 예상치로 확정할 수 없다. [oMLX 저장소](https://github.com/jundot/omlx), [MTPLX M1/M2 모델 카드](https://huggingface.co/Youssofal/Qwen3.8-27B-MTPLX-Optimized-Speed-FP16)

그래도 체감은 남는다. DFlash 2를 붙여도 17 tok/s 언저리를 벗어나지 못하던 27B가, 같은 Mac에서 27 tok/s를 넘고 Reddit 작성자 조건에서는 40 tok/s에 가까워진다. 짧은 코딩 요청이 이 정도로 돌아오면, 클라우드 API를 빼고 이 Mac 하나로 코딩 에이전트를 돌리는 그림이 갑자기 현실적으로 보인다. 답은 아직 안 냈지만 "이 속도면 로컬로 대체해도 되지 않을까"라는 질문을 처음 진지하게 던질 수 있게 됐다.

다음 비교에서는 세 엔진을 같은 Mac에서 한 번에 하나씩 돌리고, 동일한 프롬프트·샘플링·실제 출력 토큰 수를 고정해야 한다. 짧은 입력과 16K·44K 장문을 나누며, 첫 요청과 캐시가 붙은 반복 요청을 따로 잰다. 생성 속도 외에 첫 토큰 시간, 메모리·스왑, 온도·클럭, 그리고 코딩 작업의 **완성 여부**까지 기록해야 한다. 현재 확인된 27B의 결론은 좁다. Reddit의 41.5 tok/s를 이 Mac의 27.2 tok/s로 아직 재현하지 못했고, 그 간격의 원인은 남아 있다. 장시간 세션에서는 Metal 오류로 엔진이 다섯 차례 멈췄다 — `/compact`로 이어갈 수 있었지만 원인은 미확정이고, 긴 로컬 작업을 무인으로 맡기려면 이 안정성이 먼저다. 35B-A3B의 144 tok/s는 별도 모델의 사례다.
