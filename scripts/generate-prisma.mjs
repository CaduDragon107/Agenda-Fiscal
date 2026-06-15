import { execSync } from "node:child_process";

const env = { ...process.env };
env.DATABASE_URL ??= "postgresql://user:password@localhost:5432/db";
env.DIRECT_URL ??= env.DATABASE_URL;

execSync("npx prisma generate", { stdio: "inherit", env });
