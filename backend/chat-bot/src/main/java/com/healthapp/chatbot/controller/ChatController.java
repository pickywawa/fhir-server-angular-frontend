package com.healthapp.chatbot.controller;

import com.healthapp.chatbot.model.ChatRequest;
import com.healthapp.chatbot.model.ChatResponse;
import com.healthapp.chatbot.model.StreamEvent;
import com.healthapp.chatbot.service.ChatBotService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/chat")
public class ChatController {

    private static final Logger logger = LoggerFactory.getLogger(ChatController.class);

    private final ChatBotService chatBotService;

    public ChatController(ChatBotService chatBotService) {
        this.chatBotService = chatBotService;
    }

    @PostMapping
    public ChatResponse chat(@Valid @RequestBody ChatRequest request) {
        String sessionId = effectiveSessionId(request.sessionId());
        logger.info("[chat][in] sessionId={}, practitionerId={}, patientId={}, fromUrl={}, message={}",
                sessionId,
                request.practitionerId(),
                request.patientId(),
                request.fromUrl(),
                truncate(request.message()));

        String response = chatBotService.chat(
                request.message(),
                sessionId,
                request.practitionerId(),
                request.patientId(),
                request.fromUrl()
        );

        ChatResponse chatResponse = new ChatResponse(sessionId, response, Instant.now());
        logger.info("[chat][out] sessionId={}, response={}", sessionId, truncate(chatResponse.response()));
        return chatResponse;
    }

    @PostMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<StreamEvent>> stream(@Valid @RequestBody ChatRequest request) {
        String sessionId = effectiveSessionId(request.sessionId());
        logger.info("[stream][in] sessionId={}, practitionerId={}, patientId={}, fromUrl={}, message={}",
            sessionId,
            request.practitionerId(),
            request.patientId(),
            request.fromUrl(),
            truncate(request.message()));

        return chatBotService.stream(
                request.message(),
                sessionId,
                request.practitionerId(),
                request.patientId(),
                request.fromUrl()
            )
            .doOnError(ex -> logger.warn("[stream][error] sessionId={}, message={}", sessionId, ex.getMessage()));
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        logger.info("[health][in] request received");
        Map<String, String> response = Map.of("status", "UP", "service", "chat-bot");
        logger.info("[health][out] response={}", response);
        return response;
    }

    private String effectiveSessionId(String sessionId) {
        return (sessionId == null || sessionId.isBlank()) ? UUID.randomUUID().toString() : sessionId;
    }

    private String truncate(String value) {
        if (value == null) {
            return "";
        }
        int maxLen = 3000;
        return value.length() <= maxLen ? value : value.substring(0, maxLen) + "...";
    }
}
