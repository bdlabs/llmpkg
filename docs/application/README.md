---
title: llmpkg ApplicationLogic
module: llmpkg-application
layers: [ApplicationLogic]
status: current
last_updated: 2026-08-11
related:
  - ../domain/README.md
  - ../infrastructure/README.md
---

# llmpkg — ApplicationLogic (Use Cases)

Moduł orkiestruje przepływ danych między domeną a infrastrukturą. Use case'y nie wiedzą o HTTP, argv ani ścieżkach plików — wszystkie efekty uboczne przechodzą przez kontrakty.

## Dokumenty w tym module

| Plik | Temat | Warstwy | Status |
|---|---|---|---|
| [use-cases.md](./use-cases.md) | Opis wszystkich use case'ów, zależności i przepływ danych | ApplicationLogic | current |

## Powiązania

- Typy domenowe i kontrakty: [Domain](../domain/README.md)
- Implementacje kontraktów: [Infrastructure](../infrastructure/README.md)
- CLI routing: [CLI](../cli/README.md)
