package cloud.leneu.jaywiki.domainlab;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;

@RestController
@RequestMapping("/api/domain-scenarios/partner-api/callbacks")
@RequiredArgsConstructor
public class PartnerCallbackController {
    private final ObjectMapper objectMapper;
    private final PartnerCallbackRegistry registry;

    @Value("${app.partner-simulator.callback-secret:local-partner-secret}")
    private String callbackSecret;

    @PostMapping
    public ResponseEntity<Void> callback(@RequestBody String body,
                                         @RequestHeader(value = "X-Partner-Signature", defaultValue = "")
                                         String signature) throws Exception {
        CallbackPayload payload = objectMapper.readValue(body, CallbackPayload.class);
        boolean signatureValid = signatureValid(body, signature)
                && Math.abs(Instant.now().getEpochSecond() - payload.timestamp()) <= 300;
        registry.complete(payload.correlationId(),
                new PartnerCallbackRegistry.Result(signatureValid, payload.status()));
        return ResponseEntity.accepted().build();
    }

    private boolean signatureValid(String body, String signature) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(callbackSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] expected = mac.doFinal(body.getBytes(StandardCharsets.UTF_8));
        byte[] actual;
        try {
            actual = HexFormat.of().parseHex(signature);
        } catch (IllegalArgumentException error) {
            return false;
        }
        return MessageDigest.isEqual(expected, actual);
    }

    private record CallbackPayload(String correlationId, String status, long timestamp) {
    }
}
