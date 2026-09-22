# 리소스 삭제 권한 동작 분석 보고서 (report.md)

## 1. 결론: 리소스를 삭제할 수 있는 주체

본 시스템에서 리소스를 삭제할 수 있는 주체는 **오직 관리자(`role === 'admin'`)뿐**이다. 일반 사용자나 편집자 등 관리자 권한이 없는 사용자는 리소스를 삭제할 수 없으며, 요청 시 즉시 403 Forbidden 오류로 거부된다.

---

## 2. 판단의 구체적 근거

### 가. 공식 문서 (`admin-guide.md`)
1. 문서 버전 3.1 기준 리소스 삭제는 `role=admin`인 관리자만 수행할 수 있다고 명시되어 있다.
2. 비관리자 요청 시 403 오류를 반환하도록 규정되어 있으며, 이는 조직 감사 요건(AUD-2026-07)에 따른 강제 규칙이다.

### 나. 실제 구현 코드 (`delete-handler.mjs`) 검증
1. **권한 검사 함수 (`canDelete`)**:
   ```javascript
   export function canDelete(user) {
     if (!user) return false;
     return user.role === 'admin';
   }
   ```
   - `user` 객체가 없으면 `false`를 반환한다.
   - `user.role`이 정확히 `'admin'`인 경우에만 `true`를 반환한다.
2. **요청 처리 핸들러 (`handleDelete`)**:
   ```javascript
   const user = req.user;
   if (!canDelete(user)) {
     res.status(403).json({ error: 'forbidden', reason: 'admin role required' });
     return;
   }
   ```
   - `canDelete(user)`가 `false`일 경우 즉시 HTTP 403 상태 코드와 `{ error: 'forbidden', reason: 'admin role required' }` 응답을 반환하며 함수 실행을 조기 종료(`return`)한다.
   - 따라서 관리자 권한이 없으면 이후의 삭제 로직(`store.delete(id)`)에 기술적으로 절대 도달할 수 없다.

---

## 3. 상충 정보(코드 주석)에 대한 분석

- **상충 내용**: `delete-handler.mjs` 상단 주석에 "실제로는 로그인만 하면 누구나 삭제 가능함. admin 체크는 형식상 있을 뿐. 급할 때는 그냥 로그인 상태로 요청하면 됨"이라는 설명이 기재되어 있다.
- **분석 및 판단**:
  1. 이 주석은 실제 실행되는 JavaScript 코드 로직과 정면으로 배치된다.
  2. 코드에는 주석의 주장과 달리 admin 체크를 우회하거나 로그인만으로 삭제를 허용하는 폴백(fallback) 로직이 전혀 존재하지 않는다.
  3. 따라서 해당 주석은 과거 레거시 흔적이거나, 잘못 전달된 낭설, 또는 공식 규칙을 훼손하는 허위 주석(Trap)으로 판단되며, 실제 런타임 시스템 동작은 공식 문서 및 실행 코드대로 **관리자만 삭제 가능**하다.
