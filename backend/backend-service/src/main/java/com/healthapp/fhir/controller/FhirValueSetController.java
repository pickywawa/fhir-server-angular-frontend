package com.healthapp.fhir.controller;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.parser.IParser;
import com.healthapp.fhir.provider.ValueSetResourceProvider;
import org.hl7.fhir.r4.model.IdType;
import org.hl7.fhir.r4.model.Bundle;
import org.hl7.fhir.r4.model.StringType;
import org.hl7.fhir.r4.model.ValueSet;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/fhir")
@CrossOrigin(origins = "http://localhost:4200")
public class FhirValueSetController {

    private final ValueSetResourceProvider valueSetResourceProvider;
    private final IParser jsonParser;

    public FhirValueSetController(ValueSetResourceProvider valueSetResourceProvider,
                                   FhirContext fhirContext) {
        this.valueSetResourceProvider = valueSetResourceProvider;
        this.jsonParser = fhirContext.newJsonParser().setPrettyPrint(true);
    }

    // ------------------------------------------------------------------
    // GET /fhir/ValueSet  — liste / recherche
    // ------------------------------------------------------------------
    @GetMapping("/ValueSet")
    public ResponseEntity<String> searchValueSets(
            @RequestParam(required = false) String url,
            @RequestParam(required = false) String name) {

        List<ValueSet> valueSets = valueSetResourceProvider.search(
                url != null ? new StringType(url) : null,
                name != null ? new StringType(name) : null);

        Bundle bundle = new Bundle();
        bundle.setType(Bundle.BundleType.SEARCHSET);
        bundle.setTotal(valueSets.size());
        for (ValueSet vs : valueSets) {
            bundle.addEntry().setResource(vs);
        }
        return ResponseEntity.ok(jsonParser.encodeResourceToString(bundle));
    }

    // ------------------------------------------------------------------
    // GET /fhir/ValueSet/{id}  — lecture d'une ValueSet
    // ------------------------------------------------------------------
    @GetMapping("/ValueSet/{id}")
    public ResponseEntity<String> getValueSet(@PathVariable String id) {
        try {
            ValueSet vs = valueSetResourceProvider.read(new IdType(id));
            return ResponseEntity.ok(jsonParser.encodeResourceToString(vs));
        } catch (Exception e) {
            return notFound("ValueSet non trouvé : " + id);
        }
    }

    // ------------------------------------------------------------------
    // GET /fhir/ValueSet/{id}/$expand  — expansion (codes + libellés FR)
    // ------------------------------------------------------------------
    @GetMapping("/ValueSet/{id}/$expand")
    public ResponseEntity<String> expandValueSet(@PathVariable String id) {
        return valueSetResourceProvider.expand(id)
                .map(expanded -> ResponseEntity.ok(jsonParser.encodeResourceToString(expanded)))
                .orElseGet(() -> notFound("ValueSet non trouvé pour l'expansion : " + id));
    }

    // ------------------------------------------------------------------
    // POST /fhir/ValueSet  — création d'une nouvelle ValueSet
    // ------------------------------------------------------------------
    @PostMapping(value = "/ValueSet",
                 consumes = "application/fhir+json",
                 produces = "application/fhir+json")
    public ResponseEntity<String> createValueSet(@RequestBody String body) {
        try {
            ValueSet vs = jsonParser.parseResource(ValueSet.class, body);
            var outcome = valueSetResourceProvider.create(vs);
            ValueSet created = (ValueSet) outcome.getResource();
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(jsonParser.encodeResourceToString(created));
        } catch (Exception e) {
            return badRequest("Impossible de créer la ValueSet : " + e.getMessage());
        }
    }

    // ------------------------------------------------------------------
    // PUT /fhir/ValueSet/{id}  — mise à jour / remplacement
    // ------------------------------------------------------------------
    @PutMapping(value = "/ValueSet/{id}",
                consumes = "application/fhir+json",
                produces = "application/fhir+json")
    public ResponseEntity<String> updateValueSet(@PathVariable String id,
                                                  @RequestBody String body) {
        try {
            ValueSet vs = jsonParser.parseResource(ValueSet.class, body);
            var outcome = valueSetResourceProvider.update(new IdType(id), vs);
            ValueSet updated = (ValueSet) outcome.getResource();
            HttpStatus status = Boolean.TRUE.equals(outcome.getCreated())
                    ? HttpStatus.CREATED : HttpStatus.OK;
            return ResponseEntity.status(status)
                    .body(jsonParser.encodeResourceToString(updated));
        } catch (Exception e) {
            return badRequest("Impossible de mettre à jour la ValueSet : " + e.getMessage());
        }
    }

    // ------------------------------------------------------------------
    // DELETE /fhir/ValueSet/{id}
    // ------------------------------------------------------------------
    @DeleteMapping("/ValueSet/{id}")
    public ResponseEntity<Void> deleteValueSet(@PathVariable String id) {
        try {
            valueSetResourceProvider.delete(new IdType(id));
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
