package com.healthapp.chatbot.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.agent.tool.P;
import dev.langchain4j.agent.tool.Tool;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.StringJoiner;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class FhirToolService {

    private static final Logger logger = LoggerFactory.getLogger(FhirToolService.class);
    private static final Duration TOOL_TIMEOUT = Duration.ofSeconds(20);
    private static final @NonNull ParameterizedTypeReference<Map<String, Object>> MAP_TYPE = new ParameterizedTypeReference<>() {};
    private static final Pattern QUESTION_LINE_PATTERN = Pattern.compile("(?m)^(?:[-*]|\\d+[\\).])\\s*(.{6,220}\\?)$");

    private final WebClient fhirWebClient;
    private final ObjectMapper objectMapper;
    private final ToolEventPublisher toolEventPublisher;
    private final ChatSessionContext chatSessionContext;
    private final ContextFileSessionStore contextFileSessionStore;

    public FhirToolService(
            WebClient fhirWebClient,
            ObjectMapper objectMapper,
            ToolEventPublisher toolEventPublisher,
            ChatSessionContext chatSessionContext,
            ContextFileSessionStore contextFileSessionStore
    ) {
        this.fhirWebClient = fhirWebClient;
        this.objectMapper = objectMapper;
        this.toolEventPublisher = toolEventPublisher;
        this.chatSessionContext = chatSessionContext;
        this.contextFileSessionStore = contextFileSessionStore;
    }

    @Tool("Searches relevant passages inside attached context files for the current chat session.")
    public String searchInContextFile(
            @P("Text query to search inside context files") String query,
            @P("Optional file name filter, leave empty to search all attached files") String fileName
    ) {
        return executeTool(
                "searchInContextFile",
                Map.of("query", safe(query), "fileName", safe(fileName)),
                () -> {
                    String sessionId = safe(chatSessionContext.getCurrentSessionId());
                    if (sessionId.isBlank()) {
                        throw new IllegalStateException("No active chat session for context file search");
                    }

                    String normalizedQuery = normalizeRequired(query, "query");
                    String normalizedFileName = safe(fileName).trim();

                    String result = contextFileSessionStore.search(
                            sessionId,
                            normalizedQuery,
                            normalizedFileName.isBlank() ? null : normalizedFileName
                    );
                    return result;
                }
        );
    }

    @Tool("Searches patients by free text (name or identifier).")
    public String searchPatients(@P("Free text query") String query) {
        return executeTool("searchPatients", Map.of("query", safe(query)), () -> {
            String normalizedQuery = safe(query).trim();
            if (normalizedQuery.isBlank()) {
                return "query is required";
            }

            String[] parts = normalizedQuery.split("\\s+");
            if (parts.length >= 2) {
                String family = parts[0];
                String given = String.join(" ", java.util.Arrays.copyOfRange(parts, 1, parts.length));

                Map<String, Object> byFamilyGiven = searchPatientBundle(Map.of("family", family, "given", given));
                if (hasEntries(byFamilyGiven)) {
                    return summarizeBundle(byFamilyGiven, "Patient");
                }

                String familyInverted = parts[parts.length - 1];
                String givenInverted = String.join(" ", java.util.Arrays.copyOfRange(parts, 0, parts.length - 1));
                Map<String, Object> byInvertedName = searchPatientBundle(Map.of("family", familyInverted, "given", givenInverted));
                if (hasEntries(byInvertedName)) {
                    return summarizeBundle(byInvertedName, "Patient");
                }
            }

            Map<String, Object> byIdentifier = searchPatientBundle(Map.of("identifier", normalizedQuery));
            if (hasEntries(byIdentifier)) {
                return summarizeBundle(byIdentifier, "Patient");
            }

            Map<String, Object> byName = searchPatientBundle(Map.of("name", normalizedQuery));
            return summarizeBundle(byName, "Patient");
        });
    }

    @SuppressWarnings("null")
    private Map<String, Object> searchPatientBundle(Map<String, String> criteria) {
        return fhirWebClient.get()
                .uri(uriBuilder -> {
                    var builder = uriBuilder.path("/Patient")
                            .queryParam("_count", 5)
                            .queryParam("_summary", "true");
                    criteria.forEach((k, v) -> {
                        if (v != null && !v.isBlank()) {
                            builder.queryParam(Objects.requireNonNull(k), Objects.requireNonNull(v));
                        }
                    });
                    return builder.build();
                })
                .retrieve()
                .bodyToMono(MAP_TYPE)
                .timeout(TOOL_TIMEOUT)
                .block();
    }

    private boolean hasEntries(Map<String, Object> bundle) {
        if (bundle == null || bundle.isEmpty()) {
            return false;
        }
        Object entriesObj = bundle.get("entry");
        return entriesObj instanceof List<?> entries && !entries.isEmpty();
    }

    @Tool("Searches resources of a given FHIR type with query params formatted as key=value&key2=value2.")
    public String searchResource(
            @P("FHIR resource type, for example Patient, CarePlan or Appointment") String resourceType,
            @P("Query params, for example name=Dupont&status=active") String query
    ) {
        return executeTool("searchResource", Map.of("resourceType", safe(resourceType), "query", safe(query)), () -> {
            String type = normalizeResourceType(resourceType);
            Map<String, String> params = parseQuery(query);

            Map<String, Object> bundle = fhirWebClient.get()
                    .uri(uriBuilder -> {
                        var builder = uriBuilder.path("/" + type).queryParam("_count", 30);
                        params.forEach(builder::queryParam);
                        return builder.build();
                    })
                    .retrieve()
                    .bodyToMono(MAP_TYPE)
                    .timeout(TOOL_TIMEOUT)
                    .block();

            return summarizeBundle(bundle, type);
        });
    }

    @Tool("Reads one FHIR resource by type and id.")
    public String getResource(
            @P("FHIR resource type") String resourceType,
            @P("FHIR resource id") String resourceId
    ) {
        return executeTool("getResource", Map.of("resourceType", safe(resourceType), "resourceId", safe(resourceId)), () -> {
            String type = normalizeResourceType(resourceType);
            String id = normalizeRequired(resourceId, "resourceId");

            Map<String, Object> resource = fhirWebClient.get()
                    .uri("/" + type + "/" + id)
                    .retrieve()
                    .bodyToMono(MAP_TYPE)
                    .timeout(TOOL_TIMEOUT)
                    .block();

            if (resource == null || resource.isEmpty()) {
                return "No resource found for " + type + "/" + id;
            }
            return compactJson(resource);
        });
    }

    @Tool("Creates a FHIR resource from a JSON payload string.")
    public String createResource(
            @P("FHIR resource type") String resourceType,
            @P("JSON payload of the resource") String jsonPayload
    ) {
        return executeTool("createResource", Map.of("resourceType", safe(resourceType)), () -> {
            String type = normalizeResourceType(resourceType);
            Map<String, Object> payload = parseJsonObject(jsonPayload);
            payload.put("resourceType", type);

            Map<String, Object> created = fhirWebClient.post()
                    .uri("/" + type)
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(MAP_TYPE)
                    .timeout(TOOL_TIMEOUT)
                    .block();

            if (created == null || created.isEmpty()) {
                return "Creation failed for " + type;
            }

            String createdId = safe(asString(created.get("id")));
            return "Created " + type + " with id=" + createdId;
        });
    }

    @Tool("Creates a Questionnaire (QST) with title/status and optional description/items JSON array.")
    public String createQuestionnaire(
            @P("Questionnaire title") String title,
            @P("Questionnaire status (draft|active|retired|unknown)") String status,
            @P("Optional description") String description,
            @P("Optional items JSON array matching FHIR Questionnaire.item") String itemsJson
    ) {
        return executeTool("createQuestionnaire", Map.of(
                "title", safe(title),
                "status", safe(status)
        ), () -> {
            String normalizedTitle = safe(title).trim();
            String normalizedStatus = safe(status).trim();

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("resourceType", "Questionnaire");
            payload.put("status", normalizedStatus.isBlank() ? "draft" : normalizedStatus);
            payload.put("title", normalizedTitle.isBlank() ? "Untitled questionnaire" : normalizedTitle);
            payload.put("subjectType", List.of("Patient"));

            String normalizedDescription = safe(description).trim();
            if (!normalizedDescription.isBlank()) {
                payload.put("description", normalizedDescription);
            }

            String normalizedItems = safe(itemsJson).trim();
            if (!normalizedItems.isBlank()) {
                payload.put("item", parseJsonArrayOfObjects(normalizedItems, "itemsJson"));
            } else {
                String sessionId = safe(chatSessionContext.getCurrentSessionId());
                List<Map<String, Object>> generatedItems = autoGenerateQuestionnaireItems(
                        normalizedTitle,
                        normalizedDescription,
                        sessionId
                );
                if (!generatedItems.isEmpty()) {
                    payload.put("item", generatedItems);
                }
            }

            Map<String, Object> created = fhirWebClient.post()
                    .uri("/Questionnaire")
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(MAP_TYPE)
                    .timeout(TOOL_TIMEOUT)
                    .block();

            if (created == null || created.isEmpty()) {
                return "Creation failed for Questionnaire";
            }

            String createdId = safe(asString(created.get("id")));
            return "Created Questionnaire with id=" + createdId;
        });
    }

    private List<Map<String, Object>> autoGenerateQuestionnaireItems(String title, String description, String sessionId) {
        String normalizedTitle = safe(title).trim();
        String normalizedDescription = safe(description).trim();
        String seed = (normalizedTitle + "\n" + normalizedDescription).trim();

        List<String> contextChunks = sessionId.isBlank()
                ? List.of()
                : contextFileSessionStore.findRelevantChunks(sessionId, seed, null, 8);

        StringBuilder merged = new StringBuilder(seed);
        for (String chunk : contextChunks) {
            if (chunk != null && !chunk.isBlank()) {
                merged.append("\n").append(chunk);
            }
        }

        List<String> extractedQuestions = extractQuestionLines(merged.toString());
        if (extractedQuestions.isEmpty()) {
            extractedQuestions = defaultQuestionTemplates(seed);
        }

        List<Map<String, Object>> items = new ArrayList<>();
        int maxItems = Math.min(10, extractedQuestions.size());
        for (int i = 0; i < maxItems; i++) {
            String question = extractedQuestions.get(i);
            String type = inferQuestionType(question);

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("linkId", String.valueOf(i + 1));
            item.put("text", question);
            item.put("type", type);
            item.put("required", i < 4);
            items.add(item);
        }

        return items;
    }

    private List<String> extractQuestionLines(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }

        Set<String> unique = new LinkedHashSet<>();
        Matcher matcher = QUESTION_LINE_PATTERN.matcher(text);
        while (matcher.find()) {
            String candidate = safe(matcher.group(1)).trim();
            if (candidate.length() >= 6 && candidate.length() <= 220) {
                unique.add(candidate);
            }
        }

        // Also accept "Q: ..." style lines from plain text context.
        for (String rawLine : text.split("\\R")) {
            String line = safe(rawLine).trim();
            if (line.toLowerCase(Locale.ROOT).startsWith("q:") || line.toLowerCase(Locale.ROOT).startsWith("question:")) {
                String candidate = line.substring(line.indexOf(':') + 1).trim();
                if (!candidate.endsWith("?")) {
                    candidate = candidate + " ?";
                }
                if (candidate.length() >= 6 && candidate.length() <= 220) {
                    unique.add(candidate);
                }
            }
        }

        return new ArrayList<>(unique);
    }

    private List<String> defaultQuestionTemplates(String seed) {
        String lower = safe(seed).toLowerCase(Locale.ROOT);

        if (lower.contains("asthme") || lower.contains("copd") || lower.contains("respir")) {
            return List.of(
                    "Avez-vous eu une gene respiratoire cette semaine ?",
                    "Avez-vous utilise votre traitement de secours ces 7 derniers jours ?",
                    "Combien de fois vous etes-vous reveille a cause de vos symptomes respiratoires ?",
                    "Avez-vous identifie un facteur declenchant recent ?",
                    "Souhaitez-vous decrire un symptome particulier ?"
            );
        }

        if (lower.contains("douleur")) {
            return List.of(
                    "Ressentez-vous une douleur actuellement ?",
                    "Sur une echelle de 0 a 10, quel est le niveau de douleur ?",
                    "Depuis combien de jours cette douleur est-elle presente ?",
                    "La douleur impacte-t-elle vos activites quotidiennes ?",
                    "Souhaitez-vous preciser le contexte de cette douleur ?"
            );
        }

        return List.of(
                "Quel est le principal objectif de ce questionnaire ?",
                "Depuis quand la situation actuelle est-elle presente ?",
                "Avez-vous observe une evolution recente ?",
                "Ce point affecte-t-il votre quotidien ?",
                "Souhaitez-vous ajouter une precision utile ?"
        );
    }

    private String inferQuestionType(String question) {
        String lower = safe(question).toLowerCase(Locale.ROOT);

        if (lower.contains("date") || lower.contains("quand")) {
            return "date";
        }
        if (lower.contains("combien") || lower.contains("nombre") || lower.contains("niveau") || lower.contains("echelle") || lower.contains("fois")) {
            return "integer";
        }
        if (lower.startsWith("avez-vous") || lower.startsWith("est-ce") || lower.startsWith("ressentez-vous") || lower.contains("oui") || lower.contains("non")) {
            return "boolean";
        }
        if (lower.contains("decrire") || lower.contains("preciser") || lower.contains("ajouter")) {
            return "text";
        }

        return "string";
    }

    @Tool("Updates a FHIR resource by type/id with full JSON payload.")
    public String updateResource(
            @P("FHIR resource type") String resourceType,
            @P("FHIR resource id") String resourceId,
            @P("JSON payload of the full updated resource") String jsonPayload
    ) {
        return executeTool(
                "updateResource",
                Map.of("resourceType", safe(resourceType), "resourceId", safe(resourceId)),
                () -> {
                    String type = normalizeResourceType(resourceType);
                    String id = normalizeRequired(resourceId, "resourceId");
                    Map<String, Object> payload = parseJsonObject(jsonPayload);
                    payload.put("resourceType", type);
                    payload.put("id", id);

                    Map<String, Object> updated = fhirWebClient.put()
                            .uri("/" + type + "/" + id)
                            .bodyValue(payload)
                            .retrieve()
                            .bodyToMono(MAP_TYPE)
                            .timeout(TOOL_TIMEOUT)
                            .block();

                    if (updated == null || updated.isEmpty()) {
                        return "Update failed for " + type + "/" + id;
                    }
                    return "Updated " + type + "/" + id;
                }
        );
    }

    @Tool("Returns API capability statement and main FHIR server metadata.")
    public String getFhirMetadata() {
        return executeTool("getFhirMetadata", Map.of(), () -> {
            Map<String, Object> metadata = fhirWebClient.get()
                    .uri("/metadata")
                    .retrieve()
                    .bodyToMono(MAP_TYPE)
                    .timeout(TOOL_TIMEOUT)
                    .block();

            if (metadata == null || metadata.isEmpty()) {
                return "No metadata returned by FHIR server.";
            }
            return compactJson(metadata);
        });
    }

    private String executeTool(String toolName, Map<String, String> input, ToolSupplier supplier) {
        toolEventPublisher.emit(toolName + ":start", compactJson(input));
        try {
            long start = System.nanoTime();
            String output = supplier.get();
            long elapsedMs = (System.nanoTime() - start) / 1_000_000;
            String normalized = output == null ? "" : output;

            toolEventPublisher.emit(toolName + ":result", normalized);
            logger.info("[tool] {} done in {}ms", toolName, elapsedMs);
            return normalized;
        } catch (Exception ex) {
            String error = "Tool " + toolName + " failed: " + safe(ex.getMessage());
            toolEventPublisher.emit(toolName + ":error", error);
            logger.warn("[tool] {} failed: {}", toolName, ex.getMessage());
            return error;
        }
    }

    private String summarizeBundle(Map<String, Object> bundle, String resourceType) {
        if (bundle == null || bundle.isEmpty()) {
            return "No " + resourceType + " result.";
        }

        Object totalObj = bundle.get("total");
        int total = totalObj instanceof Number ? ((Number) totalObj).intValue() : -1;

        Object entriesObj = bundle.get("entry");
        if (!(entriesObj instanceof List<?> entries) || entries.isEmpty()) {
            return total >= 0 ? "0 result for " + resourceType + " (total=" + total + ")" : "0 result for " + resourceType;
        }

        StringJoiner joiner = new StringJoiner("\n");
        int max = Math.min(entries.size(), 10);
        for (int i = 0; i < max; i++) {
            Object item = entries.get(i);
            if (!(item instanceof Map<?, ?> entry)) {
                continue;
            }
            Object resource = entry.get("resource");
            if (!(resource instanceof Map<?, ?> map)) {
                continue;
            }
            String id = asString(map.get("id"));
            String code = asString(map.get("resourceType"));
            joiner.add("- " + code + "/" + id);
        }

        String prefix = total >= 0
                ? "Found " + entries.size() + " entries (total=" + total + ") for " + resourceType
                : "Found " + entries.size() + " entries for " + resourceType;
        return prefix + "\n" + joiner;
    }

    private Map<String, String> parseQuery(String query) {
        Map<String, String> params = new LinkedHashMap<>();
        if (query == null || query.isBlank()) {
            return params;
        }

        String[] pairs = query.split("&");
        for (String pair : pairs) {
            if (pair == null || pair.isBlank()) {
                continue;
            }
            String[] split = pair.split("=", 2);
            String key = URLDecoder.decode(split[0].trim(), StandardCharsets.UTF_8);
            if (key.isBlank()) {
                continue;
            }
            String value = split.length > 1 ? URLDecoder.decode(split[1].trim(), StandardCharsets.UTF_8) : "";
            params.put(key, value);
        }
        return params;
    }

    private Map<String, Object> parseJsonObject(String jsonPayload) {
        try {
            String payload = normalizeRequired(jsonPayload, "jsonPayload");
            return objectMapper.readValue(payload, new TypeReference<>() {});
        } catch (Exception ex) {
            throw new IllegalArgumentException("jsonPayload must be a valid JSON object", ex);
        }
    }

    private List<Map<String, Object>> parseJsonArrayOfObjects(String jsonPayload, String fieldName) {
        try {
            String payload = normalizeRequired(jsonPayload, fieldName);
            return objectMapper.readValue(payload, new TypeReference<>() {});
        } catch (Exception ex) {
            throw new IllegalArgumentException(fieldName + " must be a valid JSON array", ex);
        }
    }

    private String compactJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            return String.valueOf(value);
        }
    }

    private String normalizeResourceType(String resourceType) {
        String type = normalizeRequired(resourceType, "resourceType");
        return type.replaceAll("[^A-Za-z0-9]", "");
    }

    private String normalizeRequired(String value, String field) {
        String normalized = safe(value).trim();
        if (normalized.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
        return normalized;
    }

    private String asString(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    @FunctionalInterface
    private interface ToolSupplier {
        String get();
    }
}
