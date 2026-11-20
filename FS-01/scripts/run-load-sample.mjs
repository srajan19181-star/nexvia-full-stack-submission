import { spawn, spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const clients = process.env.LOAD_CLIENTS ?? "25";
const server = spawn(process.execPath, ["scripts/e2e-server.mjs"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

function stopProcessTree(processId) {
  if (!processId) return;
  if (isWindows) {
    spawnSync("taskkill", ["/pid", String(processId), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-processId, "SIGTERM");
  } catch {
    // Process already exited.
  }
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

function cookieValues(response) {
  return response.headers.getSetCookie().map((value) => value.split(";", 1)[0]);
}

async function createFixture() {
  const baseUrl = "http://127.0.0.1:4100/api/v1";
  const origin = "http://127.0.0.1:4173";
  const csrfResponse = await fetch(`${baseUrl}/auth/csrf`, { headers: { origin } });
  const csrfBody = await csrfResponse.json();
  const csrfCookie = cookieValues(csrfResponse).join("; ");
  const registerResponse = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "x-csrf-token": csrfBody.csrfToken,
      cookie: csrfCookie,
    },
    body: JSON.stringify({
      name: "Load Test Editor",
      email: `load-${Date.now()}@example.test`,
      password: "LoadTestPassphrase!2026",
    }),
  });
  if (!registerResponse.ok) throw new Error(`Registration failed: ${registerResponse.status} ${await registerResponse.text()}`);
  const registerBody = await registerResponse.json();
  const cookies = cookieValues(registerResponse);
  const cookie = cookies.join("; ");
  const sessionToken = cookies
    .find((value) => value.startsWith("nexvia_e2e_session="))
    ?.split("=")
    .slice(1)
    .join("=");
  if (!sessionToken) throw new Error("The load fixture did not receive a session cookie");

  const request = async (path, body) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "x-csrf-token": registerBody.csrfToken,
        cookie,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Fixture request failed: ${response.status} ${await response.text()}`);
    return response.json();
  };

  const workspace = (await request("/workspaces", { name: "Measured load workspace" })).data.workspace;
  const page = (await request(`/workspaces/${workspace.id}/pages`, { title: "Measured collaboration load" })).data.page;
  return { pageId: page.id, sessionToken };
}

try {
  await waitFor("http://127.0.0.1:4100/health/ready", "API");
  await waitFor("http://127.0.0.1:4101/health/ready", "collaboration service");
  const fixture = await createFixture();
  const loadTest = spawn(process.execPath, ["tests/load/collaboration-load.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      LOAD_COLLABORATION_URL: "ws://127.0.0.1:4101/collaboration",
      LOAD_WEB_ORIGIN: "http://127.0.0.1:4173",
      LOAD_SESSION_COOKIE_NAME: "nexvia_e2e_session",
      LOAD_PAGE_ID: fixture.pageId,
      LOAD_SESSION_TOKEN: fixture.sessionToken,
      LOAD_CLIENTS: clients,
      LOAD_REPORT_PATH: process.env.LOAD_REPORT_PATH ?? `test-results/collaboration-load-${clients}.json`,
    },
    stdio: "inherit",
  });
  const exitCode = await new Promise((resolve, reject) => {
    loadTest.once("error", reject);
    loadTest.once("exit", (code) => resolve(code ?? 1));
  });
  if (exitCode !== 0) process.exitCode = exitCode;
} finally {
  stopProcessTree(server.pid);
}
