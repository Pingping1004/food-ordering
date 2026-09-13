import * as dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";
import path from "path";

const nodeEnv = process.env.NODE_ENV || "development";
const envFile = nodeEnv === "production" ? ".env.production" : ".env";

dotenv.config({ path: path.resolve(process.cwd(), envFile) })

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "./prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL")
  }
});