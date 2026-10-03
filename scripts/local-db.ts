import "dotenv/config";
import { spawn } from "node:child_process";
import { access, mkdir, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { z } from "zod";

async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Use a managed PostgreSQL service in production.");
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname))
    throw new Error(
      "Local database launcher requires a loopback DATABASE_URL.",
    );
  const platform = process.platform === "win32" ? "windows" : process.platform;
  const binaryModule: unknown = await import(
    `@embedded-postgres/${platform}-${process.arch}`
  );
  const binaries = z
    .object({ initdb: z.string(), postgres: z.string(), pg_ctl: z.string() })
    .parse(binaryModule);
  const directory = resolve(".data/native-postgres");
  const port = Number(process.env.LOCAL_DATABASE_PORT || url.port || 5434);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("Invalid database port.");
  const user = decodeURIComponent(url.username),
    password = decodeURIComponent(url.password),
    database = url.pathname.slice(1);
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(database))
    throw new Error("Use a simple alphanumeric local database name.");
  const run = (executable: string, args: string[]) =>
    new Promise<void>((resolve, reject) => {
      const child = spawn(executable, args, {
        windowsHide: true,
        stdio: "ignore",
      });
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`PostgreSQL utility exited with code ${code}.`)),
      );
    });
  await mkdir(resolve(".data"), { recursive: true });
  if (
    !(await access(resolve(directory, "PG_VERSION")).then(
      () => true,
      () => false,
    ))
  ) {
    const passwordFile = resolve(".data", `.postgres-password-${randomUUID()}`);
    await writeFile(passwordFile, password + "\n", { mode: 0o600, flag: "wx" });
    try {
      await run(binaries.initdb, [
        "-D",
        directory,
        "-U",
        user,
        "--pwfile",
        passwordFile,
        "--auth=scram-sha-256",
        "--encoding=UTF8",
        "--locale=C",
      ]);
    } finally {
      await rm(passwordFile, { force: true });
    }
  }
  const server = spawn(
    binaries.postgres,
    [
      "-D",
      directory,
      "-h",
      "127.0.0.1",
      "-p",
      String(port),
      "-c",
      "log_min_messages=fatal",
      "-c",
      "log_min_error_statement=panic",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  let stopping = false;
  server.on("error", () => {
    console.error("PostgreSQL could not start.");
    process.exitCode = 1;
  });
  server.on("exit", (code) => {
    if (!stopping) {
      console.error(
        `PostgreSQL exited (${code}). Check the port and data directory.`,
      );
      process.exitCode = 1;
    }
  });
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await run(binaries.pg_ctl, ["-D", directory, "-m", "fast", "-w", "stop"]);
  };
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());
  for (let attempt = 0; attempt < 60; attempt++) {
    const client = new Client({
      host: "127.0.0.1",
      port,
      user,
      password,
      database: "postgres",
      connectionTimeoutMillis: 1000,
    });
    try {
      await client.connect();
      if (
        !(
          await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [
            database,
          ])
        ).rowCount
      )
        await client.query(`CREATE DATABASE "${database}"`);
      await client.end();
      console.log(
        `Native PostgreSQL is ready on 127.0.0.1:${port}. Data persists in .data/native-postgres.`,
      );
      return;
    } catch {
      await client.end();
      if (server.exitCode !== null)
        throw new Error("PostgreSQL stopped before it was ready.");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  await stop();
  throw new Error("PostgreSQL readiness timed out.");
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Local database failed.",
  );
  process.exitCode = 1;
});
