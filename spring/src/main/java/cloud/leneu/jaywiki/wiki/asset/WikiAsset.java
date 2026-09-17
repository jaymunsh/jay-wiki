package cloud.leneu.jaywiki.wiki.asset;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(schema = "public", name = "tb_article_asset")
@Getter
@Setter
public class WikiAsset {
    @Id
    private String id;
    private String objectKey;
    private String originalName;
    private String contentType;
    private long sizeBytes;
    private String checksumSha256;
    @Enumerated(EnumType.STRING)
    private WikiAssetStatus status;
    private String uploadedBy;
    private OffsetDateTime createdAt;
    private OffsetDateTime attachedAt;
    private OffsetDateTime deletedAt;
}
