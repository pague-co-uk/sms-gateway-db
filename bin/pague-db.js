#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");

const packageJson = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8"),
);

const REQUIRED_PRISMA_VERSION =
  packageJson.devDependencies?.prisma ??
  packageJson.dependencies?.prisma;

if (!REQUIRED_PRISMA_VERSION) {
  console.error(
    "✗ Unable to determine the required Prisma version from package.json.",
  );
  process.exit(1);
}

function checkPrismaVersion() {
  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["prisma", "--version"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      shell: false,
    },
  );

  if (result.error || result.status !== 0) {
    console.error(
      "✗ Prisma CLI is not installed.\n\n" +
        `Install the required version:\n\n` +
        `  npm install prisma@${REQUIRED_PRISMA_VERSION} @prisma/client@${REQUIRED_PRISMA_VERSION}\n`,
    );

    process.exit(1);
  }

  const output = result.stdout ?? "";

  const match = output.match(/Prisma CLI\s*:\s*([\d.]+)/);

  if (!match) {
    console.error("✗ Unable to determine Prisma CLI version.");
    process.exit(1);
  }

  const installedVersion = match[1];

  if (installedVersion !== REQUIRED_PRISMA_VERSION) {
    console.error(
      `✗ Unsupported Prisma version.\n\n` +
        `Installed : ${installedVersion}\n` +
        `Required  : ${REQUIRED_PRISMA_VERSION}\n\n` +
        `Run:\n\n` +
        `  npm install prisma@${REQUIRED_PRISMA_VERSION} @prisma/client@${REQUIRED_PRISMA_VERSION}\n`,
    );

    process.exit(1);
  }
}

function runPrisma(args) {
  checkPrismaVersion();

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

  checkPrismaVersion();

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

Required Prisma Version

  ${REQUIRED_PRISMA_VERSION}
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