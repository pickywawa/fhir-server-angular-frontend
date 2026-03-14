package com.healthapp.fhir.controller;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.parser.IParser;
import com.healthapp.fhir.provider.PatientResourceProvider;
import org.hl7.fhir.r4.model.Patient;
import org.hl7.fhir.r4.model.Bundle;
import org.hl7.fhir.r4.model.IdType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/fhir")
@CrossOrigin(origins = "http://localhost:4200")
public class FhirPatientController {

    private final PatientResourceProvider patientResourceProvider;
    private final IParser jsonParser;

    public FhirPatientController(PatientResourceProvider patientResourceProvider, FhirContext fhirContext) {
        this.patientResourceProvider = patientResourceProvider;
        this.jsonParser = fhirContext.newJsonParser().setPrettyPrint(true);
    }

    @GetMapping("/Patient")
    public ResponseEntity<String> searchPatients(
            @RequestParam(required = false) String family,
            @RequestParam(required = false) String given) {

        List<Patient> patients = patientResourceProvider.search(
            family != null ? new org.hl7.fhir.r4.model.StringType(family) : null,
            given != null ? new org.hl7.fhir.r4.model.StringType(given) : null
        );

        Bundle bundle = new Bundle();
        bundle.setType(Bundle.BundleType.SEARCHSET);
        bundle.setTotal(patients.size());

        for (Patient patient : patients) {
            Bundle.BundleEntryComponent entry = bundle.addEntry();
            entry.setResource(patient);
        }

        return ResponseEntity.ok(jsonParser.encodeResourceToString(bundle));
    }

    @GetMapping("/Patient/{id}")
    public ResponseEntity<String> getPatient(@PathVariable String id) {
        try {
            Patient patient = patientResourceProvider.read(new IdType(id));
            return ResponseEntity.ok(jsonParser.encodeResourceToString(patient));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body("{\"resourceType\":\"OperationOutcome\",\"issue\":[{\"severity\":\"error\",\"code\":\"not-found\",\"diagnostics\":\"Patient not found\"}]}");
        }
    }

    @PostMapping(value = "/Patient", consumes = "application/fhir+json", produces = "application/fhir+json")
    public ResponseEntity<String> createPatient(@RequestBody String patientJson) {
        try {
            Patient patient = jsonParser.parseResource(Patient.class, patientJson);
            var outcome = patientResourceProvider.create(patient);
            Patient createdPatient = (Patient) outcome.getResource();
            return ResponseEntity.status(HttpStatus.CREATED)
                .body(jsonParser.encodeResourceToString(createdPatient));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body("{\"resourceType\":\"OperationOutcome\",\"issue\":[{\"severity\":\"error\",\"code\":\"invalid\",\"diagnostics\":\"" + e.getMessage() + "\"}]}");
        }
    }

    @PutMapping(value = "/Patient/{id}", consumes = "application/fhir+json", produces = "application/fhir+json")
    public ResponseEntity<String> updatePatient(@PathVariable String id, @RequestBody String patientJson) {
        try {
            Patient patient = jsonParser.parseResource(Patient.class, patientJson);
            var outcome = patientResourceProvider.update(new IdType(id), patient);
            Patient updatedPatient = (Patient) outcome.getResource();
            return ResponseEntity.ok(jsonParser.encodeResourceToString(updatedPatient));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body("{\"resourceType\":\"OperationOutcome\",\"issue\":[{\"severity\":\"error\",\"code\":\"not-found\",\"diagnostics\":\"" + e.getMessage() + "\"}]}");
        }
    }

    @DeleteMapping("/Patient/{id}")
    public ResponseEntity<Void> deletePatient(@PathVariable String id) {
        try {
            patientResourceProvider.delete(new IdType(id));
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }
}
