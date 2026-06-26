import { PrismaClient, Role, Setor } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const usuarios = [
    { nome: "Neto", email: "dono@escritorio.com.br", role: Role.DONO, setor: null },
    { nome: "Colaborador 1", email: "colaborador1@escritorio.com.br", role: Role.CHEFE_SETOR, setor: Setor.FISCAL },
    { nome: "Colaborador 2", email: "colaborador2@escritorio.com.br", role: Role.COLABORADOR, setor: Setor.FISCAL },
    { nome: "Colaborador 3", email: "colaborador3@escritorio.com.br", role: Role.COLABORADOR, setor: Setor.FISCAL },
    { nome: "Colaborador 4", email: "colaborador4@escritorio.com.br", role: Role.COLABORADOR, setor: Setor.FISCAL },
    { nome: "Lauany", email: "dp1@escritorio.com.br", role: Role.CHEFE_SETOR, setor: Setor.DP },
    { nome: "Andre", email: "dp2@escritorio.com.br", role: Role.COLABORADOR, setor: Setor.DP },
    { nome: "Mirella", email: "dp3@escritorio.com.br", role: Role.COLABORADOR, setor: Setor.DP },
    { nome: "Lorraine", email: "dp4@escritorio.com.br", role: Role.COLABORADOR, setor: Setor.DP },
    { nome: "Elisabete", email: "contabil1@escritorio.com.br", role: Role.CHEFE_SETOR, setor: Setor.CONTABIL },
    { nome: "Rany", email: "contabil2@escritorio.com.br", role: Role.COLABORADOR, setor: Setor.CONTABIL },
    { nome: "Sarah", email: "contabil3@escritorio.com.br", role: Role.COLABORADOR, setor: Setor.CONTABIL },
  ];

  for (const u of usuarios) {
    const senhaHash = await bcrypt.hash("trocar-no-primeiro-login", 10);
    await db.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, senhaHash },
    });
  }
}

main().finally(() => db.$disconnect());
