---
title: "Open Camera: 유료 필터 앱에 지쳐서 직접 만든 iOS 카메라 PWA"
slug: open-camera-iphone-filter-pwa
category: 개인 프로젝트
summary: 구독형 필터 앱에 지쳐 WebGL2 싱글 패스 셰이더로 만든 설치형 카메라 PWA 개발기. 3D LUT 텍스처 파이프라인, MediaPipe 지연 로딩, 그리고 후지·LUMIX 룩을 번들하지 못하는 저작권 문제를 사용자 import로 푼 과정까지.
tags: pwa,ios,webgl2,camera,lut,mediapipe,react,typescript,personal-project
toc: true
---

![Open Camera 앱 아이콘](/assets/projects/open-camera-iphone-filter-pwa/app-icon.png "width=180 align=center")

iPhone용 필터 앱을 찾아보면 하나같이 같은 패턴이다 — 무료라고 받았더니 필터 몇 개만 열어주고 나머지는 주간 구독. 그런데 필터 앱이 하는 일의 본질은 "센서 프레임에 색 변환 함수를 적용하는 것"이다. 그건 브라우저의 WebGL로도 충분히 할 수 있다. 그래서 직접 만들었다 — 설치형 PWA 카메라 필터 앱 **Open Camera**다. [open-camera-leneu.vercel.app](https://open-camera-leneu.vercel.app)에서 바로 쓸 수 있고("홈 화면에 추가"로 설치), 코드는 [GitHub에 공개](https://github.com/jaymunsh/open-camera)했다.

## 무엇을 만들었나

- **실시간 카메라 프리뷰** — 전/후면 전환, 핀치 줌 + 프리셋 줌 버튼, 토치
- **필터** — 수식으로 직접 생성한 프로시저럴 LUT + RawTherapee 계열 HaldCLUT 필름 시뮬레이션(CC BY-SA), 강도 조절
- **디지캠 이펙트** — JPEG 아티팩트, 저가 렌즈 왜곡, CCD 블루밍/핫픽셀, 플래시, 수직 스미어, 먼지, 라이트 리크, 할레이션, 그레인 — 요즘 유행하는 "디지캠 감성"을 한 프리셋으로
- **일본풍 프리셋** — UTSURUN / SHINSEN / TOUMEI / MORI / SHOWA / NEON / MIDORI
- **날짜 스탬프** — DSEG7 세그먼트 폰트로 찍히는 디지캠 날짜, 포맷·크기·방향 설정
- **뷰티 보정** — MediaPipe 얼굴 랜드마크 기반 스킨 스무딩·워프(최대 3인)
- **커스텀 LUT** — `.cube` / HaldCLUT PNG 가져오기, 그리고 "현재 설정을 LUT로 굽기"
- **PWA** — 홈 화면 설치, 서비스 워커 오프라인 동작, JPEG 저장/Web Share 공유

![앱의 카메라 화면 — 하단 필터 스트립에 프리셋 썸네일이 나란히 놓이고, 좌하단에 필터/보정/조절 탭이 있다. 1:1 비율로 레터박스된 상태](/assets/projects/open-camera-iphone-filter-pwa/app-screenshot.png "width=340 align=center")

필터 스트립의 각 썸네일은 현재 프레임에 그 프리셋을 실제로 적용한 미리보기다 — 재미있는 구현 디테일인데, 별도 오프스크린 `FilterPipeline`(128px) 하나를 공유해 순차로 생성한다. 처음엔 프리셋마다 소스 텍스처를 다시 업로드해서 시트가 느렸는데, `setSource`를 루프 밖으로 빼 한 번만 하도록 고치니 빨라졌다.

아래는 AI 생성 샘플 이미지에 필름 계열 프리셋을 적용한 결과다 — 앱의 LUT/조절/그레인 체인이 그대로 타는 출력물.

![필름 계열 프리셋을 적용한 출력 예시](/assets/projects/open-camera-iphone-filter-pwa/sample-look.png)

## 모든 처리는 셰이더 한 방에 — WebGL2 uber-shader

핵심은 `FilterPipeline`이라는 WebGL2 파이프라인이다. 프리셋마다 셰이더를 갈아끼우는 대신, **하나의 uber-shader**(약 525행 GLSL)에 모든 처리를 넣고 유니폼으로 켜고 끈다. 프래그먼트 셰이더 안에서 대략 이런 순서로 진행된다:

1. 소스 샘플 (mirror/줌/렌즈 왜곡/픽셀화까지 uv 변환으로)
2. 얼굴 마스크 영역 보정 (스무딩·톤·다크서클 — `u_beautyMask`가 실질 0이면 통째로 건너뜀)
3. 디지캠 플래시
4. **3D LUT 적용** (`texImage3D`로 올린 33³ 텍스처 × 강도)
5. 기본 조절 11종 (노출/대비/채도/색온도/틴트/하이라이트/쉐도우/화이트/블랙/비브란스/명료함)
6. 공간 이펙트 — soft/bloom/halation(`textureLod`로 낮은 밉 샘플) → 비네트 → 먼지 → 노이즈 → 밴딩 → JPEG 블록
7. 선명도, 그레인, 날짜 프레임

각 단계는 `u_x > 0.001` 같은 유니폼 가드로 생략 가능하다. 프리셋별 셰이더 분리는 복잡도 대비 이득이 없어 유니폼 분기를 택했다.

**프리뷰와 익스포트는 파이프라인이 두 개다.** 프리뷰는 `preserveDrawingBuffer: false` — 픽셀 리드백이 없어 프레임당 복사 비용을 아낀다. 저장할 때만 별도 지연 생성 파이프라인(`preserve: true`)을 띄워 원본 해상도로 렌더하고 `toBlob`으로 뽑는다. preserve를 켠 채 프리뷰를 돌리면 느려지고, 끈 채 `toBlob`을 부르면 빈 버퍼를 읽어 검은 이미지가 나온다 — 이 분리는 그 사고를 막기 위한 것이다.

얼굴 인식(MediaPipe Face Landmarker)은 **dynamic import**로 필요할 때만 로드한다 — 뷰티 기능을 안 쓰면 메인 번들에서 143KB + wasm/models 37MB가 아예 빠진다. 대신 첫 뷰티 진입 시 로딩이 살짝 있는데 이건 의도된 트레이드오프다.

## LUT를 번들할 수 없다는 것을 배웠다 — 저작권 문제

기능만큼이나 재미있는 문제가 있었다. 후지 필름 시뮬레이션이나 유명 LUT 팩의 룩을 앱에 넣고 싶었는데, 알아보니 **"룩"과 "LUT 파일"의 법적 지위가 다르다**:

- **필름 룩 자체는 보호되지 않는다.** 특정 색감을 직접 구현해 흉내 내는 건 합법 — 저작권이 지키는 건 표현(파일/코드)이지 스타일이라는 아이디어가 아니다.
- **남이 만든 LUT 파일(.cube, HaldCLUT PNG)은 저작물이다.** 시중 LUT 팩 대부분이 재배포를 명시 금지하고, 카메라 제조사 공식 LUT도 재배포 조건이 불명확하다. 실제로 FilmFrame이라는 오픈소스가 후지 공식 배포 LUT를 이 이유로 번들에서 제거한 선례가 있다.
- **Portra, Velvia, Classic Chrome 같은 이름은 상표다.** 룩 재현은 되지만 이름을 그대로 쓰는 건 별개 문제다.

그래서 방향을 바꿨다 — **번들하지 않고, 각자 가져오게 한다.** 앱에는 `.cube`/HaldCLUT import 기능이 있다(햄버거 메뉴 → LUT 가져오기, 다중 선택 지원). 파일 선택의 책임은 사용자에게 있으니 이 구조는 에뮬레이터와 ROM의 관계처럼 안전하다. 실제로 내 경우엔 LUMIX PhotoStyle을 변환한 `.cube` 파일들을 받아서 import해 쓰고 있다 — 처음엔 그걸 번들하려다가 재배포 라이선스가 불명확해서 과감하게 뺐다. 대신 번들되는 필터는 전부 `buildLut()`로 수식을 조합해 직접 만든 것이거나 라이선스가 확인된 것(크레딧 표기 포함)이다.

부가 기능으로 "현재 설정을 LUT로 굽기"도 있다 — identity 그리드를 현재 파이프라인에 통과시켜 `.cube`급 LUT 데이터로 저장하는 방식이라, 내가 만든 조절 조합을 다른 툴로 가져갈 수도 있다.

## iOS PWA에서 실제로 터진 함정들

웹뷰/브라우저 환경은 만만치 않았다. 겪은 것 중 기록할 만한 것들:

**`.cube` 파일을 선택할 수 없다.** `<input accept=".cube,.png">`를 넣으면 iOS가 `.cube`라는 UTI를 모른다며 파일 선택 자체를 막는다. `accept`를 빼고 JS에서 확장자를 검증하는 쪽으로 바꿨다.

**카메라 권한은 컨텍스트마다 따로 묻는다.** Safari와 홈 화면에 설치된 PWA는 별도 권한 컨텍스트다 — 각각 최초 1회씩 승인해야 한다. 임시 터널 도메인으로 테스트하면 매번 묻는 것처럼 보이는데, origin 단위 기억이라 당연한 동작이었다.

**백그라운드에서 돌아오면 카메라가 죽어 있다.** `visibilitychange`에서 트랙이 `ended`거나 비디오 `readyState < 2`면 `getUserMedia`를 재실행하게 했다.

**격자선이 사진 가장자리를 벗어났다.** 3:4 레터박스에서 GL 뷰포트는 중앙 정렬인데 오버레이 좌표만 하단 정렬로 바꿔 생긴 버그. `render()`에 `valign: 'bottom'`을 추가해 GL과 DOM이 같은 정렬을 쓰게 고쳤다 — "GL 렌더와 오버레이는 반드시 같은 정렬을 써야 한다"가 교훈.

## 배포도 순탄하지는 않았다

`open-camera.vercel.app`은 다른 사람이 이미 점유하고 있어서 — 그래서 도메인이 `open-camera-leneu.vercel.app`이다. 게다가 팀 기본값의 `ssoProtection` 때문에 새 도메인이 SSO 로그인으로 튕기는 사고도 있었다(API로 해제). GitHub 연동이 안 돼 있어 지금은 `npx vercel --prod` 수동 배포다.

PWA 캐시 전략은 이렇게 잡았다 — JS/CSS/아이콘/폰트(~473KB)는 precache, `wasm/`(34MB)과 모델은 precache에서 빼고 첫 사용 시 CacheFirst 런타임 캐시, `/luts/*`도 CacheFirst라 한 번 쓴 필터는 오프라인에서 돈다.

## 한계와 다음

- **iOS(Safari/WebKit) 위주로만 검증했다.** Android·데스크탑은 돌아가더라도 카메라/설치/공유가 다르게 동작할 수 있다.
- `generateMipmap`을 매 프레임 돌린다 — bloom/halation용 밉 체인 때문인데 발열이 문제 되면 저해상도 FBO 패스로 교체할 여지가 있다.
- 조절값(params)은 의도적으로 저장하지 않는다 — 세션마다 리셋되는 건 사양.
- 앱 스토어 배포는 없다 — PWA라서 애플 심사·수수료와 무관한 대신 "홈 화면에 추가" 흐름을 사용자가 알아야 한다.

링크: [앱 열기](https://open-camera-leneu.vercel.app) · [github.com/jaymunsh/open-camera](https://github.com/jaymunsh/open-camera)
