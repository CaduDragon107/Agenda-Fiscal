import { z } from "zod";

/**
 * Schema de validação de Usuario (WR-03, code review da Fase 8 — 08-REVIEW.md).
 *
 * Origem do achado: tipo-obrigacao-setor.ts:52-59 — uma tarefa avulsa
 * atribuída a um COLABORADOR com `setor=null` some de todos os dashboards
 * (setorDaTarefa retorna null para tarefas avulsas sem setor classificável,
 * e a linha é descartada silenciosamente em calcularSnapshotMensal).
 *
 * Fix prescrito: validar na camada de aplicação que um COLABORADOR nunca
 * seja salvo sem setor — NÃO mudar a coluna nullable no banco (DONO
 * legitimamente tem setor=null, schema.prisma:65).
 *
 * REALIDADE DO CODEBASE (no momento desta correção): não existe nenhuma
 * Server Action nem UI de criação/edição de usuário — usuários são criados
 * apenas via prisma/seed.ts e scripts ad-hoc. Este schema é o PRIMITIVO de
 * validação reutilizável, pronto para ser plugado em qualquer futura Server
 * Action de usuário (ex.: `criarUsuario`/`editarUsuario`), e testável desde
 * já — exatamente o "validate at the Zod schema / Server Action layer" que
 * o achado pede.
 *
 * Convenção do projeto: enums usam literais maiúsculos (Role:
 * COLABORADOR/DONO; Setor: FISCAL/DP/CONTABIL — decisão 01-03/STATE.md),
 * não importados de @prisma/client, espelhando empresas/schema.ts.
 */
export const usuarioSchema = z
  .object({
    nome: z.string().min(1, "Nome é obrigatório"),
    email: z.string().email("Email inválido"),
    role: z.enum(["COLABORADOR", "DONO"]),
    setor: z.enum(["FISCAL", "DP", "CONTABIL"]).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    // WR-03: COLABORADOR sem setor faz com que suas tarefas avulsas
    // desapareçam silenciosamente dos dashboards (tipo-obrigacao-setor.ts).
    // DONO não precisa de setor — mantém a visão geral cross-setor.
    if (data.role === "COLABORADOR" && data.setor == null) {
      ctx.addIssue({
        code: "custom",
        path: ["setor"],
        message: "Colaborador exige um setor (FISCAL, DP ou CONTABIL)",
      });
    }
  });

export type UsuarioInput = z.infer<typeof usuarioSchema>;
