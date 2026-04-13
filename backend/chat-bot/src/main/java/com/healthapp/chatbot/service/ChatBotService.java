package com.healthapp.chatbot.service;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.time.Duration;


@Service
public class ChatBotService {

    private static final int HISTORY_WINDOW = 12;

    private final ChatClient chatClient;
    private final FhirToolService fhirToolService;
    private final String systemPrompt;
    private final ChatMemory chatMemory = MessageWindowChatMemory.builder()
            .chatMemoryRepository(new InMemoryChatMemoryRepository())
            .maxMessages(HISTORY_WINDOW * 2)
            .build();

    public ChatBotService(
            ChatClient.Builder chatClientBuilder,
            FhirToolService fhirToolService,
            @Value("${app.chatbot.system-prompt}") String systemPrompt
    ) {
        this.chatClient = chatClientBuilder.build();
        this.fhirToolService = fhirToolService;
        this.systemPrompt = systemPrompt;
    }

    public String chat(String userMessage, String sessionId, String practitionerId, String patientId, String fromUrl) {
        String sid = safeSession(sessionId);
        String enrichedUserMessage = enrichUserMessage(userMessage, practitionerId, patientId, fromUrl);
        try {
            String response = chatClient.prompt()
                    .system(systemPrompt)
                    .user(enrichedUserMessage)
                    .advisors(MessageChatMemoryAdvisor.builder(chatMemory)
                            .conversationId(sid)
                            .build())
                    .tools(fhirToolService)
                    .call()
                    .content();

            return (response == null || response.isBlank())
                    ? "Je n'ai pas de reponse exploitable pour le moment."
                    : response;
        } catch (Exception ex) {
            return unavailableMessage();
        }
    }

    public Flux<String> stream(String userMessage, String sessionId, String practitionerId, String patientId, String fromUrl) {
        return Mono.fromCallable(() -> chat(userMessage, sessionId, practitionerId, patientId, fromUrl))
                .subscribeOn(Schedulers.boundedElastic())
                .timeout(Duration.ofSeconds(180))
                .onErrorReturn(unavailableMessage())
                .flux();
    }

    private String enrichUserMessage(String userMessage, String practitionerId, String patientId, String fromUrl) {
        String practitioner = sanitize(practitionerId);
        String patient = sanitize(patientId);
        String url = sanitize(fromUrl);
        if (practitioner.isBlank() && patient.isBlank() && url.isBlank()) {
            return userMessage;
        }

        StringBuilder context = new StringBuilder();
        context.append("[context]\n");
        context.append("- connectedPractitionerId=").append(practitioner.isBlank() ? "none" : practitioner).append("\n");
        context.append("- currentPatientId=").append(patient.isBlank() ? "none" : patient).append("\n");
        context.append("- currentUrl=").append(url.isBlank() ? "unknown" : url).append("\n");
        context.append("- RULE: connectedPractitionerId is NEVER a patientId. If currentPatientId is none and user asks a patient summary by name, first resolve patient with searchPatient, then call synthesis tool with the resolved Patient ID.\n");
        return context.append("\n").append(userMessage).toString();
    }

    private String safeSession(String sessionId) {
        return (sessionId == null || sessionId.isBlank()) ? "anonymous" : sessionId;
    }

    private String unavailableMessage() {
        return "Le modele de langage est indisponible pour le moment. Verifiez Ollama (serveur actif et modele installe), puis reessayez.";
    }

    private String sanitize(String value) {
        return value == null ? "" : value.trim();
    }
}

