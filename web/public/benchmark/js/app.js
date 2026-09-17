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
  inspector: {
    model: 'gemini-3.8-flash',
    runId: '20260913T163700Z-g38f',
    file: 'outputs/GAME-01/index.html',
    type: 'HTML',
    title: 'GAME-01: Tetris'
  }
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
    const res = await fetch('data/catalog.json?v=20260915-1', { cache: 'no-store' });
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
          <span class="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-bold">
            ${m.totalTasks} / ${m.totalTasks} Submitted
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

  const options = state.catalog.models.map(m => {
    const val = `${m.modelSlug}/${m.runId}`;
    return `<option value="${val}">${m.modelSlug} (${m.runId.slice(-4)})</option>`;
  }).join('');

  selectA.innerHTML = options;
  selectB.innerHTML = options;

  selectA.value = state.arena.modelA;
  if (state.catalog.models[1]) {
    selectB.value = `${state.catalog.models[1].modelSlug}/${state.catalog.models[1].runId}`;
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

  const isMarkdown = state.arena.task.endsWith('.md');
  const renderFrame = (iframe, sourcePath) => {
    if (!iframe) return;
    if (!isMarkdown) {
      iframe.removeAttribute('sandbox');
      iframe.src = sourcePath;
      return;
    }
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    iframe.src = `markdown-viewer.html?source=${encodeURIComponent(sourcePath)}`;
  };

  if (extA) extA.href = pathA;
  if (extB) extB.href = pathB;

  // Update Spec Checklist
  renderSpecChecklist(state.arena.task);
  renderFrame(iframeA, pathA);
  renderFrame(iframeB, pathB);
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
  const { model, runId, file, type, title } = state.inspector;
  const fullPath = `runs/${model}/${runId}/${file}`;

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

  if (titleEl) titleEl.innerText = `${title} (${model})`;
  if (pathEl) pathEl.innerText = fullPath;
  if (newtabBtn) newtabBtn.href = fullPath;

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
    'THINK-01': ['summary.md', 'MEMO', '메모']
  };
  const primary = primaryByTask[taskId];
  const taskMeta = state.catalog?.taskMeta?.[taskId] ||
    state.catalog?.models?.find(item => item.modelSlug === model && item.runId === runId)?.tasks?.[taskId]?.meta;
  if (taskBrief) {
    taskBrief.classList.toggle('hidden', !taskMeta?.brief);
    taskBrief.textContent = taskMeta?.brief ? `수행 과제 · ${taskMeta.brief}` : '';
  }
  if (artifactSwitcher) {
    artifactSwitcher.replaceChildren();
    artifactSwitcher.classList.toggle('hidden', !primary);
    artifactSwitcher.classList.toggle('flex', Boolean(primary));
    if (primary) {
      const choices = [
        { file: primary[0], type: primary[1], label: primary[2] },
        { file: 'RESULT.md', type: 'MD', label: '수행 결과' }
      ];
      choices.forEach((choice) => {
        const choicePath = `outputs/${taskId}/${choice.file}`;
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
        MD: 'REPORT MD'
      };
      typeBadge.innerText = markdownLabels[type] || 'DOCUMENT MD';
      typeBadge.className = 'px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-bold text-[10px]';
    }
    if (noteTitle && noteDescription) {
      if (type === 'MD') {
        noteTitle.innerText = '수행 결과 보고서';
        noteDescription.innerText = '제출자가 기록한 수행 과정과 산출물 요약입니다. 실제 답안 및 최종 채점 결과와 구분해서 읽어주세요.';
      } else {
        noteTitle.innerText = '응시자 원문 산출물';
        noteDescription.innerText = '해당 과제에서 응시자가 작성한 실제 답안입니다. 상단 선택기에서 수행 결과 보고서로 전환할 수 있습니다.';
      }
    }
    if (frame) frame.classList.add('hidden');
    if (mdView) {
      mdView.classList.remove('hidden');
      loadMarkdownContent(fullPath);
    }
  }
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
