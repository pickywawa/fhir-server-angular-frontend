package com.healthapp.chatbot.model.document;

import com.fasterxml.jackson.databind.JsonNode;

public record DocumentSummaryMetadata(
        String sessionId,
        String practitionerId,
        String patientId,
        JsonNode documentReference
) {
}
