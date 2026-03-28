package com.healthapp.fhir.controller;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.parser.IParser;
import com.healthapp.fhir.provider.CodeSystemResourceProvider;
import org.hl7.fhir.r4.model.Bundle;
import org.hl7.fhir.r4.model.CodeSystem;
import org.hl7.fhir.r4.model.IdType;
import org.hl7.fhir.r4.model.StringType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/fhir")
@CrossOrigin(origins = "http://localhost:4200")
public class FhirCodeSystemController {

    private final CodeSystemResourceProvider codeSystemResourceProvider;
    private final IParser jsonParser;

    public FhirCodeSystemController(CodeSystemResourceProvider codeSystemResourceProvider,
                                     FhirContext fhirContext) {
        this.codeSystemResourceProvider = codeSystemResourceProvider;
        this.jsonParser = fhirContext.newJsonParser().setPrettyPrint(true);
    }

    // ------------------------------------------------------------------
    // GET /fhir/CodeSystem  — liste / recherche
    // ------------------------------------------------------------------
    @GetMapping("/CodeSystem")
    public ResponseEntity<String> searchCodeSystems(
            @RequestParam(required = false) String url,
            @RequestParam(required = false) String name) {

        List<CodeSystem> results = codeSystemResourceProvider.search(
                url  != null ? new StringType(url)  : null,
                name != null ? new StringType(name) : null);

        Bundle bundle = new Bundle();
        bundle.setType(Bundle.BundleType.SEARCHSET);
        bundle.setTotal(results.size());
        for (CodeSystem cs : results) {
            bundle.addEntry().setResource(cs);
        }
        return ResponseEntity.ok(jsonParser.encodeResourceToString(bundle));
    }

    // ------------------------------------------------------------------
    // GET /fhir/CodeSystem/{id}
    // ------------------------------------------------------------------
    @GetMapping("/CodeSystem/{id}")
    public ResponseEntity<String> getCodeSystem(@PathVariable String id) {
        try {
            CodeSystem cs = codeSystemResourceProvider.read(new IdType(id));
            return ResponseEntity.ok(jsonParser.encodeResourceToString(cs));
        } catch (Exception e) {
            return notFound("CodeSystem non trouvé : " + id);
        }
    }

    // ------------------------------------------------------------------
    // POST /fhir/CodeSystem  — création
    // ------------------------------------------------------------------
    @PostMapping(value = "/CodeSystem",
                 consumes = "application/fhir+json",
                 produces = "application/fhir+json")
    public ResponseEntity<String> createCodeSystem(@RequestBody String body) {
        try {
            CodeSystem cs = jsonParser.parseResource(CodeSystem.class, body);
            var outcome = codeSystemResourceProvider.create(cs);
            CodeSystem created = (CodeSystem) outcome.getResource();
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(jsonParser.encodeResourceToString(created));
        } catch (Exception e) {
            return badRequest("Impossible de créer le CodeSystem : " + e.getMessage());
        }
    }

    // ------------------------------------------------------------------
    // PUT /fhir/CodeSystem/{id}  — mise à jour
    // ------------------------------------------------------------------
    @PutMapping(value = "/CodeSystem/{id}",
                consumes = "application/fhir+json",
                produces = "application/fhir+json")
    public ResponseEntity<String> updateCodeSystem(@PathVariable String id,
                                                    @RequestBody String body) {
        try {
            CodeSystem cs = jsonParser.parseResource(CodeSystem.class, body);
            var outcome = codeSystemResourceProvider.update(new IdType(id), cs);
            CodeSystem updated = (CodeSystem) outcome.getResource();
            HttpStatus status = Boolean.TRUE.equals(outcome.getCreated())
                    ? HttpStatus.CREATED : HttpStatus.OK;
            return ResponseEntity.status(status)
                    .body(jsonParser.encodeResourceToString(updated));
        } catch (Exception e) {
            return badRequest("Impossible de mettre à jour le CodeSystem : " + e.getMessage());
        }
    }

    // ------------------------------------------------------------------
    // DELETE /fhir/CodeSystem/{id}
    // ------------------------------------------------------------------
    @DeleteMapping("/CodeSystem/{id}")
    public ResponseEntity<Void> deleteCodeSystem(@PathVariable String id) {
        try {
            codeSystemResourceProvider.delete(new IdType(id));
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------
    private ResponseEntity<String> notFound(String message) {
        String body = "{\"resourceType\":\"OperationOutcome\","
                + "\"issue\":[{\"severity\":\"error\",\"code\":\"not-found\","
                + "\"diagnostics\":\"" + message + "\"}]}";
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }

    private ResponseEntity<String> badRequest(String message) {
        String body = "{\"resourceType\":\"OperationOutcome\","
                + "\"issue\":[{\"severity\":\"error\",\"code\":\"invalid\","
                + "\"diagnostics\":\"" + message + "\"}]}";
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }
}
