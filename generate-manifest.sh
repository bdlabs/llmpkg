#!/bin/bash

# Check arguments
INPUT_DIR=$1
OUTPUT_FILE=$2

if [ -z "$INPUT_DIR" ] || [ -z "$OUTPUT_FILE" ]; then
    echo "Error: Missing required parameters."
    echo "Usage: $0 <input_directory> <output_manifest_json>"
    exit 1
fi

if [ ! -d "$INPUT_DIR" ]; then
    echo "Error: Directory $INPUT_DIR does not exist."
    exit 1
fi

# Prompt for user input
read -p "Enter package name: " PKG_NAME
read -p "Enter version [e.g. 1.0.0]: " PKG_VERSION
read -p "Enter package description: " PKG_DESC

# Build artifacts list as a JSON string
ARTIFACTS_JSON="["

FIRST=1
# Search the input directory excluding hidden files and folders
while IFS= read -r FILE_PATH; do
    # Generate a safe ID
    # Replaces special characters and slashes with hyphens, removes double hyphens
    FILE_ID=$(echo "$FILE_PATH" | tr -c 'a-zA-Z0-9' '-' | sed 's/-\{2,\}/-/g' | sed 's/^-//; s/-$//')
    
    if [ "$FIRST" -eq 1 ]; then
        FIRST=0
    else
        ARTIFACTS_JSON+=","
    fi

    ARTIFACTS_JSON+="
        {
            \"type\": \"unknown\",
            \"id\": \"${FILE_ID}\",
            \"path\": \"${FILE_PATH}\"
        }"
done < <(cd "$INPUT_DIR" && find . -type f -not -path '*/\.*' | sed 's|^\./||')

ARTIFACTS_JSON+="
    ]"

# Save to the output file
cat > "$OUTPUT_FILE" <<EOF
{
    "schema": "llmpkg/v1",
    "name": "${PKG_NAME}",
    "version": "${PKG_VERSION}",
    "description": "${PKG_DESC}",
    "artifacts": ${ARTIFACTS_JSON},
    "dependencies": {}
}
EOF

echo -e "\n✅ Done! The manifest file has been generated at: $OUTPUT_FILE"
