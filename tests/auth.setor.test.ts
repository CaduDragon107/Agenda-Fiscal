import { describe, it, expect } from "vitest";

/**
 * tests/auth.setor.test.ts
 *
 * Cobre SETOR-01 (v2.0): propagação de `setor` no fluxo de
 * autenticação (Auth.js v5 Credentials Provider).
 *
 * Esta é a Wave 0 (scaffold RED) desta funcionalidade — os callbacks
 * `jwt`/`session` em src/auth.config.ts ainda NÃO copiam `setor` nesta
 * wave (Plan 01). O assert abaixo descreve o comportamento ESPERADO após
 * a extensão e fica RED até o Plan 02 implementar:
 *
 * - O callback `jwt` deve copiar `user.setor` para `token.setor`.
 * - O callback `session` deve copiar `token.setor` para `session.user.setor`.
 *
 * NÃO editar tests/auth.test.ts existente (regression gate inalterado
 * para AUTH-01/id+role).
 *
 * Implementação real: src/auth.config.ts (Plan 02 desta fase).
 */

describe("auth callbacks — setor (v2.0)", () => {
  it.todo(
    "callback jwt copia user.setor para token.setor; callback session copia token.setor para session.user.setor"
  );
});
