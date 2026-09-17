package cloud.leneu.jaywiki.wiki.asset;

import io.minio.GetObjectArgs;
import io.minio.GetObjectResponse;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.IOException;

@Component
public class MinioWikiAssetStorage implements WikiAssetObjectStorage {
    private final MinioClient client;
    private final String bucket;

    public MinioWikiAssetStorage(
            @Value("${app.minio.endpoint}") String endpoint,
            @Value("${app.minio.access-key}") String accessKey,
            @Value("${app.minio.secret-key}") String secretKey,
            @Value("${app.minio.bucket:wiki-assets}") String bucket
    ) {
        this.client = MinioClient.builder()
                .endpoint(endpoint)
                .credentials(accessKey, secretKey)
                .build();
        this.bucket = bucket;
    }

    @Override
    public void put(String objectKey, WikiAssetFile file) {
        byte[] bytes = file.bytes();
        try (ByteArrayInputStream input = new ByteArrayInputStream(bytes)) {
            client.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .contentType(file.contentType())
                    .stream(input, (long) bytes.length, -1L)
                    .build());
        } catch (Exception e) {
            throw new WikiAssetStorageException("MinIO 이미지 저장에 실패했습니다.", e);
        }
    }

    @Override
    public WikiAssetObject get(String objectKey) {
        try (GetObjectResponse response = client.getObject(GetObjectArgs.builder()
                .bucket(bucket)
                .object(objectKey)
                .build())) {
            return new WikiAssetObject(response.readAllBytes(), response.headers().get("etag"));
        } catch (IOException e) {
            throw new WikiAssetStorageException("MinIO 이미지 읽기에 실패했습니다.", e);
        } catch (Exception e) {
            throw new WikiAssetStorageException("MinIO 이미지 조회에 실패했습니다.", e);
        }
    }

    @Override
    public void delete(String objectKey) {
        try {
            client.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(objectKey).build());
        } catch (Exception e) {
            throw new WikiAssetStorageException("MinIO 이미지 삭제에 실패했습니다.", e);
        }
    }
}
