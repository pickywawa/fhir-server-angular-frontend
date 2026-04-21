package com.healthapp.events.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record UpdateNotificationPreferencesRequest(
    @Valid @NotEmpty List<NotificationPreferenceUpdateDto> preferences
) {
}
