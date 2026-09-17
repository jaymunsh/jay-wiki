package cloud.leneu.jaywiki.wiki;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WikiFeaturedRepository extends JpaRepository<WikiFeatured, Short> {
    List<WikiFeatured> findAllByOrderByPositionAsc();
}
