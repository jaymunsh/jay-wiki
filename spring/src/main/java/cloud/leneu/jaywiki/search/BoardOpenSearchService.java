package cloud.leneu.jaywiki.search;

import cloud.leneu.jaywiki.board.CommunityPost;
import cloud.leneu.jaywiki.board.CommunityPostRepository;
import cloud.leneu.jaywiki.board.dto.SearchCompareResult;
import cloud.leneu.jaywiki.board.dto.SearchHitDto;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class BoardOpenSearchService {

    private static final int SEARCH_LIMIT = 20;
    private static final int SUGGEST_LIMIT = 8;
    private static final int REINDEX_PAGE_SIZE = 1_000;

    private final OpenSearchProperties props;
    private final CommunityPostRepository postRepo;
    private final OpenSearchGateway os;

    public SearchCompareResult.MethodResult search(String query) {
        if (!props.enabled()) {
            return unavailable(0.0, "OpenSearch 비활성화 · APP_OPENSEARCH_ENABLED=false");
        }

        long t0 = System.nanoTime();
        try {
            ensureIndex();
            JsonNode root = os.sendJson("POST", "/" + props.boardIndex() + "/_search", searchBody(query));
            List<SearchHitDto> hits = parseHits(root);
            return new SearchCompareResult.MethodResult(
                    "OpenSearch+nori",
                    "역색인 · 한글 형태소 분석 · highlight",
                    elapsed(t0),
                    hits.size(),
                    hits
            );
        } catch (RuntimeException e) {
            return unavailable(elapsed(t0), "OpenSearch 사용 불가 · " + e.getMessage());
        }
    }

    public List<String> suggest(String query) {
        if (!props.enabled() || query == null || query.isBlank()) {
            return List.of();
        }
        try {
            ensureIndex();
            JsonNode root = os.sendJson("POST", "/" + props.boardIndex() + "/_search", suggestBody(query));
            LinkedHashSet<String> titles = new LinkedHashSet<>();
            for (JsonNode hit : root.path("hits").path("hits")) {
                String title = hit.path("_source").path("title").asText("");
                if (!title.isBlank()) {
                    titles.add(title);
                }
            }
            return List.copyOf(titles);
        } catch (RuntimeException e) {
            return List.of();
        }
    }

    public ReindexResult reindex() {
        if (!props.enabled()) {
            throw new IllegalStateException("OpenSearch is disabled");
        }
        ensureIndex();
        int pageNo = 0;
        long indexed = 0;
        Page<CommunityPost> page;
        do {
            page = postRepo.findAll(PageRequest.of(pageNo, REINDEX_PAGE_SIZE, Sort.by("id").ascending()));
            if (page.hasContent()) {
                bulkIndex(page.getContent());
                indexed += page.getNumberOfElements();
            }
            pageNo++;
        } while (page.hasNext());
        os.sendJson("POST", "/" + props.boardIndex() + "/_refresh", "");
        return new ReindexResult(props.boardIndex(), indexed);
    }

    private void ensureIndex() {
        os.ensureIndex(props.boardIndex(), indexBody());
    }

    private void bulkIndex(List<CommunityPost> posts) {
        StringBuilder ndjson = new StringBuilder(posts.size() * 256);
        for (CommunityPost post : posts) {
            ndjson.append("{\"index\":{\"_id\":\"").append(post.getId()).append("\"}}\n");
            ndjson.append(os.toJson(Map.of(
                    "id", post.getId(),
                    "title", post.getTitle(),
                    "content", post.getContent(),
                    "authorType", post.getAuthorType(),
                    "authorName", post.getAuthorName(),
                    "views", post.getViews(),
                    "commentCount", post.getCommentCount(),
                    "createdAt", post.getCreatedAt().toString()
            ))).append('\n');
        }
        JsonNode root = os.sendJson("POST", "/" + props.boardIndex() + "/_bulk", ndjson.toString());
        if (root.path("errors").asBoolean(false)) {
            throw new IllegalStateException("bulk index reported item errors");
        }
    }

    private List<SearchHitDto> parseHits(JsonNode root) {
        List<SearchHitDto> hits = new ArrayList<>();
        for (JsonNode hit : root.path("hits").path("hits")) {
            JsonNode source = hit.path("_source");
            JsonNode highlight = hit.path("highlight");
            hits.add(new SearchHitDto(
                    source.path("id").asLong(),
                    firstHighlight(highlight.path("title"), source.path("title").asText()),
                    source.path("authorName").asText(),
                    source.path("authorType").asText(),
                    source.path("views").asInt(),
                    source.path("commentCount").asInt(),
                    OffsetDateTime.parse(source.path("createdAt").asText()),
                    firstHighlight(highlight.path("content"), "")
            ));
        }
        return hits;
    }

    private String searchBody(String query) {
        return os.toJson(Map.of(
                "size", SEARCH_LIMIT,
                "_source", List.of("id", "title", "authorType", "authorName", "views", "commentCount", "createdAt"),
                "query", Map.of(
                        "multi_match", Map.of(
                                "query", query,
                                "fields", List.of("title^2", "content")
                        )
                ),
                "highlight", Map.of(
                        "pre_tags", List.of("[["),
                        "post_tags", List.of("]]"),
                        "fields", Map.of(
                                "title", Map.of("number_of_fragments", 0),
                                "content", Map.of("fragment_size", 90, "number_of_fragments", 1)
                        )
                )
        ));
    }

    private String suggestBody(String query) {
        return os.toJson(Map.of(
                "size", SUGGEST_LIMIT,
                "_source", List.of("title"),
                "query", Map.of(
                        "match_phrase_prefix", Map.of(
                                "title", Map.of("query", query, "max_expansions", 20)
                        )
                )
        ));
    }

    private String indexBody() {
        return """
                {
                  "settings": {
                    "index": { "number_of_shards": 1, "number_of_replicas": 0 },
                    "analysis": {
                      "analyzer": {
                        "korean_nori": {
                          "type": "custom",
                          "tokenizer": "nori_tokenizer",
                          "filter": ["lowercase", "nori_part_of_speech"]
                        }
                      }
                    }
                  },
                  "mappings": {
                    "properties": {
                      "id": { "type": "long" },
                      "title": { "type": "text", "analyzer": "korean_nori" },
                      "content": { "type": "text", "analyzer": "korean_nori" },
                      "authorType": { "type": "keyword" },
                      "authorName": { "type": "keyword" },
                      "views": { "type": "integer" },
                      "commentCount": { "type": "integer" },
                      "createdAt": { "type": "date" }
                    }
                  }
                }
                """;
    }

    private static String firstHighlight(JsonNode values, String fallback) {
        if (values.isArray() && values.size() > 0) {
            return values.get(0).asText(fallback);
        }
        return fallback;
    }

    private static SearchCompareResult.MethodResult unavailable(double elapsedMs, String note) {
        return new SearchCompareResult.MethodResult("OpenSearch+nori", note, elapsedMs, 0, List.of());
    }

    private static double elapsed(long t0) {
        return Math.round((System.nanoTime() - t0) / 1_000_000.0 * 100) / 100.0;
    }

    public record ReindexResult(String index, long indexed) {
    }
}
