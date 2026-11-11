let curDate = fmtDate(new Date());
let currentRole = getCurrentRole();
let IN = [], SUP = [], TA = {}, CA_TEAM_BADGE = [];

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

function applyRolePermissions() {
  currentRole = getCurrentRole();
  const isCommander = (currentRole === "commander");
  updateTopBarShared();

  const genBtn = document.getElementById("gen");
  const genWeekBtn = document.getElementById("genWeek");
  const leaveCard = document.getElementById("multiDayLeaveCard");

  if (genBtn) genBtn.style.display = isCommander ? "inline-block" : "none";
  if (genWeekBtn) genWeekBtn.style.display = isCommander ? "inline-block" : "none";
  if (leaveCard) leaveCard.style.display = isCommander ? "block" : "none";

  for (let t = 1; t <= 4; t++) {
    const oEl = document.getElementById(`team${t}Off`);
    const sEl = document.getElementById(`team${t}Sol`);
    if (oEl) oEl.disabled = !isCommander;
    if (sEl) sEl.disabled = !isCommander;
  }

  const impBar = document.getElementById("importBarDiv");
  if (impBar) impBar.style.display = isCommander ? "flex" : "none";

  for (let k = 0; k < 60; k++) {
    if (IN[k]) IN[k].disabled = !isCommander;
    if (SUP[k]) SUP[k].disabled = !isCommander;
  }
  CATS.forEach(c => {
    if (TA[c[0]]) TA[c[0]].disabled = !isCommander;
  });

  refresh();
}

function resetDefaultTourTeams() {
  if (getCurrentRole() !== "commander") return;
  if (!confirm("Khôi phục danh sách biên chế 4 Tổ chuẩn theo file Tour gác và xếp lịch gốc cho ngày đang chọn?")) return;
  S.teams = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
  syncFromTeamsToRosterAndAccounts();

  const day = getDayData(curDate);
  day.teamInCa = [1, 2, 3, 4];
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
  render();
  alert("✅ Đã nạp danh sách 4 Tổ cố định và khởi tạo lịch gốc thành công!");
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
    alert("Vui lòng chọn quân nhân và nhập đủ Từ ngày - Đến ngày!");
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
  alert(`✅ Đã đăng ký vắng mặt cho "${person}" trong ${countDays} ngày (từ ${vnFormat(startStr)} đến ${vnFormat(endStr)}). Các đồng chí cùng Tổ sẽ tự động thay thế khi cắt lịch!`);
}

function initUI() {
  loadStorage();
  
  const tbody = document.getElementById("body");
  tbody.innerHTML = "";

  CA.forEach((slots, caIdx) => {
    slots.forEach((timeStr, slotIdx) => {
      const tr = document.createElement("tr");
      tr.dataset.ca = caIdx;

      if (slotIdx === 0) {
        const tdCa = document.createElement("td");
        tdCa.className = "ca-title";
        tdCa.rowSpan = 3;
        tdCa.innerHTML = `<strong>Ca ${caIdx + 1}</strong><div id="caTeamBadge_${caIdx}" style="margin-top:4px;font-size:11.5px;background:var(--hl);color:var(--primary-green);padding:2px 6px;border-radius:999px;border:1px solid var(--primary-green);">Tổ ${caIdx + 1}</div>`;
        tr.appendChild(tdCa);
      }

      const tdTime = document.createElement("td");
      tdTime.className = "slot-time";
      tdTime.textContent = timeStr;
      tr.appendChild(tdTime);

      const rowIdx = caIdx * 3 + slotIdx;

      for (let c = 0; c < 5; c++) {
        const td = document.createElement("td");
        const wrapper = document.createElement("div");
        wrapper.className = "cell";
        
        const inp = document.createElement("input");
        inp.className = "nm";
        inp.placeholder = c === 0 ? "Đốc gác (SQ)" : "Chiến sĩ (CS)";
        inp.setAttribute("list", c === 0 ? "dlO" : "dlS");
        
        const sup = document.createElement("input");
        sup.className = "sup";
        sup.type = "number";
        sup.min = "0";

        const k = rowIdx * 5 + c;

        const onNameInput = () => {
          const d = getDayData(curDate);
          d.cells[k] = inp.value;

          if (slotIdx === 0) {
            const k2 = (rowIdx + 1) * 5 + c;
            const k3 = (rowIdx + 2) * 5 + c;
            d.cells[k2] = inp.value;
            d.cells[k3] = inp.value;
            if (IN[k2]) IN[k2].value = inp.value;
            if (IN[k3]) IN[k3].value = inp.value;
          }

          delete d.streaks[k];
          d.teamInCa = detectTeamsInCa(d);
          saveStorage();
          refresh();
        };

        inp.addEventListener("input", onNameInput);
        inp.addEventListener("change", onNameInput);
        inp.addEventListener("mouseenter", (ev) => {
          if ((inp.value || "").trim()) showPersonnelHoverCard(ev, inp.value);
        });
        inp.addEventListener("mousemove", (ev) => {
          if ((inp.value || "").trim()) movePersonnelHoverCard(ev);
        });
        inp.addEventListener("mouseleave", () => hidePersonnelHoverCard());

        sup.addEventListener("input", () => {
          const d = getDayData(curDate);
          if (sup.value === "") delete d.streaks[k];
          else d.streaks[k] = Math.max(0, parseInt(sup.value, 10) || 0);
          saveStorage();
        });
        sup.addEventListener("blur", refresh);

        IN[k] = inp;
        SUP[k] = sup;
        wrapper.appendChild(inp);
        wrapper.appendChild(sup);
        td.appendChild(wrapper);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
  });

  const catsContainer = document.getElementById("cats");
  catsContainer.innerHTML = "";
  CATS.forEach(c => {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `<div class="lb">* ${c[1]} (${c[2]}) <em id="n_${c[0]}">0</em></div>`;
    const ta = document.createElement("textarea");
    ta.rows = 2;
    ta.placeholder = "Tên người, cách nhau bằng dấu phẩy";
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
  render();
}

function setDate(dStr) {
  curDate = dStr;
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
    IN[k].classList.toggle("bad", isBad);

    SUP[k].style.visibility = n ? "visible" : "hidden";
    if (document.activeElement !== SUP[k]) {
      SUP[k].value = n ? (day.streaks[k] != null ? day.streaks[k] : calculateStreak(n, curDate)) : "";
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

  if (absIn.length) warnings.push("❌ BÁO ĐỎ: Đồng chí đang trong danh sách nghỉ/vắng (phép, ốm, công tác...) vẫn bị xếp gác: " + Array.from(new Set(absIn)).join(", "));
  if (consecutiveErrors.length) warnings.push("❌ BÁO ĐỎ: Có nhân sự làm 2 ca liền giờ nhau: " + Array.from(new Set(consecutiveErrors)).join(", "));
  if (wrong.length) warnings.push("❌ BÁO ĐỎ SAI CHỨC DANH (Đốc gác không thay cho Chiến sĩ và ngược lại): " + Array.from(new Set(wrong)).join(" | "));
  if (crossTeamErrors.length) warnings.push("❌ BÁO ĐỎ LẪN TỔ GÁC (Nhân sự chỉ thay thế trong cùng 1 Tổ cố định): " + Array.from(new Set(crossTeamErrors)).join(" | "));

  warnings.forEach(w => {
    const div = document.createElement("div");
    div.textContent = w;
    warnEl.appendChild(div);
  });

  if (currentRole === 'commander') {
    document.getElementById("gen").disabled = hasCriticalError;
    const gw = document.getElementById("genWeek");
    if (gw) gw.disabled = hasCriticalError;
  }

  updateHistoryDropdown();
}

function render() {
  const day = getDayData(curDate);
  document.getElementById("date").value = curDate;
  document.getElementById("dow").textContent = DOW[parseDate(curDate).getDay()];
  for (let k = 0; k < 60; k++) IN[k].value = day.cells[k] || "";
  CATS.forEach(c => { TA[c[0]].value = day.absent[c[0]] || ""; });
  refresh();
}

function lastWorkedDate(n, beforeDate) {
  let last = "";
  Object.keys(S.days).sort().forEach(d => {
    if (d < beforeDate && idxOf(S.days[d], n) >= 0) last = d;
  });
  return last;
}

function getFairnessScore(n, dStr) {
  let nightCount = 0;
  let d = parseDate(dStr);
  for (let i = 0; i < 7; i++) {
    const ds = fmtDate(d);
    const day = S.days[ds];
    if (day) {
      for (let r = 6; r < 12; r++) {
        for (let col = 0; col < 5; col++) {
          if (cleanName(day.cells[r * 5 + col]) === cleanName(n)) nightCount++;
        }
      }
    }
    d.setDate(d.getDate() - 1);
  }
  return nightCount;
}

/* ==================== THUẬT TOÁN CẮT LỊCH THEO 4 TỔ CỐ ĐỊNH (TOUR GÁC) ====================
 * 1. Mỗi Tổ (Tổ 1, Tổ 2, Tổ 3, Tổ 4) giữ nguyên đội hình và lùi ca mỗi ngày:
 *    Ca 1 (0) -> Ca 4 (3) -> Ca 3 (2) -> Ca 2 (1) -> Ca 1 (0) (Công thức: destCa = (srcCa + 3) % 4).
 * 2. Đốc gác (3 đồng chí/Tổ):
 *    Mỗi đồng chí làm 1 ngày rồi luân phiên cho đồng chí tiếp theo trong cùng Tổ:
 *    VD Tổ 1: Ngày 1 Vũ (Ca 1) -> Ngày 2 Nam (Ca 4) -> Ngày 3 Trình (Ca 3) -> Ngày 4 Vũ (Ca 2) -> Ngày 5 Nam (Ca 1)...
 *    Nếu đồng chí đến lượt đang nghỉ phép/công tác/ốm, tự động nhảy sang đồng chí tiếp theo trong Tổ.
 * 3. Chiến sĩ nghĩa vụ (7 đồng chí/Tổ):
 *    Chỉ thay thế và xoay vọng nội bộ trong cùng Tổ (x9 -> x10 -> x11 -> x12 -> x9).
 *    Đưa chiến sĩ đang nghỉ của Tổ đó vào thay cho các chiến sĩ có số ngày gác liên tục cao nhất trong Tổ.
 *    Nếu có chiến sĩ nghỉ phép/ốm/công tác, các chiến sĩ còn lại trong Tổ tiếp tục xoay vòng đảm nhiệm cho đến khi đồng chí đó trở lại.
 */
function cutOneDayInternal(sourceDate) {
  if (!S.teams || S.teams.length < 4) S.teams = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
  const src = getDayData(sourceDate);
  const tk = addDay(sourceDate, 1);
  const old = S.days[tk];

  const tabs = (old && Object.keys(old.absent || {}).length > 0)
    ? old.absent
    : JSON.parse(JSON.stringify(src.absent));
  const ab = absSet(tabs);
  const sw = workSet(src);

  const srcTeamsInCa = detectTeamsInCa(src);
  const nextTeamsInCa = [1, 2, 3, 4];
  const base20 = Array(20).fill("");

  for (let srcCa = 0; srcCa < 4; srcCa++) {
    const destCa = (srcCa + 3) % 4; // Ca 1->4, Ca 4->3, Ca 3->2, Ca 2->1
    const teamId = srcTeamsInCa[srcCa] || (srcCa + 1);
    nextTeamsInCa[destCa] = teamId;
    const team = S.teams[teamId - 1] || S.teams[0];

    // --- A. CHỌN ĐỐC GÁC TIẾP THEO TRONG CÙNG TỔ (LUÂN PHIÊN 1 NGÀY / NGƯỜI) ---
    const teamOfficers = team.officers || [];
    const prevOfficerRaw = (src.cells[(srcCa * 3) * 5 + 0] || "").trim();
    const prevOffClean = cleanName(prevOfficerRaw).toLowerCase();

    let prevOffIdx = teamOfficers.findIndex(o => cleanName(o).toLowerCase() === prevOffClean);
    let chosenOfficer = "";

    if (teamOfficers.length > 0) {
      for (let step = 1; step <= teamOfficers.length; step++) {
        const candIdx = (prevOffIdx + step) % teamOfficers.length;
        const cand = teamOfficers[candIdx];
        if (!ab[cleanName(cand)] && !ab[cand]) {
          chosenOfficer = cand;
          break;
        }
      }
    }
    base20[destCa * 5 + 0] = chosenOfficer;

    // --- B. XOAY VÒNG & THAY THẾ CHIẾN SĨ NGHĨA VỤ NỘI BỘ TRONG CÙNG TỔ ---
    const teamSoldiers = team.soldiers || [];
    const soldierOrderIdx = {};
    teamSoldiers.forEach((sName, idx) => { soldierOrderIdx[cleanName(sName)] = idx; });

    // Hàng đợi các chiến sĩ trong Tổ đang nghỉ (không gác ngày hôm trước) và không vắng mặt
    const restingSoldiers = teamSoldiers.filter(sName => {
      const cn = cleanName(sName);
      return !ab[cn] && !ab[sName] && !sw[cn] && !sw[sName];
    });

    // Sắp xếp người nghỉ trong Tổ: ưu tiên người nghỉ lâu nhất (lastWorkedDate xa nhất), sau đó theo thứ tự danh sách Tổ
    const lwMap = {};
    restingSoldiers.forEach(sName => { lwMap[sName] = lastWorkedDate(sName, tk); });
    restingSoldiers.sort((a, b) => {
      if (lwMap[a] !== lwMap[b]) return lwMap[a] < lwMap[b] ? -1 : 1;
      return (soldierOrderIdx[cleanName(a)] || 0) - (soldierOrderIdx[cleanName(b)] || 0);
    });

    // Bước 1: Xoay vọng gác của 4 chiến sĩ ngày hôm trước trong Tổ (x9 -> x10 -> x11 -> x12 -> x9)
    const rotatedVongs = ["", "", "", ""]; // tương ứng cột 1 (x9), 2 (x10), 3 (x11), 4 (x12)
    for (let c = 1; c <= 4; c++) {
      const prevSol = (src.cells[(srcCa * 3) * 5 + c] || "").trim();
      const nextCol = (c === 4) ? 1 : (c + 1);
      rotatedVongs[nextCol - 1] = prevSol;
    }

    // Bước 2: Nếu vị trí nào đang trống hoặc chiến sĩ đó bắt đầu nghỉ phép/ốm/công tác vào ngày mai -> thay ngay bằng người nghỉ trong Tổ
    for (let v = 0; v < 4; v++) {
      const curS = rotatedVongs[v];
      const isAbs = curS && (ab[cleanName(curS)] || ab[curS]);
      if (!curS || isAbs) {
        if (restingSoldiers.length > 0) {
          rotatedVongs[v] = restingSoldiers.shift();
        } else if (isAbs) {
          rotatedVongs[v] = "";
        }
      }
    }

    // Bước 3: Thay thế những chiến sĩ đã gác liên tục nhiều ngày nhất (số mũ cao nhất) trong Tổ bằng số người nghỉ còn lại trong Tổ
    const workingSlots = [];
    const streakBySlot = {};
    for (let v = 0; v < 4; v++) {
      const curS = rotatedVongs[v];
      if (curS && (sw[cleanName(curS)] || sw[curS])) {
        workingSlots.push(v);
        streakBySlot[v] = calculateStreak(curS, sourceDate);
      }
    }
    workingSlots.sort((a, b) => (streakBySlot[b] - streakBySlot[a]) || (a - b));

    workingSlots.forEach(v => {
      if (restingSoldiers.length > 0) {
        rotatedVongs[v] = restingSoldiers.shift();
      }
    });

    // Bước 4: Nếu vẫn còn vọng trống (do nhiều người đột xuất nghỉ cùng lúc), điền từ các chiến sĩ không vắng mặt trong Tổ chưa có trong 4 vọng
    for (let v = 0; v < 4; v++) {
      if (!rotatedVongs[v]) {
        const usedClean = rotatedVongs.map(x => cleanName(x));
        const fallback = teamSoldiers.find(sName => {
          const cn = cleanName(sName);
          return !ab[cn] && !ab[sName] && !usedClean.includes(cn);
        });
        if (fallback) rotatedVongs[v] = fallback;
      }
      base20[destCa * 5 + (v + 1)] = rotatedVongs[v];
    }
  }

  // Nhân bản base20 xuống đủ 3 khung giờ của mỗi Ca (60 ô)
  const cells60 = Array(60).fill("");
  for (let ca = 0; ca < 4; ca++) {
    for (let col = 0; col < 5; col++) {
      const p = base20[ca * 5 + col];
      for (let slot = 0; slot < 3; slot++) {
        cells60[(ca * 3 + slot) * 5 + col] = p;
      }
    }
  }

  const streaks = {};
  cells60.forEach((n, k) => {
    if (n) {
      if (sw[cleanName(n)]) streaks[k] = calculateStreak(n, sourceDate) + 1;
      else streaks[k] = 1;
    }
  });

  S.days[tk] = {
    cells: cells60,
    teamInCa: nextTeamsInCa,
    absent: tabs,
    streaks: streaks,
    manualCredits: {}
  };
  return tk;
}

function generateSchedule() {
  if (currentRole !== 'commander') {
    alert("Chỉ có Chỉ huy / Trưởng ban mới có quyền cắt lịch!");
    return;
  }

  const off = parseNames(S.officers);
  const sol = parseNames(S.soldiers);
  const oS = toSet(off);
  const sS = toSet(sol);
  const src = getDayData(curDate);
  const tk = addDay(curDate, 1);
  const old = S.days[tk];

  if (!src.cells.some(x => (x || "").trim())) {
    alert(`Hãy điền lịch gác ngày ${vnFormat(curDate)} trước khi cắt lịch.`);
    return;
  }

  const abSrc = absSet(src.absent);
  const detectedTeams = detectTeamsInCa(src);
  for (let k = 0; k < 60; k++) {
    const n = (src.cells[k] || "").trim();
    if (!n) continue;
    const cName = cleanName(n);
    const col = k % 5;
    const caIdx = Math.floor(Math.floor(k / 5) / 3);
    const expectedTeamId = detectedTeams[caIdx];
    const personTeamId = getPersonTeamId(n);

    if (abSrc[cName] || abSrc[n]) {
      alert(`Không thể cắt lịch: Đồng chí (${n}) đang trong danh sách nghỉ/vắng nhưng vẫn có tên trong lịch gác!`);
      return;
    }
    if (hasConsecutiveShift(src, n, k)) {
      alert(`Không thể cắt lịch: Đồng chí (${n}) đang bị xếp 2 ca liền giờ nhau!`);
      return;
    }
    if (col === 0 && !oS[cName] && !oS[n]) {
      alert(`Không thể cắt lịch: Vị trí Đốc gác (${n}) phải là Sĩ quan Đốc gác!`);
      return;
    }
    if (col > 0 && !sS[cName] && !sS[n]) {
      alert(`Không thể cắt lịch: Vị trí Vọng gác (${n}) phải là Chiến sĩ nghĩa vụ!`);
      return;
    }
    if (personTeamId && expectedTeamId && personTeamId !== expectedTeamId) {
      alert(`Không thể cắt lịch: Đồng chí (${n}) thuộc Tổ ${personTeamId} không được xếp lẫn sang Ca ${caIdx + 1} của Tổ ${expectedTeamId}!`);
      return;
    }
  }

  if (old && old.cells.some(x => (x || "").trim()) && !confirm(`Ngày ${vnFormat(tk)} đã có lịch. Cắt lại và ghi đè?`)) return;

  curDate = cutOneDayInternal(curDate);
  saveStorage();
  render();
  alert(`✅ Đã cắt lịch ngày ${vnFormat(curDate)} theo đúng Tour 4 Tổ cố định (Đốc gác luân phiên 1 ngày/người, Chiến sĩ xoay vòng nội bộ trong Tổ)!`);
}

function generateWeekSchedule() {
  if (currentRole !== 'commander') {
    alert("Chỉ có Chỉ huy / Trưởng ban mới có quyền cắt lịch cả tuần!");
    return;
  }
  const src = getDayData(curDate);
  if (!src.cells.some(x => (x || "").trim())) {
    alert(`Hãy điền lịch gác gốc của ngày ${vnFormat(curDate)} trước khi cắt lịch 7 ngày.`);
    return;
  }
  if (!confirm(`Hệ thống sẽ tự động cắt lịch theo Tour 4 Tổ cố định cho 7 ngày tiếp theo (từ ${vnFormat(addDay(curDate, 1))} đến ${vnFormat(addDay(curDate, 7))}). Tiếp tục?`)) return;

  let d = curDate;
  for (let step = 0; step < 7; step++) {
    d = cutOneDayInternal(d);
  }
  curDate = d;
  saveStorage();
  render();
  alert(`⚡ Đã cắt lịch tự động theo Tour 4 Tổ cố định cho cả tuần (7 ngày)! Đang hiển thị ngày ${vnFormat(curDate)}.`);
}

window.onload = initUI;
