package com.healthapp.events.dto;

import com.healthapp.events.model.NotificationPriority;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record NotificationPreferenceValueDto(
    @NotNull Boolean enabled,
    @NotNull NotificationPriority priority,
    @Valid @NotNull NotificationChannelsDto channels
) {
}
