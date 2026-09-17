package cloud.leneu.jaywiki.blog;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * 댓글 = public.tb_blog_comment. 로그인 없이 쓴다.
 * 원본 IP 는 저장하지 않는다. 표시용 ipPrefix(앞 2옥텟)와 차단용 ipHash 만 남긴다.
 */
@Entity
@Table(schema = "public", name = "tb_blog_comment")
@Getter
@Setter
public class BlogComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long postId;
    private String authorName;
    private String passwordHash;
    private String body;
    private String ipPrefix;
    private String ipHash;
    /** 이 댓글을 쓴 사람이 애초에 어디서 들어왔는지. 분류된 소스 이름 하나뿐이다. */
    private String source;
    private OffsetDateTime createdAt;
    private OffsetDateTime deletedAt;
}
