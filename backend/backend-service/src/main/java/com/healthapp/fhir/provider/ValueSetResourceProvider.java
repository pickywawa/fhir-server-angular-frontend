package com.healthapp.fhir.provider;

import ca.uhn.fhir.rest.annotation.*;
import ca.uhn.fhir.rest.api.MethodOutcome;
import ca.uhn.fhir.rest.server.IResourceProvider;
import ca.uhn.fhir.rest.server.exceptions.ResourceNotFoundException;
import org.hl7.fhir.r4.model.*;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class ValueSetResourceProvider implements IResourceProvider {

    private final Map<String, ValueSet> valueSets = new HashMap<>();

    public ValueSetResourceProvider() {
        initializeCarePlanCategoryValueSet();
    }

    @Override
    public Class<ValueSet> getResourceType() {
        return ValueSet.class;
    }

    @Read
    public ValueSet read(@IdParam IdType theId) {
        ValueSet vs = valueSets.get(theId.getIdPart());
        if (vs == null) {
            throw new ResourceNotFoundException(theId);
        }
        return vs;
    }

    @Create
    public MethodOutcome create(@ResourceParam ValueSet theValueSet) {
        String id = theValueSet.hasId() ? theValueSet.getIdElement().getIdPart()
                : UUID.randomUUID().toString();
        theValueSet.setId(id);
        valueSets.put(id, theValueSet);

        MethodOutcome outcome = new MethodOutcome();
        outcome.setId(new IdType("ValueSet", id));
        outcome.setCreated(true);
        outcome.setResource(theValueSet);
        return outcome;
    }

    @Update
    public MethodOutcome update(@IdParam IdType theId, @ResourceParam ValueSet theValueSet) {
        String id = theId.getIdPart();
        boolean created = !valueSets.containsKey(id);
        theValueSet.setId(id);
        valueSets.put(id, theValueSet);

        MethodOutcome outcome = new MethodOutcome();
        outcome.setId(new IdType("ValueSet", id));
        outcome.setCreated(created);
        outcome.setResource(theValueSet);
        return outcome;
    }

    @Delete
    public MethodOutcome delete(@IdParam IdType theId) {
        String id = theId.getIdPart();
        if (!valueSets.containsKey(id)) {
            throw new ResourceNotFoundException(theId);
        }
        valueSets.remove(id);

        MethodOutcome outcome = new MethodOutcome();
        outcome.setId(theId);
        return outcome;
    }

    @Search
    public List<ValueSet> search(
            @OptionalParam(name = ValueSet.SP_URL) StringType url,
            @OptionalParam(name = ValueSet.SP_NAME) StringType name) {

        List<ValueSet> result = new ArrayList<>(valueSets.values());

        if (url != null && url.getValue() != null && !url.getValue().isBlank()) {
            result.removeIf(vs -> !url.getValue().equals(vs.getUrl()));
        }
        if (name != null && name.getValue() != null && !name.getValue().isBlank()) {
            String nameFilter = name.getValue().toLowerCase();
            result.removeIf(vs -> vs.getName() == null
                    || !vs.getName().toLowerCase().contains(nameFilter));
        }
        return result;
    }

    /** Retourne la ValueSet avec une expansion déjà calculée (codes + libellés FR). */
    public Optional<ValueSet> expand(String id) {
        ValueSet vs = valueSets.get(id);
        if (vs == null) {
            return Optional.empty();
        }

        ValueSet expanded = vs.copy();
        ValueSet.ValueSetExpansionComponent expansion = new ValueSet.ValueSetExpansionComponent();
        expansion.setIdentifier(UUID.randomUUID().toString());
        expansion.setTimestamp(new Date());

        for (ValueSet.ConceptSetComponent include : vs.getCompose().getInclude()) {
            for (ValueSet.ConceptReferenceComponent concept : include.getConcept()) {
                ValueSet.ValueSetExpansionContainsComponent contains =
                        new ValueSet.ValueSetExpansionContainsComponent();
                contains.setSystem(include.getSystem());
                contains.setCode(concept.getCode());

                // Préférer la désignation française si disponible
                String frDisplay = concept.getDesignation().stream()
                        .filter(d -> "fr".equals(d.getLanguage()) || "fr-FR".equals(d.getLanguage()))
                        .map(ValueSet.ConceptReferenceDesignationComponent::getValue)
                        .findFirst()
                        .orElse(concept.getDisplay());
                contains.setDisplay(frDisplay);
                expansion.addContains(contains);
            }
        }
        expansion.setTotal(expansion.getContains().size());
        expanded.setExpansion(expansion);
        return Optional.of(expanded);
    }

    public Map<String, ValueSet> getAllValueSets() {
        return Collections.unmodifiableMap(valueSets);
    }

    // -------------------------------------------------------------------------
    // Données initiales : catégories de CarePlan en français
    // Basé sur http://hl7.org/fhir/ValueSet/care-plan-category (build.fhir.org)
    // -------------------------------------------------------------------------
    private void initializeCarePlanCategoryValueSet() {
        ValueSet vs = new ValueSet();
        vs.setId("care-plan-category");
        vs.setUrl("http://hl7.org/fhir/ValueSet/care-plan-category");
        vs.setName("CarePlanCategory");
        vs.setTitle("Catégories de plan de soins");
        vs.setStatus(Enumerations.PublicationStatus.ACTIVE);
        vs.setVersion("1.0.0");
        vs.setDescription(
                "Catégories pour la classification des plans de soins (CarePlan). "
                + "Basé sur http://healthapp.com/fhir/CodeSystem/care-plan-category.");
        vs.setLanguage("fr");

        Meta meta = new Meta();
        meta.addTag()
            .setSystem("http://terminology.hl7.org/CodeSystem/v3-ObservationValue")
            .setCode("SUBSETTED");
        vs.setMeta(meta);

        ValueSet.ValueSetComposeComponent compose = new ValueSet.ValueSetComposeComponent();
        ValueSet.ConceptSetComponent include = new ValueSet.ConceptSetComponent();
        include.setSystem(CodeSystemResourceProvider.CARE_PLAN_CATEGORY_URL);

        include.addConcept(buildConcept("assess-plan",
                "Assessment and Plan of Treatment",
                "Évaluation et plan de traitement"));
        include.addConcept(buildConcept("nursing",
                "Nursing Care Plan",
                "Plan de soins infirmiers"));
        include.addConcept(buildConcept("medication",
                "Medication Management Plan",
                "Plan de gestion médicamenteuse"));
        include.addConcept(buildConcept("rehabilitation",
                "Rehabilitation Plan",
                "Plan de rééducation / réadaptation"));
        include.addConcept(buildConcept("patient-education",
                "Patient Education Plan",
                "Éducation thérapeutique du patient"));
        include.addConcept(buildConcept("preventive",
                "Preventive Care Plan",
                "Plan de soins préventifs"));
        include.addConcept(buildConcept("palliative",
                "Palliative Care Plan",
                "Plan de soins palliatifs"));
        include.addConcept(buildConcept("surgical",
                "Surgical Care Plan",
                "Plan de soins chirurgicaux"));
        include.addConcept(buildConcept("mental-health",
                "Mental Health Care Plan",
                "Plan de santé mentale"));
        include.addConcept(buildConcept("chronic-disease",
                "Chronic Disease Management Plan",
                "Plan de gestion des maladies chroniques"));

        compose.addInclude(include);
        vs.setCompose(compose);

        valueSets.put("care-plan-category", vs);
    }

    private ValueSet.ConceptReferenceComponent buildConcept(
            String code, String displayEn, String displayFr) {

        ValueSet.ConceptReferenceComponent concept = new ValueSet.ConceptReferenceComponent();
        concept.setCode(code);
        concept.setDisplay(displayFr);

        // Désignation anglaise
        ValueSet.ConceptReferenceDesignationComponent desEn =
                new ValueSet.ConceptReferenceDesignationComponent();
        desEn.setLanguage("en");
        desEn.setValue(displayEn);
        concept.addDesignation(desEn);

        // Désignation française explicite
        ValueSet.ConceptReferenceDesignationComponent desFr =
                new ValueSet.ConceptReferenceDesignationComponent();
        desFr.setLanguage("fr");
        desFr.setValue(displayFr);
        concept.addDesignation(desFr);

        return concept;
    }
}
