package cloud.leneu.jaywiki.wiki.asset;

public record WikiAssetUploadResponse(
        String id,
        String url,
        String originalName,
        String contentType,
        long sizeBytes
) {
    static WikiAssetUploadResponse from(WikiAsset asset) {
        return new WikiAssetUploadResponse(
                asset.getId(),
                WikiAssetReferences.path(asset.getId()),
                asset.getOriginalName(),
                asset.getContentType(),
                asset.getSizeBytes()
        );
    }
}
