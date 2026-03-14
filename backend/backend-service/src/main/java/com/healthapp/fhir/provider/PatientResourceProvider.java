package com.healthapp.fhir.provider;

import ca.uhn.fhir.rest.annotation.*;
import ca.uhn.fhir.rest.api.MethodOutcome;
import ca.uhn.fhir.rest.server.IResourceProvider;
import ca.uhn.fhir.rest.server.exceptions.ResourceNotFoundException;
import org.hl7.fhir.r4.model.*;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * FHIR Patient Resource Provider
 */
@Component
public class PatientResourceProvider implements IResourceProvider {

    private final Map<String, Patient> patients = new HashMap<>();

    @Override
    public Class<Patient> getResourceType() {
        return Patient.class;
    }

    @Read
    public Patient read(@IdParam IdType theId) {
        Patient patient = patients.get(theId.getIdPart());
        if (patient == null) {
            throw new ResourceNotFoundException(theId);
        }
        return patient;
    }

    @Create
    public MethodOutcome create(@ResourceParam Patient thePatient) {
        String id = UUID.randomUUID().toString();
        thePatient.setId(id);
        patients.put(id, thePatient);

        MethodOutcome outcome = new MethodOutcome();
        outcome.setId(new IdType("Patient", id));
        outcome.setCreated(true);
        outcome.setResource(thePatient);
        return outcome;
    }

    @Update
    public MethodOutcome update(@IdParam IdType theId, @ResourceParam Patient thePatient) {
        String id = theId.getIdPart();
        if (!patients.containsKey(id)) {
            throw new ResourceNotFoundException(theId);
        }
        thePatient.setId(id);
        patients.put(id, thePatient);

        MethodOutcome outcome = new MethodOutcome();
        outcome.setId(new IdType("Patient", id));
        outcome.setResource(thePatient);
        return outcome;
    }

    @Delete
    public MethodOutcome delete(@IdParam IdType theId) {
        String id = theId.getIdPart();
        if (!patients.containsKey(id)) {
            throw new ResourceNotFoundException(theId);
        }
        patients.remove(id);

        MethodOutcome outcome = new MethodOutcome();
        outcome.setId(theId);
        return outcome;
    }

    @Search
    public List<Patient> search(
            @OptionalParam(name = Patient.SP_FAMILY) StringType familyName,
            @OptionalParam(name = Patient.SP_GIVEN) StringType givenName) {

        List<Patient> result = new ArrayList<>(patients.values());

        if (familyName != null) {
            result.removeIf(patient ->
                patient.getName().stream()
                    .noneMatch(name -> name.getFamily().contains(familyName.getValue())));
        }

        if (givenName != null) {
            result.removeIf(patient ->
                patient.getName().stream()
                    .noneMatch(name -> name.getGiven().stream()
                        .anyMatch(given -> given.getValue().contains(givenName.getValue()))));
        }

        return result;
    }
}
