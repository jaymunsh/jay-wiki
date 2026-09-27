package cloud.leneu.jaywiki.game;

import cloud.leneu.jaywiki.common.ClientIpResolver;
import cloud.leneu.jaywiki.game.dto.GameScoreCreateRequest;
import cloud.leneu.jaywiki.game.dto.GameScoreDto;
import cloud.leneu.jaywiki.game.dto.GameScoreSubmitResult;
import cloud.leneu.jaywiki.stats.EntrySourceCookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/game")
@RequiredArgsConstructor
public class GameScoreController {

    private final GameScoreService service;

    @GetMapping("/{game}/scores")
    public List<GameScoreDto> top(@PathVariable String game) {
        return service.top(game);
    }

    @PostMapping("/{game}/scores")
    public GameScoreSubmitResult submit(@PathVariable String game,
                                        @RequestBody GameScoreCreateRequest body,
                                        HttpServletRequest request) {
        return service.submit(game, body, ClientIpResolver.resolve(request),
                EntrySourceCookie.read(request));
    }
}
