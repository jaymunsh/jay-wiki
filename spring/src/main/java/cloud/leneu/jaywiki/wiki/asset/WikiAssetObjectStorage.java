package cloud.leneu.jaywiki.wiki.asset;

public interface WikiAssetObjectStorage {
    void put(String objectKey, WikiAssetFile file);
    WikiAssetObject get(String objectKey);
    void delete(String objectKey);
}
