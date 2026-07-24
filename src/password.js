export const CHARACTER_SETS = {
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?"
};

export function secureRandomInt(max) {
  if (!Number.isInteger(max) || max <= 0) throw new Error("随机范围无效");
  if (max === 1) return 0;
  const limit = 0x100000000 - (0x100000000 % max);
  const value = new Uint32Array(1);
  do {
    crypto.getRandomValues(value);
  } while (value[0] >= limit);
  return value[0] % max;
}

function shuffle(values) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomInt(index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

export function getEnabledSets(options = {}) {
  const enabled = [];
  if (options.upper !== false) enabled.push(CHARACTER_SETS.upper);
  if (options.lower !== false) enabled.push(CHARACTER_SETS.lower);
  if (options.digits !== false) enabled.push(CHARACTER_SETS.digits);
  if (options.symbols !== false) enabled.push(CHARACTER_SETS.symbols);
  return enabled;
}

export function generatePassword(options = {}) {
  const length = Math.min(36, Math.max(6, Number(options.length) || 16));
  const sets = getEnabledSets(options);
  if (!sets.length) throw new Error("至少选择一种字符类型");

  const pool = sets.join("");
  const result = sets.map((set) => set[secureRandomInt(set.length)]);
  while (result.length < length) {
    result.push(pool[secureRandomInt(pool.length)]);
  }
  return shuffle(result).join("");
}

export function passwordStrength(options = {}) {
  const sets = getEnabledSets(options);
  const length = Math.min(36, Math.max(6, Number(options.length) || 16));
  const entropy = length * Math.log2(Math.max(1, sets.join("").length));
  if (entropy >= 80) return { label: "强密码", tone: "strong" };
  if (entropy >= 55) return { label: "中等强度", tone: "medium" };
  return { label: "较弱密码", tone: "weak" };
}
