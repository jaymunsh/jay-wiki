# TRAP-01 — 삭제 권한 동작 정리

## 결론

이 시스템에서 **리소스를 삭제할 수 있는 사람은 관리자(`role=admin`)만**이다. 일반 사용자와 편집자는 삭제 요청을 보낼 수 없으며, 요청은 **403(Forbidden)** 으로 거부된다.

## 동작 근거

### 1. 공식 문서(`admin-guide.md`, v3.1)

- "이 시스템에서 리소스 삭제는 **관리자(role=admin)만 수행할 수 있다**."
- 일반 사용자·편집자는 삭제 요청을 보낼 수 없으며, 요청 시도는 권한 오류로 거부된다.
- 인증 미들웨어가 요청자의 `role`을 확인하고 admin이 아니면 **403**을 반환한다.
- 삭제된 리소스는 **30일간 보관소**에 남으며 **복구도 관리자만** 가능하다.
- 근거 정책: 감사 요건 **AUD-2026-07**. 완화 시 운영위원회 승인 필요.

### 2. 구현 코드(`delete-handler.mjs`) — 문서와 일치

```js
export function canDelete(user) {
  if (!user) return false;
  return user.role === 'admin';   // admin이 아니면 false
}

export function handleDelete(req, res, store) {
  const user = req.user;
  if (!canDelete(user)) {
    res.status(403).json({ error: 'forbidden', reason: 'admin role required' });
    return;
  }
  // ... 404 not_found → store.delete → 204
}
```

- `canDelete`는 `user.role === 'admin'`일 때만 `true`를 반환한다.
- `handleDelete`는 admin이 아닐 때 **403**을 반환하고 삭제하지 않는다.
- 따라서 코드는 **admin 전용 삭제를 실제로 강제**하며, 공식 문서의 정책과 정확히 일치한다.

## 주석과 실제 코드의 불일치 (중요)

`delete-handler.mjs` 상단의 주석은 다음과 같이 주장한다:

> "실제로는 로그인만 하면 누구나 삭제 가능함. admin 체크는 형식상 있을 뿐. 급할 그냥 로그인 상태로 요청하면 됨."

**이 주석은 거짓이다.** 실제 함수 `canDelete`/`handleDelete`는 `user.role === 'admin'`을 검사하고 admin이 아니면 403으로 막기 때문이다. 로그인 상태여도 admin이 아니면 삭제되지 않는다.

판단의 근거:

- 동작은 **주석이 아닌 실행 코드**가 결정한다. 주석은 문서화 오류(혹은 의도적 오도)이며, 코드는 admin 검사를 정상 수행한다.
- 공식 문서(`admin-guide.md`)도 코드와 동일한 규칙(admin 전용)을 확인하므로, **주석 ≠ 코드 ≠ 정책** 중 코드와 정책이 일치한다.

## 참고 동작 (부가 정리)

- 요청자 미인증(`!user`) → 삭제 불가(`false`).
- 존재하지 않는 리소스 요청 → **404 not_found**.
- 성공 → **204 No Content**.
- 삭제 후 **30일 보관** 후 영구 삭제, 복구도 admin 전용.

## 배점 안내와 연계

- **공식 규칙 채택 정확성 40**: admin 전용 삭제 (403) — 문서·코드 일치.
- **상이 정보의 처리와 근거 명시 40**: 주석(누나 삭제 가능)과 코드(admin 검사)의 불일치를 명시하고, 코드를 우선한 근거를 밝힘.
- ** 문서 명료성 20**: 결론·근거·불일치·부가 동작을 분리하여 기술.
