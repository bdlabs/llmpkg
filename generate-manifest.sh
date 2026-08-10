#!/bin/bash

# Sprawdzenie argumentów
INPUT_DIR=$1
OUTPUT_FILE=$2

if [ -z "$INPUT_DIR" ] || [ -z "$OUTPUT_FILE" ]; then
    echo "Błąd: Brak wymaganych parametrów."
    echo "Poprawne użycie: $0 <katalog_wezciowy> <plik_wyjsciowy_manifest.json>"
    exit 1
fi

if [ ! -d "$INPUT_DIR" ]; then
    echo "Błąd: Katalog $INPUT_DIR nie istnieje."
    exit 1
fi

# Zapytania do użytkownika
read -p "Podaj nazwę pakietu (name): " PKG_NAME
read -p "Podaj wersję (version) [np. 1.0.0]: " PKG_VERSION
read -p "Podaj opis pakietu (description): " PKG_DESC

# Budowanie listy artefaktów jako string JSON
ARTIFACTS_JSON="["

FIRST=1
# Przeszukiwanie katalogu wejściowego z wykluczeniem ukrytych plików/folderów
while IFS= read -r FILE_PATH; do
    # Wygenerowanie bezpiecznego ID
    # Zamienia wszystkie znaki specjalne i ukośniki na myślniki, usuwa podwójne myślniki
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

# Zapisywanie pliku wyjściowego
# Używamy cat do utworzenia pliku JSON w konkretnej lokalizacji na dysku
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

echo -e "\n✅ Gotowe! Plik manifestu został wygenerowany w lokalizacji: $OUTPUT_FILE"
