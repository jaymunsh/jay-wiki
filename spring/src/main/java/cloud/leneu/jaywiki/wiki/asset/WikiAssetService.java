package cloud.leneu.jaywiki.wiki.asset;

import cloud.leneu.jaywiki.blog.BlogPostRepository;
import cloud.leneu.jaywiki.common.NotFoundException;
import cloud.leneu.jaywiki.wiki.WikiArticleRepository;
import cloud.leneu.jaywiki.wiki.WikiRevisionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WikiAssetService {
    private final WikiAssetRepository assets;
    private final WikiArticleRepository articles;
    private final WikiRevisionRepository revisions;
    private final BlogPostRepository blogPosts;
    private final WikiAssetObjectStorage storage;

    /**
     * 같은 내용이면 새로 만들지 않고 이미 있는 것을 돌려준다.
     * 업로드가 멱등해야 재시도와 재발행이 창고에 같은 바이트를 쌓지 않는다.
     * 파일 이름이 달라도 내용이 같으면 같은 자산으로 본다 -- 본문이 가리키는 것은 내용이다.
     */
    @Transactional
    public WikiAssetUploadResponse upload(WikiAssetFile file, String uploadedBy) {
        Optional<WikiAsset> existing = assets.findFirstByChecksumSha256AndDeletedAtIsNull(file.checksumSha256());
        if (existing.isPresent()) return WikiAssetUploadResponse.from(existing.get());

        String id = UUID.randomUUID().toString();
        String objectKey = "articles/" + id + "/original." + file.extension();
        storage.put(objectKey, file);

        WikiAsset asset = new WikiAsset();
        asset.setId(id);
        asset.setObjectKey(objectKey);
        asset.setOriginalName(file.originalName());
        asset.setContentType(file.contentType());
        asset.setSizeBytes(file.bytes().length);
        asset.setChecksumSha256(file.checksumSha256());
        asset.setStatus(WikiAssetStatus.TEMP);
        asset.setUploadedBy(uploadedBy == null || uploadedBy.isBlank() ? "admin" : uploadedBy);
        asset.setCreatedAt(OffsetDateTime.now());
        try {
            return WikiAssetUploadResponse.from(assets.save(asset));
        } catch (RuntimeException databaseFailure) {
            try {
                storage.delete(objectKey);
            } catch (RuntimeException cleanupFailure) {
                databaseFailure.addSuppressed(cleanupFailure);
            }
            throw databaseFailure;
        }
    }

    @Transactional(readOnly = true)
    public WikiAssetContent read(String id) {
        WikiAsset asset = getActive(id);
        WikiAssetObject object = storage.get(asset.getObjectKey());
        return new WikiAssetContent(asset.getContentType(), object.bytes(), object.etag());
    }

    @Transactional
    public void attachReferenced(String markdown) {
        Set<String> ids = WikiAssetReferences.ids(markdown);
        if (ids.isEmpty()) return;
        OffsetDateTime now = OffsetDateTime.now();
        for (WikiAsset asset : assets.findAllById(ids)) {
            if (asset.getDeletedAt() == null && asset.getStatus() != WikiAssetStatus.ATTACHED) {
                asset.setStatus(WikiAssetStatus.ATTACHED);
                asset.setAttachedAt(now);
            }
        }
    }

    @Transactional
    public void delete(String id) {
        WikiAsset asset = getActive(id);
        if (isReferencedAnywhere(id)) {
            throw new IllegalStateException("현재 문서, revision, 블로그 본문 또는 커버 이미지에서 참조 중인 이미지는 삭제할 수 없습니다.");
        }
        storage.delete(asset.getObjectKey());
        asset.setStatus(WikiAssetStatus.UNUSED);
        asset.setDeletedAt(OffsetDateTime.now());
    }

    /**
     * 이 자산을 참조하는 본문이 하나라도 있으면 true.
     * 위키 현재 본문, 위키 revision, 블로그 본문, 블로그 커버 이미지를 모두 본다.
     * revision 까지 보는 이유는 과거 버전으로 되돌렸을 때 깨진 이미지가 나오지 않게 하기 위해서다.
     * 커버 이미지는 마크다운 본문이 아니라 자산 id 를 그대로 담는 컬럼이라 경로 문자열이 아닌
     * id 자체로 비교한다.
     */
    @Transactional(readOnly = true)
    public boolean isReferencedAnywhere(String assetId) {
        String reference = WikiAssetReferences.path(assetId);
        return articles.existsByBodyContaining(reference)
                || revisions.existsByBodyContaining(reference)
                || blogPosts.existsByBodyContaining(reference)
                || blogPosts.existsByCoverAssetId(assetId);
    }

    /**
     * 어디서도 참조하지 않는 살아 있는 자산. 본문에서 그림을 뺐을 때 창고에만 남는 것들이다.
     *
     * ponytail: 자산 수만큼 참조 검색을 돈다. 지금은 한 자리 수라 문제가 안 되지만,
     * 수백 개가 되면 본문에서 id 를 뽑아 한 번에 대조하는 쪽으로 바꾼다.
     */
    @Transactional(readOnly = true)
    public List<WikiAsset> findOrphans() {
        return assets.findAllByDeletedAtIsNull().stream()
                .filter(asset -> !isReferencedAnywhere(asset.getId()))
                .toList();
    }

    private WikiAsset getActive(String id) {
        WikiAsset asset = assets.findById(id)
                .orElseThrow(() -> new NotFoundException("wiki asset not found: " + id));
        if (asset.getDeletedAt() != null) {
            throw new NotFoundException("wiki asset not found: " + id);
        }
        return asset;
    }

    public record WikiAssetContent(String contentType, byte[] bytes, String etag) {
        public WikiAssetContent {
            bytes = bytes.clone();
        }

        @Override
        public byte[] bytes() {
            return bytes.clone();
        }
    }
}
