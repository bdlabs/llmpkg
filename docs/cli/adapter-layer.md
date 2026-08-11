---
title: llmpkg — CLI Adapter Layer
module: llmpkg-cli
layers: [ApplicationLayer, AdapterLayer, UserInterface]
status: current
last_updated: 2026-08-11
---

# llmpkg — CLI Adapter Layer

## Podział odpowiedzialności

```
UserInterface  → drukuje na stdout/stderr (to co dostaje od OutputAdaptera)
AdapterLayer   → parsuje argv (InputAdapter), formatuje wynik (OutputAdapter)
ApplicationLayer → routing komend, wiring DI, wywołanie use case
```

Antywzorce których unikamy:
- **DecidingAdapter** — adapter nie weryfikuje czy pakiet istnieje (to domena)
- **LayerFusion** — main.js nie wykonuje kroków scenariusza (to ApplicationLogic)
- **FusedAdapter** — InputAdapter i OutputAdapter to osobne pliki
- **TechnicalLeakage** — `formatError()` ukrywa stack trace i surowe błędy infra

---

## InputAdapter: `cli/adapters/input/parse-args.js`

### Cel

Tłumaczy `process.argv.slice(2)` na Command DTO. Wyłącznie translacja formatu.

### Obsługiwane komendy

| Argv | Command DTO |
|---|---|
| `search <query>` | `{ command: 'search', query }` |
| `info <pkg>[@ver]` | `{ command: 'info', packageName, version? }` |
| `install [<pkg>[@ver]] [--target <dir>] [--dry-run]` | `{ command: 'install', packageName?, version?, targetDir, dryRun }` |
| `uninstall <pkg>` | `{ command: 'uninstall', packageName }` |
| `list` | `{ command: 'list' }` |
| `repo add <name> <url> [--username <login>] [--password <password>]` | `{ command: 'repo', subcommand: 'add', name, url, username?, password? }` |
| `repo list` | `{ command: 'repo', subcommand: 'list' }` |
| (brak lub help) | `{ command: 'help' }` |

Flaga `--json` ustawia `json: true` w każdym DTO — dalej używana wyłącznie przez OutputAdapter.

### Czego NIE robi (antipattern guard)

- NIE sprawdza czy pakiet istnieje w repozytorium
- NIE waliduje formatu wersji (to domena)
- NIE formatuje żadnego wyjścia

---

## OutputAdapter: Text (`cli/adapters/output/text-formatter.js` oraz `theme.js`)

Formatuje wyniki use case'ów jako czytelny tekst dla człowieka z wykorzystaniem `theme.js`, który abstrahuje definicję kolorów ANSI pod semantycznymi nazwami ról (np. `primary`, `success`, `error`, `label`, `value`).

| Funkcja | Wejście | Wyjście |
|---|---|---|
| `formatSearchResult(result)` | `{ packages[], totalCount }` | Tabela NAME/VERSION/REPOSITORY |
| `formatPackageInfo(pkg)` | `Package` | Opis pakietu z listą artefaktów |
| `formatInstallResult(result)` | `{ installed[], dryRun }` | Lista zainstalowanych plików |
| `formatUninstallResult(result)` | `{ removed[] }` | Lista usuniętych plików |
| `formatError(error)` | `Error` | `Error [CODE]: message` (bez stack trace) |

### TechnicalLeakage prevention

`formatError()` ukrywa stack trace i surowe błędy infrastruktury. Użytkownik widzi tylko `code` i `message` — oba bezpieczne do wyświetlenia.

Formatery repozytoriów budują bezpieczne DTO: pomijają `username` i `password`, publikują co najwyżej `authenticated`, a poświadczenia osadzone w URL redagują.

---

## OutputAdapter: JSON (`cli/adapters/output/json-formatter.js`)

Identyczny zestaw funkcji, ale zwraca `JSON.stringify(result)`.

**Kluczowe:** Use case'y nie wiedzą czy output będzie JSON czy tekst. Wybór formattera należy do `main.js` (ApplicationLayer).

---

## ApplicationLayer: `cli/main.js`

### Odpowiedzialności (wyłącznie)

1. `parseCliArgs(argv)` → Command DTO
2. `createYamlConfigReader()` → odczyt globalnej i projektowej konfiguracji
3. `buildDeps({ config, dryRun })` → wiring wszystkich implementacji infrastruktury
4. Routing: `switch(parsed.command)` → wywołanie odpowiedniego use case
5. Przekazanie wyniku do odpowiedniego formattera
6. `process.stdout.write()` lub `process.stderr.write()`

### Co jest WYKLUCZONE z main.js

- Warunki biznesowe (`if version.major > 2`)
- Kroki scenariusza (`pobierz manifest, zweryfikuj, zapisz`) → LayerFusion
- Logika formatowania output → AdapterLayer

### Wiring (DI)

```js
function buildDeps({ config, dryRun }) {
  return {
    repositoryIndex: createHttpRepositoryIndex(config.repositories[0]),
    manifestFetcher: createHttpManifestFetcher(),
    artifactDownloader: createHttpArtifactDownloader(),
    packageStore: createJsonPackageStore('.llmpkg/installed.json'),
    fileSystem: dryRun ? createNoOpFileSystem() : createNodeFileSystem(),
    configReader: createYamlConfigReader(),
  };
}
```

`createNoOpFileSystem()` dla dry-run — use case nie zmienia kodu, zmienia się wstrzyknięta implementacja.

---

## Konfiguracja hierarchii pierwszeństwa

```
CLI arg (--target, --repo)
  ↓
konfiguracja projektu (./llmpkg.json)
  ↓
konfiguracja użytkownika (~/.config/llmpkg/config.json)
  ↓
domyślna wartość
```

Scalanie konfiguracji odbywa się w `runCli()` — jedyne miejsce świadome pełnej hierarchii.
