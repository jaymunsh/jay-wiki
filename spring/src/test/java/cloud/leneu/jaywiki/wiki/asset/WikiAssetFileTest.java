package cloud.leneu.jaywiki.wiki.asset;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WikiAssetFileTest {

    @Test
    void acceptsPngWhenDeclaredTypeAndSignatureMatch() {
        byte[] png = new byte[] {
                (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01
        };

        WikiAssetFile file = WikiAssetFile.parse("architecture.png", "image/png", png);

        assertThat(file.contentType()).isEqualTo("image/png");
        assertThat(file.extension()).isEqualTo("png");
        assertThat(file.checksumSha256()).hasSize(64);
    }

    @Test
    void rejectsFileWhenDeclaredTypeDoesNotMatchSignature() {
        byte[] gif = "GIF89a-content".getBytes();

        assertThatThrownBy(() -> WikiAssetFile.parse("fake.png", "image/png", gif))
                .isInstanceOf(InvalidWikiAssetException.class)
                .hasMessageContaining("signature");
    }

    @Test
    void rejectsSvgEvenWhenBrowserDeclaresImageMime() {
        byte[] svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>".getBytes();

        assertThatThrownBy(() -> WikiAssetFile.parse("diagram.svg", "image/svg+xml", svg))
                .isInstanceOf(InvalidWikiAssetException.class)
                .hasMessageContaining("지원하지 않는 이미지 형식");
    }

    @Test
    void rejectsFileLargerThanTenMegabytes() {
        byte[] tooLarge = new byte[10 * 1024 * 1024 + 1];
        tooLarge[0] = (byte) 0x89;
        tooLarge[1] = 0x50;
        tooLarge[2] = 0x4e;
        tooLarge[3] = 0x47;
        tooLarge[4] = 0x0d;
        tooLarge[5] = 0x0a;
        tooLarge[6] = 0x1a;
        tooLarge[7] = 0x0a;

        assertThatThrownBy(() -> WikiAssetFile.parse("large.png", "image/png", tooLarge))
                .isInstanceOf(InvalidWikiAssetException.class)
                .hasMessageContaining("10MB");
    }
}
