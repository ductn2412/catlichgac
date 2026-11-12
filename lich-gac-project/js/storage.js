let S = {
  officers: "",
  soldiers: "",
  teams: JSON.parse(JSON.stringify(DEFAULT_TEAMS)),
  days: {},
  swapRequests: [],
  accounts: { ...DEFAULT_COMMANDER_ACCOUNTS },
  personnelAccounts: [],
  // Danh sách đồng chí chỉ làm ca đêm (VD: đang học tập buổi sáng)
  nightOnly: "",
  // Sổ bàn giao trực ban: { "YYYY-MM-DD": [ { id, ca, from, to, content, status, createdAt, createdBy } ] }
  handoverNotes: {},
  // Chế độ cảnh báo & mượn quân số tạm thời giữa các Tổ
  borrowRules: { enabled: true, maxAbsentSoldiers: 3, maxConsecutiveDays: 5 }
};

// ===== SAO LƯU TỰ ĐỘNG (SNAPSHOT) =====
const SNAPSHOT_KEY = KEY + "-snapshots";
const MAX_SNAPSHOTS = 10;

// ===== PHIÊN ĐĂNG NHẬP =====
const SESSION_KEY = "lich-gac-session-at";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 phút không hoạt động

const DEFAULT_BORROW_RULES = { enabled: true, maxAbsentSoldiers: 3, maxConsecutiveDays: 5 };

function clampInt(v, min, max, dflt) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}

// Chuẩn hóa cấu hình cảnh báo / mượn quân số (luôn có đủ 3 trường)
function normalizeBorrowRules() {
  const r = S.borrowRules || {};
  S.borrowRules = {
    enabled: r.enabled !== false,
    maxAbsentSoldiers: clampInt(r.maxAbsentSoldiers, 0, 30, DEFAULT_BORROW_RULES.maxAbsentSoldiers),
    maxConsecutiveDays: clampInt(r.maxConsecutiveDays, 1, 60, DEFAULT_BORROW_RULES.maxConsecutiveDays)
  };
  return S.borrowRules;
}

function getBorrowRules() {
  if (!S.borrowRules) normalizeBorrowRules();
  return normalizeBorrowRules();
}

function pad(n) { return (n < 10 ? "0" : "") + n; }
function fmtDate(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function parseDate(s) { const p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
function addDay(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); }
function vnFormat(s) { if (!s) return ""; const p = s.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }

function parseNames(t) {
  const seen = {}, o = [];
  (t || "").split(/[\n,;]+/).forEach(x => {
    x = x.trim();
    if (x && !seen[x]) { seen[x] = 1; o.push(x); }
  });
  return o;
}

function cleanName(n) {
  if (!n) return "";
  return n.replace(/\s*\(.*\)\s*$/, "").trim();
}

function extractCode(n) {
  if (!n) return "Chưa cấp";
  const m = n.match(/\(([^)]+)\)/);
  return m ? m[1].trim() : "Chưa cấp";
}

function formatFullAccountName(fullName, code) {
  const c = (code || "").trim();
  const fn = cleanName(fullName);
  return c && c !== "Chưa cấp" ? `${fn} (${c})` : fn;
}

// ===== ESCAPE HTML DÙNG CHUNG (CHỐNG XSS) =====
function escHTML(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

// ===== BĂM MẬT KHẨU (SHA-256 + SALT, CHẠY ĐƯỢC CẢ KHI MỞ BẰNG file://) =====
const PASSWORD_SCHEME = "sha256";
const PASSWORD_ITERATIONS = 1000;

function sha256Hex(input) {
  const str = unescape(encodeURIComponent(String(input == null ? "" : input)));
  const bytes = [];
  for (let i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i) & 0xff);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  bytes.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
  bytes.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const rotr = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  for (let off = 0; off < bytes.length; off += 64) {
    const w = new Array(64);
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4;
      w[i] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) | 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = (rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)) >>> 0;
      const s1 = (rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e;
      e = (d + t1) | 0;
      d = c; c = b; b = a;
      a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0;
    H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0;
    H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0;
    H[7] = (H[7] + h) | 0;
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

function hashPassword(plain, salt, iterations) {
  const rounds = Math.max(1, parseInt(iterations, 10) || PASSWORD_ITERATIONS);
  let h = sha256Hex(String(salt || "") + "\u0000" + String(plain || ""));
  for (let i = 0; i < rounds; i++) h = sha256Hex(h + "\u0000" + String(salt || ""));
  return h;
}

function randomSalt() {
  const chars = "abcdef0123456789";
  let s = "";
  try {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    for (let i = 0; i < arr.length; i++) s += chars[arr[i] % chars.length];
  } catch (e) {
    for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s || String(Date.now());
}

function makePasswordRecord(plain) {
  const salt = randomSalt();
  return `${PASSWORD_SCHEME}$${PASSWORD_ITERATIONS}$${salt}$${hashPassword(plain, salt, PASSWORD_ITERATIONS)}`;
}

function verifyPasswordRecord(stored, plain) {
  if (typeof stored !== "string" || !stored) return false;
  if (stored.indexOf(PASSWORD_SCHEME + "$") !== 0) return stored === String(plain == null ? "" : plain);
  const parts = stored.split("$");
  if (parts.length !== 4) return false;
  const iterations = parseInt(parts[1], 10) || PASSWORD_ITERATIONS;
  return hashPassword(plain, parts[2], iterations) === parts[3];
}

// Gán mật khẩu mới cho 1 hồ sơ quân nhân (chỉ lưu bản băm, không lưu plaintext)
function setAccountPassword(acc, plain) {
  if (!acc) return;
  const pw = String(plain == null ? "" : plain);
  const salt = randomSalt();
  acc.passwordSalt = salt;
  acc.passwordIterations = PASSWORD_ITERATIONS;
  acc.passwordHash = hashPassword(pw, salt, PASSWORD_ITERATIONS);
  delete acc.password;
}

function verifyAccountPassword(acc, plain) {
  if (!acc) return false;
  if (acc.passwordHash) {
    const iterations = parseInt(acc.passwordIterations, 10) || PASSWORD_ITERATIONS;
    return hashPassword(plain, acc.passwordSalt || "", iterations) === acc.passwordHash;
  }
  // Tương thích dữ liệu cũ còn lưu plaintext
  if (acc.password != null) return String(acc.password).trim() === String(plain == null ? "" : plain).trim();
  return String(plain == null ? "" : plain).trim() === "1";
}

function copyCredentialFields(target, prev) {
  if (!target || !prev) return;
  if (prev.passwordHash) {
    target.passwordHash = prev.passwordHash;
    target.passwordSalt = prev.passwordSalt;
    target.passwordIterations = prev.passwordIterations;
  } else if (prev.password != null) {
    target.password = prev.password;
  }
  if (prev.mustChangePassword) target.mustChangePassword = true;
}

// Nâng cấp toàn bộ mật khẩu plaintext cũ sang bản băm (chạy 1 lần khi tải dữ liệu)
function migrateLegacyPasswords() {
  let changed = false;
  (S.personnelAccounts || []).forEach(acc => {
    if (!acc.passwordHash && acc.password != null) {
      setAccountPassword(acc, acc.password);
      changed = true;
    }
  });
  if (!S.accounts || typeof S.accounts !== "object") {
    S.accounts = { ...DEFAULT_COMMANDER_ACCOUNTS };
    changed = true;
  }
  Object.keys(S.accounts).forEach(u => {
    const v = S.accounts[u];
    if (typeof v === "string" && v.indexOf(PASSWORD_SCHEME + "$") !== 0) {
      S.accounts[u] = makePasswordRecord(v);
      changed = true;
    }
  });
  return changed;
}

// Cấp mã kế tiếp không trùng với bất kỳ mã nào đã dùng
function nextAvailableCode(prefix, usedCodes) {
  let max = 0;
  const re = new RegExp("^" + prefix + "(\\d+)$", "i");
  (usedCodes || []).forEach(code => {
    const m = re.exec(String(code || "").trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return prefix + pad(max + 1);
}

// Đồng bộ từ 4 Tổ (S.teams) sang S.officers, S.soldiers và S.personnelAccounts
// Trả về số mã số bị trùng đã được cấp lại tự động.
function syncFromTeamsToRosterAndAccounts() {
  if (!S.teams || !Array.isArray(S.teams) || S.teams.length < 4) {
    S.teams = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
  }
  S.personnelAccounts = Array.isArray(S.personnelAccounts) ? S.personnelAccounts : [];

  const allOff = [];
  const allSol = [];
  const existingMap = {};
  S.personnelAccounts.forEach(a => {
    const key = cleanName(a.fullName).toLowerCase();
    if (key) existingMap[key] = a;
  });

  // Tên đang có trong 4 Tổ: mã của những người này được giữ lại cho chính họ.
  // Mã của hồ sơ đã bị rút khỏi Tổ vẫn được giữ chỗ để không cấp trùng về sau.
  const teamNameSet = new Set();
  S.teams.forEach(team => {
    [...(team.officers || []), ...(team.soldiers || [])].forEach(raw => {
      const fn = cleanName(raw);
      if (fn) teamNameSet.add(fn.toLowerCase());
    });
  });
  const usedCodes = new Set();
  S.personnelAccounts.forEach(a => {
    const key = cleanName(a.fullName).toLowerCase();
    if (!teamNameSet.has(key) && a.code && a.code !== "Chưa cấp") {
      usedCodes.add(String(a.code).trim().toLowerCase());
    }
  });

  let duplicatesFixed = 0;
  function reserveCode(rawName, prev, prefix) {
    const rawCd = extractCode(rawName);
    const prevCd = prev && prev.code ? String(prev.code).trim() : "";
    let cd = (rawCd && rawCd !== "Chưa cấp") ? rawCd.trim() : "";
    if (!cd && prevCd && prevCd !== "Chưa cấp") cd = prevCd;
    if (cd && !usedCodes.has(cd.toLowerCase())) {
      usedCodes.add(cd.toLowerCase());
      return cd;
    }
    if (rawCd && rawCd !== "Chưa cấp") duplicatesFixed++;
    let next = nextAvailableCode(prefix, Array.from(usedCodes));
    while (usedCodes.has(next.toLowerCase())) {
      next = prefix + pad(parseInt(next.slice(prefix.length), 10) + 1);
    }
    usedCodes.add(next.toLowerCase());
    return next;
  }

  function buildAccount(prev, fn, cd, roleType, teamId, defaultPosition, defaultDob, defaultHome) {
    const acc = prev ? { ...prev } : { id: Date.now() + Math.random() };
    acc.fullName = fn;
    acc.code = cd;
    acc.roleType = roleType;
    acc.teamId = teamId;
    acc.position = prev && prev.position ? prev.position : defaultPosition;
    acc.username = prev && prev.username ? prev.username : formatFullAccountName(fn, cd);
    acc.dob = prev && prev.dob ? prev.dob : defaultDob;
    acc.hometown = prev && prev.hometown ? prev.hometown : defaultHome;
    acc.active = true;
    if (prev) {
      copyCredentialFields(acc, prev);
      // Hồ sơ cũ thiếu thông tin đăng nhập: cấp mật khẩu mặc định để không bị khóa
      if (!acc.passwordHash && acc.password == null) setAccountPassword(acc, "1");
    } else {
      setAccountPassword(acc, "1");
    }
    return acc;
  }

  const updatedAccounts = [];

  S.teams.forEach((team, tIdx) => {
    const teamId = tIdx + 1;
    (team.officers || []).forEach(rawName => {
      const fn = cleanName(rawName);
      if (!fn) return;
      const prev = existingMap[fn.toLowerCase()];
      const cd = reserveCode(rawName, prev, "SQ");
      const label = formatFullAccountName(fn, cd);
      if (!allOff.includes(label)) allOff.push(label);
      updatedAccounts.push(buildAccount(prev, fn, cd, "officer", teamId, `Đốc gác - Tổ ${teamId}`, "1994-05-19", "Hà Nội"));
    });

    (team.soldiers || []).forEach(rawName => {
      const fn = cleanName(rawName);
      if (!fn) return;
      const prev = existingMap[fn.toLowerCase()];
      const cd = reserveCode(rawName, prev, "CS");
      const label = formatFullAccountName(fn, cd);
      if (!allSol.includes(label)) allSol.push(label);
      updatedAccounts.push(buildAccount(prev, fn, cd, "soldier", teamId, `Chiến sĩ Vọng gác - Tổ ${teamId}`, "2004-09-02", "Hải Dương"));
    });

    // Chuẩn hóa lại mảng tên có mã số trong team
    team.officers = (team.officers || []).map(n => {
      const acc = updatedAccounts.find(a => cleanName(a.fullName).toLowerCase() === cleanName(n).toLowerCase());
      return acc ? formatFullAccountName(acc.fullName, acc.code) : n;
    });
    team.soldiers = (team.soldiers || []).map(n => {
      const acc = updatedAccounts.find(a => cleanName(a.fullName).toLowerCase() === cleanName(n).toLowerCase());
      return acc ? formatFullAccountName(acc.fullName, acc.code) : n;
    });
  });

  // Không xóa ngay hồ sơ đã rút khỏi textarea: đánh dấu ngừng hoạt động.
  // Chỉ Chỉ huy bấm "Xóa" ở trang Quản lý tài khoản mới xóa hẳn.
  const activeNames = new Set(updatedAccounts.map(a => cleanName(a.fullName).toLowerCase()));
  S.personnelAccounts.forEach(a => {
    const key = cleanName(a.fullName).toLowerCase();
    if (!key || activeNames.has(key)) return;
    activeNames.add(key);
    updatedAccounts.push({ ...a, active: false });
  });

  S.officers = allOff.join("\n");
  S.soldiers = allSol.join("\n");
  S.personnelAccounts = updatedAccounts;
  return duplicatesFixed;
}

// Đồng bộ từ S.personnelAccounts ngược về S.teams và S.officers/S.soldiers
function syncRosterStringsFromAccounts() {
  if (!S.personnelAccounts || !Array.isArray(S.personnelAccounts)) return;
  if (!S.teams || S.teams.length < 4) {
    S.teams = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
  }
  for (let i = 0; i < 4; i++) {
    S.teams[i].officers = [];
    S.teams[i].soldiers = [];
  }

  const offList = [];
  const solList = [];
  S.personnelAccounts.forEach(acc => {
    if (acc.active === false) return; // hồ sơ đã ngừng hoạt động: không đưa lại vào Tổ
    const label = formatFullAccountName(acc.fullName, acc.code);
    const tIdx = Math.min(3, Math.max(0, (parseInt(acc.teamId, 10) || 1) - 1));
    if (acc.roleType === "officer") {
      if (!offList.includes(label)) offList.push(label);
      if (!S.teams[tIdx].officers.includes(label)) S.teams[tIdx].officers.push(label);
    } else {
      if (!solList.includes(label)) solList.push(label);
      if (!S.teams[tIdx].soldiers.includes(label)) S.teams[tIdx].soldiers.push(label);
    }
  });
  S.officers = offList.join("\n");
  S.soldiers = solList.join("\n");
}

function syncAccountsFromRosterStrings() {
  syncFromTeamsToRosterAndAccounts();
}

// Tra cứu một quân nhân thuộc Tổ mấy (1..4)
function getPersonTeamId(personName) {
  const cName = cleanName(personName).toLowerCase();
  if (!cName) return null;
  if (S.teams && Array.isArray(S.teams)) {
    for (let i = 0; i < S.teams.length; i++) {
      const t = S.teams[i];
      if ((t.officers || []).some(n => cleanName(n).toLowerCase() === cName)) return i + 1;
      if ((t.soldiers || []).some(n => cleanName(n).toLowerCase() === cName)) return i + 1;
    }
  }
  const acc = (S.personnelAccounts || []).find(a => cleanName(a.fullName).toLowerCase() === cName);
  return acc ? (acc.teamId || 1) : null;
}

function absSet(a) {
  const s = {};
  if (!a) return s;
  CATS.forEach(c => {
    parseNames(a[c[0]]).forEach(n => {
      s[cleanName(n)] = c[2];
      s[n.trim()] = c[2];
    });
  });
  return s;
}

// Kiểm tra một người có đang vắng mặt trong ngày hay không
function isPersonAbsentIn(ab, person) {
  const n = (person || "").trim();
  if (!n) return false;
  return !!(ab[cleanName(n)] || ab[n]);
}

function workSet(day) {
  const s = {};
  if (!day || !day.cells) return s;
  day.cells.forEach(n => {
    n = (n || "").trim();
    if (n) { s[cleanName(n)] = 1; s[n] = 1; }
  });
  return s;
}

function toSet(a) {
  const s = {};
  a.forEach(n => { s[cleanName(n)] = 1; s[n.trim()] = 1; });
  return s;
}

function seedDefaultDataIfEmpty() {
  const todayStr = fmtDate(new Date());
  if (!S.days || Object.keys(S.days).length === 0) {
    S.teams = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
    syncFromTeamsToRosterAndAccounts();

    // Ngày 1 mặc định:
    // Ca 1 = Tổ 1 (Đốc gác 1: Nguyễn Xuân Vũ, x9..x12: 4 chiến sĩ đầu của Tổ 1)
    // Ca 2 = Tổ 2 (Đốc gác 1: Ứng Đình Dũng, x9..x12: 4 chiến sĩ đầu của Tổ 2)
    // Ca 3 = Tổ 3 (Đốc gác 1: Nguyễn Văn Thụ, x9..x12: 4 chiến sĩ đầu của Tổ 3)
    // Ca 4 = Tổ 4 (Đốc gác 1: Nguyễn Thanh Thủy, x9..x12: 4 chiến sĩ đầu của Tổ 4)
    const cells60 = Array(60).fill("");
    for (let ca = 0; ca < 4; ca++) {
      const team = S.teams[ca];
      const docGac = team.officers[0] || "";
      const vongs = team.soldiers.slice(0, 4);
      for (let slot = 0; slot < 3; slot++) {
        const row = ca * 3 + slot;
        cells60[row * 5 + 0] = docGac;
        for (let c = 1; c < 5; c++) {
          cells60[row * 5 + c] = vongs[c - 1] || "";
        }
      }
    }

    S.days[todayStr] = {
      cells: cells60,
      teamInCa: [1, 2, 3, 4], // Ca 1: Tổ 1, Ca 2: Tổ 2, Ca 3: Tổ 3, Ca 4: Tổ 4
      absent: {
        phep: "",
        congtac: "",
        om: "",
        om_tai_vien: "",
        nghibu: "",
        hoctap: "",
        khac: ""
      },
      streaks: {},
      manualCredits: {}
    };
    saveStorage();
  } else {
    if (!S.teams || S.teams.length < 4) {
      S.teams = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
    }
    syncFromTeamsToRosterAndAccounts();
    saveStorage();
  }
}

function loadStorage() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && raw.days) {
      S = raw;
      if (!S.swapRequests) S.swapRequests = [];
      if (!S.accounts) S.accounts = { ...DEFAULT_COMMANDER_ACCOUNTS };
      if (!S.personnelAccounts) S.personnelAccounts = [];
      if (typeof S.nightOnly !== "string") S.nightOnly = "";
      if (!S.handoverNotes || typeof S.handoverNotes !== "object" || Array.isArray(S.handoverNotes)) S.handoverNotes = {};
      normalizeBorrowRules();
      if (!S.teams || S.teams.length < 4) S.teams = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
    }
  } catch (e) {
    console.error("Lỗi khi tải localStorage:", e);
  }
  seedDefaultDataIfEmpty();
  if (migrateLegacyPasswords()) saveStorage();
}

function saveStorage() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {
    console.error("Lỗi khi lưu localStorage:", e);
  }
}

// ==================== SAO LƯU TỰ ĐỘNG (SNAPSHOT) ====================
function readSnapshots() {
  try {
    const list = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || "[]");
    if (!Array.isArray(list)) return [];
    return list.filter(x => x && typeof x.id === "string" && typeof x.data === "string");
  } catch (e) {
    return [];
  }
}

function writeSnapshots(list) {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    console.error("Lỗi khi ghi bản sao lưu:", e);
    return false;
  }
}

// Tạo bản sao lưu trước các thao tác quan trọng (cắt lịch, khôi phục, sửa biên chế).
function createSnapshot(reason) {
  try {
    const data = JSON.stringify(S);
    const list = readSnapshots();
    if (list.length && list[0].data === data) return { ok: true, skipped: true };
    const item = {
      id: "snap_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6),
      time: new Date().toISOString(),
      reason: reason || "Tự động",
      size: data.length,
      data: data
    };
    list.unshift(item);
    const totalSize = () => list.reduce((sum, x) => sum + (x.size || (x.data || "").length), 0);
    while (list.length > MAX_SNAPSHOTS || (list.length > 1 && totalSize() > 3500000)) list.pop();
    if (!writeSnapshots(list)) return { ok: false, error: "Không ghi được bản sao lưu (bộ nhớ đầy)." };
    return { ok: true, id: item.id };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function listSnapshots() {
  return readSnapshots().map(x => ({
    id: x.id,
    time: x.time,
    reason: x.reason || "Tự động",
    size: x.size || (x.data || "").length
  }));
}

function getSnapshotById(id) {
  return readSnapshots().find(x => x.id === id) || null;
}

function formatSnapshotTime(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) return "";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatBytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return v + " B";
  if (v < 1024 * 1024) return (v / 1024).toFixed(1) + " KB";
  return (v / (1024 * 1024)).toFixed(2) + " MB";
}

// Khôi phục 1 bản sao lưu (tự tạo thêm 1 bản của trạng thái hiện tại trước khi ghi đè).
function restoreSnapshotById(id) {
  const item = getSnapshotById(id);
  if (!item) return { ok: false, error: "Không tìm thấy bản sao lưu này." };
  let parsed;
  try {
    parsed = JSON.parse(item.data);
  } catch (e) {
    return { ok: false, error: "Bản sao lưu bị hỏng: " + e.message };
  }
  const valid = validateBackupData(parsed);
  if (!valid.ok) return { ok: false, error: valid.errors.join(" ") };
  createSnapshot("Trước khi khôi phục bản " + formatSnapshotTime(item.time));
  applyStateFromParsed(parsed);
  return { ok: true, restoredAt: item.time, reason: item.reason };
}

function restoreLatestSnapshot() {
  const list = listSnapshots();
  if (!list.length) return { ok: false, error: "Chưa có bản sao lưu tự động nào." };
  return restoreSnapshotById(list[0].id);
}

function openSnapshotModal() {
  const modal = document.getElementById("snapshotModal");
  if (!modal) return;
  renderSnapshotList();
  modal.classList.add("show");
}

function closeSnapshotModal() {
  const modal = document.getElementById("snapshotModal");
  if (modal) modal.classList.remove("show");
}

function renderSnapshotList() {
  const holder = document.getElementById("snapshotList");
  if (!holder) return;
  const list = listSnapshots();
  if (!list.length) {
    holder.innerHTML = `<p class="empty">Chưa có bản sao lưu tự động nào. Hệ thống sẽ tự lưu trước mỗi lần cắt lịch, khôi phục hoặc sửa biên chế.</p>`;
    return;
  }
  holder.innerHTML = `<div class="snapshot-list">` + list.map((s, i) => `
    <div class="snapshot-item">
      <div class="snapshot-info">
        <b>${i === 0 ? "🟢 Bản mới nhất · " : ""}${escHTML(formatSnapshotTime(s.time))}</b>
        <span>${escHTML(s.reason)} · ${escHTML(formatBytes(s.size))}</span>
      </div>
      <button class="sec" onclick="restoreSnapshotConfirm('${escHTML(s.id)}')">↩ Khôi phục</button>
    </div>`).join("") + `</div>`;
}

function restoreSnapshotConfirm(id) {
  if (getCurrentRole() !== "commander") {
    alert("Chỉ có Chỉ huy / Trưởng ban mới được khôi phục dữ liệu!");
    return;
  }
  const item = listSnapshots().find(x => x.id === id);
  const label = item ? `${formatSnapshotTime(item.time)} (${item.reason})` : id;
  if (!confirm(`Khôi phục dữ liệu về bản sao lưu:\n${label}\n\nDữ liệu hiện tại sẽ được tự sao lưu trước khi khôi phục. Tiếp tục?`)) return;
  const res = restoreSnapshotById(id);
  if (!res.ok) {
    alert("❌ Không thể khôi phục: " + res.error);
    return;
  }
  alert("✅ Đã khôi phục bản sao lưu thành công!");
  window.location.reload();
}

function restoreLatestSnapshotConfirm() {
  const list = listSnapshots();
  if (!list.length) {
    alert("Chưa có bản sao lưu tự động nào.");
    return;
  }
  restoreSnapshotConfirm(list[0].id);
}

// ==================== KIỂM TRA CẤU TRÚC DỮ LIỆU JSON ====================
// Trả về { ok, errors, warnings }. Dùng chung cho khôi phục tệp và bản sao lưu.
function validateBackupData(parsed) {
  const errors = [];
  const warnings = [];
  const isPlainObject = v => !!v && typeof v === "object" && !Array.isArray(v);

  if (!isPlainObject(parsed)) {
    return { ok: false, errors: ["Tệp JSON không phải là một đối tượng dữ liệu hợp lệ."], warnings };
  }

  if (!isPlainObject(parsed.days)) {
    errors.push("Thiếu hoặc sai kiểu dữ liệu 'days' (phải là đối tượng ngày → dữ liệu).");
  } else {
    const keys = Object.keys(parsed.days);
    if (!keys.length) warnings.push("Tệp không có ngày dữ liệu nào.");
    keys.forEach(k => {
      const p = k.split("-");
      const dObj = p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null;
      const validKey = p.length === 3 && /^\d{4}-\d{2}-\d{2}$/.test(k) && dObj &&
        dObj.getFullYear() === +p[0] && dObj.getMonth() === +p[1] - 1 && dObj.getDate() === +p[2];
      if (!validKey) {
        errors.push(`Khóa ngày "${k}" không đúng định dạng YYYY-MM-DD.`);
        return;
      }
      const day = parsed.days[k];
      if (!isPlainObject(day)) {
        errors.push(`Ngày ${k}: dữ liệu không phải đối tượng.`);
        return;
      }
      if (day.cells != null) {
        if (!Array.isArray(day.cells)) {
          errors.push(`Ngày ${k}: trường 'cells' phải là mảng.`);
        } else if (day.cells.length !== 60 && day.cells.length !== 20) {
          errors.push(`Ngày ${k}: 'cells' phải có 60 ô (hoặc 20 ô định dạng cũ), hiện có ${day.cells.length}.`);
        } else {
          const badIdx = day.cells.findIndex(c => c != null && typeof c !== "string");
          if (badIdx >= 0) errors.push(`Ngày ${k}: ô ${badIdx + 1} không phải chuỗi tên.`);
        }
      }
      if (day.absent != null && !isPlainObject(day.absent)) {
        errors.push(`Ngày ${k}: trường 'absent' phải là đối tượng.`);
      }
    });
  }

  if (parsed.teams != null) {
    if (!Array.isArray(parsed.teams)) {
      errors.push("Trường 'teams' phải là mảng 4 Tổ.");
    } else {
      if (parsed.teams.length < 4) warnings.push("Tệp chỉ có dưới 4 Tổ, hệ thống sẽ bổ sung Tổ mặc định.");
      parsed.teams.forEach((t, i) => {
        if (!isPlainObject(t)) {
          errors.push(`Tổ ${i + 1}: dữ liệu không phải đối tượng.`);
          return;
        }
        if (t.officers != null && !Array.isArray(t.officers)) errors.push(`Tổ ${i + 1}: 'officers' phải là mảng.`);
        if (t.soldiers != null && !Array.isArray(t.soldiers)) errors.push(`Tổ ${i + 1}: 'soldiers' phải là mảng.`);
      });
    }
  }

  if (parsed.personnelAccounts != null && !Array.isArray(parsed.personnelAccounts)) {
    errors.push("Trường 'personnelAccounts' phải là mảng.");
  }
  if (parsed.accounts != null && !isPlainObject(parsed.accounts)) {
    errors.push("Trường 'accounts' phải là đối tượng tài khoản.");
  }
  if (parsed.swapRequests != null && !Array.isArray(parsed.swapRequests)) {
    errors.push("Trường 'swapRequests' phải là mảng.");
  }
  if (parsed.handoverNotes != null && !isPlainObject(parsed.handoverNotes)) {
    errors.push("Trường 'handoverNotes' phải là đối tượng.");
  }
  if (parsed.nightOnly != null && typeof parsed.nightOnly !== "string") {
    errors.push("Trường 'nightOnly' phải là chuỗi.");
  }
  return { ok: errors.length === 0, errors, warnings };
}

// Áp dụng dữ liệu đã kiểm tra vào hệ thống (dùng cho khôi phục tệp và bản sao lưu).
function applyStateFromParsed(parsed) {
  S = parsed;
  if (!S.swapRequests) S.swapRequests = [];
  if (!S.accounts) S.accounts = { ...DEFAULT_COMMANDER_ACCOUNTS };
  if (!S.personnelAccounts) S.personnelAccounts = [];
  if (typeof S.nightOnly !== "string") S.nightOnly = "";
  if (!S.handoverNotes || typeof S.handoverNotes !== "object" || Array.isArray(S.handoverNotes)) S.handoverNotes = {};
  if (!S.teams || S.teams.length < 4) S.teams = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
  normalizeBorrowRules();
  syncFromTeamsToRosterAndAccounts();
  migrateLegacyPasswords();
  saveStorage();
  return S;
}

// ==================== PHIÊN ĐĂNG NHẬP ====================
function touchSession(force) {
  try {
    if (!localStorage.getItem(ROLE_KEY)) return;
    const now = Date.now();
    const last = parseInt(localStorage.getItem(SESSION_KEY) || "0", 10) || 0;
    if (!force && now - last < 60000) return;
    localStorage.setItem(SESSION_KEY, String(now));
  } catch (e) {}
}

function isSessionExpired() {
  try {
    if (!localStorage.getItem(ROLE_KEY)) return false;
    const last = parseInt(localStorage.getItem(SESSION_KEY) || "0", 10) || 0;
    if (!last) return false;
    return Date.now() - last > SESSION_TIMEOUT_MS;
  } catch (e) {
    return false;
  }
}

function clearSession() {
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(SESSION_KEY);
}

// Ghi nhận hoạt động để gia hạn phiên (tối đa 1 lần/phút).
(function initSessionTracking() {
  if (typeof document === "undefined" || !document.addEventListener) return;
  try {
    if (!localStorage.getItem(ROLE_KEY)) return;
    // Không gia hạn phiên ngay khi tải trang: phải để requireRole kiểm tra
    // hết hạn trước, tránh trường hợp mở lại trang sau 30 phút vẫn còn phiên.
    let last = 0;
    const handler = () => {
      const now = Date.now();
      if (now - last < 60000) return;
      last = now;
      touchSession(true);
    };
    ["click", "keydown", "mousemove", "touchstart", "scroll"].forEach(ev => {
      document.addEventListener(ev, handler, { passive: true });
    });
  } catch (e) {}
})();

// Kiểm tra tài khoản Chỉ huy còn dùng mật khẩu mặc định hay không.
function isUsingDefaultCommanderPassword() {
  const defaults = { chihuy: "doi3", truongban: "doi3", admin: "123456" };
  const accounts = S.accounts || {};
  for (const u in defaults) {
    if (!Object.prototype.hasOwnProperty.call(accounts, u)) continue;
    try {
      if (verifyPasswordRecord(String(accounts[u]), defaults[u])) return u;
    } catch (e) {}
  }
  return "";
}

// ==================== KIỂM TRA NỐI NGÀY D-1 → D ====================
// Quét toàn bộ lịch: khung cuối ngày trước (Ca 4 · 04:00–06:00) và khung đầu ngày sau (Ca 1 · 06:00–08:00).
function auditCrossDayConflicts() {
  const out = [];
  const dates = Object.keys(S.days || {}).sort();
  for (let i = 0; i < dates.length; i++) {
    const from = dates[i];
    const to = addDay(from, 1);
    const a = S.days[from];
    const b = S.days[to];
    if (!a || !b || !Array.isArray(a.cells) || !Array.isArray(b.cells)) continue;
    for (let colFrom = 0; colFrom < 5; colFrom++) {
      const person = cleanName(a.cells[11 * 5 + colFrom] || "");
      if (!person) continue;
      for (let colTo = 0; colTo < 5; colTo++) {
        if (cleanName(b.cells[colTo] || "") !== person) continue;
        out.push({
          from: from,
          to: to,
          person: person,
          colFrom: colFrom,
          colTo: colTo,
          message: `${person} làm Ca 4 · ${CA[3][2]} ngày ${vnFormat(from)} và Ca 1 · ${CA[0][0]} ngày ${vnFormat(to)}`
        });
        break;
      }
    }
  }
  return out;
}

function runCrossDayAudit() {
  const holder = document.getElementById("crossDayAuditResult");
  if (!holder) return;
  const list = auditCrossDayConflicts();
  if (!list.length) {
    holder.innerHTML = `<div class="note-info">✅ Không phát hiện vi phạm nối ngày nào trên toàn bộ lịch.</div>`;
    return;
  }
  holder.innerHTML = `<div class="note-warn"><b>❌ Phát hiện ${list.length} vi phạm nối ngày:</b></div>` +
    `<ul style="margin:6px 0 0 18px;color:#b45309;font-size:13px;">` +
    list.map(x => `<li>${escHTML(x.message)}</li>`).join("") + `</ul>`;

  // Bật alert để người dùng không bỏ sót vi phạm; chỉ tắt khi bấm OK.
  setTimeout(() => {
    alert("⛔ PHÁT HIỆN " + list.length + " VI PHẠM NỐI NGÀY:\n\n" +
      list.map((x, i) => (i + 1) + ". " + x.message).join("\n") +
      "\n\n(Nhấn OK để tắt thông báo)");
  }, 0);
}

// ==================== SỔ BÀN GIAO TRỰC BAN ====================
function getHandoverNotes(dateStr) {
  if (!S.handoverNotes || typeof S.handoverNotes !== "object" || Array.isArray(S.handoverNotes)) {
    S.handoverNotes = {};
  }
  const list = S.handoverNotes[dateStr];
  return Array.isArray(list) ? list : [];
}

function addHandoverNote(note) {
  const n = note || {};
  const dateStr = String(n.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { ok: false, error: "Ngày bàn giao không hợp lệ." };
  const content = String(n.content || "").trim();
  if (!content) return { ok: false, error: "Vui lòng nhập nội dung bàn giao." };
  if (content.length > 2000) return { ok: false, error: "Nội dung bàn giao quá dài (tối đa 2000 ký tự)." };
  const ca = String(n.ca || "").trim();
  if (ca && !/^[1-4]$/.test(ca)) return { ok: false, error: "Ca bàn giao không hợp lệ." };
  const status = n.status === "pending" ? "pending" : "done";
  if (!S.handoverNotes || typeof S.handoverNotes !== "object") S.handoverNotes = {};
  if (!Array.isArray(S.handoverNotes[dateStr])) S.handoverNotes[dateStr] = [];
  const item = {
    id: "bg_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6),
    ca: ca,
    from: String(n.from || "").trim(),
    to: String(n.to || "").trim(),
    content: content,
    status: status,
    createdAt: new Date().toISOString(),
    createdBy: getCurrentUserLabel()
  };
  S.handoverNotes[dateStr].push(item);
  saveStorage();
  return { ok: true, item: item };
}

function deleteHandoverNote(dateStr, id) {
  const list = getHandoverNotes(dateStr);
  const idx = list.findIndex(x => x && x.id === id);
  if (idx < 0) return { ok: false, error: "Không tìm thấy dòng bàn giao này." };
  list.splice(idx, 1);
  if (!list.length) delete S.handoverNotes[dateStr];
  saveStorage();
  return { ok: true };
}

// ==================== THỐNG KÊ CÔNG BẰNG THEO THÁNG ====================
// Tính số ngày/khung giờ/ca đêm/ngày cuối tuần/điểm công của từng người trong tháng.
function computeMonthlyFairness(monthStr) {
  let year, month;
  const m = /^(\d{4})-(\d{2})$/.exec(String(monthStr || ""));
  if (m) {
    year = +m[1];
    month = +m[2];
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }
  if (month < 1 || month > 12) {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const stats = {};
  const ensure = (name) => {
    const key = cleanName(name).toLowerCase();
    if (!stats[key]) {
      stats[key] = {
        name: cleanName(name),
        teamId: getPersonTeamId(name),
        days: 0,
        shifts: 0,
        nightShifts: 0,
        dayShifts: 0,
        weekendDays: 0,
        credit: 0
      };
    }
    return stats[key];
  };

  const daysInMonth = new Date(year, month, 0).getDate();
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const dStr = `${year}-${pad(month)}-${pad(dayNum)}`;
    const dayData = S.days && S.days[dStr];
    if (!dayData || !Array.isArray(dayData.cells)) continue;
    if (!dayData.cells.some(c => (c || "").trim() !== "")) continue;
    const dow = parseDate(dStr).getDay();
    const isWeekend = dow === 0 || dow === 6;
    const perPerson = {};

    for (let ca = 0; ca < 4; ca++) {
      for (let slot = 0; slot < 3; slot++) {
        for (let col = 0; col < 5; col++) {
          const val = (dayData.cells[(ca * 3 + slot) * 5 + col] || "").trim();
          if (!val) continue;
          const key = cleanName(val).toLowerCase();
          if (!perPerson[key]) perPerson[key] = { name: val, shifts: 0, night: 0, day: 0 };
          perPerson[key].shifts++;
          if (isNightShiftForPerson(ca, slot, val)) perPerson[key].night++;
          else perPerson[key].day++;
        }
      }
    }

    Object.keys(perPerson).forEach(key => {
      const p = perPerson[key];
      const st = ensure(p.name);
      st.days++;
      st.shifts += p.shifts;
      st.nightShifts += p.night;
      st.dayShifts += p.day;
      if (isWeekend) st.weekendDays++;
      const detail = getPersonDayWorkDetails(dStr, p.name);
      st.credit += Number(detail.credit) || 0;
    });
  }

  [...parseNames(S.officers), ...parseNames(S.soldiers)].forEach(n => ensure(n));

  const rows = Object.keys(stats).map(k => stats[k]).sort((a, b) =>
    (b.credit - a.credit) ||
    (b.nightShifts - a.nightShifts) ||
    (b.shifts - a.shifts) ||
    a.name.localeCompare(b.name)
  );
  return { month: `${year}-${pad(month)}`, daysInMonth: daysInMonth, rows: rows };
}

function getDayData(d) {
  if (!S.days[d]) {
    S.days[d] = { cells: Array(60).fill(""), teamInCa: [1, 2, 3, 4], absent: {}, streaks: {}, manualCredits: {} };
  }
  if (!S.days[d].cells || S.days[d].cells.length < 60) {
    const oldCells = S.days[d].cells || [];
    const newCells = Array(60).fill("");
    for (let ca = 0; ca < 4; ca++) {
      for (let col = 0; col < 5; col++) {
        const val = oldCells[ca * 5 + col] || "";
        for (let slot = 0; slot < 3; slot++) {
          newCells[(ca * 3 + slot) * 5 + col] = val;
        }
      }
    }
    S.days[d].cells = newCells;
  }
  if (!S.days[d].streaks) S.days[d].streaks = {};
  if (!S.days[d].manualCredits) S.days[d].manualCredits = {};
  // Thông tin mượn quân số tạm thời / thay người do làm quá số ngày
  if (!Array.isArray(S.days[d].borrowed)) S.days[d].borrowed = [];
  if (!Array.isArray(S.days[d].overworkSwaps)) S.days[d].overworkSwaps = [];
  if (!Array.isArray(S.days[d].overworkKept)) S.days[d].overworkKept = [];
  if (!S.days[d].borrowMarks || typeof S.days[d].borrowMarks !== "object") S.days[d].borrowMarks = {};
  if (!S.days[d].teamInCa) S.days[d].teamInCa = detectTeamsInCa(S.days[d]);
  return S.days[d];
}

// ===== VẮNG MẶT: GIỮ NGUYÊN QUA CÁC LẦN CẮT LỊCH =====
// Danh sách vắng mặt đã nhập chỉ mất khi người dùng xóa tên khỏi ô.
// Khi cắt lịch cho ngày mới, hệ thống tự kế thừa danh sách vắng mặt gần nhất
// (trừ khi ngày đó đã được chỉnh tay - absentTouched).
function absenceCategoryKeys() {
  return CATS.map(c => c[0]);
}

function dayHasAnyAbsence(day) {
  if (!day || !day.absent) return false;
  return absenceCategoryKeys().some(k => parseNames(day.absent[k]).length > 0);
}

function findAbsenceSource(dateStr) {
  let d = addDay(dateStr, -1);
  for (let i = 0; i < 90; i++) {
    const day = S.days && S.days[d];
    if (day && (day.absentTouched === true || dayHasAnyAbsence(day))) return day;
    d = addDay(d, -1);
  }
  return null;
}

// Kế thừa danh sách vắng mặt cho ngày sắp cắt lịch.
// Trả về true nếu có dữ liệu vắng mặt được áp dụng.
function applyInheritedAbsence(dateStr, targetDay) {
  if (!targetDay) return false;
  if (targetDay.absentTouched === true) return false;
  if (dayHasAnyAbsence(targetDay)) return false;
  const src = findAbsenceSource(dateStr);
  if (!src || !src.absent) return false;
  targetDay.absent = {};
  absenceCategoryKeys().forEach(k => {
    targetDay.absent[k] = (src.absent[k] || "").trim();
  });
  return dayHasAnyAbsence(targetDay);
}

// Tự động nhận diện Tổ nào đang trực ở Ca nào (0..3) dựa vào tên Đốc gác hoặc Chiến sĩ trong Ca đó
function detectTeamsInCa(day) {
  const res = [1, 2, 3, 4];
  if (!day || !day.cells) return res;
  const used = {};
  // Bỏ qua người được mượn từ Tổ khác để không nhận diện nhầm Tổ đang trực
  const borrowedSet = {};
  (day.borrowed || []).forEach(b => {
    if (b && b.person) borrowedSet[cleanName(b.person).toLowerCase()] = 1;
  });
  for (let ca = 0; ca < 4; ca++) {
    let foundTeam = null;
    // Dò cả 3 khung giờ để vẫn nhận diện đúng Tổ khi khung ban ngày trống
    // (trường hợp đồng chí chỉ làm ca đêm được xếp riêng ở khung đêm).
    for (let slot = 0; slot < 3 && !foundTeam; slot++) {
      for (let col = 0; col < 5; col++) {
        const p = (day.cells[(ca * 3 + slot) * 5 + col] || "").trim();
        if (p && borrowedSet[cleanName(p).toLowerCase()]) continue;
        if (p) {
          const tid = getPersonTeamId(p);
          if (tid) { foundTeam = tid; break; }
        }
      }
    }
    if (foundTeam) {
      res[ca] = foundTeam;
      used[foundTeam] = true;
    }
  }
  return res;
}

function getSavedDatesHistory() {
  return Object.keys(S.days).filter(d => {
    return S.days[d].cells && S.days[d].cells.some(c => (c || "").trim() !== "");
  }).sort().reverse();
}

function getCurrentRole() {
  return localStorage.getItem(ROLE_KEY) || null;
}

function setCurrentRole(role) {
  localStorage.setItem(ROLE_KEY, role);
}

// Bắt buộc đã đăng nhập (và đúng vai trò nếu có truyền role)
function requireRole(role) {
  const current = getCurrentRole();
  if (!current) {
    location.replace("index.html");
    return false;
  }
  if (isSessionExpired()) {
    clearSession();
    location.replace("index.html?expired=1");
    return false;
  }
  if (role && current !== role) {
    alert("Bạn không có quyền truy cập trang này!");
    location.replace("lich-gac.html");
    return false;
  }
  touchSession(true);
  return true;
}

function logout() {
  clearSession();
  location.replace("index.html");
}

function getCurrentUserLabel() {
  return localStorage.getItem(USER_KEY) || "";
}

function setCurrentUserLabel(label) {
  localStorage.setItem(USER_KEY, label || "");
}

function authenticateSoldierLogin(inputUsername, inputPassword) {
  const uNorm = (inputUsername || "").trim().toLowerCase();
  const pNorm = (inputPassword || "").trim();
  if (!uNorm || !pNorm) return null;

  const list = S.personnelAccounts || [];
  for (const acc of list) {
    if (acc.active === false) continue; // tài khoản đã ngừng hoạt động
    const fullLabel = formatFullAccountName(acc.fullName, acc.code).toLowerCase();
    const uAcc = (acc.username || fullLabel).trim().toLowerCase();
    const altLabel = `${cleanName(acc.fullName)} ${acc.code}`.trim().toLowerCase();
    // Chỉ cho đăng nhập bằng Họ tên kèm mã số / tên tài khoản đã cấp.
    // Không chấp nhận tên thuần để tránh đăng nhập thay người khác.
    if (uNorm !== fullLabel && uNorm !== uAcc && uNorm !== altLabel) continue;
    if (!verifyAccountPassword(acc, pNorm)) continue;
    // Nâng cấp mật khẩu plaintext cũ ngay sau lần đăng nhập thành công đầu tiên
    if (!acc.passwordHash && acc.password != null) {
      setAccountPassword(acc, pNorm);
      saveStorage();
    }
    return acc;
  }
  return null;
}

// Người đi học tập buổi sáng: chỉ làm ca đêm 18:00 – 06:00
function isNightOnlyPerson(personName) {
  const cName = cleanName(personName).toLowerCase();
  if (!cName) return false;
  return parseNames(S.nightOnly || "").some(n => cleanName(n).toLowerCase() === cName);
}

// Khung giờ được tính là ca đêm của từng người:
// - Người bình thường: khung đêm 22:00 – 06:00 (slot 2 của mỗi ca).
// - Người học tập buổi sáng: thêm các khung bắt đầu từ 18:00 (18–20, 20–22).
function isNightShiftForPerson(caIdx, slotIdx, personName) {
  if (slotIdx === 2) return true;
  if (!isNightOnlyPerson(personName)) return false;
  const start = parseInt(String((CA[caIdx] || [])[slotIdx] || "").slice(0, 2), 10);
  return Number.isFinite(start) && start >= 18;
}

function getPersonDayWorkDetails(dateStr, personName) {
  const cName = cleanName(personName);
  const dayData = S.days[dateStr];
  const result = {
    isAbsent: false,
    absentCode: "",
    absentLabel: "",
    dayShifts: 0,
    nightShifts: 0,
    totalSlots: 0,
    credit: 0,
    shiftsDetail: []
  };
  if (!dayData) return result;

  const absentObj = dayData.absent || {};
  for (const c of CATS) {
    if (parseNames(absentObj[c[0]]).some(n => cleanName(n) === cName)) {
      result.isAbsent = true;
      result.absentCode = c[2];
      result.absentLabel = c[1];
      return result;
    }
  }

  const posNames = ["Đốc gác 1", "Vọng x9", "Vọng x10", "Vọng x11", "Vọng x12"];
  if (dayData.cells) {
    for (let ca = 0; ca < 4; ca++) {
      for (let slot = 0; slot < 3; slot++) {
        const row = ca * 3 + slot;
        for (let col = 0; col < 5; col++) {
          const val = (dayData.cells[row * 5 + col] || "").trim();
          if (val && cleanName(val) === cName) {
            result.totalSlots++;
            const isNightShift = isNightShiftForPerson(ca, slot, val);
            if (isNightShift) result.nightShifts++;
            else result.dayShifts++;
            result.shiftsDetail.push({
              ca: ca + 1,
              slot: slot + 1,
              time: CA[ca][slot],
              isNight: isNightShift,
              isNightOnly: isNightOnlyPerson(val),
              position: posNames[col],
              col: col
            });
          }
        }
      }
    }
  }

  if (result.totalSlots === 0) {
    result.credit = 0;
    return result;
  }

  if (dayData.manualCredits && dayData.manualCredits[cName] != null) {
    result.credit = dayData.manualCredits[cName];
    return result;
  }

  if (
    (result.dayShifts === 2 && result.nightShifts === 0) ||
    (result.dayShifts === 0 && result.nightShifts === 1) ||
    result.totalSlots < 3
  ) {
    result.credit = 0.5;
  } else {
    result.credit = 1.0;
  }

  return result;
}

function hasCrossDayConsecutiveError(dateStr, personName, cellIndex) {
  const cName = cleanName(personName);
  if (!cName) return false;
  const rowIdx = Math.floor(cellIndex / 5);
  const caIdx = Math.floor(rowIdx / 3);
  const slotIdx = rowIdx % 3;
  const chronoIdx = slotIdx * 4 + caIdx;

  if (chronoIdx === 0) {
    const prevDate = addDay(dateStr, -1);
    const prevDay = S.days[prevDate];
    if (prevDay && prevDay.cells) {
      for (let col = 0; col < 5; col++) {
        if (cleanName(prevDay.cells[11 * 5 + col]) === cName) return true;
      }
    }
  }
  if (chronoIdx === 11) {
    const nextDate = addDay(dateStr, 1);
    const nextDay = S.days[nextDate];
    if (nextDay && nextDay.cells) {
      for (let col = 0; col < 5; col++) {
        if (cleanName(nextDay.cells[0 * 5 + col]) === cName) return true;
      }
    }
  }
  return false;
}

// Tách thông tin của 1 ô lịch (0..59) thành ca / khung giờ / cột / thứ tự thời gian
function getCellParts(cellIndex) {
  const row = Math.floor(cellIndex / 5);
  const ca = Math.floor(row / 3);
  const slot = row % 3;
  return {
    index: cellIndex,
    row: row,
    ca: ca,
    slot: slot,
    col: cellIndex % 5,
    chrono: slot * 4 + ca
  };
}

// Kiểm tra khi gán một người vào các ô lịch:
// - không trùng ca (đã có mặt ở vị trí khác trong cùng ca),
// - không tạo 2 khung giờ liền nhau trong ngày,
// - không tạo 2 khung giờ liền nhau qua ngày trước / ngày sau.
// targetIndices: các ô sẽ gán cho người đó (bỏ qua khi quét).
// samePosition: { ca, col } — cho phép người đó đã có mặt ở các khung khác cùng vị trí.
function findShiftConflict(dateStr, personLabel, targetIndices, samePosition) {
  const person = cleanName(personLabel).toLowerCase();
  if (!person) return null;
  const day = S.days && S.days[dateStr];
  if (!day || !Array.isArray(day.cells)) return null;

  const targets = (targetIndices || []).map(getCellParts);
  const ignore = new Set((targetIndices || []).map(Number));

  for (let k = 0; k < 60; k++) {
    if (ignore.has(k)) continue;
    if (samePosition && getCellParts(k).ca === samePosition.ca && getCellParts(k).col === samePosition.col) continue;
    if (cleanName(day.cells[k] || "").toLowerCase() !== person) continue;

    const p = getCellParts(k);
    if (samePosition && p.ca === samePosition.ca) {
      return {
        type: "same-ca",
        message: `đã có mặt ở Ca ${p.ca + 1} (${CA[p.ca][p.slot]}, ${p.col === 0 ? "Đốc gác 1" : "Vọng x" + (8 + p.col)})`,
        cellIndex: k
      };
    }
    if (targets.some(t => Math.abs(t.chrono - p.chrono) <= 1)) {
      return {
        type: "adjacent",
        message: `sẽ làm 2 khung giờ liền nhau (Ca ${p.ca + 1} · ${CA[p.ca][p.slot]})`,
        cellIndex: k
      };
    }
  }

  // Liền ngày: khung cuối ngày trước (Ca 4 · 04:00–06:00) và khung đầu ngày sau (Ca 1 · 06:00–08:00)
  for (const t of targets) {
    if (t.chrono === 0) {
      const prev = S.days && S.days[addDay(dateStr, -1)];
      if (prev && Array.isArray(prev.cells)) {
        for (let col = 0; col < 5; col++) {
          if (cleanName(prev.cells[11 * 5 + col] || "").toLowerCase() === person) {
            return {
              type: "prev-day",
              message: `đã làm khung cuối ngày hôm trước (Ca 4 · ${CA[3][2]})`,
              cellIndex: 11 * 5 + col
            };
          }
        }
      }
    }
    if (t.chrono === 11) {
      const next = S.days && S.days[addDay(dateStr, 1)];
      if (next && Array.isArray(next.cells)) {
        for (let col = 0; col < 5; col++) {
          if (cleanName(next.cells[col] || "").toLowerCase() === person) {
            return {
              type: "next-day",
              message: `đã làm khung đầu ngày hôm sau (Ca 1 · ${CA[0][0]})`,
              cellIndex: col
            };
          }
        }
      }
    }
  }
  return null;
}

function executeGlobalSearch(ev) {
  if (ev) ev.preventDefault();
  const inp = document.getElementById("globalSearchInput");
  if (!inp) return;
  const q = inp.value.trim();
  if (!q) {
    alert("Vui lòng nhập tên chiến sĩ, mã số hoặc tên ca gác (VD: Ca 1, Ca 2...) để tìm kiếm!");
    return;
  }
  window.location.href = `tim-kiem.html?q=${encodeURIComponent(q)}`;
}

function backupJSONData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(S, null, 2));
  const dlAnchor = document.createElement("a");
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", `SaoLuu_Doi3_TrungDoan_${fmtDate(new Date())}.json`);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
}

function restoreJSONData(event) {
  const resetInput = () => { try { event.target.value = ""; } catch (e) {} };

  if (getCurrentRole() !== "commander") {
    alert("Chỉ có Chỉ huy / Trưởng ban mới được khôi phục dữ liệu!");
    resetInput();
    return;
  }

  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!confirm("Dữ liệu hiện tại sẽ bị thay thế hoàn toàn bằng nội dung tệp JSON. Hệ thống sẽ tự sao lưu dữ liệu hiện tại trước khi khôi phục. Tiếp tục?")) {
    resetInput();
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      const valid = validateBackupData(parsed);
      if (!valid.ok) {
        alert("❌ Tệp JSON không hợp lệ:\n- " + valid.errors.slice(0, 8).join("\n- ") +
          (valid.errors.length > 8 ? `\n... và ${valid.errors.length - 8} lỗi khác.` : ""));
        resetInput();
        return;
      }
      if (valid.warnings.length && !confirm("⚠️ Cảnh báo dữ liệu:\n- " + valid.warnings.join("\n- ") + "\n\nVẫn tiếp tục khôi phục?")) {
        resetInput();
        return;
      }

      // Tự sao lưu dữ liệu hiện tại trước khi ghi đè
      createSnapshot("Trước khi khôi phục tệp JSON");
      applyStateFromParsed(parsed);
      alert("✅ Đã khôi phục dữ liệu hệ thống thành công!");
      window.location.reload();
    } catch (err) {
      alert("❌ Lỗi đọc tệp JSON: " + err.message);
    } finally {
      resetInput();
    }
  };
  reader.readAsText(file);
}

function updateTopBarShared() {
  const role = getCurrentRole();
  const isCommander = (role === "commander");
  const userLabel = getCurrentUserLabel();
  const badge = document.getElementById("roleBadge");
  if (badge) {
    badge.textContent = isCommander
      ? `⭐ Chỉ huy: ${userLabel || "Trưởng ban"}`
      : `👤 Chiến sĩ: ${userLabel || "Đã đăng nhập"}`;
  }
  const navDash = document.getElementById("navDash");
  if (navDash && !isCommander) navDash.style.display = "none";
  const navAccounts = document.getElementById("navAccounts");
  if (navAccounts && !isCommander) navAccounts.style.display = "none";
  const btnPass = document.getElementById("btnChangePassTop");
  if (btnPass && !isCommander) btnPass.style.display = "none";

  const pending = (S.swapRequests || []).filter(r => r.status === "pending").length;
  const cntEl = document.getElementById("pendingSwapCount");
  if (cntEl) cntEl.textContent = pending;

  touchSession();
  renderSecurityBanner(isCommander);
}

// Cảnh báo bảo mật: tài khoản Chỉ huy còn dùng mật khẩu mặc định.
function renderSecurityBanner(isCommander) {
  if (typeof document === "undefined" || !document.body) return;
  let banner = document.getElementById("securityBanner");
  const defaultUser = isCommander ? isUsingDefaultCommanderPassword() : "";
  if (!defaultUser) {
    if (banner) banner.remove();
    return;
  }
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "securityBanner";
    banner.className = "security-banner";
    document.body.appendChild(banner);
  }
  banner.innerHTML =
    `⚠️ Tài khoản <b>${escHTML(defaultUser)}</b> vẫn đang dùng <b>mật khẩu mặc định</b>. ` +
    `<button class="sec" onclick="openPasswordModal()">🔑 Đổi mật khẩu ngay</button>` +
    `<button class="chip-remove" title="Ẩn cảnh báo" onclick="this.parentNode.remove()">×</button>`;
}

function openPasswordModal() {
  if (getCurrentRole() !== "commander") {
    alert("Chỉ có Chỉ huy mới được đổi mật khẩu!");
    return;
  }
  document.getElementById("passwordModal").classList.add("show");
}

function closePasswordModal() {
  document.getElementById("passwordModal").classList.remove("show");
}

function saveNewCommanderPassword(ev) {
  ev.preventDefault();
  const u = document.getElementById("cpUser").value.trim().toLowerCase();
  const oldP = document.getElementById("cpOld").value.trim();
  const newP = document.getElementById("cpNew").value.trim();
  if (!S.accounts) S.accounts = { ...DEFAULT_COMMANDER_ACCOUNTS };
  if (!S.accounts[u] || !verifyPasswordRecord(String(S.accounts[u]), oldP)) {
    alert("❌ Mật khẩu hiện tại không đúng!");
    return;
  }
  if (newP.length < 4) {
    alert("❌ Mật khẩu mới phải có ít nhất 4 ký tự!");
    return;
  }
  // Chỉ lưu bản băm, không lưu mật khẩu nguyên văn
  S.accounts[u] = makePasswordRecord(newP);
  saveStorage();
  alert("✅ Đã cập nhật mật khẩu mới thành công!");
  closePasswordModal();
}

function findPersonnelAccount(nameOrLabel) {
  if (!nameOrLabel) return null;
  const raw = nameOrLabel.trim();
  const cName = cleanName(raw).toLowerCase();
  const cd = extractCode(raw).toLowerCase();
  const list = S.personnelAccounts || [];

  for (const acc of list) {
    const accLabel = formatFullAccountName(acc.fullName, acc.code).toLowerCase();
    const accName = cleanName(acc.fullName).toLowerCase();
    const accCode = (acc.code || "").trim().toLowerCase();
    if (raw.toLowerCase() === accLabel || (cd !== "chưa cấp" && cd === accCode) || cName === accName) {
      return acc;
    }
  }
  return null;
}

function cascadeUpdatePersonnelName(oldLabel, oldCleanName, newLabel) {
  if (!oldLabel || !newLabel || oldLabel === newLabel) return;
  Object.keys(S.days || {}).forEach(dStr => {
    const day = S.days[dStr];
    if (day) day.manualCredits = {};
    if (day && Array.isArray(day.cells)) {
      day.cells = day.cells.map(cellVal => {
        const cv = (cellVal || "").trim();
        if (!cv) return "";
        if (cv === oldLabel || cleanName(cv).toLowerCase() === oldCleanName.toLowerCase()) {
          return newLabel;
        }
        return cv;
      });
    }
    if (day && day.absent) {
      CATS.forEach(c => {
        const key = c[0];
        if (day.absent[key]) {
          const list = parseNames(day.absent[key]).map(item => {
            if (item === oldLabel || cleanName(item).toLowerCase() === oldCleanName.toLowerCase()) {
              return newLabel;
            }
            return item;
          });
          day.absent[key] = list.join(", ");
        }
      });
    }
  });
}

function ensurePersonnelHoverPopover() {
  let pop = document.getElementById("globalPersonnelPopover");
  if (!pop) {
    pop = document.createElement("div");
    pop.id = "globalPersonnelPopover";
    pop.className = "personnel-hover-popover";
    document.body.appendChild(pop);
  }
  return pop;
}

function showPersonnelHoverCard(ev, personIdentifier) {
  const pop = ensurePersonnelHoverPopover();
  const acc = findPersonnelAccount(personIdentifier);
  const teamId = getPersonTeamId(personIdentifier);

  const fullName = acc ? acc.fullName : cleanName(personIdentifier);
  const code = acc ? acc.code : extractCode(personIdentifier);
  const position = acc ? (acc.position || "Chiến sĩ nghĩa vụ") : "Quân nhân";
  const roleGroup = acc
    ? `${acc.roleType === "officer" ? "Đốc gác (Sĩ quan)" : "Chiến sĩ Vọng gác"} — Tổ ${acc.teamId || teamId || 1}`
    : (teamId ? `Tổ ${teamId}` : "Chưa phân tổ");
  const username = acc ? (acc.username || formatFullAccountName(fullName, code)) : formatFullAccountName(fullName, code);
  const dob = acc && acc.dob ? vnFormat(acc.dob) : "Chưa cập nhật";
  const hometown = acc && acc.hometown ? acc.hometown : "Chưa cập nhật";
  const initials = fullName.split(" ").pop().charAt(0).toUpperCase() || "Q";
  const teamNo = acc && acc.teamId ? acc.teamId : (teamId || 1);

  pop.innerHTML = `
    <div class="pop-header">
      <div class="pop-avatar">${escHTML(initials)}</div>
      <div class="pop-title-box">
        <h4>${escHTML(fullName)} (${escHTML(code)})</h4>
        <span>ĐỘI 3 — TỔ ${escHTML(teamNo)} · Click để mở hồ sơ</span>
      </div>
    </div>
    <div class="pop-row"><span class="pop-label">Họ và tên:</span><span class="pop-val">${escHTML(fullName)}</span></div>
    <div class="pop-row"><span class="pop-label">Mã số quân nhân:</span><span class="pop-val">${escHTML(code)}</span></div>
    <div class="pop-row"><span class="pop-label">Tổ biên chế cố định:</span><span class="pop-val" style="color:var(--primary-green);">Tổ ${escHTML(teamNo)}</span></div>
    <div class="pop-row"><span class="pop-label">Chức vụ:</span><span class="pop-val">${escHTML(position)}</span></div>
    <div class="pop-row"><span class="pop-label">Nhóm cắt gác:</span><span class="pop-val">${escHTML(roleGroup)}</span></div>
    <div class="pop-row"><span class="pop-label">Tên TK đăng nhập:</span><span class="pop-val" style="color:var(--primary-green);">${escHTML(username)}</span></div>
    <div class="pop-row"><span class="pop-label">Ngày tháng năm sinh:</span><span class="pop-val">${escHTML(dob)}</span></div>
    <div class="pop-row"><span class="pop-label">Quê quán:</span><span class="pop-val">${escHTML(hometown)}</span></div>
  `;

  pop.classList.add("visible");
  movePersonnelHoverCard(ev);
}

function movePersonnelHoverCard(ev) {
  const pop = document.getElementById("globalPersonnelPopover");
  if (!pop || !pop.classList.contains("visible")) return;
  let x = ev.clientX + 16;
  let y = ev.clientY + 16;
  if (x + 350 > window.innerWidth) x = ev.clientX - 350;
  if (y + 330 > window.innerHeight) y = Math.max(10, window.innerHeight - 340);
  pop.style.left = x + "px";
  pop.style.top = y + "px";
}

function hidePersonnelHoverCard() {
  const pop = document.getElementById("globalPersonnelPopover");
  if (pop) pop.classList.remove("visible");
}

function renderPersonHoverLinkHTML(personLabel) {
  const p = (personLabel || "").trim();
  if (!p || p === "-") return "-";
  return `<a href="tim-kiem.html?q=${encodeURIComponent(cleanName(p))}" class="person-hover-link" data-person="${escHTML(p)}" onmouseenter="showPersonnelHoverCard(event, this.dataset.person)" onmousemove="movePersonnelHoverCard(event)" onmouseleave="hidePersonnelHoverCard()"><b>${escHTML(p)}</b></a>`;
}
