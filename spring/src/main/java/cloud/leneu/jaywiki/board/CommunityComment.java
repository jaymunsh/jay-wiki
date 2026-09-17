package cloud.leneu.jaywiki.board;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * 댓글 엔티티 = public.tb_comment. 글 삭제 시 FK on delete cascade 로 함께 삭제.
 */
@Entity
@Table(schema = "public", name = "tb_comment")
@Getter
@Setter
public class CommunityComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long postId;

    @Column(columnDefinition = "text")
    private String content;

    private String authorType;
    private String authorName;

    private OffsetDateTime createdAt;
}
