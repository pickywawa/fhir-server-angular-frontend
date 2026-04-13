package com.healthapp.events.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.Map;

public record PublishEventRequest(
    @NotBlank String type,
    @NotBlank String title,
    @NotBlank String message,
    String actorUserId,
    @NotEmpty List<String> recipientUserIds,
    Map<String, Object> metadata
) {
}
