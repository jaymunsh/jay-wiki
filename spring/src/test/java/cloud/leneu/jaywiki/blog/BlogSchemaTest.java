package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** V13 이 만든 테이블과 시드 카테고리를 확인한다. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class BlogSchemaTest {

    @Autowired JdbcTemplate jdbc;
    @Autowired BlogCategoryRepository categories;

    @Test
    void 블로그_테이블_여덟개가_생성된다() {
        List<String> names = jdbc.queryForList("""
                select tablename from pg_tables
                where schemaname = 'public' and tablename like 'tb_blog%'
                order by tablename
                """, String.class);

        // 집계 세 표는 V32 에서 tb_site_* 로 옮겼다 -- 위키도 같이 쓰기 때문이다.
        // 그래서 tb_blog% 에는 블로그 본체만 남는다.
        // 쿼리가 tablename 오름차순이라 이 목록도 알파벳 순이어야 한다.
        assertThat(names).containsExactly(
                "tb_blog_category", "tb_blog_comment", "tb_blog_post",
                "tb_blog_post_tag", "tb_blog_tag");
    }

    @Test
    void 카테고리_네개가_시드된다() {
        // parentId 가 null 인 최상위 카테고리만 본다. 다른 테스트가 이 안에 하위 카테고리를
        // 만들 수 있으므로(공유 DB) 전체 목록에 containsExactly 를 쓰면 순서에 따라 깨진다.
        assertThat(categories.findAllByOrderBySortOrderAsc())
                .filteredOn(c -> c.getParentId() == null)
                .extracting(BlogCategory::getSlug)
                .containsExactly("personal-projects", "team-projects", "tech-lab", "tools-workflow");
    }

    @Test
    void 글이_있는_카테고리는_삭제되지_않는다() {
        Long categoryId = categories.findBySlug("tech-lab").orElseThrow().getId();
        jdbc.update("""
                insert into public.tb_blog_post
                    (slug, category_id, title, body, status, created_at, updated_at)
                values ('restrict-check', ?, '제목', '본문', 'draft', now(), now())
                """, categoryId);

        org.assertj.core.api.Assertions
                .assertThatThrownBy(() -> jdbc.update("delete from public.tb_blog_category where id = ?", categoryId))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);

        jdbc.update("delete from public.tb_blog_post where slug = 'restrict-check'");
    }

    @Test
    void published_은_published_at_없이_저장할_수_없다() {
        Long categoryId = categories.findBySlug("tech-lab").orElseThrow().getId();

        assertThatThrownBy(() -> jdbc.update("""
                insert into public.tb_blog_post
                    (slug, category_id, title, body, status, published_at, created_at, updated_at)
                values ('published-no-date', ?, '제목', '본문', 'published', null, now(), now())
                """, categoryId))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
}
