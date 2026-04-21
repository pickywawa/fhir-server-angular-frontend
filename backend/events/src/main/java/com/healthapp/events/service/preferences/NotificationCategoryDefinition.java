package com.healthapp.events.service.preferences;

import java.util.List;

public record NotificationCategoryDefinition(
    String key,
    String title,
    String description,
    NotificationPreferenceDefaults defaults,
    List<NotificationSubcategoryDefinition> subcategories
) {
}
