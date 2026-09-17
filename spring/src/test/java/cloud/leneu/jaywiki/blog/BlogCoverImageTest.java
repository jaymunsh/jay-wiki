package cloud.leneu.jaywiki.blog;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class BlogCoverImageTest {

    @Test
    @DisplayName("지정한 대표 자산이 본문 첫 이미지를 이긴다")
    void coverAssetWins() {
        assertThat(BlogCoverImage.resolve("abc123", "![x](/assets/a.png)"))
                .isEqualTo("/api/wiki-assets/abc123");
    }

    @Test
    @DisplayName("대표 자산이 없으면 본문 첫 이미지를 쓴다")
    void fallsBackToFirstBodyImage() {
        String body = "한 문단.\n\n![대체텍스트](/assets/projects/a/first.png)\n\n![두번째](/assets/b.png)";
        assertThat(BlogCoverImage.resolve(null, body)).isEqualTo("/assets/projects/a/first.png");
    }

    @Test
    @DisplayName("제목 속성은 URL 에 섞이지 않는다")
    void stripsTitleAttribute() {
        String body = "![캡션](/assets/tall.png \"width=420 align=center\")";
        assertThat(BlogCoverImage.resolve(null, body)).isEqualTo("/assets/tall.png");
    }

    @Test
    @DisplayName("코드펜스 안의 이미지는 세지 않는다")
    void ignoresImagesInsideCodeFence() {
        String body = "```md\n![예제](/assets/example.png)\n```\n\n![진짜](/assets/real.png)";
        assertThat(BlogCoverImage.resolve(null, body)).isEqualTo("/assets/real.png");
    }

    @Test
    @DisplayName("인라인 코드 안의 이미지는 세지 않는다")
    void ignoresImagesInsideInlineCode() {
        String body = "초안마다 `![...](/assets/...)` 참조를 찾는다.\n\n![진짜](/assets/real.png)";
        assertThat(BlogCoverImage.resolve(null, body)).isEqualTo("/assets/real.png");
    }

    @Test
    @DisplayName("인라인 코드가 유일한 이미지면 대표 이미지가 없다")
    void nullWhenOnlyInlineCodeImage() {
        assertThat(BlogCoverImage.resolve(null, "`![...](/assets/...)` 만 있다.")).isNull();
    }

    @Test
    @DisplayName("이미지가 없으면 null")
    void nullWhenNoImage() {
        assertThat(BlogCoverImage.resolve(null, "그냥 글이다.")).isNull();
        assertThat(BlogCoverImage.resolve("  ", null)).isNull();
    }
}
