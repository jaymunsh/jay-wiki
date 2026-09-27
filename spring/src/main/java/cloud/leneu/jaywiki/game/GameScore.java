package cloud.leneu.jaywiki.game;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * 게임 랭킹 행 = public.tb_game_score. 로그인 없이 쓴다.
 * 댓글과 같은 원칙 -- 원본 IP 는 저장하지 않고 차단용 ipHash 만 남긴다.
 * game 은 public/game/<slug>.html 의 slug 와 맞춘다.
 */
@Entity
@Table(schema = "public", name = "tb_game_score")
@Getter
@Setter
public class GameScore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String game;
    private String name;
    private Integer timeMs;
    private String ipHash;
    private String source;
    private OffsetDateTime createdAt;
    private OffsetDateTime deletedAt;
}
