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
 * 게시글 엔티티 = public.tb_post (V4__community_board.sql).
 * 게시판 SoT = PostgreSQL. 익명 작성이 기본.
 */
@Entity
@Table(schema = "public", name = "tb_post")
@Getter
@Setter
public class CommunityPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)  // bigserial
    private Long id;

    private String title;

    @Column(columnDefinition = "text")
    private String content;

    private String authorType;     // anonymous / user
    private String authorName;     // 게스트 닉네임
    private String passwordHash;   // 본인 삭제용 BCrypt (null 이면 관리자만 삭제)

    private int views = 0;         // 누적 기저(실시간 증가분은 Redis)
    private int commentCount = 0;  // 비정규화 댓글 수

    private OffsetDateTime createdAt;
}
