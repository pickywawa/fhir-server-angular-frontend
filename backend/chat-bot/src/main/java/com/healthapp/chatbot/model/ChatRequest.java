package com.healthapp.chatbot.model;

import jakarta.validation.constraints.NotBlank;

public record ChatRequest(
        String sessionId,
        @NotBlank(message = "message is required") String message,
        String practitionerId,
        String patientId,
        String fromUrl
) {
}
