package cloud.leneu.jaywiki.common;

import cloud.leneu.jaywiki.ops.KubernetesControlException;
import cloud.leneu.jaywiki.saga.PaymentServiceUnavailableException;
import cloud.leneu.jaywiki.saga.ShippingServiceUnavailableException;
import cloud.leneu.jaywiki.wiki.asset.InvalidWikiAssetException;
import cloud.leneu.jaywiki.wiki.asset.WikiAssetStorageException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.servlet.HandlerMapping;

import java.net.URI;

/**
 * 전역 예외 → RFC 7807 (application/problem+json) 응답으로 통일.
 * (완성가이드 §9 공통 규약 — 에러 포맷)
 *
 * ProblemDetail 은 Spring Framework 6 기본 제공.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** @RequestParam @NotBlank 위반 (예: /api/search?q=) → 400 */
    @ExceptionHandler(ConstraintViolationException.class)
    public ProblemDetail handleValidation(ConstraintViolationException e) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, e.getMessage());
        pd.setTitle("Validation Failed");
        pd.setType(URI.create("https://jaywiki/errors/validation"));
        return pd;
    }

    /** @RequestBody @Valid 위반 (예: 본문 저장 시 slug 누락) → 400 */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleBodyValidation(MethodArgumentNotValidException e) {
        String detail = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .findFirst().orElse("invalid request");
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, detail);
        pd.setTitle("Validation Failed");
        pd.setType(URI.create("https://jaywiki/errors/validation"));
        return pd;
    }

    @ExceptionHandler(InvalidWikiAssetException.class)
    public ProblemDetail handleInvalidWikiAsset(InvalidWikiAssetException e) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, e.getMessage());
        pd.setTitle("Invalid Wiki Asset");
        pd.setType(URI.create("https://jaywiki/errors/wiki-asset"));
        return pd;
    }

    @ExceptionHandler(WikiAssetStorageException.class)
    public ProblemDetail handleWikiAssetStorage(WikiAssetStorageException e) {
        log.warn("wiki asset storage unavailable", e);
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE, "이미지 저장소에 연결할 수 없습니다.");
        pd.setTitle("Wiki Asset Storage Unavailable");
        pd.setType(URI.create("https://jaywiki/errors/wiki-asset-storage"));
        return pd;
    }

    /** 드릴을 돌릴 수 없는 상태(예: Kafka 데모 꺼짐) → 503. 사고가 아니라 설정이다. */
    @ExceptionHandler(cloud.leneu.jaywiki.ops.AlertDrillService.DrillUnavailable.class)
    public ProblemDetail handleDrillUnavailable(cloud.leneu.jaywiki.ops.AlertDrillService.DrillUnavailable e) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
        pd.setTitle("Alert Drill Unavailable");
        pd.setType(URI.create("https://jaywiki/errors/alert-drill-unavailable"));
        return pd;
    }

    /** 리소스 없음 → 404 */
    @ExceptionHandler(NotFoundException.class)
    public ProblemDetail handleNotFound(NotFoundException e) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
        pd.setTitle("Not Found");
        pd.setType(URI.create("https://jaywiki/errors/not-found"));
        return pd;
    }

    /** 잘못된 사용자 입력(예: 블로그 댓글 삭제 시 암호 불일치) → 400 */
    @ExceptionHandler(BadRequestException.class)
    public ProblemDetail handleBadRequest(BadRequestException e) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, e.getMessage());
        pd.setTitle("Bad Request");
        pd.setType(URI.create("https://jaywiki/errors/bad-request"));
        return pd;
    }

    /** 상태 충돌(예: 문서 있는 탭 삭제) → 409 */
    @ExceptionHandler(IllegalStateException.class)
    public ProblemDetail handleConflict(IllegalStateException e) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, e.getMessage());
        pd.setTitle("Conflict");
        pd.setType(URI.create("https://jaywiki/errors/conflict"));
        return pd;
    }

    @ExceptionHandler(KubernetesControlException.class)
    public ProblemDetail handleKubernetesControl(KubernetesControlException e) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
        pd.setTitle("Kubernetes Control Unavailable");
        pd.setType(URI.create("https://jaywiki/errors/kubernetes-control"));
        return pd;
    }

    /** 결제 서비스 인프라 장애 → 503 (비즈니스 충돌 409와 구분) */
    @ExceptionHandler(PaymentServiceUnavailableException.class)
    public ProblemDetail handlePaymentUnavailable(PaymentServiceUnavailableException e) {
        log.warn("payment service unavailable", e);
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
        pd.setTitle("Payment Service Unavailable");
        pd.setType(URI.create("https://jaywiki/errors/payment-unavailable"));
        return pd;
    }

    /** 배송 서비스 인프라 장애 → 503 (비즈니스 충돌 409와 구분) */
    @ExceptionHandler(ShippingServiceUnavailableException.class)
    public ProblemDetail handleShippingUnavailable(ShippingServiceUnavailableException e) {
        log.warn("shipping service unavailable", e);
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
        pd.setTitle("Shipping Service Unavailable");
        pd.setType(URI.create("https://jaywiki/errors/shipping-unavailable"));
        return pd;
    }

    /**
     * 읽을 수 없는 요청 본문 → 400. 보낸 쪽 잘못이라 서버 오류가 아니다.
     *
     * 이걸 500 으로 두면 봇이 아무 JSON 이나 던져도 5xx 지표가 오르고 운영 알림이 울린다.
     * 실제로 그렇게 한 번 겪었다 — 관리자 화면이 발행일을 오프셋 없이 보내 500 이 났고,
     * 화면에는 unexpected server error 만 남아 원인을 가렸다. 400 이면 그 자리에서 읽힌다.
     *
     * 내부 메시지는 그대로 내보내지 않는다. 파서 예외에는 필드 이름과 값이 섞여 있다.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ProblemDetail handleUnreadableBody(HttpMessageNotReadableException e, HttpServletRequest request) {
        log.warn("unreadable request body status=400 method={} path={} route={} cause={}",
                request.getMethod(), request.getRequestURI(), route(request), oneLine(e.getMostSpecificCause()));
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "요청 본문을 읽을 수 없습니다.");
        pd.setTitle("Bad Request");
        pd.setType(URI.create("https://jaywiki/errors/unreadable-body"));
        return pd;
    }

    /**
     * 위에서 처리하지 못한 예외 → 500. 내부 메시지는 노출하지 않는다.
     * Spring MVC/Security 자체 예외(404, 405, 인증/인가)는 기본 처리 경로로 되돌린다.
     *
     * 로그 한 줄에 status·method·path·route 를 함께 찍는다. Loki 규칙이 이 줄에서 값을 뽑아
     * 텔레그램 알림을 만든다(infra/k8s/observability/loki-rules.yaml).
     * 형식을 바꾸면 그 규칙의 정규식도 같이 고쳐야 한다.
     *
     * path 와 route 를 둘 다 찍는 이유: path 는 실제 경로(/api/blog/posts/24/comments)라
     * 사람이 재현할 때 쓰고, route 는 Spring 이 지표에서 쓰는 패턴(/api/blog/posts/{id}/comments)이다.
     * 지표 알림과 로그 알림이 같은 사고를 잡았을 때 route 로 맞춰야 Alertmanager 가 둘을 묶는다.
     */
    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnexpected(Exception e, HttpServletRequest request) throws Exception {
        if (e instanceof ErrorResponse || e instanceof AccessDeniedException || e instanceof AuthenticationException) {
            throw e;
        }
        log.error("unhandled exception status=500 method={} path={} route={}",
                request.getMethod(), request.getRequestURI(), route(request), e);
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, "unexpected server error");
        pd.setTitle("Internal Server Error");
        pd.setType(URI.create("https://jaywiki/errors/internal"));
        return pd;
    }

    /**
     * 지표가 쓰는 라우트 패턴. 알림 억제가 이 값으로 지표 라벨과 맞춘다.
     * 매핑을 못 찾은 요청은 실제 경로로 대신한다.
     */
    private static String route(HttpServletRequest request) {
        Object pattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        return pattern == null ? request.getRequestURI() : pattern.toString();
    }

    /**
     * 파서 예외 메시지는 여러 줄이고 입력 조각을 담는다. 그대로 찍으면 로그 한 줄이 쪼개져
     * Loki 규칙이 값을 못 뽑는다. 한 줄로 접고 길이를 자른다.
     */
    private static String oneLine(Throwable cause) {
        String text = String.valueOf(cause).replaceAll("\\s+", " ").trim();
        return text.length() > 200 ? text.substring(0, 200) : text;
    }
}
