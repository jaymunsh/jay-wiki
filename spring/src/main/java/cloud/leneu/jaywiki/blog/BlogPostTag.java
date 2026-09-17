package cloud.leneu.jaywiki.blog;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/** 글과 태그의 연결 = public.tb_blog_post_tag. */
@Entity
@Table(schema = "public", name = "tb_blog_post_tag")
@IdClass(BlogPostTagId.class)
@Getter
@Setter
public class BlogPostTag {

    @Id
    private Long postId;

    @Id
    private Long tagId;
}
