---
title: llmpkg Infrastructure
module: llmpkg-infrastructure
layers: [ApplicationLogic]
status: current
last_updated: 2026-08-11
related:
  - ../llmpkg-domain/README.md
  - ../llmpkg-cli/README.md
---

# llmpkg — Infrastructure

Implementacje kontraktów domenowych. Moduł zna HTTP, Git, system plików i JSON. Domena ani logika aplikacji nie importują infrastruktury; konkretne adaptery są podłączane w CLI.

## Dokumenty w tym module

| Plik | Temat | Warstwy | Status |
|---|---|---|---|
| [transports.md](./transports.md) | HTTP, GitHub, generic Git i local-fs, PackageStore, Cache, Config | ApplicationLogic | current |

## Powiązania

- Interfejsy kontraktów: [llmpkg-domain](../llmpkg-domain/domain-model.md)
- Wiring i DI: [llmpkg-cli](../llmpkg-cli/adapter-layer.md)
