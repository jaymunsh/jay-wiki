package cloud.leneu.jaywiki;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.servlet.View;
import org.springframework.web.servlet.ViewResolver;
import org.springframework.web.servlet.handler.AbstractUrlHandlerMapping;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import org.springframework.web.servlet.resource.ResourceHttpRequestHandler;
import org.springframework.web.servlet.view.UrlBasedViewResolver;
import org.springframework.web.servlet.view.xslt.XsltView;
import org.springframework.web.servlet.view.xslt.XsltViewResolver;

import static org.assertj.core.api.Assertions.assertThat;

/** Current application preconditions for CVE-2026-47884; this is not a library patch. */
@SpringBootTest(properties = {"app.opensearch.enabled=false"})
@Import(TestcontainersConfiguration.class)
class MvcXsltReachabilityTest {
    @Autowired ApplicationContext context;
    @Autowired @Qualifier("requestMappingHandlerMapping") RequestMappingHandlerMapping mappings;

    @Test
    void noXsltViewOrResolverIsConfigured() {
        assertThat(context.getBeansOfType(View.class).values()).noneMatch(XsltView.class::isInstance);
        var resolvers = context.getBeansOfType(ViewResolver.class).values();
        assertThat(resolvers).isNotEmpty().noneMatch(XsltViewResolver.class::isInstance);
        for (ViewResolver resolver : resolvers) {
            if (resolver instanceof UrlBasedViewResolver) {
                Class<?> viewClass = ReflectionTestUtils.invokeMethod(resolver, "getViewClass");
                assertThat(viewClass).isNotNull();
                assertThat(XsltView.class.isAssignableFrom(viewClass)).isFalse();
            }
        }
    }

    @Test
    void everyApplicationHandlerWritesAResponseBodyRatherThanAnImplicitView() {
        var handlers = mappings.getHandlerMethods().values().stream()
                .filter(handler -> handler.getBeanType().getPackageName().startsWith("cloud.leneu.jaywiki"))
                .toList();
        assertThat(handlers).isNotEmpty();
        for (var handler : handlers) {
            assertThat(AnnotatedElementUtils.hasAnnotation(handler.getBeanType(), ResponseBody.class)
                    || AnnotatedElementUtils.hasAnnotation(handler.getMethod(), ResponseBody.class))
                    .as("ResponseBody contract for %s", handler).isTrue();
        }
    }

    @Test
    void catchAllUrlHandlersOnlyServeStaticResources() {
        for (var mapping : context.getBeansOfType(AbstractUrlHandlerMapping.class).values()) {
            for (var entry : mapping.getHandlerMap().entrySet()) {
                if (entry.getKey().contains("**") || entry.getKey().contains("{*")) {
                    Object handler = entry.getValue();
                    if (handler instanceof String beanName) handler = context.getBean(beanName);
                    assertThat(handler).as("catch-all %s", entry.getKey())
                            .isInstanceOf(ResourceHttpRequestHandler.class);
                }
            }
        }
    }
}
