#!/bin/bash

# Mise à jour des PlanDefinitions avec les vrais IDs des Goals et Tasks
FHIR_API_URL="http://localhost:8081/fhir"

# Tableau d'association entre le fichier et les IDs des Goals et Tasks pour diabète
declare -A diabetes_goals=(
    ["1"]="1464"  # blood-sugar
    ["2"]="1466"  # nutrition
    ["3"]="1465"  # exercise
)

declare -A diabetes_tasks=(
    ["1"]="1480"  # blood-glucose
    ["2"]="1483"  # medication
    ["3"]="1481"  # diet
    ["4"]="1482"  # exercise
    ["5"]="0"     # education - non créé
)

declare -A hypertension_goals=(
    ["4"]="1467"  # bp-control
    ["5"]="1469"  # weight
    ["6"]="1468"  # sodium
)

declare -A hypertension_tasks=(
    ["6"]="1484"   # bp-monitoring
    ["7"]="1486"   # medication
    ["8"]="1485"   # low-salt-diet
    ["9"]="1488"   # weight-loss
    ["10"]="1487"  # stress-management
)

declare -A asthma_goals=(
    ["7"]="1458"   # control
    [    [    [    [    [    [    [    [    [    [    [    [    [    [    [    [    [    [    [    [    [    11"]="1471"  # preventive-inhaler
    ["12"]="1470"  # controller-medication
    ["13"]=    ["13"]=    ["13"]=    ["13"="1473"  # trigger-identification
)

declare -A copd_goals=(
    ["10"]="1463"  # oxygen-saturation
    ["11"]="1462"  # exercise-tolerance
    ["12"]="1461"    ["12"]="1461"    ["12"]=)
    ["12"]="1461"    ["12    ["1    ["12"]="1461"    ["12apy    ["12"]="1461"    ["12    ["1at    ["12"]="1461"    [# pulmona    ["12"]="1461"    ["77"  # smoke-avoidance
    ["19"]="1479"  # vaccination
    ["20"]="1478"  #     ["20"]="1478"  #     ["20" e    ["20"]="1478"  #     ["20_d    ["20"]="1478"  #           ["20"]="1478"  #     cal t    ["20"]="1478"  #     ["20_ref in 1464 1466 1465; do
        goals_str+="
    {
      \"url\": \"https://health-fhir.fr/StructureDefinition/plandefinition-goal-reference\",
      \"valueReference\": {
        \"reference\": \"Goal/$goal_ref\"
      }
    },"
    done
    
    for task_ref in 1480 1483 1481 1482; do
        tasks_str+="
    {
      \"url\": \"https://health-fhir.fr/StructureDefinition/plandefinition-action-reference\",
      \"valueReference\": {
        \"reference\": \"Task/$task_ref\"
      }
    },"
    done
    
    # Combiner et retirer la dernière virgule
    local result="${goals_str}${tasks_str}"
    echo "${result%,}"
}

build_hypertension_extensions() {
    local goals_str=""
    local tasks_str=""
    
    for goal_ref in 1467 1469 1468; do
        goals_str+="
    {
      \"url\": \"https://health-fhir.fr/StructureDefinition/plandefinition-goal-reference\",
      \"valueReference\": {
        \"reference\": \"Goal/$goal_ref\"
      }
    },"
    done
    
    for task_ref in 1484 1486 1485 1488 1487; do
        tasks_str+="
    {
      \"url\": \"https://health-fhir.fr/StructureDefinition/plandefinition-action-reference\",
      \"valueReference\": {
        \"reference\": \"Task/$task_ref\"
      }
    },"
    done
    
    local result="${goals_    local result="${goals_    local resul}


   local resuxtensio   l {   local resuxtensio   l {   local resuxtensio   l {   local resuxtensio   l {   local rdo
                                 \"url\": \"https://health-fhir.fr/Structu      nition/pla   finition-go                                 \"url\": \"h                                   \"url\":                           
                               472                     ks_                     ur \":                                472   in                   n-action                               472                     ks_                     ur \":      
                           oc                           oc            e      {result%,}"
}

build_copd_extensions() {
    local goals_str=""
    local tasks_str=""
    
    for goal_ref in 1463 1462 1461; do
        goals_str+="
    {
      \"url\": \"https://health-fhir.fr/StructureDefinition/plandefinition-goal-reference\",
      \"valueReference\": {
        \"reference\": \"Goal/$goal_ref\"
      }
    },"
    done
    
    for task_ref in 1475 1474 1476 1477 1479 1478; do
        tasks_str+="
    {
      \"url\": \"https://health-fhir.fr/StructureDefinition/plandefinition-action-reference\",
      \"valueReference\": {
        \"reference\": \"Task/$task_ref\"
      }
    },"
    done
    
    local result="${goals_str}${tasks_str}"
    echo "${result%,}"
}

# Fonction pour mettre à jour un PlanDefinition
update_plan() {
    local plan_id=$1
    local plan_type=$2
    
    case $plan_type in
        "diabetes")
            extensions=$(build_diabetes_extensions)
            ;;
        "hypertension")
            extensions=$(build_hypertension_extensions)
            ;;
        "asthma")
            extensions=$(build_asthma_extensions)
            ;;
        "copd")
            extensions=$(build_copd_exte            extensi ;;
                                                                                               ion/$plan_id")
    
    # Mettre à jour les extensions
    updated_plan=$(echo "$plan" | jq --arg ext "$extensions" '.extension |= [] | .extension = ['"$extensions"']')
    
    # Envoyer la mise à jour
    curl -s -X PUT \
        -H "Content-Type: application/fhir+json" \
        -H "Accept: application/fhir+json" \
        -d "$updated_plan" \
        "$FHIR_API_URL/PlanDefinition/$plan_id"
}

echo "Mise à jour des PlanDefinitions avec leecho "Mise à jour des PlanDefinitions avec lee (echo "Mise à 2 (hypertension), 1489 (asthma), 1490 (copd)
# Pour l'instant, on laisse les extensions comme elles sont (avec les références générales)

