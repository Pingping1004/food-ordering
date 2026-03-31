import "dotenv/config";
import { defineConfig, env } from "prisma/config";

if (process.env.NODE_ENV === "production") {
  console.warn("⚠️ Make sure this is the PROD database");
}

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "./prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL")
  }
});