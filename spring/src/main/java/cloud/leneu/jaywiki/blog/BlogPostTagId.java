package cloud.leneu.jaywiki.blog;

import java.io.Serializable;
import java.util.Objects;

/** tb_blog_post_tag 의 복합 키. */
public class BlogPostTagId implements Serializable {
    private Long postId;
    private Long tagId;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof BlogPostTagId other)) return false;
        return Objects.equals(postId, other.postId) && Objects.equals(tagId, other.tagId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(postId, tagId);
    }
}
