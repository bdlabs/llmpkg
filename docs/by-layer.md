# Dokumentacja według warstw

Kolumna „Moduły” zawiera wyłącznie moduły biznesowe z [INDEX.md](./INDEX.md). Dokumenty warstwowe są referencjami pomocniczymi, a nie osobnymi modułami.

| Warstwa | Moduły | Referencje warstwowe |
|---|---|---|
| BusinessLogic | [Repozytoria](./modules/repositories/README.md) | [Kontrakty i model domeny](./domain/README.md) |
| ApplicationLogic | [Repozytoria](./modules/repositories/README.md) | [Use case'y](./application/README.md) |
| ApplicationLayer | [Repozytoria](./modules/repositories/README.md) | [CLI wiring](./cli/README.md) |
| AdapterLayer | [Repozytoria](./modules/repositories/README.md) | [Infrastructure](./infrastructure/README.md), [CLI adaptery](./cli/README.md) |
| UserInterface | [Repozytoria](./modules/repositories/README.md) | [CLI output](./cli/README.md) |
