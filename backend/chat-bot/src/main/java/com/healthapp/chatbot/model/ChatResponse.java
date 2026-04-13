package com.healthapp.chatbot.model;

import java.time.Instant;

public record ChatResponse(
        String sessionId,
        String response,
        Instant timestamp
) {
}
