package cloud.leneu.jaywiki.wiki;

import cloud.leneu.jaywiki.wiki.dto.ArticleSummaryDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 첫 화면 '핵심 위키' 목록.
 *
 * 저장은 칸 하나씩이 아니라 목록 전체를 한 번에 받는다. 자리를 하나씩 옮기면 2번을 3번으로
 * 미는 순간 기존 3번과 PK 가 부딪혀, 임시 자리로 피신시키는 코드가 필요해진다. 통째로 지우고
 * 다시 넣으면 그 중간 상태가 아예 없다. 개수 제한도 여기 한 곳에서만 본다.
 */
@Service
@RequiredArgsConstructor
public class WikiFeaturedService {

    /** 화면이 다섯 줄을 그린다. 스키마가 아니라 여기서 정한다 — 화면 사정으로 바뀔 값이다. */
    public static final int MAX = 5;

    private final WikiFeaturedRepository featuredRepository;
    private final WikiArticleRepository articleRepository;

    /** 전시 순서대로. 목록이 비면 빈 리스트다(화면이 탭을 감춘다). */
    @Transactional(readOnly = true)
    public List<ArticleSummaryDto> list() {
        List<WikiFeatured> slots = featuredRepository.findAllByOrderByPositionAsc();
        if (slots.isEmpty()) return List.of();

        // 글 하나씩 조회하면 자리 수만큼 쿼리가 나간다. 한 번에 받아 자리 순서로 세운다.
        Map<String, WikiArticle> bySlug = articleRepository
                .findAllById(slots.stream().map(WikiFeatured::getArticleSlug).toList())
                .stream()
                .collect(Collectors.toMap(WikiArticle::getSlug, Function.identity()));

        return slots.stream()
                .map(s -> bySlug.get(s.getArticleSlug()))
                .filter(java.util.Objects::nonNull)
                .map(ArticleSummaryDto::from)
                .toList();
    }

    /**
     * 목록 전체를 이 순서로 바꾼다. 빈 목록을 주면 전시를 끈다.
     * 없는 slug 나 중복이 하나라도 있으면 아무것도 저장하지 않고 400 이다.
     */
    @Transactional
    public void replace(List<String> slugs) {
        List<String> wanted = slugs == null ? List.of() : slugs.stream().map(String::trim).filter(s -> !s.isEmpty()).toList();
        if (wanted.size() > MAX) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "핵심 위키는 " + MAX + "편까지다");
        }
        if (new LinkedHashSet<>(wanted).size() != wanted.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "같은 글을 두 번 넣을 수 없다");
        }
        for (String slug : wanted) {
            if (!articleRepository.existsById(slug)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "없는 문서다: " + slug);
            }
        }

        featuredRepository.deleteAllInBatch();
        // 지운 것과 넣는 것이 같은 트랜잭션 안에서 부딪히지 않게 flush 로 순서를 못 박는다.
        featuredRepository.flush();
        for (int i = 0; i < wanted.size(); i++) {
            featuredRepository.save(new WikiFeatured((short) (i + 1), wanted.get(i)));
        }
    }
}
