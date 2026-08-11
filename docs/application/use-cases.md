---
title: llmpkg — Use Cases
module: llmpkg-application
layers: [ApplicationLogic]
status: current
last_updated: 2026-08-11
related:
  - ../domain/domain-model.md
---

# llmpkg — Use Cases

## Zasada warstwy

**Pytanie kontrolne (skill layered-architecture):** Czy ten sam use case mógłby być wywołany z REST API zamiast CLI bez zmiany tego kodu? Tak → prawidłowo w ApplicationLogic.

Use case'y nie importują:
- `process.argv` ani żadnych danych z CLI
- Konkretnych klas HTTP ani `node:fs`
- Bibliotek UI ani formatterów output

Zamiast tego: każdy use case przyjmuje **Command DTO** + zbiór **wstrzykniętych kontraktów**.

---

## SearchUseCase (`search-use-case.js`)

**Command:** `{ query: string, repository?: string }`
**Result:** `{ packages: PackageEntry[], totalCount: number }`

**Zależności kontraktów:** `RepositoryIndex`

**Przepływ:**
1. Waliduje query (niepusta string)
2. Wywołuje `repositoryIndex.searchPackages(query)` → lista pakietów
3. Zwraca strukturyzowany wynik

---

## InfoUseCase (`info-use-case.js`)

**Command:** `{ packageName: string, version?: string }`
**Result:** `Package` (domain type)

**Zależności kontraktów:** `RepositoryIndex`, `ManifestFetcher`, `ConfigReader`

**Przepływ:**
1. Pobiera dostępne wersje przez `repositoryIndex.getPackageVersions()`
2. Resolves najlepszą wersję przez `resolveBestVersion()` (domain)
3. Pobiera raw manifest przez `manifestFetcher.fetchManifest()`
4. Parsuje manifest przez `parseManifest()` (domain)
5. Zwraca domain Package

---

## ResolveUseCase (`resolve-use-case.js`)

**Command:** `{ packageName: string, versionConstraint?: string, repository?: string }`
**Result:** `{ package: Package, dependencies: Package[], repository: string, resolvedVersion: string }`

**Zależności kontraktów:** `RepositoryIndex`, `ManifestFetcher`

**Przepływ:**
1. Resolves wersję (przez domain: `resolveBestVersion()`)
2. Pobiera manifest głównego pakietu
3. Rekurencyjnie resolves bezpośrednie zależności (MVP: płytkie, 1 poziom)
4. Wykrywa cykle przez `detectCycles()` (domain)
5. Zwraca ZResolvedPlan

**Gdzie żyje `co wybrać` vs `jak zdobyć`:**
- Logika porównania wersji, reguły konfliktu → `domain/`
- Pobieranie manifestu → kontrakt `ManifestFetcher` (implementacja w infra)

---

## InstallUseCase (`install-use-case.js`)

**Command:** `{ packageName: string, version?: string, targetDir: string, dryRun?: boolean, repository?: string }`
**Result:** `{ installed: string[], lockfileEntry: object, dryRun: boolean }`

**Zależności kontraktów:** `RepositoryIndex`, `ManifestFetcher`, `ArtifactDownloader`, `PackageStore`, `FileSystemWriter`, `ConfigReader`

**Pełny pipeline:**
```
1. ResolveUseCase → ResolvedPlan
2. createInstallPlan() → walidacja PATH_TRAVERSAL (domain rule)
3. fileSystem.fileExists() → sprawdzenie FILE_CONFLICT dla każdego artefaktu
4. artifactDownloader.downloadArtifact() → Buffer pliku
5. assertIntegrity() jeśli artifact.integrity jest podane (domain rule)
6. fileSystem.writeFile() → zapis pliku
7. packageStore.saveInstallRecord() → persystencja lockfile
```

**Dry-run bez `if (dryRun)`:**
W trybie dry-run CLI wstrzykuje `createNoOpFileSystem()` zamiast `createNodeFileSystem()`.
Use case nie zmienia swojej logiki — DIP w praktyce.

---

## UninstallUseCase (`uninstall-use-case.js`)

**Command:** `{ packageName: string }`
**Result:** `{ removed: string[] }`

**Zależności kontraktów:** `PackageStore`, `FileSystemWriter`

**Przepływ:**
1. `packageStore.getInstallRecord(name)` → record z listą `files`
2. Dla każdego pliku: `fileSystem.fileExists()` → `fileSystem.deleteFile()`
3. `packageStore.removeInstallRecord(name)` → czyszczenie stanu

**Reguła:** uninstall usuwa TYLKO pliki zapisane w lockfile — nie czyta manifestu z internetu.

---

## RepoAddUseCase (`repo-add-use-case.js`)

**Command:** `{ name, url, global?, username?, password? }`

Tworzy lub aktualizuje wpis repozytorium przez `ConfigReader`. Najpierw wydobywa username/password z URL i oczyszcza URL; jawne pola Command DTO mają pierwszeństwo. Przy tym samym endpointcie pominięte poświadczenia są zachowywane; zmiana protokołu, hosta lub portu usuwa stare poświadczenia, chyba że nowe pochodzą z flag lub URL. Wynik odzwierciedla finalny stan przez `authenticated: boolean`; hasło nie wraca do prezentacji. Dla lokalnego zapisu z poświadczeniami wynik zawiera bezpieczne angielskie `warnings[]`, które kanał dostawy prezentuje odpowiednio do formatu.

---

## Wstrzyknięcie zależności

Schemat przepływu przez warstwy:

```
CLI main.js (ApplicationLayer)
  └─ createHttpRepositoryIndex(repoConfig)    ← Infrastructure
  └─ createHttpManifestFetcher()              ← Infrastructure
  └─ createNodeFileSystem()                   ← Infrastructure
  └─ wywołuje UseCase.execute(command, deps)  ← ApplicationLogic
       └─ parseManifest(raw)                  ← BusinessLogic
       └─ assertIntegrity(data, hash)         ← BusinessLogic
       └─ createInstallPlan().validate()      ← BusinessLogic
```

Zależności wskazują **do wewnątrz**. Infrastruktura nigdy nie jest importowana bezpośrednio w use case'ach.
