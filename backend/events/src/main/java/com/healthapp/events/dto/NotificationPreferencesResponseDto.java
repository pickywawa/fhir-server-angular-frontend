package com.healthapp.events.dto;

import java.util.List;

public record NotificationPreferencesResponseDto(
    String userId,
    List<NotificationCategoryPreferenceDto> categories
) {
}
