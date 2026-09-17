# REASON-KO-01 결과 보고서

- 과제 ID: REASON-KO-01
- 문제 버전: 1
- 상태: submitted
- 타이밍 출처: agent-observed (benchmark.py harness)
- 토큰/비용/속도: 미측정 (not_exposed)

## 수행 내용
1. 가상 자료실 운영 안내 지문([P1]~[P4])을 순수 언어 모델의 추론 능력만으로 정밀 독해.
2. 외부 검색, 계산기, 파이썬 코드 기반 자동 판정을 일절 사용하지 않고 지문의 문맥과 사실관계에만 기반하여 5개 문항(K1~K5) 판정 수행:
   - K1: `supported` (P1)
   - K2: `contradicted` (P2)
   - K3: `contradicted` (P2)
   - K4: `not_established` (P3)
   - K5: `contradicted` (P4)
3. `answers.json` 및 각 판정의 근거와 사실에 반하는 주장/아직 정해지지 않은 주장의 구분을 서술한 `explanation.md` 작성 완료.

## 도구 사용 및 한계
- 사용한 도구: 산출물 저장을 위한 로컬 파일 쓰기 명령만 수행 (문제 풀이에 코딩/계산 도구 미사용 규칙 준수).
- 독립 채점: 자체 점수는 매기지 않으며, 평가자의 채점을 위해 미채점으로 보존함.
