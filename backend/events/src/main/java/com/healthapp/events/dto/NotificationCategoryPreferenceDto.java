package com.healthapp.events.dto;

import java.util.List;

public record NotificationCategoryPreferenceDto(
    String key,
    String title,
    String description,
    NotificationPreferenceValueDto defaultPreference,
    NotificationPreferenceValueDto preference,
    boolean customized,
    List<NotificationSubcategoryPreferenceDto> subcategories
) {
}
