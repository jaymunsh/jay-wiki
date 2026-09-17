# 공개 저장소 배포 안내

이 저장소는 애플리케이션 소스의 정본과 CI를 담당한다. `main`에 반영된 commit은
`.github/workflows/release.yml`에서 검사하고, 전체 commit SHA가 붙은 컨테이너 이미지로 GHCR에
보관한다. public 저장소의 workflow는 miniPC나 k3s에 접근하지 않는다.

```text
public jay-wiki main
  → GitHub-hosted runner에서 검사
  → 전체 SHA로 이미지 빌드
  → GHCR에 보관
  → 종료
```

운영 반영은 별도 private ops 저장소가 맡는다. private workflow는 승인한 SHA가 public `main`에
포함됐는지, 해당 빌드가 성공했는지, 같은 SHA의 이미지가 존재하는지 확인한 다음 private
self-hosted runner에 작업을 전달한다. 운영 자격증명, runner 등록과 복구 절차는 이 저장소에 두지
않는다.

## 공개 저장소에서 확인할 것

1. 변경은 pull request로 `main`에 반영한다.
2. CI와 Security workflow가 성공했는지 확인한다.
3. `Build release images`가 같은 commit SHA의 이미지 여섯 개를 만들었는지 확인한다.
4. 운영 반영이 필요하면 해당 전체 SHA를 private 운영 담당자에게 전달한다.

GitHub에서 읽기 쉬운 `main` 태그도 만들지만 운영 배포의 식별자로 사용하지 않는다. 운영은 항상
40자리 전체 SHA를 사용한다.

## 글 반영과 애플리케이션 배포

블로그 글은 애플리케이션 배포와 별도의 콘텐츠 발행 절차를 사용한다. 위키 기준 콘텐츠는 source
repository에서 검토하지만 운영 DB 반영은 private ops의 배포·백업 경계 안에서 수행한다.

공개 저장소의 workflow에 private 저장소 호출 token, SSH key, kubeconfig 또는 self-hosted runner
label을 추가하지 않는다. 운영 절차를 변경해야 한다면 private ops에서 별도로 검토한다.
