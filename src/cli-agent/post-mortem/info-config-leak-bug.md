# Post-mortem: Niedziałająca komenda `llmpkg info` (Błąd parsowania adresu URL sieciowego)

## Opis problemu
Przy wywoływaniu poleceń `llmpkg info <pakiet>` oraz `llmpkg install <pakiet>` z poziomu katalogu użytkownika posiadającego lokalny plik `llmpkg.json`, aplikacja zwracała krytyczny błąd środowiskowy NodeJS:
`Error [REPOSITORY_UNAVAILABLE]: Network error fetching /packages/.../manifest.json: Failed to parse URL`

## Powód wystąpienia błędu
Aplikacja wysypywała się z surowym wyjątkiem braku pełnego adresu maszyny (braku domeny http lub systemu plików file:///). Wynikało to z faktu, że skrypty wywołujące (tzw. przypadki użycia) kierowały zapytanie do fabryki transportu z użyciem pustego wskaźnika URL `""`.

Pusty URL pojawił się w zmiennej ze względu na złamanie fundamentalnych założeń czystej (warstwowej) architektury:
1. Skrypty aplikacyjne (`info-use-case.js` oraz `install-use-case.js`) wykonywały błąd znany jako **Layer Fusion** lub **I/O Leakage**.
2. Zamiast operować na prawidłowo wstrzykniętych zmiennych zbudowanych przez warstwę wyższą (`main.js`), przypadki użycia samodzielnie decydowały o załadowaniu wyłącznie pliku za pomocą przypisanej na sztywno funkcji: `await configReader.readGlobalConfig()`. 
3. Pobranie przez skrypty wyłącznie "globalnej konfiguracji", całkowicie wymazało lokalne konfiguracje (`llmpkg.json`) wpisane dla danego okna terminala w pamięci `main.js`. Poskutkowało to nadpisaniem docelowego adresu URL pustym stringiem, i awarią programu w głębszych rejonach narzędzia `ManifestFetcher`.

## Środki naprawcze
1. **Refaktoryzacja warstwy ApplicationLayer (`main.js`)**: Rozszerzono wstrzykiwany obiekt zależności (Dependency Injection z `buildDeps`) o atrybut ze skonsolidowaną konfiguracją `config`, wygenerowaną z poprawnie zmergowanych ról globalnych i projektowych.
2. **Oczyszczenie Logiki Aplikacji (Use Cases)**: Usunięto odwołania sprzęgające logikę poprzez `configReader.readGlobalConfig()` z wnętrz plików `info-use-case.js` oraz `install-use-case.js`. Mechanika pobierania metadanych bazuje teraz na ostatecznym adresie repozytorium wyselekcjonowanym bezpośrednio ze wstrzykniętego kontekstu (zmiennej środowiskowej powiązanej ze środowiskiem uruchomieniowym CWD).
