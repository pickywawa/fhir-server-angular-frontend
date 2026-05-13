package com.healthapp.chatbot.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthapp.chatbot.model.document.DocumentSummaryMetadata;
import com.healthapp.chatbot.model.document.DocumentSummaryResponse;
import com.healthapp.chatbot.model.document.StructuredDocumentSummary;
import dev.langchain4j.data.document.Document;
import dev.langchain4j.data.document.splitter.DocumentSplitters;
import dev.langchain4j.data.segment.TextSegment;
import org.apache.tika.Tika;
import org.apache.tika.exception.TikaException;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.metadata.TikaCoreProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.codec.multipart.FilePart;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class DocumentSummaryService {

    private static final Logger logger = LoggerFactory.getLogger(DocumentSummaryService.class);

    private final ObjectMapper objectMapper;
    private final WebClient ollamaWebClient;
    private final String ollamaModel;
    private final Double ollamaTemperature;
    private final Double ollamaTopP;
    private final Integer ollamaNumPredict;
    private final Integer ollamaNumCtx;
    private final Integer maxInputChars;

    public DocumentSummaryService(
            ObjectMapper objectMapper,
            @Value("${app.chatbot.ollama.base-url:http://localhost:11434}") String ollamaBaseUrl,
            @Value("${app.chatbot.ollama.model:qwen2.5:7b}") String ollamaModel,
            @Value("${app.chatbot.ollama.temperature:0.0}") Double ollamaTemperature,
            @Value("${app.chatbot.ollama.top-p:0.7}") Double ollamaTopP,
            @Value("${app.chatbot.ollama.num-predict:700}") Integer ollamaNumPredict,
            @Value("${app.chatbot.ollama.num-ctx:4096}") Integer ollamaNumCtx,
            @Value("${app.chatbot.document-summary.max-input-chars:9000}") Integer maxInputChars
    ) {
        this.objectMapper = objectMapper;
        this.ollamaWebClient = WebClient.builder().baseUrl(Objects.requireNonNull(ollamaBaseUrl, "ollama base URL is required")).build();
        this.ollamaModel = ollamaModel;
        this.ollamaTemperature = ollamaTemperature;
        this.ollamaTopP = ollamaTopP;
        this.ollamaNumPredict = ollamaNumPredict;
        this.ollamaNumCtx = ollamaNumCtx;
        this.maxInputChars = maxInputChars;
    }

    public DocumentSummaryMetadata parseMetadata(String metadataJson) {
        logger.info("[DocumentSummaryService] parseMetadata called. chars={}", metadataJson == null ? 0 : metadataJson.length());
        try {
            DocumentSummaryMetadata parsed = objectMapper.readValue(metadataJson, DocumentSummaryMetadata.class);
            logger.info("[DocumentSummaryService] metadata parsed: patientId={} practitionerId={} hasDocumentReference={}",
                    parsed.patientId(),
                    parsed.practitionerId(),
                    parsed.documentReference() != null);
            return parsed;
        } catch (JsonProcessingException ex) {
            String rawMetadata = metadataJson == null ? "null" : metadataJson;
            logger.error("[DocumentSummaryService] Invalid metadata JSON. FULL BEGIN\n{}\n[DocumentSummaryService] Invalid metadata JSON FULL END", rawMetadata, ex);
            throw new ResponseStatusException(HttpStatusCode.valueOf(400), "Invalid metadata JSON", ex);
        }
    }

    public Mono<DocumentSummaryResponse> generateSummary(DocumentSummaryMetadata metadata, FilePart documentPart) {
        if (documentPart == null) {
            return Mono.error(new ResponseStatusException(HttpStatusCode.valueOf(400), "document is required"));
        }

        logger.info("[DocumentSummaryService] generateSummary start. fileName={} headerContentType={} patientId={} practitionerId={}",
                documentPart.filename(),
                documentPart.headers().getContentType(),
                metadata == null ? null : metadata.patientId(),
                metadata == null ? null : metadata.practitionerId());

        return DataBufferUtils.join(documentPart.content())
                .flatMap(dataBuffer -> {
                    byte[] bytes = new byte[dataBuffer.readableByteCount()];
                    dataBuffer.read(bytes);
                    DataBufferUtils.release(dataBuffer);
                    logger.info("[DocumentSummaryService] document bytes read={}", bytes.length);
                    return Mono.just(bytes);
                })
                .flatMap(bytes -> {
                    String contentType = normalizeContentType(documentPart.headers().getContentType());
                    String extractedText = extractText(bytes, contentType, documentPart.filename());
                    String compactText = normalizeText(extractedText);
                    List<String> chunks = splitWithLangChain(compactText);
                    String limitedText = limitInput(String.join("\n\n", chunks));
                    String prompt = buildPrompt(metadata, contentType, documentPart.filename(), limitedText);

                    logger.info("[DocumentSummaryService] extraction done. extractedChars={} compactChars={} chunks={} limitedChars={} promptChars={}",
                            extractedText == null ? 0 : extractedText.length(),
                            compactText.length(),
                            chunks.size(),
                            limitedText.length(),
                            prompt.length());

                        logger.info("[DocumentSummaryService] LLM prompt BEGIN\n{}\n[DocumentSummaryService] LLM prompt END", prompt);

                    return callOllama(prompt)
                            .doOnNext(modelResponse -> {
                            logger.info("[DocumentSummaryService] Ollama response chars={}", modelResponse == null ? 0 : modelResponse.length());
                            logger.info("[DocumentSummaryService] LLM raw response BEGIN\n{}\n[DocumentSummaryService] LLM raw response END", modelResponse);
                            })
                            .map(this::extractJsonPayload)
                            .doOnNext(json -> logger.info("[DocumentSummaryService] LLM extracted JSON BEGIN\n{}\n[DocumentSummaryService] LLM extracted JSON END", json))
                            .map(json -> toResponse(json, limitedText))
                            .doOnSuccess(response -> logger.info("[DocumentSummaryService] response built. title={} descriptionChars={}",
                                    response.title(),
                                    response.description() == null ? 0 : response.description().length()));
                });
    }

    private String normalizeContentType(MediaType contentType) {
        if (contentType == null) {
            return MediaType.APPLICATION_OCTET_STREAM_VALUE;
        }
        return contentType.toString();
    }

    private String extractText(byte[] content, String contentType, String fileName) {
        try {
            Metadata tikaMetadata = new Metadata();
            tikaMetadata.set(Metadata.CONTENT_TYPE, contentType);
            tikaMetadata.set(TikaCoreProperties.RESOURCE_NAME_KEY, fileName);

            Tika tika = new Tika();
            String extracted = tika.parseToString(new ByteArrayInputStream(content), tikaMetadata);
            if (extracted != null && !extracted.isBlank()) {
                return extracted;
            }
        } catch (IOException | TikaException ex) {
            logger.warn("Unable to extract text with Tika: {}", ex.getMessage());
        }

        if (contentType.startsWith("text/")) {
            return new String(content, StandardCharsets.UTF_8);
        }

        return "";
    }

    private String normalizeText(String rawText) {
        String value = rawText == null ? "" : rawText;
        value = value.replace("\r\n", "\n").replace("\r", "\n");
        value = value.replaceAll("\\n{3,}", "\n\n");
        return value.trim();
    }

    private List<String> splitWithLangChain(String text) {
        if (text == null || text.isBlank()) {
            return List.of("");
        }

        List<TextSegment> segments = DocumentSplitters.recursive(1800, 200)
                .split(Document.from(text));

        if (segments.isEmpty()) {
            return List.of(text);
        }

        return segments.stream().map(TextSegment::text).toList();
    }

    private String limitInput(String text) {
        if (text.length() <= maxInputChars) {
            return text;
        }
        return text.substring(0, maxInputChars);
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

        logger.info("[DocumentSummaryService] Ollama request payload BEGIN\n{}\n[DocumentSummaryService] Ollama request payload END", toJson(payload));

        return ollamaWebClient.post()
                .uri("/api/generate")
            .contentType(Objects.requireNonNull(MediaType.APPLICATION_JSON))
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(Map.class)
                .doOnNext(body -> logger.info("[DocumentSummaryService] Ollama raw HTTP body BEGIN\n{}\n[DocumentSummaryService] Ollama raw HTTP body END", toJson(body)))
                .doOnError(WebClientResponseException.class, ex -> logger.error("[DocumentSummaryService] Ollama HTTP error status={} body={}", ex.getStatusCode(), ex.getResponseBodyAsString()))
                .doOnError(ex -> logger.error("[DocumentSummaryService] Ollama call failed", ex))
                .map(body -> Objects.toString(body.get("response"), ""));
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            return String.valueOf(value);
        }
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

    private DocumentSummaryResponse toResponse(String json, String extractedText) {
        try {
            StructuredDocumentSummary summary = objectMapper.readValue(json, StructuredDocumentSummary.class);
            summary = withNonNullLists(summary);
            String renderedDescription = buildHumanSummary(summary);
            String shortResume = clampResume(summary.resume(), extractedText);
            if (isEffectivelyEmpty(summary)) {
                logger.warn("[DocumentSummaryService] Structured summary parsed but empty. Falling back to extracted text.");
                renderedDescription = "# Resume\n\n" + firstNonBlank(compactPreview(extractedText), "Aucun texte exploitable n'a ete detecte.");
            }
            String title = firstNonBlank(summary.titre(), "Resume de document");
            return new DocumentSummaryResponse(title, shortResume, renderedDescription, summary, json);
        } catch (JsonProcessingException ex) {
            logger.warn("Unable to parse structured summary JSON: {}", ex.getMessage());
            StructuredDocumentSummary fallback = new StructuredDocumentSummary(
                    "autre",
                    "Resume de document",
                    null,
                    null,
                    firstNonBlank(extractedText, "Aucun texte exploitable n'a ete detecte."),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    new StructuredDocumentSummary.Metadata(0.0, "fr", "texte")
            );
            String shortResume = clampResume(fallback.resume(), extractedText);
            return new DocumentSummaryResponse("Resume de document", shortResume, fallback.resume(), fallback, json);
        }
    }

    private String clampResume(String resume, String fallbackText) {
        String value = firstNonBlank(resume, compactPreview(fallbackText));
        if (value.length() <= 1000) {
            return value;
        }
        return value.substring(0, 1000);
    }

    private boolean isEffectivelyEmpty(StructuredDocumentSummary summary) {
        return (summary.titre() == null || summary.titre().isBlank())
                && (summary.resume() == null || summary.resume().isBlank())
                && safeList(summary.donneesCles()).isEmpty()
                && safeList(summary.actes()).isEmpty()
                && safeList(summary.observations()).isEmpty()
                && safeList(summary.traitements()).isEmpty()
                && safeList(summary.recommandations()).isEmpty()
                && safeList(summary.alertes()).isEmpty();
    }

    private String compactPreview(String value) {
        String normalized = normalizeText(firstNonBlank(value, ""));
        if (normalized.length() <= 1600) {
            return normalized;
        }
        return normalized.substring(0, 1600) + "...";
    }

    private String buildPrompt(DocumentSummaryMetadata metadata, String contentType, String filename, String text) {
        String schema = """
                {
                  \"type_document\": \"medical_report | ordonnance | image | facture | autre\",
                  \"titre\": \"string\",
                  \"date_document\": \"YYYY-MM-DD | null\",
                  \"auteur\": \"string | null\",
                  \"resume\": \"string (max 1000 caracteres)\",
                  \"donnees_cles\": [
                    {
                      \"type\": \"observation | acte | medicament | administratif | autre\",
                      \"label\": \"string\",
                      \"valeur\": \"string\",
                      \"unite\": \"string | null\",
                      \"date\": \"string | null\"
                    }
                  ],
                  \"actes\": [
                    {
                      \"nom\": \"string\",
                      \"date\": \"string | null\",
                      \"statut\": \"realise | planifie | suggere\"
                    }
                  ],
                  \"observations\": [
                    {
                      \"description\": \"string\",
                      \"gravite\": \"faible | moderee | elevee | critique\",
                      \"localisation\": \"string | null\"
                    }
                  ],
                  \"traitements\": [
                    {
                      \"nom\": \"string\",
                      \"dosage\": \"string | null\",
                      \"frequence\": \"string | null\",
                      \"duree\": \"string | null\"
                    }
                  ],
                  \"recommandations\": [\"string\"],
                  \"alertes\": [
                    {
                      \"message\": \"string\",
                      \"niveau\": \"info | warning | critique\"
                    }
                  ],
                  \"metadata\": {
                    \"confidence\": 0.0,
                    \"langue\": \"fr\",
                    \"source\": \"ocr | texte | image\"
                  }
                }
                """;

        String metadataPayload;
        try {
            Map<String, Object> promptMetadata = new LinkedHashMap<>();
            promptMetadata.put("sessionId", metadata.sessionId());
            promptMetadata.put("practitionerId", metadata.practitionerId());
            promptMetadata.put("patientId", metadata.patientId());
            promptMetadata.put("fileName", filename);
            promptMetadata.put("contentType", contentType);
            promptMetadata.put("documentReference", metadata.documentReference());
            promptMetadata.put("codingStandards", List.of("LOINC", "SNOMED CT"));
            metadataPayload = objectMapper.writeValueAsString(promptMetadata);
        } catch (JsonProcessingException e) {
            metadataPayload = "{}";
        }

        return """
                Tu es un assistant specialise dans l'analyse de documents de sante et administratifs.

                Analyse le document et produis un JSON structure.

                IMPORTANT:
                - Reponds UNIQUEMENT en JSON valide
                - Ne mets aucun texte en dehors du JSON
                - Respecte strictement le format fourni
                - Le champ resume doit faire maximum 1000 caracteres
                - Si une information est absente, mets null ou []
                - Ne devine pas
                - Utilise les terminologies standards LOINC et SNOMED CT quand c'est pertinent

                FORMAT JSON:
                %s

                Metadonnees:
                %s

                Document:
                %s
                """.formatted(schema, metadataPayload, text);
    }

    private String buildHumanSummary(StructuredDocumentSummary summary) {
        List<String> lines = new ArrayList<>();
        lines.add("# " + firstNonBlank(summary.titre(), "Resume"));

        if (summary.resume() != null && !summary.resume().isBlank()) {
            lines.add("");
            lines.add("## Resume");
            lines.add(summary.resume().trim());
        }

        appendList(lines, "Donnees cles", safeList(summary.donneesCles()).stream()
            .map(item -> formatKeyData(item))
            .collect(Collectors.toList()));

        appendList(lines, "Actes", safeList(summary.actes()).stream()
            .map(item -> "- " + firstNonBlank(item.nom(), "Acte") +
                valueSuffix("date", item.date()) +
                valueSuffix("statut", item.statut()))
            .collect(Collectors.toList()));

        appendList(lines, "Observations", safeList(summary.observations()).stream()
            .map(item -> "- " + firstNonBlank(item.description(), "Observation") +
                valueSuffix("gravite", item.gravite()) +
                valueSuffix("localisation", item.localisation()))
            .collect(Collectors.toList()));

        appendList(lines, "Traitements", safeList(summary.traitements()).stream()
            .map(item -> "- " + firstNonBlank(item.nom(), "Traitement") +
                valueSuffix("dosage", item.dosage()) +
                valueSuffix("frequence", item.frequence()) +
                valueSuffix("duree", item.duree()))
            .collect(Collectors.toList()));

        appendList(lines, "Recommandations", safeList(summary.recommandations()).stream()
            .map(value -> "- " + value)
            .collect(Collectors.toList()));

        appendList(lines, "Alertes", safeList(summary.alertes()).stream()
            .map(item -> "- " + firstNonBlank(item.message(), "Alerte") +
                valueSuffix("niveau", item.niveau()))
            .collect(Collectors.toList()));

        return lines.stream().collect(Collectors.joining("\n"));
        }

        // Defensive: replace null lists with empty lists
        private StructuredDocumentSummary withNonNullLists(StructuredDocumentSummary s) {
        return new StructuredDocumentSummary(
            s.typeDocument(),
            s.titre(),
            s.dateDocument(),
            s.auteur(),
            s.resume(),
            safeList(s.donneesCles()),
            safeList(s.actes()),
            safeList(s.observations()),
            safeList(s.traitements()),
            safeList(s.recommandations()),
            safeList(s.alertes()),
            s.metadata()
        );
        }

        private <T> List<T> safeList(List<T> list) {
        return list == null ? List.of() : list;
        }

    private void appendList(List<String> lines, String title, List<String> values) {
        List<String> safeValues = values == null ? List.of() : values.stream().filter(Objects::nonNull).toList();
        if (safeValues.isEmpty()) {
            return;
        }

        lines.add("");
        lines.add("## " + title);
        lines.addAll(safeValues);
    }

    private String formatKeyData(StructuredDocumentSummary.KeyDataItem item) {
        return "- " + firstNonBlank(item.label(), "Donnee") +
                valueSuffix("type", item.type()) +
                valueSuffix("valeur", item.valeur()) +
                valueSuffix("unite", item.unite()) +
                valueSuffix("date", item.date());
    }

    private String valueSuffix(String key, String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return " (" + key + ": " + value + ")";
    }

    private String firstNonBlank(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }
}
