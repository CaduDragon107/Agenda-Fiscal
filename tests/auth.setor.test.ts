import { describe, it, expect } from "vitest";

/**
 * tests/auth.setor.test.ts
 *
 * Cobre SETOR-01 (v2.0): propagação de `setor` no fluxo de
 * autenticação (Auth.js v5 Credentials Provider).
 *
 * Os callbacks `jwt`/`session` em src/auth.config.ts agora copiam `setor`
 * (Plan 02 desta fase, implementação real em src/auth.config.ts):
 *
 * - O callback `jwt` copia `user.setor` para `token.setor`.
 * - O callback `session` copia `token.setor` para `session.user.setor`.
 * - Caso de borda: DONO com `setor: null` propaga `null` corretamente (não
 *   vira `undefined` nem quebra).
 *
 * NÃO editar tests/auth.test.ts existente (regression gate inalterado
 * para AUTH-01/id+role).
 */

describe("auth callbacks — setor (v2.0)", () => {
  it("callback jwt copia user.setor para token.setor", async () => {
    const { authConfig } = await import("@/auth.config");

    const user = {
      id: "user_dp_1",
      name: "DP1",
      email: "dp1@escritorio.com.br",
      role: "COLABORADOR" as const,
      setor: "DP" as const,
    };

    const token = await authConfig.callbacks!.jwt!({
      token: {},
      user,
    } as never);

    expect(token).toMatchObject({ setor: "DP" });
  });

  it("callback session copia token.setor para session.user.setor", async () => {
    const { authConfig } = await import("@/auth.config");

    const token = {
      id: "user_dp_1",
      role: "COLABORADOR" as const,
      setor: "DP" as const,
    };

    const session = await authConfig.callbacks!.session!({
      session: { user: {}, expires: "" },
      token,
    } as never);

    expect(session.user).toMatchObject({ setor: "DP" });
  });

  it("DONO com setor null propaga null corretamente (não vira undefined)", async () => {
    const { authConfig } = await import("@/auth.config");

    const user = {
      id: "user_dono_1",
      name: "Dono",
      email: "dono@escritorio.com.br",
      role: "DONO" as const,
      setor: null,
    };

    const token = await authConfig.callbacks!.jwt!({
      token: {},
      user,
    } as never);

    expect(token.setor).toBeNull();
    expect(token.setor).not.toBeUndefined();

    const session = await authConfig.callbacks!.session!({
      session: { user: {}, expires: "" },
      token,
    } as never);

    expect(session.user.setor).toBeNull();
    expect(session.user.setor).not.toBeUndefined();
  });
});
