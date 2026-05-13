package com.healthapp.chatbot.model.document;

public record DocumentSummaryResponse(
        String title,
        String resume,
        String description,
        StructuredDocumentSummary summary,
        String rawJson
) {
}
