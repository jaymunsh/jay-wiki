package cloud.leneu.jaywiki.game;

import cloud.leneu.jaywiki.blog.BlogCommentProperties;
import cloud.leneu.jaywiki.common.BadRequestException;
import cloud.leneu.jaywiki.common.ClientIpResolver;
import cloud.leneu.jaywiki.common.NotFoundException;
import cloud.leneu.jaywiki.game.dto.GameScoreCreateRequest;
import cloud.leneu.jaywiki.game.dto.GameScoreDto;
import cloud.leneu.jaywiki.game.dto.GameScoreSubmitResult;
import cloud.leneu.jaywiki.stats.Referrer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 로그인 없이 쓰는 게임 랭킹. 댓글과 같은 익명 쓰기 규칙을 따른다 --
 * 원본 IP 는 저장하지 않고 차단용 salted hash 만 남긴다.
 *
 * 기록 조작은 막을 수 없다(클라이언트가 임의 timeMs 를 보낼 수 있다). 그래서 이 API 는
 * "믿을 수 있는 기록"이 아니라 "놀이터 게시판"이다 -- 존재하는 게임만 받고, 물리적으로
 * 불가능한 값은 거절하는 정도가 이 규모에 맞는 방어선이다.
 */
@Service
@RequiredArgsConstructor
public class GameScoreService {

    /** 화면에 노출하는 수. 게임 사이드바의 TOP 5 와 맞춘다. */
    static final int TOP = 5;

    /** 랭킹을 받는 게임. public/game/<slug>.html 이 생길 때 함께 늘린다. */
    private static final Set<String> GAMES = Set.of("forest-jump");

    private static final Pattern GAME_SLUG = Pattern.compile("^[a-z0-9][a-z0-9-]{0,39}$");
    private static final int MAX_NAME = 12;
    /** 50층을 5초 안에 오르는 기록은 없다. 그 아래는 조작된 요청이다. */
    private static final int MIN_TIME_MS = 5_000;
    /** 이 이상 걸린 완주는 사실상 없다 -- 상한이 없으면 임의 큰 값을 쌓는 장난이 된다. */
    private static final int MAX_TIME_MS = 30 * 60 * 1000;

    private final GameScoreRepository scores;
    /** 댓글과 같은 salt. 같은 IP 가 기능 사이에서 같은 hash 가 되어야 차단이 의미를 갖는다. */
    private final BlogCommentProperties properties;

    @Transactional(readOnly = true)
    public List<GameScoreDto> top(String game) {
        requireGame(game);
        List<GameScore> found = scores.findTop5ByGameAndDeletedAtIsNullOrderByTimeMsAscIdAsc(game);
        List<GameScoreDto> out = new ArrayList<>(found.size());
        for (int i = 0; i < found.size(); i++) {
            GameScore s = found.get(i);
            out.add(new GameScoreDto(i + 1, s.getName(), s.getTimeMs(), s.getCreatedAt()));
        }
        return out;
    }

    @Transactional
    public GameScoreSubmitResult submit(String game, GameScoreCreateRequest request,
                                        String clientIp, String entryHost) {
        requireGame(game);
        if (request == null || request.timeMs() == null
                || request.timeMs() < MIN_TIME_MS || request.timeMs() > MAX_TIME_MS) {
            throw new BadRequestException("기록 시간이 올바르지 않습니다.");
        }
        if (request.name() == null || request.name().isBlank()) {
            throw new BadRequestException("이름을 입력해 주세요.");
        }

        String name = request.name().strip();
        GameScore score = new GameScore();
        score.setGame(game);
        score.setName(name.length() <= MAX_NAME ? name : name.substring(0, MAX_NAME));
        score.setTimeMs(request.timeMs());
        score.setIpHash(hash(clientIp));
        score.setSource(Referrer.ofHost(entryHost).source());
        score.setCreatedAt(OffsetDateTime.now());
        scores.save(score);

        // 전체 순위는 TOP 5 밖이어도 알려준다 -- "몇 위인지"가 등록의 보상이다.
        int rank = (int) scores.countByGameAndDeletedAtIsNullAndTimeMsLessThan(game, request.timeMs()) + 1;
        return new GameScoreSubmitResult(rank, top(game));
    }

    private static void requireGame(String game) {
        if (game == null || !GAME_SLUG.matcher(game).matches() || !GAMES.contains(game)) {
            throw new NotFoundException("game not found: " + game);
        }
    }

    private String hash(String clientIp) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] out = digest.digest((properties.ipSalt() + "|" + clientIp).getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(out);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
