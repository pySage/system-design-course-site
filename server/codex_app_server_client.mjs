import { spawn } from "node:child_process";
import net from "node:net";

const STARTUP_TIMEOUT_MS = Number(process.env.PERSONALIZATION_CODEX_APP_SERVER_STARTUP_TIMEOUT_MS ?? 30000);
const REQUEST_TIMEOUT_MS = Number(process.env.PERSONALIZATION_CODEX_APP_SERVER_REQUEST_TIMEOUT_MS ?? 10000);
const DEBUG_APP_SERVER = String(process.env.PERSONALIZATION_CODEX_APP_SERVER_DEBUG ?? "0") === "1";

function withTimeout(task, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

function textInput(text) {
  return [{ type: "text", text, text_elements: [] }];
}

function debugLog(...args) {
  if (DEBUG_APP_SERVER) {
    console.error("[codex-app-server]", ...args);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

async function waitForHealth(url, timeoutMs) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until timeout.
    }

    await sleep(200);
  }

  throw new Error(`Codex app-server did not become healthy at ${url} within ${timeoutMs}ms`);
}

function readOnlyThreadStartParams({ cwd, model }) {
  return {
    model,
    cwd,
    approvalPolicy: "never",
    sandbox: "read-only",
    ephemeral: true,
    experimentalRawEvents: false,
    persistExtendedHistory: false,
  };
}

function turnKeyFromParams(params) {
  const threadId = params?.threadId ?? null;
  const turnId = params?.turnId ?? params?.turn?.id ?? null;

  if (!threadId || !turnId) {
    return null;
  }

  return `${threadId}:${turnId}`;
}

export class CodexAppServerClient {
  constructor() {
    this.process = null;
    this.websocket = null;
    this.startPromise = null;
    this.connectionInfo = null;
    this.pendingRequests = new Map();
    this.pendingTurns = new Map();
    this.turnSnapshots = new Map();
    this.nextRequestId = 1;
    this.stdoutBuffer = "";
    this.stderrBuffer = "";
    this.exitHooksInstalled = false;
    this.warmPromise = null;
  }

  installExitHooks() {
    if (this.exitHooksInstalled) {
      return;
    }

    this.exitHooksInstalled = true;
    const shutdown = () => this.dispose();
    process.once("exit", shutdown);
    process.once("SIGINT", () => {
      shutdown();
      process.exit(130);
    });
    process.once("SIGTERM", () => {
      shutdown();
      process.exit(143);
    });
  }

  reset(error = null) {
    const failure = error ?? new Error("Codex app-server connection was reset.");

    for (const { reject, timer } of this.pendingRequests.values()) {
      clearTimeout(timer);
      reject(failure);
    }
    this.pendingRequests.clear();

    for (const { reject, timer } of this.pendingTurns.values()) {
      clearTimeout(timer);
      reject(failure);
    }
    this.pendingTurns.clear();
    this.turnSnapshots.clear();

    if (this.websocket) {
      try {
        this.websocket.close();
      } catch {
        // Ignore close failures during reset.
      }
    }

    if (this.process) {
      try {
        this.process.kill("SIGTERM");
      } catch {
        // Ignore kill failures during reset.
      }
    }

    this.process = null;
    this.websocket = null;
    this.startPromise = null;
    this.connectionInfo = null;
    this.stdoutBuffer = "";
    this.stderrBuffer = "";
    this.warmPromise = null;
  }

  dispose() {
    this.reset(new Error("Codex app-server client disposed."));
  }

  async ensureReady() {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      return this.connectionInfo;
    }

    if (!this.startPromise) {
      this.startPromise = this.start();
    }

    return this.startPromise;
  }

  async start() {
    this.installExitHooks();
    const processInfo = await this.startProcess();
    this.process = processInfo.process;
    this.connectionInfo = processInfo.connectionInfo;
    await this.connect(processInfo.connectionInfo.wsUrl);
    await this.request("initialize", {
      clientInfo: {
        name: "sdesign-course-site",
        title: "SDesign Course Site",
        version: "0.1.0",
      },
      capabilities: {
        experimentalApi: false,
      },
    });

    return this.connectionInfo;
  }

  async startProcess() {
    const port = await findOpenPort();
    const wsUrl = `ws://127.0.0.1:${port}`;
    const connectionInfo = {
      wsUrl,
      readyzUrl: `http://127.0.0.1:${port}/readyz`,
      healthzUrl: `http://127.0.0.1:${port}/healthz`,
    };
    const child = spawn("codex", ["app-server", "--listen", wsUrl], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => {
      this.stdoutBuffer += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      this.stderrBuffer += chunk.toString();
    });

    child.on("error", (error) => {
      this.reset(new Error(error.message));
    });

    child.on("exit", (code, signal) => {
      const message = this.stderrBuffer.trim() || `codex app-server exited (${signal ?? code ?? "unknown"})`;
      this.reset(new Error(message));
    });

    await waitForHealth(connectionInfo.readyzUrl, STARTUP_TIMEOUT_MS);

    return {
      process: child,
      connectionInfo,
    };
  }

  async connect(wsUrl) {
    const deferred = createDeferred();
    const websocket = new WebSocket(wsUrl);

    websocket.addEventListener("open", () => {
      this.websocket = websocket;
      deferred.resolve();
    });

    websocket.addEventListener("message", (event) => {
      this.handleMessage(event.data.toString());
    });

    websocket.addEventListener("error", () => {
      // Close events and explicit request errors are handled elsewhere.
    });

    websocket.addEventListener("close", () => {
      this.reset(new Error("Codex app-server websocket closed."));
    });

    return withTimeout(deferred.promise, REQUEST_TIMEOUT_MS, "Codex app-server websocket connect");
  }

  handleMessage(raw) {
    const message = JSON.parse(raw);

    if (Object.prototype.hasOwnProperty.call(message, "id") && !Object.prototype.hasOwnProperty.call(message, "method")) {
      const pending = this.pendingRequests.get(message.id);
      if (!pending) {
        return;
      }

      this.pendingRequests.delete(message.id);
      clearTimeout(pending.timer);

      if (Object.prototype.hasOwnProperty.call(message, "error")) {
        pending.reject(new Error(message.error?.message ?? "Codex app-server request failed."));
      } else {
        pending.resolve(message.result);
      }

      return;
    }

    if (Object.prototype.hasOwnProperty.call(message, "id") && Object.prototype.hasOwnProperty.call(message, "method")) {
      this.handleServerRequest(message);
      return;
    }

    const method = message.method;
    const params = message.params ?? {};
    const turnKey = turnKeyFromParams(params);
    const pendingTurn = turnKey ? this.pendingTurns.get(turnKey) : null;
    const snapshot = turnKey ? this.ensureTurnSnapshot(turnKey) : null;

    if (method === "item/agentMessage/delta" && snapshot) {
      snapshot.text += params.delta ?? "";
      return;
    }

    if (method === "item/completed" && snapshot && params.item?.type === "agentMessage") {
      snapshot.text = params.item.text ?? snapshot.text;
      return;
    }

    if (method === "turn/completed" && snapshot) {
      snapshot.turn = params.turn;

      if (pendingTurn) {
        this.pendingTurns.delete(turnKey);
        clearTimeout(pendingTurn.timer);
        this.turnSnapshots.delete(turnKey);
        pendingTurn.resolve({
          text: snapshot.text,
          turn: params.turn,
        });
      }

      return;
    }

    if (method === "error" && snapshot) {
      snapshot.error = params.error?.message ?? "Codex app-server turn failed.";

      if (pendingTurn) {
        this.pendingTurns.delete(turnKey);
        clearTimeout(pendingTurn.timer);
        this.turnSnapshots.delete(turnKey);
        pendingTurn.reject(new Error(snapshot.error));
      }
    }
  }

  handleServerRequest(message) {
    try {
      const response = this.serverRequestResponse(message.method, message.params ?? {});
      debugLog("server-request", message.method, JSON.stringify(response));
      this.send({
        jsonrpc: "2.0",
        id: message.id,
        result: response,
      });
    } catch (error) {
      debugLog("server-request-error", message.method, error.message);
      this.send({
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32000,
          message: error.message,
        },
      });
    }
  }

  serverRequestResponse(method, params) {
    switch (method) {
      case "item/commandExecution/requestApproval":
        return { decision: "decline" };
      case "item/fileChange/requestApproval":
        return { decision: "decline" };
      case "item/permissions/requestApproval":
        return { permissions: {}, scope: "turn" };
      case "item/tool/requestUserInput":
        return {
          answers: Object.fromEntries((params.questions ?? []).map((question) => [question.id, { answers: [] }])),
        };
      case "mcpServer/elicitation/request":
        return { action: "decline", content: null, _meta: null };
      case "item/tool/call":
        return {
          success: false,
          contentItems: [
            {
              type: "inputText",
              text: "Dynamic tools are unavailable in the headless course-site Codex client.",
            },
          ],
        };
      case "account/chatgptAuthTokens/refresh":
        throw new Error("Headless Codex app-server client cannot refresh ChatGPT auth tokens.");
      case "applyPatchApproval":
        return { decision: "denied" };
      case "execCommandApproval":
        return { decision: "denied" };
      default:
        throw new Error(`Unsupported Codex app-server request method: ${method}`);
    }
  }

  ensureTurnSnapshot(turnKey) {
    const existing = this.turnSnapshots.get(turnKey);
    if (existing) {
      return existing;
    }

    const created = {
      text: "",
      turn: null,
      error: null,
    };
    this.turnSnapshots.set(turnKey, created);
    return created;
  }

  request(method, params, timeoutMs = REQUEST_TIMEOUT_MS) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Codex app-server websocket is not connected."));
    }

    const id = this.nextRequestId;
    this.nextRequestId += 1;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.send({
        jsonrpc: "2.0",
        id,
        method,
        params,
      });
    });
  }

  send(payload) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      throw new Error("Codex app-server websocket is not connected.");
    }

    this.websocket.send(JSON.stringify(payload));
  }

  waitForTurn(threadId, turnId, timeoutMs) {
    const key = `${threadId}:${turnId}`;
    const snapshot = this.ensureTurnSnapshot(key);

    if (snapshot.error) {
      this.turnSnapshots.delete(key);
      return Promise.reject(new Error(snapshot.error));
    }

    if (snapshot.turn) {
      this.turnSnapshots.delete(key);
      return Promise.resolve({
        text: snapshot.text,
        turn: snapshot.turn,
      });
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingTurns.delete(key);
        this.turnSnapshots.delete(key);
        reject(new Error(`turn ${turnId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingTurns.set(key, {
        resolve,
        reject,
        timer,
      });
    });
  }

  async runJsonTurn({ cwd, effort, model, prompt, schema, timeoutMs }) {
    await this.ensureReady();

    const threadId = await this.startThread({ cwd, model, timeoutMs });
    return this.runJsonTurnOnThread({
      effort,
      model,
      prompt,
      schema,
      threadId,
      timeoutMs,
    });
  }

  async startThread({ cwd, model, timeoutMs }) {
    await this.ensureReady();
    const threadStart = await this.request("thread/start", readOnlyThreadStartParams({ cwd, model }), timeoutMs);
    return threadStart.thread.id;
  }

  async runJsonTurnOnThread({ effort, model, prompt, schema, threadId, timeoutMs }) {
    const turnStart = await this.request(
      "turn/start",
      {
        threadId,
        input: textInput(prompt),
        model,
        effort,
        outputSchema: schema,
      },
      timeoutMs,
    );
    const turnId = turnStart.turn.id;
    const completed = await this.waitForTurn(threadId, turnId, timeoutMs);
    const text = String(completed.text ?? "").trim();

    if (!text) {
      throw new Error("Codex app-server completed without a final agent message.");
    }

    return {
      data: JSON.parse(text),
      threadId: null,
    };
  }

  async warm({ cwd, effort, model, timeoutMs }) {
    if (this.warmPromise) {
      return this.warmPromise;
    }

    this.warmPromise = this.ensureReady().finally(() => {
      this.warmPromise = null;
    });

    return this.warmPromise;
  }
}

const singleton = new CodexAppServerClient();

export function appServerTransportAvailable() {
  return typeof WebSocket === "function";
}

export async function runCodexJsonViaAppServer(options) {
  return singleton.runJsonTurn(options);
}

export async function warmCodexAppServer(options) {
  return singleton.warm(options);
}

export async function startCodexAppThread(options) {
  return singleton.startThread(options);
}

export async function runCodexJsonOnAppThread(options) {
  return singleton.runJsonTurnOnThread(options);
}
