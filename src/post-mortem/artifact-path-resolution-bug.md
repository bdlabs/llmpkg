# Post-mortem: Błąd pobierania artefaktów (Artefakty szukane w głównym katalogu zamiast w pakiecie)

## Opis problemu
Po udanym rozwiązaniu kwestii docierania do pliku *manifestu*, wywołanie polecenia `llmpkg install` ulegało przerwaniu z błędem w fazie ściągania samych klocków pakietu:
`Error [REPOSITORY_UNAVAILABLE]: Artifact file not found: D:\...\demo\SKILL.md`
Z kolei warstwa HTTP ulegała awarii poszukując pliku w `packages/SKILL.md`.

## Powód wystąpienia błędu
Problem wywodził się z architektonicznej niekonsekwencji w kontraktach pobierania. Transporty lokalny i webowy (`local-fs-transport` oraz `http-transport`) próbowały na własną rękę komponować ostateczną ścieżkę do pobieranego piku. 
Oba te procesy jednak miały błąd merytoryczny i zakładały naiwnie, że ścieżka wpisana w manifescie (`artifact.path`, podaną przykładowo jako po prostu `"SKILL.md"`) ma na celu znalezienie pliku prosto w głównym korzeniu katalogu `packages`, zamiast poprawnego przeszukania folderu precyzującego konkretną paczkę z podaną wersją. Fabryka `ArtifactDownloader` otrzymywała w definicji argumentów jedynie parametry paczki jako obiekt `artifact`, a tym samym była pozbawiona kluczowego dostępu do metadanych takich jak `"NazwaPakietu"` czy `"Wersja"`.

## Środki naprawcze
1. **Refaktoryzacja warstwy Biznesowej (Domain/Manifest)**: Zamieniono podejście z weryfikacją rozdzieloną lokalnie. Funkcja `parseManifest` w module `src/cli-agent/domain/manifest.js` została zmodyfikowana, by w fazie parsowania JSON transformować zawartość klucza `path`. Moduł dokleja do nazwy pojedynczych plików ujednolicony dla infrastruktury przedrostek (`[nazwat_pakietu]/[wersja_pakietu]/[nazwa_pliku.md]`).
2. **Aktualizacja Infrastruktury (Transporty)**: Z obu modułów `http-transport.js` oraz `local-fs-transport.js` zostały wymazane resztki zgadywania nazw katalogu. Obecnie transporty ufają danym przetworzonym głębiej i tylko na koniec dodają rdzeń folderu `packages/`.
3. **Poprawka w kodowaniu URL dla HTTP**: Moduł transportu webowego (`http-transport.js`) stosował wadliwie funkcję wbudowaną `encodeURIComponent` dla pełnych ścieżek pakietów, wliczając ukośniki pozycjonujące, prowadząc to powstania złej wartości `URL%2Fkatalog%2F`. Rozbito ścieżki po ukośnikach przed enkodowaniem fragmentu URL w bezpieczny sposób.
