package com.healthapp.chatbot.service;

import com.healthapp.chatbot.model.StreamEvent;
import org.springframework.stereotype.Component;

import java.util.function.Consumer;

@Component
public class ToolEventPublisher {

    private final ThreadLocal<Consumer<StreamEvent>> emitter = new ThreadLocal<>();

    public void withEmitter(Consumer<StreamEvent> eventConsumer, Runnable action) {
        emitter.set(eventConsumer);
        try {
            action.run();
        } finally {
            emitter.remove();
        }
    }

    public void emit(String type, String content) {
        Consumer<StreamEvent> consumer = emitter.get();
        if (consumer == null) {
            return;
        }
        consumer.accept(new StreamEvent("", type, content));
    }
}
