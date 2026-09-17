package cloud.leneu.jaywiki;

import org.springframework.boot.SpringApplication;

public class TestJaywikiApplication {

    public static void main(String[] args) {
        SpringApplication.from(JaywikiApplication::main).with(TestcontainersConfiguration.class).run(args);
    }

}
