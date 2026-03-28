package com.healthapp.fhir.provider;

import ca.uhn.fhir.rest.annotation.Create;
import ca.uhn.fhir.rest.annotation.IdParam;
import ca.uhn.fhir.rest.annotation.OptionalParam;
import ca.uhn.fhir.rest.annotation.Read;
import ca.uhn.fhir.rest.annotation.ResourceParam;
import ca.uhn.fhir.rest.annotation.Search;
import ca.uhn.fhir.rest.api.MethodOutcome;
import ca.uhn.fhir.rest.server.IResourceProvider;
import ca.uhn.fhir.rest.server.exceptions.ResourceNotFoundException;
import org.hl7.fhir.r4.model.Communication;
import org.hl7.fhir.r4.model.IdType;
import org.hl7.fhir.r4.model.Reference;
import org.hl7.fhir.r4.model.StringType;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
public class CommunicationResourceProvider implements IResourceProvider {

    private final Map<String, Communication> communications = new HashMap<>();

    @Override
    public Class<Communication> getResourceType() {
        return Communication.class;
    }

    @Read
    public Communication read(@IdParam IdType theId) {
        Communication communication = communications.get(theId.getIdPart());
        if (communication == null) {
            throw new ResourceNotFoundException(theId);
        }
        return communication;
    }

    @Create
    public MethodOutcome create(@ResourceParam Communication theCommunication) {
        String id = UUID.randomUUID().toString();
        theCommunication.setId(id);
        communications.put(id, theCommunication);

        MethodOutcome outcome = new MethodOutcome();
        outcome.setId(new IdType("Communication", id));
        outcome.setCreated(true);
        outcome.setResource(theCommunication);
        return outcome;
    }

    @Search
    public List<Communication> search(
            @OptionalParam(name = Communication.SP_SUBJECT) Reference subject,
            @OptionalParam(name = "_count") StringType count,
            @OptionalParam(name = "_sort") StringType sort) {

        List<Communication> result = new ArrayList<>(communications.values());

        if (subject != null && subject.getReference() != null && !subject.getReference().isBlank()) {
            String subjectRef = normalizeReference(subject.getReference());
            result.removeIf(item -> {
                String communicationSubject = item.getSubject() != null ? item.getSubject().getReference() : null;
                return communicationSubject == null || !normalizeReference(communicationSubject).equals(subjectRef);
            });
        }

        if (sort != null && sort.getValue() != null && sort.getValue().contains("sent")) {
            result.sort(Comparator.comparing(Communication::getSent));
            if (sort.getValue().startsWith("-")) {
                result.sort(Comparator.comparing(Communication::getSent, Comparator.nullsLast(Comparator.reverseOrder())));
            }
        }

        int maxResults = 50;
        if (count != null && count.getValue() != null) {
            try {
                maxResults = Integer.parseInt(count.getValue());
            } catch (NumberFormatException ignored) {
                maxResults = 50;
            }
        }

        return result.stream().limit(Math.max(maxResults, 1)).collect(Collectors.toList());
    }

    private String normalizeReference(String reference) {
        String trimmed = reference.trim();
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            int patientIndex = trimmed.lastIndexOf("Patient/");
            if (patientIndex >= 0) {
                return trimmed.substring(patientIndex);
            }
            int practitionerIndex = trimmed.lastIndexOf("Practitioner/");
            if (practitionerIndex >= 0) {
                return trimmed.substring(practitionerIndex);
            }
        }
        return trimmed;
    }
}
