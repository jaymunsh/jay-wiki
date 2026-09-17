package cloud.leneu.jaywiki.blog.dto;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 글 저장 요청. publishedAt 은 비워 보낼 수 있다 —
 * status 가 published 인데 비어 있으면 서버가 지금 시각을 넣는다.
 * V13 의 chk_blog_post_published_at 이 published + null 을 막기 때문이다.
 */
public record BlogPostSaveRequest(
        String slug,
        String title,
        String summary,
        String body,
        Long categoryId,
        String coverAssetId,
        String status,
        OffsetDateTime publishedAt,
        Boolean tocEnabled,   // null 이면 기본값(켜짐)을 유지한다
        List<String> tags,
        // 시리즈 연결. 여기서 null 은 '연결 없음'이다 -- 관리 화면은 항상 전체 폼을 보낸다.
        // 필드를 아예 안 쓰는 호출부(내부 콘텐츠 싱크)는 BlogContentSyncService 가 현재 값을 채워 준다.
        Long prevPostId,
        Long nextPostId,
        // 수정일. 로컬에서 글을 고친 시각을 그대로 운영까지 들고 간다.
        // 안 보내면 서버가 지금 시각을 박는데, 그러면 운영의 수정일이 '배포가 돈 시각'이 되어
        // 실제 작업 시각과 어긋난다(2026-09-01 에 15편이 그랬다).
        OffsetDateTime updatedAt
) {
}
