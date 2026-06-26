import type { DefaultSession } from "next-auth";

export type AppRole = "COLABORADOR" | "DONO" | "CHEFE_SETOR";
export type AppSetor = "FISCAL" | "DP" | "CONTABIL";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      setor: AppSetor | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: AppRole;
    setor: AppSetor | null;
  }
}

// next-auth's "next-auth" and "next-auth/jwt" entrypoints re-export their
// types via `export * from "@auth/core/..."` — augment the underlying
// @auth/core modules directly so the merge applies to the interfaces
// actually used in callback parameter types.
declare module "@auth/core/types" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      setor: AppSetor | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: AppRole;
    setor: AppSetor | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: AppRole;
    setor: AppSetor | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: AppRole;
    setor: AppSetor | null;
  }
}
