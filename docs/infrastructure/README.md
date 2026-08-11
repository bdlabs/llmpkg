---
title: llmpkg Infrastructure
module: repositories
layers: [AdapterLayer, ApplicationLayer]
status: current
last_updated: 2026-08-11
related:
  - ../domain/README.md
  - ../cli/README.md
---

# llmpkg — referencja Infrastructure

Ten dokument jest przekrojową referencją modułu Repozytoria, a nie osobnym modułem biznesowym. Infrastructure implementuje kontrakty domenowe i zna HTTP, Git, system plików oraz JSON. Domena ani logika aplikacji nie importują infrastruktury; konkretne adaptery są podłączane w CLI.

## Dokumenty referencyjne

| Plik | Temat | Warstwy | Status |
|---|---|---|---|
| [transports.md](./transports.md) | HTTP, GitHub, generic Git i local-fs, PackageStore, Cache, Config | AdapterLayer, ApplicationLayer | current |

## Powiązania

- Interfejsy kontraktów: [Domain](../domain/domain-model.md)
- Wiring i DI: [CLI](../cli/adapter-layer.md)
