package com.healthapp.chatbot.model.patient;

import java.util.List;

public record PatientAnalysisResponse(
        String title,
        String riskLevel,
        Integer riskScore,
        String clinicalSummary,
        String interventionsSummary,
        List<String> followUpRecommendations,
        List<Alert> alerts,
        List<String> nextActions,
        Metadata metadata,
        String rawJson
) {

    public record Alert(
            String label,
            String severity,
            String rationale
    ) {
    }

    public record Metadata(
            Double confidence,
            String generatedAt,
            String model
    ) {
    }
}
