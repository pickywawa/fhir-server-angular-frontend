package com.healthapp.chatbot.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Objects;

@Configuration
public class WebClientConfig {

    @Bean
    @SuppressWarnings("null")
    public WebClient fhirWebClient(@Value("${app.fhir.base-url}") @NonNull String fhirBaseUrl) {
        return WebClient.builder()
                .baseUrl(Objects.requireNonNull(fhirBaseUrl, "app.fhir.base-url is required"))
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }
}
