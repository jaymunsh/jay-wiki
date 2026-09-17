package cloud.leneu.jaywiki.board;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommunityCommentRepository extends JpaRepository<CommunityComment, Long> {

    /** 한 글의 댓글을 오래된 순으로 */
    List<CommunityComment> findByPostIdOrderByIdAsc(Long postId);
}
