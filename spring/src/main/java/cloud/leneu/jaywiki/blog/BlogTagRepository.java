package cloud.leneu.jaywiki.blog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BlogTagRepository extends JpaRepository<BlogTag, Long> {
    Optional<BlogTag> findByName(String name);
    List<BlogTag> findByIdIn(List<Long> ids);
}
