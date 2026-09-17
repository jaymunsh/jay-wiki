package cloud.leneu.jaywiki.auth;

import cloud.leneu.jaywiki.account.AccountUser;
import cloud.leneu.jaywiki.account.AccountUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@Profile("prod")
@RequiredArgsConstructor
public class AdminPasswordBootstrap implements ApplicationRunner {

    private final AccountUserRepository users;
    private final PasswordEncoder encoder;

    @Value("${app.admin.password:}")
    private String adminPassword;

    @Override
    public void run(ApplicationArguments args) {
        if (adminPassword == null || adminPassword.isBlank()) {
            throw new IllegalStateException("APP_ADMIN_PASSWORD is required in prod");
        }
        if ("admin1234".equals(adminPassword)) {
            throw new IllegalStateException("APP_ADMIN_PASSWORD must not use the local default");
        }

        AccountUser admin = users.findByUsername("admin")
                .orElseThrow(() -> new IllegalStateException("admin user seed is missing"));
        if (!encoder.matches(adminPassword, admin.getPassword())) {
            admin.setPassword(encoder.encode(adminPassword));
            users.save(admin);
            log.info("prod admin password updated from Kubernetes Secret");
        }
    }
}
