package cloud.leneu.jaywiki.search;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.URI;

@ConfigurationProperties(prefix = "app.opensearch")
public record OpenSearchProperties(
        boolean enabled,
        URI url,
        String boardIndex,
        String wikiIndex,
        String username,
        String password,
        String caCertificate,
        boolean securityRequired
) {
    @Override
    public String toString() {
        return "OpenSearchProperties[enabled=" + enabled + ", securityRequired=" + securityRequired + "]";
    }
}
