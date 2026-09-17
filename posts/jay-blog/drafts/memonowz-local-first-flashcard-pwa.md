title: "Memonowz: 내가 외울 것만 넣는 로컬 암기 PWA"
slug: memonowz-local-first-flashcard-pwa
category: 개인 프로젝트
summary: 단어장, 기출, 면접 질문을 한 앱에서 반복해서 풀고 카드와 학습 기록을 브라우저에만 저장하는 Memonowz를 만들었다. 카드 유형을 하나의 스키마로 묶고 틀린 카드를 먼저 다시 내는 학습 루프를 구현한 과정을 적었다.
tags: dexie,indexeddb,local-first,pwa,react,typescript,vite,zod
toc: true
publishedAt: 2026-08-29T11:32:51.721193Z
updatedAt: 2026-08-29T16:32:10.880596Z
syncHash: be8d3049e1a5fd22d163bcca2ff0e3896e5145269ad12fd9536894cd67e56ba1

---

단어를 외우려고 단어장 앱을 열었다가, 기출문제를 풀 때는 문제은행 앱으로 옮기고, 면접 질문을 정리할 때는 다시 메모 앱을 켰다. 각각의 앱이 부족해서라기보다 외우려는 대상의 모양이 서로 달랐기 때문이다.

듀오링고는 정해진 코스를 따라가기 좋지만 내가 가진 자료를 넣기 어렵다. Quizlet은 직접 카드를 만들 수 있지만 계정과 서비스에 자료를 올려야 하고, 카드도 대체로 앞면과 뒷면 두 칸이면 끝난다. 내가 원한 것은 그 중간이었다. 반복해서 풀고 틀린 카드를 다시 보여주는 방식은 가져오되, 무엇을 외울지는 내가 정하고 자료는 기기에만 남기는 앱이다.

그래서 Memonowz를 만들었다. 단어처럼 앞뒤를 맞히는 카드, 보기가 있는 기출문제, 긴 답을 읽고 스스로 채점하는 면접 질문을 한 앱에 넣었다. 서버와 계정은 없고 카드는 브라우저의 IndexedDB에 저장한다.

기능을 많이 넣기보다 카드가 들어오고, 풀리고, 다시 나오는 한 바퀴를 끊기지 않게 만드는 데 시간을 썼다. 도구는 Vite 6, React 19, TypeScript, react-router-dom 7, Dexie 4, zod, vite-plugin-pwa를 썼다.

![채점 직후 화면. 고른 오답 보기는 붉게, 정답 보기는 초록으로 표시되고 그 아래 개념 설명이 펼쳐져 있다](/assets/projects/memonowz/12-graded-with-explanation.png)

## 여러 앱을 오가는 대신 카드 세 종류만 먼저 받기로 했다

처음부터 자유로운 카드 에디터를 만들지는 않았다. 유형을 무한히 열어 두면 임포트 파일도, 출제 화면도, 검색도 금방 복잡해진다. 반대로 앞뒤 카드 하나만 받으면 기출문제와 긴 답변을 담을 수 없다. 지금 필요한 모양을 세 가지로 좁혔다.

| type | 담는 내용 | 실제 출제 |
|---|---|---|
| `term` | 앞면, 뒷면, 선택적 오답 보기 | 4지선다 또는 뒤집기 |
| `mcq` | 질문, 보기, 정답 인덱스 | 보기 순서를 섞은 객관식 |
| `qa` | 질문, 답변 | 답을 펼친 뒤 자가채점 |

세 유형은 `tags`와 `explanation`을 함께 갖는다. 저장할 때는 여기에 `id`, `deckId`, `stats`가 붙는다. 입력 단계의 모양과 저장된 카드의 모양을 분리하되, 입력 규칙은 하나의 zod 스키마를 계속 재사용했다.

그 과정에서 zod의 `discriminatedUnion`에 걸리는 부분이 하나 있었다. `mcq.answer`가 `choices`의 범위 안에 있는지는 두 필드를 함께 봐야 하는데, union 멤버 안에 `.refine`을 붙이면 `ZodObject`가 아니라 `ZodEffects`가 되어 union에 넣을 수 없었다. 교차 필드 검사는 union 바깥의 `superRefine`으로 옮겼다.

```ts
export const cardInputSchema = z
  .discriminatedUnion('type', [termInputSchema, mcqInputSchema, qaInputSchema])
  .superRefine((card, ctx) => {
    if (card.type === 'mcq' && card.answer >= card.choices.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['answer'],
        message: 'answer가 choices 범위를 벗어남',
      })
    }
  })
```

이 스키마는 카드 편집 폼, JSON 임포트, 백업 파일에서 모두 사용한다. 형식을 따로 세 벌 만들지 않으니 한 곳을 고쳤을 때 다른 곳이 조용히 어긋날 가능성이 줄었다.

## 학습을 중간에 닫아도 세션은 한 건만 이어가게 했다

학습 중에 브라우저를 닫았을 때 그동안 푼 기록까지 사라지는 것은 아까웠다. 그렇다고 여러 세션의 복원 화면까지 만들고 싶지는 않았다. 진행 중인 세션은 앱 전체에서 하나만 둔다.

```ts
this.version(1).stores({
  decks: 'id, createdAt',
  cards: 'id, deckId',
  sessions: 'key',
})
```

`sessions`에는 `'active'`라는 키로 한 레코드만 저장한다.

```ts
export type ActiveSession = {
  deckId: string
  cardIds: string[]   // 시작할 때 확정한 출제 순서
  cursor: number      // 다음 문제의 인덱스
  results: SessionResult[]
  startedAt: number
}
```

세션을 시작할 때 카드 순서를 확정하고, 채점할 때마다 레코드를 덮어쓴다. 학습을 끝내면 세션을 지운다. 다른 덱을 시작하려고 하면 기존 세션을 버릴지 먼저 묻는다.

![라이트 모드 홈 화면. 진행 중인 덱이 이어하기 배지와 진행바를 달고 맨 위에 있다](/assets/projects/memonowz/08-home-light.png)

홈 화면에는 진행 중인 덱이 `이어하기 3/12`와 진행바를 달고 가장 위에 표시된다. 중단한 세션을 이어가는 데 필요한 정보는 이 한 줄이면 충분했다.

## 간격반복 대신 틀린 카드를 먼저 다시 내도록 했다

지금은 카드별 정답·오답 횟수만으로 출제 순서를 정한다. 간격반복 알고리즘까지 들이기에는 범위가 커졌다.

```ts
export const orderCards = (cards: Card[], rng: () => number = Math.random): string[] => {
  const wrong = cards.filter((card) => card.stats.wrong > card.stats.right)
  const rest = cards.filter((card) => card.stats.wrong <= card.stats.right)
  return [...shuffle(wrong, rng), ...shuffle(rest, rng)].map((card) => card.id)
}
```

전체 카드를 무작위로 섞으면 방금 틀린 카드가 한참 뒤에 나올 수 있다. 반대로 순서를 고정하면 카드 순서를 외우게 된다. 틀린 카드와 나머지를 나눈 뒤 각 그룹을 섞은 이유가 이 사이의 타협이다.

`term` 카드의 오답 보기는 같은 덱에서 가져온다. 직접 입력한 `distractors`가 있으면 그것을 우선하고, 없으면 같은 덱의 다른 `term` 카드 중에서 뒷면이 다른 것만 후보로 삼는다.

| 후보 수 | 출제 방식 |
|---:|---|
| 3개 이상 | 4지선다 |
| 1~2개 | 2지선다 또는 3지선다 |
| 0개 | 객관식 대신 뒤집기 |

카드가 한 장뿐인 덱에서도 학습이 멈추지 않게 하려면 마지막 폴백이 필요했다. 보기를 억지로 채우는 대신 카드를 뒤집어 답을 확인하는 쪽을 골랐다.

![term 카드의 4지선다 출제 화면](/assets/projects/memonowz/10-study-question.png)

`mcq`는 보기와 원래 인덱스를 묶어서 섞는다. 보기만 섞으면 정답 번호가 바뀌기 때문이다.

```ts
const choices = shuffle(card.choices.map((choice, index) => ({ choice, index })), rng)
return {
  kind: 'choice',
  stem: card.question,
  choices: choices.map(({ choice }) => choice),
  answerIndex: choices.findIndex(({ index }) => index === card.answer),
}
```

`qa`는 답을 자동 비교하지 않는다. 긴 답을 문자열로 비교하는 것은 의미가 없어서, 답을 펼쳐 본 사람이 `몰랐음`과 `알았음` 중 하나를 누르게 했다.

![qa 카드에서 답 보기를 누른 뒤의 화면. 모범답안이 펼쳐져 있고 아래에 몰랐음과 알았음 버튼이 있다](/assets/projects/memonowz/18-qa-answer.png)

## 통계는 세션이 아니라 채점 직후 카드에 기록했다

세션이 끝날 때 정답률을 한꺼번에 반영하면 학습 도중 나간 기록이 사라진다. 그래서 채점 한 번마다 카드 통계를 바로 갱신한다.

```ts
/** 세션 종료가 아니라 매 채점마다 부른다. 중간에 나가도 푼 만큼은 남는다 */
export const recordAnswer = async (cardId: string, correct: boolean) => {
  const card = await db.cards.get(cardId)
  if (!card) return
  await db.cards.update(cardId, {
    stats: {
      right: card.stats.right + (correct ? 1 : 0),
      wrong: card.stats.wrong + (correct ? 0 : 1),
      lastSeenAt: Date.now(),
    },
  })
}
```

카드 내용을 고칠 때 통계는 그대로 둔다. 오타를 고쳤다고 지금까지 틀린 횟수가 사라지면, 가장 약한 카드가 다시 출제 순서 뒤로 밀리기 때문이다. 덱 정답률도 저장하지 않고 카드 통계를 합쳐 계산한다. 아직 한 번도 풀지 않은 덱은 0%가 아니라 `아직 안 품`으로 표시한다.

오답노트는 별도 목록 대신 채점 직후 화면 안에 넣었다. 왜 틀렸는지 읽는 것이 목적이라면, 그 순간 설명을 보여주는 편이 구조가 작다.

```tsx
<details className="study__explanation" open={!answer.correct}>
  <summary>개념 설명</summary>
  <p>{card.explanation}</p>
</details>
```

틀렸을 때는 설명을 펼치고, 맞혔을 때는 접는다. `다음` 버튼은 화면 아래에 고정해 설명을 끝까지 읽지 않고 넘어갈 수도 있게 했다.

## 카드가 삭제돼도 세션의 위치가 틀어지지 않게 했다

세션은 시작할 때 카드 id 목록을 저장하지만, 학습 중에 카드가 삭제될 수 있다. 남은 id를 그대로 두면 빈 문제가 나오거나 진행 위치가 어긋난다.

- 세션을 복원할 때 현재 덱에 남은 id만 걸러 내고 `cursor`를 남은 길이 안으로 맞춘다.
- 학습 화면에서 앞쪽 카드를 지우면 `cursor`도 하나 줄인다.
- 덱을 삭제할 때는 카드와 덱, 그 덱을 가리키는 세션을 함께 지운다.

![학습 화면 위에 열린 카드 편집 모달](/assets/projects/memonowz/11-card-editor-in-study.png)

학습 중 오타를 발견하는 일이 생각보다 자주 있었다. 덱 상세로 나갔다 돌아오면 세션이 끊기므로 학습 화면에서도 카드 편집 모달을 열 수 있게 했다. 저장하면 카드만 다시 읽고 세션은 유지한다.

## 채점한 카드를 보여주는 자리와 진행 커서를 나눴다

채점이 끝난 뒤에는 화면에 방금 푼 카드를 계속 보여줘야 한다. 하지만 진행 커서는 이미 다음 카드로 이동해야 한다. 그래서 표시용 `answeredCardId`와 진행용 `cursor`를 분리했다. 둘을 하나로 합치면 채점하는 순간 다음 문제가 튀어나온다.

결과 화면에서는 오답을 위에 두고, 각 항목을 `<details>`로 접었다. `틀린 것만 다시 풀기`는 새 저장 구조가 아니라 오답 카드 id를 학습 화면에 다시 넘기는 방식이다.

![결과 화면. 오답이 위쪽, 정답이 아래쪽에 놓이고 각 항목을 탭하면 펼쳐진다](/assets/projects/memonowz/13-result.png)

## 카드 생성은 앱 밖에 두고 임포트 검증은 안에 남겼다

카드를 넣는 길은 세 가지다. 폼에 직접 입력하거나, 스프레드시트의 두 열을 붙여 넣거나, JSON 파일을 올린다.

붙여넣기에서는 `split`을 쓰지 않았다. 뒷면에 쉼표가 들어간 단어 설명을 자주 만나기 때문이다. 첫 구분자에서만 잘라 나머지는 뒷면으로 남겼다.

```ts
const separatorIndex = chunk.indexOf(delimiter)
if (separatorIndex < 0) return []
const front = chunk.slice(0, separatorIndex).trim()
const back = chunk.slice(separatorIndex + delimiter.length).trim()
```

줄바꿈과 `\r\n`도 정규화하고, 앞뒤 중 한쪽이 비어 있는 줄은 카드로 만들지 않는다. 입력 중에는 인식된 카드 수와 앞 세 장을 미리 보여준다.

JSON 임포트는 카드마다 `cardInputSchema.safeParse`를 실행한다. 실패한 항목은 번호와 첫 번째 오류를 보여주고, 통과한 카드만 넣을 수 있다. 200장 중 3장이 잘못됐다고 197장까지 버리게 만들지는 않았다.

![임포트 화면. 유형별 JSON 스키마 설명과 샘플이 화면 안에 실려 있다](/assets/projects/memonowz/15-import-json-schema.png)

앱 안에 원문을 카드로 바꾸는 AI 생성기를 넣지는 않았다. API 키와 과금이 로컬 전용이라는 방향과 맞지 않았고, 사람마다 사용하는 도구도 다르다. 대신 임포트 화면에 스키마와 샘플 JSON을 보여주고, 모델이나 편집기로 만든 결과를 앱이 검증하게 했다. 생성이 완벽하지 않아도 잘못된 항목만 걸러 내면 된다.

백업은 임포트와 같은 입력 형식으로 내보낸다. 저장소에서만 필요한 `id`, `deckId`, `stats`는 제외한다.

```ts
const toInput = (card: Card): CardInput => {
  const { id: _id, deckId: _deckId, stats: _stats, ...input } = card
  return input as CardInput
}
```

덕분에 내보낸 JSON을 임포트 화면에 그대로 다시 넣을 수 있다. 대신 학습 통계는 백업하지 않는다. 카드는 복원되지만 맞고 틀린 횟수는 새 기기에서 다시 쌓인다. 가져오기는 기존 덱을 덮어쓰지 않고 항상 새 덱으로 덧붙인다.

## 로컬 전용이라서 생기는 문제는 조용히 숨기지 않았다

IndexedDB를 쓸 수 없는 브라우저에서 저장된 척 보이는 것이 더 위험하다. 사파리 프라이빗 모드처럼 저장소를 열지 못하는 경우에는 앱을 막기보다 화면 위에 경고를 띄운다.

```tsx
useEffect(() => { db.open().catch(() => setBlocked(true)) }, [])
```

PWA 캐시도 한 번 손봤다. 한글 폰트의 유니코드 서브셋 274개가 프리캐시에 들어가 설치할 때 4MB를 내려받고 있었다. 폰트를 프리캐시 패턴에서 빼고 런타임 `CacheFirst`로 옮긴 뒤 빌드 로그가 다음처럼 줄었다.

```text
precache  283 entries (4013.22 KiB)
precache  9 entries (615.12 KiB)
```

처음 화면에 필요한 앱 자산과, 실제로 읽은 글자에 필요한 폰트 자산을 같은 캐시에 넣을 이유는 없었다. 이미 읽은 서브셋은 캐시에 남고, 아직 없는 글자는 시스템 폰트로 잠시 표시된다.

화면 구조는 홈에서 덱, 덱에서 학습으로 들어가는 드릴다운을 택했다. 최상위 목적지가 홈 하나인데 하단 탭을 두면 오히려 선택지가 늘어난다고 봤다. 설정도 자주 오가는 화면이 아니라 상단으로 뺐다.

## 디자인과 테스트는 화면 전체보다 자주 깨지는 곳에 집중했다

코드를 쓰기 전에 토큰과 공통 컴포넌트, 주요 화면 목업을 한 페이지에 렌더했다. 이 과정에서 강조색을 테라코타에서 딥 페트롤(`#1F5A6B`)로 바꾸고, 서체를 IBM Plex Sans KR 한 벌로 통일했다. 오래 읽는 앱이라 라이트 모드 배경도 순백 대신 아이보리(`#FAF6EC`)로 잡았다.

![디자인 시스템 문서. 팔레트와 타이포 스케일과 공통 컴포넌트가 한 페이지에 놓여 있다](/assets/projects/memonowz/16-design-system.png)

테스트는 Vitest와 Node 환경에서 31개를 작성했다. 카드 스키마, 오답 우선 정렬, 보기 생성, 붙여넣기 파싱, JSON 검증, 덱 삭제와 백업 왕복처럼 화면 뒤에서 반복해서 깨질 만한 로직을 고정했다.

화면은 브라우저에서 한 바퀴 직접 돌렸다. 덱을 만들고 카드 다섯 장을 붙여 넣은 뒤, 4지선다를 풀고, 하나를 틀리고, 학습 중 카드를 고치고, 결과에서 틀린 카드만 다시 풀었다. 중간에 나갔다가 홈으로 돌아왔을 때 `이어하기 1/4`가 나타나는 것까지 확인했다.

## 남은 숙제는 유형이 아니라 카드를 만드는 과정이다

빈칸 채우기나 주관식 유형을 추가할 수는 있다. 현재 구조에서는 스키마와 출제 함수, 편집 폼과 필터 정도를 고치면 된다. 다만 지금은 세 유형이 실제로 잘 들어오고, 풀리고, 통계에 남는 것부터 확인하는 단계다.

간격반복도 아직 없다. `orderCards`를 스케줄러로 바꾸면 붙일 자리는 정해져 있지만, 사용 기록이 조금 쌓인 뒤에야 어떤 방식이 필요한지 알 수 있다. 기기 간 동기화와 세션 히스토리도 같은 이유로 다음 범위로 남겨 뒀다.

![덱 상세 화면. 검색창 아래에 전체·term·mcq·qa 필터가 개수를 달고 있다](/assets/projects/memonowz/09-deck-detail.png)

현재 카드를 만드는 과정도 여전히 손이 많이 간다. 강의 노트나 기술 문서를 카드 JSON으로 바꾸는 일은 앱 밖의 도구에 맡기되, 결과를 검증하고 안전하게 넣는 경계는 Memonowz 안에 남겨 두었다. 다음에 개선한다면 이 흐름부터 줄이고 싶다.

Memonowz를 만들면서 가장 많이 한 일은 기능을 추가하는 것보다 범위를 줄이는 일이었다. 단어, 기출, 면접 질문은 입력과 출제 방식이 다르지만, 저장하고 반복해서 다시 푸는 길은 하나로 만들 수 있었다. 일단은 내가 외울 자료를 내 브라우저에 넣고, 틀린 것부터 다시 만나는 데 필요한 만큼은 갖춰졌다.
