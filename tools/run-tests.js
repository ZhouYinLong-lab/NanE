#!/usr/bin/env node

const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const NODE = process.execPath;
const HEALTH_TIMEOUT_MS = 30_000;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function requestHealth(baseUrl) {
  return new Promise(resolve => {
    const req = http.get(`${baseUrl}/api/health`, res => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1_000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForHealth(baseUrl, child) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < HEALTH_TIMEOUT_MS) {
    if (child.exitCode !== null) {
      throw new Error(`API server exited before becoming healthy with code ${child.exitCode}`);
    }
    if (await requestHealth(baseUrl)) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`API server did not become healthy within ${HEALTH_TIMEOUT_MS}ms`);
}

function runNodeTest(env) {
  return new Promise(resolve => {
    const child = spawn(NODE, ["--test", "server/tests"], {
      cwd: ROOT,
      env,
      stdio: "inherit"
    });
    child.on("exit", code => resolve(code || 0));
  });
}

function stopServer(child) {
  return new Promise(resolve => {
    if (!child || child.exitCode !== null) {
      resolve();
      return;
    }
    const timeout = setTimeout(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }, 5_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

async function main() {
  if (process.env.NANE_TEST_BASE_URL) {
    process.exitCode = await runNodeTest(process.env);
    return;
  }

  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    PORT: String(port),
    NANE_TEST_BASE_URL: baseUrl
  };

  const server = spawn(NODE, ["server/index.js"], {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  server.stdout.on("data", chunk => process.stdout.write(chunk));
  server.stderr.on("data", chunk => process.stderr.write(chunk));

  try {
    await waitForHealth(baseUrl, server);
    process.exitCode = await runNodeTest(env);
  } finally {
    await stopServer(server);
  }
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
