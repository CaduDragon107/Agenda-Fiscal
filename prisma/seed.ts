import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const usuarios = [
    { nome: "Dono do Escritório", email: "dono@escritorio.com.br", role: Role.DONO },
    { nome: "Colaborador 1", email: "colaborador1@escritorio.com.br", role: Role.COLABORADOR },
    { nome: "Colaborador 2", email: "colaborador2@escritorio.com.br", role: Role.COLABORADOR },
    { nome: "Colaborador 3", email: "colaborador3@escritorio.com.br", role: Role.COLABORADOR },
    { nome: "Colaborador 4", email: "colaborador4@escritorio.com.br", role: Role.COLABORADOR },
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
