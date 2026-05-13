package com.healthapp.chatbot.service;

import com.healthapp.chatbot.model.ContextFilePayload;
import com.healthapp.chatbot.model.StreamEvent;
import dev.langchain4j.memory.chat.MessageWindowChatMemory;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.service.AiServices;
import dev.langchain4j.service.MemoryId;
import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.service.UserMessage;
import dev.langchain4j.service.V;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.List;

@Service
public class ChatBotService {

    private static final Logger logger = LoggerFactory.getLogger(ChatBotService.class);

    private final BlockingAssistant blockingAssistant;
    private final ToolEventPublisher toolEventPublisher;
    private final ChatSessionContext chatSessionContext;
    private final ContextFileSessionStore contextFileSessionStore;
    private final String systemPrompt;

    public ChatBotService(
            ChatLanguageModel chatLanguageModel,
            FhirToolService fhirToolService,
            ToolEventPublisher toolEventPublisher,
            ChatSessionContext chatSessionContext,
            ContextFileSessionStore contextFileSessionStore,
            @Value("${app.chatbot.system-prompt}") String systemPrompt,
            @Value("${app.chatbot.memory-window:24}") Integer memoryWindow
    ) {
        Map<Object, MessageWindowChatMemory> memories = new ConcurrentHashMap<>();

        this.blockingAssistant = AiServices.builder(BlockingAssistant.class)
                .chatLanguageModel(chatLanguageModel)
                .tools(fhirToolService)
                .chatMemoryProvider(memoryId -> memories.computeIfAbsent(
                        memoryId,
                        id -> MessageWindowChatMemory.withMaxMessages(memoryWindow)
                ))
                .build();

        this.toolEventPublisher = toolEventPublisher;
        this.chatSessionContext = chatSessionContext;
        this.contextFileSessionStore = contextFileSessionStore;
        this.systemPrompt = systemPrompt;
    }

    public String chat(
            String userMessage,
            String sessionId,
            String practitionerId,
            String patientId,
            String fromUrl,
            List<ContextFilePayload> contextFiles
    ) {
        String sid = safeSession(sessionId);
        String enrichedUserMessage = enrichUserMessage(sid, userMessage, practitionerId, patientId, fromUrl, contextFiles);

        try {
            String response = chatSessionContext.withSession(
                    sid,
                    () -> blockingAssistant.chat(sid, systemPrompt, enrichedUserMessage)
            );
            if (response == null || response.isBlank()) {
                return "Je n'ai pas de reponse exploitable pour le moment.";
            }
            return response;
        } catch (Exception ex) {
            logger.error("[chat] failed sessionId={}, message={}", sid, ex.getMessage(), ex);
            return "Le modele est indisponible pour le moment. Verifiez Ollama et le modele configure, puis reessayez.";
        }
    }

    public Flux<ServerSentEvent<StreamEvent>> stream(
            String userMessage,
            String sessionId,
            String practitionerId,
            String patientId,
            String fromUrl,
            List<ContextFilePayload> contextFiles
    ) {
        String sid = safeSession(sessionId);
        String enrichedUserMessage = enrichUserMessage(sid, userMessage, practitionerId, patientId, fromUrl, contextFiles);

        Sinks.Many<ServerSentEvent<StreamEvent>> sink = Sinks.many().unicast().onBackpressureBuffer();
        AtomicBoolean closed = new AtomicBoolean(false);

        emit(sink, sid, "start", "Demarrage du traitement iteratif");

        CompletableFuture.runAsync(() -> {
            toolEventPublisher.withEmitter(event -> {
                String eventSessionId = event.sessionId().isBlank() ? sid : event.sessionId();
                emit(sink, eventSessionId, event.type(), event.content());
            }, () -> {
                try {
                    String response = chatSessionContext.withSession(
                            sid,
                            () -> blockingAssistant.chat(sid, systemPrompt, enrichedUserMessage)
                    );
                    emitInChunks(sink, sid, response == null ? "" : response);
                } catch (Exception error) {
                    logger.error("[stream] failed sessionId={}, message={}", sid, error.getMessage(), error);
                    emit(sink, sid, "error", "Erreur: " + safe(error.getMessage()));
                } finally {
                    close(sink, closed, sid);
                }
            });
        });

        return sink.asFlux();
    }

    private void emitInChunks(Sinks.Many<ServerSentEvent<StreamEvent>> sink, String sid, String response) {
        if (response.isBlank()) {
            emit(sink, sid, "chunk", "Je n'ai pas de reponse exploitable pour le moment.");
            return;
        }
        int chunkSize = 120;
        for (int start = 0; start < response.length(); start += chunkSize) {
            int end = Math.min(start + chunkSize, response.length());
            emit(sink, sid, "chunk", response.substring(start, end));
        }
    }

    private void emit(Sinks.Many<ServerSentEvent<StreamEvent>> sink, String sessionId, String type, String content) {
        sink.tryEmitNext(ServerSentEvent.builder(new StreamEvent(sessionId, type, content)).build());
    }

    private void close(Sinks.Many<ServerSentEvent<StreamEvent>> sink, AtomicBoolean closed, String sessionId) {
        if (closed.compareAndSet(false, true)) {
            emit(sink, sessionId, "done", "");
            sink.tryEmitComplete();
        }
    }

    private String enrichUserMessage(
            String sessionId,
            String userMessage,
            String practitionerId,
            String patientId,
            String fromUrl,
            List<ContextFilePayload> contextFiles
    ) {
        String practitioner = sanitize(practitionerId);
        String patient = sanitize(patientId);
        String url = sanitize(fromUrl);
        String contextFilesSummary = contextFileSessionStore.upsertFiles(sessionId, contextFiles);

        StringBuilder context = new StringBuilder();
        context.append("[runtime_context]\n");
        context.append("connectedPractitionerId=").append(practitioner.isBlank() ? "none" : practitioner).append("\n");
        context.append("currentPatientId=").append(patient.isBlank() ? "none" : patient).append("\n");
        context.append("currentUrl=").append(url.isBlank() ? "unknown" : url).append("\n\n");
        appendAttachedFilesContext(context, contextFilesSummary);
        context.append("[user_request]\n").append(userMessage == null ? "" : userMessage);

        return context.toString();
    }

    private String safeSession(String sessionId) {
        return (sessionId == null || sessionId.isBlank()) ? UUID.randomUUID().toString() : sessionId;
    }

    private String sanitize(String value) {
        return value == null ? "" : value.trim();
    }

    private String safe(String value) {
        return value == null ? "unknown" : value;
    }

    private void appendAttachedFilesContext(StringBuilder context, String summary) {
        if (summary == null || summary.isBlank()) {
            return;
        }

        context.append("[attached_context_files]\n");
        context.append(summary).append("\n");
        context.append("Utilise le tool searchInContextFile pour retrouver des passages pertinents dans ces fichiers.\n\n");
    }

    interface BlockingAssistant {

        @SystemMessage("{{systemPrompt}}")
        String chat(
                @MemoryId String sessionId,
                @V("systemPrompt") String systemPrompt,
                @UserMessage String userMessage
        );
    }

}
