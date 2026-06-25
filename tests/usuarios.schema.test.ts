import { describe, it, expect } from "vitest";
import { usuarioSchema } from "@/modules/usuarios/schema";

/**
 * tests/usuarios.schema.test.ts
 *
 * Cobre WR-03 (08-REVIEW.md): usuarioSchema rejeita COLABORADOR sem setor
 * (cuja tarefa avulsa sumiria silenciosamente dos dashboards via
 * tipo-obrigacao-setor.ts) enquanto aceita DONO sem setor (visão geral
 * cross-setor, coluna nullable preservada).
 */
describe("usuarioSchema — regra COLABORADOR-exige-setor (WR-03)", () => {
  it("rejeita COLABORADOR com setor null", () => {
    const resultado = usuarioSchema.safeParse({
      nome: "Joao",
      email: "joao@escritorio.com",
      role: "COLABORADOR",
      setor: null,
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      const issueSetor = resultado.error.issues.find(
        (i) => i.path[0] === "setor"
      );
      expect(issueSetor).toBeDefined();
      expect(issueSetor?.message).toMatch(/setor/i);
    }
  });

  it("rejeita COLABORADOR com setor undefined (campo ausente)", () => {
    const resultado = usuarioSchema.safeParse({
      nome: "Joao",
      email: "joao@escritorio.com",
      role: "COLABORADOR",
    });

    expect(resultado.success).toBe(false);
  });

  it("aceita COLABORADOR com setor DP", () => {
    const resultado = usuarioSchema.safeParse({
      nome: "Jessica",
      email: "jessica@escritorio.com",
      role: "COLABORADOR",
      setor: "DP",
    });

    expect(resultado.success).toBe(true);
  });

  it("aceita DONO com setor null (DONO não precisa de setor)", () => {
    const resultado = usuarioSchema.safeParse({
      nome: "Caio",
      email: "caio@escritorio.com",
      role: "DONO",
      setor: null,
    });

    expect(resultado.success).toBe(true);
  });

  it("aceita DONO com setor presente (FISCAL) — não é o caso canônico, mas não é proibido", () => {
    const resultado = usuarioSchema.safeParse({
      nome: "Caio",
      email: "caio@escritorio.com",
      role: "DONO",
      setor: "FISCAL",
    });

    expect(resultado.success).toBe(true);
  });

  it("rejeita email inválido", () => {
    const resultado = usuarioSchema.safeParse({
      nome: "Joao",
      email: "nao-e-email",
      role: "COLABORADOR",
      setor: "DP",
    });

    expect(resultado.success).toBe(false);
  });
});
