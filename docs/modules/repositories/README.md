---
title: Repozytoria pakietów
module: repositories
layers: [ApplicationLogic, ApplicationLayer, AdapterLayer, UserInterface]
status: current
last_updated: 2026-08-11
related:
  - ../../infrastructure/transports.md
  - ../../application/use-cases.md
  - ../../cli/adapter-layer.md
---

# Repozytoria pakietów

Moduł odpowiada za konfigurowanie źródeł pakietów i jednolity dostęp do indeksów, manifestów oraz artefaktów. Obsługuje HTTP, GitHub, dowolne serwery Git i lokalny system plików.

## Dokumenty

| Dokument | Zakres | Status |
|---|---|---|
| [repository-access.md](./repository-access.md) | Interfejsy, konfiguracja, przepływ danych, uwierzytelnianie i ograniczenia | current |
