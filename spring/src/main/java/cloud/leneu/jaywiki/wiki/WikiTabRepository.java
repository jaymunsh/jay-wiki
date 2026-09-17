package cloud.leneu.jaywiki.wiki;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WikiTabRepository extends JpaRepository<WikiTab, String> {

    /** 정렬 순서대로 1차 탭 전체 */
    List<WikiTab> findAllByOrderBySortOrderAsc();
}
