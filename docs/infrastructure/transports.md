---
title: llmpkg — Transports & Infrastructure
module: llmpkg-infrastructure
layers: [AdapterLayer, ApplicationLayer]
status: current
last_updated: 2026-08-11
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

## Generic Git Transport (`infrastructure/transport/git-transport.js`)

Adapter korzysta z klienta `git` i obsługuje `ssh://`, `git://`, składnię `user@host:path` oraz adresy kończące się `.git`, w tym `ssh://git@ismartdev.pl:1922/home/git/repos/skills-hub.git`.

Każda operacja wykonuje płytki checkout do unikalnego katalogu tymczasowego, odczytuje `registry.json`, manifest lub artefakt, a następnie usuwa checkout. Przed odczytem sprawdzana jest zarówno ścieżka leksykalna, jak i wynik `realpath`, więc symlink nie może wyjść poza checkout.

Opcjonalne `username` i `password` są wydobywane z konfiguracji lub userinfo URL. Userinfo jest usuwane przed zbudowaniem argumentów `git clone`, a wartości trafiają do ograniczonego środowiska `GIT_ASKPASS`/`SSH_ASKPASS`. Loginy HTTP nie są ograniczone do alfanumerycznych i obsługują m.in. e-mail, plus i backslash. Dla SSH zmienna `GIT_SSH` wskazuje wrapper, który uruchamia helper Node; helper przekazuje login jako oddzielny argument procesu `ssh`, bez interpolacji w poleceniu powłoki. Błędy techniczne są mapowane na `AUTHENTICATION_REQUIRED` lub `REPOSITORY_UNAVAILABLE`.

Helpery `git-askpass.js` i `git-ssh.js` są kopiowane do `dist/cli` podczas `npm run build`, dlatego mechanizm działa zarówno ze źródeł, jak i z pakietu CLI.

Wymagania i ograniczenia:

- klient `git` musi być dostępny w `PATH`;
- host SSH musi być osiągalny i mieć zaakceptowany host key;
- hasło istnieje jawnie tylko w pamięci procesu po odszyfrowaniu; w automatyzacji nadal preferowane są klucze SSH;
- pobierana jest domyślna gałąź wskazana przez serwer;
- przy zmianie hosta istniejącego wpisu stare poświadczenia są usuwane, o ile użytkownik nie poda nowych.

---

## Transport Factory (`infrastructure/transport/transport-factory.js`)

Wybiera HTTP, LocalFS, GitHub albo generic Git. Alias `github:` i GitHub zachowują wyspecjalizowany transport, a standardowe URI Git wybierają klienta Git.
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

Implementuje pełny kontrakt `ConfigReader`: czyta i zapisuje konfigurację w plikach JSON.

**Pliki konfiguracji:**
| Plik | Zawartość |
|---|---|
| `~/.config/llmpkg/config.json` | Globalna konfiguracja użytkownika (repozytoria, defaultTarget) |
| `./.llmpkg/llmpkg.json` | Konfiguracja projektu (repozytoria i ustawienia instalacji) |

**Logiczny format po odczycie:**
```json
{
  "repositories": [
    { "name": "community", "url": "https://packages.example.org", "priority": 10, "username": "optional", "password": "decrypted-in-memory-only" }
  ],
  "defaultTarget": "./skills"
}
```

Przed zapisem wszystkie logiczne pola `password` są zastępowane przez prywatne dla adaptera pole ciphertextu w wersjonowanym formacie AES-256-GCM (losowy nonce i tag uwierzytelniający). Format v2 używa kanonicznego endpointu jako AAD, więc ciphertext przeniesiony pod inny host lub protokół nie zostanie odszyfrowany. Klucz powstaje w `~/.config/llmpkg/credentials.key`, zawsze poza konfiguracją projektu. Adapter odczytuje migracyjnie format v1, jawny `password` i userinfo starszego URL; przy konflikcie osobne pola mają pierwszeństwo, a następny zapis tworzy oczyszczony URL i v2. Do ApplicationLogic wracają wyłącznie logiczne pola `username`/`password`, nigdy ciphertext.

Adapter tworzy katalogi z trybem `0700` i pliki z `0600` oraz ponawia `chmod` dla już istniejących ścieżek. Na POSIX każdy błąd `chmod` przerywa operację. Na Windows ignorowany jest wyłącznie sygnał braku obsługi tej operacji; odmowa dostępu pozostaje błędem. Bity trybu Node nie zastępują Windows ACL, więc ochrona dodatkowo zależy od prywatnego profilu użytkownika. Utrata lub zmiana klucza uniemożliwia odszyfrowanie; ciphertext ze zmienionym tagiem jest odrzucany.

**Ważne:** Hierarchię pierwszeństwa konfiguracji (`CLI arg → projekt → użytkownik → default`) orkiestruje ApplicationLayer (`cli/main.js`), nie ConfigReader. ConfigReader wyłącznie odczytuje lub zapisuje wskazany zakres — nie decyduje o pierwszeństwie.
