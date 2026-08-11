---
title: llmpkg — Transports & Infrastructure
module: llmpkg-infrastructure
layers: [BusinessLogic]
status: current
last_updated: 2026-08-10
---

# llmpkg — Infrastructure: Transports, Store, Cache, Config

## Zasada modułu

Infrastruktura implementuje kontrakty zdefiniowane w `domain/contracts/`. Żaden kod z `domain/` ani `application/` nie importuje bezpośrednio klas infrastruktury. Wstrzyknięcie odbywa się w `cli/main.js`.

---

## HTTP Transport (`infrastructure/transport/http-transport.js`)

### `createHttpRepositoryIndex(repoConfig)`

Implementuje `RepositoryIndex`. Pobiera dane z HTTP repozytorium.

**Discovery protocol:**
1. `GET {repoUrl}/.well-known/llmpkg.json` → `{ protocol, index }`
2. `GET {index}` → `registry.json` z listą pakietów
3. Fallback: `GET {repoUrl}/registry.json`

**`registry.json` format:**
```json
{
  "packages": [
    { "name": "postgres-expert", "latestVersion": "1.4.0", "versions": ["1.3.0", "1.4.0"], "description": "..." }
  ]
}
```

### `createHttpManifestFetcher()`

Implementuje `ManifestFetcher`. URL: `{repoUrl}/packages/{name}/{version}/manifest.json`

Obsługuje JSON i prosty flat YAML (bez zagnieżdżeń) — mini-parser wbudowany, bez zewnętrznych deps.

### `createHttpArtifactDownloader()`

Implementuje `ArtifactDownloader`. Pobiera plik artefaktu i zwraca `Buffer`.

---

## Local Filesystem Transport (`infrastructure/transport/local-fs-transport.js`)

Implementuje te same kontrakty co HTTP transport, ale czyta z lokalnego katalogu.

**Struktura katalogu repozytorium lokalnego:**
```
basePath/
  registry.json
  packages/
    postgres-expert/
      1.4.0/
        manifest.json
      1.3.0/
        manifest.json
```

Używane: testy bez HTTP, lokalne repozytoria firmowe, offline.

---

## Package Store (`infrastructure/store/json-package-store.js`)

Implementuje `PackageStore`. Persystu rekordy instalacji w jednym pliku JSON.

**Domyślna lokalizacja:** `.llmpkg/installed.json`

**Format pliku:**
```json
{
  "packages": {
    "postgres-expert": {
      "name": "postgres-expert",
      "version": "1.4.0",
      "repository": "community",
      "installedAt": "2026-08-10T20:00:00.000Z",
      "files": ["/skills/query.md"]
    }
  }
}
```

Ten plik jest podstawą dla `uninstall` — CLI usuwa tylko pliki wymienione w rekordzie.

---

## Node.js FileSystem (`infrastructure/file-system/node-file-system.js`)

Implementuje `FileSystemWriter`. Opakowuje `node:fs/promises`.

Błędy systemu plików są tłumaczone na `LlmpkgError` z odpowiednimi kodami domenowymi.

---

## GitHub Transport (`infrastructure/transport/github-transport.js`)

Implementuje abstrakcje dla repozytoriów na platformie GitHub (wymusza pobieranie z głównej gałęzi `main`).

**Obsługiwany format:** `github:owner/repo` lub `https://github.com/owner/repo`

Mapuje zapytania na odpowiednie endpointy `raw.githubusercontent.com`:
- `github:owner/repo` -> `https://raw.githubusercontent.com/owner/repo/main/registry.json`

Pozwala to na serwowanie i pobieranie paczek llmpkg z darmowego publicznego repozytorium na własnym koncie GitHub bez skomplikowanego hostingu.

---

## Transport Factory (`infrastructure/transport/transport-factory.js`)

Zarządza wstrzykiwaniem odpowiedniego mechanizmu (HTTP, LocalFS lub GitHub) na podstawie przedrostka ścieżki wpisanego przez użytkownika URL/URI. 
W `main.js` wywoływana jest ta fabryka, a ona dynamicznie deleguje wywołania z use-case'ów m.in:
- `file:///d:/repo` -> `createLocalFsRepositoryIndex()`
- `github:my-agent/skills` -> `createGitHubManifestFetcher()`
- `https://api.my-repo.org` -> `createHttpArtifactDownloader()`

*Uwaga: `TransportFactory` zapewnia zachowanie spójnego interfejsu (DIP).*

---

## Local Cache (`infrastructure/cache/local-cache.js`)

Lokalny cache indeksów i manifestów. Przechowuje wartości JSON z TTL (domyślnie 1h).

**Cel:** Ograniczenie żądań HTTP, częściowe działanie offline.

**Format wpisu cache:**
```json
{ "value": <cached_value>, "expiresAt": <timestamp_ms> }
```

Cache jest opcjonalny w MVP — use case'y wywołują kontrakty bezpośrednio. Cache można wstrzyknąć jako dekorator nad `RepositoryIndex` w przyszłości.

---

## Config Reader (`infrastructure/config/yaml-config-reader.js`)

Implementuje `ConfigReader`. Czyta konfigurację z plików JSON.

**Pliki konfiguracji:**
| Plik | Zawartość |
|---|---|
| `~/.config/llmpkg/config.json` | Globalna konfiguracja użytkownika (repozytoria, defaultTarget) |
| `./llmpkg.json` | Konfiguracja projektu (zależności, places instalacji) |

**Format `config.json`:**
```json
{
  "repositories": [
    { "name": "community", "url": "https://packages.example.org", "priority": 10 }
  ],
  "defaultTarget": "./skills"
}
```

**Ważne:** Hierarchię pierwszeństwa konfiguracji (`CLI arg → projekt → użytkownik → default`) orkiestruje ApplicationLayer (`cli/main.js`), nie ConfigReader. ConfigReader tylko czyta — nie decyduje.
