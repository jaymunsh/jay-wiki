package cloud.leneu.jaywiki.wiki.asset;

import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;

@RestController
@RequestMapping("/api/wiki-assets")
@RequiredArgsConstructor
public class WikiAssetController {
    private final WikiAssetService service;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public WikiAssetUploadResponse upload(@RequestPart("file") MultipartFile file, Authentication authentication)
            throws IOException {
        WikiAssetFile parsed = WikiAssetFile.parse(file.getOriginalFilename(), file.getContentType(), file.getBytes());
        return service.upload(parsed, authentication == null ? "admin" : authentication.getName());
    }

    @GetMapping("/{id}")
    public ResponseEntity<byte[]> read(@PathVariable String id) {
        WikiAssetService.WikiAssetContent content = service.read(id);
        ResponseEntity.BodyBuilder response = ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(content.contentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .header("X-Content-Type-Options", "nosniff");
        if (content.etag() != null && !content.etag().isBlank()) response.eTag(content.etag());
        return response.body(content.bytes());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
