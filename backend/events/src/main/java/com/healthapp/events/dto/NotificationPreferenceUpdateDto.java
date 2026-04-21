package com.healthapp.events.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record NotificationPreferenceUpdateDto(
    @NotBlank String categoryKey,
    String subcategoryKey,
    @Valid @NotNull NotificationPreferenceValueDto preference
) {
}
