package cloud.leneu.jaywiki.game;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GameScoreRepository extends JpaRepository<GameScore, Long> {

    List<GameScore> findTop5ByGameAndDeletedAtIsNullOrderByTimeMsAscIdAsc(String game);

    long countByGameAndDeletedAtIsNullAndTimeMsLessThan(String game, int timeMs);
}
