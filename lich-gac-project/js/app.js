let curDate = fmtDate(new Date());
let currentRole = getCurrentRole();
let IN = [], SUP = [], TA = {};

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
  // Kiểm tra nối tiếp qua ranh giới ngày (Ca 4 04h-06h ngày D-1 với Ca 1 06h-08h ngày D)
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

  document.getElementById("offT").disabled = !isCommander;
  document.getElementById("solT").disabled = !isCommander;
  document.getElementById("importBarDiv").style.display = isCommander ? "flex" : "none";

  for (let k = 0; k < 60; k++) {
    if (IN[k]) IN[k].disabled = !isCommander;
    if (SUP[k]) SUP[k].disabled = !isCommander;
  }
  CATS.forEach(c => {
    if (TA[c[0]]) TA[c[0]].disabled = !isCommander;
  });

  refresh();
}

// ĐĂNG KÝ VẮNG DÀI NGÀY (TỪ NGÀY – ĐẾN NGÀY)
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
    // Xóa khỏi các danh mục vắng khác trong ngày đó
    CATS.forEach(c => {
      let list = parseNames(dayData.absent[c[0]]);
      list = list.filter(n => cleanName(n) !== cName);
      dayData.absent[c[0]] = list.join(", ");
    });
    // Thêm vào danh mục đã chọn
    let targetList = parseNames(dayData.absent[catKey]);
    if (!targetList.some(n => cleanName(n) === cName)) {
      targetList.push(person);
    }
    dayData.absent[catKey] = targetList.join(", ");
    // Gạch tên khỏi bảng gác ngày đó nếu lỡ xếp
    dayData.cells = dayData.cells.map(c => cleanName(c) === cName ? "" : c);

    d = addDay(d, 1);
    countDays++;
  }

  saveStorage();
  render();
  alert(`✅ Đã đăng ký vắng mặt cho "${person}" trong ${countDays} ngày (từ ${vnFormat(startStr)} đến ${vnFormat(endStr)})!`);
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
        tdCa.innerHTML = `<strong>Ca ${caIdx + 1}</strong>`;
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
        inp.placeholder = c === 0 ? "Chỉ Sĩ quan" : "Chỉ Chiến sĩ";
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

  document.getElementById("offT").value = S.officers || "";
  document.getElementById("solT").value = S.soldiers || "";
  
  const saveRoster = () => {
    S.officers = document.getElementById("offT").value;
    S.soldiers = document.getElementById("solT").value;
    syncAccountsFromRosterStrings();
    saveStorage();
    document.getElementById("rmsg").textContent = `Đã lưu & đồng bộ tài khoản: ${parseNames(S.officers).length} sĩ quan, ${parseNames(S.soldiers).length} chiến sĩ nghĩa vụ.`;
    refresh();
  };
  
  ["offT", "solT"].forEach(id => {
    ["input", "change", "keyup", "blur"].forEach(ev => {
      document.getElementById(id).addEventListener(ev, saveRoster);
    });
  });

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
    span.textContent = n;
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

  const absIn = [], wrong = [], consecutiveErrors = [];
  const workingOfficers = {}, workingSoldiers = {}, allWorking = {};

  for (let k = 0; k < 60; k++) {
    const n = (day.cells[k] || "").trim();
    const cName = cleanName(n);
    const col = k % 5;
    let wg = false;
    let isCon = false;

    if (n) {
      allWorking[cName] = 1;
      if (col === 0) workingOfficers[cName] = 1;
      else workingSoldiers[cName] = 1;

      if (col === 0) {
        if (!oS[cName] && !oS[n]) {
          wg = true;
          wrong.push(`${n} (Cột Đốc gác chỉ lấy từ Sĩ quan)`);
        }
      } else {
        if (!sS[cName] && !sS[n]) {
          wg = true;
          wrong.push(`${n} (Vọng gác chỉ lấy từ Chiến sĩ nghĩa vụ)`);
        }
      }

      if (hasConsecutiveShift(day, n, k)) {
        isCon = true;
        consecutiveErrors.push(n);
      }
    }

    const isBad = !!(n && (ab[cName] || ab[n] || wg || isCon));
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

  document.getElementById("cntO").textContent = off.length ? `(${restO.length} đồng chí)` : "";
  document.getElementById("cntS").textContent = sol.length ? `(${restS.length} đồng chí)` : "";

  const gacOffCount = Object.keys(workingOfficers).length;
  const gacSolCount = Object.keys(workingSoldiers).length;
  const gacTotal = Object.keys(allWorking).length;
  const restTotal = restO.length + restS.length;

  let absTotal = 0;
  const statCardsHtml = [
    `<div class="stat-card"><span>🛡️ Đang gác (Tổng)</span><b>${gacTotal} người (${gacOffCount} SQ, ${gacSolCount} CS)</b></div>`,
    `<div class="stat-card"><span>⛺ Trực cơ động tại đơn vị</span><b>${restTotal} người (${restO.length} SQ, ${restS.length} CS)</b></div>`
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
    `Biên chế: ${off.length} Sĩ quan + ${sol.length} Chiến sĩ nghĩa vụ | Đang gác: ${gacTotal} · Trực cơ động: ${restTotal} · Vắng/Nghỉ: ${absTotal}`;
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
  }

  if (absIn.length) warnings.push("❌ BÁO ĐỎ: Người đang trong ngày nghỉ/vắng (phép, ốm, viện...) vẫn bị xếp lịch gác: " + Array.from(new Set(absIn)).join(", "));
  if (consecutiveErrors.length) warnings.push("❌ BÁO ĐỎ: Có nhân sự làm 2 ca liền giờ nhau (trong ngày hoặc nối ca 4 đêm hôm trước sang ca 1 sáng hôm sau): " + Array.from(new Set(consecutiveErrors)).join(", "));
  if (wrong.length) warnings.push("❌ BÁO ĐỎ SAI VỊ TRÍ: " + Array.from(new Set(wrong)).join(" | "));

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

// Hàm cắt lịch cho 1 ngày tiếp theo từ sourceDate
function cutOneDayInternal(sourceDate) {
  const off = parseNames(S.officers);
  const sol = parseNames(S.soldiers);
  const src = getDayData(sourceDate);
  const tk = addDay(sourceDate, 1);
  const old = S.days[tk];

  const tabs = (old && Object.keys(old.absent || {}).length > 0)
    ? old.absent
    : JSON.parse(JSON.stringify(src.absent));
  const ab = absSet(tabs);
  const sw = workSet(src);
  const idx = {};
  off.concat(sol).forEach((n, i) => { idx[n] = i; });

  function mkq(list) {
    const q = list.filter(n => !ab[cleanName(n)] && !ab[n] && !sw[cleanName(n)] && !sw[n]);
    const lw = {};
    const fairness = {};
    q.forEach(n => {
      lw[n] = lastWorkedDate(n, tk);
      fairness[n] = getFairnessScore(n, sourceDate);
    });
    q.sort((a, b) => {
      if (fairness[a] !== fairness[b]) return fairness[a] - fairness[b];
      return lw[a] < lw[b] ? -1 : lw[a] > lw[b] ? 1 : idx[a] - idx[b];
    });
    return q;
  }

  const qO = mkq(off);
  const qS = mkq(sol);

  // Xoay ca 4 -> 3 -> 2 -> 1 -> 4 (Lưu ý: người Ca 4 đêm hôm trước 04-06h sẽ sang Ca 3 ngày hôm sau 10-12h nên cách nhau 4 tiếng nghỉ, KHÔNG trùng vào Ca 1 06-08h!)
  const base20 = Array(20).fill("");
  for (let i = 0; i < 4; i++) {
    for (let c = 0; c < 5; c++) {
      const p = (src.cells[(i * 3) * 5 + c] || "").trim();
      const ni = (i + 3) % 4;
      const nc = c === 0 ? 0 : (c === 4 ? 1 : c + 1);
      base20[ni * 5 + nc] = p;
    }
  }

  for (let k = 0; k < 20; k++) {
    const currentPerson = base20[k];
    const isAbsent = currentPerson && (ab[cleanName(currentPerson)] || ab[currentPerson]);

    if (isAbsent || !currentPerson) {
      const q = (k % 5 === 0) ? qO : qS;
      if (q.length) base20[k] = q.shift();
      else if (isAbsent) base20[k] = "";
    }
  }

  const order = [];
  const streaksMap = {};
  for (let k = 0; k < 20; k++) {
    if (base20[k] && sw[cleanName(base20[k])]) {
      order.push(k);
      streaksMap[k] = calculateStreak(base20[k], sourceDate);
    }
  }
  order.sort((a, b) => streaksMap[b] - streaksMap[a]);

  order.forEach(k => {
    const q = (k % 5 === 0) ? qO : qS;
    if (q.length) base20[k] = q.shift();
  });

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

  S.days[tk] = { cells: cells60, absent: tabs, streaks: streaks, manualCredits: {} };
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
  for (let k = 0; k < 60; k++) {
    const n = (src.cells[k] || "").trim();
    if (!n) continue;
    const cName = cleanName(n);
    const col = k % 5;

    if (abSrc[cName] || abSrc[n]) {
      alert(`Không thể cắt lịch: Có người đang nghỉ (${n}) nhưng lại có tên trong lịch gác ngày hôm nay!`);
      return;
    }
    if (hasConsecutiveShift(src, n, k)) {
      alert(`Không thể cắt lịch: Nhân sự (${n}) đang bị xếp 2 ca liền giờ nhau!`);
      return;
    }
    if (col === 0 && !oS[cName] && !oS[n]) {
      alert(`Không thể cắt lịch: Vị trí Đốc gác (${n}) phải thuộc danh sách Sĩ quan!`);
      return;
    }
    if (col > 0 && !sS[cName] && !sS[n]) {
      alert(`Không thể cắt lịch: Vị trí Vọng gác (${n}) phải thuộc danh sách Chiến sĩ nghĩa vụ!`);
      return;
    }
  }

  if (old && old.cells.some(x => (x || "").trim()) && !confirm(`Ngày ${vnFormat(tk)} đã có lịch. Cắt lại và ghi đè?`)) return;

  curDate = cutOneDayInternal(curDate);
  saveStorage();
  render();
  alert(`✅ Cắt lịch thành công cho ngày ${vnFormat(curDate)}!`);
}

// CẮT LỊCH TỰ ĐỘNG CẢ TUẦN (7 NGÀY LIÊN TIẾP)
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
  if (!confirm(`Hệ thống sẽ tự động cắt lịch xoay ca liên tiếp cho 7 ngày tiếp theo (từ ${vnFormat(addDay(curDate, 1))} đến ${vnFormat(addDay(curDate, 7))}). Tiếp tục?`)) return;

  let d = curDate;
  for (let step = 0; step < 7; step++) {
    d = cutOneDayInternal(d);
  }
  curDate = d;
  saveStorage();
  render();
  alert(`⚡ Đã cắt lịch tự động hoàn chỉnh cho cả tuần (7 ngày)! Đang hiển thị ngày cuối tuần ${vnFormat(curDate)}.`);
}

window.onload = initUI;
