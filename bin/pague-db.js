#!/usr/bin/env node

import { cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");

function runPrisma(args) {
  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["prisma", ...args],
    {
      cwd: process.cwd(),
      stdio: "inherit",
      shell: false,
    },
  );

  process.exit(result.status ?? 1);
}

function sync() {
  const source = join(packageRoot, "prisma");
  const destination = join(process.cwd(), "prisma");

  if (!existsSync(source)) {
    console.error("✗ Unable to locate the bundled prisma directory.");
    process.exit(1);
  }

  cpSync(source, destination, {
    recursive: true,
    force: true,
  });

  console.log("✓ Prisma assets synchronized.");
}

function install() {
  sync();

  console.log("Generating Prisma Client...");

  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["prisma", "generate"],
    {
      cwd: process.cwd(),
      stdio: "inherit",
      shell: false,
    },
  );

  process.exit(result.status ?? 1);
}

function help() {
  console.log(`
Pague Database CLI

Usage

  pague-db <command>

Commands

  sync        Synchronize schema, migrations and seed files
  install     Sync assets and generate Prisma Client
  generate    Run prisma generate
  migrate     Run prisma migrate dev
  deploy      Run prisma migrate deploy
  seed        Run prisma db seed
  validate    Run prisma validate
  format      Run prisma format
  studio      Run prisma studio
  help        Show this help
`);
}

const command = process.argv[2] ?? "help";

switch (command) {
  case "sync":
    sync();
    break;

  case "install":
    install();
    break;

  case "generate":
    runPrisma(["generate"]);
    break;

  case "migrate":
    runPrisma(["migrate", "dev"]);
    break;

  case "deploy":
    runPrisma(["migrate", "deploy"]);
    break;

  case "seed":
    runPrisma(["db", "seed"]);
    break;

  case "validate":
    runPrisma(["validate"]);
    break;

  case "format":
    runPrisma(["format"]);
    break;

  case "studio":
    runPrisma(["studio"]);
    break;

  case "help":
  default:
    help();
    break;
}