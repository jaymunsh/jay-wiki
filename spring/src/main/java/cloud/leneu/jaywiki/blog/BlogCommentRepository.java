package cloud.leneu.jaywiki.blog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BlogCommentRepository extends JpaRepository<BlogComment, Long> {
    List<BlogComment> findByPostIdAndDeletedAtIsNullOrderByCreatedAtAsc(Long postId);

    List<BlogComment> findByDeletedAtIsNullOrderByCreatedAtDesc();

    /** 휴지통. 지운 시각이 최근인 것부터 준다. */
    List<BlogComment> findByDeletedAtIsNotNullOrderByDeletedAtDesc();
}
