package cloud.leneu.jaywiki.auth;

import dev.samstevens.totp.code.HashingAlgorithm;
import dev.samstevens.totp.qr.QrData;
import dev.samstevens.totp.qr.ZxingPngQrGenerator;
import dev.samstevens.totp.secret.DefaultSecretGenerator;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;

public final class AdminTotpSetupCli {
    private AdminTotpSetupCli() {}

    public static void main(String[] args) throws Exception {
        if (args.length != 3) {
            throw new IllegalArgumentException("usage: <output-directory> <issuer> <account>");
        }
        Path directory = Path.of(args[0]).toAbsolutePath().normalize();
        Files.createDirectories(directory);
        String secret = new DefaultSecretGenerator(32).generate();
        QrData data = new QrData.Builder()
                .label(args[2])
                .secret(secret)
                .issuer(args[1])
                .algorithm(HashingAlgorithm.SHA1)
                .digits(6)
                .period(30)
                .build();

        Path qr = directory.resolve("admin-totp.png");
        Path secretFile = directory.resolve("admin-totp.secret");
        Files.write(qr, new ZxingPngQrGenerator().generate(data));
        writeOwnerOnly(secretFile, secret);
        System.out.println(qr);
    }

    private static void writeOwnerOnly(Path path, String secret) throws IOException {
        Files.writeString(path, secret);
        try {
            Files.setPosixFilePermissions(path, PosixFilePermissions.fromString("rw-------"));
        } catch (UnsupportedOperationException ignored) {
            path.toFile().setReadable(false, false);
            path.toFile().setReadable(true, true);
            path.toFile().setWritable(false, false);
            path.toFile().setWritable(true, true);
        }
    }
}
