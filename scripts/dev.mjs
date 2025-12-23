import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";

const rootDir = path.resolve(new URL(".", import.meta.url).pathname, "..");

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function prefixLines(stream, prefix) {
  const rl = readline.createInterface({ input: stream });
  rl.on("line", (line) => {
    process.stdout.write(`${prefix} ${line}\n`);
  });
}

async function waitForHealth(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Backend did not become healthy in ${timeoutMs}ms: ${url}`);
}

function isPortAvailable(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", (err) => {
      if (err && (err.code === "EADDRINUSE" || err.code === "EACCES")) {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findAvailablePort(startPort, host, attempts = 3) {
  for (let i = 0; i < attempts; i += 1) {
    const port = startPort + i;
    if (await isPortAvailable(port, host)) return port;
  }
  return null;
}

function spawnWithPrefix(command, args, options, prefix) {
  const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
  prefixLines(child.stdout, prefix);
  prefixLines(child.stderr, prefix);
  return child;
}

const envFromFile = readEnvFile(path.join(rootDir, ".env"));
const env = { ...process.env, ...Object.fromEntries(Object.entries(envFromFile).filter(([k]) => process.env[k] === undefined)) };

if (!env.SPRING_PROFILES_ACTIVE) {
  env.SPRING_PROFILES_ACTIVE = "dev";
}

function isValidBase64Key32(s) {
  if (!(typeof s === "string" && /^[A-Za-z0-9+/]+={0,2}$/.test(s) && s.length % 4 === 0)) return false;
  return Buffer.from(s, "base64").length === 32;
}

if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
  env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  process.stdout.write("[backend] JWT_SECRET missing/too short; generated ephemeral secret for this dev session.\n");
}

if (!env.APP_ENCRYPTION_KEY_BASE64 || !isValidBase64Key32(env.APP_ENCRYPTION_KEY_BASE64)) {
  env.APP_ENCRYPTION_KEY_BASE64 = crypto.randomBytes(32).toString("base64");
  process.stdout.write("[backend] APP_ENCRYPTION_KEY_BASE64 missing/invalid; generated ephemeral key for this dev session.\n");
}

const backendDir = path.join(rootDir, "backend");
const dbPath = env.DB_PATH || "./data/pasarela.db";
if (dbPath !== ":memory:") {
  const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(backendDir, dbPath);
  fs.mkdirSync(path.dirname(resolvedDbPath), { recursive: true });
}

const backendPort = env.BACKEND_PORT || "8080";
const backendBindAddress = (env.BACKEND_BIND_ADDRESS || "127.0.0.1").trim() || "127.0.0.1";

function normalizeBackendHost(host) {
  if (host === "0.0.0.0") return "127.0.0.1";
  if (host === "::") return "::1";
  if (host === "localhost") return "127.0.0.1";
  return host;
}

function formatHostForUrl(host) {
  if (host.includes(":") && !host.startsWith("[")) return `[${host}]`;
  return host;
}

const backendHost = normalizeBackendHost(backendBindAddress);
const backendHostForUrl = formatHostForUrl(backendHost);
const backendBaseUrl = `http://${backendHostForUrl}:${backendPort}`;
const backendHealthUrl = `${backendBaseUrl}/actuator/health`;
const defaultBackendHealthTimeoutMs = 120_000;
const backendHealthTimeoutMs = Number(env.BACKEND_HEALTH_TIMEOUT_MS ?? defaultBackendHealthTimeoutMs);
const effectiveBackendHealthTimeoutMs =
  Number.isFinite(backendHealthTimeoutMs) && backendHealthTimeoutMs > 0
    ? backendHealthTimeoutMs
    : defaultBackendHealthTimeoutMs;

const preferredFrontendPortRaw = Number(env.FRONTEND_PORT || env.PORT || "3000");
const preferredFrontendPort = Number.isFinite(preferredFrontendPortRaw) && preferredFrontendPortRaw > 0 ? preferredFrontendPortRaw : 3000;
const frontendHost = "127.0.0.1";
const resolvedFrontendPort = await findAvailablePort(preferredFrontendPort, frontendHost, 5);

if (!resolvedFrontendPort) {
  process.stdout.write(
    `[frontend] No available port starting at ${preferredFrontendPort}. Free a port or set FRONTEND_PORT (e.g. lsof -i :${preferredFrontendPort}).\n`
  );
  process.exit(1);
}

if (resolvedFrontendPort !== preferredFrontendPort) {
  process.stdout.write(
    `[frontend] Port ${preferredFrontendPort} in use. Falling back to ${resolvedFrontendPort}.\n`
  );
}
process.stdout.write(`[frontend] Using port ${resolvedFrontendPort}.\n`);

const defaultFrontendOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://[::1]:3000"
]);
if (!env.FRONTEND_BASE_URL || defaultFrontendOrigins.has(env.FRONTEND_BASE_URL)) {
  env.FRONTEND_BASE_URL = `http://localhost:${resolvedFrontendPort}`;
}

const mvnCmd = process.platform === "win32" ? "mvn.cmd" : "mvn";
const backendArgs = ["-Dmaven.repo.local=.m2/repository", "-f", "backend/pom.xml", "spring-boot:run"];

const backend = spawnWithPrefix(mvnCmd, backendArgs, { cwd: rootDir, env }, "[backend]");

let shuttingDown = false;
let frontend = null;

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    backend.kill("SIGINT");
  } catch {}
  try {
    if (frontend) frontend.kill("SIGINT");
  } catch {}
  process.exitCode = exitCode;
  setTimeout(() => process.exit(exitCode), 500).unref();
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

backend.on("exit", (code) => {
  if (!shuttingDown) {
    process.stdout.write(`[backend] exited with code ${code}\n`);
    shutdown(code ?? 1);
  }
});

try {
  await waitForHealth(backendHealthUrl, effectiveBackendHealthTimeoutMs);
} catch (e) {
  process.stdout.write(`[backend] healthcheck failed: ${e instanceof Error ? e.message : String(e)}\n`);
  shutdown(1);
  process.exit(1);
}

const frontendEnv = {
  ...env,
  API_BASE_URL: env.API_BASE_URL || backendBaseUrl,
  PORT: String(resolvedFrontendPort)
};

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
frontend = spawnWithPrefix(npmCmd, ["run", "dev"], { cwd: path.join(rootDir, "frontend"), env: frontendEnv }, "[frontend]");

frontend.on("exit", (code) => {
  if (!shuttingDown) {
    process.stdout.write(`[frontend] exited with code ${code}\n`);
    shutdown(code ?? 1);
  }
});
