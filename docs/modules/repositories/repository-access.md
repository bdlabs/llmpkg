---
title: Dostęp do repozytoriów
module: repositories
layers: [ApplicationLogic, ApplicationLayer, AdapterLayer, UserInterface]
status: current
last_updated: 2026-08-11
related:
  - ../../infrastructure/transports.md
  - ../../application/use-cases.md
  - ../../cli/adapter-layer.md
---

# Dostęp do repozytoriów

## Cel i odpowiedzialności

Moduł zapisuje nazwane konfiguracje repozytoriów, wybiera adapter transportu i udostępnia aplikacji kontrakty `RepositoryIndex`, `ManifestFetcher` oraz `ArtifactDownloader`. CLI jest kanałem konfiguracji i prezentacji; reguły aktualizacji wpisu realizuje `RepoAddUseCase`, a operacje sieciowe adaptery infrastruktury.

## Publiczne wejścia i konfiguracja

`llmpkg repo add <name> <url> [--username <login>] [--password <password>] [--global]` zapisuje `{ name, url, priority, username?, password? }` w `.llmpkg/llmpkg.json` lub globalnym `~/.config/llmpkg/config.json`. Zmiana protokołu, hosta lub portu usuwa stare poświadczenia; przy tym samym endpointcie pominięte wartości są zachowywane.

`repo list` i wynik `repo add` nie pokazują sekretów. Hasło jest przechowywane jawnie w chronionym pliku konfiguracyjnym, dlatego w automatyzacji preferowane są klucze SSH.

## Przepływ danych

1. InputAdapter tłumaczy argv na Command DTO.
2. `RepoAddUseCase` aktualizuje konfigurację przez `ConfigReader`.
3. `cli/main.js` wybiera pełną konfigurację wskazanego repozytorium.
4. Fabryka wybiera local-fs, HTTP, GitHub albo generic Git.
5. Use case pobiera indeks, manifest i artefakty przez kontrakty domenowe.

## Generic Git i bezpieczeństwo

Transport rozpoznaje `ssh://`, `git://`, SCP-like oraz `.git`. Userinfo jest usuwane z URL przed utworzeniem argumentów `git clone`; niepoprawne kodowanie jest odrzucane. Login i hasło trafiają do środowiska askpass, a login SSH do kontrolowanego `GIT_SSH_COMMAND`. Checkout jest płytki i tymczasowy, a `realpath` blokuje symlinki wychodzące poza jego katalog.

Build CLI zawiera `index.js`, `package.json` i `git-askpass.js`. Wymaga klienta `git` w `PATH`; SSH wymaga osiągalnego hosta i poprawnej obsługi host key.

## Błędy

Błędy poświadczeń są mapowane na `AUTHENTICATION_REQUIRED`, niedostępność lub błędne metadane na `REPOSITORY_UNAVAILABLE`, a wyjście poza checkout na `PATH_TRAVERSAL`. Surowe stderr Git, ścieżki i sekrety nie trafiają do UI.
