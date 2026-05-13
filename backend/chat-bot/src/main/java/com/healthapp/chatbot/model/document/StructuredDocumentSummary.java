package com.healthapp.chatbot.model.document;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record StructuredDocumentSummary(
        @JsonAlias({"typeDocument", "documentType", "document_type"})
        @JsonProperty("type_document") String typeDocument,
        @JsonAlias({"title", "documentTitle"})
        @JsonProperty("titre") String titre,
        @JsonAlias({"dateDocument", "documentDate", "date"})
        @JsonProperty("date_document") String dateDocument,
        @JsonAlias({"author"})
        @JsonProperty("auteur") String auteur,
        @JsonAlias({"summary", "resume_text"})
        @JsonProperty("resume") String resume,
        @JsonAlias({"donneesCles", "keyData", "key_data", "highlights"})
        @JsonProperty("donnees_cles") List<KeyDataItem> donneesCles,
        @JsonAlias({"procedures"})
        @JsonProperty("actes") List<ProcedureItem> actes,
        @JsonAlias({"findings"})
        @JsonProperty("observations") List<ObservationItem> observations,
        @JsonAlias({"treatments", "medications"})
        @JsonProperty("traitements") List<TreatmentItem> traitements,
        @JsonAlias({"recommendations"})
        @JsonProperty("recommandations") List<String> recommandations,
        @JsonAlias({"alerts", "warnings"})
        @JsonProperty("alertes") List<AlertItem> alertes,
        @JsonProperty("metadata") Metadata metadata
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record KeyDataItem(
            @JsonProperty("type") String type,
            @JsonAlias({"name", "title"})
            @JsonProperty("label") String label,
            @JsonAlias({"value"})
            @JsonProperty("valeur") String valeur,
            @JsonAlias({"unit"})
            @JsonProperty("unite") String unite,
            @JsonProperty("date") String date
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ProcedureItem(
            @JsonAlias({"name", "label"})
            @JsonProperty("nom") String nom,
            @JsonProperty("date") String date,
            @JsonAlias({"status"})
            @JsonProperty("statut") String statut
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ObservationItem(
            @JsonProperty("description") String description,
            @JsonAlias({"severity"})
            @JsonProperty("gravite") String gravite,
            @JsonAlias({"location"})
            @JsonProperty("localisation") String localisation
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TreatmentItem(
            @JsonAlias({"name", "label"})
            @JsonProperty("nom") String nom,
            @JsonProperty("dosage") String dosage,
            @JsonAlias({"frequency"})
            @JsonProperty("frequence") String frequence,
            @JsonAlias({"duration"})
            @JsonProperty("duree") String duree
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AlertItem(
            @JsonProperty("message") String message,
            @JsonAlias({"level"})
            @JsonProperty("niveau") String niveau
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Metadata(
            @JsonProperty("confidence") Double confidence,
            @JsonAlias({"language"})
            @JsonProperty("langue") String langue,
            @JsonProperty("source") String source
    ) {
    }
}
