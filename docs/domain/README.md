---
title: llmpkg Domain Model
module: llmpkg-domain
layers: [BusinessLogic]
status: current
last_updated: 2026-08-11
related:
  - ../application/README.md
  - ../modules/repositories/README.md
---

# llmpkg — Model Domenowy

Moduł definiuje rdzeń protokołu llmpkg: typy danych, reguły walidacji i algorytmy, które obowiązują niezależnie od interfejsu, transportu i infrastruktury.

## Dokumenty w tym module

| Plik | Temat | Warstwy | Status |
|---|---|---|---|
| [domain-model.md](./domain-model.md) | Encje domenowe, reguły walidacji, kontrakty (interfejsy) | BusinessLogic | current |

## Powiązania

- Reguły granic warstw: skill `layered-architecture`.
- Use case'y wywołujące ten moduł: [Application](../application/README.md).
- Pełny przepływ kontraktów repozytoriów: [Repozytoria](../modules/repositories/README.md).
- Specyfikacja protokołu: `cli-agent/opis.md`.
- Wytyczne architektoniczne: `cli-agent/wytyczne.md`.
