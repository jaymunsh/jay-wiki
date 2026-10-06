package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import cloud.leneu.jaywiki.blog.dto.BlogPageSize;
import cloud.leneu.jaywiki.blog.dto.BlogPostPageQuery;
import cloud.leneu.jaywiki.blog.dto.BlogPostSummaryDto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class BlogPersonalProjectOrderTest {

    @Autowired BlogPostService service;
    @Autowired BlogCategoryRepository categories;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;

    private void save(String slug, String category, String published, String updated, String status) {
        jdbc.update("""
                insert into public.tb_blog_post
                  (slug, title, body, category_id, status, published_at, updated_at)
                values (?, ?, '본문', ?, ?, ?, ?)
                """, slug, slug, categories.findBySlug(category).orElseThrow().getId(), status,
                OffsetDateTime.parse(published), OffsetDateTime.parse(updated));
    }

    private void save(String slug, String category, String published, String updated) {
        save(slug, category, published, updated, "published");
    }

    private List<String> page(String category, int number) {
        return service.page(new BlogPostPageQuery(category, null, number, BlogPageSize.TEN))
                .items().stream().map(BlogPostSummaryDto::slug).toList();
    }

    @Test
    void recentEditIsSortedBeforeNewerPublicationsBeforePagination() {
        for (int i = 0; i < 12; i++) {
            String date = OffsetDateTime.parse("2027-01-01T00:00:00Z").plusDays(i).toString();
            save("personal-" + i, "personal-projects", date, date);
        }
        save("edited-old", "personal-projects", "2026-01-01T00:00:00Z", "2027-02-01T00:00:00Z");
        save("hidden-edit", "personal-projects", "2026-01-01T00:00:00Z", "2028-01-01T00:00:00Z", "draft");
        save("other-category", "tech-lab", "2028-01-01T00:00:00Z", "2028-01-01T00:00:00Z");

        List<String> expected = Stream.concat(Stream.of("edited-old"),
                IntStream.rangeClosed(0, 11).mapToObj(i -> "personal-" + (11 - i))).toList();
        assertThat(page("personal-projects", 1)).containsExactlyElementsOf(expected.subList(0, 10));
        assertThat(page("personal-projects", 2)).containsExactlyElementsOf(expected.subList(10, 13));
        assertThat(service.byCategory("personal-projects")).extracting(BlogPostSummaryDto::slug)
                .containsExactlyElementsOf(expected);
        assertThat(service.page(new BlogPostPageQuery("personal-projects", null, 1, BlogPageSize.TEN)).total())
                .isEqualTo(13);
    }

    @Test
    void unchangedAndPublicationProcedureTimestampsUsePublicationDate() {
        save("unchanged", "personal-projects", "2027-03-10T00:00:00Z", "2027-03-10T00:00:00Z");
        save("procedure", "personal-projects", "2027-03-10T00:00:20Z", "2027-03-10T00:00:50Z");
        save("published-after-update", "personal-projects", "2027-03-10T00:00:30Z", "2026-01-01T00:00:00Z");
        save("real-edit", "personal-projects", "2027-03-09T23:59:45Z", "2027-03-10T00:00:45Z");

        assertThat(page("personal-projects", 1)).containsExactly(
                "real-edit", "published-after-update", "procedure", "unchanged");
    }

    @Test
    void equalEditDatesUsePublicationDateThenIdAndBothCategoryApisAgree() throws Exception {
        save("older-publication", "personal-projects", "2027-01-01T00:00:00Z", "2027-03-01T00:00:00Z");
        save("newer-publication", "personal-projects", "2027-02-01T00:00:00Z", "2027-03-01T00:00:00Z");
        save("same-publication-later-id", "personal-projects", "2027-02-01T00:00:00Z", "2027-03-01T00:00:00Z");

        List<String> expected = List.of("same-publication-later-id", "newer-publication", "older-publication");
        assertThat(page("personal-projects", 1)).containsExactlyElementsOf(expected);
        assertThat(service.byCategory("personal-projects")).extracting(BlogPostSummaryDto::slug)
                .containsExactlyElementsOf(expected);
        mvc.perform(get("/api/blog/posts/page").param("category", "personal-projects").param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].slug").value("same-publication-later-id"));
        mvc.perform(get("/api/blog/categories/personal-projects/posts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].slug").value("same-publication-later-id"));
    }

    @Test
    void otherCategoriesAndGlobalListKeepPublicationOrder() {
        save("lab-old-edited", "tech-lab", "2027-01-01T00:00:00Z", "2027-03-01T00:00:00Z");
        save("lab-new", "tech-lab", "2027-02-01T00:00:00Z", "2027-02-01T00:00:00Z");
        save("personal-old-edited", "personal-projects", "2027-01-01T00:00:00Z", "2027-03-01T00:00:00Z");
        save("personal-new", "personal-projects", "2027-02-01T00:00:00Z", "2027-02-01T00:00:00Z");

        assertThat(page("tech-lab", 1)).containsExactly("lab-new", "lab-old-edited");
        assertThat(service.byCategory("tech-lab")).extracting(BlogPostSummaryDto::slug)
                .containsExactly("lab-new", "lab-old-edited");
        assertThat(page(null, 1)).containsExactly("personal-new", "lab-new", "personal-old-edited", "lab-old-edited");
        assertThat(service.published()).extracting(BlogPostSummaryDto::slug)
                .containsExactly("personal-new", "lab-new", "personal-old-edited", "lab-old-edited");
    }
}
