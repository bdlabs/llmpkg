# Post-mortem: Niedziałająca komenda `llmpkg repo add`

## Powód problemu
Brak faktycznej implementacji funkcjonalności. W bloku odpowiedzialnym za komendę przypisany był jednie *hardcoded* komunikat błędu (oznaczony w kodzie jako `future: RepoAddUseCase`), informujący o konieczności ręcznej edycji plików, pomijając całkowitą integrację polecenia.

## Brakujące elementy, które zablokowały działanie:
1. **Domain Layer**: Kontrakt `ConfigReader` nie posiadał w ogóle zdefiniowanych metod na zapis konfiguracji (`writeGlobalConfig`, `writeProjectConfig`).
2. **Infrastructure Layer**: Brak implementacji utrwalania pliku `llmpkg.json` oraz `~/.config/llmpkg/config.json` w `yaml-config-reader.js`.
3. **Application Layer (Use Case)**: Brakowało dedykowanego przypadku użycia (`RepoAddUseCase`), podłączonego pod komendę `repo add`, który weryfikowałby istnienie repozytorium w tablicy (oraz odpowiadał za dopisywanie nowych, lub aktualizację istniejących adresów URL) przed utrwaleniem na dyskowym storage. 
4. **Adapter Layer**: Przesyłanie parametrów (jak `--global`) nie było parserowane, brakowało również formaterów komunikatów sukcesu po zakończeniu zapisu.
