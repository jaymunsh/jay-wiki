package cloud.leneu.jaywiki.wiki.asset;

import cloud.leneu.jaywiki.wiki.sync.ContentSyncAuthorizer;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

/**
 * 이미지 업로드의 내부 문. 글 입구(/internal/content-sync/blog-posts)와 같은 토큰을 쓴다.
 *
 * 왜 필요한가: 관리자 API 로 올리면 TOTP 를 매번 넣어야 해서, 글에 그림을 넣는 일이
 * 브라우저 왕복이 된다. 그러면 사람이 다시 web/public 폴더를 고르고, 그림 한 장 때문에
 * 배포 한 판이 돈다. 배포는 이미 토큰으로 글을 올리고 있으므로 그림도 같은 문을 쓴다.
 *
 * 토큰이 틀리면 404 다. 경로의 존재 자체를 숨긴다(ContentSyncAuthorizer).
 * 검증은 관리자 경로와 똑같이 WikiAssetFile.parse 가 한다 -- 이 문이 검사를 건너뛰지 않는다.
 */
@RestController
@RequestMapping("/internal/content-sync")
@RequiredArgsConstructor
public class WikiAssetSyncController {

    static final String TOKEN_HEADER = "X-Content-Sync-Token";

    private final ContentSyncAuthorizer authorizer;
    private final WikiAssetService service;

    @PostMapping(value = "/assets", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public WikiAssetUploadResponse upload(
            @RequestHeader(value = TOKEN_HEADER, required = false) String token,
            @RequestPart("file") MultipartFile file
    ) throws IOException {
        authorizer.requireValid(token);
        WikiAssetFile parsed = WikiAssetFile.parse(file.getOriginalFilename(), file.getContentType(), file.getBytes());
        return service.upload(parsed, "content-sync");
    }

    /**
     * 어디서도 참조하지 않는 자산. 본문에서 그림을 뺐을 때 창고에만 남는 것들이다.
     * git 은 저장소의 원본 파일만 들고 있어서 이쪽은 안 보인다 -- 그래서 물어볼 창구가 필요하다.
     */
    @GetMapping("/assets/orphans")
    public List<WikiAssetUploadResponse> orphans(
            @RequestHeader(value = TOKEN_HEADER, required = false) String token
    ) {
        authorizer.requireValid(token);
        return service.findOrphans().stream().map(WikiAssetUploadResponse::from).toList();
    }

    /**
     * 참조가 하나라도 남아 있으면 서비스가 거부한다. 이 문이 그 검사를 건너뛰지 않는다.
     */
    @DeleteMapping("/assets/{id}")
    public ResponseEntity<Void> delete(
            @RequestHeader(value = TOKEN_HEADER, required = false) String token,
            @PathVariable String id
    ) {
        authorizer.requireValid(token);
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
