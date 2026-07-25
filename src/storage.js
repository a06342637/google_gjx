const ACCOUNT_KEY = "totpAccounts";
const HISTORY_KEY = "totpHistory";
export const MAX_TOTP_HISTORY = 100;
const THEME_KEY = "theme";

function storageArea() {
  if (!globalThis.chrome?.storage?.local) {
    throw new Error("Chrome 本地存储不可用");
  }
  return chrome.storage.local;
}

function storageGet(keys) {
  return new Promise((resolve, reject) => {
    try {
      storageArea().get(keys, (result) => {
        const error = chrome.runtime?.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(result || {});
      });
    } catch (error) {
      reject(error);
    }
  });
}

function storageSet(values) {
  return new Promise((resolve, reject) => {
    try {
      storageArea().set(values, () => {
        const error = chrome.runtime?.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

function createId() {
  if (typeof crypto?.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const random = new Uint32Array(2);
  crypto.getRandomValues(random);
  return `${Date.now().toString(36)}-${random[0].toString(36)}${random[1].toString(36)}`;
}

function cleanAccount(account) {
  if (!account || typeof account !== "object") return null;
  const name = typeof account.name === "string" ? account.name.trim().slice(0, 48) : "";
  const secret = typeof account.secret === "string" ? account.secret.trim() : "";
  if (!name || !secret) return null;
  return {
    id: typeof account.id === "string" && account.id ? account.id : createId(),
    name,
    secret,
    createdAt: Number.isFinite(account.createdAt) ? account.createdAt : Date.now(),
    updatedAt: Number.isFinite(account.updatedAt) ? account.updatedAt : Date.now()
  };
}

export async function loadTotpAccounts() {
  const data = await storageGet([ACCOUNT_KEY]);
  const raw = Array.isArray(data[ACCOUNT_KEY]) ? data[ACCOUNT_KEY] : [];
  return raw.map(cleanAccount).filter(Boolean);
}

function assertUniqueName(accounts, name, id = null) {
  const normalized = name.trim().toLocaleLowerCase();
  if (accounts.some((account) => account.id !== id && account.name.toLocaleLowerCase() === normalized)) {
    throw new Error("保存名称已存在，请换一个名称");
  }
}

export async function saveTotpAccount(account) {
  const accounts = await loadTotpAccounts();
  const cleaned = cleanAccount(account);
  if (!cleaned) throw new Error("请填写名称和有效密钥");
  assertUniqueName(accounts, cleaned.name);
  accounts.unshift(cleaned);
  await storageSet({ [ACCOUNT_KEY]: accounts });
  return cleaned;
}

export async function updateTotpAccount(id, changes) {
  const accounts = await loadTotpAccounts();
  const index = accounts.findIndex((account) => account.id === id);
  if (index < 0) throw new Error("找不到要编辑的 2FA 项目");
  const next = cleanAccount({ ...accounts[index], ...changes, id, updatedAt: Date.now() });
  if (!next) throw new Error("请填写名称和有效密钥");
  assertUniqueName(accounts, next.name, id);
  accounts[index] = next;
  await storageSet({ [ACCOUNT_KEY]: accounts });
  return next;
}

export async function deleteTotpAccount(id) {
  const accounts = await loadTotpAccounts();
  const next = accounts.filter((account) => account.id !== id);
  await storageSet({ [ACCOUNT_KEY]: next });
  return next;
}

function cleanHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const secret = typeof entry.secret === "string" ? entry.secret.trim() : "";
  if (!secret) return null;
  return {
    id: typeof entry.id === "string" && entry.id ? entry.id : createId(),
    secret,
    enteredAt: Number.isFinite(entry.enteredAt) ? entry.enteredAt : Date.now()
  };
}

export async function loadTotpHistory() {
  const data = await storageGet([HISTORY_KEY]);
  const raw = Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
  const history = raw.map(cleanHistoryEntry).filter(Boolean).slice(0, MAX_TOTP_HISTORY);
  if (history.length !== raw.length) {
    await storageSet({ [HISTORY_KEY]: history });
  }
  return history;
}

export async function recordTotpHistory(secret) {
  const cleanedSecret = typeof secret === "string" ? secret.trim() : "";
  if (!cleanedSecret) throw new Error("历史密钥不能为空");
  const history = await loadTotpHistory();
  const next = [
    { id: createId(), secret: cleanedSecret, enteredAt: Date.now() },
    ...history
  ].slice(0, MAX_TOTP_HISTORY);
  await storageSet({ [HISTORY_KEY]: next });
  return next;
}

export async function deleteTotpHistoryEntry(id) {
  const history = await loadTotpHistory();
  const next = history.filter((entry) => entry.id !== id);
  await storageSet({ [HISTORY_KEY]: next });
  return next;
}

export async function clearTotpHistory() {
  await storageSet({ [HISTORY_KEY]: [] });
  return [];
}

export async function loadTheme() {
  const data = await storageGet([THEME_KEY]);
  return data[THEME_KEY] === "light" || data[THEME_KEY] === "dark" ? data[THEME_KEY] : null;
}

export async function saveTheme(theme) {
  if (theme !== "light" && theme !== "dark") throw new Error("无效的主题");
  await storageSet({ [THEME_KEY]: theme });
}
