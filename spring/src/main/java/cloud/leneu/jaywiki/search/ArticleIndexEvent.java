package cloud.leneu.jaywiki.search;

public record ArticleIndexEvent(String slug, Action action) {
    public enum Action {
        UPSERT,
        DELETE
    }
}
