package cloud.leneu.jaywiki.wiki.asset;

import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class WikiAssetReferencesTest {

    @Test
    void extractsUniqueAssetIdsFromMarkdownImagesAndLinks() {
        String first = "1d21c16a-0a45-4bdd-a529-c180679014e0";
        String second = "662852d1-6d7f-4f3a-b069-4f898df6028a";
        String markdown = "![구성](/api/wiki-assets/" + first + ")\n"
                + "[원본](/api/wiki-assets/" + second + ")\n"
                + "![중복](/api/wiki-assets/" + first + ")";

        assertThat(WikiAssetReferences.ids(markdown)).isEqualTo(Set.of(first, second));
    }

    @Test
    void ignoresExternalAndMalformedPaths() {
        String markdown = "![외부](https://example.com/image.png)\n"
                + "![잘못된 ID](/api/wiki-assets/not-an-id)";

        assertThat(WikiAssetReferences.ids(markdown)).isEmpty();
    }
}
