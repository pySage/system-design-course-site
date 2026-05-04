import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { MAX_USERS } from "./personalization_catalog.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const LEARNER_ACCOUNTS_PATH = resolve(REPO_ROOT, "runtime/private/learner_accounts.json");

function requiredString(account, field, index) {
  const value = account?.[field];

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid learner account at index ${index}: missing non-empty ${field}.`);
  }

  return value.trim();
}

function normalizeAccount(account, index) {
  return {
    id: requiredString(account, "id", index),
    name: requiredString(account, "name", index),
    username: requiredString(account, "username", index).toLowerCase(),
    password: requiredString(account, "password", index),
  };
}

function readAccountsFile() {
  if (!existsSync(LEARNER_ACCOUNTS_PATH)) {
    return [];
  }

  const parsed = JSON.parse(readFileSync(LEARNER_ACCOUNTS_PATH, "utf8"));
  const rawAccounts = Array.isArray(parsed) ? parsed : parsed.users;

  if (!Array.isArray(rawAccounts)) {
    throw new Error(`Learner account config must be an array or an object with a users array: ${LEARNER_ACCOUNTS_PATH}`);
  }

  return rawAccounts.map(normalizeAccount);
}

export const LEARNER_ACCOUNTS = readAccountsFile();

if (LEARNER_ACCOUNTS.length > MAX_USERS) {
  throw new Error(`Configured ${LEARNER_ACCOUNTS.length} learner accounts, but MAX_USERS is ${MAX_USERS}.`);
}

export function findAccountByCredentials(username, password) {
  const normalizedUsername = String(username ?? "").trim().toLowerCase();
  const rawPassword = String(password ?? "");

  if (!normalizedUsername || !rawPassword) {
    return null;
  }

  return (
    LEARNER_ACCOUNTS.find(
      (account) => account.username.toLowerCase() === normalizedUsername && account.password === rawPassword,
    ) ?? null
  );
}

export function findAccountById(accountId) {
  return LEARNER_ACCOUNTS.find((account) => account.id === accountId) ?? null;
}
