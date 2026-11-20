import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const baseUrl = (process.env.LOAD_BASE_URL ?? "http://localhost:4100").replace(/\/$/, "");
const clients = Number.parseInt(process.env.LOAD_CLIENTS ?? "4", 10);
const durationSeconds = Number.parseInt(process.env.LOAD_DURATION_SECONDS ?? "10", 10);
const intervalMs = Number.parseInt(process.env.LOAD_INTERVAL_MS ?? "100", 10);
const maximumFailureRate = Number.parseFloat(process.env.LOAD_MAX_FAILURE_RATE ?? "0");
const reportPath = process.env.LOAD_REPORT_PATH;
const routes = [
  "/health",
  "/health",
  "/ready",
  "/api/v1/products?limit=12",
  "/api/v1/categories",
  "/api/v1/search?q=vase",
];

if (![clients, durationSeconds, intervalMs].every(Number.isFinite) || clients < 1 || durationSeconds < 1 || intervalMs < 0) {
  throw new Error("LOAD_CLIENTS, LOAD_DURATION_SECONDS, and LOAD_INTERVAL_MS must be valid positive numbers");
}

const samples = [];
const deadline = performance.now() + durationSeconds * 1_000;
const startedAt = new Date();

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function virtualClient(clientIndex) {
  let requestIndex = clientIndex;
  while (performance.now() < deadline) {
    const path = routes[requestIndex % routes.length];
    const started = performance.now();
    try {
      const response = await fetch(`${baseUrl}${path}`, { headers: { accept: "application/json", "user-agent": "aureva-load-test/1.0" } });
      await response.arrayBuffer();
      samples.push({ path, status: response.status, durationMs: performance.now() - started, ok: response.ok });
    } catch (error) {
      samples.push({ path, status: 0, durationMs: performance.now() - started, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
    requestIndex += clients;
    if (intervalMs > 0) await sleep(intervalMs);
  }
}

await Promise.all(Array.from({ length: clients }, (_, index) => virtualClient(index)));

const elapsedSeconds = (performance.now() - (deadline - durationSeconds * 1_000)) / 1_000;
const orderedDurations = samples.map((sample) => sample.durationMs).sort((left, right) => left - right);
const percentile = (value) => orderedDurations.length ? orderedDurations[Math.min(orderedDurations.length - 1, Math.ceil(orderedDurations.length * value) - 1)] : 0;
const statusCounts = Object.groupBy(samples, (sample) => String(sample.status));
const pathGroups = Object.groupBy(samples, (sample) => sample.path);
const failures = samples.filter((sample) => !sample.ok).length;
const report = {
  measuredAt: startedAt.toISOString(),
  target: baseUrl,
  configuration: { clients, durationSeconds, intervalMs },
  requests: {
    total: samples.length,
    succeeded: samples.length - failures,
    failed: failures,
    requestsPerSecond: Number((samples.length / elapsedSeconds).toFixed(2)),
  },
  latencyMs: {
    p50: Number(percentile(0.5).toFixed(2)),
    p95: Number(percentile(0.95).toFixed(2)),
    p99: Number(percentile(0.99).toFixed(2)),
    maximum: Number((orderedDurations.at(-1) ?? 0).toFixed(2)),
  },
  statuses: Object.fromEntries(Object.entries(statusCounts).map(([status, values]) => [status, values.length])),
  routes: Object.fromEntries(Object.entries(pathGroups).map(([path, values]) => [path, {
    requests: values.length,
    failures: values.filter((sample) => !sample.ok).length,
    averageMs: Number((values.reduce((sum, sample) => sum + sample.durationMs, 0) / values.length).toFixed(2)),
  }])),
};

const output = `${JSON.stringify(report, null, 2)}\n`;
process.stdout.write(output);
if (reportPath) await writeFile(reportPath, output, "utf8");

if (samples.length === 0 || failures / samples.length > maximumFailureRate) process.exitCode = 1;
