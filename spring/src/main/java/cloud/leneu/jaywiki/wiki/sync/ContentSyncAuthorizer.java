package cloud.leneu.jaywiki.wiki.sync;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Component
public class ContentSyncAuthorizer {

    private static final String TOKEN_ENV = "APP_CONTENT_SYNC_TOKEN";

    private final byte[] expectedToken;

    public ContentSyncAuthorizer() {
        this(System.getenv().getOrDefault(TOKEN_ENV, ""));
    }

    ContentSyncAuthorizer(String expectedToken) {
        this.expectedToken = expectedToken.strip().getBytes(StandardCharsets.UTF_8);
    }

    public void requireValid(String providedToken) {
        byte[] provided = providedToken == null
                ? new byte[0]
                : providedToken.strip().getBytes(StandardCharsets.UTF_8);
        if (expectedToken.length == 0 || !MessageDigest.isEqual(expectedToken, provided)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
    }
}
