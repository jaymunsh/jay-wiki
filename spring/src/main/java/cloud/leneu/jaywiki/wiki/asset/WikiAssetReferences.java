package cloud.leneu.jaywiki.wiki.asset;

import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public final class WikiAssetReferences {
    private static final Pattern ASSET_PATH = Pattern.compile("/api/wiki-assets/([0-9a-f-]{36})");

    private WikiAssetReferences() {
    }

    public static Set<String> ids(String markdown) {
        if (markdown == null || markdown.isBlank()) return Set.of();
        return ASSET_PATH.matcher(markdown).results()
                .map(result -> result.group())
                .map(path -> path.substring(path.lastIndexOf('/') + 1))
                .collect(Collectors.toUnmodifiableSet());
    }

    public static String path(String assetId) {
        return "/api/wiki-assets/" + assetId;
    }
}
