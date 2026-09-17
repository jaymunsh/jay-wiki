package cloud.leneu.jaywiki.blog;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface BlogPostTagRepository extends JpaRepository<BlogPostTag, BlogPostTagId> {

    List<BlogPostTag> findByPostId(Long postId);

    List<BlogPostTag> findByTagId(Long tagId);

    void deleteByPostId(Long postId);

    /** 태그별 published 글 수. 화면의 태그 목록에 쓴다. */
    @Query("""
        select t.name, count(pt.postId)
        from BlogPostTag pt, BlogTag t, BlogPost p
        where pt.tagId = t.id and pt.postId = p.id and p.status = 'published'
        group by t.name
        order by count(pt.postId) desc, t.name asc
        """)
    List<Object[]> countByTag();
}
