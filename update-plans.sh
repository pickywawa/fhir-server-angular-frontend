#!/bin/bash
FHIR_API_URL="http://localhost:8081/fhir"

# IDs des Goals créés
DIABETES_GOALS="1464 1466 1465"
DIABETES_TASKS="1480 1483 1481 1482"

HYPERTENSION_GOALS="1467 1469 1468"
HYPERTENSION_TASKS="1484 1486 1485 1488 1487"

ASTHMA_GOALS="1458 1459 1460"
ASTHMA_TASKS="1471 1470 1472 1473"

COPD_GOALS="1463 1462 1461"
COPD_TASKS="1475 1474 1476 1477 1479 1478"

# Fonction pour mettre à jour le fichier JSON
update_json_refs() {
    local file=$1
    local goals=$2
    local tasks=$3
    
    local json=$(jq '.extension = []' "$file")
    
    for goal_id in $goals; do
        json=$(echo "$json" | jq ".extension += [{\"url\": \"https://health-fhir.fr/StructureDefinition/plandefinition-goal-reference\", \"valueReference\": {\"reference\": \"Goal/$goal_id\"}}]")
    done
    
    for task_id in $tasks; do
        json=$(echo "$json" | jq ".extension += [{\"url\": \"https://health-fhir.fr/StructureDefinition/plandefini        json=$(echo "$json" | jq ".extension += [{\"url\": \"https://health-fhir.fr/Str d        
    echo "$json" > "$file"
}

cd _doc/fhir-exacd _doc/fhir-exacd _do "Mise à jour des fichiers JSON..cd _doc/fhir-exacd _doc/fhir-exacd -dicd _doc/fhir-exacd _doc/fhir-exacdIAcd _doc/fhir-exacd _doc/fhir-exacd _do "Misen-hcd _doc/fhir-exacd _doc/fhirSION_GOALS" "$HYPERTENSION_TASKS"
update_json_refs "plandefinition-asthma.json" "$ASTHMA_GOALS" "$ASTHMA_TASKS"
update_json_refs "plandefinition-copd.json" "$COPD_GOALS" "$COPD_TASKS"

echo "Renvoi des PlanDefinitions mis à jour..."

# Envoyer les mises à jour
for plan_id in 1491 1492 1489 1490; do
    plan_file=$(ls     plan_file=$(ls     plan_file=$(ls     plan_file=$(ls     plan_file=$(ls     plan_file=$(ls     plan_file=$(ls     plan_file=$(ls     plan_file=$(ls     plan_file=$(ls     plan_file=$(ls     _id" = "149   ];    plan_file=$(ls     plan_nd    plan_file=$(ls     plan_file=$(ls     plan_file=$(ls     plan_file=$(ls     plan_file=$(ls     plan_file=$(ls     plan_file=$(ls     plan_file=$(ls     plan_file=$(ls     plan_file=$(ls     plan_file=$(ls  
                          PlanDefinition/$plan_id... "
    
    # Récupérer le plan original pour garder les champs existants
    original=$(curl -s "$FHIR_API_URL/PlanDefinition/$plan_id")
    
    # Lire les extensions du fichier mis à jour
    updated_file=$(cat "$plan_file")
    
    # Appliquer les extensions au plan original
    updated=$(echo "$original" | jq --argjson ext "$(echo "$updated_file" | jq '.extension')" '.extension = $ext')
    
    # Envoyer la mise à jour
    response=$(curl -s -X PUT \
        -H "Content-Type: application/fhir+json" \
        -H "Accept: application/fhir+json" \
        -d "$updated" \
        "$FHIR_API_URL/PlanDefinition/$plan_id")
    
    updated_id=$(echo "$response" | jq -r '.id' 2>/dev/null)
    if [ "$updated_id" = "$plan_id" ]; then
        echo "✓"
    else
        echo "⚠"
    fi
done

echo "Terminé!"
