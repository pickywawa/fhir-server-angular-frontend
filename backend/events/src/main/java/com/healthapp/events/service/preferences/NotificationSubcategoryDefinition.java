package com.healthapp.events.service.preferences;

public record NotificationSubcategoryDefinition(
    String key,
    String title,
    String description,
    NotificationPreferenceDefaults defaults
) {
}
