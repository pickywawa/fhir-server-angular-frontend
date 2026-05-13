package com.healthapp.chatbot.service;

import org.springframework.stereotype.Component;

import java.util.function.Supplier;

@Component
public class ChatSessionContext {

    private final ThreadLocal<String> currentSessionId = new ThreadLocal<>();

    public <T> T withSession(String sessionId, Supplier<T> action) {
        currentSessionId.set(sessionId);
        try {
            return action.get();
        } finally {
            currentSessionId.remove();
        }
    }

    public String getCurrentSessionId() {
        return currentSessionId.get();
    }
}
