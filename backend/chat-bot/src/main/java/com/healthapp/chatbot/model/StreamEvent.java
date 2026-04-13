package com.healthapp.chatbot.model;

public record StreamEvent(
        String sessionId,
        String type,
        String content
) {
}
