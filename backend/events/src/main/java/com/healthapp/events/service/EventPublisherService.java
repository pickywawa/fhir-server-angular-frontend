package com.healthapp.events.service;

import com.healthapp.events.dto.PublishEventRequest;
import com.healthapp.events.model.EventPayload;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
public class EventPublisherService {

    private final KafkaTemplate<String, EventPayload> kafkaTemplate;
    private final String eventsTopic;

    public EventPublisherService(KafkaTemplate<String, EventPayload> kafkaTemplate,
                                 @Value("${app.events.topic}") String eventsTopic) {
        this.kafkaTemplate = kafkaTemplate;
        this.eventsTopic = eventsTopic;
    }

    public String publish(PublishEventRequest request) {
        String eventId = UUID.randomUUID().toString();
        EventPayload payload = new EventPayload(
            eventId,
            request.type(),
            request.title(),
            request.message(),
            request.actorUserId(),
            request.recipientUserIds(),
            request.metadata(),
            Instant.now()
        );

        kafkaTemplate.send(eventsTopic, eventId, payload);
        return eventId;
    }
}
