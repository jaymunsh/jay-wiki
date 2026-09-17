package cloud.leneu.jaywiki.wiki.sync;

import cloud.leneu.jaywiki.wiki.ArticleService;
import cloud.leneu.jaywiki.wiki.TabService;
import cloud.leneu.jaywiki.wiki.WikiFeaturedService;
import cloud.leneu.jaywiki.wiki.WikiArticle;
import cloud.leneu.jaywiki.wiki.WikiTab;
import cloud.leneu.jaywiki.wiki.dto.ArticleSaveRequest;
import cloud.leneu.jaywiki.wiki.dto.TabSaveRequest;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class WikiContentSyncControllerTest {

    private final TabService tabs = mock(TabService.class);
    private final ArticleService articles = mock(ArticleService.class);
    private final WikiFeaturedService featured = mock(WikiFeaturedService.class);

    @Test
    void reportsReadyWhenMachineTokenMatches() {
        var controller = new WikiContentSyncController(new ContentSyncAuthorizer("expected-token"), tabs, articles, featured);

        var response = controller.ready("expected-token");

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verifyNoInteractions(articles, tabs, featured);
    }

    @Test
    void ignoresLegacySecretTrailingNewline() {
        var controller = new WikiContentSyncController(new ContentSyncAuthorizer("expected-token\n"), tabs, articles, featured);

        var response = controller.ready("expected-token");

        assertThat(response.getStatusCode().value()).isEqualTo(204);
    }

    @Test
    void savesArticleWhenMachineTokenMatches() {
        var controller = new WikiContentSyncController(new ContentSyncAuthorizer("expected-token"), tabs, articles, featured);
        var request = articleRequest();
        var article = new WikiArticle();
        article.setSlug(request.slug());
        when(articles.save(request)).thenReturn(article);

        var response = controller.saveArticle("expected-token", request);

        org.assertj.core.api.Assertions.assertThat(response.slug()).isEqualTo(request.slug());
        verify(articles).save(request);
    }

    @Test
    void savesTabWhenMachineTokenMatches() {
        var controller = new WikiContentSyncController(new ContentSyncAuthorizer("expected-token"), tabs, articles, featured);
        var request = new TabSaveRequest("operations", "운영", 6);
        var tab = new WikiTab();
        tab.setTabId(request.tabId());
        tab.setTitle(request.title());
        tab.setSortOrder(request.sortOrder());
        when(tabs.save(request)).thenReturn(tab);

        var response = controller.saveTab("expected-token", request);

        org.assertj.core.api.Assertions.assertThat(response.tabId()).isEqualTo(request.tabId());
        verify(tabs).save(request);
    }

    @Test
    void deletesTabWhenMachineTokenMatches() {
        var controller = new WikiContentSyncController(new ContentSyncAuthorizer("expected-token"), tabs, articles, featured);

        var response = controller.deleteTab("expected-token", "governance");

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(tabs).delete("governance");
    }

    @Test
    void refusesToDeleteTabThatStillHasArticles() {
        var controller = new WikiContentSyncController(new ContentSyncAuthorizer("expected-token"), tabs, articles, featured);
        doThrow(new IllegalStateException("문서가 3개 있는 탭은 삭제할 수 없습니다."))
                .when(tabs).delete("operations");

        assertThatThrownBy(() -> controller.deleteTab("expected-token", "operations"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void hidesDeleteEndpointWhenMachineTokenDoesNotMatch() {
        var controller = new WikiContentSyncController(new ContentSyncAuthorizer("expected-token"), tabs, articles, featured);

        assertThatThrownBy(() -> controller.deleteTab("wrong-token", "governance"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("404 NOT_FOUND");
        verifyNoInteractions(articles, tabs, featured);
    }

    @Test
    void replacesFeaturedWhenMachineTokenMatches() {
        var controller = new WikiContentSyncController(new ContentSyncAuthorizer("expected-token"), tabs, articles, featured);

        var response = controller.replaceFeatured("expected-token",
                new cloud.leneu.jaywiki.wiki.WikiFeaturedController.ReplaceRequest(java.util.List.of("a", "b")));

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(featured).replace(java.util.List.of("a", "b"));
    }

    @Test
    void hidesFeaturedEndpointWhenMachineTokenDoesNotMatch() {
        var controller = new WikiContentSyncController(new ContentSyncAuthorizer("expected-token"), tabs, articles, featured);

        assertThatThrownBy(() -> controller.replaceFeatured("wrong-token",
                new cloud.leneu.jaywiki.wiki.WikiFeaturedController.ReplaceRequest(java.util.List.of("a"))))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("404 NOT_FOUND");
        verifyNoInteractions(articles, tabs, featured);
    }

    @Test
    void hidesEndpointWhenMachineTokenDoesNotMatch() {
        var controller = new WikiContentSyncController(new ContentSyncAuthorizer("expected-token"), tabs, articles, featured);

        assertThatThrownBy(() -> controller.saveArticle("wrong-token", articleRequest()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("404 NOT_FOUND");
        verifyNoInteractions(articles, tabs, featured);
    }

    @Test
    void hidesEndpointWhenHeaderIsMissing() {
        var controller = new WikiContentSyncController(new ContentSyncAuthorizer("expected-token"), tabs, articles, featured);

        assertThatThrownBy(() -> controller.saveArticle(null, articleRequest()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("404 NOT_FOUND");
        verifyNoInteractions(articles, tabs, featured);
    }

    @Test
    void hidesEndpointWhenServerTokenIsNotConfigured() {
        var controller = new WikiContentSyncController(new ContentSyncAuthorizer(""), tabs, articles, featured);

        assertThatThrownBy(() -> controller.saveArticle("", articleRequest()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("404 NOT_FOUND");
        verifyNoInteractions(articles, tabs, featured);
    }

    private static ArticleSaveRequest articleRequest() {
        return new ArticleSaveRequest(
                "content-sync-test",
                "operations",
                "Content sync test",
                "summary",
                "body",
                "wiki",
                "published",
                "sync",
                LocalDate.of(2026, 7, 21),
                0,
                "gitops:abc123"
        );
    }
}
