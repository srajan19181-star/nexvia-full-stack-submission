import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { WebSocket as NodeWebSocket } from "ws";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

const configuration = {
  serverUrl: process.env.LOAD_COLLABORATION_URL ?? "ws://127.0.0.1:4001/collaboration",
  pageId: process.env.LOAD_PAGE_ID,
  sessionToken: process.env.LOAD_SESSION_TOKEN,
  sessionCookieName: process.env.LOAD_SESSION_COOKIE_NAME ?? "nexvia_session",
  origin: process.env.LOAD_WEB_ORIGIN ?? "http://localhost:5173",
  generation: Number(process.env.LOAD_DOCUMENT_GENERATION ?? "1"),
  clients: Number(process.env.LOAD_CLIENTS ?? "25"),
  connectTimeoutMs: Number(process.env.LOAD_CONNECT_TIMEOUT_MS ?? "30000"),
  convergenceTimeoutMs: Number(process.env.LOAD_CONVERGENCE_TIMEOUT_MS ?? "30000"),
  reportPath: process.env.LOAD_REPORT_PATH,
};

if (!configuration.pageId || !configuration.sessionToken) {
  console.error("LOAD_PAGE_ID and LOAD_SESSION_TOKEN are required. Use an authorized editor session for the target page.");
  process.exit(2);
}
if (!Number.isInteger(configuration.clients) || configuration.clients < 1 || configuration.clients > 2_000) {
  console.error("LOAD_CLIENTS must be an integer between 1 and 2000.");
  process.exit(2);
}
process.setMaxListeners(Math.max(10, configuration.clients + 5));

class AuthenticatedWebSocket extends NodeWebSocket {
  constructor(url, protocols) {
    super(url, protocols, {
      origin: configuration.origin,
      headers: {
        Cookie: `${configuration.sessionCookieName}=${encodeURIComponent(configuration.sessionToken)}`,
      },
    });
  }
}

function percentile(values, percentileValue) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return Math.round(sorted[index] * 100) / 100;
}

async function waitFor(check, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
}

const startedAt = performance.now();
const clients = Array.from({ length: configuration.clients }, (_, index) => {
  const document = new Y.Doc();
  const connectedAt = performance.now();
  const provider = new WebsocketProvider(configuration.serverUrl, configuration.pageId, document, {
    WebSocketPolyfill: AuthenticatedWebSocket,
    disableBc: true,
    maxBackoffTime: 500,
    params: { generation: String(configuration.generation) },
  });
  return { index, document, provider, connectedAt, synchronizedAt: null };
});

try {
  await Promise.all(clients.map((client) => new Promise((resolvePromise, rejectPromise) => {
    const timeout = setTimeout(() => rejectPromise(new Error(`Client ${client.index} failed to synchronize`)), configuration.connectTimeoutMs);
    const synchronized = (isSynchronized) => {
      if (!isSynchronized) return;
      clearTimeout(timeout);
      client.synchronizedAt = performance.now();
      client.provider.off("sync", synchronized);
      resolvePromise();
    };
    client.provider.on("sync", synchronized);
  })));

  const updateStartedAt = performance.now();
  for (const client of clients) {
    client.document.getText("load-test").insert(0, `[client-${client.index}]`);
  }
  const expectedMarkers = clients.map((client) => `[client-${client.index}]`);
  await waitFor(
    () => clients.every((client) => {
      const content = client.document.getText("load-test").toString();
      return expectedMarkers.every((marker) => content.includes(marker));
    }),
    configuration.convergenceTimeoutMs,
    "all client updates to converge",
  );

  const completedAt = performance.now();
  const synchronizationLatencies = clients.map((client) => client.synchronizedAt - client.connectedAt);
  const report = {
    measuredAt: new Date().toISOString(),
    target: {
      collaborationUrl: configuration.serverUrl,
      pageId: configuration.pageId,
      generation: configuration.generation,
      virtualClients: configuration.clients,
    },
    measurements: {
      connectedClients: clients.filter((client) => client.provider.wsconnected).length,
      updatesSent: clients.length,
      synchronizationLatencyMs: {
        minimum: Math.round(Math.min(...synchronizationLatencies) * 100) / 100,
        p50: percentile(synchronizationLatencies, 50),
        p95: percentile(synchronizationLatencies, 95),
        p99: percentile(synchronizationLatencies, 99),
        maximum: Math.round(Math.max(...synchronizationLatencies) * 100) / 100,
      },
      updateConvergenceMs: Math.round((completedAt - updateStartedAt) * 100) / 100,
      totalRunMs: Math.round((completedAt - startedAt) * 100) / 100,
      finalCharacterCount: clients[0].document.getText("load-test").length,
      processMemoryBytes: process.memoryUsage().rss,
    },
  };

  const output = `${JSON.stringify(report, null, 2)}\n`;
  process.stdout.write(output);
  if (configuration.reportPath) {
    const reportPath = resolve(configuration.reportPath);
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, output, "utf8");
  }
} finally {
  for (const client of clients) {
    client.provider.destroy();
    client.document.destroy();
  }
}
