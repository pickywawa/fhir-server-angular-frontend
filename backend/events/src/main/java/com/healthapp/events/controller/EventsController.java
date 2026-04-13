package com.healthapp.events.controller;

import com.healthapp.events.dto.PublishEventRequest;
import com.healthapp.events.service.EventPublisherService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/events")
public class EventsController {

    private final EventPublisherService eventPublisherService;

    public EventsController(EventPublisherService eventPublisherService) {
        this.eventPublisherService = eventPublisherService;
    }

    @PostMapping("/publish")
    public Map<String, Object> publish(@Valid @RequestBody PublishEventRequest request) {
        String eventId = eventPublisherService.publish(request);
        return Map.of(
            "status", "accepted",
            "eventId", eventId,
            "publishedAt", Instant.now().toString()
        );
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP", "service", "events");
    }
}
