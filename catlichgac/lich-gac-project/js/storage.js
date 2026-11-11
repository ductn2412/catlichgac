let S = {
  officers: "",
  soldiers: "",
  days: {},
  swapRequests: [],
  accounts: { ...DEFAULT_COMMANDER_ACCOUNTS },
  personnelAccounts: []
};

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

// Đồng bộ từ danh sách S.personnelAccounts sang chuỗi S.officers và S.soldiers
function syncRosterStringsFromAccounts() {
  if (!S.personnelAccounts || !Array.isArray(S.personnelAccounts)) return;
  const offList = [];
  const solList = [];
  S.personnelAccounts.forEach(acc => {
    const label = formatFullAccountName(acc.fullName, acc.code);
    if (acc.roleType === "officer") {
      if (!offList.includes(label)) offList.push(label);
    } else {
      if (!solList.includes(label)) solList.push(label);
    }
  });
  S.officers = offList.join("\n");
  S.soldiers = solList.join("\n");
}

// Đồng bộ từ S.officers và S.soldiers ngược vào S.personnelAccounts (nếu Chỉ huy thêm nhanh ở trang Quản lý lịch)
function syncAccountsFromRosterStrings() {
  if (!S.personnelAccounts) S.personnelAccounts = [];
  const existingMap = {};
  S.personnelAccounts.forEach(a => {
    existingMap[formatFullAccountName(a.fullName, a.code).toLowerCase()] = a;
  });

  const newAccounts = [];
  parseNames(S.officers).forEach((item, idx) => {
    const key = item.toLowerCase();
    if (existingMap[key]) {
      existingMap[key].roleType = "officer";
      newAccounts.push(existingMap[key]);
    } else {
      const fn = cleanName(item);
      let cd = extractCode(item);
      if (cd === "Chưa cấp") cd = "SQ" + pad(idx + 1);
      const uName = formatFullAccountName(fn, cd);
      newAccounts.push({
        id: Date.now() + Math.random(),
        fullName: fn,
        code: cd,
        roleType: "officer",
        position: "Sĩ quan Đốc gác",
        username: uName,
        password: "1",
        dob: "1995-05-19",
        hometown: "Hà Nội"
      });
    }
  });

  parseNames(S.soldiers).forEach((item, idx) => {
    const key = item.toLowerCase();
    if (existingMap[key]) {
      existingMap[key].roleType = "soldier";
      newAccounts.push(existingMap[key]);
    } else {
      const fn = cleanName(item);
      let cd = extractCode(item);
      if (cd === "Chưa cấp") cd = "CS" + pad(idx + 1);
      const uName = formatFullAccountName(fn, cd);
      newAccounts.push({
        id: Date.now() + Math.random(),
        fullName: fn,
        code: cd,
        roleType: "soldier",
        position: "Chiến sĩ nghĩa vụ",
        username: uName,
        password: "1",
        dob: "2004-09-02",
        hometown: "Hải Dương"
      });
    }
  });

  S.personnelAccounts = newAccounts;
  syncRosterStringsFromAccounts();
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
  if (!S.officers && !S.soldiers && Object.keys(S.days).length === 0) {
    S.officers = [
      "Đại úy Nguyễn Văn An (SQ01)",
      "Thượng úy Trần Minh Tuấn (SQ02)",
      "Trung úy Lê Hoàng Nam (SQ03)",
      "Trung úy Phạm Quốc Bảo (SQ04)",
      "Thiếu úy Vũ Đức Thắng (SQ05)",
      "Thiếu úy Đặng Tiến Dũng (SQ06)"
    ].join("\n");

    S.soldiers = [
      "Bùi Văn Hùng (CS01)", "Đỗ Quang Hải (CS02)", "Hồ Sỹ Phúc (CS03)", "Lý Thành Long (CS04)",
      "Mai Xuân Trường (CS05)", "Ngô Văn Khải (CS06)", "Nguyễn Đình Phong (CS07)", "Nguyễn Hữu Tài (CS08)",
      "Nguyễn Mạnh Cường (CS09)", "Nguyễn Trọng Nghĩa (CS10)", "Nguyễn Văn Kiên (CS11)", "Nguyễn Việt Hoàng (CS12)",
      "Phan Thanh Bình (CS13)", "Phùng Quốc Khánh (CS14)", "Tạ Minh Quân (CS15)", "Trần Đình Trọng (CS16)",
      "Trần Quốc Tuấn (CS17)", "Trịnh Văn Quyết (CS18)", "Võ Minh Vương (CS19)", "Vương Đình Hiếu (CS20)",
      "Đinh Công Phượng (CS21)", "Lê Văn Xuân (CS22)", "Nguyễn Tiến Linh (CS23)", "Hoàng Đức Thịnh (CS24)"
    ].join("\n");

    syncAccountsFromRosterStrings();

    const cells60 = Array(60).fill("");
    const caOfficers = [
      "Đại úy Nguyễn Văn An (SQ01)",
      "Thượng úy Trần Minh Tuấn (SQ02)",
      "Trung úy Lê Hoàng Nam (SQ03)",
      "Trung úy Phạm Quốc Bảo (SQ04)"
    ];
    const caSoldiers = [
      ["Bùi Văn Hùng (CS01)", "Đỗ Quang Hải (CS02)", "Hồ Sỹ Phúc (CS03)", "Lý Thành Long (CS04)"],
      ["Mai Xuân Trường (CS05)", "Ngô Văn Khải (CS06)", "Nguyễn Đình Phong (CS07)", "Nguyễn Hữu Tài (CS08)"],
      ["Nguyễn Mạnh Cường (CS09)", "Nguyễn Trọng Nghĩa (CS10)", "Nguyễn Văn Kiên (CS11)", "Nguyễn Việt Hoàng (CS12)"],
      ["Phan Thanh Bình (CS13)", "Phùng Quốc Khánh (CS14)", "Tạ Minh Quân (CS15)", "Trần Đình Trọng (CS16)"]
    ];

    for (let ca = 0; ca < 4; ca++) {
      for (let slot = 0; slot < 3; slot++) {
        const row = ca * 3 + slot;
        cells60[row * 5 + 0] = caOfficers[ca];
        for (let c = 1; c < 5; c++) {
          cells60[row * 5 + c] = caSoldiers[ca][c - 1];
        }
      }
    }

    S.days[todayStr] = {
      cells: cells60,
      absent: {
        phep: "Trần Quốc Tuấn (CS17), Trịnh Văn Quyết (CS18)",
        congtac: "Thiếu úy Vũ Đức Thắng (SQ05), Võ Minh Vương (CS19)",
        om: "Vương Đình Hiếu (CS20)",
        om_tai_vien: "Đinh Công Phượng (CS21)",
        nghibu: "Lê Văn Xuân (CS22)",
        hoctap: "Nguyễn Tiến Linh (CS23)",
        khac: ""
      },
      streaks: {},
      manualCredits: {}
    };
    saveStorage();
  } else if (!S.personnelAccounts || S.personnelAccounts.length === 0) {
    syncAccountsFromRosterStrings();
    saveStorage();
  }
}

function loadStorage() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem("lich-gac-v10") || localStorage.getItem("lich-gac-v8") || localStorage.getItem("lich-gac-v4") || "null");
    if (raw && raw.days) {
      S = raw;
      if (!S.swapRequests) S.swapRequests = [];
      if (!S.accounts) S.accounts = { ...DEFAULT_COMMANDER_ACCOUNTS };
      if (!S.personnelAccounts) S.personnelAccounts = [];
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
    S.days[d] = { cells: Array(60).fill(""), absent: {}, streaks: {}, manualCredits: {} };
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
  return S.days[d];
}

function getSavedDatesHistory() {
  return Object.keys(S.days).filter(d => {
    return S.days[d].cells && S.days[d].cells.some(c => (c || "").trim() !== "");
  }).sort().reverse();
}

function getCurrentRole() {
  return localStorage.getItem(ROLE_KEY) || "commander";
}

function setCurrentRole(role) {
  localStorage.setItem(ROLE_KEY, role);
}

function getCurrentUserLabel() {
  return localStorage.getItem(USER_KEY) || "";
}

function setCurrentUserLabel(label) {
  localStorage.setItem(USER_KEY, label || "");
}

// Kiểm tra đăng nhập Chiến sĩ / Sĩ quan: chỉ cho phép khi đã được Chỉ huy thêm vào S.personnelAccounts
function authenticateSoldierLogin(inputUsername, inputPassword) {
  const uNorm = (inputUsername || "").trim().toLowerCase();
  const pNorm = (inputPassword || "").trim();
  if (!uNorm || !pNorm) return null;

  const list = S.personnelAccounts || [];
  for (const acc of list) {
    const fullLabel = formatFullAccountName(acc.fullName, acc.code).toLowerCase();
    const uAcc = (acc.username || fullLabel).trim().toLowerCase();
    const pass = (acc.password || "1").trim();

    // Cho phép khớp chính xác "Tên (Mã số)" (ví dụ: "Bùi Văn Hùng (CS01)") hoặc khớp "Tên Mã số"
    const altLabel = `${cleanName(acc.fullName)} ${acc.code}`.trim().toLowerCase();
    if ((uNorm === fullLabel || uNorm === uAcc || uNorm === altLabel) && pNorm === pass) {
      return acc;
    }
  }
  return null;
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
            if (slot === 2) result.nightShifts++;
            else result.dayShifts++;
            result.shiftsDetail.push({
              ca: ca + 1,
              slot: slot + 1,
              time: CA[ca][slot],
              isNight: slot === 2,
              position: posNames[col],
              col: col
            });
          }
        }
      }
    }
  }

  if (dayData.manualCredits && dayData.manualCredits[cName] != null) {
    result.credit = dayData.manualCredits[cName];
    return result;
  }

  if (result.totalSlots === 0) {
    result.credit = 0;
  } else if (
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
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed && parsed.days) {
        S = parsed;
        if (!S.personnelAccounts || !S.personnelAccounts.length) {
          syncAccountsFromRosterStrings();
        }
        saveStorage();
        alert("✅ Đã khôi phục dữ liệu hệ thống thành công!");
        window.location.reload();
      } else {
        alert("❌ Tệp JSON không đúng định dạng của hệ thống!");
      }
    } catch (err) {
      alert("❌ Lỗi đọc tệp JSON: " + err.message);
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


// Tìm thông tin đầy đủ của quân nhân trong S.personnelAccounts theo tên hoặc mã số
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

// Cập nhật đồng bộ tên/mã số mới của quân nhân trên toàn bộ lịch sử ngày gác và danh sách vắng khi Chỉ huy chỉnh sửa
function cascadeUpdatePersonnelName(oldLabel, oldCleanName, newLabel) {
  if (!oldLabel || !newLabel || oldLabel === newLabel) return;
  Object.keys(S.days || {}).forEach(dStr => {
    const day = S.days[dStr];
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

// Khởi tạo Popover hiển thị đầy đủ thông tin quân nhân khi trỏ chuột (hover) vào tên quân nhân
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
  const isCommander = (getCurrentRole() === "commander");

  const fullName = acc ? acc.fullName : cleanName(personIdentifier);
  const code = acc ? acc.code : extractCode(personIdentifier);
  const position = acc ? (acc.position || "Chiến sĩ nghĩa vụ") : "Quân nhân";
  const roleGroup = acc
    ? (acc.roleType === "officer" ? "Sĩ quan (Đốc gác 1)" : "Chiến sĩ nghĩa vụ (Vọng x9–x12)")
    : "Chưa phân nhóm";
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
        <span>ĐỘI 3 — TRUNG ĐOÀN · Click để mở trang hồ sơ đầy đủ</span>
      </div>
    </div>
    <div class="pop-row"><span class="pop-label">Họ và tên:</span><span class="pop-val">${fullName}</span></div>
    <div class="pop-row"><span class="pop-label">Mã số quân nhân:</span><span class="pop-val">${code}</span></div>
    <div class="pop-row"><span class="pop-label">Chức vụ:</span><span class="pop-val">${position}</span></div>
    <div class="pop-row"><span class="pop-label">Nhóm cắt gác:</span><span class="pop-val">${roleGroup}</span></div>
    <div class="pop-row"><span class="pop-label">Tên TK đăng nhập:</span><span class="pop-val" style="color:var(--primary-green);">${username}</span></div>
    <div class="pop-row"><span class="pop-label">Mật khẩu:</span><span class="pop-val">${isCommander ? password : password}</span></div>
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
  if (y + 310 > window.innerHeight) y = Math.max(10, window.innerHeight - 320);
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
