---
title: llmpkg Domain Model
module: llmpkg-domain
layers: [BusinessLogic]
status: current
last_updated: 2026-08-11
related:
  - ../llmpkg-application/README.md
  - ../../cli-agent/wytyczne.md
---

# llmpkg — Model Domenowy

Moduł definiuje rdzeń protokołu llmpkg: typy danych, reguły walidacji i algorytmy, które obowiązują niezależnie od interfejsu, transportu i infrastruktury.

## Dokumenty w tym module

| Plik | Temat | Warstwy | Status |
|---|---|---|---|
| [domain-model.md](./domain-model.md) | Encje domenowe, reguły walidacji, kontrakty (interfejsy) | BusinessLogic | current |

## Powiązania

- Reguły granic warstw: skill `layered-architecture`.
- Use case'y wywołujące ten moduł: [llmpkg-application](../llmpkg-application/README.md).
- Specyfikacja protokołu: `cli-agent/opis.md`.
- Wytyczne architektoniczne: `cli-agent/wytyczne.md`.
