import { startCodexAppThread, runCodexJsonOnAppThread, warmCodexAppServer } from "./codex_app_server_client.mjs";

const MAX_HOT_SESSIONS = Number(process.env.PERSONALIZATION_CODEX_MAX_HOT_SESSIONS ?? 5);

function nowMs() {
  return Date.now();
}

function oldestSessionKey(sessions) {
  let oldestKey = null;
  let oldestSeen = Number.POSITIVE_INFINITY;

  for (const [key, session] of sessions.entries()) {
    if (session.lastUsedAt < oldestSeen) {
      oldestSeen = session.lastUsedAt;
      oldestKey = key;
    }
  }

  return oldestKey;
}

class CodexHotSessionManager {
  constructor() {
    this.sessions = new Map();
  }

  getSession(sessionKey) {
    return this.sessions.get(sessionKey) ?? null;
  }

  touch(session) {
    session.lastUsedAt = nowMs();
  }

  allocateSession(sessionKey) {
    if (!this.sessions.has(sessionKey) && this.sessions.size >= MAX_HOT_SESSIONS) {
      const evictedKey = oldestSessionKey(this.sessions);
      if (evictedKey) {
        this.sessions.delete(evictedKey);
      }
    }

    const existing = this.sessions.get(sessionKey);
    if (existing) {
      this.touch(existing);
      return existing;
    }

    const created = {
      threadId: null,
      ready: false,
      warmPromise: null,
      lastError: null,
      turns: 0,
      lastUsedAt: nowMs(),
    };
    this.sessions.set(sessionKey, created);
    return created;
  }

  clear(sessionKey) {
    this.sessions.delete(sessionKey);
  }

  async prime({ cwd, effort, model, sessionKey, warmPrompt, warmSchema, warmTimeoutMs }) {
    const session = this.allocateSession(sessionKey);

    if (session.ready && session.threadId) {
      return session;
    }

    if (session.warmPromise) {
      await session.warmPromise;
      return session;
    }

    session.warmPromise = (async () => {
      await warmCodexAppServer({ cwd, effort, model, timeoutMs: warmTimeoutMs });
      session.threadId = await startCodexAppThread({ cwd, model, timeoutMs: warmTimeoutMs });
      await runCodexJsonOnAppThread({
        threadId: session.threadId,
        effort,
        model,
        prompt: warmPrompt,
        schema: warmSchema,
        timeoutMs: warmTimeoutMs,
      });
      session.ready = true;
      session.lastError = null;
      session.turns += 1;
      this.touch(session);
      return session;
    })();

    try {
      await session.warmPromise;
      return session;
    } catch (error) {
      session.ready = false;
      session.threadId = null;
      session.lastError = error;
      throw error;
    } finally {
      session.warmPromise = null;
    }
  }

  async run({ effort, model, prompt, schema, sessionKey, timeoutMs }) {
    const session = this.sessions.get(sessionKey);
    if (!session?.ready || !session.threadId) {
      throw new Error(`Hot session ${sessionKey} is not ready.`);
    }

    try {
      const result = await runCodexJsonOnAppThread({
        threadId: session.threadId,
        effort,
        model,
        prompt,
        schema,
        timeoutMs,
      });
      session.turns += 1;
      this.touch(session);
      return result;
    } catch (error) {
      session.ready = false;
      session.threadId = null;
      session.lastError = error;
      throw error;
    }
  }
}

const singleton = new CodexHotSessionManager();

export function hotSessionStatus(sessionKey) {
  const session = singleton.getSession(sessionKey);
  if (!session) {
    return null;
  }

  return {
    ready: session.ready,
    turns: session.turns,
    lastError: session.lastError?.message ?? null,
  };
}

export async function primeHotSession(options) {
  return singleton.prime(options);
}

export async function runWithHotSession(options) {
  return singleton.run(options);
}

export function clearHotSession(sessionKey) {
  singleton.clear(sessionKey);
}
