---
title: llmpkg CLI Layer
module: llmpkg-cli
layers: [ApplicationLayer, AdapterLayer, UserInterface]
status: current
last_updated: 2026-08-10
related:
  - ../llmpkg-application/README.md
  - ../llmpkg-infrastructure/README.md
---

# llmpkg — CLI Layer

Warstwa CLI łączy trzy podwarstwy: ApplicationLayer (routing, DI), AdapterLayer (parsowanie argv, formatowanie output) i UserInterface (stdout/stderr).

## Dokumenty w tym module

| Plik | Temat | Warstwy | Status |
|---|---|---|---|
| [adapter-layer.md](./adapter-layer.md) | InputAdapter, OutputAdapter, ApplicationLayer wiring | ApplicationLayer, AdapterLayer, UserInterface | current |

## Powiązania

- Use case'y: [llmpkg-application](../llmpkg-application/use-cases.md)
- Implementacje kontraktów: [llmpkg-infrastructure](../llmpkg-infrastructure/transports.md)

## Budowanie i użycie

Projekt może być zbudowany do w pełni samodzielnego pakietu CLI w katalogu `dist/cli` za pomocą bundlera `esbuild`.

1. **Zbuduj pakiet CLI**:
   ```bash
   npm run build:cli
   ```
   Skrypt ten z-bundle'uje cały moduł do jednego pliku `dist/cli/index.js` wraz ze zdefiniowanym `package.json`.

2. **Działanie i linkowanie (lokalne środowisko)**:
   Możesz podlinkować lokalny zbudowany katalog globalnie za pomocą npm:
   ```bash
   cd dist/cli
   npm link
   ```
   Po wykonaniu linkowania będziesz miał dostęp do globalnego polecenia `llmpkg`.

3. **Przykłady z życia (Use Cases)**:
   Po zainstalowaniu CLI (`npm link`), możesz zarządzać artefaktami z dowolnego katalogu w systemie:

   **Dodawanie nowego repozytorium**
   Polecenie umożliwia dodanie repozytorium do lokalnego projektu (plik `llmpkg.json` w bieżącym katalogu roboczym) lub do globalnej konfiguracji.

   Aby dodać repozytorium do konfiguracji globalnej (zostanie zapisane w `~/.config/llmpkg/config.json`), musisz użyć flagi `--global`:
   ```bash
   llmpkg repo add community https://packages.example.org --global
   llmpkg repo add local file:///d:/programowanie-wlsane/codex/my-repo --global
   llmpkg repo add ai-tools github:user/repo_name --global
   ```

   Aby zapisać konfigurację lokalnie dla konkretnego projektu (np. by po wejściu w dany katalog odpytywać dodatkowe lokalne ścieżki wpisane w opartym w CWD `llmpkg.json`):
   ```bash
   llmpkg repo add local file:///d:/programowanie-wlsane/codex/my-repo
   ```

   *Obsługiwane formaty ścieżek do repozytorium:*
   - **HTTP/HTTPS**: `https://.../registry.json`
   - **Lokalny system plików**: `file:///...` lub `/sciezka` (dla testów i lokalnych baz)
   - **GitHub**: `github:wlasciciel/repozytorium` (pobiera z gałęzi `main` przez raw.githubusercontent.com)

   **Przeszukiwanie repozytorium**
   Wyszukiwanie dostępnych paczek z promptami lub narzędziami (np. dla słowa kluczowego `postgres`):
   ```bash
   llmpkg search postgres
   ```
   *Wynik pokaże tabelkę: NAME, VERSION, REPOSITORY.*

   **Formatowanie i notacja wersji**
   Struktura `llmpkg` obsługuje restrykcje wersji opierające się na klasycznym *Semantic Versioning* (SemVer), ale pozwala również na wygodne, krótsze formy, znane z ekosystemów takich jak Composer czy NPM (gdzie system samoistnie uzupełnienia brakujące elementy zerami).

   Możesz podać precyzyjne wersje lub zażądać elastycznego ich ustalania, używając operatorów po znaku `@` tuż obok nazwy pakietu:
   - **`@1.4.2`** – Wymaganie dokładnej wersji: szuka wyłącznie wyznaczonej rewizji.
   - **`@1.4`** lub **`@1`** – Krótka forma bazowa: braki podrzędne zostaną auto-uzupełnione na `1.4.0` albo `1.0.0`.
   - **`@^1.4`** – Zgodność z najnowszą pomniejszą iteracją (minor & patch): elastycznie podbija wydania bez wprowadzania nieoczekiwanych, wielkich zmian (do `< 2.0.0`). Wymóg `^1.4` staje się dla silnika automatycznie `^1.4.0`.
   - **`@~1.4`** – Ograniczenie w obrębie łatek bezpieczeństwa (patch): instalacja najnowszego rzędu aktualizacji z niezmienionymi _major_ i _minor_. Wymóg `~1.4` staje się automatycznie wymogiem `~1.4.0`.


   **Szczegóły pakietu**
   Aby dowiedzieć się, co dokładnie znajduje się w pakiecie (jakie artefakty i zależności zawiera):
   ```bash
   llmpkg info postgres-expert
   # Możesz też sprawdzić konkretną wersję:
   llmpkg info postgres-expert@1.3.0
   ```

   **Instalacja pakietu**
   Pobiera pakiet zgrupowuje artefakty z domyślnego repozytorium (lub wylistowanego w konfiguracji z najwyższym priorytetem) i instaluje w wybranym podkatalogu dla agenta:
   ```bash
   llmpkg install postgres-expert --target ./my-skills
   # Możesz również zainstalować określoną wersję pakietu:
   llmpkg install postgres-expert@1.3.0 --target ./my-skills
   # Lub testowo (dry run), by tylko sprawdzić jakie pliki zostaną wgrane i jakie zależności przyciągnięte:
   llmpkg install postgres-expert --target ./my-skills --dry-run
   ```

   **Listowanie i odinstalowywanie pakietów**
   Lista pakietów obecnie zainstalowanych:
   ```bash
   llmpkg list
   ```
   Odinstalowywanie usunie tylko pliki zainstalowane i zapisane w lokalnym lockfile'u (brak ryzyka przypadkowego usunięcia innych plików):
   ```bash
   llmpkg uninstall postgres-expert
   ```
