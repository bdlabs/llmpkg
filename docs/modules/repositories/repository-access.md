---
title: Dostęp do repozytoriów
module: repositories
layers: [BusinessLogic, ApplicationLogic, ApplicationLayer, AdapterLayer, UserInterface]
status: current
last_updated: 2026-08-11
related:
  - ../../infrastructure/transports.md
  - ../../application/use-cases.md
  - ../../cli/adapter-layer.md
---

# Dostęp do repozytoriów

## Cel i odpowiedzialności

Moduł definiuje w BusinessLogic kontrakty `ConfigReader`, `RepositoryIndex`, `ManifestFetcher` oraz `ArtifactDownloader`, zapisuje nazwane konfiguracje repozytoriów i wybiera adapter transportu. CLI jest kanałem konfiguracji i prezentacji; reguły aktualizacji wpisu realizuje `RepoAddUseCase`, a operacje sieciowe adaptery infrastruktury.

## Publiczne wejścia i konfiguracja

`llmpkg repo add <name> <url> [--username <login>] [--password <password>] [--global]` zapisuje nazwę, oczyszczony URL, priorytet oraz opcjonalny login i zaszyfrowane hasło w `.llmpkg/llmpkg.json` lub globalnym `~/.config/llmpkg/config.json`. Userinfo osadzone w URL jest wydobywane przed zapisem i zachowuje się jak dane z flag; jawne `--username` i `--password` mają pierwszeństwo. Obsługiwane schematy URI są rozpoznawane także bez dokładnego `://`, dlatego alternatywne formy HTTPS są bezpiecznie kanonikalizowane. Niepoprawny lub niejednoznaczny credential-shaped URL jest odrzucany przed zapisem bez odbijania userinfo w błędzie. Zmiana protokołu, hosta lub portu usuwa każdą starą reprezentację poświadczeń; przy tym samym endpointcie pominięte wartości są zachowywane.

Przykład dodania prywatnego repozytorium SSH z loginem i hasłem do konfiguracji globalnej:

```bash
llmpkg repo add private ssh://git@ismartdev.pl:1922/home/git/repos/skills-hub.git \
  --username git \
  --password "twoje-haslo" \
  --global
```

W PowerShell polecenie można podać w jednej linii:

```powershell
llmpkg repo add private "ssh://git@ismartdev.pl:1922/home/git/repos/skills-hub.git" --username "git" --password "twoje-haslo" --global
```

Bez `--global` wpis trafia do lokalnego pliku `.llmpkg/llmpkg.json` bieżącego projektu. Z flagą `--global` jest zapisywany w globalnym pliku `~/.config/llmpkg/config.json`.

`repo list` i wynik `repo add` nie pokazują sekretów. Redakcja `***` dotyczy wyłącznie prezentacji starszych lub przekazanych w pamięci URL-i; zapisany URL nigdy nie zawiera userinfo. Login pozostaje w konfiguracji, natomiast hasło jest zapisywane w wersjonowanym formacie AES-256-GCM. Klucz 256-bitowy znajduje się poza projektem w `~/.config/llmpkg/credentials.key`.

Zapis poświadczeń w konfiguracji projektu emituje nieinteraktywne angielskie ostrzeżenie. W trybie tekstowym trafia ono na stderr, a w `--json` do bezpiecznej tablicy `warnings`, dzięki czemu stdout pozostaje poprawnym JSON-em. Konfiguracja globalna nie emituje tego ostrzeżenia.

## Przepływ danych

1. InputAdapter tłumaczy argv na Command DTO.
2. `RepoAddUseCase` aktualizuje konfigurację przez `ConfigReader`.
3. `cli/main.js` wybiera pełną konfigurację wskazanego repozytorium.
4. Fabryka wybiera local-fs, HTTP, GitHub albo generic Git.
5. Use case pobiera indeks, manifest i artefakty przez kontrakty domenowe.

## Generic Git i bezpieczeństwo

Transport rozpoznaje `ssh://`, `git://`, SCP-like oraz `.git`. Userinfo jest usuwane z URL przed utworzeniem argumentów `git clone`; niepoprawne kodowanie jest odrzucane. Loginy HTTP mogą zawierać m.in. adres e-mail, `gitlab+deploy-token` i `DOMAIN\\user`. Login i hasło trafiają do środowiska askpass. Login SSH jest odczytywany przez pomocniczy proces Node i przekazywany do `ssh` jako osobny argument `-l`, nigdy przez `GIT_SSH_COMMAND` ani interpolowany tekst powłoki. Checkout jest płytki i tymczasowy, a `realpath` blokuje symlinki wychodzące poza jego katalog.

Build CLI zawiera `index.js`, `package.json`, `git-askpass.js` i `git-ssh.js`. Wymaga klienta `git` w `PATH`; SSH wymaga osiągalnego hosta i poprawnej obsługi host key.

## Persystencja, uprawnienia i ograniczenia

Adapter konfiguracji odszyfrowuje hasła wyłącznie w pamięci i nigdy nie przekazuje storage-only pola ciphertextu przez kontrakt `ConfigReader`. Starsze wpisy z jawnym polem `password` albo userinfo URL są nadal odczytywane, oczyszczane i zostają zaszyfrowane przy następnym zapisie; osobne pola legacy mają pierwszeństwo przed userinfo. AES-GCM uwierzytelnia ciphertext i wiąże format v2 z kanonicznym endpointem repozytorium. Uszkodzenie, transplantacja do innego endpointu albo użycie innego klucza powoduje odrzucenie odczytu zamiast zwrócenia zmienionego hasła. Wersja v1 jest odczytywana migracyjnie i zapisywana jako v2 przy kolejnym zapisie.

Na systemach POSIX katalogi konfiguracji otrzymują tryb `0700`, a pliki klucza i konfiguracji `0600`; błąd ustawienia trybu przerywa operację. Na Windows ignorowane są tylko kody oznaczające brak obsługi `chmod`, natomiast rzeczywiste błędy dostępu nadal przerywają zapis. Node.js nie udostępnia w tym mechanizmie pełnego zarządzania ACL: faktyczna izolacja zależy także od ACL profilu użytkownika. Plik projektu zaszyfrowany kluczem jednego użytkownika nie jest odszyfrowywalny przez innego użytkownika ani po utracie `credentials.key`; klucz nie powinien być umieszczany w projekcie ani systemie kontroli wersji.

## Błędy

Błędy poświadczeń są mapowane na `AUTHENTICATION_REQUIRED`, niedostępność lub błędne metadane na `REPOSITORY_UNAVAILABLE`, a wyjście poza checkout na `PATH_TRAVERSAL`. Surowe stderr Git, ścieżki i sekrety nie trafiają do UI.
