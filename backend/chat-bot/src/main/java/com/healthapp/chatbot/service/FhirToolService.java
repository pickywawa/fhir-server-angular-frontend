package com.healthapp.chatbot.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class FhirToolService {

    private static final Logger logger = LoggerFactory.getLogger(FhirToolService.class);
    private final WebClient fhirWebClient;

    public FhirToolService(WebClient fhirWebClient) {
        this.fhirWebClient = fhirWebClient;
    }

    @Tool(description = "Search a patient by family name, given name, or identifier")
    public String searchPatient(String familyName, String givenName, String identifier) {
        logger.info("[searchPatient] Searching: family={}, given={}, identifier={}", familyName, givenName, identifier);
        Map<String, String> params = new LinkedHashMap<>();
        if (familyName != null && !familyName.isBlank()) {
            params.put("family", familyName);
        }
        if (givenName != null && !givenName.isBlank()) {
            params.put("given", givenName);
        }
        if (identifier != null && !identifier.isBlank()) {
            params.put("identifier", identifier);
        }

        Map<String, Object> response = fhirWebClient.get()
                .uri(uriBuilder -> {
                    var b = uriBuilder.path("/Patient");
                    params.forEach(b::queryParam);
                    return b.build();
                })
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        String result = summarizeBundle(response, "Patient");
        logger.info("[searchPatient] Response: {}", result);
        return result;
    }

    @Tool(description = "Create an appointment for a patient with practitioner and schedule")
    public String createAppointment(
            String patientId,
            String startIsoDateTime,
            String endIsoDateTime,
            String practitionerId,
            String description
    ) {
        logger.info("[createAppointment] Creating: patientId={}, practitionerId={}, start={}, end={}",
                patientId, practitionerId, startIsoDateTime, endIsoDateTime);
        
        Map<String, Object> appointment = new LinkedHashMap<>();
        appointment.put("resourceType", "Appointment");
        appointment.put("status", "booked");
        appointment.put("description", description == null || description.isBlank() ? "Appointment created by chatbot" : description);
        appointment.put("start", startIsoDateTime);
        appointment.put("end", endIsoDateTime);

        List<Map<String, Object>> participants = new ArrayList<>();
        participants.add(Map.of(
                "actor", Map.of("reference", "Patient/" + patientId),
                "status", "accepted"
        ));
        if (practitionerId != null && !practitionerId.isBlank()) {
            participants.add(Map.of(
                    "actor", Map.of("reference", "Practitioner/" + practitionerId),
                    "status", "accepted"
            ));
        }
        appointment.put("participant", participants);

        Map<String, Object> created = fhirWebClient.post()
                .uri("/Appointment")
                .bodyValue(appointment)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        String appointmentId = created != null ? asString(created.get("id")) : "unknown";
        String result = "Appointment created with id=" + appointmentId + ", url=/Appointment/" + appointmentId;
        logger.info("[createAppointment] Response: {}", result);
        return result;
    }

    @Tool(description = "Update patient identity fields like family name, given name, and phone")
    public String updatePatientIdentity(String patientId, String familyName, String givenName, String phone) {
        logger.info("[updatePatientIdentity] Updating: patientId={}, family={}, given={}, phone={}",
                patientId, familyName, givenName, phone);
        
        Map<String, Object> patient = fhirWebClient.get()
                .uri("/Patient/{id}", patientId)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        if (patient == null || patient.isEmpty()) {
            String msg = "Patient not found for id=" + patientId;
            logger.warn("[updatePatientIdentity] Response: {}", msg);
            return msg;
        }

        if (familyName != null && !familyName.isBlank()) {
            Map<String, Object> humanName = new LinkedHashMap<>();
            humanName.put("family", familyName);
            if (givenName != null && !givenName.isBlank()) {
                humanName.put("given", List.of(givenName));
            }
            patient.put("name", List.of(humanName));
        }

        if (phone != null && !phone.isBlank()) {
            patient.put("telecom", List.of(Map.of("system", "phone", "value", phone, "use", "mobile")));
        }

        Map<String, Object> updated = fhirWebClient.put()
                .uri("/Patient/{id}", patientId)
                .bodyValue(patient)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        String updatedId = updated != null ? asString(updated.get("id")) : patientId;
        String result = "Patient updated with id=" + updatedId + ", url=/Patient/" + updatedId;
        logger.info("[updatePatientIdentity] Response: {}", result);
        return result;
    }

    @Tool(description = "Search for practitioners by name")
    public String searchPractitioner(String familyName, String givenName) {
        logger.info("[searchPractitioner] Searching: family={}, given={}", familyName, givenName);
        Map<String, String> params = new LinkedHashMap<>();
        if (familyName != null && !familyName.isBlank()) {
            params.put("family", familyName);
        }
        if (givenName != null && !givenName.isBlank()) {
            params.put("given", givenName);
        }

        Map<String, Object> response = fhirWebClient.get()
                .uri(uriBuilder -> {
                    var b = uriBuilder.path("/Practitioner");
                    params.forEach(b::queryParam);
                    return b.build();
                })
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        String result = summarizeBundle(response, "Practitioner");
        logger.info("[searchPractitioner] Response: {}", result);
        return result;
    }

    @Tool(description = "Search for questionnaires by title or status")
    public String searchQuestionnaire(String title, String status) {
        logger.info("[searchQuestionnaire] Searching: title={}, status={}", title, status);
        Map<String, String> params = new LinkedHashMap<>();
        if (title != null && !title.isBlank()) {
            params.put("title", title);
        }
        if (status != null && !status.isBlank()) {
            params.put("status", status);
        }

        Map<String, Object> response = fhirWebClient.get()
                .uri(uriBuilder -> {
                    var b = uriBuilder.path("/Questionnaire");
                    params.forEach(b::queryParam);
                    b.queryParam("_count", "50");
                    return b.build();
                })
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        String result = summarizeBundle(response, "Questionnaire");
        logger.info("[searchQuestionnaire] Response: {}", result);
        return result;
    }

    @Tool(description = "Search for care plans by patient reference or status")
    public String searchCarePlan(String patientId, String status) {
        logger.info("[searchCarePlan] Searching: patientId={}, status={}", patientId, status);
        Map<String, String> params = new LinkedHashMap<>();
        if (patientId != null && !patientId.isBlank()) {
            params.put("subject", "Patient/" + patientId);
        }
        if (status != null && !status.isBlank()) {
            params.put("status", status);
        }

        Map<String, Object> response = fhirWebClient.get()
                .uri(uriBuilder -> {
                    var b = uriBuilder.path("/CarePlan");
                    params.forEach(b::queryParam);
                    b.queryParam("_count", "50");
                    return b.build();
                })
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        String result = summarizeBundle(response, "CarePlan");
        logger.info("[searchCarePlan] Response: {}", result);
        return result;
    }

    @Tool(description = "Search for organizations by name")
    public String searchOrganization(String name) {
        logger.info("[searchOrganization] Searching: name={}", name);
        Map<String, String> params = new LinkedHashMap<>();
        if (name != null && !name.isBlank()) {
            params.put("name", name);
        }

        Map<String, Object> response = fhirWebClient.get()
                .uri(uriBuilder -> {
                    var b = uriBuilder.path("/Organization");
                    params.forEach(b::queryParam);
                    b.queryParam("_count", "50");
                    return b.build();
                })
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        String result = summarizeBundle(response, "Organization");
        logger.info("[searchOrganization] Response: {}", result);
        return result;
    }

    @Tool(description = "List all resources of a specific FHIR type (e.g., Patient, Practitioner, CarePlan)")
    public String listResources(String resourceType, String count) {
        logger.info("[listResources] Listing: resourceType={}, count={}", resourceType, count);
        if (resourceType == null || resourceType.isBlank()) {
            return "Resource type is required";
        }

        int pageSize = 50;
        if (count != null && !count.isBlank()) {
            try {
                pageSize = Integer.parseInt(count);
                pageSize = Math.min(pageSize, 500);
            } catch (NumberFormatException e) {
                pageSize = 50;
            }
        }
        final int finalPageSize = pageSize;

        Map<String, Object> response = fhirWebClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/" + resourceType)
                        .queryParam("_count", finalPageSize)
                        .build())
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        String result = summarizeBundle(response, resourceType);
        logger.info("[listResources] Response: {}", result);
        return result;
    }

    @Tool(description = "Get a specific FHIR resource by type and ID")
    public String getResource(String resourceType, String resourceId) {
        logger.info("[getResource] Getting: resourceType={}, resourceId={}", resourceType, resourceId);
        if (resourceType == null || resourceType.isBlank() || resourceId == null || resourceId.isBlank()) {
            return "Resource type and ID are required";
        }

        Map<String, Object> response = fhirWebClient.get()
                .uri("/" + resourceType + "/" + resourceId)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        String result = formatResourceDetails(response);
        logger.info("[getResource] Response: {}", result);
        return result;
    }

    @Tool(description = "Cancel an appointment by its ID")
    public String cancelAppointment(String appointmentId) {
        logger.info("[cancelAppointment] Cancelling: appointmentId={}", appointmentId);
        
        Map<String, Object> appointment = fhirWebClient.get()
                .uri("/Appointment/{id}", appointmentId)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        if (appointment == null || appointment.isEmpty()) {
            String msg = "Appointment not found for id=" + appointmentId;
            logger.warn("[cancelAppointment] Response: {}", msg);
            return msg;
        }

        appointment.put("status", "cancelled");
        Map<String, Object> updated = fhirWebClient.put()
                .uri("/Appointment/{id}", appointmentId)
                .bodyValue(appointment)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        String result = "Appointment cancelled with id=" + appointmentId;
        logger.info("[cancelAppointment] Response: {}", result);
        return result;
    }

    @Tool(description = "Collect complete FHIR context for one patient in order to generate a synthesis summary")
    public String buildPatientSynthesisContext(String patientId) {
        logger.info("[buildPatientSynthesisContext] Collecting context for patientId={}", patientId);
        if (patientId == null || patientId.isBlank()) {
            return "patientId is required";
        }

        try {
            String resolvedPatientId = resolvePatientId(patientId);
            if (resolvedPatientId.isBlank()) {
                return "Patient not found for input=" + patientId;
            }

            Map<String, Object> patient = safeFetchResource("/Patient/{id}", resolvedPatientId);

            if (patient == null || patient.isEmpty()) {
                return "Patient not found for id=" + resolvedPatientId;
            }

            Map<String, Object> carePlansBundle = safeFetchBundle("/CarePlan", Map.of(
                    "subject", "Patient/" + resolvedPatientId,
                "_count", "100",
                "_sort", "-_lastUpdated"
            ));
            Map<String, Object> careTeamsBundle = safeFetchBundle("/CareTeam", Map.of(
                    "patient", resolvedPatientId,
                "_include", "CareTeam:participant",
                "_count", "100"
            ));
            Map<String, Object> appointmentsBundle = safeFetchBundle("/Appointment", Map.of(
                    "actor", "Patient/" + resolvedPatientId,
                "_count", "120",
                "_sort", "-date"
            ));
            Map<String, Object> documentsBundle = safeFetchBundle("/DocumentReference", Map.of(
                    "subject", "Patient/" + resolvedPatientId,
                "_count", "100",
                "_sort", "-date"
            ));
            Map<String, Object> communicationsBundle = safeFetchBundle("/Communication", Map.of(
                    "subject", "Patient/" + resolvedPatientId,
                "_count", "200",
                "_sort", "-sent"
            ));
            Map<String, Object> relatedPersonsBundle = safeFetchBundle("/RelatedPerson", Map.of(
                    "patient", resolvedPatientId,
                "_count", "100",
                "_sort", "-_lastUpdated"
            ));
            Map<String, Object> questionnaireResponsesBySubject = safeFetchBundle("/QuestionnaireResponse", Map.of(
                    "subject", "Patient/" + resolvedPatientId,
                "_count", "200",
                "_sort", "-_lastUpdated"
            ));
            Map<String, Object> questionnaireResponsesByPatient = safeFetchBundle("/QuestionnaireResponse", Map.of(
                    "patient", resolvedPatientId,
                "_count", "200",
                "_sort", "-_lastUpdated"
            ));

            List<Map<String, Object>> carePlans = extractBundleResources(carePlansBundle, "CarePlan");
            List<Map<String, Object>> careTeams = extractBundleResources(careTeamsBundle, "CareTeam");
            List<Map<String, Object>> appointments = extractBundleResources(appointmentsBundle, "Appointment");
            List<Map<String, Object>> documents = extractBundleResources(documentsBundle, "DocumentReference");
            List<Map<String, Object>> communications = extractBundleResources(communicationsBundle, "Communication");
            List<Map<String, Object>> relatedPersons = extractBundleResources(relatedPersonsBundle, "RelatedPerson");

            List<Map<String, Object>> questionnaireResponses = new ArrayList<>();
            questionnaireResponses.addAll(extractBundleResources(questionnaireResponsesBySubject, "QuestionnaireResponse"));
            questionnaireResponses.addAll(extractBundleResources(questionnaireResponsesByPatient, "QuestionnaireResponse"));
            questionnaireResponses = deduplicateById(questionnaireResponses);

            StringBuilder result = new StringBuilder();
            result.append("PATIENT SYNTHESIS CONTEXT\n");
            result.append("patientId=").append(resolvedPatientId).append("\n");
            result.append("patientInput=").append(patientId).append("\n\n");

            result.append("[Patient]\n");
            result.append(patientSummary(patient)).append("\n\n");

            appendSection(result, "CarePlans", carePlanSummaries(carePlans));
            appendSection(result, "CareTeam", careTeamSummaries(careTeams));
            appendSection(result, "Appointments", appointmentSummaries(appointments));
            appendSection(result, "Documents (sans contenu)", documentSummaries(documents));
            appendSection(result, "Correspondances", communicationSummaries(communications));
            appendSection(result, "Entourage", relatedPersonSummaries(relatedPersons));
            appendSection(result, "Questionnaires", questionnaireResponseSummaries(questionnaireResponses));

            String output = result.toString().trim();
            logger.info("[buildPatientSynthesisContext] Response size={} chars", output.length());
            return output;
        } catch (Exception ex) {
            logger.warn("[buildPatientSynthesisContext] Error for patientId={}: {}", patientId, ex.getMessage());
            return "Unable to collect synthesis context for patientId=" + patientId;
        }
    }

    @Tool(description = "Navigate to a FHIR resource URL with its type and id")
    public String navigateToResource(String resourceType, String resourceId) {
        logger.info("[navigateToResource] Navigating: resourceType={}, resourceId={}", resourceType, resourceId);
        String result = "http://localhost:8081/fhir/" + resourceType + "/" + resourceId;
        logger.info("[navigateToResource] Response: {}", result);
        return result;
    }

    private String resolvePatientId(String patientInput) {
        String value = asString(patientInput).trim();
        if (value.isBlank()) {
            return "";
        }

        try {
            Map<String, Object> byId = fhirWebClient.get()
                    .uri("/Patient/{id}", value)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
            if (byId != null && !byId.isEmpty()) {
                String id = asString(byId.get("id")).trim();
                if (!id.isBlank()) {
                    return id;
                }
            }
        } catch (Exception ignored) {
            // Input is probably not a raw Patient id, continue with name-based search.
        }

        String byIdentifier = findPatientIdByIdentifier(value);
        if (!byIdentifier.isBlank()) {
            return byIdentifier;
        }

        String normalized = value.replace(',', ' ').trim();
        String[] parts = normalized.split("\\s+");
        if (parts.length >= 2) {
            String family = parts[0];
            String given = String.join(" ", java.util.Arrays.copyOfRange(parts, 1, parts.length));

            String found = findPatientIdByName(family, given);
            if (!found.isBlank()) {
                return found;
            }

            // fallback inverted order: "Prenom Nom"
            found = findPatientIdByName(parts[parts.length - 1], String.join(" ", java.util.Arrays.copyOfRange(parts, 0, parts.length - 1)));
            if (!found.isBlank()) {
                return found;
            }
        }

        return "";
    }

    private String findPatientIdByIdentifier(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return "";
        }

        Map<String, Object> bundle = safeFetchBundle("/Patient", Map.of(
                "identifier", identifier,
                "_count", "5"
        ));
        List<Map<String, Object>> patients = extractBundleResources(bundle, "Patient");
        if (patients.isEmpty()) {
            return "";
        }
        return asString(patients.get(0).get("id")).trim();
    }

    private Map<String, Object> safeFetchBundle(String path, Map<String, String> params) {
        try {
            return fetchBundle(path, params);
        } catch (Exception ex) {
            logger.warn("[safeFetchBundle] path={} params={} error={}", path, params, ex.getMessage());
            return Map.of();
        }
    }

    private Map<String, Object> safeFetchResource(String pathTemplate, String id) {
        try {
            return fhirWebClient.get()
                    .uri(pathTemplate, id)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
        } catch (Exception ex) {
            logger.warn("[safeFetchResource] pathTemplate={} id={} error={}", pathTemplate, id, ex.getMessage());
            return Map.of();
        }
    }

    private String findPatientIdByName(String family, String given) {
        if (family == null || family.isBlank() || given == null || given.isBlank()) {
            return "";
        }

        Map<String, Object> bundle = fetchBundle("/Patient", Map.of(
                "family", family,
                "given", given,
                "_count", "5"
        ));
        List<Map<String, Object>> patients = extractBundleResources(bundle, "Patient");
        if (patients.isEmpty()) {
            return "";
        }
        return asString(patients.get(0).get("id")).trim();
    }

    private Map<String, Object> fetchBundle(String path, Map<String, String> params) {
        return fhirWebClient.get()
                .uri(uriBuilder -> {
                    var b = uriBuilder.path(path);
                    params.forEach(b::queryParam);
                    return b.build();
                })
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    private List<Map<String, Object>> extractBundleResources(Map<String, Object> bundle, String resourceType) {
        List<Map<String, Object>> resources = new ArrayList<>();
        if (bundle == null || bundle.isEmpty()) {
            return resources;
        }

        Object entriesObj = bundle.get("entry");
        if (!(entriesObj instanceof List<?> entries)) {
            return resources;
        }

        for (Object entry : entries) {
            if (!(entry instanceof Map<?, ?> entryMap)) {
                continue;
            }
            Object resourceObj = entryMap.get("resource");
            if (!(resourceObj instanceof Map<?, ?> resourceMap)) {
                continue;
            }

            String currentType = asString(resourceMap.get("resourceType"));
            if (!resourceType.equals(currentType)) {
                continue;
            }

            resources.add((Map<String, Object>) resourceMap);
        }
        return resources;
    }

    private List<Map<String, Object>> deduplicateById(List<Map<String, Object>> resources) {
        List<Map<String, Object>> unique = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (Map<String, Object> resource : resources) {
            String id = asString(resource.get("id"));
            if (id.isBlank() || seen.add(id)) {
                unique.add(resource);
            }
        }
        return unique;
    }

    private String patientSummary(Map<String, Object> patient) {
        String id = asString(patient.get("id"));
        String birthDate = asString(patient.get("birthDate"));
        String gender = asString(patient.get("gender"));
        String active = asString(patient.get("active"));
        String name = humanName(patient.get("name"));
        String telecom = telecomSummary(patient.get("telecom"));
        String identifiers = identifierSummary(patient.get("identifier"));
        return "id=" + id + ", name=" + name + ", birthDate=" + birthDate + ", gender=" + gender +
                ", active=" + active + ", telecom=" + telecom + ", identifiers=" + identifiers;
    }

    private List<String> carePlanSummaries(List<Map<String, Object>> carePlans) {
        List<String> lines = new ArrayList<>();
        for (Map<String, Object> cp : carePlans) {
            lines.add("id=" + asString(cp.get("id"))
                    + ", status=" + asString(cp.get("status"))
                    + ", intent=" + asString(cp.get("intent"))
                    + ", title=" + asString(cp.get("title"))
                    + ", category=" + categorySummary(cp.get("category"))
                    + ", created=" + asString(cp.get("created"))
                    + ", note=" + firstNoteText(cp.get("note")));
        }
        return lines;
    }

    private List<String> careTeamSummaries(List<Map<String, Object>> careTeams) {
        List<String> lines = new ArrayList<>();
        for (Map<String, Object> ct : careTeams) {
            lines.add("id=" + asString(ct.get("id"))
                    + ", status=" + asString(ct.get("status"))
                    + ", subject=" + referenceSummary(ct.get("subject"))
                    + ", participants=" + participantSummary(ct.get("participant")));
        }
        return lines;
    }

    private List<String> appointmentSummaries(List<Map<String, Object>> appointments) {
        List<String> lines = new ArrayList<>();
        for (Map<String, Object> appt : appointments) {
            lines.add("id=" + asString(appt.get("id"))
                    + ", status=" + asString(appt.get("status"))
                    + ", start=" + asString(appt.get("start"))
                    + ", end=" + asString(appt.get("end"))
                    + ", description=" + asString(appt.get("description"))
                    + ", participants=" + participantSummary(appt.get("participant")));
        }
        return lines;
    }

    private List<String> documentSummaries(List<Map<String, Object>> documents) {
        List<String> lines = new ArrayList<>();
        for (Map<String, Object> doc : documents) {
            lines.add("id=" + asString(doc.get("id"))
                    + ", date=" + asString(doc.get("date"))
                    + ", title=" + asString(doc.get("description"))
                    + ", class=" + categorySummary(doc.get("category"))
                    + ", type=" + codingSummary(doc.get("type"))
                    + ", author=" + firstAuthor(doc.get("author"))
                    + ", attachments=" + documentAttachmentSummary(doc.get("content")));
        }
        return lines;
    }

    private List<String> communicationSummaries(List<Map<String, Object>> communications) {
        List<String> lines = new ArrayList<>();
        for (Map<String, Object> comm : communications) {
            lines.add("id=" + asString(comm.get("id"))
                    + ", sent=" + asString(comm.get("sent"))
                    + ", sender=" + referenceSummary(comm.get("sender"))
                    + ", recipients=" + recipientSummary(comm.get("recipient"))
                    + ", content=" + firstCommunicationPayload(comm.get("payload")));
        }
        return lines;
    }

    private List<String> relatedPersonSummaries(List<Map<String, Object>> relatedPersons) {
        List<String> lines = new ArrayList<>();
        for (Map<String, Object> rp : relatedPersons) {
            lines.add("id=" + asString(rp.get("id"))
                    + ", name=" + humanName(rp.get("name"))
                    + ", relationship=" + relationshipSummary(rp.get("relationship"))
                    + ", telecom=" + telecomSummary(rp.get("telecom"))
                    + ", gender=" + asString(rp.get("gender"))
                    + ", birthDate=" + asString(rp.get("birthDate")));
        }
        return lines;
    }

    private List<String> questionnaireResponseSummaries(List<Map<String, Object>> responses) {
        List<String> lines = new ArrayList<>();
        for (Map<String, Object> qr : responses) {
            int itemCount = 0;
            Object itemsObj = qr.get("item");
            if (itemsObj instanceof List<?> items) {
                itemCount = items.size();
            }
            lines.add("id=" + asString(qr.get("id"))
                    + ", status=" + asString(qr.get("status"))
                    + ", authored=" + asString(qr.get("authored"))
                    + ", questionnaire=" + asString(qr.get("questionnaire"))
                    + ", itemCount=" + itemCount);
        }
        return lines;
    }

    private void appendSection(StringBuilder sb, String title, List<String> lines) {
        sb.append("[").append(title).append("] count=").append(lines.size()).append("\n");
        if (lines.isEmpty()) {
            sb.append("- none\n\n");
            return;
        }
        for (String line : lines) {
            sb.append("- ").append(line).append("\n");
        }
        sb.append("\n");
    }

    private String humanName(Object namesObj) {
        if (namesObj instanceof List<?> names && !names.isEmpty() && names.get(0) instanceof Map<?, ?> name) {
            String text = asString(name.get("text"));
            if (!text.isBlank()) {
                return text;
            }
            String family = asString(name.get("family"));
            Object givenObj = name.get("given");
            String given = "";
            if (givenObj instanceof List<?> givenList && !givenList.isEmpty()) {
                given = asString(givenList.get(0));
            }
            String merged = (given + " " + family).trim();
            return merged.isBlank() ? "unknown" : merged;
        }
        return "unknown";
    }

    private String telecomSummary(Object telecomObj) {
        if (!(telecomObj instanceof List<?> telecomList)) {
            return "none";
        }
        List<String> values = new ArrayList<>();
        for (Object item : telecomList) {
            if (item instanceof Map<?, ?> telecom) {
                String system = asString(telecom.get("system"));
                String value = asString(telecom.get("value"));
                if (!value.isBlank()) {
                    values.add((system.isBlank() ? "contact" : system) + ":" + value);
                }
            }
        }
        return values.isEmpty() ? "none" : String.join(", ", values);
    }

    private String identifierSummary(Object identifierObj) {
        if (!(identifierObj instanceof List<?> identifiers)) {
            return "none";
        }
        List<String> values = new ArrayList<>();
        for (Object item : identifiers) {
            if (item instanceof Map<?, ?> identifier) {
                String system = asString(identifier.get("system"));
                String value = asString(identifier.get("value"));
                if (!value.isBlank()) {
                    values.add((system.isBlank() ? "id" : system) + ":" + value);
                }
            }
        }
        return values.isEmpty() ? "none" : String.join(", ", values);
    }

    private String categorySummary(Object categoryObj) {
        if (!(categoryObj instanceof List<?> categories) || categories.isEmpty()) {
            return "none";
        }
        Object first = categories.get(0);
        if (first instanceof Map<?, ?> category) {
            String text = asString(category.get("text"));
            if (!text.isBlank()) {
                return text;
            }
            return codingSummary(category);
        }
        return asString(first);
    }

    private String codingSummary(Object codingContainer) {
        if (!(codingContainer instanceof Map<?, ?> codingMap)) {
            return asString(codingContainer);
        }
        Object codingObj = codingMap.get("coding");
        if (codingObj instanceof List<?> codings && !codings.isEmpty() && codings.get(0) instanceof Map<?, ?> firstCoding) {
            String display = asString(firstCoding.get("display"));
            if (!display.isBlank()) {
                return display;
            }
            String code = asString(firstCoding.get("code"));
            if (!code.isBlank()) {
                return code;
            }
        }
        return asString(codingMap.get("text"));
    }

    private String firstNoteText(Object noteObj) {
        if (noteObj instanceof List<?> notes && !notes.isEmpty() && notes.get(0) instanceof Map<?, ?> note) {
            return asString(note.get("text"));
        }
        return "";
    }

    private String referenceSummary(Object obj) {
        if (obj instanceof Map<?, ?> map) {
            String reference = asString(map.get("reference"));
            String display = asString(map.get("display"));
            if (!display.isBlank()) {
                return display + " (" + reference + ")";
            }
            return reference;
        }
        return asString(obj);
    }

    private String participantSummary(Object participantObj) {
        if (!(participantObj instanceof List<?> participants)) {
            return "none";
        }
        List<String> values = new ArrayList<>();
        for (Object participantObjEntry : participants) {
            if (participantObjEntry instanceof Map<?, ?> participant) {
                String actor = referenceSummary(participant.get("actor"));
                if (actor.isBlank()) {
                    actor = referenceSummary(participant.get("member"));
                }
                String status = asString(participant.get("status"));
                values.add(actor + (status.isBlank() ? "" : " [" + status + "]"));
            }
        }
        return values.isEmpty() ? "none" : String.join(" | ", values);
    }

    private String firstAuthor(Object authorObj) {
        if (authorObj instanceof List<?> authors && !authors.isEmpty()) {
            return referenceSummary(authors.get(0));
        }
        return "";
    }

    private String documentAttachmentSummary(Object contentObj) {
        if (!(contentObj instanceof List<?> contents)) {
            return "none";
        }
        List<String> values = new ArrayList<>();
        for (Object content : contents) {
            if (!(content instanceof Map<?, ?> contentMap)) {
                continue;
            }
            Object attachmentObj = contentMap.get("attachment");
            if (!(attachmentObj instanceof Map<?, ?> attachment)) {
                continue;
            }
            String title = asString(attachment.get("title"));
            String contentType = asString(attachment.get("contentType"));
            String url = asString(attachment.get("url"));
            String size = asString(attachment.get("size"));
            values.add("title=" + title + ", type=" + contentType + ", url=" + url + ", size=" + size);
        }
        return values.isEmpty() ? "none" : String.join(" | ", values);
    }

    private String recipientSummary(Object recipientObj) {
        if (!(recipientObj instanceof List<?> recipients)) {
            return "none";
        }
        List<String> values = new ArrayList<>();
        for (Object recipient : recipients) {
            values.add(referenceSummary(recipient));
        }
        return values.isEmpty() ? "none" : String.join(" | ", values);
    }

    private String firstCommunicationPayload(Object payloadObj) {
        if (payloadObj instanceof List<?> payloads && !payloads.isEmpty() && payloads.get(0) instanceof Map<?, ?> payload) {
            String contentString = asString(payload.get("contentString"));
            if (!contentString.isBlank()) {
                return contentString;
            }
            return asString(payload.get("contentReference"));
        }
        return "";
    }

    private String relationshipSummary(Object relationshipObj) {
        if (!(relationshipObj instanceof List<?> relationships) || relationships.isEmpty()) {
            return "none";
        }
        Object first = relationships.get(0);
        if (first instanceof Map<?, ?> rel) {
            String text = asString(rel.get("text"));
            if (!text.isBlank()) {
                return text;
            }
            return codingSummary(rel);
        }
        return asString(first);
    }

    private String summarizeBundle(Map<String, Object> bundle, String resourceType) {
        if (bundle == null || bundle.isEmpty()) {
            return "No response from FHIR server for " + resourceType;
        }

        Object total = bundle.get("total");
        Object entriesObj = bundle.get("entry");
        List<String> summaries = new ArrayList<>();
        
        if (entriesObj instanceof List<?> entries) {
            int shown = Math.min(entries.size(), 5);
            for (int i = 0; i < shown; i++) {
                Object entry = entries.get(i);
                if (entry instanceof Map<?, ?> entryMap) {
                    Object resource = entryMap.get("resource");
                    if (resource instanceof Map<?, ?> resourceMap) {
                        summaries.add(formatResourceSummary(resourceMap));
                    }
                }
            }
        }

        String totalText = total == null ? String.valueOf(summaries.size()) : String.valueOf(total);
        StringBuilder result = new StringBuilder("Found " + totalText + " " + resourceType + " resources");
        
        if (!summaries.isEmpty()) {
            result.append(":\n");
            for (int i = 0; i < summaries.size(); i++) {
                result.append((i + 1)).append(". ").append(summaries.get(i)).append("\n");
            }
        }
        
        return result.toString().trim();
    }

    private String formatResourceSummary(Map<?, ?> resource) {
        String resourceType = asString(resource.get("resourceType"));
        String id = asString(resource.get("id"));
        
        switch (resourceType) {
            case "Patient":
                Object nameObj = resource.get("name");
                if (nameObj instanceof List<?> names && !((List<?>) names).isEmpty()) {
                    Map<?, ?> name = (Map<?, ?>) ((List<?>) names).get(0);
                    String family = asString(name.get("family"));
                    Object given = name.get("given");
                    String givenName = "";
                    if (given instanceof List<?> givenList && !givenList.isEmpty()) {
                        givenName = " " + asString(givenList.get(0));
                    }
                    return id + ": " + family + givenName;
                }
                return id + " (Patient)";
            case "Practitioner":
                nameObj = resource.get("name");
                if (nameObj instanceof List<?> names && !((List<?>) names).isEmpty()) {
                    Map<?, ?> name = (Map<?, ?>) ((List<?>) names).get(0);
                    String family = asString(name.get("family"));
                    Object given = name.get("given");
                    String givenName = "";
                    if (given instanceof List<?> givenList && !givenList.isEmpty()) {
                        givenName = " " + asString(givenList.get(0));
                    }
                    return id + ": " + family + givenName;
                }
                return id + " (Practitioner)";
            case "Questionnaire":
                String title = asString(resource.get("title"));
                String status = asString(resource.get("status"));
                return id + ": " + title + " [" + status + "]";
            case "CarePlan":
                String cpStatus = asString(resource.get("status"));
                String subject = asString(resource.get("subject"));
                return id + " [" + cpStatus + "] for " + subject;
            case "Appointment":
                String apptStatus = asString(resource.get("status"));
                String start = asString(resource.get("start"));
                return id + " [" + apptStatus + "] at " + start;
            default:
                return id + " (" + resourceType + ")";
        }
    }

    private String formatResourceDetails(Map<?, ?> resource) {
        if (resource == null || resource.isEmpty()) {
            return "Resource not found";
        }
        
        String resourceType = asString(resource.get("resourceType"));
        String id = asString(resource.get("id"));
        StringBuilder result = new StringBuilder(resourceType + " " + id + ":\n");
        
        // Common fields
        for (Map.Entry<?, ?> entry : resource.entrySet()) {
            String keyStr = asString(entry.getKey());
            if (!keyStr.equals("resourceType") && !keyStr.equals("id") && !keyStr.equals("meta") && !keyStr.equals("text")) {
                String valueStr = asString(entry.getValue());
                int maxLen = Math.min(100, valueStr.length());
                result.append("  - ").append(keyStr).append(": ").append(valueStr.substring(0, maxLen)).append("\n");
            }
        }
        
        return result.toString();
    }

    private String asString(Object value) {
        return value == null ? "" : String.valueOf(value);
    }
}
