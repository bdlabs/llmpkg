---
title: llmpkg Infrastructure
module: llmpkg-infrastructure
layers: [AdapterLayer, ApplicationLayer]
status: current
last_updated: 2026-08-11
related:
  - ../domain/README.md
  - ../cli/README.md
---

# llmpkg — Infrastructure

Implementacje kontraktów domenowych. Moduł zna HTTP, Git, system plików i JSON. Domena ani logika aplikacji nie importują infrastruktury; konkretne adaptery są podłączane w CLI.

## Dokumenty w tym module

| Plik | Temat | Warstwy | Status |
|---|---|---|---|
| [transports.md](./transports.md) | HTTP, GitHub, generic Git i local-fs, PackageStore, Cache, Config | AdapterLayer, ApplicationLayer | current |

## Powiązania

- Interfejsy kontraktów: [Domain](../domain/domain-model.md)
- Wiring i DI: [CLI](../cli/adapter-layer.md)
