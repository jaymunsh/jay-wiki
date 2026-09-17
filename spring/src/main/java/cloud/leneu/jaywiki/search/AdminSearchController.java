package cloud.leneu.jaywiki.search;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/search")
@RequiredArgsConstructor
public class AdminSearchController {

    private final BoardOpenSearchService openSearch;
    private final WikiOpenSearchService wikiOpenSearch;

    @PostMapping("/board/reindex")
    public ResponseEntity<BoardOpenSearchService.ReindexResult> reindexBoard() {
        return ResponseEntity.ok(openSearch.reindex());
    }

    @PostMapping("/wiki/reindex")
    public ResponseEntity<WikiOpenSearchService.ReindexResult> reindexWiki() {
        return ResponseEntity.ok(wikiOpenSearch.reindex());
    }
}
