-- 글 slug 에 유니크 제약이 없었다. 화면은 /{id}/{slug} 라 id 로 찾으니 안 깨지지만,
-- 초안 발행 스크립트(scripts/publish-blog-drafts.mjs)가 slug 로 기존 글을 찾는다.
-- 같은 slug 가 둘이면 어느 쪽을 덮을지가 목록 순서에 달린다.
--
-- 중복이 있으면 이 마이그레이션이 실패하고 배포가 멈춘다. 그게 맞다 —
-- 조용히 넘어가면 어느 글이 사라졌는지 나중에 알 수 없다.
CREATE UNIQUE INDEX idx_blog_post_slug ON tb_blog_post (slug);
