package com.healthapp.chatbot.model.patient;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record StructuredPatientAnalysis(
        @JsonAlias({"title"})
        @JsonProperty("titre") String titre,
        @JsonAlias({"risk_level"})
        @JsonProperty("niveau_risque") String niveauRisque,
        @JsonAlias({"risk_score"})
        @JsonProperty("score_risque") Double scoreRisque,
        @JsonAlias({"patient_summary"})
        @JsonProperty("resume_patient") String resumePatient,
        @JsonAlias({"interventions_summary"})
        @JsonProperty("resume_interventions") String resumeInterventions,
        @JsonAlias({"follow_up_recommendations"})
        @JsonProperty("recommandations_suivi") List<String> recommandationsSuivi,
        @JsonProperty("alertes") List<AlertItem> alertes,
        @JsonAlias({"next_actions"})
        @JsonProperty("actions_prochaines") List<String> actionsProchaines,
        @JsonProperty("metadata") Metadata metadata
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AlertItem(
            @JsonAlias({"name"})
            @JsonProperty("label") String label,
            @JsonAlias({"severity"})
            @JsonProperty("niveau") String niveau,
            @JsonAlias({"rationale"})
            @JsonProperty("raison") String raison
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Metadata(
            @JsonProperty("confidence") Double confidence,
            @JsonAlias({"generated_at"})
            @JsonProperty("generatedAt") String generatedAt,
            @JsonProperty("model") String model
    ) {
    }
}
