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
  // Chế độ cảnh báo & mượn quân số tạm thời giữa các Tổ
  borrowRules: { enabled: true, maxAbsentSoldiers: 3, maxConsecutiveDays: 5 }
};

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

// Đồng bộ từ 4 Tổ (S.teams) sang S.officers, S.soldiers và S.personnelAccounts
function syncFromTeamsToRosterAndAccounts() {
  if (!S.teams || !Array.isArray(S.teams) || S.teams.length < 4) {
    S.teams = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
  }
  const allOff = [];
  const allSol = [];
  const existingMap = {};
  (S.personnelAccounts || []).forEach(a => {
    existingMap[cleanName(a.fullName).toLowerCase()] = a;
  });

  const updatedAccounts = [];
  let sqCounter = 1;
  let csCounter = 1;

  S.teams.forEach((team, tIdx) => {
    const teamId = tIdx + 1;
    (team.officers || []).forEach(rawName => {
      const fn = cleanName(rawName);
      if (!fn) return;
      let cd = extractCode(rawName);
      const prev = existingMap[fn.toLowerCase()];
      if (cd === "Chưa cấp") cd = (prev && prev.code && prev.code !== "Chưa cấp") ? prev.code : ("SQ" + pad(sqCounter));
      sqCounter++;
      const label = formatFullAccountName(fn, cd);
      if (!allOff.includes(label)) allOff.push(label);

      updatedAccounts.push({
        id: prev ? prev.id : (Date.now() + Math.random()),
        fullName: fn,
        code: cd,
        roleType: "officer",
        teamId: teamId,
        position: prev && prev.position ? prev.position : `Đốc gác - Tổ ${teamId}`,
        username: prev && prev.username ? prev.username : label,
        password: prev && prev.password ? prev.password : "1",
        dob: prev && prev.dob ? prev.dob : "1994-05-19",
        hometown: prev && prev.hometown ? prev.hometown : "Hà Nội"
      });
    });

    (team.soldiers || []).forEach(rawName => {
      const fn = cleanName(rawName);
      if (!fn) return;
      let cd = extractCode(rawName);
      const prev = existingMap[fn.toLowerCase()];
      if (cd === "Chưa cấp") cd = (prev && prev.code && prev.code !== "Chưa cấp") ? prev.code : ("CS" + pad(csCounter));
      csCounter++;
      const label = formatFullAccountName(fn, cd);
      if (!allSol.includes(label)) allSol.push(label);

      updatedAccounts.push({
        id: prev ? prev.id : (Date.now() + Math.random()),
        fullName: fn,
        code: cd,
        roleType: "soldier",
        teamId: teamId,
        position: prev && prev.position ? prev.position : `Chiến sĩ Vọng gác - Tổ ${teamId}`,
        username: prev && prev.username ? prev.username : label,
        password: prev && prev.password ? prev.password : "1",
        dob: prev && prev.dob ? prev.dob : "2004-09-02",
        hometown: prev && prev.hometown ? prev.hometown : "Hải Dương"
      });
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

  S.officers = allOff.join("\n");
  S.soldiers = allSol.join("\n");
  S.personnelAccounts = updatedAccounts;
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
      normalizeBorrowRules();
      if (!S.teams || S.teams.length < 4) S.teams = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
    }
  } catch (e) {
    console.error("Lỗi khi tải localStorage:", e);
  }
  seedDefaultDataIfEmpty();
}

function saveStorage() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {
    console.error("Lỗi khi lưu localStorage:", e);
  }
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
  if (role && current !== role) {
    alert("Bạn không có quyền truy cập trang này!");
    location.replace("lich-gac.html");
    return false;
  }
  return true;
}

function logout() {
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USER_KEY);
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
    const fullLabel = formatFullAccountName(acc.fullName, acc.code).toLowerCase();
    const uAcc = (acc.username || fullLabel).trim().toLowerCase();
    const pass = (acc.password || "1").trim();
    const altLabel = `${cleanName(acc.fullName)} ${acc.code}`.trim().toLowerCase();
    const pureName = cleanName(acc.fullName).toLowerCase();
    if ((uNorm === fullLabel || uNorm === uAcc || uNorm === altLabel || uNorm === pureName) && pNorm === pass) {
      return acc;
    }
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

  // Tự sao lưu dữ liệu hiện tại trước khi ghi đè
  backupJSONData();

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      const validDays = parsed && typeof parsed === "object" &&
        parsed.days && typeof parsed.days === "object" && !Array.isArray(parsed.days);
      if (!validDays) {
        alert("❌ Tệp JSON không đúng định dạng của hệ thống (thiếu hoặc sai kiểu dữ liệu 'days').");
        resetInput();
        return;
      }
      const invalidDay = Object.keys(parsed.days).some(k => {
        const d = parsed.days[k];
        return !d || typeof d !== "object" || (d.cells != null && !Array.isArray(d.cells));
      });
      if (invalidDay) {
        alert("❌ Tệp JSON có ngày dữ liệu không hợp lệ (trường 'cells' phải là mảng).");
        resetInput();
        return;
      }
      if (parsed.teams != null && !Array.isArray(parsed.teams)) {
        alert("❌ Tệp JSON có trường 'teams' không hợp lệ.");
        resetInput();
        return;
      }
      if (parsed.personnelAccounts != null && !Array.isArray(parsed.personnelAccounts)) {
        alert("❌ Tệp JSON có trường 'personnelAccounts' không hợp lệ.");
        resetInput();
        return;
      }
      if (parsed.accounts != null && (typeof parsed.accounts !== "object" || Array.isArray(parsed.accounts))) {
        alert("❌ Tệp JSON có trường 'accounts' không hợp lệ.");
        resetInput();
        return;
      }

      S = parsed;
      if (!S.swapRequests) S.swapRequests = [];
      if (!S.accounts) S.accounts = { ...DEFAULT_COMMANDER_ACCOUNTS };
      if (!S.personnelAccounts) S.personnelAccounts = [];
      if (typeof S.nightOnly !== "string") S.nightOnly = "";
      if (!S.teams || S.teams.length < 4) S.teams = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
      normalizeBorrowRules();
      syncFromTeamsToRosterAndAccounts();
      saveStorage();
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
  if (!S.accounts[u] || S.accounts[u] !== oldP) {
    alert("❌ Mật khẩu hiện tại không đúng!");
    return;
  }
  S.accounts[u] = newP;
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
  const password = acc ? (acc.password || "1") : "1";
  const dob = acc && acc.dob ? vnFormat(acc.dob) : "Chưa cập nhật";
  const hometown = acc && acc.hometown ? acc.hometown : "Chưa cập nhật";
  const initials = fullName.split(" ").pop().charAt(0).toUpperCase() || "Q";

  pop.innerHTML = `
    <div class="pop-header">
      <div class="pop-avatar">${initials}</div>
      <div class="pop-title-box">
        <h4>${fullName} (${code})</h4>
        <span>ĐỘI 3 — TỔ ${acc && acc.teamId ? acc.teamId : (teamId || 1)} · Click để mở hồ sơ</span>
      </div>
    </div>
    <div class="pop-row"><span class="pop-label">Họ và tên:</span><span class="pop-val">${fullName}</span></div>
    <div class="pop-row"><span class="pop-label">Mã số quân nhân:</span><span class="pop-val">${code}</span></div>
    <div class="pop-row"><span class="pop-label">Tổ biên chế cố định:</span><span class="pop-val" style="color:var(--primary-green);">Tổ ${acc && acc.teamId ? acc.teamId : (teamId || 1)}</span></div>
    <div class="pop-row"><span class="pop-label">Chức vụ:</span><span class="pop-val">${position}</span></div>
    <div class="pop-row"><span class="pop-label">Nhóm cắt gác:</span><span class="pop-val">${roleGroup}</span></div>
    <div class="pop-row"><span class="pop-label">Tên TK đăng nhập:</span><span class="pop-val" style="color:var(--primary-green);">${username}</span></div>
    <div class="pop-row"><span class="pop-label">Mật khẩu:</span><span class="pop-val">${password}</span></div>
    <div class="pop-row"><span class="pop-label">Ngày tháng năm sinh:</span><span class="pop-val">${dob}</span></div>
    <div class="pop-row"><span class="pop-label">Quê quán:</span><span class="pop-val">${hometown}</span></div>
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
  const safeP = p.replace(/'/g, "\'");
  return `<a href="tim-kiem.html?q=${encodeURIComponent(cleanName(p))}" class="person-hover-link" onmouseenter="showPersonnelHoverCard(event, '${safeP}')" onmousemove="movePersonnelHoverCard(event)" onmouseleave="hidePersonnelHoverCard()"><b>${p}</b></a>`;
}
