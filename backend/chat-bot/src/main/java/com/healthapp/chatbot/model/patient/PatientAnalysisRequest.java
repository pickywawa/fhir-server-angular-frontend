package com.healthapp.chatbot.model.patient;

import java.util.Map;

public record PatientAnalysisRequest(
        String sessionId,
        String patientId,
        String practitionerId,
        Map<String, Object> patientData,
        Map<String, Object> options
) {
}
