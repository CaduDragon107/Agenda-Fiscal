import type { DefaultSession } from "next-auth";

export type AppRole = "COLABORADOR" | "DONO";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: AppRole;
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
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: AppRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: AppRole;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: AppRole;
  }
}
