---
title: llmpkg Infrastructure
module: llmpkg-infrastructure
layers: [BusinessLogic]
status: current
last_updated: 2026-08-10
related:
  - ../llmpkg-domain/README.md
  - ../llmpkg-cli/README.md
---

# llmpkg — Infrastructure

Implementacje kontraktów domenowych. Zna HTTP, system plików, YAML. Domena NIE importuje z tego modułu.

## Dokumenty w tym module

| Plik | Temat | Warstwy | Status |
|---|---|---|---|
| [transports.md](./transports.md) | HTTP i local-fs transport, PackageStore, Cache, Config | BusinessLogic | current |

## Powiązania

- Interfejsy kontraktów: [llmpkg-domain](../llmpkg-domain/domain-model.md)
- Wiring i DI: [llmpkg-cli](../llmpkg-cli/adapter-layer.md)
