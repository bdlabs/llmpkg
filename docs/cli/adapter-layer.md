---
title: llmpkg — CLI Adapter Layer
module: repositories
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
| `repo add <name> <url> [--username <login>] [--password <password>] [--global]` | `{ command: 'repo', subcommand: 'add', name, url, username?, password?, global }` |
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

Formatery repozytoriów budują bezpieczne DTO: pomijają `username`, `password` i zaszyfrowany ciphertext, publikują co najwyżej `authenticated`, a userinfo w starszych URL-ach redagują wyłącznie na potrzeby prezentacji. Nieudany parser nie zwraca potencjalnego userinfo, lecz stały placeholder redakcji. Canonicalny URL zapisany przez `repo add` jest już oczyszczony.

Dla `repo add` bez `--global`, jeżeli finalny wpis zawiera poświadczenia, formatter tekstowy tworzy angielskie ostrzeżenie, które `main.js` zapisuje na stderr po wyniku sukcesu na stdout. Formatter JSON umieszcza te same bezpieczne komunikaty w `warnings[]` pojedynczego dokumentu JSON i nie dopisuje osobnego tekstu na stderr. Ostrzeżenia nie zawierają loginu, hasła ani ciphertextu.

---

## OutputAdapter: JSON (`cli/adapters/output/json-formatter.js`)

Identyczny zestaw funkcji, ale zwraca `JSON.stringify(result)`.

**Kluczowe:** Use case'y nie wiedzą czy output będzie JSON czy tekst. Wybór formattera należy do `main.js` (ApplicationLayer). Repozytoryjne `warnings[]` pozostaje bezpiecznym elementem wyniku: adapter JSON zachowuje tablicę, a adapter tekstowy formatuje ją do osobnego kanału stderr.

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
    repositoryIndex: createRepositoryIndex(selectedRepository),
    manifestFetcher: createManifestFetcher(config.repositories),
    artifactDownloader: createArtifactDownloader(config.repositories),
    packageStore: createJsonPackageStore('.llmpkg/installed.json'),
    fileSystem: dryRun ? createNoOpFileSystem() : createNodeFileSystem(),
    configReader: createYamlConfigReader(),
  };
}
```

`createNoOpFileSystem()` dla dry-run — use case nie zmienia kodu, zmienia się wstrzyknięta implementacja.

---

## Przekazanie konfiguracji

```
konfiguracja projektu (./.llmpkg/llmpkg.json)
  ↓
konfiguracja użytkownika (~/.config/llmpkg/config.json)
  ↓
domyślna wartość
```

Powyższą hierarchię konfiguracji zapisanej realizuje `resolveConfig()` w `application/config-resolver.js` (ApplicationLogic). Wartości flag CLI, np. `--target` i `--repo`, pozostają polami Command DTO przekazywanymi osobno. `runCli()` jedynie dostarcza `ConfigReader`, przekazuje DTO i wykonuje wiring wybranego repozytorium; nie jest właścicielem reguł hierarchii konfiguracji.
