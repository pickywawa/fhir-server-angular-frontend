#!/bin/bash

# Script pour envoyer les données de maladies chroniques à l'API FHIR
# Ce script envoie tous les PlanDefinition, Goal et Task pour les exemples de suivi

FHIR_API_URL="http://localhost:8081/fhir"
EXAMPLES_DIR="_doc/fhir-examples/care-plans"

# Couleurs pour l'output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Injection des données de maladies chroniques ===${NC}"
echo "API URL: $FHIR_API_URL"
echo "Examples Directory: $EXAMPLES_DIR"
echo ""

# Fonction pour envoyer un fichier
send_resource() {
    local file=$1
    local resource_type=$(jq -r '.resourceType' "$file" 2>/dev/null)
    local resource_id=$(jq -r '.id' "$file" 2>/dev/null)
    
    if [ -z "$resource_type" ] || [ -z "$resource_id" ] || [ "$resource_type" = "null" ] || [ "$resource_id" = "null" ]; then
        echo -e "${RED}✗ Erreur de lecture du fichier: $file${NC}"
        return 1
    fi
    
    echo -n "Envoi $resource_type/$resource_id... "
    
    # Envoyer la ressource
    response=$(curl -s -X POST \
        -H "Content-Type: application/fhir+json" \
        -H "Accept: application/fhir+json" \
        -d @"$file" \
        "$FHIR_API_URL/$resource_type")
    
    # Vérifier si la réponse contient un ID
    created_id=$(echo "$response" | jq -r '.id' 2>/dev/null)
    
    if [ ! -z "$created_id" ] && [ "$created_id" != "null" ]; then
        echo -e "${GREEN}✓ Créé avec ID: $created_id${NC}"
        return 0
    else
        # Vérifier si c'est une réponse d'erreur
        error=$(echo "$response" | jq -r '.issue[0].details.text' 2>/dev/null)
        if [ ! -z "$error" ] && [ "$error" != "null" ]; then
            echo -e "${YELLOW}⚠ Erreur: $error${NC}"
        else
            echo -e "${YELLOW}⚠ Réponse: $(echo "$response" | jq '.' 2>/dev/null | head -1)${NC}"
        fi
        return 1
    fi
}

# Compter les ressources à envoyer
goal_files=($(find "$EXAMPLES_DIR" -name "goal-*.json" -type f | sort))
task_files=($(find "$EXAMPLES_DIR" -name "task-*.json" -type f | sort))
plan_files=($(find "$EXAMPLES_DIR" -name "plandefinition-*.json" -type f | sort))

total_files=$((${#goal_files[@]} + ${#task_files[@]} + ${#plan_files[@]}))
echo -e "${YELLOW}Total de fichiers à envoyer: $total_files${NC}"
echo -e "  - Goals: ${#goal_files[@]}"
echo -e "  - Tasks: ${#task_files[@]}"
echo -e "  - PlanDefinitions: ${#plan_files[@]}"
echo ""

# Envoyer d'abord les Goals
echo -e "${BLUE}--- Envoi des Goals (Objectifs) ---${NC}"
goal_success=0
for file in "${goal_files[@]}"; do
    if send_resource "$file"; then
        ((goal_success++))
    fi
done
echo ""

# Envoyer ensuite les Tasks
echo -e "${BLUE}--- Envoi des Tasks (Actions) ---${NC}"
task_success=0
for file in "${task_files[@]}"; do
    if send_resource "$file"; then
        ((task_success++))
    fi
done
echo ""

# Envoyer enfin les PlanDefinitions
echo -e "${BLUE}--- Envoi des PlanDefinitions ---${NC}"
plan_success=0
for file in "${plan_files[@]}"; do
    if send_resource "$file"; then
        ((plan_success++))
    fi
done
echo ""

# Résumé
total_success=$((goal_success + task_success + plan_success))
echo -e "${BLUE}=== Résumé ===${NC}"
echo -e "Goals créés: ${GREEN}$goal_success/${#goal_files[@]}${NC}"
echo -e "Tasks créées: ${GREEN}$task_success/${#task_files[@]}${NC}"
echo -e "PlanDefinitions créés: ${GREEN}$plan_success/${#plan_files[@]}${NC}"
echo -e "Total: ${GREEN}$total_success/$total_files${NC}"
echo ""

if [ $total_success -eq $total_files ]; then
    echo -e "${GREEN}✓ Tous les fichiers ont été envoyés avec succès!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ Certains fichiers n'ont pas pu être envoyés.${NC}"
    exit 1
fi
