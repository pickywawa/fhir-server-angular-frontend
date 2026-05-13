package com.healthapp.chatbot.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthapp.chatbot.model.patient.PatientAnalysisRequest;
import com.healthapp.chatbot.model.patient.PatientAnalysisResponse;
import com.healthapp.chatbot.model.patient.StructuredPatientAnalysis;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class PatientAnalysisService {

    private final ObjectMapper objectMapper;
    private final WebClient ollamaWebClient;
    private final String ollamaModel;
    private final Double ollamaTemperature;
    private final Double ollamaTopP;
    private final Integer ollamaNumPredict;
    private final Integer ollamaNumCtx;

    public PatientAnalysisService(
            ObjectMapper objectMapper,
            @Value("${app.chatbot.ollama.base-url:http://localhost:11434}") String ollamaBaseUrl,
            @Value("${app.chatbot.ollama.model:qwen2.5:7b}") String ollamaModel,
            @Value("${app.chatbot.ollama.temperature:0.0}") Double ollamaTemperature,
            @Value("${app.chatbot.ollama.top-p:0.7}") Double ollamaTopP,
            @Value("${app.chatbot.ollama.num-predict:1200}") Integer ollamaNumPredict,
            @Value("${app.chatbot.ollama.num-ctx:8192}") Integer ollamaNumCtx
    ) {
        this.objectMapper = objectMapper;
        this.ollamaWebClient = WebClient.builder().baseUrl(Objects.requireNonNull(ollamaBaseUrl, "ollama base URL is required")).build();
        this.ollamaModel = ollamaModel;
        this.ollamaTemperature = ollamaTemperature;
        this.ollamaTopP = ollamaTopP;
        this.ollamaNumPredict = ollamaNumPredict;
        this.ollamaNumCtx = ollamaNumCtx;
    }

    public Mono<PatientAnalysisResponse> generateAnalysis(PatientAnalysisRequest request) {
        if (request == null || request.patientData() == null || request.patientData().isEmpty()) {
            return Mono.error(new ResponseStatusException(HttpStatusCode.valueOf(400), "patientData is required"));
        }

        String prompt = buildPrompt(request);
        return callOllama(prompt)
                .map(this::extractJsonPayload)
                .map(this::toResponse);
    }

    private String buildPrompt(PatientAnalysisRequest request) {
        String schema = """
                {
                  \"titre\": \"string\",
                  \"niveau_risque\": \"low | moderate | high | critical\",
                  \"score_risque\": 0,
                  \"resume_patient\": \"string\",
                  \"resume_interventions\": \"string\",
                  \"recommandations_suivi\": [\"string\"],
                  \"alertes\": [
                    {
                      \"label\": \"string\",
                      \"niveau\": \"info | warning | critical\",
                      \"raison\": \"string\"
                    }
                  ],
                  \"actions_prochaines\": [\"string\"],
                  \"metadata\": {
                    \"confidence\": 0.0,
                    \"generatedAt\": \"ISO-8601\",
                    \"model\": \"string\"
                  }
                }
                """;

        String payloadJson;
        try {
            payloadJson = objectMapper.writeValueAsString(request.patientData());
        } catch (JsonProcessingException e) {
            payloadJson = "{}";
        }

        return """
                Tu es un assistant clinique specialise dans la synthese de dossiers patient multi-sources.

                Tu dois analyser les donnees fournies puis produire une synthese actionnable pour un professionnel de sante.
                Concentre-toi sur:
                - resume clinique global
                - interventions, suivi et observance
                - signaux de risque et alertes prioritaires
                - prochaines actions concretement recommandeees

                Contraintes:
                - reponds UNIQUEMENT en JSON valide
                - aucune phrase hors JSON
                - respecte strictement le schema
                - score_risque entre 0 et 100
                - n'invente pas de donnees absentes

                Schema JSON attendu:
                %s

                Donnees patient:
                %s
                """.formatted(schema, payloadJson);
    }

    private Mono<String> callOllama(String prompt) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", ollamaModel);
        payload.put("prompt", prompt);
        payload.put("stream", false);
        payload.put("format", "json");
        payload.put("options", Map.of(
                "temperature", ollamaTemperature,
                "top_p", ollamaTopP,
                "num_predict", ollamaNumPredict,
                "num_ctx", ollamaNumCtx
        ));

        return ollamaWebClient.post()
                .uri("/api/generate")
            .contentType(Objects.requireNonNull(MediaType.APPLICATION_JSON))
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(Map.class)
                .map(body -> Objects.toString(body.get("response"), ""));
    }

    private String extractJsonPayload(String modelAnswer) {
        if (modelAnswer == null || modelAnswer.isBlank()) {
            throw new ResponseStatusException(HttpStatusCode.valueOf(502), "AI model returned an empty payload");
        }

        String raw = modelAnswer.trim();
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return raw.substring(start, end + 1);
        }

        throw new ResponseStatusException(HttpStatusCode.valueOf(502), "AI model did not return valid JSON");
    }

    private PatientAnalysisResponse toResponse(String json) {
        try {
            StructuredPatientAnalysis structured = objectMapper.readValue(json, StructuredPatientAnalysis.class);
            StructuredPatientAnalysis.Metadata metadata = structured.metadata() == null
                    ? new StructuredPatientAnalysis.Metadata(0.0, Instant.now().toString(), ollamaModel)
                    : structured.metadata();

            List<PatientAnalysisResponse.Alert> alerts = safeList(structured.alertes()).stream()
                    .map(item -> new PatientAnalysisResponse.Alert(
                            firstNonBlank(item.label(), "Alerte"),
                            normalizeSeverity(item.niveau()),
                            firstNonBlank(item.raison(), "")
                    ))
                    .toList();

            return new PatientAnalysisResponse(
                    firstNonBlank(structured.titre(), "Analyse patient"),
                    normalizeRiskLevel(structured.niveauRisque()),
                    clampRiskScore(structured.scoreRisque()),
                    firstNonBlank(structured.resumePatient(), "Aucun resume clinique genere."),
                    firstNonBlank(structured.resumeInterventions(), "Aucun resume d interventions genere."),
                    safeList(structured.recommandationsSuivi()),
                    alerts,
                    safeList(structured.actionsProchaines()),
                    new PatientAnalysisResponse.Metadata(
                            metadata.confidence() == null ? 0.0 : metadata.confidence(),
                            firstNonBlank(metadata.generatedAt(), Instant.now().toString()),
                            firstNonBlank(metadata.model(), ollamaModel)
                    ),
                    json
            );
        } catch (JsonProcessingException ex) {
            return new PatientAnalysisResponse(
                    "Analyse patient",
                    "moderate",
                    50,
                    "Impossible de parser la reponse structuree du modele.",
                    "Verifier les donnees source et relancer l analyse.",
                    List.of("Relancer l analyse", "Verifier la qualite des donnees cliniques"),
                    List.of(),
                    List.of(),
                    new PatientAnalysisResponse.Metadata(0.0, Instant.now().toString(), ollamaModel),
                    json
            );
        }
    }

    private String normalizeRiskLevel(String value) {
        String normalized = firstNonBlank(value, "moderate").toLowerCase();
        return switch (normalized) {
            case "low", "faible" -> "low";
            case "high", "eleve", "élevé" -> "high";
            case "critical", "critique" -> "critical";
            default -> "moderate";
        };
    }

    private String normalizeSeverity(String value) {
        String normalized = firstNonBlank(value, "info").toLowerCase();
        return switch (normalized) {
            case "critical", "critique" -> "critical";
            case "warning", "warn", "alerte" -> "warning";
            default -> "info";
        };
    }

    private Integer clampRiskScore(Double score) {
        int value = score == null ? 50 : (int) Math.round(score);
        if (value < 0) {
            return 0;
        }
        if (value > 100) {
            return 100;
        }
        return value;
    }

    private String firstNonBlank(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }

    private <T> List<T> safeList(List<T> values) {
        return values == null ? List.of() : values;
    }
}
