let curDate = fmtDate(new Date());
let currentRole = getCurrentRole();
let IN = [], SUP = [], TA = {};
// Lưu trạng thái ô nào đang được mở rộng để thay người theo khung giờ lẻ (key: "caIdx_colIdx")
let expandedCells = {};

function idxOf(day, n) {
  const cName = cleanName(n);
  for (let i = 0; i < 60; i++) {
    const cellVal = (day.cells[i] || "").trim();
    if (cellVal === n || cleanName(cellVal) === cName) return i;
  }
  return -1;
}

function calculateStreak(n, d) {
  let c = 0;
  while (S.days[d]) {
    const day = S.days[d], k = idxOf(day, n);
    if (k < 0) break;
    if (day.streaks && day.streaks[k] != null) return c + day.streaks[k];
    c++;
    d = addDay(d, -1);
  }
  return c;
}

function getChronoIndex(rowIdx) {
  const caIdx = Math.floor(rowIdx / 3);
  const slotIdx = rowIdx % 3;
  return slotIdx * 4 + caIdx;
}

function hasConsecutiveShift(day, person, cellIndex) {
  const cName = cleanName(person);
  if (!cName) return false;
  const rowIdx = Math.floor(cellIndex / 5);
  const myChrono = getChronoIndex(rowIdx);

  for (let k = 0; k < 60; k++) {
    if (k === cellIndex) continue;
    const otherName = cleanName(day.cells[k]);
    if (otherName === cName) {
      const otherRow = Math.floor(k / 5);
      const otherChrono = getChronoIndex(otherRow);
      if (Math.abs(myChrono - otherChrono) <= 1) {
        return true;
      }
    }
  }
  if (hasCrossDayConsecutiveError(curDate, person, cellIndex)) {
    return true;
  }
  return false;
}

function isCellSplit(day, caIdx, col) {
  const key = `${caIdx}_${col}`;
  if (expandedCells[key]) return true;
  const p0 = (day.cells[(caIdx * 3 + 0) * 5 + col] || "").trim();
  const p1 = (day.cells[(caIdx * 3 + 1) * 5 + col] || "").trim();
  const p2 = (day.cells[(caIdx * 3 + 2) * 5 + col] || "").trim();
  return (cleanName(p0) !== cleanName(p1) || cleanName(p0) !== cleanName(p2));
}

function toggleSplitCell(caIdx, col, split) {
  if (getCurrentRole() !== "commander") return;
  const key = `${caIdx}_${col}`;
  const day = getDayData(curDate);
  if (!split) {
    // Gộp lại thành 1 người đầu tiên cho cả 3 khung giờ
    const p0 = day.cells[(caIdx * 3 + 0) * 5 + col] || "";
    day.cells[(caIdx * 3 + 1) * 5 + col] = p0;
    day.cells[(caIdx * 3 + 2) * 5 + col] = p0;
    delete expandedCells[key];
    saveStorage();
  } else {
    expandedCells[key] = true;
  }
  buildScheduleTableDOM();
  render();
}

function buildScheduleTableDOM() {
  const tbody = document.getElementById("body");
  if (!tbody) return;
  tbody.innerHTML = "";
  IN = [];
  SUP = [];
  const day = getDayData(curDate);
  const isCommander = (getCurrentRole() === "commander");

  CA.forEach((slots, caIdx) => {
    const tr = document.createElement("tr");
    tr.dataset.ca = caIdx;

    const tdCa = document.createElement("td");
    tdCa.className = "ca-title";
    tdCa.innerHTML = `<strong>Ca ${caIdx + 1}</strong><div id="caTeamBadge_${caIdx}" style="margin-top:4px;font-size:11.5px;background:var(--hl);color:var(--primary-green);padding:2px 6px;border-radius:999px;border:1px solid var(--primary-green);">Tổ ${caIdx + 1}</div>`;
    tr.appendChild(tdCa);

    const tdTime = document.createElement("td");
    tdTime.className = "slot-time";
    tdTime.style.lineHeight = "1.65";
    tdTime.innerHTML = slots.map(s => `<div>${s}</div>`).join("");
    tr.appendChild(tdTime);

    for (let c = 0; c < 5; c++) {
      const td = document.createElement("td");
      const splitMode = isCellSplit(day, caIdx, c);

      if (!splitMode) {
        // CHỈ HIỂN THỊ 1 Ô DUY NHẤT CHO CẢ 3 KHUNG GIỜ CỦA CA
        const wrapper = document.createElement("div");
        wrapper.className = "cell single-ca-box";

        const inp = document.createElement("input");
        inp.className = "nm";
        inp.placeholder = c === 0 ? "Đốc gác (SQ)" : "Chiến sĩ (CS)";
        inp.setAttribute("list", c === 0 ? "dlO" : "dlS");
        inp.disabled = !isCommander;

        const sup = document.createElement("input");
        sup.className = "sup";
        sup.type = "number";
        sup.min = "0";
        sup.disabled = !isCommander;

        const k0 = (caIdx * 3 + 0) * 5 + c;
        const k1 = (caIdx * 3 + 1) * 5 + c;
        const k2 = (caIdx * 3 + 2) * 5 + c;

        const onSingleInput = () => {
          const d = getDayData(curDate);
          d.cells[k0] = inp.value;
          d.cells[k1] = inp.value;
          d.cells[k2] = inp.value;
          delete d.streaks[k0];
          d.teamInCa = detectTeamsInCa(d);
          saveStorage();
          refresh();
        };

        inp.addEventListener("input", onSingleInput);
        inp.addEventListener("change", onSingleInput);
        inp.addEventListener("mouseenter", (ev) => {
          if ((inp.value || "").trim()) showPersonnelHoverCard(ev, inp.value);
        });
        inp.addEventListener("mousemove", (ev) => {
          if ((inp.value || "").trim()) movePersonnelHoverCard(ev);
        });
        inp.addEventListener("mouseleave", () => hidePersonnelHoverCard());

        sup.addEventListener("input", () => {
          const d = getDayData(curDate);
          if (sup.value === "") delete d.streaks[k0];
          else d.streaks[k0] = Math.max(0, parseInt(sup.value, 10) || 0);
          saveStorage();
        });
        sup.addEventListener("blur", refresh);

        IN[k0] = inp;
        IN[k1] = inp;
        IN[k2] = inp;
        SUP[k0] = sup;
        SUP[k1] = sup;
        SUP[k2] = sup;

        wrapper.appendChild(inp);
        wrapper.appendChild(sup);

        if (isCommander) {
          const btnSplit = document.createElement("button");
          btnSplit.type = "button";
          btnSplit.className = "btn-split-slot no-print";
          btnSplit.title = "Bấm để thêm người làm thay ca ở khung giờ lẻ";
          btnSplit.textContent = "⇄ Thay ca lẻ";
          btnSplit.onclick = () => toggleSplitCell(caIdx, c, true);
          wrapper.appendChild(btnSplit);
        }

        td.appendChild(wrapper);
      } else {
        // KHI CÓ NGƯỜI THAY THẾ KHUNG GIỜ LẺ -> HIỂN THỊ 3 Ô TƯƠNG ỨNG VỚI 3 KHUNG GIỜ
        const container = document.createElement("div");
        container.className = "split-slots-container";

        slots.forEach((timeStr, slotIdx) => {
          const rowDiv = document.createElement("div");
          rowDiv.className = "split-slot-row";

          const timeLbl = document.createElement("span");
          timeLbl.className = "split-slot-time";
          timeLbl.textContent = timeStr.replace(" – ", "-");
          rowDiv.appendChild(timeLbl);

          const cellWrap = document.createElement("div");
          cellWrap.className = "cell";
          cellWrap.style.flex = "1";

          const inp = document.createElement("input");
          inp.className = "nm";
          inp.placeholder = c === 0 ? "Đốc gác" : "Chiến sĩ";
          inp.setAttribute("list", c === 0 ? "dlO" : "dlS");
          inp.disabled = !isCommander;

          const sup = document.createElement("input");
          sup.className = "sup";
          sup.type = "number";
          sup.min = "0";
          sup.disabled = !isCommander;

          const k = (caIdx * 3 + slotIdx) * 5 + c;

          const onSplitInput = () => {
            const d = getDayData(curDate);
            d.cells[k] = inp.value;
            delete d.streaks[k];
            d.teamInCa = detectTeamsInCa(d);
            saveStorage();
            refresh();
          };

          inp.addEventListener("input", onSplitInput);
          inp.addEventListener("change", onSplitInput);
          inp.addEventListener("mouseenter", (ev) => {
            if ((inp.value || "").trim()) showPersonnelHoverCard(ev, inp.value);
          });
          inp.addEventListener("mousemove", (ev) => {
            if ((inp.value || "").trim()) movePersonnelHoverCard(ev);
          });
          inp.addEventListener("mouseleave", () => hidePersonnelHoverCard());

          IN[k] = inp;
          SUP[k] = sup;

          cellWrap.appendChild(inp);
          cellWrap.appendChild(sup);
          rowDiv.appendChild(cellWrap);
          container.appendChild(rowDiv);
        });

        if (isCommander) {
          const btnMerge = document.createElement("button");
          btnMerge.type = "button";
          btnMerge.className = "btn-merge-slot no-print";
          btnMerge.textContent = "↑ Gộp 1 người cả ca";
          btnMerge.onclick = () => toggleSplitCell(caIdx, c, false);
          container.appendChild(btnMerge);
        }

        td.appendChild(container);
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
}

function applyRolePermissions() {
  currentRole = getCurrentRole();
  const isCommander = (currentRole === "commander");
  updateTopBarShared();

  const genBtn = document.getElementById("gen");
  const genWeekBtn = document.getElementById("genWeek");
  const leaveCard = document.getElementById("multiDayLeaveCard");
  const nightOnlyCard = document.getElementById("nightOnlyCard");
  const nightOnlyList = document.getElementById("nightOnlyList");

  if (genBtn) genBtn.style.display = isCommander ? "inline-block" : "none";
  if (genWeekBtn) genWeekBtn.style.display = isCommander ? "inline-block" : "none";
  if (leaveCard) leaveCard.style.display = isCommander ? "block" : "none";
  if (nightOnlyCard) nightOnlyCard.style.display = isCommander ? "block" : "none";
  if (nightOnlyList) nightOnlyList.disabled = !isCommander;

  for (let t = 1; t <= 4; t++) {
    const oEl = document.getElementById(`team${t}Off`);
    const sEl = document.getElementById(`team${t}Sol`);
    if (oEl) oEl.disabled = !isCommander;
    if (sEl) sEl.disabled = !isCommander;
  }

  const impBar = document.getElementById("importBarDiv");
  if (impBar) impBar.style.display = isCommander ? "flex" : "none";

  CATS.forEach(c => {
    if (TA[c[0]]) TA[c[0]].disabled = !isCommander;
  });

  buildScheduleTableDOM();
  render();
}

function resetDefaultTourTeams() {
  if (getCurrentRole() !== "commander") return;
  if (!confirm("Khôi phục danh sách biên chế 4 Tổ chuẩn theo file Tour gác và xếp lịch gốc cho ngày đang chọn?")) return;
  S.teams = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
  syncFromTeamsToRosterAndAccounts();

  const day = getDayData(curDate);
  day.teamInCa = [1, 2, 3, 4];
  expandedCells = {};
  for (let ca = 0; ca < 4; ca++) {
    const team = S.teams[ca];
    const docGac = team.officers[0] || "";
    const vongs = team.soldiers.slice(0, 4);
    for (let slot = 0; slot < 3; slot++) {
      const row = ca * 3 + slot;
      day.cells[row * 5 + 0] = docGac;
      for (let c = 1; c < 5; c++) {
        day.cells[row * 5 + c] = vongs[c - 1] || "";
      }
    }
  }
  saveStorage();
  populateTeamTextareas();
  buildScheduleTableDOM();
  render();
  alert("✅ Đã nạp danh sách 4 Tổ cố định và khởi tạo lịch gốc thành công!");
}

// ===== CẮT LỊCH TỰ ĐỘNG =====
// Quy tắc Tour cố định: mỗi ngày mỗi Tổ lùi 1 ca: Ca 1 -> Ca 4 -> Ca 3 -> Ca 2 -> Ca 1
function nextTeamMap(teamMap) {
  const m = (teamMap && teamMap.length === 4) ? teamMap : [1, 2, 3, 4];
  return [m[1], m[2], m[3], m[0]];
}

function dayOrdinal(dateStr) {
  return Math.floor(parseDate(dateStr).getTime() / 86400000);
}

function isPersonAbsentIn(ab, person) {
  const n = (person || "").trim();
  if (!n) return false;
  return !!(ab[cleanName(n)] || ab[n]);
}

function findPreviousOfficerForTeam(prevDay, teamId) {
  if (!prevDay || !prevDay.cells) return "";
  // Ưu tiên khung đêm (slot 2) vì đây là người chính của ca;
  // khung ban ngày có thể là người thay thế khi người chính chỉ làm ca đêm.
  for (const slot of [2, 0, 1]) {
    for (let ca = 0; ca < 4; ca++) {
      const n = (prevDay.cells[(ca * 3 + slot) * 5] || "").trim();
      if (n && getPersonTeamId(n) === teamId) return n;
    }
  }
  return "";
}

function pickOfficerForTeam(team, teamId, prevDay, ab, dateStr) {
  const list = (team.officers || []).filter(Boolean);
  if (!list.length) return "";

  const prev = findPreviousOfficerForTeam(prevDay, teamId);
  let start = 0;
  if (prev) {
    const idx = list.findIndex(n => cleanName(n).toLowerCase() === cleanName(prev).toLowerCase());
    if (idx >= 0) start = (idx + 1) % list.length;
  } else {
    const ord = dayOrdinal(dateStr);
    start = ((ord % list.length) + list.length) % list.length;
  }

  for (let i = 0; i < list.length; i++) {
    const cand = list[(start + i) % list.length];
    if (!isPersonAbsentIn(ab, cand)) return cand;
  }
  return "";
}

function pickSoldiersForTeam(team, ab, dateStr) {
  const list = (team.soldiers || []).filter(Boolean);
  const need = 4;
  if (!list.length) return [];

  // Xoay vòng 4/7: mỗi ngày dịch 1 người, đủ 7 ngày thì quay lại.
  const ord = dayOrdinal(dateStr);
  const start = ((ord % list.length) + list.length) % list.length;
  const picked = [];
  for (let i = 0; i < list.length && picked.length < need; i++) {
    const cand = list[(start + i) % list.length];
    if (!isPersonAbsentIn(ab, cand) && !picked.includes(cand)) picked.push(cand);
  }
  return picked;
}

// Danh sách đồng chí chỉ làm ca đêm (đang học tập buổi sáng)
function getNightOnlySet() {
  const set = {};
  parseNames(S.nightOnly || "").forEach(n => {
    const c = cleanName(n).toLowerCase();
    if (c) set[c] = true;
    set[n.trim().toLowerCase()] = true;
  });
  return set;
}

function isNightOnlyInSet(nightSet, person) {
  const n = (person || "").trim();
  if (!n) return false;
  return !!(nightSet[cleanName(n).toLowerCase()] || nightSet[n.toLowerCase()]);
}

// Chọn người cùng Tổ (không phải người chỉ làm ca đêm) để trực khung ban ngày
function pickDayReplacement(pool, usedSet, ab, nightSet, dateStr) {
  const list = (pool || []).filter(Boolean);
  if (!list.length) return "";
  const ord = dayOrdinal(dateStr);
  const start = ((ord % list.length) + list.length) % list.length;
  for (let i = 0; i < list.length; i++) {
    const cand = list[(start + i) % list.length];
    if (isPersonAbsentIn(ab, cand)) continue;
    if (isNightOnlyInSet(nightSet, cand)) continue;
    const key = cleanName(cand).toLowerCase();
    if (usedSet.has(key)) continue;
    usedSet.add(key);
    return cand;
  }
  return "";
}

function fillGeneratedPosition(cells, caIdx, col, dayPerson, nightPerson) {
  const base = caIdx * 3;
  cells[(base + 0) * 5 + col] = dayPerson || "";
  cells[(base + 1) * 5 + col] = dayPerson || "";
  cells[(base + 2) * 5 + col] = nightPerson || "";
}

function buildGeneratedDay(dateStr, teamMap, prevDay) {
  const day = getDayData(dateStr);
  const ab = absSet(day.absent || {});
  const nightSet = getNightOnlySet();
  const cells = Array(60).fill("");
  let unfilled = 0;

  for (let ca = 0; ca < 4; ca++) {
    const teamId = teamMap[ca] || (ca + 1);
    const team = (S.teams && S.teams[teamId - 1]) || (S.teams && S.teams[ca]);
    if (!team) continue;

    const used = new Set();

    // --- Đốc gác (Sĩ quan) ---
    const officer = pickOfficerForTeam(team, teamId, prevDay, ab, dateStr);
    if (officer) used.add(cleanName(officer).toLowerCase());

    let officerDay = officer;
    let officerNight = officer;
    if (officer && isNightOnlyInSet(nightSet, officer)) {
      officerNight = officer;
      officerDay = pickDayReplacement(team.officers || [], used, ab, nightSet, dateStr);
      if (!officerDay) unfilled++;
    }
    fillGeneratedPosition(cells, ca, 0, officerDay, officerNight);

    // --- Chiến sĩ Vọng gác ---
    const soldiers = pickSoldiersForTeam(team, ab, dateStr);
    soldiers.forEach(s => { if (s) used.add(cleanName(s).toLowerCase()); });

    for (let idx = 0; idx < 4; idx++) {
      const soldier = soldiers[idx];
      if (!soldier) {
        fillGeneratedPosition(cells, ca, idx + 1, "", "");
        unfilled++;
        continue;
      }

      let dayPerson = soldier;
      let nightPerson = soldier;
      if (isNightOnlyInSet(nightSet, soldier)) {
        nightPerson = soldier;
        dayPerson = pickDayReplacement(team.soldiers || [], used, ab, nightSet, dateStr);
        if (!dayPerson) unfilled++;
      }
      fillGeneratedPosition(cells, ca, idx + 1, dayPerson, nightPerson);
    }
  }

  day.cells = cells;
  day.teamInCa = teamMap.slice();
  day.streaks = {};
  if (!day.manualCredits) day.manualCredits = {};
  return { day, unfilled };
}

function dayHasSchedule(dateStr) {
  const day = S.days && S.days[dateStr];
  return !!(day && Array.isArray(day.cells) && day.cells.some(c => (c || "").trim() !== ""));
}

function generateSchedule() {
  if (getCurrentRole() !== "commander") {
    alert("Chỉ có Chỉ huy / Trưởng ban mới được cắt lịch!");
    return;
  }

  const targetDate = addDay(curDate, 1);
  if (dayHasSchedule(targetDate) && !confirm(`Ngày ${vnFormat(targetDate)} đã có lịch. Cắt lại lịch cho ngày mai?`)) {
    return;
  }

  const prevDay = getDayData(curDate);
  const teamMap = nextTeamMap(detectTeamsInCa(prevDay));
  const built = buildGeneratedDay(targetDate, teamMap, prevDay);

  saveStorage();
  curDate = targetDate;
  expandedCells = {};
  buildScheduleTableDOM();
  render();

  let msg = `✅ Đã cắt lịch ngày ${vnFormat(targetDate)} (${DOW[parseDate(targetDate).getDay()]}) thành công!`;
  if (built.unfilled > 0) {
    msg += `\n⚠️ Có ${built.unfilled} khung giờ ban ngày chưa bố trí được người thay (thiếu quân số không học buổi sáng).`;
  }
  alert(msg);
}

function generateWeekSchedule() {
  if (getCurrentRole() !== "commander") {
    alert("Chỉ có Chỉ huy / Trưởng ban mới được cắt lịch!");
    return;
  }

  const startDate = addDay(curDate, 1);
  const dates = [];
  for (let i = 0; i < 7; i++) dates.push(addDay(startDate, i));

  const existing = dates.filter(dayHasSchedule);
  if (existing.length && !confirm(`Đã có lịch cho ${existing.length} ngày trong 7 ngày tới. Cắt lại toàn bộ 7 ngày?`)) {
    return;
  }

  let prevDay = getDayData(curDate);
  let teamMap = nextTeamMap(detectTeamsInCa(prevDay));
  let totalUnfilled = 0;

  dates.forEach(dStr => {
    const built = buildGeneratedDay(dStr, teamMap, prevDay);
    totalUnfilled += built.unfilled;
    prevDay = built.day;
    teamMap = nextTeamMap(teamMap);
  });

  saveStorage();
  curDate = startDate;
  expandedCells = {};
  buildScheduleTableDOM();
  render();

  let msg = `✅ Đã cắt lịch 7 ngày (từ ${vnFormat(startDate)} đến ${vnFormat(dates[6])}) thành công!`;
  if (totalUnfilled > 0) {
    msg += `\n⚠️ Có ${totalUnfilled} khung giờ ban ngày chưa bố trí được người thay (thiếu quân số không học buổi sáng).`;
  }
  alert(msg);
}

function populateTeamTextareas() {
  if (!S.teams || S.teams.length < 4) S.teams = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
  for (let i = 0; i < 4; i++) {
    const oEl = document.getElementById(`team${i + 1}Off`);
    const sEl = document.getElementById(`team${i + 1}Sol`);
    if (oEl) oEl.value = (S.teams[i].officers || []).join("\n");
    if (sEl) sEl.value = (S.teams[i].soldiers || []).join("\n");
  }
  const offT = document.getElementById("offT");
  const solT = document.getElementById("solT");
  if (offT) offT.value = S.officers || "";
  if (solT) solT.value = S.soldiers || "";
}

function populateNightOnlyTextarea() {
  const el = document.getElementById("nightOnlyList");
  if (el) el.value = S.nightOnly || "";
  updateNightOnlyMsg();
}

function updateNightOnlyMsg() {
  const msg = document.getElementById("nightOnlyMsg");
  if (!msg) return;
  const list = parseNames(S.nightOnly || "");
  msg.textContent = list.length
    ? `✅ Đang áp dụng cho ${list.length} đồng chí chỉ làm ca đêm: ${list.join(", ")}`
    : "Chưa có đồng chí nào được đánh dấu chỉ làm ca đêm.";
}

function saveNightOnlyList() {
  const el = document.getElementById("nightOnlyList");
  if (!el) return;
  if (getCurrentRole() !== "commander") {
    el.value = S.nightOnly || "";
    return;
  }
  S.nightOnly = el.value;
  saveStorage();
  updateNightOnlyMsg();
}

function saveTeamsFromTextareas() {
  for (let i = 0; i < 4; i++) {
    const oEl = document.getElementById(`team${i + 1}Off`);
    const sEl = document.getElementById(`team${i + 1}Sol`);
    if (oEl && sEl) {
      S.teams[i].officers = parseNames(oEl.value);
      S.teams[i].soldiers = parseNames(sEl.value);
    }
  }
  syncFromTeamsToRosterAndAccounts();
  saveStorage();
  const rmsg = document.getElementById("rmsg");
  if (rmsg) {
    rmsg.textContent = `✅ Đã đồng bộ 4 Tổ cố định: Tổng ${parseNames(S.officers).length} Đốc gác (Sĩ quan) & ${parseNames(S.soldiers).length} Chiến sĩ nghĩa vụ.`;
  }
  refresh();
}

function applyMultiDayAbsence() {
  if (getCurrentRole() !== "commander") {
    alert("Chỉ có Chỉ huy mới được đăng ký vắng dài ngày!");
    return;
  }
  const person = (document.getElementById("leavePerson").value || "").trim();
  const catKey = document.getElementById("leaveType").value;
  const startStr = document.getElementById("leaveStart").value;
  const endStr = document.getElementById("leaveEnd").value;

  if (!person || !startStr || !endStr) {
    alert("Vui lòng chọn chiến sĩ và nhập đủ Từ ngày - Đến ngày!");
    return;
  }
  if (startStr > endStr) {
    alert("Ngày bắt đầu không được lớn hơn ngày kết thúc!");
    return;
  }

  let d = startStr;
  let countDays = 0;
  const cName = cleanName(person);

  while (d <= endStr && countDays < 120) {
    const dayData = getDayData(d);
    CATS.forEach(c => {
      let list = parseNames(dayData.absent[c[0]]);
      list = list.filter(n => cleanName(n) !== cName);
      dayData.absent[c[0]] = list.join(", ");
    });
    let targetList = parseNames(dayData.absent[catKey]);
    if (!targetList.some(n => cleanName(n) === cName)) {
      targetList.push(person);
    }
    dayData.absent[catKey] = targetList.join(", ");
    dayData.cells = dayData.cells.map(c => cleanName(c) === cName ? "" : c);

    d = addDay(d, 1);
    countDays++;
  }

  saveStorage();
  render();
  alert(`✅ Đã đăng ký vắng mặt cho chiến sĩ "${person}" trong ${countDays} ngày (từ ${vnFormat(startStr)} đến ${vnFormat(endStr)}). Các đồng chí cùng Tổ sẽ tự động thay thế khi cắt lịch!`);
}

function initUI() {
  loadStorage();

  const catsContainer = document.getElementById("cats");
  catsContainer.innerHTML = "";
  CATS.forEach(c => {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `<div class="lb">* ${c[1]} (${c[2]}) <em id="n_${c[0]}">0</em></div>`;
    const ta = document.createElement("textarea");
    ta.rows = 2;
    ta.placeholder = "Tên chiến sĩ, cách nhau bằng dấu phẩy";
    ta.addEventListener("input", () => {
      getDayData(curDate).absent[c[0]] = ta.value;
      saveStorage();
      refresh();
    });
    TA[c[0]] = ta;
    row.appendChild(ta);
    catsContainer.appendChild(row);
  });

  populateTeamTextareas();
  populateNightOnlyTextarea();
  for (let t = 1; t <= 4; t++) {
    ["team" + t + "Off", "team" + t + "Sol"].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        ["input", "change", "keyup", "blur"].forEach(ev => {
          el.addEventListener(ev, saveTeamsFromTextareas);
        });
      }
    });
  }

  document.getElementById("prev").onclick = () => navigateDate(-1);
  document.getElementById("next").onclick = () => navigateDate(1);
  document.getElementById("today").onclick = () => setDate(fmtDate(new Date()));
  document.getElementById("date").onchange = (e) => { if (e.target.value) setDate(e.target.value); };

  const leaveStart = document.getElementById("leaveStart");
  const leaveEnd = document.getElementById("leaveEnd");
  if (leaveStart && leaveEnd) {
    leaveStart.value = curDate;
    leaveEnd.value = addDay(curDate, 3);
  }

  buildScheduleTableDOM();
  render();
  applyRolePermissions();
}

function updateHistoryDropdown() {
  const select = document.getElementById("historySelect");
  select.innerHTML = '<option value="">-- Lịch sử ngày đã cắt gác --</option>';
  getSavedDatesHistory().forEach(d => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = `${vnFormat(d)} (${DOW[parseDate(d).getDay()]})`;
    select.appendChild(opt);
  });
  select.onchange = (e) => {
    if (e.target.value) setDate(e.target.value);
  };
}

function navigateDate(days) {
  curDate = addDay(curDate, days);
  expandedCells = {};
  buildScheduleTableDOM();
  render();
}

function setDate(dStr) {
  curDate = dStr;
  expandedCells = {};
  buildScheduleTableDOM();
  render();
}

function fillDataList(id, arr) {
  const dl = document.getElementById(id);
  if (!dl) return;
  dl.innerHTML = "";
  arr.forEach(n => {
    const o = document.createElement("option");
    o.value = n;
    dl.appendChild(o);
  });
}

function renderChips(el, arr, emptyText) {
  el.innerHTML = "";
  if (!arr.length) {
    el.innerHTML = `<span class="empty">${emptyText}</span>`;
    return;
  }
  arr.forEach(n => {
    const span = document.createElement("span");
    span.className = "chip person-hover-link";
    span.style.cursor = "pointer";
    const tid = getPersonTeamId(n);
    span.textContent = tid ? `${n} [Tổ ${tid}]` : n;
    span.onmouseenter = (ev) => showPersonnelHoverCard(ev, n);
    span.onmousemove = (ev) => movePersonnelHoverCard(ev);
    span.onmouseleave = () => hidePersonnelHoverCard();
    span.onclick = () => { window.location.href = `tim-kiem.html?q=${encodeURIComponent(cleanName(n))}`; };
    el.appendChild(span);
  });
}

function refresh() {
  const day = getDayData(curDate);
  const off = parseNames(S.officers);
  const sol = parseNames(S.soldiers);
  const ab = absSet(day.absent);
  const oS = toSet(off);
  const sS = toSet(sol);

  fillDataList("dlO", off);
  fillDataList("dlS", sol);
  fillDataList("dlAll", [...off, ...sol]);

  const detectedTeams = detectTeamsInCa(day);
  day.teamInCa = detectedTeams;
  for (let ca = 0; ca < 4; ca++) {
    const badgeEl = document.getElementById(`caTeamBadge_${ca}`);
    if (badgeEl) badgeEl.textContent = `Tổ ${detectedTeams[ca] || (ca + 1)}`;
  }

  const absIn = [], wrong = [], consecutiveErrors = [], crossTeamErrors = [];
  const workingOfficers = {}, workingSoldiers = {}, allWorking = {};

  for (let k = 0; k < 60; k++) {
    const n = (day.cells[k] || "").trim();
    const cName = cleanName(n);
    const col = k % 5;
    const caIdx = Math.floor(Math.floor(k / 5) / 3);
    const expectedTeamId = detectedTeams[caIdx];

    let wg = false;
    let isCon = false;
    let isWrongTeam = false;

    if (n) {
      allWorking[cName] = 1;
      if (col === 0) workingOfficers[cName] = 1;
      else workingSoldiers[cName] = 1;

      if (col === 0) {
        if (!oS[cName] && !oS[n]) {
          wg = true;
          wrong.push(`${n} (Cột Đốc gác chỉ lấy từ Sĩ quan Đốc gác)`);
        }
      } else {
        if (!sS[cName] && !sS[n]) {
          wg = true;
          wrong.push(`${n} (Vọng gác chỉ lấy từ Chiến sĩ nghĩa vụ)`);
        }
      }

      const personTeamId = getPersonTeamId(n);
      if (personTeamId && expectedTeamId && personTeamId !== expectedTeamId) {
        isWrongTeam = true;
        crossTeamErrors.push(`${n} thuộc Tổ ${personTeamId} nhưng đang xếp vào Ca ${caIdx + 1} của Tổ ${expectedTeamId}`);
      }

      if (hasConsecutiveShift(day, n, k)) {
        isCon = true;
        consecutiveErrors.push(n);
      }
    }

    const isBad = !!(n && (ab[cName] || ab[n] || wg || isCon || isWrongTeam));
    if (IN[k]) IN[k].classList.toggle("bad", isBad);

    if (SUP[k]) {
      SUP[k].style.visibility = n ? "visible" : "hidden";
      if (document.activeElement !== SUP[k]) {
        SUP[k].value = n ? (day.streaks[k] != null ? day.streaks[k] : calculateStreak(n, curDate)) : "";
      }
    }
  }

  const restO = off.filter(n => !ab[cleanName(n)] && !allWorking[cleanName(n)]);
  const restS = sol.filter(n => !ab[cleanName(n)] && !allWorking[cleanName(n)]);

  renderChips(document.getElementById("listO"), restO, off.length ? "Không có ai." : "Nhập danh sách sĩ quan ở Phần 1.");
  renderChips(document.getElementById("listS"), restS, sol.length ? "Không có ai." : "Nhập danh sách chiến sĩ ở Phần 1.");

  document.getElementById("cntO").textContent = off.length ? `(${restO.length} đồng chí — mỗi Tổ có 2 Đốc gác nghỉ luân phiên)` : "";
  document.getElementById("cntS").textContent = sol.length ? `(${restS.length} đồng chí — mỗi Tổ có 3 Chiến sĩ nghỉ xoay vòng)` : "";

  const gacOffCount = Object.keys(workingOfficers).length;
  const gacSolCount = Object.keys(workingSoldiers).length;
  const gacTotal = Object.keys(allWorking).length;
  const restTotal = restO.length + restS.length;

  let absTotal = 0;
  const statCardsHtml = [
    `<div class="stat-card"><span>🛡️ Đang gác (4 Tổ)</span><b>${gacTotal} người (${gacOffCount} Đốc gác, ${gacSolCount} Chiến sĩ)</b></div>`,
    `<div class="stat-card"><span>⛺ Trực cơ động (Nghỉ tại Tổ)</span><b>${restTotal} người (${restO.length} SQ, ${restS.length} CS)</b></div>`
  ];

  CATS.forEach(c => {
    const list = parseNames(day.absent[c[0]]);
    const m = list.length;
    absTotal += m;
    document.getElementById(`n_${c[0]}`).textContent = m;
    statCardsHtml.push(`<div class="stat-card"><span>📌 ${c[1]} (${c[2]})</span><b>${m} người</b></div>`);
  });

  const rosterTotal = off.length + sol.length;
  const computedTotal = gacTotal + restTotal + absTotal;
  const finalUnitTotal = rosterTotal > 0 ? rosterTotal : computedTotal;

  document.getElementById("totalUnit").textContent = finalUnitTotal;
  document.getElementById("unitBreakdownSub").textContent =
    `Biên chế 4 Tổ: ${off.length} Đốc gác (3 người/Tổ) + ${sol.length} Chiến sĩ (7 người/Tổ) | Đang gác: ${gacTotal} · Nghỉ xoay vòng: ${restTotal} · Vắng: ${absTotal}`;
  document.getElementById("detailedStatGrid").innerHTML = statCardsHtml.join("");

  const warnEl = document.getElementById("warn");
  warnEl.innerHTML = "";
  const warnings = [];
  
  let hasCriticalError = false;
  for (let k = 0; k < 60; k++) {
    const n = (day.cells[k] || "").trim();
    if (!n) continue;
    const cName = cleanName(n);
    const col = k % 5;
    const caIdx = Math.floor(Math.floor(k / 5) / 3);
    const expectedTeamId = detectedTeams[caIdx];
    const personTeamId = getPersonTeamId(n);

    if (ab[cName] || ab[n]) {
      hasCriticalError = true;
      absIn.push(n);
    }
    if (hasConsecutiveShift(day, n, k)) {
      hasCriticalError = true;
      consecutiveErrors.push(n);
    }
    if ((col === 0 && !oS[cName] && !oS[n]) || (col > 0 && !sS[cName] && !sS[n])) {
      hasCriticalError = true;
    }
    if (personTeamId && expectedTeamId && personTeamId !== expectedTeamId) {
      hasCriticalError = true;
    }
  }

  if (absIn.length) warnings.push("❌ BÁO ĐỎ: Chiến sĩ đang trong danh sách nghỉ/vắng (phép, ốm, công tác...) vẫn bị xếp gác: " + Array.from(new Set(absIn)).join(", "));
  if (consecutiveErrors.length) warnings.push("❌ BÁO ĐỎ: Có chiến sĩ làm 2 ca liền giờ nhau: " + Array.from(new Set(consecutiveErrors)).join(", "));
  if (wrong.length) warnings.push("❌ BÁO ĐỎ SAI CHỨC DANH (Đốc gác không thay cho Chiến sĩ và ngược lại): " + Array.from(new Set(wrong)).join(" | "));
  if (crossTeamErrors.length) warnings.push("❌ BÁO ĐỎ LẪN TỔ GÁC (Chiến sĩ chỉ thay thế trong cùng 1 Tổ cố định): " + Array.from(new Set(crossTeamErrors)).join(" | "));

  warnings.forEach(w => {
    const div = document.createElement("div");
    div.textContent = w;
    warnEl.appendChild(div);
  });

  // Nút cắt lịch luôn bấm được với Chỉ huy; các lỗi dữ liệu chỉ hiển thị cảnh báo đỏ,
  // không khóa nút để tránh trường hợp lịch cũ bị lỗi khiến không thể cắt lịch mới.
  if (currentRole === 'commander') {
    const genBtn = document.getElementById("gen");
    if (genBtn) genBtn.disabled = false;
    const genWeekBtn = document.getElementById("genWeek");
    if (genWeekBtn) genWeekBtn.disabled = false;
  }

  updateHistoryDropdown();
}

function render() {
  const day = getDayData(curDate);
  document.getElementById("date").value = curDate;
  document.getElementById("dow").textContent = DOW[parseDate(curDate).getDay()];
  buildScheduleTableDOM();
  for (let k = 0; k < 60; k++) {
    if (IN[k]) IN[k].value = day.cells[k] || "";
  }
  CATS.forEach(c => { TA[c[0]].value = day.absent[c[0]] || ""; });
  refresh();
}

// Khởi động trang Quản lý lập lịch sau khi DOM sẵn sàng
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUI);
} else {
  initUI();
}
