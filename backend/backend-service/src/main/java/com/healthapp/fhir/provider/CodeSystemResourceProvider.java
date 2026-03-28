package com.healthapp.fhir.provider;

import ca.uhn.fhir.rest.annotation.*;
import ca.uhn.fhir.rest.api.MethodOutcome;
import ca.uhn.fhir.rest.server.IResourceProvider;
import ca.uhn.fhir.rest.server.exceptions.ResourceNotFoundException;
import org.hl7.fhir.r4.model.*;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class CodeSystemResourceProvider implements IResourceProvider {

    public static final String CARE_PLAN_CATEGORY_ID  = "care-plan-category";
    public static final String CARE_PLAN_CATEGORY_URL =
            "http://healthapp.com/fhir/CodeSystem/care-plan-category";

    private final Map<String, CodeSystem> codeSystems = new HashMap<>();

    public CodeSystemResourceProvider() {
        initializeCarePlanCategoryCodeSystem();
    }

    @Override
    public Class<CodeSystem> getResourceType() {
        return CodeSystem.class;
    }

    @Read
    public CodeSystem read(@IdParam IdType theId) {
        CodeSystem cs = codeSystems.get(theId.getIdPart());
        if (cs == null) {
            throw new ResourceNotFoundException(theId);
        }
        return cs;
    }

    @Create
    public MethodOutcome create(@ResourceParam CodeSystem theCodeSystem) {
        String id = theCodeSystem.hasId()
                ? theCodeSystem.getIdElement().getIdPart()
                : UUID.randomUUID().toString();
        theCodeSystem.setId(id);
        codeSystems.put(id, theCodeSystem);

        MethodOutcome outcome = new MethodOutcome();
        outcome.setId(new IdType("CodeSystem", id));
        outcome.setCreated(true);
        outcome.setResource(theCodeSystem);
        return outcome;
    }

    @Update
    public MethodOutcome update(@IdParam IdType theId, @ResourceParam CodeSystem theCodeSystem) {
        String id = theId.getIdPart();
        boolean created = !codeSystems.containsKey(id);
        theCodeSystem.setId(id);
        codeSystems.put(id, theCodeSystem);

        MethodOutcome outcome = new MethodOutcome();
        outcome.setId(new IdType("CodeSystem", id));
        outcome.setCreated(created);
        outcome.setResource(theCodeSystem);
        return outcome;
    }

    @Delete
    public MethodOutcome delete(@IdParam IdType theId) {
        String id = theId.getIdPart();
        if (!codeSystems.containsKey(id)) {
            throw new ResourceNotFoundException(theId);
        }
        codeSystems.remove(id);

        MethodOutcome outcome = new MethodOutcome();
        outcome.setId(theId);
        return outcome;
    }

    @Search
    public List<CodeSystem> search(
            @OptionalParam(name = CodeSystem.SP_URL)  StringType url,
            @OptionalParam(name = CodeSystem.SP_NAME) StringType name) {

        List<CodeSystem> result = new ArrayList<>(codeSystems.values());

        if (url != null && url.getValue() != null && !url.getValue().isBlank()) {
            result.removeIf(cs -> !url.getValue().equals(cs.getUrl()));
        }
        if (name != null && name.getValue() != null && !name.getValue().isBlank()) {
            String nameFilter = name.getValue().toLowerCase();
            result.removeIf(cs -> cs.getName() == null
                    || !cs.getName().toLowerCase().contains(nameFilter));
        }
        return result;
    }

    public Map<String, CodeSystem> getAllCodeSystems() {
        return Collections.unmodifiableMap(codeSystems);
    }

    // -------------------------------------------------------------------------
    // Données initiales — Catégories de CarePlan en français
    // Basé sur https://build.fhir.org/valueset-care-plan-category.html
    // -------------------------------------------------------------------------
    private void initializeCarePlanCategoryCodeSystem() {
        CodeSystem cs = new CodeSystem();
        cs.setId(CARE_PLAN_CATEGORY_ID);
        cs.setUrl(CARE_PLAN_CATEGORY_URL);
        cs.setName("CarePlanCategory");
        cs.setTitle("Catégories de plan de soins");
        cs.setStatus(Enumerations.PublicationStatus.ACTIVE);
        cs.setVersion("1.0.0");
        cs.setLanguage("fr");
        cs.setDescription(
                "Catégories pour la classification des plans de soins (CarePlan) — libellés en français.");
        cs.setContent(CodeSystem.CodeSystemContentMode.COMPLETE);
        cs.setCaseSensitive(false);

        cs.addConcept(buildConcept("assess-plan",
                "Évaluation et plan de traitement",
                "Assessment and Plan of Treatment",
                "Plan global d'évaluation clinique et de prise en charge thérapeutique du patient."));
        cs.addConcept(buildConcept("nursing",
                "Plan de soins infirmiers",
                "Nursing Care Plan",
                "Plan décrivant les soins infirmiers prescrits et les objectifs associés."));
        cs.addConcept(buildConcept("medication",
                "Plan de gestion médicamenteuse",
                "Medication Management Plan",
                "Plan de suivi et d'administration des traitements médicamenteux."));
        cs.addConcept(buildConcept("rehabilitation",
                "Plan de rééducation / réadaptation",
                "Rehabilitation Plan",
                "Plan structurant les séances et objectifs de rééducation fonctionnelle."));
        cs.addConcept(buildConcept("patient-education",
                "Éducation thérapeutique du patient",
                "Patient Education Plan",
                "Plan d'éducation du patient à sa maladie et à son auto-gestion."));
        cs.addConcept(buildConcept("preventive",
                "Plan de soins préventifs",
                "Preventive Care Plan",
                "Plan axé sur la prévention des maladies et la promotion de la santé."));
        cs.addConcept(buildConcept("palliative",
                "Plan de soins palliatifs",
                "Palliative Care Plan",
                "Plan centré sur le confort et la qualité de vie en fin de vie."));
        cs.addConcept(buildConcept("surgical",
                "Plan de soins chirurgicaux",
                "Surgical Care Plan",
                "Plan de préparation, de suivi opératoire et de récupération post-chirurgicale."));
        cs.addConcept(buildConcept("mental-health",
                "Plan de santé mentale",
                "Mental Health Care Plan",
                "Plan de prise en charge des troubles psychiatriques et psychologiques."));
        cs.addConcept(buildConcept("chronic-disease",
                "Plan de gestion des maladies chroniques",
                "Chronic Disease Management Plan",
                "Plan de suivi à long terme pour les pathologies chroniques."));

        cs.setCount(cs.getConcept().size());
        codeSystems.put(CARE_PLAN_CATEGORY_ID, cs);
    }

    private CodeSystem.ConceptDefinitionComponent buildConcept(
            String code, String displayFr, String displayEn, String definition) {

        CodeSystem.ConceptDefinitionComponent concept = new CodeSystem.ConceptDefinitionComponent();
        concept.setCode(code);
        concept.setDisplay(displayFr);
        concept.setDefinition(definition);

        // Désignation française explicite
        CodeSystem.ConceptDefinitionDesignationComponent desFr =
                new CodeSystem.ConceptDefinitionDesignationComponent();
        desFr.setLanguage("fr");
        desFr.setValue(displayFr);
        concept.addDesignation(desFr);

        // Désignation anglaise
        CodeSystem.ConceptDefinitionDesignationComponent desEn =
                new CodeSystem.ConceptDefinitionDesignationComponent();
        desEn.setLanguage("en");
        desEn.setValue(displayEn);
        concept.addDesignation(desEn);

        return concept;
    }
}
