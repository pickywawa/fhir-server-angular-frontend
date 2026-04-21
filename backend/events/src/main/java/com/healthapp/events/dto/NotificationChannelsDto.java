package com.healthapp.events.dto;

import jakarta.validation.constraints.NotNull;

public record NotificationChannelsDto(
    @NotNull Boolean push,
    @NotNull Boolean email,
    @NotNull Boolean sms
) {
}
