package com.healthapp.chatbot.controller;

import com.healthapp.chatbot.model.patient.PatientAnalysisRequest;
import com.healthapp.chatbot.model.patient.PatientAnalysisResponse;
import com.healthapp.chatbot.service.PatientAnalysisService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/patient-analysis")
public class PatientAnalysisController {

    private final PatientAnalysisService patientAnalysisService;

    public PatientAnalysisController(PatientAnalysisService patientAnalysisService) {
        this.patientAnalysisService = patientAnalysisService;
    }

    @PostMapping(path = "/generate", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<PatientAnalysisResponse> generate(@RequestBody PatientAnalysisRequest request) {
        return patientAnalysisService.generateAnalysis(request);
    }
}
