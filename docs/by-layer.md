# Dokumentacja według warstw

Lista obejmuje ten sam zestaw modułów co [INDEX.md](./INDEX.md). Moduł Repozytoria jest dokumentem domenowym prowadzącym przez cały przepływ, a huba Domain należy używać jako kanonicznej trasy do reguł i kontraktów BusinessLogic.

| Warstwa | Moduły |
|---|---|
| BusinessLogic | [Domain](./domain/README.md) |
| ApplicationLogic | [Repozytoria](./modules/repositories/README.md), [Application](./application/README.md) |
| ApplicationLayer | [Repozytoria](./modules/repositories/README.md), [CLI](./cli/README.md) |
| AdapterLayer | [Repozytoria](./modules/repositories/README.md), [Infrastructure](./infrastructure/README.md), [CLI](./cli/README.md) |
| UserInterface | [Repozytoria](./modules/repositories/README.md), [CLI](./cli/README.md) |
