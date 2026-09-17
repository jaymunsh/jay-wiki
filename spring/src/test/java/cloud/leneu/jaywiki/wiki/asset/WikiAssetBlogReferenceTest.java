package cloud.leneu.jaywiki.wiki.asset;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import cloud.leneu.jaywiki.blog.BlogCategoryRepository;
import cloud.leneu.jaywiki.blog.BlogPost;
import cloud.leneu.jaywiki.blog.BlogPostRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/** 블로그 본문 또는 커버 이미지가 참조하는 자산은 지워지면 안 된다. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class WikiAssetBlogReferenceTest {

    @Autowired BlogPostRepository posts;
    @Autowired BlogCategoryRepository categories;
    @Autowired WikiAssetService assets;

    @AfterEach
    void 정리() {
        posts.deleteAll();
    }

    @Test
    void 블로그_본문이_참조하는_자산은_사용중으로_본다() {
        String assetId = "11111111-2222-3333-4444-555555555555";

        BlogPost post = new BlogPost();
        post.setSlug("with-image");
        post.setCategoryId(categories.findBySlug("tech-lab").orElseThrow().getId());
        post.setTitle("이미지 있는 글");
        post.setBody("![구성도](" + WikiAssetReferences.path(assetId) + ")");
        post.setStatus("published");
        post.setPublishedAt(OffsetDateTime.parse("2026-08-01T00:00:00Z"));
        post.setCreatedAt(OffsetDateTime.now());
        post.setUpdatedAt(OffsetDateTime.now());
        posts.save(post);

        assertThat(assets.isReferencedAnywhere(assetId)).isTrue();

        posts.delete(post);
        assertThat(assets.isReferencedAnywhere(assetId)).isFalse();
    }

    @Test
    void 블로그_커버이미지로_쓰이는_자산은_사용중으로_본다() {
        String assetId = "66666666-7777-8888-9999-000000000000";

        BlogPost post = new BlogPost();
        post.setSlug("with-cover");
        post.setCategoryId(categories.findBySlug("tech-lab").orElseThrow().getId());
        post.setTitle("커버 있는 글");
        post.setBody("본문에는 이미지가 없다.");
        post.setCoverAssetId(assetId);
        post.setStatus("published");
        post.setPublishedAt(OffsetDateTime.parse("2026-08-01T00:00:00Z"));
        post.setCreatedAt(OffsetDateTime.now());
        post.setUpdatedAt(OffsetDateTime.now());
        posts.save(post);

        assertThat(assets.isReferencedAnywhere(assetId)).isTrue();

        posts.delete(post);
        assertThat(assets.isReferencedAnywhere(assetId)).isFalse();
    }
}
