package com.healthapp.chatbot.model;

public record ContextFilePayload(
        String name,
        String contentType,
        String content,
        Long sizeBytes
) {
}
