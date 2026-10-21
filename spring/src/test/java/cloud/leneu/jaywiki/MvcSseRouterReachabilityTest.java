package cloud.leneu.jaywiki;

import org.junit.jupiter.api.Test;
import org.reactivestreams.Publisher;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.function.RouterFunction;
import org.springframework.web.servlet.function.support.RouterFunctionMapping;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;
import org.springframework.web.servlet.view.FragmentsRendering;

import static org.assertj.core.api.Assertions.assertThat;

/** Current application preconditions for CVE-2026-47890 and CVE-2026-47892; this is not a library patch. */
@SpringBootTest(properties = {"app.opensearch.enabled=false"})
@Import(TestcontainersConfiguration.class)
class MvcSseRouterReachabilityTest {
    @Autowired ApplicationContext context;
    @Autowired @Qualifier("requestMappingHandlerMapping") RequestMappingHandlerMapping mappings;

    @Test
    void noApplicationHandlerStreamsServerSentEventsOrViewFragments() {
        var handlers = mappings.getHandlerMethods().entrySet().stream()
                .filter(e -> e.getValue().getBeanType().getPackageName().startsWith("cloud.leneu.jaywiki"))
                .toList();
        assertThat(handlers).isNotEmpty();
        for (var entry : handlers) {
            Class<?> returnType = entry.getValue().getMethod().getReturnType();
            assertThat(ResponseBodyEmitter.class.isAssignableFrom(returnType)
                    || Publisher.class.isAssignableFrom(returnType)
                    || FragmentsRendering.class.isAssignableFrom(returnType))
                    .as("streaming or fragment return type for %s", entry.getValue()).isFalse();
            assertThat(entry.getKey().getProducesCondition().getProducibleMediaTypes())
                    .as("produces for %s", entry.getValue())
                    .noneMatch(MediaType.TEXT_EVENT_STREAM::includes);
        }
    }

    @Test
    void noFunctionalEndpointIsRegistered() {
        assertThat(context.getBeansOfType(RouterFunction.class)).isEmpty();
        assertThat(context.getBeansOfType(org.springframework.web.reactive.function.server.RouterFunction.class)).isEmpty();
        for (var mapping : context.getBeansOfType(RouterFunctionMapping.class).values()) {
            assertThat(mapping.getRouterFunction()).isNull();
        }
    }
}
