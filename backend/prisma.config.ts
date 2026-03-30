import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const dbUrl = process.env.DATABASE_URL || "";

if (!process.env.NODE_ENV) {
  throw new Error("APP_ENV is not set");
}

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