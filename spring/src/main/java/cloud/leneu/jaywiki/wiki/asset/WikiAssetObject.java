package cloud.leneu.jaywiki.wiki.asset;

public record WikiAssetObject(byte[] bytes, String etag) {
    public WikiAssetObject {
        bytes = bytes.clone();
    }

    @Override
    public byte[] bytes() {
        return bytes.clone();
    }
}
