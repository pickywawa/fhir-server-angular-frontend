package com.healthapp.chatbot.model;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record ChatRequest(
        String sessionId,
        @NotBlank(message = "message is required") String message,
        String practitionerId,
        String patientId,
        String fromUrl,
        List<ContextFilePayload> contextFiles
) {
}
