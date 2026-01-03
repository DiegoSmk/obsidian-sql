#!/bin/bash

# Configuration
PLUGIN_NAME="SQL Notebook"

# Colors for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}   ${PLUGIN_NAME} - Project Validation Script   ${NC}"
echo -e "${BLUE}==================================================${NC}"

# Step 1: Linting
echo -e "\n${YELLOW}[1/4] Running Code Analysis (Lint)...${NC}"
if npm run lint; then
    echo -e "${GREEN}✔ Linting passed! No style or basic logic issues found.${NC}"
else
    echo -e "${RED}✘ Linting failed. Fix the issues before proceeding.${NC}"
    exit 1
fi

# Step 2: Unit Testing
echo -e "\n${YELLOW}[2/4] Running Unit Tests (Vitest)...${NC}"
if npm run test; then
    echo -e "${GREEN}✔ All tests passed! Core logic is solid.${NC}"
else
    echo -e "${RED}✘ Tests failed. Check the detailed output above.${NC}"
    exit 1
fi

# Step 3: Integration Testing
echo -e "\n${YELLOW}[3/4] Running Integration Tests (AlaSQL Persistence)...${NC}"
if node tests/integration/schema_persistence.js; then
    echo -e "${GREEN}✔ Schema persistence verification passed!${NC}"
else
    echo -e "${RED}✘ Integration tests failed. Critical database logic is broken.${NC}"
    exit 1
fi

# Step 4: Production Build
echo -e "\n${YELLOW}[4/4] Generating Production Build (esbuild)...${NC}"
if npm run build; then
    echo -e "${GREEN}✔ Build successful! main.js and manifest.json are ready.${NC}"
else
    echo -e "${RED}✘ Build failed. Check types or esbuild configuration.${NC}"
    exit 1
fi

# Step 5: Optional Deployment
if [[ "$1" == "--deploy" || "$1" == "-d" || "$1" == "--d" ]]; then
    echo -e "\n${YELLOW}[5/5] Deploying to Obsidian Vault...${NC}"
    TARGET_DIR="/home/diego/Documentos/ObsidianSync/03.Diego/.obsidian/plugins/sql-notebook"
    
    if [ -d "$TARGET_DIR" ]; then
        cp main.js manifest.json styles.css "$TARGET_DIR/"
        echo -e "${GREEN}✔ Successfully deployed to: $TARGET_DIR${NC}"
    else
        echo -e "${RED}✘ Target directory does not exist: $TARGET_DIR${NC}"
        # Do not exit with error, just warn
    fi
fi

echo -e "\n${GREEN}==================================================${NC}"
echo -e "${GREEN}   VALIDATION COMPLETE - Project is healthy! 🚀   ${NC}"
echo -e "${GREEN}==================================================${NC}"
