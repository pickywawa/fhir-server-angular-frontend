package com.healthapp.fhir.controller;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.parser.IParser;
import com.healthapp.fhir.provider.CommunicationResourceProvider;
import org.hl7.fhir.r4.model.Bundle;
import org.hl7.fhir.r4.model.Communication;
import org.hl7.fhir.r4.model.IdType;
import org.hl7.fhir.r4.model.Reference;
import org.hl7.fhir.r4.model.StringType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/fhir")
@CrossOrigin(origins = "http://localhost:4200")
public class FhirCommunicationController {

    private final CommunicationResourceProvider communicationResourceProvider;
    private final IParser jsonParser;

    public FhirCommunicationController(CommunicationResourceProvider communicationResourceProvider, FhirContext fhirContext) {
        this.communicationResourceProvider = communicationResourceProvider;
        this.jsonParser = fhirContext.newJsonParser().setPrettyPrint(true);
    }

    @GetMapping("/Communication")
    public ResponseEntity<String> searchCommunications(
            @RequestParam(required = false) String subject,
            @RequestParam(required = false, defaultValue = "50") Integer _count,
            @RequestParam(required = false, defaultValue = "-sent") String _sort) {

        List<Communication> communications = communicationResourceProvider.search(
                subject != null ? new Reference(subject) : null,
                new StringType(String.valueOf(_count)),
                new StringType(_sort)
        );

        Bundle bundle = new Bundle();
        bundle.setType(Bundle.BundleType.SEARCHSET);
        bundle.setTotal(communications.size());

        for (Communication communication : communications) {
            Bundle.BundleEntryComponent entry = bundle.addEntry();
            entry.setResource(communication);
        }

        return ResponseEntity.ok(jsonParser.encodeResourceToString(bundle));
    }

    @GetMapping("/Communication/{id}")
    public ResponseEntity<String> getCommunication(@PathVariable String id) {
        try {
            Communication communication = communicationResourceProvider.read(new IdType(id));
            return ResponseEntity.ok(jsonParser.encodeResourceToString(communication));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("{\"resourceType\":\"OperationOutcome\",\"issue\":[{\"severity\":\"error\",\"code\":\"not-found\",\"diagnostics\":\"Communication not found\"}]}");
        }
    }

    @PostMapping(value = "/Communication", consumes = "application/fhir+json", produces = "application/fhir+json")
    public ResponseEntity<String> createCommunication(@RequestBody String communicationJson) {
        try {
            Communication communication = jsonParser.parseResource(Communication.class, communicationJson);
            var outcome = communicationResourceProvider.create(communication);
            Communication created = (Communication) outcome.getResource();
            return ResponseEntity.status(HttpStatus.CREATED).body(jsonParser.encodeResourceToString(created));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("{\"resourceType\":\"OperationOutcome\",\"issue\":[{\"severity\":\"error\",\"code\":\"invalid\",\"diagnostics\":\"" + e.getMessage() + "\"}]}");
        }
    }
}
