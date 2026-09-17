package cloud.leneu.jaywiki.wiki;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 첫 화면 '핵심 위키' 목록의 한 칸 = public.tb_wiki_featured (V22).
 *
 * 글 자체가 아니라 '몇 번째 자리에 어느 글' 이라는 배치만 든다. 본문·제목은 tb_article 이
 * 정본이므로 여기에 복사해 두지 않는다 — 제목을 고쳤을 때 두 곳이 갈리는 것을 막는다.
 */
@Entity
@Table(schema = "public", name = "tb_wiki_featured")
@Getter
@Setter
@NoArgsConstructor
public class WikiFeatured {

    /** 전시 순서. 1 부터. PK 라 같은 자리에 둘이 들어갈 수 없다. */
    @Id
    private short position;

    private String articleSlug;

    public WikiFeatured(short position, String articleSlug) {
        this.position = position;
        this.articleSlug = articleSlug;
    }
}
