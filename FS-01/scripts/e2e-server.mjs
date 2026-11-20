import { spawn, spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const testDatabaseUrl = process.env.TEST_DATABASE_URL
  ?? "postgresql://nexvia:nexvia_dev_password@localhost:5432/nexvia_test?schema=public";
const commonEnvironment = {
  ...process.env,
  NODE_ENV: "test",
  LOG_LEVEL: "warn",
  DATABASE_URL: testDatabaseUrl,
  TEST_DATABASE_URL: testDatabaseUrl,
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
  WEB_ORIGIN: "http://127.0.0.1:4173",
  APP_URL: "http://127.0.0.1:4173",
  SESSION_COOKIE_NAME: "nexvia_e2e_session",
  SESSION_SECRET: "e2e-session-secret-with-at-least-thirty-two-characters",
  CSRF_SECRET: "e2e-csrf-secret-with-at-least-thirty-two-characters",
  COLLABORATION_INTERNAL_SECRET: "e2e-collaboration-secret-at-least-thirty-two-characters",
  COLLABORATION_INTERNAL_URL: "http://127.0.0.1:4101",
  COLLABORATION_REDIS_CHANNEL_PREFIX: "nexvia:e2e",
  MAIL_TRANSPORT: "log",
  TRUST_PROXY: "false",
};
const children = [];
let shuttingDown = false;

function runNode(modulePath, commandArguments, environment = commonEnvironment) {
  const child = spawn(process.execPath, [modulePath, ...commandArguments], {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
  });
  children.push(child);
  child.once("exit", (code) => {
    if (code && !shuttingDown) {
      console.error(`E2E child process exited with code ${code}`);
      shutdown(code);
    }
  });
  return child;
}

async function waitFor(url, label) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Service is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function stopProcessTree(processId) {
  if (!processId) return;
  if (isWindows) {
    spawnSync("taskkill", ["/pid", String(processId), "/T", "/F"], { stdio: "ignore" });
  } else {
    try { process.kill(-processId, "SIGTERM"); } catch { /* already stopped */ }
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) stopProcessTree(child.pid);
  process.exit(code);
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(0));
process.on("exit", () => {
  for (const child of children) stopProcessTree(child.pid);
});

const migration = spawnSync(isWindows ? "cmd.exe" : npmCommand, isWindows
  ? ["/d", "/s", "/c", "npm run db:migrate:deploy"]
  : ["run", "db:migrate:deploy"], {
  cwd: process.cwd(),
  env: commonEnvironment,
  stdio: "inherit",
});
if (migration.error) console.error(migration.error);
if (migration.status !== 0) process.exit(migration.status ?? 1);

runNode("node_modules/tsx/dist/cli.mjs", ["apps/api/src/index.ts"], { ...commonEnvironment, API_HOST: "127.0.0.1", API_PORT: "4100" });
runNode("node_modules/tsx/dist/cli.mjs", ["apps/collaboration/src/index.ts"], {
  ...commonEnvironment,
  COLLABORATION_HOST: "127.0.0.1",
  COLLABORATION_PORT: "4101",
  COLLABORATION_INSTANCE_ID: "playwright-e2e",
});

await Promise.all([
  waitFor("http://127.0.0.1:4100/health/ready", "API"),
  waitFor("http://127.0.0.1:4101/health/ready", "collaboration service"),
]);

runNode("node_modules/vite/bin/vite.js", ["apps/web", "--host", "127.0.0.1", "--port", "4173", "--strictPort"], {
  ...commonEnvironment,
  VITE_API_URL: "http://127.0.0.1:4100/api/v1",
  VITE_COLLABORATION_URL: "ws://127.0.0.1:4101/collaboration",
});
await waitFor("http://127.0.0.1:4173", "web application");
await new Promise(() => undefined);
