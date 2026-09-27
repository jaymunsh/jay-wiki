package cloud.leneu.jaywiki.game;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import cloud.leneu.jaywiki.common.BadRequestException;
import cloud.leneu.jaywiki.common.NotFoundException;
import cloud.leneu.jaywiki.game.dto.GameScoreCreateRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class GameScoreServiceTest {

    @Autowired GameScoreService scores;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from public.tb_game_score");
    }

    @Test
    void 등록하면_시간_오름차순_TOP5_와_내_전체_순위가_온다() {
        for (int i = 0; i < 6; i++) {
            scores.submit("forest-jump", new GameScoreCreateRequest("p" + i, 60_000 + i), "1.2.3.4", null);
        }
        var result = scores.submit("forest-jump", new GameScoreCreateRequest("me", 59_999), "1.2.3.4", null);
        assertThat(result.rank()).isEqualTo(1);
        assertThat(result.top()).hasSize(5);
        assertThat(result.top().get(0).name()).isEqualTo("me");
    }

    @Test
    void 없는_게임과_불가능한_기록을_거절한다() {
        assertThatThrownBy(() -> scores.top("no-such-game")).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> scores.submit("forest-jump", new GameScoreCreateRequest("x", 100), "1.2.3.4", null))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> scores.submit("forest-jump", new GameScoreCreateRequest(" ", 60_000), "1.2.3.4", null))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> scores.submit("forest-jump", new GameScoreCreateRequest("x", null), "1.2.3.4", null))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void 원본_ip_는_남지_않고_salted_hash_만_남는다() {
        scores.submit("forest-jump", new GameScoreCreateRequest("abc", 60_000), "203.0.113.9", null);
        var row = jdbc.queryForMap("select ip_hash from public.tb_game_score limit 1");
        assertThat(row.get("ip_hash").toString()).doesNotContain("203.0.113.9").hasSize(64);
    }
}
