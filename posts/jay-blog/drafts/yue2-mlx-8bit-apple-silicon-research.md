title: "YuE2 MLX 8bit은 Apple Silicon에서 쓸 만한가: Suno·ACE-Step과 비교"
slug: yue2-mlx-8bit-apple-silicon-research
category: 리서치
summary: "YuE2 출시 일정, 8bit MLX 포트의 저장공간·속도, Suno·ACE-Step 대비 방식과 수치, 실제 커뮤니티 반응을 근거 수준별로 비교했다."
tags: yue2, mlx, apple-silicon, music-generation, local-ai, ace-step
toc: true
publishedAt: 2026-09-21T02:58:03.157582+09:00
syncHash: 4151df0568f3f75a65d9caf72c67c6664fdabd654c6076fe58812f2b15a8a74c

---

YuE2는 2026년 9월에 막 공개된 음악 생성 모델이다. 공개 직후 “Suno를 대체할 수 있다”, “ACE-Step보다 낫다”는 반응이 빠르게 퍼졌지만, 이 말들은 생성 품질·편집 방식·로컬 실행성·라이선스를 한데 섞기 쉽다. 이 글에서는 Apple Silicon에서 쓸 수 있는 8bit MLX 포트를 중심으로 YuE2, Suno, ACE-Step을 비교한다.

결론부터 말하면, Apple Silicon에서 가볍게 시험할 YuE2 경로로는 8bit MLX 포트가 가장 현실적이다. 다만 이것은 YuE2 팀이 배포한 공식 macOS 런타임이 아니라 커뮤니티 변환본이다. 원본 모델의 평가 수치, 포트 유지보수자의 측정값, 사용자의 반응을 같은 수준의 근거로 섞지 않는 것이 중요하다.

> 이 글의 환경은 M1 Max·통합 메모리 64GB Mac이다. 실제 생성 속도는 아직 이 장비에서 측정하지 않았다. 아래의 속도는 포트 유지보수자와 다른 Mac 사용자가 공개한 참고값이다.

## 출시는 2026년 9월 중순이며, 비교 대상도 빠르게 바뀌고 있다

YuE2는 [공식 저장소의 공개 일정](https://github.com/multimodal-art-projection/YuE)상 2026년 9월 14일 전체 언어 지원을 먼저 공개했고, 9월 17일 글로벌 공개, 9월 20일 text-to-audio 공개를 이어갔다. 그래서 이 글을 쓰는 시점에는 출시 직후의 모델에 가깝다. 반면 [Suno v6](https://suno.com/release-notes/introducing-v6)는 9월 9일 공개됐고, ACE-Step v1.5는 [2026년 1월 28일](https://github.com/ace-step/ACE-Step), 더 큰 XL 계열은 [4월 2일](https://github.com/ace-step/ACE-Step-1.5/releases)에 나왔다. 세 모델을 같은 세대의 완성도라고 전제하면 안 되는 이유다.

| 모델 | 최근 기준 시점 | 주된 작업 방식 | Mac에서의 현실적인 경로 |
| --- | --- | --- | --- |
| **YuE2** | 2026년 9월 14~20일 순차 공개 | 가사·스타일 → 편집 가능한 멜로디·화성 계획 → 음원 | 커뮤니티 MLX 포트 또는 별도 Mac 앱 |
| **Suno v6** | 2026년 9월 9일 공개 | 웹 서비스 안에서 텍스트·오디오·이미지·영상 기반 생성 및 부분 편집 | 로컬 실행 경로 없음, v6·v6-wild는 유료 사용자 대상 |
| **ACE-Step v1.5** | 2026년 1월 28일 공개, XL은 4월 2일 | 로컬 생성과 cover·remix·repaint 같은 음원 중심 편집 | 공식 프로젝트의 macOS/MLX 경로 |

Suno는 서비스로서의 편의성이 기준이다. v6는 특정 구간 편집, 여러 소스의 mashup, 샘플 분리 같은 작업을 웹 제품 안에서 제공한다. YuE2는 완성 음원을 바꾸기 전에 **악보 계획을 확인하고 고친다**는 쪽에 더 가깝다. ACE-Step은 이미 가진 음원을 cover·remix·repaint하는 작업과 빠른 로컬 반복에 강점이 있다. 즉 “어느 쪽이 더 좋나”보다, 계획을 고칠지·음원을 고칠지·클라우드 제품을 쓸지가 먼저인 비교다.

## YuE2가 주목받는 이유는 음원을 바로 뽑는 것만은 아니다

[YuE2 공식 저장소](https://github.com/multimodal-art-projection/YuE)는 가사와 스타일 지시를 받아 먼저 멜로디·화성 계획을 만들고, 그 계획을 바탕으로 보컬과 반주가 포함된 곡을 합성하는 구조를 설명한다. 생성 과정에 ABC 악보를 남길 수 있어서, 결과 음원만 듣는 대신 멜로디와 코드 계획을 확인하거나 고쳐 다시 렌더링할 수 있다는 점이 핵심이다.

```mermaid
flowchart LR
  A[가사와 스타일] --> B[멜로디·화성 계획 / ABC]
  B --> C[의미 토큰 생성]
  C --> D[음향 latent 합성]
  D --> E[48 kHz 스테레오 음원]
  B --> F[사람 또는 에이전트의 악보 수정]
  F --> C
```

공식 저장소는 WildSongBench에서 YuE2의 best-of-8 설정이 높은 평균 점수를 기록했다고 밝힌다. 다만 이는 프로젝트 팀이 공개한 프로토콜과 결과이므로, "Suno를 이겼다"는 식의 독립 검증 결론으로 읽기보다 모델 팀의 재현 가능한 주장으로 다루는 편이 정확하다. 저장소도 후보를 여덟 개 생성해 고르는 best-of-8과 일반 설정을 구분하며, 작은 평균 차이가 통계적 유의성을 뜻하지는 않는다고 명시한다.

## Suno와 ACE-Step을 수치로 읽을 때는 best-of-8을 분리해야 한다

[YuE2 팀의 WildSongBench 결과](https://github.com/multimodal-art-projection/YuE/blob/main/docs/benchmarks.md)는 2026년 9월 12일, 192개 프롬프트·17개 설정을 자동 평가했다고 설명한다. 이 표는 서로 다른 회사 모델을 한 조건에 놓은 유용한 참고 자료지만, YuE2가 공개한 자체 평가라는 한계도 함께 가진다.

| 설정 | SongBench Avg ↑ | 이 수치를 읽는 법 |
| --- | ---: | --- |
| YuE2 (best-of-8) | **6.9632** | 여덟 후보 중 선택한 결과라 생성 비용과 선택 과정이 더 든다. |
| Suno v5 | 6.8721 | YuE2 팀의 자동 평가에서의 비교값이다. |
| YuE2 | 6.7316 | 기호 계획을 쓰는 일반 YuE2 설정이다. |
| Suno v5.5 | 6.7150 | 같은 표의 비교값이다. |
| Suno v6 | 6.5562 | 같은 표의 비교값이다. |
| ACE-Step 1.5 | 6.0118 | 같은 표의 공개 가중치 모델 비교값이다. |

여기서 말할 수 있는 범위는 제한적이다. YuE2의 **best-of-8**은 표 안에서 가장 높은 관측 평균을 기록했고, 일반 YuE2도 Suno v5.5와 근접했다. 그러나 best-of-8을 단 한 번 생성한 Suno나 ACE-Step 결과와 일대일 비용·속도 비교로 바꾸면 안 된다. 이 벤치마크는 자동 점수이고, 취향·보컬 언어·장르·편집 경험은 별도로 확인해야 한다.

ACE-Step과의 실무 비교에서는 수치보다 산출물의 성격이 더 다르다. ACE-Step 1.5는 결과 음원에서 변주와 편집을 이어 가는 도구에 가깝고, YuE2는 생성 전에 드러난 ABC 계획을 사람이 검토하고 수정한 뒤 다시 합성할 수 있다. 반대로 빠르게 여러 초안을 듣고 선택하는 작업이라면 ACE-Step의 익숙한 워크플로가 더 낫게 느껴질 수 있다. **YuE2 MLX 8bit의 가중치는 4.2GB**라서 저장공간에는 유리하지만, 작업 방식까지 자동으로 대체하지는 않는다.

## MLX 8bit은 공식 배포물이 아니라 Apple Silicon용 커뮤니티 포트다

공식 YuE2 빠른 시작은 Linux, Python 3.12, BF16을 지원하는 24GB NVIDIA GPU를 전제로 한다. 즉 Mac 사용자가 원본 경로를 그대로 따라가도록 설계된 배포는 아니다. 반면 [ahmadw의 YuE2-3B-MLX](https://huggingface.co/ahmadw/YuE2-3B-MLX)는 YuE2-3B와 VAE를 Apple Silicon의 MLX용으로 옮긴 커뮤니티 포트다. PyTorch 의존성 없이 가사·스타일 입력에서 48kHz 스테레오 음원과 선택적 ABC 계획을 생성한다고 설명한다.

| 경로 | 무엇을 제공하나 | 판단할 때 주의할 점 |
| --- | --- | --- |
| [YuE2 원본](https://github.com/multimodal-art-projection/YuE) | 모델 팀의 코드, 생성·편집 파이프라인 | 기본 빠른 시작은 NVIDIA CUDA 기준이다. |
| [YuE2-3B-MLX](https://huggingface.co/ahmadw/YuE2-3B-MLX) | MLX 네이티브 추론 코드와 양자화 가중치 | 커뮤니티 변환·유지보수 경로다. |
| [YuE Studio](https://github.com/tonywestonuk/YuE-Studio) | Apple Silicon용 Mac 앱과 설치 흐름 | 원본 모델 위에 별도 앱·엔진을 얹은 프로젝트다. |

이 구분이 중요한 이유는 호환성 문제의 위치가 다르기 때문이다. 최근 원본 저장소의 [Apple Silicon MPS 이슈](https://github.com/multimodal-art-projection/YuE/issues/176)에는 특정 BF16 causal attention 경로가 잘못된 결과를 낼 수 있다는 재현 보고와 우회 패치가 올라와 있다. 이는 해당 이슈 작성자의 환경 보고이지, 모든 Mac에서 YuE2가 실패한다는 뜻은 아니다. 다만 원본 PyTorch/MPS 경로를 선택할 때는 버전 고정과 재현 테스트가 필요하다는 신호다. MLX 포트가 PyTorch에 의존하지 않는다는 사실은 이 경로를 피할 수 있음을 뜻하지만, 포트 자체의 정확성과 유지보수 위험이 사라지는 것은 아니다.

## 8bit은 용량만 줄인 절충안이 아니라 기본 선택에 가깝다

MLX 포트 모델 카드는 세 가지 변형을 제공한다. 아래의 오류율과 속도 설명은 모두 포트 유지보수자가 원본 torch BF16과 비교해 제시한 값이다.

| 변형 | 내려받을 가중치 | 유지보수자 비교값 | 선택 |
| --- | ---: | --- | --- |
| BF16 | 7.0GB | AR 1.4% / NAR 1.6% 오차 | 가장 보수적인 비교용 |
| **8bit** | **4.2GB** | AR 1.0% / NAR 1.9% 오차, 약 2배 decode 속도 주장 | **첫 설치·실사용 기본값** |
| 4bit | 3.4GB | AR 8.1% / NAR 4.4% 오차 | 저장공간이 절대적일 때만 |

8bit이 이 글의 대상인 이유는 단순하다. 4bit은 800MB 정도를 더 아끼지만, 카드가 제시한 수치에서 특히 AR 단계의 차이가 커진다. 반대로 8bit은 BF16보다 약 2.8GB 작으면서 포트가 권장하는 기본값이다. 다만 Python 환경·생성 산출물·Hugging Face 캐시가 추가되므로, 실제 디스크 점유를 가중치 4.2GB로 단정하면 안 된다.

## 커뮤니티 반응은 기대와 불만이 선명하게 갈린다

출시 직후의 반응은 충분히 많지만, 아직 독립적인 대규모 청취 연구로 볼 수는 없다. 아래는 Reddit과 오픈소스 사용자 커뮤니티에서 반복해서 나오는 **경험담의 경향**이다. 표의 평가는 벤치마크 결과가 아니라 개인의 생성 설정·장르·취향에 따라 달라지는 반응이다.

| 반복해서 나온 반응 | 구체적으로 언급된 장점·문제 | 읽는 방법 |
| --- | --- | --- |
| 로컬 모델 중 가장 강력한 후보라는 기대 | [ComfyUI 사용자의 초기 비교](https://www.reddit.com/r/StableDiffusion/comments/1wgorug/yue2_is_the_first_real_suno_local_model/)에서는 기존 로컬 모델보다 낫고 cover가 특히 인상적이라는 반응이 나왔다. | 첫 인상·개별 워크플로의 평가다. 공식 벤치마크의 대체가 아니다. |
| Suno와의 격차는 의견이 갈림 | [사용자 토론](https://www.reddit.com/r/StableDiffusion/comments/1wl3klw/seriously_yue2_is_something_else/)에는 구형 Suno 수준에 가까웠다는 의견과, Suno 5·5.5의 보컬·장르 지식에는 못 미친다는 의견이 공존한다. | Suno v6에 대한 호불호까지 섞여 있어, “Suno보다 낫다”는 단정은 특히 위험하다. |
| ACE-Step보다 깨끗하다는 반응과 ACE-Step의 편집성을 선호하는 반응 | [비교 스레드](https://www.reddit.com/r/StableDiffusion/comments/1wdb7is/native_yue2_support_coming_to_comfyui/)에서는 YuE2가 더 완성된 음원처럼 들린다는 반응이 있는 반면, ACE-Step의 구조·부분 편집을 더 유용하게 보는 의견도 있다. | 어느 모델이 우세한지는 장르와 필요한 편집 단위에 따라 바뀐다. |
| 보컬·장르 제어는 아직 약점으로 지적됨 | 여러 사용자가 보컬의 기계적인 발음, 비슷한 톤, 낯선 장르 지식 부족을 언급했다. 긴 곡에서 왜곡·가사 누락을 겪었다는 [사례](https://www.reddit.com/r/StableDiffusion/comments/1whx7kp/ive_been_playing_around_with_yue2_and_i_must_say/)도 있다. | “좋은 한 곡”과 재현 가능한 품질은 다른 문제다. |
| Mac에서는 실행 가능성이 품질만큼 중요 | [YuE Studio 공개 대화](https://www.reddit.com/r/LocalLLM/comments/1wfk03n/introducing_yuestudio_local_music_inference_for/)에는 Apple Silicon에서 로컬 음악 생성이 실용적이라는 반응과, 한 곡 생성 시간이 여전히 길다는 경험이 함께 있다. | MLX 8bit은 이 진입장벽을 낮추지만, 즉시 생성형 제품 수준의 반응성을 보장하지 않는다. |

이 반응들을 종합하면 YuE2의 강점은 **가사·구조·cover 작업을 로컬에서 통제할 수 있다는 가능성**이고, 남은 과제는 **일관된 보컬 개성, 장르 폭, 긴 곡의 안정성**이다. 특히 “ACE-Step보다 좋다”는 평은 음질에 대한 이야기인 경우가 많고, “ACE-Step의 부분 편집이 더 낫다”는 평은 작업 흐름에 대한 이야기인 경우가 많다. 둘을 같은 주장으로 취급하면 비교가 흐려진다.

[YuE Studio의 문서](https://github.com/tonywestonuk/YuE-Studio)는 Apple Silicon·macOS 14 이상을 요구하고 32GB 메모리를 편안한 기준으로, 16GB를 동작 가능한 하한으로 적는다. 모델과 앱을 합쳐 약 10GB의 디스크가 필요하다고도 안내한다. 이 수치는 8bit MLX 포트의 선택적 다운로드 크기와 직접 비교할 수 없지만, 편한 앱 경험에는 런타임과 보조 파일이 붙는다는 현실적인 기준이 된다.

속도 정보도 과장하지 않는 편이 좋다. ahmadw 포트는 M 시리즈에서 CFG를 사용해 약 80 tokens/s와 수 분 단위의 3분 곡 생성을 안내한다. 다른 [MLX 포트](https://huggingface.co/vanch007/mlx-Yue2-3B)는 M3 Max에서 AR 약 83 tokens/s를 기록했다고 적는다. 둘 다 M1 Max 실측은 아니며, 길이·CFG·NAR 단계·출력 품질 설정이 달라 단일 숫자로 승부를 가를 수 없다. M1 Max에서는 같은 가사·스타일·시드로 짧은 곡과 긴 곡을 각각 한 번씩 생성해, 총 시간과 실패 여부를 먼저 기록하는 것이 낫다.

## 선택 기준은 품질 순위보다 사용 목적과 라이선스다

어느 하나를 “더 좋은 모델”로 정하기보다, 아래처럼 목적을 나누면 판단이 단순해진다.

| 상황 | 더 맞는 선택 |
| --- | --- |
| Apple Silicon에서 가사·스타일·악보 계획을 직접 시험하고 싶다 | YuE2 MLX 8bit을 선택적으로 내려받아 ABC 계획과 재렌더링을 확인한다. |
| cover·remix·repaint처럼 결과 음원을 직접 바꾸는 작업이 중요하다 | ACE-Step 1.5의 음원 중심 워크플로를 우선 검토한다. |
| 즉시 생성, 서비스 통합, 웹 기반 편집이 더 중요하다 | Suno 같은 클라우드 제품의 편의성이 더 맞을 수 있다. |
| 상업 프로젝트에 바로 쓸 모델이 필요하다 | YuE2의 모델 가중치 조건을 별도로 확인한다. [YuE2 공식 라이선스 안내](https://github.com/multimodal-art-projection/YuE#license)는 기업 상업 이용에 별도 라이선스 논의를 요구하며, MLX 포트 카드도 CC BY-NC 4.0을 표시한다. |

## 다음 테스트는 한 번의 청취가 아니라 비교 가능한 기록으로 남긴다

새 모델을 받은 직후 가장 쉽게 빠지는 함정은 첫 결과물 하나만 듣고 판단하는 것이다. YuE2는 후보 생성과 계획 편집이 가능한 모델이므로, 다음 네 가지를 한 세트로 저장하는 편이 낫다.

1. 같은 가사·스타일·시드로 만든 원본 음원과 생성 시간
2. 생성된 ABC 계획과 한 부분을 수정한 뒤의 재렌더링 결과
3. 총 디스크 점유량: 가중치, 환경, 캐시, 출력물을 분리한 값
4. 재실행 성공 여부와 오류 로그

이 기록이 쌓이면 커뮤니티의 “좋다”는 평을 자신의 Mac과 작업 목적에 맞는 판단으로 바꿀 수 있다. YuE2 MLX 8bit은 그 실험을 시작하기에 충분히 작고, 아직은 대체품으로 단정하기보다 검증할 가치가 있는 후보에 가깝다.

## 참고한 자료

- [YuE2 공식 저장소와 평가·라이선스 안내](https://github.com/multimodal-art-projection/YuE)
- [YuE2 팀의 WildSongBench 결과와 비교 조건](https://github.com/multimodal-art-projection/YuE/blob/main/docs/benchmarks.md)
- [ahmadw / YuE2-3B-MLX 모델 카드](https://huggingface.co/ahmadw/YuE2-3B-MLX)
- [vanch007 / mlx-Yue2-3B 모델 카드와 M3 Max 측정값](https://huggingface.co/vanch007/mlx-Yue2-3B)
- [Suno v6 공개 노트](https://suno.com/release-notes/introducing-v6)
- [ACE-Step v1.5 공개 안내](https://github.com/ace-step/ACE-Step) 및 [ACE-Step 1.5 XL 릴리스](https://github.com/ace-step/ACE-Step-1.5/releases)
- [YuE Studio의 Apple Silicon 요구사항과 구현 설명](https://github.com/tonywestonuk/YuE-Studio)
- [YuE2 원본의 Apple Silicon MPS 재현 이슈](https://github.com/multimodal-art-projection/YuE/issues/176)
- [YuE2·Suno·ACE-Step을 비교한 Stable Diffusion 커뮤니티 대화](https://www.reddit.com/r/StableDiffusion/comments/1wgorug/yue2_is_the_first_real_suno_local_model/)
- [보컬·장르·품질에 대한 엇갈린 초기 반응](https://www.reddit.com/r/StableDiffusion/comments/1wl3klw/seriously_yue2_is_something_else/)
- [긴 곡의 왜곡·가사 누락을 언급한 사용 사례](https://www.reddit.com/r/StableDiffusion/comments/1whx7kp/ive_been_playing_around_with_yue2_and_i_must_say/)
- [Mac 로컬 실행에 관한 LocalLLM 커뮤니티 대화](https://www.reddit.com/r/LocalLLM/comments/1wfk03n/introducing_yuestudio_local_music_inference_for/)
