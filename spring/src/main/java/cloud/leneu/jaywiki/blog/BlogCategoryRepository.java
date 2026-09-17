package cloud.leneu.jaywiki.blog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BlogCategoryRepository extends JpaRepository<BlogCategory, Long> {

    List<BlogCategory> findAllByOrderBySortOrderAsc();

    Optional<BlogCategory> findBySlug(String slug);
}
