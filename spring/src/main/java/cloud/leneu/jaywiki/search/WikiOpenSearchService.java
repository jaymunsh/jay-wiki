package cloud.leneu.jaywiki.search;

import cloud.leneu.jaywiki.wiki.WikiArticle;
import cloud.leneu.jaywiki.wiki.WikiArticleRepository;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class WikiOpenSearchService {
    private static final int SEARCH_LIMIT = 30;
    private static final int REINDEX_PAGE_SIZE = 500;

    private final OpenSearchProperties props;
    private final WikiArticleRepository articles;
    private final OpenSearchGateway os;

    public SearchResult search(String query) {
        if (!props.enabled()) {
            return SearchResult.unavailable();
        }
        try {
            ensureIndex();
            JsonNode root = os.sendJson("POST", "/" + props.wikiIndex() + "/_search", searchBody(query));
            List<SearchHit> hits = new ArrayList<>();
            for (JsonNode hit : root.path("hits").path("hits")) {
                JsonNode source = hit.path("_source");
                hits.add(new SearchHit(
                        source.path("slug").asText(),
                        source.path("parentId").asText(),
                        source.path("title").asText(),
                        source.path("summary").asText(null),
                        source.path("kind").asText()));
            }
            return new SearchResult(List.copyOf(hits), true);
        } catch (RuntimeException e) {
            log.warn("wiki OpenSearch query failed; falling back to PostgreSQL: {}", e.getMessage());
            return SearchResult.unavailable();
        }
    }

    public ReindexResult reindex() {
        if (!props.enabled()) {
            throw new IllegalStateException("OpenSearch is disabled");
        }
        ensureIndex();
        int pageNumber = 0;
        long indexed = 0;
        Page<WikiArticle> page;
        do {
            page = articles.findAll(PageRequest.of(pageNumber, REINDEX_PAGE_SIZE, Sort.by("slug").ascending()));
            for (WikiArticle article : page.getContent()) {
                index(article);
                indexed++;
            }
            pageNumber++;
        } while (page.hasNext());
        os.sendJson("POST", "/" + props.wikiIndex() + "/_refresh", "");
        return new ReindexResult(props.wikiIndex(), indexed);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void synchronize(ArticleIndexEvent event) {
        if (!props.enabled()) {
            return;
        }
        try {
            if (event.action() == ArticleIndexEvent.Action.DELETE) {
                os.sendJson("DELETE", "/" + props.wikiIndex() + "/_doc/" + event.slug(), "");
                return;
            }
            articles.findById(event.slug()).ifPresent(this::index);
        } catch (RuntimeException e) {
            log.warn("wiki OpenSearch sync failed for {}: {}", event.slug(), e.getMessage());
        }
    }

    private void index(WikiArticle article) {
        ensureIndex();
        os.sendJson("PUT", "/" + props.wikiIndex() + "/_doc/" + article.getSlug(), os.toJson(Map.of(
                "slug", article.getSlug(),
                "parentId", article.getParentId(),
                "title", article.getTitle(),
                "summary", article.getSummary() == null ? "" : article.getSummary(),
                "body", article.getBody(),
                "kind", article.getKind(),
                "status", article.getStatus(),
                "tags", article.getTags() == null ? "" : article.getTags(),
                "updatedAt", article.getUpdatedAt().toString())));
    }

    private void ensureIndex() {
        os.ensureIndex(props.wikiIndex(), indexBody());
    }

    private String searchBody(String query) {
        return os.toJson(Map.of(
                "size", SEARCH_LIMIT,
                "_source", List.of("slug", "parentId", "title", "summary", "kind"),
                "query", Map.of("bool", Map.of(
                        "filter", List.of(Map.of("term", Map.of("status", "published"))),
                        "must", List.of(Map.of("multi_match", Map.of(
                                "query", query,
                                "fields", List.of("title^3", "summary^2", "tags^2", "body"))))))));
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
                      "slug": { "type": "keyword" },
                      "parentId": { "type": "keyword" },
                      "title": { "type": "text", "analyzer": "korean_nori" },
                      "summary": { "type": "text", "analyzer": "korean_nori" },
                      "body": { "type": "text", "analyzer": "korean_nori" },
                      "kind": { "type": "keyword" },
                      "status": { "type": "keyword" },
                      "tags": { "type": "text", "analyzer": "korean_nori" },
                      "updatedAt": { "type": "date" }
                    }
                  }
                }
                """;
    }

    public record SearchResult(List<SearchHit> hits, boolean available) {
        private static SearchResult unavailable() {
            return new SearchResult(List.of(), false);
        }
    }

    public record ReindexResult(String index, long indexed) {
    }
}
