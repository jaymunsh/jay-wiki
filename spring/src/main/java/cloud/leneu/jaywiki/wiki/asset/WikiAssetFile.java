package cloud.leneu.jaywiki.wiki.asset;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;

public record WikiAssetFile(
        String originalName,
        String contentType,
        String extension,
        byte[] bytes,
        String checksumSha256
) {
    static final int MAX_BYTES = 10 * 1024 * 1024;

    private static final Map<String, ImageFormat> FORMATS = Map.of(
            "image/png", new ImageFormat("png", new byte[] {
                    (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
            }),
            "image/jpeg", new ImageFormat("jpg", new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff}),
            "image/gif", new ImageFormat("gif", "GIF8".getBytes()),
            "image/webp", new ImageFormat("webp", "RIFF".getBytes())
    );

    public static WikiAssetFile parse(String originalName, String declaredContentType, byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw new InvalidWikiAssetException("빈 파일은 업로드할 수 없습니다.");
        }
        if (bytes.length > MAX_BYTES) {
            throw new InvalidWikiAssetException("이미지는 10MB 이하여야 합니다.");
        }

        ImageFormat format = FORMATS.get(declaredContentType);
        if (format == null) {
            throw new InvalidWikiAssetException("지원하지 않는 이미지 형식입니다.");
        }
        if (!format.matches(bytes)) {
            throw new InvalidWikiAssetException("파일 signature와 선언된 MIME이 일치하지 않습니다.");
        }
        if ("image/webp".equals(declaredContentType)
                && (bytes.length < 12 || !matches(bytes, 8, "WEBP".getBytes()))) {
            throw new InvalidWikiAssetException("파일 signature와 선언된 MIME이 일치하지 않습니다.");
        }

        String safeName = originalName == null || originalName.isBlank() ? "image." + format.extension() : originalName;
        return new WikiAssetFile(safeName, declaredContentType, format.extension(), bytes.clone(), sha256(bytes));
    }

    @Override
    public byte[] bytes() {
        return bytes.clone();
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private static boolean matches(byte[] bytes, int offset, byte[] signature) {
        if (bytes.length < offset + signature.length) return false;
        for (int i = 0; i < signature.length; i++) {
            if (bytes[offset + i] != signature[i]) return false;
        }
        return true;
    }

    private record ImageFormat(String extension, byte[] signature) {
        boolean matches(byte[] bytes) {
            return WikiAssetFile.matches(bytes, 0, signature);
        }
    }
}
