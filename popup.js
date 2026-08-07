import { generateTotp, isValidSecret, normalizeSecret } from "./src/totp.js";
import { generatePassword, passwordStrength } from "./src/password.js";
import { generateBuiltinName, generateUsName } from "./src/names.js";
import {
  clearTotpHistory,
  deleteTotpAccount,
  deleteTotpHistoryEntry,
  loadTheme,
  loadTotpHistory,
  loadTotpAccounts,
  recordTotpHistory,
  saveTheme,
  saveTotpAccount,
  updateTotpAccount
} from "./src/storage.js";

const ICONS = {
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="10" height="10" rx="1.5"></rect><path d="M5.5 15V5.5A1.5 1.5 0 0 1 7 4h9.5"></path></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5.5 4 4M6 18l2.2-.4L18.5 7.3a1.4 1.4 0 0 0 0-2l-.8-.8a1.4 1.4 0 0 0-2 0L5.4 14.8 5 18Z"></path></svg>',
  delete: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M9 7V4.5h6V7M7.5 7l.7 12h7.6l.7-12M10 10.5v5M14 10.5v5"></path></svg>'
};

function buildShareText(secret) {
  return `双重验证码为（验证网站：2fa.vip）：${secret}`;
}

function byId(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`缺少界面元素：${id}`);
  return element;
}

const elements = {
  themeToggle: byId("themeToggle"),
  totpSecret: byId("totpSecret"),
  totpClear: byId("totpClear"),
  totpCodePanel: byId("totpCodePanel"),
  totpCode: byId("totpCode"),
  totpCountdown: byId("totpCountdown"),
  totpProgress: byId("totpProgress"),
  totpCopy: byId("totpCopy"),
  totpName: byId("totpName"),
  totpSave: byId("totpSave"),
  totpCount: byId("totpCount"),
  savedToggle: byId("savedToggle"),
  savedArea: byId("savedArea"),
  savedSearch: byId("savedSearch"),
  totpList: byId("totpList"),
  totpHistoryCount: byId("totpHistoryCount"),
  historyToggle: byId("historyToggle"),
  historyClearAll: byId("historyClearAll"),
  historyArea: byId("historyArea"),
  totpHistoryList: byId("totpHistoryList"),
  passwordValue: byId("passwordValue"),
  passwordStrength: byId("passwordStrength"),
  passwordCopy: byId("passwordCopy"),
  passwordRefresh: byId("passwordRefresh"),
  passwordLength: byId("passwordLength"),
  passwordLengthValue: byId("passwordLengthValue"),
  useUpper: byId("useUpper"),
  useLower: byId("useLower"),
  useDigits: byId("useDigits"),
  useSymbols: byId("useSymbols"),
  nameValue: byId("nameValue"),
  nameSource: byId("nameSource"),
  nameCopy: byId("nameCopy"),
  nameRefresh: byId("nameRefresh"),
  editDialog: byId("editDialog"),
  editForm: byId("editForm"),
  editName: byId("editName"),
  editSecret: byId("editSecret"),
  editCancel: byId("editCancel"),
  editCancelIcon: byId("editCancelIcon"),
  toast: byId("toast")
};

let accounts = [];
let totpHistory = [];
let currentTotp = null;
let currentPassword = "";
let currentName = "";
let currentTheme = "light";
let editingAccountId = null;
let lastAutoCopiedSecret = null;
let totpInputTimer = null;
let toastTimer = null;
let previewRequestId = 0;
let savedCodesRequestId = 0;
let nameRequestId = 0;
let historyWriteQueue = Promise.resolve();

function showToast(message, tone = "normal") {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("is-error", tone === "error");
  elements.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 500);
}

function formatError(error, fallback = "操作失败，请重试") {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function copyText(text, successMessage = "已复制") {
  if (!text) throw new Error("没有可复制的内容");
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("无法访问剪贴板");
  }
  showToast(successMessage);
}

function formatCode(code) {
  return /^\d{6}$/.test(code) ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

function setTheme(theme) {
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  const nextLabel = theme === "dark" ? "切换到浅色模式" : "切换到深色模式";
  elements.themeToggle.setAttribute("aria-label", nextLabel);
  elements.themeToggle.title = nextLabel;
}

async function initializeTheme() {
  let storedTheme = null;
  try {
    storedTheme = await loadTheme();
  } catch {
    // The system preference remains a safe fallback if storage is unavailable.
  }
  const systemTheme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  setTheme(storedTheme || systemTheme);
}

async function toggleTheme() {
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  setTheme(nextTheme);
  try {
    await saveTheme(nextTheme);
  } catch (error) {
    showToast(formatError(error, "主题偏好保存失败"), "error");
  }
}

function resetTotpPreview(message = "——") {
  currentTotp = null;
  elements.totpCode.textContent = message;
  elements.totpCountdown.textContent = "-- 秒";
  elements.totpProgress.style.width = "0%";
  elements.totpCopy.disabled = true;
}

function updateTotpClearVisibility() {
  const hasValue = elements.totpSecret.value.trim().length > 0;
  elements.totpClear.hidden = !hasValue;
}

async function updateTotpPreview({ autoCopy = false, recordHistory = false } = {}) {
  const requestId = ++previewRequestId;
  const rawSecret = elements.totpSecret.value;
  if (!rawSecret.trim()) {
    elements.totpCodePanel.classList.remove("is-invalid");
    resetTotpPreview();
    return;
  }

  try {
    const normalized = normalizeSecret(rawSecret);
    const result = await generateTotp(normalized);
    if (requestId !== previewRequestId || normalizeSecret(elements.totpSecret.value) !== normalized) return;

    currentTotp = { ...result, secret: normalized };
    elements.totpCodePanel.classList.remove("is-invalid");
    elements.totpCode.textContent = formatCode(result.code);
    elements.totpCountdown.textContent = `${result.secondsRemaining} 秒`;
    elements.totpProgress.style.width = `${(result.secondsRemaining / 30) * 100}%`;
    elements.totpCopy.disabled = false;

    if (recordHistory) {
      await rememberTotpHistory(normalized);
    }

    if (autoCopy && lastAutoCopiedSecret !== normalized) {
      lastAutoCopiedSecret = normalized;
      try {
        await copyText(result.code, "验证码已自动复制");
      } catch (error) {
        showToast(formatError(error, "自动复制失败"), "error");
      }
    }
  } catch (error) {
    if (requestId !== previewRequestId) return;
    elements.totpCodePanel.classList.add("is-invalid");
    resetTotpPreview("密钥无效");
    elements.totpCountdown.textContent = formatError(error, "请检查 Base32 密钥");
  }
}

function handleTotpInput() {
  lastAutoCopiedSecret = null;
  updateTotpClearVisibility();
  clearTimeout(totpInputTimer);
  totpInputTimer = setTimeout(() => updateTotpPreview({ autoCopy: true, recordHistory: true }), 240);
}

async function refreshAccounts() {
  accounts = await loadTotpAccounts();
  renderAccountList();
}

function formatHistoryTime(timestamp) {
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return "时间未知";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function renderTotpHistory() {
  elements.totpHistoryCount.textContent = `${totpHistory.length} 条`;
  elements.totpHistoryList.replaceChildren();
  elements.historyToggle.disabled = totpHistory.length === 0;
  elements.historyClearAll.disabled = totpHistory.length === 0;

  if (totpHistory.length === 0) {
    elements.historyArea.classList.add("is-collapsed");
    elements.historyToggle.textContent = "展开";
    elements.historyToggle.setAttribute("aria-expanded", "false");
  }

  for (const entry of totpHistory) {
    const row = document.createElement("div");
    row.className = "history-row";

    const secret = document.createElement("button");
    secret.type = "button";
    secret.className = "history-secret-button monospace";
    secret.dataset.historyAction = "copy";
    secret.dataset.historyId = entry.id;
    secret.textContent = entry.secret;
    secret.title = `点击复制 ${entry.secret}`;
    secret.setAttribute("aria-label", `复制历史 2FA 密钥 ${entry.secret}`);

    const time = document.createElement("time");
    time.className = "history-time";
    time.dateTime = new Date(entry.enteredAt).toISOString();
    time.textContent = formatHistoryTime(entry.enteredAt);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "account-action is-danger history-delete-button";
    deleteButton.dataset.historyAction = "delete";
    deleteButton.dataset.historyId = entry.id;
    deleteButton.setAttribute("aria-label", `删除历史密钥 ${entry.secret}`);
    deleteButton.title = "删除这条历史记录";
    deleteButton.innerHTML = ICONS.delete;

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "account-action history-copy-button";
    copyButton.dataset.historyAction = "copy-share";
    copyButton.dataset.historyId = entry.id;
    copyButton.setAttribute("aria-label", `复制 ${entry.secret} 的双重验证码文案`);
    copyButton.title = buildShareText(entry.secret);
    copyButton.innerHTML = ICONS.copy;

    const actions = document.createElement("div");
    actions.className = "history-actions";
    actions.append(copyButton, deleteButton);

    row.append(secret, time, actions);
    elements.totpHistoryList.append(row);
  }
}

async function refreshTotpHistory() {
  totpHistory = await loadTotpHistory();
  renderTotpHistory();
}

function mutateTotpHistory(operation, fallbackMessage) {
  historyWriteQueue = historyWriteQueue
    .catch(() => {})
    .then(async () => {
      try {
        totpHistory = await operation();
        renderTotpHistory();
        return true;
      } catch (error) {
        showToast(formatError(error, fallbackMessage), "error");
        return false;
      }
    });
  return historyWriteQueue;
}

function rememberTotpHistory(secret) {
  return mutateTotpHistory(() => recordTotpHistory(secret), "2FA 历史保存失败");
}

async function handleHistoryAction(event) {
  const button = event.target.closest("button[data-history-action]");
  if (!button) return;
  const entry = totpHistory.find((item) => item.id === button.dataset.historyId);
  if (!entry) return;

  if (button.dataset.historyAction === "copy-share") {
    try {
      await copyText(buildShareText(entry.secret), "双重验证码文案已复制");
    } catch (error) {
      showToast(formatError(error, "双重验证码文案复制失败"), "error");
    }
    return;
  }

  if (button.dataset.historyAction === "copy") {
    try {
      await copyText(entry.secret, "2FA 密钥已复制");
    } catch (error) {
      showToast(formatError(error, "2FA 密钥复制失败"), "error");
    }
    return;
  }

  if (button.dataset.historyAction === "delete") {
    const deleted = await mutateTotpHistory(
      () => deleteTotpHistoryEntry(entry.id),
      "历史记录删除失败"
    );
    if (deleted) showToast("历史记录已删除");
  }
}

async function clearAllTotpHistory() {
  if (!totpHistory.length) return;
  const confirmed = window.confirm("确定清空全部 2FA 历史记录吗？此操作无法撤销。");
  if (!confirmed) return;
  const cleared = await mutateTotpHistory(clearTotpHistory, "2FA 历史清空失败");
  if (cleared) showToast("2FA 历史已清空");
}

function filteredAccounts() {
  const query = elements.savedSearch.value.trim().toLocaleLowerCase();
  if (!query) return accounts;
  return accounts.filter((account) => account.name.toLocaleLowerCase().includes(query));
}

function actionButton(action, label, icon, danger = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `account-action${danger ? " is-danger" : ""}`;
  button.dataset.action = action;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = icon;
  return button;
}

function renderAccountList() {
  elements.totpCount.textContent = `${accounts.length} 项`;
  const visibleAccounts = filteredAccounts();
  elements.totpList.replaceChildren();

  if (!visibleAccounts.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = accounts.length ? "没有找到匹配的名称" : "还没有保存的 2FA 项目";
    elements.totpList.append(empty);
    return;
  }

  for (const account of visibleAccounts) {
    const row = document.createElement("div");
    row.className = "account-row";
    row.dataset.accountId = account.id;

    const details = document.createElement("div");
    const name = document.createElement("div");
    name.className = "account-name";
    name.textContent = account.name;
    name.title = account.name;

    const codeLine = document.createElement("div");
    codeLine.className = "account-code-line";
    const code = document.createElement("span");
    code.className = "account-code monospace";
    code.dataset.role = "code";
    code.textContent = "——";
    const seconds = document.createElement("span");
    seconds.className = "account-seconds";
    seconds.dataset.role = "seconds";
    seconds.textContent = "-- 秒";
    codeLine.append(code, seconds);
    details.append(name, codeLine);

    const actions = document.createElement("div");
    actions.className = "account-actions";
    const copyButton = actionButton("copy", `复制 ${account.name} 的验证码`, ICONS.copy);
    copyButton.dataset.accountId = account.id;
    const editButton = actionButton("edit", `编辑 ${account.name}`, ICONS.edit);
    editButton.dataset.accountId = account.id;
    const deleteButton = actionButton("delete", `删除 ${account.name}`, ICONS.delete, true);
    deleteButton.dataset.accountId = account.id;
    actions.append(copyButton, editButton, deleteButton);

    row.append(details, actions);
    elements.totpList.append(row);
  }

  updateSavedAccountCodes();
}

async function updateSavedAccountCodes() {
  const requestId = ++savedCodesRequestId;
  const rows = [...elements.totpList.querySelectorAll(".account-row")];
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const results = await Promise.all(rows.map(async (row) => {
    const account = accountMap.get(row.dataset.accountId);
    if (!account) return { row, result: null };
    try {
      return { row, result: await generateTotp(account.secret) };
    } catch {
      return { row, result: null };
    }
  }));
  if (requestId !== savedCodesRequestId) return;

  for (const { row, result } of results) {
    const code = row.querySelector('[data-role="code"]');
    const seconds = row.querySelector('[data-role="seconds"]');
    if (!code || !seconds) continue;
    code.textContent = result ? formatCode(result.code) : "密钥无效";
    seconds.textContent = result ? `${result.secondsRemaining} 秒` : "";
  }
}

async function saveCurrentTotp() {
  const name = elements.totpName.value.trim();
  const secret = normalizeSecret(elements.totpSecret.value);
  if (!name) {
    elements.totpName.focus();
    showToast("请先填写保存名称", "error");
    return;
  }
  if (!isValidSecret(secret)) {
    elements.totpSecret.focus();
    showToast("请填写有效的 Base32 密钥", "error");
    return;
  }

  elements.totpSave.disabled = true;
  try {
    await saveTotpAccount({ name, secret });
    elements.totpName.value = "";
    await refreshAccounts();
    showToast("2FA 已保存到本机");
  } catch (error) {
    showToast(formatError(error), "error");
  } finally {
    elements.totpSave.disabled = false;
  }
}

async function handleAccountAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const account = accounts.find((item) => item.id === button.dataset.accountId);
  if (!account) return;

  if (button.dataset.action === "copy") {
    try {
      const result = await generateTotp(account.secret);
      await copyText(result.code, `${account.name} 验证码已复制`);
    } catch (error) {
      showToast(formatError(error, "验证码复制失败"), "error");
    }
    return;
  }

  if (button.dataset.action === "edit") {
    editingAccountId = account.id;
    elements.editName.value = account.name;
    elements.editSecret.value = account.secret;
    elements.editDialog.showModal();
    elements.editName.focus();
    return;
  }

  if (button.dataset.action === "delete") {
    const confirmed = window.confirm(`确定删除“${account.name}”吗？`);
    if (!confirmed) return;
    try {
      await deleteTotpAccount(account.id);
      await refreshAccounts();
      showToast("2FA 项目已删除");
    } catch (error) {
      showToast(formatError(error), "error");
    }
  }
}

async function submitAccountEdit(event) {
  event.preventDefault();
  if (!editingAccountId) return;
  const name = elements.editName.value.trim();
  const secret = normalizeSecret(elements.editSecret.value);
  if (!name) {
    elements.editName.focus();
    showToast("名称不能为空", "error");
    return;
  }
  if (!isValidSecret(secret)) {
    elements.editSecret.focus();
    showToast("请输入有效的 Base32 密钥", "error");
    return;
  }

  try {
    await updateTotpAccount(editingAccountId, { name, secret });
    editingAccountId = null;
    elements.editDialog.close();
    await refreshAccounts();
    showToast("2FA 项目已更新");
  } catch (error) {
    showToast(formatError(error), "error");
  }
}

function closeEditDialog() {
  editingAccountId = null;
  elements.editDialog.close();
}

function passwordOptions() {
  return {
    length: Number(elements.passwordLength.value),
    upper: elements.useUpper.checked,
    lower: elements.useLower.checked,
    digits: elements.useDigits.checked,
    symbols: elements.useSymbols.checked
  };
}

function refreshPassword() {
  const options = passwordOptions();
  try {
    currentPassword = generatePassword(options);
    elements.passwordValue.textContent = currentPassword;
    const strength = passwordStrength(options);
    elements.passwordStrength.textContent = strength.label;
    elements.passwordStrength.dataset.tone = strength.tone;
  } catch (error) {
    showToast(formatError(error), "error");
  }
}

function handlePasswordToggle(event) {
  const toggles = [elements.useUpper, elements.useLower, elements.useDigits, elements.useSymbols];
  if (!toggles.some((toggle) => toggle.checked)) {
    event.target.checked = true;
    showToast("至少保留一种字符类型", "error");
    return;
  }
  refreshPassword();
}

function showInitialName() {
  const result = generateBuiltinName();
  currentName = result.fullName;
  elements.nameValue.textContent = currentName;
  elements.nameSource.textContent = "混合词库";
  elements.nameCopy.disabled = false;
}

async function refreshName() {
  const requestId = ++nameRequestId;
  elements.nameRefresh.disabled = true;
  elements.nameCopy.disabled = true;
  elements.nameValue.textContent = "正在生成…";
  elements.nameSource.textContent = "混合词库";
  try {
    const result = await generateUsName();
    if (requestId !== nameRequestId) return;
    currentName = result.fullName;
    elements.nameValue.textContent = currentName;
    elements.nameSource.textContent = "混合词库";
    elements.nameCopy.disabled = false;
  } catch (error) {
    if (requestId !== nameRequestId) return;
    currentName = "";
    elements.nameValue.textContent = "生成失败";
    elements.nameSource.textContent = "混合词库";
    showToast(formatError(error, "姓名生成失败"), "error");
  } finally {
    if (requestId === nameRequestId) elements.nameRefresh.disabled = false;
  }
}

function bindEvents() {
  elements.themeToggle.addEventListener("click", toggleTheme);
  elements.totpSecret.addEventListener("input", handleTotpInput);
  elements.totpSecret.addEventListener("keydown", (event) => {
    if (event.key === "Enter") updateTotpPreview({ autoCopy: true, recordHistory: true });
  });
  elements.totpClear.addEventListener("click", () => {
    elements.totpSecret.value = "";
    updateTotpClearVisibility();
    lastAutoCopiedSecret = null;
    elements.totpCodePanel.classList.remove("is-invalid");
    resetTotpPreview();
    elements.totpSecret.focus();
  });
  elements.totpCopy.addEventListener("click", async () => {
    if (!currentTotp) return;
    try {
      await copyText(currentTotp.code, "验证码已复制");
    } catch (error) {
      showToast(formatError(error), "error");
    }
  });
  elements.totpSave.addEventListener("click", saveCurrentTotp);
  elements.totpName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveCurrentTotp();
  });
  elements.savedToggle.addEventListener("click", () => {
    const collapsed = elements.savedArea.classList.toggle("is-collapsed");
    elements.savedToggle.textContent = collapsed ? "展开" : "收起";
    elements.savedToggle.setAttribute("aria-expanded", String(!collapsed));
  });
  elements.historyToggle.addEventListener("click", () => {
    const collapsed = elements.historyArea.classList.toggle("is-collapsed");
    elements.historyToggle.textContent = collapsed ? "展开" : "收起";
    elements.historyToggle.setAttribute("aria-expanded", String(!collapsed));
  });
  elements.historyClearAll.addEventListener("click", clearAllTotpHistory);
  elements.totpHistoryList.addEventListener("click", handleHistoryAction);
  elements.savedSearch.addEventListener("input", renderAccountList);
  elements.totpList.addEventListener("click", handleAccountAction);
  elements.editForm.addEventListener("submit", submitAccountEdit);
  elements.editCancel.addEventListener("click", closeEditDialog);
  elements.editCancelIcon.addEventListener("click", closeEditDialog);
  elements.editDialog.addEventListener("close", () => {
    editingAccountId = null;
  });

  elements.passwordLength.addEventListener("input", () => {
    elements.passwordLengthValue.value = elements.passwordLength.value;
    elements.passwordLengthValue.textContent = elements.passwordLength.value;
    refreshPassword();
  });
  for (const toggle of [elements.useUpper, elements.useLower, elements.useDigits, elements.useSymbols]) {
    toggle.addEventListener("change", handlePasswordToggle);
  }
  elements.passwordRefresh.addEventListener("click", refreshPassword);
  elements.passwordCopy.addEventListener("click", async () => {
    try {
      await copyText(currentPassword, "密码已复制");
    } catch (error) {
      showToast(formatError(error), "error");
    }
  });

  elements.nameRefresh.addEventListener("click", refreshName);
  elements.nameCopy.addEventListener("click", async () => {
    try {
      await copyText(currentName, "姓名已复制");
    } catch (error) {
      showToast(formatError(error), "error");
    }
  });
}

async function initialize() {
  showInitialName();
  refreshPassword();
  await initializeTheme();
  bindEvents();
  updateTotpClearVisibility();
  try {
    await refreshAccounts();
  } catch (error) {
    showToast(formatError(error, "读取本地 2FA 失败"), "error");
    renderAccountList();
  }
  try {
    await refreshTotpHistory();
  } catch (error) {
    totpHistory = [];
    renderTotpHistory();
    showToast(formatError(error, "读取 2FA 历史失败"), "error");
  }
  setInterval(() => {
    updateTotpPreview();
    updateSavedAccountCodes();
  }, 1000);
}

initialize().catch((error) => {
  showToast(formatError(error, "插件初始化失败"), "error");
});
