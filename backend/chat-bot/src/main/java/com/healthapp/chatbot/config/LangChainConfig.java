package com.healthapp.chatbot.config;

import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.chat.StreamingChatLanguageModel;
import dev.langchain4j.model.ollama.OllamaChatModel;
import dev.langchain4j.model.ollama.OllamaStreamingChatModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Configuration
public class LangChainConfig {

    @Bean
    public ChatLanguageModel ollamaChatLanguageModel(
            @Value("${app.chatbot.ollama.base-url:http://localhost:11434}") String baseUrl,
            @Value("${app.chatbot.ollama.model:qwen2.5:7b}") String model,
            @Value("${app.chatbot.ollama.temperature:0.15}") Double temperature,
            @Value("${app.chatbot.ollama.top-p:0.85}") Double topP,
            @Value("${app.chatbot.ollama.timeout:240s}") Duration timeout,
            @Value("${app.chatbot.ollama.num-ctx:4096}") Integer numCtx
    ) {
        return OllamaChatModel.builder()
                .baseUrl(baseUrl)
                .modelName(model)
                .temperature(temperature)
                .topP(topP)
                .timeout(timeout)
                .numCtx(numCtx)
                .build();
    }

    @Bean
    public StreamingChatLanguageModel ollamaStreamingChatLanguageModel(
            @Value("${app.chatbot.ollama.base-url:http://localhost:11434}") String baseUrl,
                        @Value("${app.chatbot.ollama.model:qwen2.5:7b}") String model,
                        @Value("${app.chatbot.ollama.temperature:0.15}") Double temperature,
                        @Value("${app.chatbot.ollama.top-p:0.85}") Double topP,
                        @Value("${app.chatbot.ollama.timeout:240s}") Duration timeout,
                        @Value("${app.chatbot.ollama.num-ctx:4096}") Integer numCtx
    ) {
        return OllamaStreamingChatModel.builder()
                .baseUrl(baseUrl)
                .modelName(model)
                .temperature(temperature)
                                .topP(topP)
                .timeout(timeout)
                .numCtx(numCtx)
                .build();
    }
}