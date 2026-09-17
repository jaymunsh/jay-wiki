# SEARCH-03 결과 보고서

- 과제 ID: SEARCH-03
- 상태: submitted
- 시작 시각: 2026-09-13T16:44:17.600479+00:00
- 종료 시각: 2026-09-13T16:45:14.856008+00:00
- 경과 시간: 약 55초 (한도 15분 이내 완료)
- 타이밍 출처: agent-observed (단조 시계 / Python datetime UTC)
- 토큰/비용/속도: 미측정 (not_exposed)

## 산출물
- `outputs/SEARCH-03/research.md`: Apple Silicon Mac 64GB 환경 대상 Ollama, llama.cpp, LM Studio 3자 심층 비교 보고서 (본문 3,469자, 2,000~3,500자 목표 준수, 비교표 및 조건별 추천 포함).
- `outputs/SEARCH-03/sources.json`: 3개 도구의 공식 저장소/문서 URL 및 인용 사실 매핑.

## 조사 기준 및 핵심 비교 내역
1. 기준일: 2026년 9월 14일 (KST).
2. 5대 공통 비교 항목:
   - 설치/운영 방식 (데몬/CLI vs 독립 바이너리 vs 데스크톱 GUI)
   - 지원 모델 형식 (GGUF 공통 지원, 자체 래핑 및 배포 차이)
   - 로컬 API 및 호환성 (OpenAI /v1/chat/completions 표준 제공, 포트 11434 vs 8080 vs 1234)
   - 툴 호출 조건 (네이티브 지원 vs Jinja 템플릿/Generic 핸들러 vs GUI 설정)
   - 오프라인 사용 조건 (사전 다운로드 후 100% 완전 오프라인 가능, llama.cpp의 무원격 통신 무결성)
3. 실측치 미포함 원칙 준수: 실제 특정 Mac 장비에서의 속도(t/s)나 전력, 비용을 자의적으로 날조하지 않고 미확인 사항으로 명시함.
