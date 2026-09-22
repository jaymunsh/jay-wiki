/**
 * Leneu Benchmark - Production Web App Script
 * Manages state, dynamic data loading from catalog.json,
 * interactive views (Leaderboard, Side-by-side Arena, Inspector),
 * marked.js markdown rendering, and URL hash routing.
 */

// Global State
const state = {
  catalog: null,
  currentView: 'leaderboard',
  selectedCategory: 'all',
  searchQuery: '',
  arena: {
    modelA: 'gemini-3.8-flash/20260913T163700Z-g38f',
    modelB: 'deepseek-v4.1-flash/20260913T142623Z-5711',
    task: 'outputs/GAME-01/index.html',
    viewport: '100%'
  },
  inspector: null
};

// Specifications Checklist Data for Arena
const taskSpecs = {
  'outputs/GAME-01/index.html': {
    title: 'GAME-01: 테트리스 (Hold 기능 완비)',
    summary: '10×20 보드와 7종 블록을 사용해, 한 블록당 한 번만 가능한 Hold를 포함한 직접 플레이 가능한 테트리스를 제작한다.',
    source: 'cases/v0.1/QUESTIONS.md',
    items: [
      { label: '보드 규격', desc: '10×20 보드 & 7종 테트로미노 무작위 생성' },
      { label: '회전 취소', desc: '충돌 시 벽차기 없이 회전 즉시 취소' },
      { label: 'Hold 기능', desc: 'C / Shift 키 지원, 1회 제한(canHold), Swap 기능' },
      { label: '점수 체계', desc: '1·2·3·4줄 동시 제거 시 100·300·500·800점 가산' }
    ]
  },
  'outputs/WEB-01/index.html': {
    title: 'WEB-01: Leneu Desk (반응형 제품 웹앱)',
    summary: '개인 AI 작업 기록 서비스의 랜딩페이지를 만들고 가격 전환, 모바일 메뉴, FAQ, 이메일 신청 상태를 구현한다.',
    source: 'cases/v0.1/QUESTIONS.md',
    items: [
      { label: '독립성', desc: '외부 CDN·폰트 0건, 인라인 SVG 그래픽 적용' },
      { label: '요금제 토글', desc: '월 9,000원 ↔ 연 90,000원 즉시 단가 변환' },
      { label: '반응형 UI', desc: '데스크톱 3열 그리드 및 모바일 햄버거 메뉴' },
      { label: '입력 폼', desc: '정규식 이메일 유효성 검사 및 성공 피드백' }
    ]
  },
  'outputs/GAME-02/index.html': {
    title: 'GAME-02: 횡스크롤 플랫폼 게임',
    summary: '고정된 2400×600 맵에서 이동·점프·코인·적·카메라·실패 후 재시작과 골인까지 구현한다.',
    source: 'cases/v0.1/QUESTIONS.md',
    items: [
      { label: '물리 엔진', desc: '중력, 점프 가속도, 발판 착지 판정' },
      { label: '스테이지', desc: '횡스크롤 카메라 추적, 장애물 및 코인 수집' },
      { label: '조작감', desc: '좌우 이동, Space/↑ 점프, 부드러운 애니메이션' },
      { label: '클리어 판정', desc: '도착 지점 도달 시 클리어 시간/코인 집계' }
    ]
  },
  'outputs/WRITE-01/article.md': {
    title: 'WRITE-01: 저장소 작업 규칙 기술 블로그',
    summary: 'AI 코딩 도구에 반복 설명할 저장소 공통·경로별 작업 규칙을 어디에 어떻게 기록할지 설명하는 게시 가능한 기술 글을 작성한다.',
    source: 'cases/writing-v2/WRITE-01.md',
    items: [
      { label: '문제 해결 흐름', desc: '문제에서 시작해 규칙 위치, 예시, 확인과 한계로 이어지는가' },
      { label: '구조와 가독성', desc: '제목·문단·표·코드·체크리스트가 읽기 쉽게 구성됐는가' },
      { label: '사실과 근거', desc: '고정 자료의 사실을 보존하고 확인하지 않은 경험을 만들지 않았는가' },
      { label: '실행 가능성', desc: '독자가 저장소 규칙을 실제로 분리하고 적용할 결론을 얻는가' }
    ]
  },
  'outputs/WRITE-02/edited.md': {
    title: 'WRITE-02: 배포·롤백 운영 문서',
    summary: 'Kubernetes 공식 자료를 배포 실패 시 당직 개발자가 상태 확인부터 복구 후 검증까지 사용할 수 있는 런북으로 편집한다.',
    source: 'cases/writing-v2/WRITE-02.md',
    items: [
      { label: '운영 흐름', desc: '상태 확인부터 원인 관찰, 복구 판단과 사후 확인까지 이어지는가' },
      { label: '명령과 판단', desc: '각 명령의 목적과 다음 판단이 명확하게 연결되는가' },
      { label: '조건과 예외', desc: '데이터 복구, revision 제한, paused 상태의 제약을 구분하는가' },
      { label: '현장 가독성', desc: '당직자가 표와 체크리스트로 빠르게 행동할 수 있는가' }
    ]
  },
  'outputs/STYLE-01/status-page.md': {
    title: 'STYLE-01: 장애 공지문 (v0.5 특성)',
    summary: '동일한 장애 사실 카드를 사용자 대상 상태 페이지 공지문으로 변환한다. 격식·정보 순서·사실 보존이 핵심.',
    source: 'cases/v0.5-character/STYLE-01.md',
    items: [
      { label: '사실 보존', desc: '시각 14:02~15:47, 지연 312건, 중복 결제 0, DB 풀 고갈 원인' },
      { label: '격식체 톤', desc: '상태 페이지에 맞는 간결하고 중립적인 공지 문체' },
      { label: '정보 순서', desc: '현상 → 영향 → 원인 → 재발 방지 순의 공지문 구조' },
      { label: '발명 금지', desc: '사실 카드에 없는 수치·보상·사과 표현을 추가하지 않았는가' }
    ]
  },
  'outputs/STYLE-01/apology-email.md': {
    title: 'STYLE-01: 사과 이메일 (v0.5 특성)',
    summary: '같은 장애 사실을 영향받은 고객에게 보내는 사과 메일로 변환한다. 공지문과 다른 레지스터가 드러나는지 본다.',
    source: 'cases/v0.5-character/STYLE-01.md',
    items: [
      { label: '사실 보존', desc: '동일 사실 유지 — 312건, 중복 결제 0, 원인·재발 방지' },
      { label: '고객 레지스터', desc: '공지문보다 부드럽고 직접적인 어조로 전환됐는가' },
      { label: '안심 정보', desc: '중복 결제 없음·정상 처리 완료를 전면에 배치했는가' },
      { label: '발명 금지', desc: '없는 보상·경험을 지어내지 않았는가' }
    ]
  },
  'outputs/STYLE-01/exec-summary.md': {
    title: 'STYLE-01: 경영진 요약 (v0.5 특성)',
    summary: '같은 장애를 경영진 보고용 사후 요약으로 변환한다. 명사형 종결·건조한 보고 문체가 구현되는지 본다.',
    source: 'cases/v0.5-character/STYLE-01.md',
    items: [
      { label: '사실 보존', desc: '수치와 원인이 카드와 일치하는가' },
      { label: '보고 문체', desc: '감정 표현 없는 건조한 요약 — 공지문·메일과 구분되는가' },
      { label: '판단 포함', desc: '재발 방지와 평가가 압축되어 들어갔는가' },
      { label: '발명 금지', desc: '없는 지표·조치를 추가하지 않았는가' }
    ]
  },
  'outputs/SEARCH-01/research.md': {
    title: 'SEARCH-01: 공식 기능 확인 리서치',
    summary: 'Python 3.12 tomllib이 TOML 읽기와 쓰기를 각각 지원하는지, 도입 버전과 파일 모드를 공식 문서에서 확인한다.',
    source: 'cases/v0.1/QUESTIONS.md',
    items: [
      { label: '공식 출처', desc: '주요 주장에 공식 문서 또는 공식 발표 근거가 연결되는가' },
      { label: '사실 구분', desc: '확인된 내용과 추론·미확인 사항을 분리하는가' },
      { label: '조건 보존', desc: '버전, 환경, 지원 범위와 예외 조건을 빠뜨리지 않는가' },
      { label: '결론 활용성', desc: '조사 결과가 실제 선택이나 다음 행동으로 이어지는가' }
    ]
  },
  'outputs/SEARCH-03/research.md': {
    title: 'SEARCH-03: 환경별 비교 리서치',
    summary: 'Apple Silicon·통합 메모리 64GB에서 한국어 글쓰기와 코딩 도구 연동 용도로 Ollama·llama.cpp·LM Studio를 비교한다.',
    source: 'cases/v0.1/QUESTIONS.md',
    items: [
      { label: '비교 기준', desc: '환경마다 같은 기준과 범위로 비교했는가' },
      { label: '출처 품질', desc: '공식 자료를 중심으로 주장별 근거를 제시하는가' },
      { label: '차이와 제약', desc: '공통점뿐 아니라 환경별 제한과 불확실성을 드러내는가' },
      { label: '의사결정성', desc: '조건별 선택 기준과 확인할 후속 항목이 명확한가' }
    ]
  }
};

// Initialize App
async function initApp() {
  setupTheme();
  setupRouting();
  await loadCatalog();
  renderAll();
}

// Load Catalog with Failover to Embedded Data
async function loadCatalog() {
  try {
    const res = await fetch('data/catalog.json?v=20260922-1', { cache: 'no-store' });
    if (res.ok) {
      state.catalog = await res.json();
      console.log('Loaded catalog.json successfully:', state.catalog);
      return;
    }
  } catch (e) {
    console.warn('Could not fetch catalog.json via HTTP (likely file:// protocol). Using embedded failover.');
  }

  // Embedded Failover for Local File Direct Open
  state.catalog = {
    generatedAt: new Date().toISOString(),
    taskMeta: {
      'TC-01': { category: 'tools', title: '선택적 도구 조회' },
      'TC-02': { category: 'tools', title: '일정 생성' },
      'TC-04': { category: 'tools', title: '오류 복구' },
      'H-01':  { category: 'tools', title: '긴 지시 처리' },
      'H-03':  { category: 'code', title: '테스트 기반 수정' },
      'CODE-01': { category: 'code', title: '예약 충돌 버그 수정' },
      'WEB-01':  { category: 'web', title: '반응형 웹앱', hasHtml: true },
      'GAME-01': { category: 'web', title: '테트리스 (Hold)', hasHtml: true },
      'GAME-02': { category: 'web', title: '플랫포머 게임', hasHtml: true },
      'WRITE-01': { category: 'write', title: '기술 블로그' },
      'WRITE-02': { category: 'write', title: '한국어 편집' },
      'THINK-01': { category: 'write', title: '장문 사실 대조' },
      'SEARCH-01': { category: 'search', title: '공식 문서 확인' },
      'SEARCH-03': { category: 'search', title: '환경 비교' },
      'ALG-01': { category: 'reason', title: '알고리즘 구현' },
      'REASON-KO-01': { category: 'reason', title: '국어 조건 독해' },
      'REASON-MATH-01': { category: 'reason', title: '수학 경계 계산' },
      'REASON-SCI-01': { category: 'reason', title: '과학 실험 판단' }
    },
    models: [
      {
        modelSlug: 'gemini-3.8-flash',
        runId: '20260913T163700Z-g38f',
        runPath: 'runs/gemini-3.8-flash/20260913T163700Z-g38f',
        totalTasks: 18,
        totalTimeText: '약 38분 (단조시계)',
        verifiedBadge: '18개 전과제 제출 완주',
        tasks: {
          'GAME-01': { hasHtml: true, htmlPath: 'runs/gemini-3.8-flash/20260913T163700Z-g38f/outputs/GAME-01/index.html' },
          'GAME-02': { hasHtml: true, htmlPath: 'runs/gemini-3.8-flash/20260913T163700Z-g38f/outputs/GAME-02/index.html' },
          'WEB-01': { hasHtml: true, htmlPath: 'runs/gemini-3.8-flash/20260913T163700Z-g38f/outputs/WEB-01/index.html' },
          'CODE-01': { hasHtml: false },
          'ALG-01': { hasHtml: false },
          'H-03': { hasHtml: false }
        }
      },
      {
        modelSlug: 'deepseek-v4.1-flash',
        runId: '20260913T142623Z-5711',
        runPath: 'runs/deepseek-v4.1-flash/20260913T142623Z-5711',
        totalTasks: 18,
        totalTimeText: '41분 17초 (2,477s)',
        verifiedBadge: 'Chrome CDP 33/33 실측',
        tasks: {
          'GAME-01': { hasHtml: true, htmlPath: 'runs/deepseek-v4.1-flash/20260913T142623Z-5711/outputs/GAME-01/index.html' },
          'GAME-02': { hasHtml: true, htmlPath: 'runs/deepseek-v4.1-flash/20260913T142623Z-5711/outputs/GAME-02/index.html' },
          'WEB-01': { hasHtml: true, htmlPath: 'runs/deepseek-v4.1-flash/20260913T142623Z-5711/outputs/WEB-01/index.html' },
          'CODE-01': { hasHtml: false },
          'WRITE-01': { hasHtml: false }
        }
      },
      {
        modelSlug: 'gpt-5.6-luna-xhigh',
        runId: '20260913T142420Z-a7f3',
        runPath: 'runs/gpt-5.6-luna-xhigh/20260913T142420Z-a7f3',
        totalTasks: 18,
        totalTimeText: '약 45분',
        verifiedBadge: '15개 제출·3개 부분 완료',
        tasks: {
          'GAME-01': { hasHtml: true, htmlPath: 'runs/gpt-5.6-luna-xhigh/20260913T142420Z-a7f3/outputs/GAME-01/index.html' },
          'GAME-02': { hasHtml: true, htmlPath: 'runs/gpt-5.6-luna-xhigh/20260913T142420Z-a7f3/outputs/GAME-02/index.html' },
          'WEB-01': { hasHtml: true, htmlPath: 'runs/gpt-5.6-luna-xhigh/20260913T142420Z-a7f3/outputs/WEB-01/index.html' }
        }
      },
      {
        modelSlug: 'opencode-muse-spark-1.3-contributor-free',
        runId: '20260913T163601Z-k7q2',
        runPath: 'runs/opencode-muse-spark-1.3-contributor-free/20260913T163601Z-k7q2',
        totalTasks: 18,
        totalTimeText: '약 40분',
        verifiedBadge: '자기 검증 제출',
        tasks: {
          'GAME-01': { hasHtml: true, htmlPath: 'runs/opencode-muse-spark-1.3-contributor-free/20260913T163601Z-k7q2/outputs/GAME-01/index.html' },
          'GAME-02': { hasHtml: true, htmlPath: 'runs/opencode-muse-spark-1.3-contributor-free/20260913T163601Z-k7q2/outputs/GAME-02/index.html' },
          'WEB-01': { hasHtml: true, htmlPath: 'runs/opencode-muse-spark-1.3-contributor-free/20260913T163601Z-k7q2/outputs/WEB-01/index.html' }
        }
      },
      {
        modelSlug: 'swe-2-high',
        runId: '20260913T142640Z-7d3e',
        runPath: 'runs/swe-2-high/20260913T142640Z-7d3e',
        totalTasks: 18,
        totalTimeText: '약 42분',
        verifiedBadge: '자기 검증 제출',
        tasks: {
          'GAME-01': { hasHtml: true, htmlPath: 'runs/swe-2-high/20260913T142640Z-7d3e/outputs/GAME-01/index.html' },
          'GAME-02': { hasHtml: true, htmlPath: 'runs/swe-2-high/20260913T142640Z-7d3e/outputs/GAME-02/index.html' },
          'WEB-01': { hasHtml: true, htmlPath: 'runs/swe-2-high/20260913T142640Z-7d3e/outputs/WEB-01/index.html' }
        }
      }
    ]
  };
}

// Render All Views
function renderAll() {
  renderLeaderboard();
  renderArenaOptions();
  renderArena();
  renderInspector();
}

// 1. Leaderboard Renderer
function renderLeaderboard() {
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody || !state.catalog) return;

  const query = state.searchQuery.toLowerCase();
  const models = state.catalog.models.filter(m => {
    return m.modelSlug.toLowerCase().includes(query) || m.runId.toLowerCase().includes(query);
  });

  tbody.innerHTML = models.map((m, idx) => {
    const rank = idx + 1;
    const badgeColor = rank === 1 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

    // Task Badges Matrix
    const taskKeys = Object.keys(m.tasks || {});
    const htmlButtons = taskKeys
      .filter(t => m.tasks[t].hasHtml)
      .map(t => `
        <button onclick="previewArtifact('${m.modelSlug}', '${m.runId}', 'outputs/${t}/index.html', '${t}')" class="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] border border-emerald-200 flex items-center gap-1 shadow-2xs transition">
          <i class="fa-solid fa-play text-[8px]"></i> ${t}
        </button>
      `).join('');

    const otherBadges = taskKeys
      .filter(t => !m.tasks[t].hasHtml)
      .slice(0, 4)
      .map(t => `
        <button onclick="openInspectorItem('${m.modelSlug}', '${m.runId}', 'outputs/${t}/RESULT.md', 'MD', '${t} 결과 보고서')" class="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-[10px] border border-indigo-200 transition">
          ${t}
        </button>
      `).join('');

    const remainingCount = Math.max(0, taskKeys.length - (taskKeys.filter(t => m.tasks[t].hasHtml).length + 4));

    return `
      <tr class="hover:bg-indigo-50/40 dark:hover:bg-slate-800/40 transition group">
        <td class="py-4 px-4 text-center">
          <span class="inline-flex items-center justify-center w-6 h-6 rounded-full ${badgeColor} font-extrabold text-xs">${rank}</span>
        </td>
        <td class="py-4 px-4">
          <div class="flex items-center space-x-2">
            <span class="font-extrabold text-slate-900 dark:text-white text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">${m.modelSlug}</span>
            <span class="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">${m.totalTasks} cases</span>
          </div>
          <div class="font-mono text-[11px] text-slate-400 mt-0.5">${m.runId}</div>
          <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
            <i class="fa-solid fa-shield-check text-[9px]"></i>
            <span>${m.verifiedBadge}</span>
          </div>
        </td>
        <td class="py-4 px-4 text-center">
          <span class="px-2.5 py-1 rounded-full ${m.complete === false
            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'} font-bold">
            ${m.complete === false
              ? `${m.deliveredCount ?? m.totalTasks} / ${m.expectedTasks ?? m.totalTasks} 부분 제출`
              : `${m.submittedCount ?? m.totalTasks} / ${m.expectedTasks ?? m.totalTasks} Submitted`}
          </span>
        </td>
        <td class="py-4 px-4 font-mono text-slate-600 dark:text-slate-300">
          ${m.totalTimeText}
        </td>
        <td class="py-4 px-4">
          <div class="flex flex-wrap items-center gap-1.5">
            ${htmlButtons}
            ${otherBadges}
            ${remainingCount > 0 ? `<span class="text-[10px] text-slate-400 font-mono">+${remainingCount} more</span>` : ''}
          </div>
        </td>
        <td class="py-4 px-4 text-right">
          <button onclick="openInspectorItem('${m.modelSlug}', '${m.runId}', 'outputs/GAME-01/index.html', 'HTML', '${m.modelSlug} - GAME-01')" class="px-3 py-1.5 text-xs bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition">
            탐색 &rarr;
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// 2. Arena Setup & Renderer
function renderArenaOptions() {
  if (!state.catalog) return;
  const selectA = document.getElementById('model-a-select');
  const selectB = document.getElementById('model-b-select');
  if (!selectA || !selectB) return;

  // 완료된 실행만 비교 대상으로 노출한다 (부분 응시·중단 실행 제외).
  const completeModels = state.catalog.models.filter(m => m.complete !== false);
  const options = completeModels.map(m => {
    const val = `${m.modelSlug}/${m.runId}`;
    const hint = String(m.suiteVersion || '').startsWith('v0.5')
      ? ' · 특성 전용'
      : (m.complete === false ? ' · 부분 응시' : '');
    return `<option value="${val}">${m.modelSlug} (${m.runId.slice(-4)}${hint})</option>`;
  }).join('');

  selectA.innerHTML = options;
  selectB.innerHTML = options;

  selectA.value = state.arena.modelA;
  if (completeModels[1]) {
    selectB.value = `${completeModels[1].modelSlug}/${completeModels[1].runId}`;
    state.arena.modelB = selectB.value;
  }
}

async function updateArena() {
  const selectA = document.getElementById('model-a-select');
  const selectB = document.getElementById('model-b-select');
  const selectTask = document.getElementById('arena-task-select');
  if (!selectA || !selectB || !selectTask) return;

  state.arena.modelA = selectA.value;
  state.arena.modelB = selectB.value;
  state.arena.task = selectTask.value;

  const pathA = `runs/${state.arena.modelA}/${state.arena.task}`;
  const pathB = `runs/${state.arena.modelB}/${state.arena.task}`;

  const iframeA = document.getElementById('iframe-a');
  const iframeB = document.getElementById('iframe-b');
  const extA = document.getElementById('model-a-external');
  const extB = document.getElementById('model-b-external');

  // 선택한 실행에 해당 과제 파일이 없으면 404 iframe 대신 안내를 표시한다.
  const runHasFile = (runRef) => {
    const [slug, runId] = (runRef || '').split('/');
    const match = (state.arena.task || '').match(/^outputs\/([^/]+)\/(.+)$/);
    const run = state.catalog?.models?.find(m => m.modelSlug === slug && m.runId === runId);
    return Boolean(run?.tasks?.[match?.[1]]?.files?.includes(match?.[2]));
  };
  const hasA = runHasFile(state.arena.modelA);
  const hasB = runHasFile(state.arena.modelB);

  const isMarkdown = state.arena.task.endsWith('.md');
  const renderFrame = (iframe, sourcePath, available = true) => {
    if (!iframe) return;
    if (!available) {
      iframe.removeAttribute('sandbox');
      iframe.srcdoc = '<div style="display:flex;align-items:center;justify-content:center;height:100%;font:13px/1.5 system-ui,sans-serif;color:#94a3b8;text-align:center;padding:2rem;box-sizing:border-box">이 실행에는 해당 과제 산출물이 없습니다</div>';
      return;
    }
    iframe.removeAttribute('srcdoc');
    if (!isMarkdown) {
      iframe.removeAttribute('sandbox');
      iframe.src = sourcePath;
      return;
    }
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    iframe.src = `markdown-viewer.html?source=${encodeURIComponent(sourcePath)}`;
  };

  if (extA) { extA.href = hasA ? pathA : '#'; extA.classList.toggle('opacity-40', !hasA); extA.classList.toggle('pointer-events-none', !hasA); }
  if (extB) { extB.href = hasB ? pathB : '#'; extB.classList.toggle('opacity-40', !hasB); extB.classList.toggle('pointer-events-none', !hasB); }

  // Update Spec Checklist
  renderSpecChecklist(state.arena.task);
  renderFrame(iframeA, pathA, hasA);
  renderFrame(iframeB, pathB, hasB);
}

function renderSpecChecklist(taskPath) {
  const titleEl = document.getElementById('spec-title');
  const summaryEl = document.getElementById('spec-summary');
  const sourceEl = document.getElementById('spec-source');
  const itemsEl = document.getElementById('spec-items');
  if (!titleEl || !itemsEl) return;

  const spec = taskSpecs[taskPath] || taskSpecs['outputs/GAME-01/index.html'];
  titleEl.innerText = spec.title;
  if (summaryEl) summaryEl.innerText = spec.summary || '';
  if (sourceEl) sourceEl.innerText = spec.source || '';
  itemsEl.innerHTML = spec.items.map((item, i) => `
    <div class="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
      <div class="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
        <span class="w-4 h-4 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px]">${i+1}</span>
        <span>${item.label}</span>
      </div>
      <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">${item.desc}</p>
    </div>
  `).join('');
}

function setArenaViewport(width) {
  state.arena.viewport = width;
  document.querySelectorAll('.vp-btn').forEach(b => {
    b.className = 'vp-btn px-2.5 py-1 rounded-lg font-medium text-slate-500 hover:text-slate-800 transition';
  });
  if (event && event.target) {
    event.target.className = 'vp-btn px-2.5 py-1 rounded-lg font-bold bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-2xs';
  }

  const iframeA = document.getElementById('iframe-a');
  const iframeB = document.getElementById('iframe-b');
  if (iframeA) iframeA.style.width = width;
  if (iframeB) iframeB.style.width = width;
}

// 3. Inspector Renderer
function openInspectorItem(model, runId, relativePath, type, title) {
  switchConcept('concept3');
  state.inspector = { model, runId, file: relativePath, type, title };
  renderInspector();
}

function renderInspector() {
  const titleEl = document.getElementById('ws-title');
  const pathEl = document.getElementById('ws-path');
  const newtabBtn = document.getElementById('ws-newtab-btn');
  const frame = document.getElementById('ws-frame');
  const mdView = document.getElementById('ws-md-view');
  const typeBadge = document.getElementById('ws-type-badge');
  const artifactSwitcher = document.getElementById('ws-artifact-switcher');
  const taskBrief = document.getElementById('ws-task-brief');
  const noteTitle = document.getElementById('ws-md-note-title');
  const noteDescription = document.getElementById('ws-md-note-description');

  // 아무 산출물도 선택하지 않은 초기 상태 — 특정 실행을 기본값으로 열지 않는다.
  if (!state.inspector) {
    if (titleEl) titleEl.innerText = '산출물을 선택하세요';
    if (pathEl) pathEl.innerText = '왼쪽 실행 목록에서 과제를 고르면 내용이 표시됩니다';
    if (newtabBtn) {
      newtabBtn.removeAttribute('href');
      newtabBtn.classList.add('opacity-40', 'pointer-events-none');
    }
    if (typeBadge) typeBadge.classList.add('hidden');
    if (artifactSwitcher) artifactSwitcher.classList.add('hidden');
    if (taskBrief) taskBrief.classList.add('hidden');
    if (frame) { frame.classList.add('hidden'); frame.removeAttribute('src'); }
    if (mdView) {
      mdView.classList.remove('hidden');
      const contentEl = document.getElementById('ws-md-content');
      if (contentEl) {
        contentEl.innerHTML = '<div class="p-8 text-center text-sm text-slate-400 dark:text-slate-500">선택된 산출물이 없습니다.<br>왼쪽 실행 목록에서 과제를 선택하세요.</div>';
      }
    }
    if (noteTitle) noteTitle.innerText = '산출물 미리보기';
    if (noteDescription) noteDescription.innerText = '실행 목록에서 과제를 선택하면 해당 파일이 표시됩니다.';
    return;
  }

  const { model, runId, file, type, title } = state.inspector;
  const fullPath = `runs/${model}/${runId}/${file}`;

  if (titleEl) titleEl.innerText = `${title} (${model})`;
  if (pathEl) pathEl.innerText = fullPath;
  if (newtabBtn) {
    newtabBtn.href = fullPath;
    newtabBtn.classList.remove('opacity-40', 'pointer-events-none');
  }

  const taskMatch = file.match(/^outputs\/([^/]+)\//);
  const taskId = taskMatch?.[1];
  const primaryByTask = {
    'TC-01': ['answer.md', 'ANSWER', '답변'],
    'TC-02': ['answer.md', 'ANSWER', '답변'],
    'TC-04': ['answer.md', 'ANSWER', '답변'],
    'ALG-01': ['explanation.md', 'SOLUTION', '풀이'],
    'REASON-KO-01': ['explanation.md', 'SOLUTION', '풀이'],
    'REASON-MATH-01': ['explanation.md', 'SOLUTION', '풀이'],
    'REASON-SCI-01': ['explanation.md', 'SOLUTION', '풀이'],
    'SEARCH-01': ['research.md', 'RESEARCH', '리서치'],
    'SEARCH-03': ['research.md', 'RESEARCH', '리서치'],
    'WRITE-01': ['article.md', 'ARTICLE', '본문'],
    'WRITE-02': ['edited.md', 'RUNBOOK', '런북'],
    'THINK-01': ['summary.md', 'MEMO', '메모'],
    'BUILD-01': ['server.mjs', 'CODE', '서버 코드'],
    'STYLE-01': ['status-page.md', 'ARTICLE', '공지문'],
    'AMBIG-01': ['assumptions.md', 'ASSUME', '판단 근거'],
    'AMBIG-02': ['assumptions.md', 'ASSUME', '판단 근거'],
    'AMBIG-03': ['assumptions.md', 'ASSUME', '판단 근거'],
    'LOOP-01': ['answers-r1.json', 'DATA', '1회차 답안'],
    'TRAP-01': ['report.md', 'REPORT', '정리 문서'],
    'TRAP-02': ['guide.md', 'GUIDE', '설치 안내'],
    'TRAP-03': ['answer.md', 'ANSWER', '요약'],
    'TRAP-04': ['report.md', 'REPORT', '판단 보고서']
  };
  const primary = primaryByTask[taskId];
  // 과제별로 보여줄 산출물이 여러 개인 경우 스위처에 전부 나열한다.
  const extraArtifacts = {
    'STYLE-01': [
      ['status-page.md', 'ARTICLE', '공지문'],
      ['apology-email.md', 'ARTICLE', '사과 메일'],
      ['exec-summary.md', 'ARTICLE', '경영진 요약']
    ],
    'LOOP-01': [
      [`outputs/${taskId}/__loop-compare__`, 'LOOP', '항목별 비교'],
      ['answers-r1.json', 'DATA', '1회차 답안'],
      ['answers-r2.json', 'DATA', '2회차 답안'],
      ['answers-r3.json', 'DATA', '3회차 답안']
    ]
  };
  const taskMeta = state.catalog?.taskMeta?.[taskId] ||
    state.catalog?.models?.find(item => item.modelSlug === model && item.runId === runId)?.tasks?.[taskId]?.meta;
  if (taskBrief) {
    taskBrief.classList.toggle('hidden', !taskMeta?.brief);
    taskBrief.textContent = taskMeta?.brief ? `수행 과제 · ${taskMeta.brief}` : '';
  }
  if (artifactSwitcher) {
    artifactSwitcher.replaceChildren();
    const artifactChoices = extraArtifacts[taskId] || (primary ? [primary] : null);
    artifactSwitcher.classList.toggle('hidden', !artifactChoices);
    artifactSwitcher.classList.toggle('flex', Boolean(artifactChoices));
    if (artifactChoices) {
      const choices = [
        ...artifactChoices.map(([f, t, l]) => ({ file: f, type: t, label: l })),
        { file: 'RESULT.md', type: 'MD', label: '수행 결과' }
      ];
      choices.forEach((choice) => {
        const choicePath = choice.file.startsWith('outputs/')
          ? choice.file
          : `outputs/${taskId}/${choice.file}`;
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = choice.label;
        button.className = choicePath === file
          ? 'px-2.5 py-1 rounded-md bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 font-bold text-[10px] shadow-xs'
          : 'px-2.5 py-1 rounded-md text-slate-500 dark:text-slate-400 font-bold text-[10px] hover:text-slate-800 dark:hover:text-slate-100';
        button.addEventListener('click', () => {
          openInspectorItem(model, runId, choicePath, choice.type, title);
        });
        artifactSwitcher.append(button);
      });
    }
  }

  if (type === 'HTML') {
    if (typeBadge) {
      typeBadge.innerText = 'LIVE HTML';
      typeBadge.className = 'px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]';
    }
    if (frame) {
      frame.classList.remove('hidden');
      frame.src = fullPath;
    }
    if (mdView) mdView.classList.add('hidden');
  } else {
    if (typeBadge) {
      const markdownLabels = {
        ANSWER: 'ANSWER MD',
        SOLUTION: 'SOLUTION MD',
        RESEARCH: 'RESEARCH MD',
        ARTICLE: 'ARTICLE MD',
        RUNBOOK: 'RUNBOOK MD',
        MEMO: 'MEMO MD',
        ASSUME: 'ASSUMPTIONS MD',
        REPORT: 'REPORT MD',
        GUIDE: 'GUIDE MD',
        MD: 'REPORT MD',
        CODE: 'SOURCE CODE',
        DATA: 'DATA',
        LOOP: 'LOOP-01 비교'
      };
      typeBadge.innerText = markdownLabels[type] || 'DOCUMENT MD';
      typeBadge.className = 'px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-bold text-[10px]';
    }
    if (noteTitle && noteDescription) {
      if (type === 'MD') {
        noteTitle.innerText = '수행 결과 보고서';
        noteDescription.innerText = '제출자가 기록한 수행 과정과 산출물 요약입니다. 실제 답안 및 최종 채점 결과와 구분해서 읽어주세요.';
      } else if (type === 'LOOP') {
        noteTitle.innerText = 'LOOP-01 항목별 답안 비교';
        noteDescription.innerText = '같은 10문항에 대한 3회 응시 답안을 나란히 비교합니다. 회차 간 답이 다른 문항은 강조 표시됩니다.';
      } else {
        noteTitle.innerText = '응시자 원문 산출물';
        noteDescription.innerText = '해당 과제에서 응시자가 작성한 실제 답안입니다. 상단 선택기에서 수행 결과 보고서로 전환할 수 있습니다.';
      }
    }
    if (frame) frame.classList.add('hidden');
    if (mdView) {
      mdView.classList.remove('hidden');
      if (type === 'LOOP') loadLoopComparison(model, runId);
      else if (type === 'CODE' || type === 'DATA') loadRawContent(fullPath);
      else loadMarkdownContent(fullPath);
    }
  }
}

async function loadLoopComparison(model, runId) {
  const contentEl = document.getElementById('ws-md-content');
  if (!contentEl) return;
  contentEl.innerHTML = '<div class="text-slate-400 italic">3회 답안을 불러오는 중...</div>';
  const base = `runs/${model}/${runId}/outputs/LOOP-01`;
  const files = ['answers-r1.json', 'answers-r2.json', 'answers-r3.json'];
  const sets = await Promise.all(files.map(f =>
    fetch(`${base}/${f}`).then(r => (r.ok ? r.json() : null)).catch(() => null)
  ));

  const byItem = {};
  sets.forEach((set, i) => {
    (Array.isArray(set) ? set : []).forEach((a) => {
      const id = a?.item || a?.id;
      if (!id) return;
      (byItem[id] ||= [null, null, null])[i] = a;
    });
  });
  const ids = Object.keys(byItem).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }));

  if (!ids.length) {
    contentEl.innerHTML = '<div class="p-4 text-xs text-slate-500">answers-r*.json을 읽지 못했습니다.</div>';
    return;
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cell = (a) => {
    if (!a) return '<td class="px-2 py-1.5 text-slate-300">—</td>';
    const conf = Number.isFinite(a.confidence) ? a.confidence : null;
    return `<td class="px-2 py-1.5 align-top" title="${esc(a.reason)}">
      <div class="font-semibold text-slate-800 dark:text-slate-100">${esc(a.choice)}</div>
      ${conf != null ? `<div class="text-[10px] text-slate-400 mt-0.5">확신도 ${conf}</div>` : ''}
    </td>`;
  };

  const rows = ids.map((id) => {
    const answers = byItem[id];
    const choices = answers.map(a => a?.choice).filter(Boolean);
    const flipped = new Set(choices).size > 1;
    return `<tr class="border-t border-slate-100 dark:border-slate-800 ${flipped ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}">
      <td class="px-2 py-1.5 font-mono font-bold ${flipped ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}">${esc(id)}${flipped ? ' ↕' : ''}</td>
      ${answers.map(cell).join('')}
    </tr>`;
  }).join('');

  const flippedCount = ids.filter(id =>
    new Set(byItem[id].map(a => a?.choice).filter(Boolean)).size > 1).length;

  contentEl.innerHTML = `
    <div class="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
      ${ids.length}문항 · 뒤집힌 문항 <strong class="text-amber-600 dark:text-amber-400">${flippedCount}개</strong>
      <span class="text-slate-400">(셀에 마우스를 올리면 응시자가 적은 이유를 볼 수 있습니다)</span>
    </div>
    <div class="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-2.5 py-1.5 mb-2">
      현재 실행들은 3회 응시가 같은 대화에서 연속 수행되어 회차 간 기억 격리가 불완전할 수 있습니다. 뒤집힘 수치는 하한으로 해석하세요(독립 세션 재측정 시 더 커질 수 있음).
    </div>
    <table class="w-full text-left text-xs border-collapse">
      <thead><tr class="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-700">
        <th class="px-2 py-1.5 w-10">항목</th><th class="px-2 py-1.5">1회차</th><th class="px-2 py-1.5">2회차</th><th class="px-2 py-1.5">3회차</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

async function loadRawContent(fullPath) {
  const contentEl = document.getElementById('ws-md-content');
  if (!contentEl) return;
  contentEl.innerHTML = '<div class="text-slate-400 italic">내용을 불러오는 중...</div>';
  try {
    const res = await fetch(fullPath);
    if (res.ok) {
      const text = await res.text();
      const pre = document.createElement('pre');
      pre.className = 'text-xs font-mono whitespace-pre-wrap break-all p-3 bg-slate-50 dark:bg-slate-900 rounded-lg';
      pre.textContent = text;
      contentEl.replaceChildren(pre);
      return;
    }
  } catch (e) {
    // Local CORS fall-through
  }
  contentEl.innerHTML = `
    <div class="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs">
      <strong>[로컬 파일 안내]</strong><br>
      file:// 프로토콜에서는 직접 fetch가 차단될 수 있습니다. 상단의 새 창 열기 버튼을 사용하세요.
    </div>
  `;
}

async function loadMarkdownContent(fullPath) {
  const contentEl = document.getElementById('ws-md-content');
  if (!contentEl) return;
  contentEl.innerHTML = '<div class="text-slate-400 italic">보고서 내용을 불러오는 중...</div>';

  try {
    const res = await fetch(fullPath);
    if (res.ok) {
      const text = await res.text();
      // 제출 Markdown 안의 raw HTML은 실행하지 않는다. Markdown 문법은 유지하면서
      // 태그만 문자로 바꿔, 모델 산출물이 블로그 origin의 DOM 권한을 얻지 못하게 한다.
      const safeMarkdown = text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
      if (window.marked) {
        contentEl.innerHTML = window.marked.parse(safeMarkdown);
        if (window.renderMathInElement) {
          window.renderMathInElement(contentEl, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\[', right: '\\]', display: true },
              { left: '\\(', right: '\\)', display: false }
            ],
            ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
            throwOnError: false,
            strict: false
          });
        }
      } else {
        contentEl.innerText = text;
      }
      return;
    }
  } catch (e) {
    // Local CORS fall-back
  }

  contentEl.innerHTML = `
    <div class="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs">
      <strong>[로컬 파일 안내]</strong><br>
      브라우저 보안(CORS)으로 인해 file:// 프로토콜에서는 마크다운 직접 fetch가 차단될 수 있습니다.<br>
      상단의 <strong>[전체화면 새 창 열기]</strong> 버튼을 클릭하시면 원본 문서를 브라우저에서 바로 열람하실 수 있습니다.
    </div>
  `;
}

// Artifact Modal
function previewArtifact(model, runId, relativePath, title) {
  const fullPath = `runs/${model}/${runId}/${relativePath}`;
  document.getElementById('modal-title').innerText = title;
  document.getElementById('modal-subtitle').innerText = fullPath;
  document.getElementById('modal-external-link').href = fullPath;
  document.getElementById('modal-iframe').src = fullPath;
  document.getElementById('preview-modal').classList.remove('hidden');
}

function closePreviewModal() {
  document.getElementById('preview-modal').classList.add('hidden');
  document.getElementById('modal-iframe').src = '';
}

// Navigation Concept Switcher
function switchConcept(conceptId) {
  state.currentView = conceptId;
  window.location.hash = conceptId;

  document.querySelectorAll('.concept-view').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById('view-' + conceptId);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.concept-tab').forEach(el => {
    el.className = 'concept-tab px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white';
  });
  const activeTab = document.getElementById('tab-' + conceptId);
  if (activeTab) {
    activeTab.className = 'concept-tab px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 bg-white text-indigo-600 shadow-xs dark:bg-indigo-600 dark:text-white';
  }
}

// Theme Handling
function setupTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    document.documentElement.classList.add('dark');
    updateThemeIcon(true);
  } else {
    document.documentElement.classList.remove('dark');
    updateThemeIcon(false);
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
  const icon = document.getElementById('theme-icon');
  if (icon) {
    icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
}

// Routing & Event Handlers
function setupRouting() {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'concept2' || hash === 'arena') {
    switchConcept('concept2');
  } else if (hash === 'concept3' || hash === 'inspector') {
    switchConcept('concept3');
  } else {
    switchConcept('concept1');
  }
}

function filterModels(query) {
  state.searchQuery = query;
  renderLeaderboard();
}

function filterCategory(cat) {
  state.selectedCategory = cat;
  document.querySelectorAll('.cat-filter-btn').forEach(btn => {
    btn.className = 'cat-filter-btn px-2.5 py-1 rounded-lg font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition';
  });
  if (event && event.target) {
    event.target.className = 'cat-filter-btn px-2.5 py-1 rounded-lg font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300';
  }
  renderLeaderboard();
}

function openInfoModal() {
  document.getElementById('info-modal').classList.remove('hidden');
}
function closeInfoModal() {
  document.getElementById('info-modal').classList.add('hidden');
}

// Bootstrap
window.addEventListener('DOMContentLoaded', initApp);
