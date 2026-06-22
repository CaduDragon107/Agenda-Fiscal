import { describe, it } from "vitest";

/**
 * tests/dashboards.rbac.test.ts
 *
 * Scaffold Wave 0 (04-01) — cobre o guard DONO-only para os 3 dashboards
 * (DASH-01/02/03). Casos virão a ser preenchidos red->green na Wave 1
 * (plan 04-04). it.todo sem callback evita importar módulos ainda
 * inexistentes (convenção registrada em STATE.md, Fase 02-01).
 */

describe("Dashboards — guard DONO-only", () => {
  it.todo(
    "usuário não autenticado é rejeitado antes de qualquer query de dashboard"
  );
  it.todo(
    "usuário com role COLABORADOR é rejeitado antes de qualquer query de dashboard — apenas DONO acessa"
  );
});
