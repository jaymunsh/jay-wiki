package cloud.leneu.jaywiki.blog;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/** 태그 = public.tb_blog_tag. 위키의 콤마 문자열과 달리 정규화한다(태그별 글 수와 태그 페이지 때문). */
@Entity
@Table(schema = "public", name = "tb_blog_tag")
@Getter
@Setter
public class BlogTag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
}
