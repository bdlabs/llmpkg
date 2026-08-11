---
title: llmpkg — Domain Model
module: llmpkg-domain
layers: [BusinessLogic]
status: current
last_updated: 2026-08-11
related:
  - ../by-layer.md
---

# llmpkg — Domain Model

`ConfigReader` przechowuje repozytoria jako `{ name, url, priority, username?, password? }`. Pola poświadczeń są opcjonalne, a sposób ich użycia pozostaje poza domeną i należy do implementacji transportu.

## Cel modułu

Definiuje czyste reguły domenowe protokołu llmpkg: encje, walidację, algorytmy. Nie ma żadnych importów z wyższych warstw (Application, CLI, Infrastructure). Jest testowalny bez sieci i systemu plików.

**Pytanie kontrolne (skill layered-architecture):** Czy ta reguła obowiązywałaby nawet bez CLI? TAK → należy do domeny.

---

## Encje i typy

### `Package`

```
name        — identyfikator (lowercase, hyphens), wymagany
version     — SemVer 1.2.3, wymagany
description — opcjonalny opis
artifacts   — lista Artifact[], wymagana
dependencies — Record<name, constraint>
repository  — skąd pochodzi (przypisany przez warstwę Application)
```

**Reguły:**
- `name` musi pasować do `/^[a-z0-9][a-z0-9-]*$/`
- `version` musi być poprawnym SemVer
- `artifacts` musi być tablicą

### `Artifact`

```
id    — unikalny identyfikator w pakiecie
type  — jeden z: skill, prompt, system-prompt, agent-instructions, rule, workflow, template, schema, knowledge, documentation
path  — relatywna ścieżka pliku w pakiecie
```

**Reguły bezpieczeństwa (domenowe, nie UI):**
- `path` nie może zaczynać się od `/`
- `path` nie może zawierać `../` ani zaczynać od `../`
- Naruszenie → `LlmpkgError(PATH_TRAVERSAL)`

### `Manifest`

Surowy manifest (YAML/JSON z repozytorium) jest parsowany i walidowany przez `parseManifest()`.

**Wymagane pola:**
- `schema: "llmpkg/v1"` (sprawdzane przez `SUPPORTED_SCHEMA`)
- `name`, `version`, `artifacts`

### `InstallPlan`

Plan instalacji — tworzony przed jakimkolwiek I/O.

```
targetDir — katalog instalacji (resolved absolutnie)
entries   — [{ artifactId, sourcePath, targetPath }]
```

**Metody:**
- `validate()` — sprawdza, czy żaden `targetPath` nie wychodzi poza `targetDir` (PATH_TRAVERSAL)
- `getInstallPaths()` → `Map<artifactId, absolutePath>`

---

## Algorytmy

### Wersjonowanie (`version.js`)

- `parseVersion(str)` → `{ major, minor, patch }` lub `LlmpkgError(INVALID_MANIFEST)`
- `compareVersions(a, b)` → `-1|0|1`
- `satisfiesConstraint(version, constraint)` — obsługa `^`, `~`, exact
- `resolveBestVersion(versions[], constraint)` → najnowsza pasująca lub null

### Integralność (`integrity.js`)

Reguła: hash musi się zgadzać, inaczej instalacja jest przerywana.

- `computeHash(data)` → `"sha256:<hex>"`
- `verifyIntegrity(data, expectedHash)` → bool
- `assertIntegrity(data, expectedHash, context)` → rzuca `INTEGRITY_ERROR`

**WAŻNE:** Funkcje przyjmują `Buffer|string`, nie ścieżkę pliku. Odczyt pliku to zadanie infrastruktury.

### Graf zależności (`dependency-graph.js`)

- `buildDependencyGraph(packages[])` → `Map<name, name[]>`
- `detectCycles(graph)` → bool (DFS z wykrywaniem back-edge)
- `resolveDependencyOrder(graph)` → topological sort lub `LlmpkgError(DEPENDENCY_CYCLE)`

**Reguła domenowa:** Zależności cykliczne są **niedozwolone**.

---

## Kontrakty (interfejsy)

Zdefiniowane w `domain/contracts/`. Implementowane w `infrastructure/`. Nigdy odwrotnie.

| Kontrakt | Plik | Opis |
|---|---|---|
| `RepositoryIndex` | `repository-index.js` | Wyszukiwanie pakietów w repozytorium |
| `ManifestFetcher` | `manifest-fetcher.js` | Pobieranie manifestu pakietu |
| `ArtifactDownloader` | `artifact-downloader.js` | Pobieranie pliku artefaktu |
| `PackageStore` | `package-store.js` | Persystencja stanu instalacji |
| `FileSystemWriter` | `file-system.js` | Operacje na plikach (enables dry-run) |
| `ConfigReader` | `config-reader.js` | Odczyt i zapis konfiguracji globalnej oraz projektowej |

*Uwaga: implementacje Null-object (`createNull*`) dla tych kontraktów używane w testach znajdują się w `infrastructure/tests/test-helpers.js`, poza warstwą domeny.*

**DIP (Dependency Inversion Principle):**
```
ApplicationLogic.InstallUseCase
  zależy na: FileSystemWriter (interfejs zdefiniowany w domain)
  NIE zależy na: NodeFileSystem (konkretna klasa z infrastructure)
```

---

## Kody błędów

Zdefiniowane w `errors.js` jako `ERROR_CODES`:

| Kod | Znaczenie |
|---|---|
| `PACKAGE_NOT_FOUND` | Pakiet nie istnieje w repozytorium |
| `VERSION_NOT_FOUND` | Brak wersji spełniającej constraint |
| `INVALID_MANIFEST` | Manifest jest niekompletny lub ma złą schematę |
| `INTEGRITY_ERROR` | Hash nie zgadza się z oczekiwanym |
| `DEPENDENCY_CONFLICT` | Konflikt wersji zależności |
| `DEPENDENCY_CYCLE` | Wykryto zależność cykliczną |
| `FILE_CONFLICT` | Plik docelowy już istnieje |
| `REPOSITORY_UNAVAILABLE` | Repozytorium niedostępne (błąd sieci/fs) |
| `AUTHENTICATION_REQUIRED` | Wymagane uwierzytelnienie |
| `UNSUPPORTED_PROTOCOL` | Nieznana komenda lub schemat |
| `INVALID_PACKAGE` | Nieprawidłowe dane pakietu |
| `INVALID_ARTIFACT` | Nieprawidłowy type/id/path artefaktu |
| `PATH_TRAVERSAL` | Ścieżka próbuje wyskoczyć poza target |

---

## Ograniczenia i decyzje projektowe

- Moduł celowo nie obsługuje YAML (parsowanie YAML to infrastruktura). `parseManifest()` przyjmuje już gotowy obiekt JS.
- Wersja MVP obsługuje tylko `schema: llmpkg/v1`. Nieznana schema = błąd (nie ignorowanie).
- Dry-run jest implementowany przez wstrzyknięcie `NoOpFileSystem` — domena nie musi wiedzieć o dry-run.
- Podpisy kryptograficzne są planowane w przyszłości — manifest jest zaprojektowany tak, żeby je przyjąć bez przebudowy.
