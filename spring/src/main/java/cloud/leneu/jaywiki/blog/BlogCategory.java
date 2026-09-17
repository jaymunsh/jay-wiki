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
 * 블로그 카테고리 = public.tb_blog_category (V13).
 * 최대 2단. parentId 가 있는 행은 다시 부모가 될 수 없다(BlogCategoryService 가 강제).
 */
@Entity
@Table(schema = "public", name = "tb_blog_category")
@Getter
@Setter
public class BlogCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String slug;
    private String name;
    private String description;
    private Long parentId;
    private int sortOrder;
    private OffsetDateTime createdAt;
}
