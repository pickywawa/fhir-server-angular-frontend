package com.healthapp.chatbot.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestTracingWebFilter implements WebFilter {

    private static final Logger logger = LoggerFactory.getLogger(RequestTracingWebFilter.class);

    @Override
    public @NonNull Mono<Void> filter(@NonNull ServerWebExchange exchange, @NonNull WebFilterChain chain) {
        String method = exchange.getRequest().getMethod() == null ? "UNKNOWN" : exchange.getRequest().getMethod().name();
        String path = exchange.getRequest().getPath().pathWithinApplication().value();
        String query = exchange.getRequest().getURI().getRawQuery();
        String contentType = exchange.getRequest().getHeaders().getFirst("Content-Type");
        String origin = exchange.getRequest().getHeaders().getFirst("Origin");

        if (path.startsWith("/api/v1/document-summaries")) {
            logger.info("[RequestTrace] IN {} {}{} contentType={} origin={}",
                    method,
                    path,
                    query == null ? "" : "?" + query,
                    contentType,
                    origin);
        }

        return chain.filter(exchange)
                .doOnSuccess(unused -> {
                    if (path.startsWith("/api/v1/document-summaries")) {
                        logger.info("[RequestTrace] OUT {} {} status={}",
                                method,
                                path,
                                exchange.getResponse().getStatusCode());
                    }
                })
                .doOnError(error -> {
                    if (path.startsWith("/api/v1/document-summaries")) {
                        logger.error("[RequestTrace] ERROR {} {}", method, path, error);
                    }
                });
    }
}
