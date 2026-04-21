package com.healthapp.events.dto;

public record NotificationSubcategoryPreferenceDto(
    String key,
    String title,
    String description,
    NotificationPreferenceValueDto defaultPreference,
    NotificationPreferenceValueDto preference,
    boolean customized
) {
}
