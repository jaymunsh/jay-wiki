title: "FORCE ONLINE: 브라우저 FPS를 만들고 끊기는 자리를 하나씩 판 기록"
slug: force-online-fps-optimization
category: 개인 프로젝트
tags: three.js,typescript,webgl,게임개발,최적화,fps
summary: Three.js로 만든 봇 대전 FPS를 저사양 PC에서도 돌아가게 다듬은 기록. 고정 틱 시뮬레이션 구조, 드로콜 병합과 그림자 다이어트, GC 할당 제거, 그리고 "프레임드랍처럼 보였지만 사실은 AI 버그였던" 사례까지.
toc: true
syncHash: fbe48476baf44d195403b9eac6729aac0bad6466a0013f06b7d1754f374da9f2
publishedAt: 2026-09-17T06:53:58.979Z

---

브라우저에서 바로 도는 FPS를 하나 만들고 싶었다. 조건은 단순했다. AK-47이 주어지고
사격·정조준·장전이 되고, 엄폐물이 있는 맵 하나에서 봇들과 팀 데스매치를 하는 것.
멀티플레이어는 나중이고 봇이 먼저였다.

기술 스택은 Vite + TypeScript + Three.js다. 물리는 박스 충돌(AABB)을 직접 구현했고,
사격은 레이캐스트 히트스캔, 봇 길찾기는 격자 A*다. 캐릭터·총기·맵·사운드까지 전부
절차적으로 만들었다. 중간에 외부 GLB 에셋(Kenney 맵 키트, Quaternius SWAT 모델)을
붙여 봤는데 총이 손에서 떠다니고 색이 파스텔 마네킹처럼 나와서 통째로 롤백했다.
되돌아보니 이 결정이 성능에도 이득이었다 — 런타임에 받을 외부 자산이 하나도 없으니
느린 네트워크가 영향을 주는 구간이 초기 로딩뿐이 된다.

게임은 금방 됐는데, 저사양 환경을 생각하니 이야기가 달라졌다. 프레임이 종종 끊겼고,
봇들이 스폰 근처에 뭉쳐 있었고, "작은 게임인데 왜 버벅이지"가 숙제가 됐다.
이 글은 그 숙제를 푼 순서다.

![게임 플레이 화면. 좌측 상단에 FPS와 핑, 미니맵이 보인다](/api/wiki-assets/851d3c15-ef83-4c9c-a724-e3d37803c0b7)

## 구조부터 — 시뮬레이션과 렌더를 갈라 놨다

최적화 이야기 전에 뼈대를 먼저 적어 둬야 각 최적화가 어느 층의 비용인지 보인다.
이 게임은 서버가 없다. 시뮬레이션·AI·물리·렌더 전부가 각 클라이언트의 브라우저
한 곳에서 돈다.

~~~mermaid
flowchart TB
    subgraph BR["브라우저 (클라이언트 전용 실행)"]
        IN["Input<br/>Pointer Lock / 키보드<br/>→ InputCommand"]
        subgraph SIM["시뮬레이션 — 고정 60Hz"]
            PC["PlayerController"]
            BC["BotController × 7<br/>patrol / hunt / engage / cover"]
            WS["WeaponSystem<br/>스프레드·반동·리로드·히트스캔"]
            PH["Physics<br/>AABB 이동·segmentBlocked·레이캐스트"]
            NG["NavGrid<br/>walkability 격자 + A*"]
        end
        subgraph REN["렌더 — rAF 매 프레임"]
            SC["Scene<br/>WebGLRenderer + 그림자"]
            WV["WeaponView<br/>1인칭 AK/AWP"]
            SV["SoldierView × 8<br/>박스 조립 병사 + 팔 IK"]
            FX["Effects<br/>파티클·트레이서·데칼 풀"]
        end
        HUD["HUD<br/>FPS·핑·미니맵·킬피드"]
    end
    HOST["정적 호스팅<br/>(dist/ 서빙 + 핑 프로브 대상)"]
    IN --> SIM
    SIM --> REN
    REN --> HUD
    HOST -. "초기 로딩: dist/ 다운로드" .-> BR
    BR -. "플레이 중: HEAD 핑 프로브 3초마다" .-> HOST
~~~

프레임 루프는 고전적인 고정 스텝 + 가변 렌더 패턴이다.

~~~ts
// Game.ts
const STEP = 1 / 60;

const loop = (t: number) => {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (t - this.lastT) / 1000);
  this.lastT = t;
  if (this.state === 'playing') {
    this.acc += dt;
    while (this.acc >= STEP) {   // 쌓인 시간만큼 틱을 몰아 돌린다
      this.acc -= STEP;
      this.tick();
    }
  }
  this.render(dt);             // 렌더는 매 rAF 한 번
  this.adaptQuality(dt);
};
~~~

시뮬레이션은 항상 60Hz로 굴러 렌더가 느려져도 게임 규칙의 시간은 보존되고, 렌더는
그리는 속도로만 간다. 이 분리가 밑의 최적화들을 가능하게 했다 — 렌더 쪽을 아무리
깎아도 판정·AI가 흔들리지 않으니 "그리는 비용"과 "생각하는 비용"을 따로 잴 수 있다.

모듈 지도는 이렇다.

| 파일 | 역할 |
|---|---|
| `core/Game.ts` | 루프, 틱 스케줄링, 적응형 해상도, 핑 프로브 |
| `core/Input.ts` | 포인터 락, 키·마우스 → `InputCommand` |
| `entities/Soldier.ts` | 플레이어·봇 공용 전투 상태(위치·탄약·반동·피격) |
| `entities/BotController.ts` | 봇 상태기계, 경로 추종, 스턱 복구 |
| `systems/WeaponSystem.ts` | 발사·탄퍼짐·히트스캔 데미지·리로드 |
| `systems/NavGrid.ts` | 격자 A*, 경로 평활, 엄폐 탐색 |
| `world/Map.ts` | 절차적 맵, 콜라이더·머티리얼별 메시 병합 |
| `world/Physics.ts` | AABB 이동, 선분 차폐·총알 레이캐스트 |
| `render/Scene.ts` | 렌더러·조명·그림자 설정 |
| `render/SoldierView.ts` | 3인칭 병사, 2본 팔 IK, 캐시된 파츠 |
| `render/Effects.ts` | 상한 풀 이펙트(파티클/트레이서/데칼) |
| `ui/HUD.ts` | FPS·핑·미니맵·스코프·킬피드 |

입력이 `InputCommand` 하나로 추상화돼 있다는 점도 적어 둔다. 플레이어든 봇이든
같은 명령 객체를 내므로, 나중에 네트워크를 붙이면 서버가 같은 명령을 받아 돌리는
권위 모델로 옮기기 쉽다 — 지금은 쓸모가 없지만 구조의 빚을 안 진 부분이다.

## 박스 백 서른 개가 각각 한 번씩 그려지고 있었다

맵은 전부 박스다. 바닥, 벽, 컨테이너, 샌드백, 크레이트까지 대략 130개. 처음엔 각 박스가
자기 `Mesh`를 하나씩 들고 있었다. Three.js에서 메시 하나는 드로콜 하나다. CPU가 GPU에
"이거 그려라"를 130번 외치는 셈이고, 박스 한 개 그리는 일보다 그 호출 자체가 비싸다.

재는 법은 간단하다. `renderer.info.render.calls`를 찍으면 된다. 찍어 보니 프레임당
508콜이었다.

수정은 재질별 병합이다. 같은 재질을 쓰는 박스들의 지오메트리를 `mergeGeometries`로
한 덩어리로 만들어 메시 하나로 붙였다.

~~~ts
// Map.ts — defs는 그대로 두고, 그리는 것만 재질별로 합친다
const byMat = new Map<MatKey, THREE.BufferGeometry[]>();
for (const b of this.defs) {
  const geo = scaledBoxGeo(b.w, b.h, b.d, TEX_SCALE);
  geo.translate(b.x, b.y, b.z);           // 월드 위치를 지오메트리에 구워 넣는다
  let arr = byMat.get(b.mat);
  if (!arr) byMat.set(b.mat, arr = []);
  arr.push(geo);
}
for (const [mat, geos] of byMat) {
  const merged = mergeGeometries(geos, false);
  const mesh = new THREE.Mesh(merged, materials[mat]);
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
}
~~~

포인트는 **병합 대상과 판정 대상을 갈라 놓은 것**이다. 물리용 `Box3` 콜라이더와
미니맵용 정의(`defs`)는 낱개로 남아 있어서, 화면은 합쳐도 충돌·길찾기·미니맵 코드는
손대지 않았다.

맵이 담당하던 콜은 8개(재질 그룹 수)로 줄었다. 이 라운드의 렌더링 변경을 전부
반영하고 다시 찍은 `renderer.info`는 508 → 433콜, 삼각형 9,538 → 8,366이었다.
남은 433개는 대부분 봇의 신체 파츠와 총, 이펙트다 — 움직이는 것들은 합칠 수 없으니
이 선에서 멈췄다. 이 수치는 이 프로젝트의 로컬 측정값이지 보편 벤치마크는 아니다.

## 병사 한 명에 지오메트리 마흔 개가 새로 생기고 있었다

봇은 박스 조립 인형이다. 골반·조끼·헬멧·상완·전완·대퇴·하퇴·부츠·백팩까지 파츠가
마흔 개쯤 된다. 문제는 만들 때였다. 파츠 하나를 만드는 헬퍼가 호출될 때마다
`new BoxGeometry`와 `new MeshStandardMaterial`을 만들었다. 봇 일곱이면 같은 크기의
지오메트리가 수백 번 중복 생성된다.

크기·색상 문자열을 키로 하는 공유 캐시로 바꿨다.

~~~ts
// SoldierView.ts
const geoCache = new Map<string, THREE.BoxGeometry>();
const matCache = new Map<string, THREE.MeshStandardMaterial>();

function box(w: number, h: number, d: number, color: number, rough = 0.85) {
  const gk = `${w}|${h}|${d}`;
  let geo = geoCache.get(gk);
  if (!geo) geoCache.set(gk, geo = new THREE.BoxGeometry(w, h, d));
  const mk = `${color}|${rough}`;
  let mat = matCache.get(mk);
  if (!mat) matCache.set(mk, mat = new THREE.MeshStandardMaterial({ color, roughness: rough }));
  // tiny parts (visor, band, bolt...) aren't worth a shadow draw call
  ...
}
~~~

같은 크기·색상의 파츠는 이제 같은 GPU 버퍼와 같은 재질을 가리킨다. 메모리가 줄고
머티리얼 전환 비용도 같이 준다.

그리고 작은 파츠의 그림자를 껐다. 바이저, 헬멧 밴드, 총의 볼트 손잡이 같은 5cm 안쪽
파츠는 그림자를 드리워도 눈에 안 띄는데, 셰도우 패스에서는 콜 하나를 똑같이 쓴다.
"이 파츠가 그림자를 만들 값어치가 있나"를 하나씩 봐서 없는 것만 `castShadow = false`로
내렸다.

팔 IK 쪽도 할당을 걷었다. 손목이 총의 그립·핸드가드 위치에 매 프레임 정확히 닿게
하는 2본 IK인데, 매 프레임 `new Vector3`를 만들던 걸 모듈 스코프 스크래치 버퍼로
옮겼다. 봇 8마리 × 초당 수천 번의 벡터 할당이 사라졌다.

## 픽셀 수를 줄이는 게 제일 쌌다

드로콜 다음으로 큰 항목은 픽셀이다. 레티나 디스플레이에서 `devicePixelRatio`가 2면
CSS 픽셀 하나당 실제 픽셀이 네 개다. GPU가 채워야 할 면적이 네 배라는 뜻이고,
내장 그래픽에서는 이게 프레임을 갉아먹는 주범이다.

~~~ts
// Scene.ts
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// 태양광 셰도우맵
sun.shadow.mapSize.set(1024, 1024);      // 2048 → 1024
const sc = sun.shadow.camera;            // 카메라 범위는 플레이 영역(±34m)에 맞춤
~~~

상한을 1.5로 두면 레티나에서 픽셀 수가 44% 가까이 준다. 화면이 살짝 부드러워지는
대가를 치르는데, 이 게임의 플랫한 박스 스타일에서는 거의 티가 안 난다. 셰도우맵도
같은 논리다 — 해상도를 깎되, 카메라 범위를 실제 맵 크기로 조여 필요한 곳의 밀도는
유지했다.

## 프레임이 낮으면 해상도를 스스로 낮추게 했다

정적 최적화만으로는 커버가 안 되는 경우가 있다. GPU가 정말 약한 기계다. 그래서
적응형 해상도를 넣었다. 프레임마다 FPS의 지수이동평균을 굴리고, 2초마다 판단한다.

~~~ts
// Game.ts
const pr0 = Math.min(window.devicePixelRatio, 1.5);
this.prLevels = [pr0, pr0 * 0.85, pr0 * 0.7, pr0 * 0.55];  // 100/85/70/55%

private adaptQuality(dt: number) {
  this.fpsEma += (1 / dt - this.fpsEma) * Math.min(1, dt * 0.5);
  this.adaptT += dt;
  if (this.adaptT < 2) return;             // 2초에 한 번만 판단 — 진동 방지
  this.adaptT = 0;
  if (this.fpsEma < 47 && this.prIdx < this.prLevels.length - 1) {
    this.prIdx++;
    this.renderer.setPixelRatio(this.prLevels[this.prIdx]);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  } else if (this.fpsEma > 58 && this.prIdx > 0) {
    this.prIdx--;                          // 여유가 생기면 복원
    this.renderer.setPixelRatio(this.prLevels[this.prIdx]);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
~~~

핵심은 "끊기는 것"을 "살짝 흐려지는 것"으로 바꾼다는 발상이다. 임계값에 히스테리시스를
뒀다(내리는 선 47, 올리는 선 58) — 경계 하나만 두면 해상도가 위아래로 진동해서
오히려 더 보기 나쁘다. 다만 이건 GPU 픽셀 부하만 다루는 수단이다. CPU가 병목이면
해상도를 낮춰도 안 나아지니, 만능으로 쓸 건 아니다.

## 간헐적 드랍의 진짜 범인은 GC였다

평균 FPS는 괜찮은데 가끔 툭 끊기는 패턴이 남았다. 이런 건 보통 렌더링이 아니라
가비지 컬렉션이다. 뭔가가 주기적으로 큰 객체를 만들어 버리고 있으면 GC가
주기적으로 멈춘다.

찾아보니 용의자가 여럿 있었다.

| 곳 | 매번 새로 만들던 것 | 빈도 |
|---|---|---|
| `NavGrid.findPath` | `Float32Array`/`Int32Array`/`Uint8Array` 3개(각 ~3,364칸) | 봇 리패스마다 |
| `Physics.segmentBlocked` | `Vector3` 여러 개 | 엄폐 탐색 시 최대 수백 회 |
| `raycastShot` | 병사마다 머리 중심 `Vector3` | 총알 한 발마다 |
| `randomPointNear` | 시도마다 `Vector3` | 최대 24개/호출 |

봇 일곱이 재탐색할 때마다 80KB 안팎의 배열이 만들어졌다 버려졌다. 이게 제일 컸다.
A* 스크래치는 이제 클래스 필드로 올라가 한 번만 할당된다.

~~~ts
// NavGrid.ts — pooled A* scratch. 리패스 때마다 new 하지 않는다
private g!: Float32Array;      // g-score
private from_!: Int32Array;    // 경로 역추적용 부모 인덱스
private closed!: Uint8Array;   // 닫힌 집합
private open!: number[];       // 열린 우선 큐(배열)

constructor(...) {
  this.g = new Float32Array(this.size * this.size);
  this.from_ = new Int32Array(this.size * this.size);
  this.closed = new Uint8Array(this.size * this.size);
}
~~~

`segmentBlocked`는 용도가 "엄폐 후보마다 적이 보이나" 검사라 호출 수가 많다 —
`findCover` 한 번에 최대 수백 번. 벡터를 만들지 않는 슬랩 검사로 다시 썼다.

~~~ts
// Physics.ts — allocation-free slab test
export function segmentBlocked(a, b, colliders): boolean {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
  const ix = dx / len, iy = dy / len, iz = dz / len;
  for (const bx of colliders) {
    let tmin = 0, tmax = len - 0.05;
    // x/y/z 축 슬랩마다 t 구간을 좁혀, 겹침이 남으면 차단
    ...
    if (tmin > 0) return true;
  }
}
~~~

총알 판정의 `headCenter()`도 발당 병사 수만큼 새 벡터를 만들던 걸 임시 버퍼로 돌렸다.
`randomPointNear`는 시도 최대 24번마다 `new Vector3`하던 걸 1개로.

배운 건 이거다. 평균 프레임레이트가 괜찮아 보이는 게임도 프레임 타임 스파이크는
숨어 있을 수 있다. FPS 숫자가 아니라 프레임 타임 분포를 봐야 잡히는 부류다.

## 이펙트는 처음부터 상한 풀로 뒀다

할당 제거가 "사후 시술"이었다면 이펙트는 설계 시점의 예방이었다. 총격전이 몰릴 때
파티클·트레이서·탄흔이 폭증하는 게 가장 전형적인 프레임드랍 유발 지점이라, 처음부터
고정 크기 풀 + 순환 인덱스로 뒀다.

~~~ts
// Effects.ts
const MAX_PARTICLES = 320;
const MAX_TRACERS = 32;
const MAX_DECALS = 48;

// 파티클은 Points 한 개 — 위치·속도·수명·색을 통째 Float32Array로
this.pPos = new Float32Array(MAX_PARTICLES * 3);
this.pVel = new Float32Array(MAX_PARTICLES * 3);
this.pLife = new Float32Array(MAX_PARTICLES);
this.pCol = new Float32Array(MAX_PARTICLES * 3);
~~~

새 파티클은 `pNext`를 한 칸 돌려 덮어쓰고, 죽은 파티클은 y를 -10으로 보내
"땅 밖으로 치워" 둔다. GPU 버퍼는 생성 때 한 번 만들고 이후엔 `needsUpdate`만
켠다. 이펙트가 아무리 몰려도 할당 폭증이 안 생기고, 상한을 넘으면 오래된 것부터
사라질 뿐이다.

## 미니맵은 매 프레임 맵 전체를 다시 그리고 있었다

미니맵도 비슷한 구조적 낭비가 있었다. 매 프레임 캔버스에 맵의 모든 엄폐물을
`fillRect`로 다시 그렸다 — 프레임당 130번. 정적인 것을 60번/초 다시 그릴 이유가
없으니, 오프스크린 캔버스에 맵을 한 번만 그려 두고 매 프레임 `drawImage`로 복사한 뒤
움직이는 점(봇·플레이어 방향 쐐기)만 위에 얹는다. CPU 쪽에서 꽤 큰 고정비용이
사라졌다.

## 봇이 스폰에 뭉친 건 렌더링 문제가 아니었다

최적화 작업 중간에 따로 잡은 버그인데, "느려 보이는 현상"이 성능 문제인 줄 알고
봤다가 원인이 전혀 다른 데 있던 사례라 같이 적는다.

증상은 봇들이 리스폰 직후 스폰 근처에 몇 초씩 멈춰 서는 것이었다. 헤드리스로
봇 좌표를 샘플링해 보니 네 마리가 정확히 `(±7.2, ±24.1)`에 6초 넘게 박혀 있었다.

원인이 둘 겹쳐 있었다.

첫째, 맵. 얼마 전에 추가한 스폰 접근 샌드백(`x=±9`)이 스폰 지점(`x=±8.1`) 정면을
가로막고 있었다. 봇은 태어나자마자 벽에 얼굴을 대고 있던 것이다. 샌드백을 레인 밖으로
옮겨 해결.

둘째, 스턱 감지 로직 자체가 죽어 있었다. 벽에 밀릴 때 물리가 속도를 깎는 게 아니라
위치 이동만 막는데, 감지 코드는 `horizSpeed() < 0.4`를 보고 있었다. 속도 벡터는
계속 최대로 유지되니 감지가 영원히 발동하지 않았다.

~~~ts
// BotController.ts — 속도가 아니라 실제 변위로 본다
const moved = this.s.pos.distanceTo(this.lastPos);
if ((c.moveX !== 0 || c.moveZ !== 0) && moved < 0.02) {
  this.stuckT += dt;
  if (this.stuckT > 0.8) {
    this.stuckCount++;
    this.path = [];                 // 강제 리패스
    this.evadeT = 0.6;              // 옆걸음 회피
    this.evadeDir = -this.evadeDir; // 매번 반대쪽으로
  }
}
~~~

탈출 수단이던 점프도 `applyMovement` 이후에 플래그를 세워서 다음 틱에 리셋되는
데드코드였고, 고쳐 봤더니 봇이 낮은 엄폐물 위로 올라가 공중에 서 있는 것처럼
보여서 점프는 아예 빼고 옆걸음 회피 + 목표 포기로 갈음했다. `findCover`에도
팀원 점유 회피를 넣어 여러 봇이 같은 엄폐 칸을 두고 서로 밀지 않게 했다.

수치로 증상을 잡고 나서야 원인이 보인 전형적인 사례다. "느리다"와 "멈춰 있다"는
다른 병이고, 이건 후자였다.

## 화면 왼쪽의 핑은 게임 서버까지의 거리가 아니다

FPS 옆에 핑을 달았다. 다만 정확히 무엇을 재는지는 적어 둘 필요가 있다.

~~~ts
// Game.ts — 3초마다 호스팅 origin에 HEAD 요청
private samplePing() {
  this.pingInFlight = true;
  const t0 = performance.now();
  fetch(`${location.origin}/`, { method: 'HEAD', cache: 'no-store' })
    .then(() => { this.pingMs = Math.round(performance.now() - t0); })
    .catch(() => { this.pingMs = null; })
    .finally(() => { this.pingInFlight = false; });
}
~~~

이건 **정적 호스트까지의 HTTP 왕복 시간**이다. 지금 이 게임에는 게임 서버가 없다.
시뮬레이션은 전부 각 클라이언트 브라우저에서 돌고, 플레이 중 네트워크 트래픽은
이 핑 프로브뿐이다. 그래서 로컬에서는 0~2ms가 나오고, 배포하면 "그 호스팅
서버까지의 RTT"가 나온다. 멀티플레이어를 붙이면 그때 실제 게임 서버 RTT 측정으로
갈아끼울 자리를 미리 마련한 셈이다.

## 저사양 PC에 올려도 되는 이유

이 구조에서는 "호스팅 서버가 약하다"와 "게임이 버벅인다"가 거의 무관하다. 서버가
하는 일이 `dist/` 정적 파일을 내려주는 것뿐이라서다. 실제로 필요한 조치는 서버
사양이 아니라 파일 배달 쪽에 있다.

- `npm run build`로 `dist/`를 만들고 Caddy·nginx·`npx serve` 같은 정적 서버로 서빙
- Brotli/gzip 압축 — 번들이 수백 KB에서 백 KB 초반으로 준다
- Vite가 해시 파일명을 쓰니 `assets/`에는 immutable 장기 캐시 헤더

호스팅 머신의 CPU는 파일 서빙에만 쓰인다. 진짜로 네트워크 지연이 문제가 되는 건
멀티플레이어를 붙일 때다. 그때는 서버 위치, WebSocket 대신 WebTransport 검토,
틱레이트와 스냅샷 보간, 클라이언트 예측·리컨실리에이션, 바이너리 직렬화 같은
얘기가 필요해진다. 다행히 입력을 `InputCommand`로 추상화하고 상태와 렌더를
분리해 둬서, 서버 권위 모델로 옮길 발판은 있다.

## 남은 한계

솔직히 남은 것들이 있다.

**측정값의 해석.** 위의 508→433 같은 수치는 헤드리스(소프트웨어 렌더러) 환경에서
잰 것이다. 방향은 맞아도 절대값은 실제 GPU와 다르다. 진짜 판단은 목표 기기에서
Chrome Performance 탭으로 프레임 타임을 봐야 한다.

**여전히 남은 할당.** 오디오는 발사마다 WebAudio 노드를 여덟 개쯤 만든다. 지금
규모에서는 감당 가능해서 뒀지만, 동시 사격이 몰리면 후보가 된다. 이벤트 객체나
남은 임시 벡터도 조금씩 있다.

**코드 밖의 끊김.** 다른 탭, 백그라운드 프로세스, 브라우저의 탭 스로틀링은
게임 코드가 제어할 수 없다. 첫 진입 시 몇 프레임의 끊김은 WebGL 셰이더 컴파일이라
정상 범주다.

**적응형 해상도의 한계.** 화면이 흐려지는 대가를 치른다. GPU 픽셀 부하가 아닌
병목에는 무력하다.

다음에 할 일로는 저사양 프리셋(그림자 끄기, 파티클·트레이서 수 축소)을 설정으로
빼는 것, FPS 숫자 대신 프레임 타임 그래프를 붙이는 것, 그리고 실제 기기에서
프로파일링하는 것을 잡아 두었다. 멀티플레이어는 그 뒤의 이야기다.
