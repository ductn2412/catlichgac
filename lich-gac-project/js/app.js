let curDate = fmtDate(new Date());
let currentRole = getCurrentRole();
let IN = [], SUP = [];
// Bộ chọn tên dạng chip cho "chỉ làm ca đêm" và các mục vắng mặt
let ABS_PICKERS = {};
let NIGHT_ONLY_PICKER = null;
// Trạng thái dropdown gợi ý tên dùng chung
let nameSuggestDrop = null;
let nameSuggestOwner = null;
let nameSuggestPick = null;
let nameSuggestIndex = -1;
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
  day.manualEdited = true;
  if (!split) {
    // Gộp lại thành 1 người đầu tiên cho cả 3 khung giờ
    const p0 = day.cells[(caIdx * 3 + 0) * 5 + col] || "";
    day.cells[(caIdx * 3 + 1) * 5 + col] = p0;
    day.cells[(caIdx * 3 + 2) * 5 + col] = p0;
    day.manualCredits = {};
    delete expandedCells[key];
    saveStorage();
  } else {
    expandedCells[key] = true;
  }
  buildScheduleTableDOM();
  render();
}

// ===== GỢI Ý TÊN & BỘ CHỌN TÊN DẠNG CHIP =====
function normalizeSearchText(s) {
  return (s || "").toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function getAllPersonNames() {
  return [...parseNames(S.officers), ...parseNames(S.soldiers)];
}

function ensureNameSuggestDrop() {
  if (nameSuggestDrop && document.body.contains(nameSuggestDrop)) return nameSuggestDrop;
  const el = document.createElement("div");
  el.className = "name-suggest-drop";
  el.style.display = "none";
  document.body.appendChild(el);
  nameSuggestDrop = el;

  document.addEventListener("mousedown", (ev) => {
    if (!nameSuggestDrop || nameSuggestDrop.style.display === "none") return;
    if (nameSuggestDrop.contains(ev.target)) return;
    if (nameSuggestOwner && (nameSuggestOwner === ev.target || nameSuggestOwner.contains(ev.target))) return;
    hideNameSuggestions();
  });
  window.addEventListener("resize", hideNameSuggestions);
  window.addEventListener("scroll", (ev) => {
    if (nameSuggestDrop && nameSuggestDrop.contains(ev.target)) return;
    hideNameSuggestions();
  }, true);
  return el;
}

function hideNameSuggestions() {
  if (nameSuggestDrop) {
    nameSuggestDrop.style.display = "none";
    nameSuggestDrop.innerHTML = "";
  }
  nameSuggestOwner = null;
  nameSuggestPick = null;
  nameSuggestIndex = -1;
}

function showNameSuggestions(input, names, query, onPick) {
  const drop = ensureNameSuggestDrop();
  const q = normalizeSearchText(query).trim();
  const seen = {};
  const list = [];
  (names || []).forEach(n => {
    n = (n || "").trim();
    if (!n) return;
    const key = cleanName(n).toLowerCase();
    if (!key || seen[key]) return;
    seen[key] = 1;
    if (!q || normalizeSearchText(n).includes(q)) list.push(n);
  });

  drop.innerHTML = "";
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "name-suggest-empty";
    empty.textContent = q ? "Không có tên phù hợp" : "Chưa có danh sách tên";
    drop.appendChild(empty);
  } else {
    list.slice(0, 80).forEach(n => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "name-suggest-item";
      btn.dataset.name = n;
      const nm = document.createElement("span");
      nm.textContent = n;
      btn.appendChild(nm);
      const tid = getPersonTeamId(n);
      if (tid) {
        const team = document.createElement("small");
        team.textContent = `Tổ ${tid}`;
        btn.appendChild(team);
      }
      btn.onmousedown = (ev) => { ev.preventDefault(); };
      btn.onclick = () => {
        if (nameSuggestPick) nameSuggestPick(n);
        hideNameSuggestions();
      };
      drop.appendChild(btn);
    });
  }

  nameSuggestOwner = input;
  nameSuggestPick = onPick || null;
  nameSuggestIndex = -1;

  const r = input.getBoundingClientRect();
  drop.style.display = "block";
  const width = Math.max(r.width, 220);
  drop.style.width = width + "px";
  let left = r.left;
  if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
  drop.style.left = left + "px";
  const h = Math.min(drop.scrollHeight || 0, 260);
  let top = r.bottom + 4;
  if (top + h > window.innerHeight - 8 && r.top - h - 4 > 8) top = r.top - h - 4;
  drop.style.top = top + "px";
}

function moveNameSuggest(delta) {
  if (!nameSuggestDrop) return;
  const items = nameSuggestDrop.querySelectorAll(".name-suggest-item");
  if (!items.length) return;
  nameSuggestIndex = (nameSuggestIndex + delta + items.length) % items.length;
  items.forEach((el, i) => el.classList.toggle("active", i === nameSuggestIndex));
  if (items[nameSuggestIndex] && items[nameSuggestIndex].scrollIntoView) {
    items[nameSuggestIndex].scrollIntoView({ block: "nearest" });
  }
}

function pickActiveNameSuggest() {
  if (!nameSuggestDrop || nameSuggestIndex < 0 || !nameSuggestPick) return false;
  const items = nameSuggestDrop.querySelectorAll(".name-suggest-item");
  const item = items[nameSuggestIndex];
  if (!item || !item.dataset.name) return false;
  const picked = item.dataset.name;
  const handler = nameSuggestPick;
  hideNameSuggestions();
  handler(picked);
  return true;
}

// Gắn dropdown gợi ý tên vào 1 input.
// - Bấm/focus vào ô là hiện ngay danh sách tên.
// - Gõ để lọc; Enter/click để chọn.
function attachNameSuggestions(input, getNames, onPick) {
  if (!input) return;
  const handlePick = onPick || ((name) => {
    input.value = name;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const show = (query) => {
    if (input.disabled) return;
    showNameSuggestions(input, getNames() || [], query, handlePick);
  };
  // Bấm/focus vào ô: hiện ngay toàn bộ danh sách tên (không lọc theo tên đang có sẵn)
  input.addEventListener("focus", () => show(""));
  input.addEventListener("click", () => show(""));
  // Gõ mới lọc dần theo nội dung
  input.addEventListener("input", () => show(input.value));
  input.addEventListener("keydown", (ev) => {
    if (!nameSuggestDrop || nameSuggestDrop.style.display === "none" || nameSuggestOwner !== input) return;
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      moveNameSuggest(1);
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      moveNameSuggest(-1);
    } else if (ev.key === "Enter") {
      if (nameSuggestIndex >= 0 && pickActiveNameSuggest()) ev.preventDefault();
    } else if (ev.key === "Escape") {
      hideNameSuggestions();
      ev.preventDefault();
    }
  });
  input.addEventListener("blur", () => {
    setTimeout(() => { if (nameSuggestOwner === input) hideNameSuggestions(); }, 120);
  });
}

// Bộ chọn nhiều tên: các tên đã chọn hiển thị thành chip giống "Trực cơ động".
function createNameChipPicker(container, options) {
  container.innerHTML = "";
  container.classList.add("name-picker");

  const chips = document.createElement("div");
  chips.className = "chips name-picker-chips";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "name-picker-input";
  input.placeholder = options.placeholder || "Nhập hoặc chọn tên...";

  container.appendChild(chips);
  container.appendChild(input);

  let disabled = false;

  function labels() {
    return (options.getNames() || []).map(n => (n || "").trim()).filter(Boolean);
  }
  function hasName(list, name) {
    const cn = cleanName(name).toLowerCase();
    return list.some(n => cleanName(n).toLowerCase() === cn);
  }
  function sync() {
    chips.innerHTML = "";
    const list = labels();
    if (!list.length) {
      const empty = document.createElement("span");
      empty.className = "empty";
      empty.textContent = options.emptyText || "Chưa chọn ai.";
      chips.appendChild(empty);
      return;
    }
    list.forEach(n => {
      const chip = document.createElement("span");
      chip.className = "chip chip-removable person-hover-link";
      const text = document.createElement("span");
      const tid = getPersonTeamId(n);
      text.textContent = tid ? `${n} [Tổ ${tid}]` : n;
      chip.appendChild(text);
      if (!disabled) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chip-remove";
        btn.textContent = "×";
        btn.title = "Bỏ chọn";
        btn.onclick = (ev) => {
          ev.stopPropagation();
          removeName(n);
        };
        chip.appendChild(btn);
      }
      chip.onmouseenter = (ev) => showPersonnelHoverCard(ev, n);
      chip.onmousemove = (ev) => movePersonnelHoverCard(ev);
      chip.onmouseleave = () => hidePersonnelHoverCard();
      chips.appendChild(chip);
    });
  }
  function addName(name) {
    if (disabled) return;
    const label = (name || "").trim();
    if (!label) return;
    const list = labels();
    if (!hasName(list, label)) {
      list.push(label);
      options.onChange(list);
    }
    input.value = "";
    sync();
    input.focus();
  }
  function removeName(name) {
    if (disabled) return;
    const cn = cleanName(name).toLowerCase();
    options.onChange(labels().filter(n => cleanName(n).toLowerCase() !== cn));
    sync();
  }
  function setDisabled(v) {
    disabled = !!v;
    input.disabled = disabled;
    container.classList.toggle("is-disabled", disabled);
    if (disabled) hideNameSuggestions();
    sync();
  }

  attachNameSuggestions(input, getAllPersonNames, addName);

  // Enter khi không chọn gợi ý nào: thêm đúng tên đang gõ
  input.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" || ev.defaultPrevented) return;
    const typed = (input.value || "").trim();
    if (!typed) return;
    ev.preventDefault();
    const match = getAllPersonNames().find(n => normalizeSearchText(n).includes(normalizeSearchText(typed)));
    addName(match || typed);
  });

  sync();
  return { input, chips, sync, addName, removeName, setDisabled, isDisabled: () => disabled };
}

function buildScheduleTableDOM() {
  const tbody = document.getElementById("body");
  if (!tbody) return;
  hideNameSuggestions();
  tbody.innerHTML = "";
  IN = [];
  SUP = [];
  const day = getDayData(curDate);
  const isCommander = (getCurrentRole() === "commander");

  // Có ít nhất một vị trí đang tách ca lẻ? Khi đó hiện thêm cột "Khung giờ"
  // ngay cạnh các cột tên để đối chiếu từng dòng mà không chiếm chỗ trong ô tên.
  const hasAnySplit = CA.some((slots, caIdx) => {
    for (let c = 0; c < 5; c++) if (isCellSplit(day, caIdx, c)) return true;
    return false;
  });

  // Cập nhật tiêu đề bảng cho khớp bố cục đã gộp "Ca & Tổ trực" + "Khung giờ".
  const table = tbody.closest("table");
  const headRow = table && table.querySelector("thead tr");
  if (headRow) {
    headRow.querySelectorAll(".extra-time-col").forEach(n => n.remove());
    const firstTh = headRow.querySelector("th");
    if (firstTh) {
      firstTh.classList.add("ca-head");
      firstTh.innerHTML = hasAnySplit ? "Ca / Tổ trực" : "Ca / Khung giờ";
      if (hasAnySplit) {
        const thTime = document.createElement("th");
        thTime.className = "slot-time extra-time-col";
        thTime.innerHTML = "Khung giờ";
        firstTh.insertAdjacentElement("afterend", thTime);
      }
    }
  }

  CA.forEach((slots, caIdx) => {
    const tr = document.createElement("tr");
    tr.dataset.ca = caIdx;

    const tdCa = document.createElement("td");
    tdCa.className = "ca-title ca-merged";
    let caHtml = `<strong>Ca ${caIdx + 1}</strong><div id="caTeamBadge_${caIdx}" style="margin-top:4px;font-size:11.5px;background:var(--hl);color:var(--primary-green);padding:2px 6px;border-radius:999px;border:1px solid var(--primary-green);">Tổ ${caIdx + 1}</div>`;
    if (!hasAnySplit) {
      // Gộp khung giờ vào chính ô Ca, kẻ ngang từng dòng cho dễ đối chiếu.
      caHtml += `<div class="ca-time-lines">` +
        slots.map(s => `<div class="ca-time-line">${s}</div>`).join("") +
        `</div>`;
    }
    tdCa.innerHTML = caHtml;
    tr.appendChild(tdCa);

    if (hasAnySplit) {
      // Cột khung giờ riêng: 3 dòng thẳng hàng với 3 dòng tên khi tách ca lẻ.
      const tdTime = document.createElement("td");
      tdTime.className = "slot-time extra-time-col";
      tdTime.innerHTML = `<div class="extra-time-list">` +
        slots.map(s => `<div class="extra-time-line">${s}</div>`).join("") +
        `</div>`;
      tr.appendChild(tdTime);
    }

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
        inp.disabled = !isCommander;

        const sup = document.createElement("input");
        sup.className = "sup";
        sup.type = "number";
        sup.min = "0";
        sup.disabled = !isCommander;
        sup.title = "Số mũ: số ngày làm liên tiếp";
        sup.setAttribute("aria-label", "Số mũ (số ngày làm liên tiếp)");

        const k0 = (caIdx * 3 + 0) * 5 + c;
        const k1 = (caIdx * 3 + 1) * 5 + c;
        const k2 = (caIdx * 3 + 2) * 5 + c;

        const onSingleInput = () => {
          const d = getDayData(curDate);
          d.cells[k0] = inp.value;
          d.cells[k1] = inp.value;
          d.cells[k2] = inp.value;
          d.manualEdited = true;
          delete d.streaks[k0];
          d.manualCredits = {};
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
        attachNameSuggestions(inp, () => parseNames(c === 0 ? S.officers : S.soldiers));

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

        const rankBadge = document.createElement("span");
        rankBadge.className = "rank-badge";
        rankBadge.dataset.k = String(k0);
        rankBadge.style.display = "none";

        wrapper.appendChild(rankBadge);
        wrapper.appendChild(inp);
        wrapper.appendChild(sup);

        if (isCommander) {
          const btnSplit = document.createElement("button");
          btnSplit.type = "button";
          btnSplit.className = "btn-split-slot no-print";
          btnSplit.title = "Thay ca lẻ (tách riêng 3 khung giờ của ca này)";
          btnSplit.setAttribute("aria-label", "Thay ca lẻ");
          btnSplit.textContent = "⇄";
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

          // Giờ đã nằm ở cột "Khung giờ" riêng nên không lặp lại trong ô tên,
          // nhờ đó ô tên rộng hơn và không bị cắt chữ.
          const cellWrap = document.createElement("div");
          cellWrap.className = "cell";
          cellWrap.style.flex = "1";

          const inp = document.createElement("input");
          inp.className = "nm";
          inp.placeholder = c === 0 ? "Đốc gác" : "Chiến sĩ";
          inp.disabled = !isCommander;

          const sup = document.createElement("input");
          sup.className = "sup";
          sup.type = "number";
          sup.min = "0";
          sup.disabled = !isCommander;
          sup.title = "Số mũ: số ngày làm liên tiếp";
          sup.setAttribute("aria-label", "Số mũ (số ngày làm liên tiếp)");

          const k = (caIdx * 3 + slotIdx) * 5 + c;

          const onSplitInput = () => {
            const d = getDayData(curDate);
            d.cells[k] = inp.value;
            d.manualEdited = true;
            delete d.streaks[k];
            d.manualCredits = {};
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
          attachNameSuggestions(inp, () => parseNames(c === 0 ? S.officers : S.soldiers));

          IN[k] = inp;
          SUP[k] = sup;

          const rankBadge = document.createElement("span");
          rankBadge.className = "rank-badge";
          rankBadge.dataset.k = String(k);
          rankBadge.style.display = "none";

          cellWrap.appendChild(rankBadge);
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
  const punishCard = document.getElementById("punishCard");
  const punishPerson = document.getElementById("punishPerson");
  const punishStart = document.getElementById("punishStart");
  const borrowCard = document.getElementById("borrowCard");
  const borrowEnabled = document.getElementById("borrowEnabled");
  const borrowMaxAbsent = document.getElementById("borrowMaxAbsent");
  const borrowMaxDays = document.getElementById("borrowMaxDays");
  const restoreLabel = document.getElementById("restoreJsonLabel");

  if (genBtn) genBtn.style.display = isCommander ? "inline-block" : "none";
  if (genWeekBtn) genWeekBtn.style.display = isCommander ? "inline-block" : "none";
  const genMonthBtn = document.getElementById("genMonth");
  if (genMonthBtn) genMonthBtn.style.display = isCommander ? "inline-block" : "none";
  if (leaveCard) leaveCard.style.display = isCommander ? "block" : "none";
  if (nightOnlyCard) nightOnlyCard.style.display = isCommander ? "block" : "none";
  if (NIGHT_ONLY_PICKER) NIGHT_ONLY_PICKER.setDisabled(!isCommander);
  if (punishCard) punishCard.style.display = isCommander ? "block" : "none";
  [punishPerson, punishStart].forEach(el => { if (el) el.disabled = !isCommander; });
  if (borrowCard) borrowCard.style.display = isCommander ? "block" : "none";
  [borrowEnabled, borrowMaxAbsent, borrowMaxDays].forEach(el => { if (el) el.disabled = !isCommander; });
  if (restoreLabel) restoreLabel.style.display = isCommander ? "" : "none";

  for (let t = 1; t <= 4; t++) {
    const oEl = document.getElementById(`team${t}Off`);
    const sEl = document.getElementById(`team${t}Sol`);
    if (oEl) oEl.disabled = !isCommander;
    if (sEl) sEl.disabled = !isCommander;
  }

  const impBar = document.getElementById("importBarDiv");
  if (impBar) impBar.style.display = isCommander ? "flex" : "none";

  CATS.forEach(c => {
    if (ABS_PICKERS[c[0]]) ABS_PICKERS[c[0]].setDisabled(!isCommander);
  });

  buildScheduleTableDOM();
  render();
}

function resetDefaultTourTeams() {
  if (getCurrentRole() !== "commander") return;
  if (!confirm("Khôi phục danh sách biên chế 4 Tổ chuẩn theo file Tour gác và xếp lịch gốc cho ngày đang chọn?")) return;
  createSnapshot("Trước khi nạp lại biên chế/lịch gốc");
  S.teams = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
  syncFromTeamsToRosterAndAccounts();

  const day = getDayData(curDate);
  const ab = absSet(day.absent || {});
  day.teamInCa = [1, 2, 3, 4];
  day.manualCredits = {};
  expandedCells = {};
  for (let ca = 0; ca < 4; ca++) {
    const team = S.teams[ca];
    // Không xếp người đang vắng mặt vào lịch gốc.
    const docGac = (team.officers || []).find(n => n && !isPersonAbsentIn(ab, n)) || "";
    const vongs = (team.soldiers || []).filter(n => n && !isPersonAbsentIn(ab, n)).slice(0, 4);
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

  // Người đang bị phạt làm 7 ngày liên tục được ưu tiên trực (nếu không vắng).
  const punished = list.find(n => !isPersonAbsentIn(ab, n) && isPunishedOn(n, dateStr));
  if (punished) return punished;

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

// Chọn 4/7 chiến sĩ của Tổ theo lịch sử để đảm bảo công bằng:
// - Ưu tiên người vừa nghỉ hôm qua (chưa làm ngày nào liên tiếp).
// - Sau đó ưu tiên người ít ngày gác trong 7 ngày gần nhất / nghỉ lâu hơn.
// - Nếu phải giữ người làm tiếp thì giữ người "mũ 1" trước "mũ 2".
function pickSoldiersForTeam(team, ab, dateStr, excludeFn) {
  const list = (team.soldiers || []).filter(Boolean);
  const need = 4;
  if (!list.length) return [];

  // Dịch điểm bắt đầu theo ngày để phá thế hòa khi các chiến sĩ có lịch sử giống nhau.
  const ord = dayOrdinal(dateStr);
  const offset = ((ord % list.length) + list.length) % list.length;

  const cands = [];
  list.forEach((name, idx) => {
    if (excludeFn && excludeFn(name)) return;
    if (isPersonAbsentIn(ab, name)) return;
    const turn = ((idx - offset) % list.length + list.length) % list.length;
    const f = soldierFairness(name, dateStr, turn);
    f.wantCol = nextGuardColumn(name, dateStr); // cột vọng gác sẽ nhận nếu đi làm
    cands.push(f);
  });

  cands.sort(compareSoldierFairness);

  const picked = [];
  const usedCols = new Set();
  // Người đang bị phạt làm 7 ngày liên tục luôn được xếp trước tiên,
  // không phụ thuộc vào nhóm công bằng (tránh bị nhóm đông hơn loại ra).
  cands.filter(c => c.punished === 0).forEach(c => {
    if (picked.length >= need) return;
    picked.push(c.name);
    if (c.wantCol) usedCols.add(c.wantCol);
  });

  const rest = cands.filter(c => c.punished !== 0);
  let i = 0;
  while (picked.length < need && i < rest.length) {
    const key = `${rest[i].dutyStreak}|${rest[i].recent}|${rest[i].restStreak}`;
    const group = [];
    while (i < rest.length &&
      `${rest[i].dutyStreak}|${rest[i].recent}|${rest[i].restStreak}` === key) {
      group.push(rest[i]);
      i++;
    }

    const slots = need - picked.length;
    if (slots >= group.length) {
      group.forEach(c => {
        picked.push(c.name);
        if (c.wantCol) usedCols.add(c.wantCol);
      });
      continue;
    }

    // Nhóm cuối chỉ lấy 1 phần: ưu tiên người có cột vọng gác không trùng
    // để mỗi lần đi làm vẫn đẩy được vọng gác lên đúng 1 bậc.
    const chosen = [];
    group.forEach(c => {
      if (chosen.length >= slots || !c.wantCol || usedCols.has(c.wantCol)) return;
      chosen.push(c);
      usedCols.add(c.wantCol);
    });
    group.forEach(c => {
      if (chosen.length >= slots || chosen.includes(c) || c.wantCol) return;
      chosen.push(c);
    });
    group.forEach(c => {
      if (chosen.length >= slots || chosen.includes(c)) return;
      chosen.push(c);
      if (c.wantCol) usedCols.add(c.wantCol);
    });
    chosen.forEach(c => picked.push(c.name));
  }

  return picked;
}

// ===== CẢNH BÁO & MƯỢN QUÂN SỐ TẠM THỜI GIỮA CÁC TỔ =====
// Đếm số chiến sĩ của 1 Tổ đang vắng mặt trong ngày
function countAbsentSoldiersOfTeam(teamId, dateStr) {
  const team = S.teams && S.teams[teamId - 1];
  if (!team) return 0;
  const ab = absSet(getDayData(dateStr).absent || {});
  return (team.soldiers || []).filter(n => n && isPersonAbsentIn(ab, n)).length;
}

// Số ngày liên tiếp đã làm gác tính đến hết ngày TRƯỚC dateStr
// (dùng để biết nếu xếp thêm hôm nay thì có vượt ngưỡng hay không)
function consecutiveDutyDays(person, dateStr) {
  const cName = cleanName(person);
  if (!cName) return 0;
  let d = addDay(dateStr, -1);
  let c = 0;
  while (c < 90) {
    const day = S.days && S.days[d];
    if (!day || !Array.isArray(day.cells)) break;
    const worked = day.cells.some(x => cleanName(x) === cName);
    if (!worked) break;
    c++;
    d = addDay(d, -1);
  }
  return c;
}

// Số ngày đã gác trong 7 ngày gần nhất (ưu tiên người ít ngày khi mượn)
function dutyDaysInRecent(person, dateStr, days) {
  const cName = cleanName(person);
  if (!cName) return 0;
  let c = 0;
  for (let i = 1; i <= days; i++) {
    const day = S.days && S.days[addDay(dateStr, -i)];
    if (day && Array.isArray(day.cells) && day.cells.some(x => cleanName(x) === cName)) c++;
  }
  return c;
}

// Số ngày liên tiếp đã NGHỈ (không gác) tính đến hết ngày TRƯỚC dateStr.
// Dùng để ưu tiên người vừa nghỉ hôm qua, tránh chuỗi nghỉ / làm liên tục.
function consecutiveRestDays(person, dateStr) {
  const cName = cleanName(person);
  if (!cName) return 0;
  let d = addDay(dateStr, -1);
  let c = 0;
  while (c < 90) {
    const day = S.days && S.days[d];
    if (!day || !Array.isArray(day.cells)) break;
    const worked = day.cells.some(x => cleanName(x) === cName);
    if (worked) break;
    c++;
    d = addDay(d, -1);
  }
  return c;
}

// Hồ sơ công bằng của 1 chiến sĩ: ai làm ít ngày liên tiếp / ít ngày gần đây / nghỉ lâu hơn
// thì được xếp đi làm trước, người đã làm "mũ 2" bị đẩy xuống sau "mũ 1".
// Cấp bậc hàm: B2 được ưu tiên làm "mũ 2" (xếp đi làm trước), H1 được ưu tiên nghỉ trước.
function rankWorkPriority(person) {
  const rank = typeof getPersonRank === "function" ? getPersonRank(person) : "";
  if (rank === "B2") return 0; // đi làm trước → nhận "mũ 2" khi phải làm liên tiếp
  if (rank === "H1") return 2; // nghỉ trước
  return 1;
}

function soldierFairness(person, dateStr, turn) {
  return {
    name: person,
    turn: Number.isFinite(turn) ? turn : 0,
    dutyStreak: consecutiveDutyDays(person, dateStr),
    restStreak: consecutiveRestDays(person, dateStr),
    recent: dutyDaysInRecent(person, dateStr, 7),
    rankPriority: rankWorkPriority(person),
    // 0 = đang bị phạt (phải đi làm), 1 = bình thường.
    punished: (typeof isPunishedOn === "function" && isPunishedOn(person, dateStr)) ? 0 : 1
  };
}

function compareSoldierFairness(a, b) {
  return (a.dutyStreak - b.dutyStreak) ||
    (a.recent - b.recent) ||
    (b.restStreak - a.restStreak) ||
    (a.rankPriority - b.rankPriority) ||
    (a.turn - b.turn);
}

// Chọn 1 chiến sĩ từ Tổ khác để mượn tạm thời.
// Chỉ mượn từ Tổ thực sự còn quân dư sau khi trừ số người Tổ đó cần cho ca trực của mình.
// Ưu tiên Tổ còn quân dư, người ít ngày gác liên tiếp và ít ngày gác gần đây.
// caIdx/col: vị trí sẽ xếp, dùng để tránh trùng ca sát giờ với ngày hôm trước/hôm sau.
function pickBorrowedSoldier(dateStr, targetTeamId, dayUsed, ab, nightSet, caIdx, col, teamMap) {
  const cands = [];
  const teamsOnDuty = Array.isArray(teamMap) ? teamMap : [];
  for (let t = 1; t <= 4; t++) {
    if (t === targetTeamId) continue;
    const team = S.teams && S.teams[t - 1];
    if (!team) continue;
    const avail = (team.soldiers || []).filter(n =>
      n && !isPersonAbsentIn(ab, n) && !isNightOnlyInSet(nightSet, n)
    );
    // Tổ nguồn đang trực trong ngày cần đủ 4 chiến sĩ cho ca của mình.
    const needed = teamsOnDuty.includes(t) ? 4 : 0;
    const surplus = avail.length - needed; // > 0: Tổ còn người dư có thể cho mượn
    if (surplus <= 0) continue; // Không rút người từ Tổ không dư
    avail.forEach(n => {
      const key = cleanName(n).toLowerCase();
      if (!key || dayUsed.has(key)) return;
      if (typeof caIdx === "number" && typeof col === "number") {
        const k0 = (caIdx * 3 + 0) * 5 + col;
        const k2 = (caIdx * 3 + 2) * 5 + col;
        if (hasCrossDayConsecutiveError(dateStr, n, k0)) return;
        if (hasCrossDayConsecutiveError(dateStr, n, k2)) return;
      }
      cands.push({
        name: n,
        teamId: t,
        surplus,
        streak: consecutiveDutyDays(n, dateStr),
        recent: dutyDaysInRecent(n, dateStr, 7),
        rankPriority: rankWorkPriority(n)
      });
    });
  }
  cands.sort((a, b) =>
    (b.surplus - a.surplus) ||
    (a.streak - b.streak) ||
    (a.recent - b.recent) ||
    (a.rankPriority - b.rankPriority) ||
    (a.teamId - b.teamId)
  );
  return cands[0] || null;
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

// Ca đêm 18:00 – 06:00: khung giờ bắt đầu từ 18:00 hoặc trước 06:00
function isTimeInNightWindow(timeStr) {
  const start = parseInt(String(timeStr || "").slice(0, 2), 10);
  if (!Number.isFinite(start)) return false;
  return start >= 18 || start < 6;
}

// Các khung giờ (slot) trong 1 ca mà người học tập buổi sáng được xếp.
// Ca 1, Ca 2: 22:00–24:00 và 00:00–02:00; Ca 3, Ca 4: thêm 18:00–20:00 và 20:00–22:00.
function nightWindowSlotsForCa(caIdx) {
  const slots = [];
  for (let s = 0; s < 3; s++) {
    if (isTimeInNightWindow((CA[caIdx] || [])[s])) slots.push(s);
  }
  return slots.length ? slots : [2];
}

// Chọn người cùng Tổ (không phải người chỉ làm ca đêm) để trực khung ban ngày
function pickDayReplacement(pool, usedSet, ab, nightSet, dateStr, excludeSet) {
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
    if (excludeSet && excludeSet.has(key)) continue;
    usedSet.add(key);
    return cand;
  }
  return "";
}

function fillGeneratedPosition(cells, caIdx, col, dayPerson, nightPerson, nightSlots) {
  const base = caIdx * 3;
  const slots = (Array.isArray(nightSlots) && nightSlots.length) ? nightSlots : [2];
  for (let s = 0; s < 3; s++) {
    cells[(base + s) * 5 + col] = slots.indexOf(s) >= 0 ? (nightPerson || "") : (dayPerson || "");
  }
}

// Cột vọng gác (1..4) mà chiến sĩ đã đứng ở lần đi làm gần nhất trước dateStr.
// Trả về 0 nếu chưa từng đi làm trong 90 ngày gần đây.
function lastGuardColumn(person, dateStr) {
  const cName = cleanName(person);
  if (!cName) return 0;
  let d = addDay(dateStr, -1);
  for (let i = 0; i < 90; i++) {
    const day = S.days && S.days[d];
    if (day && Array.isArray(day.cells)) {
      for (let row = 0; row < 12; row++) {
        for (let col = 1; col <= 4; col++) {
          const v = day.cells[row * 5 + col];
          if (v && cleanName(v) === cName) return col;
        }
      }
    }
    d = addDay(d, -1);
  }
  return 0;
}

// Cột vọng gác kế tiếp của 1 chiến sĩ (đẩy lên 1 bậc). 0 = chưa có lịch sử.
function nextGuardColumn(person, dateStr) {
  const last = lastGuardColumn(person, dateStr);
  return last ? (last % 4) + 1 : 0;
}

// Xoay vòng vọng gác: mỗi lần đi làm thì đẩy cột lên 1 (1→2→3→4→1).
// Người mới (chưa có lịch sử) nhận cột sao cho phân bố "cột kế tiếp" của cả Tổ
// càng đều càng tốt, tránh các lần sau bị trùng cột.
function assignGuardColumns(entries, dateStr, teamSoldiers) {
  const cols = new Array(entries.length).fill(0);
  const taken = new Set();
  const pending = [];
  const nextCount = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const entryNames = new Set(entries.map(e => cleanName(e.name).toLowerCase()));

  // Phân bố cột kế tiếp của những người cùng Tổ đang nghỉ hôm nay
  (teamSoldiers || []).forEach(n => {
    if (!n) return;
    if (entryNames.has(cleanName(n).toLowerCase())) return;
    const nc = nextGuardColumn(n, dateStr);
    if (nc) nextCount[nc]++;
  });

  // Lượt 1: người đã có lịch sử giữ đúng nhịp xoay
  entries.forEach((e, i) => {
    const last = lastGuardColumn(e.name, dateStr);
    if (!last) { pending.push(i); return; }
    const want = (last % 4) + 1;
    if (taken.has(want)) { pending.push(i); return; }
    cols[i] = want;
    taken.add(want);
    nextCount[(want % 4) + 1]++;
  });

  // Lượt 2: người mới / trùng cột nhận cột trống giúp cân bằng nhịp xoay
  pending.forEach(i => {
    let best = 0;
    let bestScore = Infinity;
    for (let c = 1; c <= 4; c++) {
      if (taken.has(c)) continue;
      const next = (c % 4) + 1;
      const score = nextCount[next];
      if (score < bestScore) { bestScore = score; best = c; }
    }
    if (!best) return;
    cols[i] = best;
    taken.add(best);
    nextCount[(best % 4) + 1]++;
  });

  return cols;
}

function buildGeneratedDay(dateStr, teamMap, prevDay) {
  const day = getDayData(dateStr);
  // Danh sách vắng mặt đã nhập được giữ nguyên qua các lần cắt lịch:
  // ngày mới kế thừa danh sách vắng mặt gần nhất cho tới khi người dùng xóa tên.
  applyInheritedAbsence(dateStr, day);
  const ab = absSet(day.absent || {});
  const nightSet = getNightOnlySet();
  const rules = getBorrowRules();
  const cells = Array(60).fill("");
  let unfilled = 0;

  // Người đã được xếp trong ngày (mọi ca) để không mượn trùng
  const dayUsed = new Set();
  const borrowed = [];
  const overworkSwaps = [];
  const overworkKept = [];
  const borrowMarks = {};

  for (let ca = 0; ca < 4; ca++) {
    const teamId = teamMap[ca] || (ca + 1);
    const team = (S.teams && S.teams[teamId - 1]) || (S.teams && S.teams[ca]);
    if (!team) continue;

    const used = new Set();
    // Người học tập buổi sáng chỉ trực các khung giờ trong ca đêm 18:00 – 06:00
    const nightSlots = nightWindowSlotsForCa(ca);

    // --- Đốc gác (Sĩ quan) ---
    const officer = pickOfficerForTeam(team, teamId, prevDay, ab, dateStr);
    if (officer) {
      used.add(cleanName(officer).toLowerCase());
      dayUsed.add(cleanName(officer).toLowerCase());
    }

    let officerDay = officer;
    let officerNight = officer;
    if (officer && isNightOnlyInSet(nightSet, officer)) {
      officerNight = officer;
      officerDay = pickDayReplacement(team.officers || [], used, ab, nightSet, dateStr, dayUsed);
      if (!officerDay) unfilled++;
      else dayUsed.add(cleanName(officerDay).toLowerCase());
    }
    fillGeneratedPosition(cells, ca, 0, officerDay, officerNight, nightSlots);

    // --- Chiến sĩ Vọng gác ---
    const absentCount = countAbsentSoldiersOfTeam(teamId, dateStr);
    const teamShort = absentCount > rules.maxAbsentSoldiers;

    // Người trực ca đêm cuối ngày hôm trước không xếp vào Ca 1 sáng hôm sau
    const conflictAt = (n) =>
      hasCrossDayConsecutiveError(dateStr, n, (ca * 3 + 0) * 5 + 1) ||
      hasCrossDayConsecutiveError(dateStr, n, (ca * 3 + 1) * 5 + 1) ||
      hasCrossDayConsecutiveError(dateStr, n, (ca * 3 + 2) * 5 + 1);

    const rotated = pickSoldiersForTeam(team, ab, dateStr, n =>
      dayUsed.has(cleanName(n).toLowerCase()) || conflictAt(n)
    );

    const finalList = [];   // { name, type, fromTeam?, out?, reason? }
    const overworked = [];  // người đã làm tới ngưỡng, nên nghỉ
    const idle = [];        // người cùng Tổ đang nghỉ, có thể thay

    rotated.forEach(s => {
      if (!s) return;
      // Người đang bị phạt làm 7 ngày liên tục không bị đổi ra nghỉ dù vượt ngưỡng.
      const over = rules.enabled &&
        !isNightOnlyInSet(nightSet, s) &&
        !isPunishedOn(s, dateStr) &&
        consecutiveDutyDays(s, dateStr) >= rules.maxConsecutiveDays;
      if (over) overworked.push(s);
      else finalList.push({ name: s, type: "team" });
    });

    (team.soldiers || []).forEach(n => {
      if (!n) return;
      if (finalList.some(e => e.name === n) || overworked.includes(n)) return;
      if (isPersonAbsentIn(ab, n)) return;
      if (isNightOnlyInSet(nightSet, n)) return;
      if (dayUsed.has(cleanName(n).toLowerCase())) return;
      // Không lấy người sẽ vi phạm 2 khung giờ liền nhau qua ngày làm người thay
      if (conflictAt(n)) return;
      idle.push(n);
    });
    // Người nghỉ lâu / làm ít ngày được ưu tiên thay trước
    idle.sort((a, b) => compareSoldierFairness(
      soldierFairness(a, dateStr, (team.soldiers || []).indexOf(a)),
      soldierFairness(b, dateStr, (team.soldiers || []).indexOf(b))
    ));

    // 1) Thay người làm quá số ngày bằng người cùng Tổ đang nghỉ
    let overIdx = 0;
    while (finalList.length < 4 && idle.length) {
      const inP = idle.shift();
      const outP = overworked[overIdx] || "";
      if (outP) {
        overIdx++;
        overworkSwaps.push({
          out: outP,
          in: inP,
          outStreak: consecutiveDutyDays(outP, dateStr) + 1,
          ca: ca + 1,
          borrowed: false
        });
      }
      finalList.push({ name: inP, type: outP ? "idle" : "team" });
    }

    // 2) Vẫn thiếu (Tổ vắng quá ngưỡng hoặc không còn người cùng Tổ) → mượn Tổ khác
    while (rules.enabled && finalList.length < 4) {
      const b = pickBorrowedSoldier(dateStr, teamId, dayUsed, ab, nightSet, ca, finalList.length + 1, teamMap);
      if (!b) break;

      const outP = overworked[overIdx] || "";
      const reasons = [];
      if (outP) {
        overIdx++;
        const outStreak = consecutiveDutyDays(outP, dateStr) + 1;
        reasons.push(`thay ${cleanName(outP)} (đã làm ${outStreak} ngày liên tiếp)`);
        overworkSwaps.push({
          out: outP,
          in: b.name,
          outStreak,
          ca: ca + 1,
          borrowed: true,
          fromTeam: b.teamId
        });
      }
      if (teamShort) reasons.push(`Tổ ${teamId} vắng ${absentCount} chiến sĩ (ngưỡng ${rules.maxAbsentSoldiers})`);

      dayUsed.add(cleanName(b.name).toLowerCase());
      finalList.push({
        name: b.name,
        type: "borrow",
        fromTeam: b.teamId,
        out: outP,
        reason: reasons.join("; ") || "mượn tạm thời giữa các Tổ"
      });
    }

    // 3) Không còn ai thay → đành dùng lại người đã vượt ngưỡng (có cảnh báo)
    while (finalList.length < 4 && overIdx < overworked.length) {
      const p = overworked[overIdx++];
      finalList.push({ name: p, type: "overworked" });
      overworkKept.push({
        person: p,
        days: consecutiveDutyDays(p, dateStr) + 1,
        ca: ca + 1
      });
    }

    // Đánh dấu toàn bộ người của ca là "đã dùng" trước khi chọn người thay
    // để người thay khung ban ngày không trùng với người đã có trong ca.
    finalList.forEach(e => {
      if (!e || !e.name) return;
      used.add(cleanName(e.name).toLowerCase());
      dayUsed.add(cleanName(e.name).toLowerCase());
    });

    // Người đang vượt ngưỡng ngày công không được chọn làm người thay ban ngày
    const avoidDaySet = new Set(dayUsed);
    overworked.forEach(n => avoidDaySet.add(cleanName(n).toLowerCase()));

    // Xếp vào 4 vị trí vọng gác; cột được xoay vòng theo lần đi làm gần nhất
    const guardCols = assignGuardColumns(finalList, dateStr, team.soldiers || []);
    for (let col = 1; col <= 4; col++) {
      const idx = guardCols.indexOf(col);
      if (idx < 0) {
        fillGeneratedPosition(cells, ca, col, "", "", nightSlots);
        unfilled++;
        continue;
      }
      const entry = finalList[idx];

      const soldier = entry.name;
      used.add(cleanName(soldier).toLowerCase());
      dayUsed.add(cleanName(soldier).toLowerCase());

      let dayPerson = soldier;
      let nightPerson = soldier;
      if (isNightOnlyInSet(nightSet, soldier)) {
        nightPerson = soldier;
        dayPerson = pickDayReplacement(team.soldiers || [], used, ab, nightSet, dateStr, avoidDaySet);
        if (!dayPerson) unfilled++;
        else dayUsed.add(cleanName(dayPerson).toLowerCase());
      }
      fillGeneratedPosition(cells, ca, col, dayPerson, nightPerson, nightSlots);

      if (entry.type === "borrow") {
        borrowed.push({
          person: soldier,
          fromTeam: entry.fromTeam,
          toTeam: teamId,
          ca: ca + 1,
          col: col,
          reason: entry.reason,
          replacementFor: entry.out || ""
        });
        for (let slot = 0; slot < 3; slot++) {
          borrowMarks[(ca * 3 + slot) * 5 + col] = {
            fromTeam: entry.fromTeam,
            reason: entry.reason
          };
        }
      }
    }
  }

  // Chốt chặn cuối: tuyệt đối không xếp người đang vắng mặt vào lịch đi làm.
  const absentFinal = absSet(day.absent || {});
  for (let k = 0; k < 60; k++) {
    const person = (cells[k] || "").trim();
    if (person && isPersonAbsentIn(absentFinal, person)) {
      cells[k] = "";
      unfilled++;
    }
  }

  day.cells = cells;
  day.teamInCa = teamMap.slice();
  day.streaks = {};
  day.manualCredits = {};
  day.borrowed = borrowed;
  day.overworkSwaps = overworkSwaps;
  day.overworkKept = overworkKept;
  day.borrowMarks = borrowMarks;
  return { day, unfilled, borrowed, overworkSwaps, overworkKept };
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
  if (!ensureNoPendingAbsenceEdits()) return;

  const targetDate = addDay(curDate, 1);
  if (dayHasSchedule(targetDate) && !confirm(`Ngày ${vnFormat(targetDate)} đã có lịch. Cắt lại lịch cho ngày mai?`)) {
    return;
  }

  createSnapshot("Trước khi cắt lịch ngày " + vnFormat(targetDate));
  const prevDay = getDayData(curDate);
  const teamMap = nextTeamMap(detectTeamsInCa(prevDay));
  const built = buildGeneratedDay(targetDate, teamMap, prevDay);

  saveStorage();
  curDate = targetDate;
  expandedCells = {};
  buildScheduleTableDOM();
  render();

  let msg = `✅ Đã cắt lịch ngày ${vnFormat(targetDate)} (${DOW[parseDate(targetDate).getDay()]}) thành công!`;
  if (built.borrowed.length) {
    msg += `\n🔁 Đã mượn tạm thời ${built.borrowed.length} lượt quân số từ Tổ khác: ` +
      built.borrowed.map(b => `${cleanName(b.person)} (Tổ ${b.fromTeam} → Tổ ${b.toTeam})`).join(", ");
  }
  if (built.overworkSwaps.length) {
    msg += `\n🔄 Đã đổi ${built.overworkSwaps.length} lượt người làm quá ${getBorrowRules().maxConsecutiveDays} ngày liên tiếp.`;
  }
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
  if (!ensureNoPendingAbsenceEdits()) return;

  const startDate = addDay(curDate, 1);
  const dates = [];
  for (let i = 0; i < 7; i++) dates.push(addDay(startDate, i));

  const existing = dates.filter(dayHasSchedule);
  if (existing.length && !confirm(`Đã có lịch cho ${existing.length} ngày trong 7 ngày tới. Cắt lại toàn bộ 7 ngày?`)) {
    return;
  }

  createSnapshot(`Trước khi cắt lịch tuần (${vnFormat(startDate)} → ${vnFormat(dates[6])})`);
  let prevDay = getDayData(curDate);
  let teamMap = nextTeamMap(detectTeamsInCa(prevDay));
  let totalUnfilled = 0;
  let totalBorrowed = 0;
  let totalSwaps = 0;

  dates.forEach(dStr => {
    const built = buildGeneratedDay(dStr, teamMap, prevDay);
    totalUnfilled += built.unfilled;
    totalBorrowed += built.borrowed.length;
    totalSwaps += built.overworkSwaps.length;
    prevDay = built.day;
    teamMap = nextTeamMap(teamMap);
  });

  saveStorage();
  curDate = startDate;
  expandedCells = {};
  buildScheduleTableDOM();
  render();

  let msg = `✅ Đã cắt lịch 7 ngày (từ ${vnFormat(startDate)} đến ${vnFormat(dates[6])}) thành công!`;
  if (totalBorrowed > 0) {
    msg += `\n🔁 Đã mượn tạm thời ${totalBorrowed} lượt quân số từ Tổ khác trong 7 ngày.`;
  }
  if (totalSwaps > 0) {
    msg += `\n🔄 Đã đổi ${totalSwaps} lượt người làm quá ${getBorrowRules().maxConsecutiveDays} ngày liên tiếp.`;
  }
  if (totalUnfilled > 0) {
    msg += `\n⚠️ Có ${totalUnfilled} khung giờ ban ngày chưa bố trí được người thay (thiếu quân số không học buổi sáng).`;
  }
  alert(msg);
}

// Cắt lịch cả tháng (từ ngày mai đến hết tháng hiện tại).
function generateMonthSchedule() {
  if (getCurrentRole() !== "commander") {
    alert("Chỉ có Chỉ huy / Trưởng ban mới được cắt lịch!");
    return;
  }
  if (!ensureNoPendingAbsenceEdits()) return;

  const [y, m] = curDate.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const dates = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${pad(m)}-${pad(d)}`;
    if (dateStr <= curDate) continue; // chỉ cắt các ngày sau ngày đang xem
    dates.push(dateStr);
  }
  if (!dates.length) {
    alert("Không còn ngày nào trong tháng để cắt lịch.");
    return;
  }

  const existing = dates.filter(dayHasSchedule);
  if (existing.length && !confirm(`Đã có lịch cho ${existing.length}/${dates.length} ngày trong tháng. Ghi đè toàn bộ?`)) {
    return;
  }

  createSnapshot(`Trước khi cắt lịch tháng ${pad(m)}/${y}`);
  let prevDay = getDayData(curDate);
  let teamMap = nextTeamMap(detectTeamsInCa(prevDay));
  let totalUnfilled = 0;
  let totalBorrowed = 0;
  let totalSwaps = 0;

  dates.forEach(dStr => {
    const built = buildGeneratedDay(dStr, teamMap, prevDay);
    totalUnfilled += built.unfilled;
    totalBorrowed += built.borrowed.length;
    totalSwaps += built.overworkSwaps.length;
    prevDay = built.day;
    teamMap = nextTeamMap(teamMap);
  });

  saveStorage();
  curDate = dates[0];
  expandedCells = {};
  buildScheduleTableDOM();
  render();

  let msg = `✅ Đã cắt lịch tháng ${pad(m)}/${y} (${dates.length} ngày, từ ${vnFormat(dates[0])} đến ${vnFormat(dates[dates.length - 1])}) thành công!`;
  if (totalBorrowed > 0) {
    msg += `\n🔁 Đã mượn tạm thời ${totalBorrowed} lượt quân số từ Tổ khác.`;
  }
  if (totalSwaps > 0) {
    msg += `\n🔄 Đã đổi ${totalSwaps} lượt người làm quá ${getBorrowRules().maxConsecutiveDays} ngày liên tiếp.`;
  }
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
  const holder = document.getElementById("nightOnlyPicker");
  if (!holder) return;
  if (!NIGHT_ONLY_PICKER) {
    NIGHT_ONLY_PICKER = createNameChipPicker(holder, {
      placeholder: "Nhập hoặc chọn tên đồng chí chỉ làm ca đêm...",
      emptyText: "Chưa có đồng chí nào được đánh dấu.",
      getNames: () => parseNames(S.nightOnly || ""),
      onChange: (arr) => {
        const before = parseNames(S.nightOnly || "");
        S.nightOnly = arr.join(", ");
        saveStorage();
        updateNightOnlyMsg();
        const changed = nightOnlyDiff(before, arr);
        const days = propagateNightOnlyChange(changed);
        if (days > 0) {
          const msg = document.getElementById("nightOnlyMsg");
          if (msg) msg.textContent += ` Đã cập nhật lại ${days} ngày đã cắt sẵn.`;
        }
      }
    });
  }
  NIGHT_ONLY_PICKER.sync();
  updateNightOnlyMsg();
}

// Danh sách tên thay đổi giữa 2 lần nhập (thêm hoặc bớt).
// Chấp nhận cả chuỗi "A, B" lẫn mảng tên.
function nightOnlyDiff(beforeArr, afterArr) {
  const toList = (v) => Array.isArray(v)
    ? v.map(n => (n || "").trim()).filter(Boolean)
    : parseNames(v || "");
  const beforeList = toList(beforeArr);
  const afterList = toList(afterArr);
  const beforeSet = new Set(beforeList.map(n => cleanName(n).toLowerCase()));
  const afterSet = new Set(afterList.map(n => cleanName(n).toLowerCase()));
  const out = [];
  const seen = new Set();
  [...beforeList, ...afterList].forEach(n => {
    const key = cleanName(n).toLowerCase();
    if (!key || seen.has(key)) return;
    if (beforeSet.has(key) === afterSet.has(key)) return;
    seen.add(key);
    out.push(n);
  });
  return out;
}

// Khi danh sách "chỉ làm ca đêm" thay đổi, cập nhật ngay các ngày đã cắt sẵn
// từ ngày mai trở đi để lịch không còn giữ tình trạng cũ.
// - Thêm vào danh sách: khung ban ngày nhường cho người cùng Tổ, chỉ giữ khung đêm.
// - Bỏ khỏi danh sách (học xong buổi sáng): trả lại đủ 3 khung giờ của ca.
function propagateNightOnlyChange(changedNames) {
  const names = (changedNames || []).filter(Boolean);
  if (!names.length) return 0;
  const nightSet = getNightOnlySet();
  let changedDays = 0;
  let d = addDay(curDate, 1);
  for (let i = 0; i < 90; i++, d = addDay(d, 1)) {
    const day = S.days && S.days[d];
    if (!day || !Array.isArray(day.cells)) continue;
    if (!day.cells.some(c => (c || "").trim())) continue;
    const ab = absSet(day.absent || {});
    let touched = false;

    names.forEach(name => {
      const key = cleanName(name).toLowerCase();
      if (!key) return;
      const isNightOnly = isNightOnlyInSet(nightSet, name);
      const teamId = getPersonTeamId(name);
      const team = teamId && S.teams ? S.teams[teamId - 1] : null;

      for (let ca = 0; ca < 4; ca++) {
        const nightSlots = nightWindowSlotsForCa(ca);
        for (let col = 0; col < 5; col++) {
          const keys = [0, 1, 2].map(s => (ca * 3 + s) * 5 + col);
          const hit = keys.map(k => cleanName(day.cells[k] || "").toLowerCase() === key);
          if (!hit.some(Boolean)) continue;

          if (isNightOnly) {
            keys.forEach((k, s) => {
              if (nightSlots.indexOf(s) >= 0 || !hit[s]) return;
              const usedNow = new Set(day.cells.map(x => cleanName(x).toLowerCase()).filter(Boolean));
              const pool = col === 0 ? (team ? team.officers : []) : (team ? team.soldiers : []);
              let repl = "";
              for (const cand of pool) {
                const ck = cleanName(cand).toLowerCase();
                if (!ck || ck === key || usedNow.has(ck)) continue;
                if (isPersonAbsentIn(ab, cand)) continue;
                if (isNightOnlyInSet(nightSet, cand)) continue;
                repl = cand;
                break;
              }
              day.cells[k] = repl;
              delete day.streaks[k];
              touched = true;
            });
          } else {
            // Đã học xong: trả lại đủ 3 khung giờ trong ca (gộp 1 người).
            // Lấy đúng nhãn của người này ở khung đêm, không lấy nhãn người thay ban ngày.
            const ownLabel = keys.filter((k, s) => hit[s]).map(k => (day.cells[k] || "").trim()).find(Boolean) || name;
            keys.forEach(k => {
              if ((day.cells[k] || "").trim() !== ownLabel) {
                day.cells[k] = ownLabel;
                delete day.streaks[k];
                touched = true;
              }
            });
          }
        }
      }
    });

    if (touched) {
      day.teamInCa = detectTeamsInCa(day);
      if (!day.manualCredits) day.manualCredits = {};
      changedDays++;
    }
  }
  if (changedDays) saveStorage();
  return changedDays;
}

function updateNightOnlyMsg() {
  const msg = document.getElementById("nightOnlyMsg");
  if (!msg) return;
  const list = parseNames(S.nightOnly || "");
  msg.textContent = list.length
    ? `✅ Đang áp dụng cho ${list.length} đồng chí chỉ làm ca đêm (18:00 – 06:00): ${list.join(", ")}`
    : "Chưa có đồng chí nào được đánh dấu chỉ làm ca đêm (18:00 – 06:00).";
}

function saveNightOnlyList() {
  if (getCurrentRole() !== "commander") {
    if (NIGHT_ONLY_PICKER) NIGHT_ONLY_PICKER.sync();
    return;
  }
  if (NIGHT_ONLY_PICKER) NIGHT_ONLY_PICKER.sync();
  updateNightOnlyMsg();
}

// ===== KỶ LUẬT: NGƯỜI BỊ PHẠT LÀM 7 NGÀY LIÊN TỤC =====
function resolvePersonName(raw) {
  const key = cleanName(raw || "").toLowerCase();
  if (!key) return "";
  const found = getAllPersonNames().find(n => cleanName(n).toLowerCase() === key);
  return found || (raw || "").trim();
}

function populatePunishmentForm() {
  const nameEl = document.getElementById("punishPerson");
  const startEl = document.getElementById("punishStart");
  if (startEl && !startEl.value) startEl.value = curDate;
  if (nameEl && !nameEl.dataset.attached) {
    attachNameSuggestions(nameEl, getAllPersonNames);
    nameEl.dataset.attached = "1";
  }
  renderPunishmentList();
}

function renderPunishmentList() {
  const box = document.getElementById("punishList");
  const msg = document.getElementById("punishMsg");
  if (!box) return;
  const list = getPunishments().slice().sort((a, b) => {
    const ra = punishmentRange(a), rb = punishmentRange(b);
    return (ra.start || "").localeCompare(rb.start || "") ||
      cleanName(a.person).localeCompare(cleanName(b.person));
  });

  box.innerHTML = list.length ? list.map(p => {
    const r = punishmentRange(p);
    const active = isPunishedOn(p.person, curDate);
    const label = cleanName(p.person);
    return `<span class="punish-chip${active ? " active" : ""}" title="${escHTML(label)} — từ ${escHTML(vnFormat(r.start))} đến ${escHTML(vnFormat(r.end))}">` +
      `<span class="punish-icon">⚖️</span>` +
      `<b>${escHTML(label)}</b>` +
      `<span class="punish-range">${escHTML(vnFormat(r.start))} → ${escHTML(vnFormat(r.end))}</span>` +
      `<button type="button" class="punish-x" title="Bỏ khỏi danh sách phạt" onclick="removePunishment('${escHTML(String(p.id))}')">×</button>` +
      `</span>`;
  }).join("") : `<span class="empty">Chưa có ai bị phạt làm ${PUNISH_DAYS} ngày liên tục.</span>`;

  if (msg) {
    const activeCount = list.filter(p => isPunishedOn(p.person, curDate)).length;
    msg.textContent = list.length
      ? `⚖️ Đang có ${list.length} đồng chí bị phạt làm ${PUNISH_DAYS} ngày liên tục` +
        (activeCount ? ` (${activeCount} đồng chí đang trong thời hạn phạt hôm nay).` : ".")
      : `Chưa có đồng chí nào bị phạt làm ${PUNISH_DAYS} ngày liên tục.`;
  }
}

function addPunishment() {
  if (getCurrentRole() !== "commander") {
    alert("Chỉ có Chỉ huy / Trưởng ban mới được nhập danh sách phạt!");
    return;
  }
  const nameEl = document.getElementById("punishPerson");
  const startEl = document.getElementById("punishStart");
  const raw = (nameEl && nameEl.value ? nameEl.value : "").trim();
  if (!raw) {
    alert("Hãy chọn hoặc nhập tên đồng chí bị phạt.");
    return;
  }
  const start = (startEl && startEl.value) || curDate || fmtDate(new Date());
  const startAbs = absSet(getDayData(start).absent || {});
  const rawNames = raw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);

  const added = [];
  const skipped = [];
  rawNames.forEach(rawName => {
    const person = resolvePersonName(rawName) || rawName;
    if (!getPersonTeamId(person)) {
      skipped.push(`${cleanName(person)} (không thuộc biên chế 4 Tổ)`);
      return;
    }
    const existed = getPunishments().some(p =>
      cleanName(p.person).toLowerCase() === cleanName(person).toLowerCase() &&
      punishmentRange(p).start === start);
    if (existed) {
      skipped.push(`${cleanName(person)} (đã có từ ${vnFormat(start)})`);
      return;
    }
    if (isPersonAbsentIn(startAbs, person)) {
      skipped.push(`${cleanName(person)} (đang vắng ngày ${vnFormat(start)})`);
      return;
    }
    const p = {
      id: "p" + Date.now() + Math.floor(Math.random() * 1000) + added.length,
      person,
      start,
      days: PUNISH_DAYS
    };
    if (!Array.isArray(S.punishments)) S.punishments = [];
    S.punishments.push(p);
    added.push(p);
  });

  if (!added.length) {
    alert("Không thêm được đồng chí nào:\n- " + skipped.join("\n- "));
    return;
  }

  saveStorage();
  let totalChanged = 0;
  added.forEach(p => { totalChanged += propagatePunishment(p); });
  totalChanged += rebuildAutoUpcomingDays();
  if (nameEl) nameEl.value = "";
  if (startEl) startEl.value = curDate;
  renderPunishmentList();
  refresh();

  const r = punishmentRange(added[0]);
  let msg = added.length === 1
    ? `⚖️ Đã thêm ${cleanName(added[0].person)} vào danh sách bị phạt làm ${PUNISH_DAYS} ngày liên tục ` +
      `(${vnFormat(r.start)} → ${vnFormat(r.end)}).`
    : `⚖️ Đã thêm ${added.length} đồng chí vào danh sách bị phạt làm ${PUNISH_DAYS} ngày liên tục ` +
      `(${vnFormat(r.start)} → ${vnFormat(r.end)}): ${added.map(p => cleanName(p.person)).join(", ")}.`;
  if (totalChanged) msg += `\nĐã cập nhật ${totalChanged} ngày đã cắt sẵn.`;
  if (skipped.length) msg += `\nBỏ qua:\n- ${skipped.join("\n- ")}`;
  alert(msg);
}

function removePunishment(id) {
  if (getCurrentRole() !== "commander") return;
  const p = getPunishments().find(x => String(x.id) === String(id));
  if (!p) return;
  if (!confirm(`Bỏ ${cleanName(p.person)} khỏi danh sách bị phạt làm ${PUNISH_DAYS} ngày liên tục?`)) return;
  S.punishments = getPunishments().filter(x => String(x.id) !== String(id));
  saveStorage();
  const rebuilt = rebuildAutoUpcomingDays();
  renderPunishmentList();
  refresh();
  if (rebuilt) alert(`Đã cập nhật lại ${rebuilt} ngày đã cắt sẵn sau khi bỏ khỏi danh sách phạt.`);
}

// Đưa người bị phạt vào các ngày đã cắt sẵn trong thời hạn phạt:
// thay người cùng Tổ đang làm nhiều ngày liên tiếp nhất (trừ người cũng bị phạt).
function propagatePunishment(p) {
  if (!p || !p.person) return 0;
  const range = punishmentRange(p);
  if (!range.start) return 0;
  const person = p.person;
  const key = cleanName(person).toLowerCase();
  const teamId = getPersonTeamId(person);
  const nightSet = getNightOnlySet();
  if (!teamId) return 0;
  const team = (S.teams && S.teams[teamId - 1]) || {};
  const isOfficer = (team.officers || []).some(n => cleanName(n).toLowerCase() === key);
  const onlyNight = isNightOnlyInSet(nightSet, person);

  let changed = 0;
  for (let d = range.start; d <= range.end; d = addDay(d, 1)) {
    const day = S.days && S.days[d];
    if (!day || !Array.isArray(day.cells)) continue;
    if (!day.cells.some(c => (c || "").trim())) continue;
    if (day.cells.some(c => cleanName(c).toLowerCase() === key)) continue;
    const ab = absSet(day.absent || {});
    if (isPersonAbsentIn(ab, person)) continue;

    const det = detectTeamsInCa(day);
    const ca = det.indexOf(teamId);
    if (ca < 0) continue; // Tổ không trực ngày này
    const nightSlots = nightWindowSlotsForCa(ca);

    if (isOfficer) {
      // Đốc gác: thay sĩ quan của Tổ trong ca (chỉ khung đêm nếu đang học tập buổi sáng).
      for (let slot = 0; slot < 3; slot++) {
        if (onlyNight && nightSlots.indexOf(slot) < 0) continue;
        const k = (ca * 3 + slot) * 5;
        day.cells[k] = person;
        if (day.streaks) delete day.streaks[k];
      }
      day.manualCredits = {};
      day.teamInCa = detectTeamsInCa(day);
      changed++;
      continue;
    }

    if (onlyNight) continue; // Chiến sĩ chỉ làm ca đêm: đã được xếp khi cắt lịch.
    let best = null;
    for (let col = 1; col <= 4; col++) {
      const cur = (day.cells[(ca * 3 + 0) * 5 + col] || "").trim();
      if (!cur) { best = { col, streak: -1 }; break; }
      if (getPersonTeamId(cur) !== teamId) continue;
      if (isPunishedOn(cur, d)) continue;
      if (isNightOnlyInSet(nightSet, cur)) continue;
      const streak = consecutiveDutyDays(cur, d);
      if (!best || streak > best.streak) best = { col, streak };
    }
    if (!best) continue;

    for (let slot = 0; slot < 3; slot++) {
      const k = (ca * 3 + slot) * 5 + best.col;
      day.cells[k] = person;
      if (day.streaks) delete day.streaks[k];
    }
    day.manualCredits = {};
    day.teamInCa = detectTeamsInCa(day);
    changed++;
  }
  if (changed) saveStorage();
  return changed;
}

// Gắn dấu ⚖ cho các ô đang là người bị phạt trong ngày đang xem.
function refreshPunishMarks() {
  document.querySelectorAll("#body .cell").forEach(cell => {
    const labels = Array.from(cell.querySelectorAll("input.nm")).map(inp => (inp.value || "").trim());
    if (!labels.length) labels.push((cell.textContent || "").trim());
    cell.classList.toggle("punished", labels.some(l => !!l && isPunishedOn(l, curDate)));
  });
}

// ===== GIAO DIỆN CẢNH BÁO & MƯỢN QUÂN SỐ =====
function populateBorrowRules() {
  const r = getBorrowRules();
  const en = document.getElementById("borrowEnabled");
  const ma = document.getElementById("borrowMaxAbsent");
  const md = document.getElementById("borrowMaxDays");
  if (en) en.checked = !!r.enabled;
  if (ma) ma.value = r.maxAbsentSoldiers;
  if (md) md.value = r.maxConsecutiveDays;
  updateBorrowRulesMsg();
}

function updateBorrowRulesMsg() {
  const msg = document.getElementById("borrowMsg");
  if (!msg) return;
  const r = getBorrowRules();
  msg.textContent = r.enabled
    ? `✅ Đang bật: Tổ vắng quá ${r.maxAbsentSoldiers} chiến sĩ hoặc có người làm liên tiếp quá ${r.maxConsecutiveDays} ngày sẽ được cảnh báo và tự mượn quân số tạm thời từ Tổ khác.`
    : "⏸️ Đang tắt chế độ cảnh báo & mượn quân số tạm thời.";
}

function saveBorrowRules() {
  if (getCurrentRole() !== "commander") {
    populateBorrowRules();
    return;
  }
  const en = document.getElementById("borrowEnabled");
  const ma = document.getElementById("borrowMaxAbsent");
  const md = document.getElementById("borrowMaxDays");
  S.borrowRules = {
    enabled: !!(en && en.checked),
    maxAbsentSoldiers: clampInt(ma && ma.value, 0, 30, DEFAULT_BORROW_RULES.maxAbsentSoldiers),
    maxConsecutiveDays: clampInt(md && md.value, 1, 60, DEFAULT_BORROW_RULES.maxConsecutiveDays)
  };
  saveStorage();
  populateBorrowRules();
  refresh();
}

function saveTeamsFromTextareas() {
  if (getCurrentRole() !== "commander") {
    populateTeamTextareas();
    return;
  }

  // Đếm số hồ sơ đang hoạt động trước khi sửa để cảnh báo nếu giảm bất thường
  const oldActive = (S.personnelAccounts || []).filter(a => a.active !== false).length;
  const nextNames = new Set();
  for (let i = 0; i < 4; i++) {
    const oEl = document.getElementById(`team${i + 1}Off`);
    const sEl = document.getElementById(`team${i + 1}Sol`);
    [...parseNames(oEl ? oEl.value : ""), ...parseNames(sEl ? sEl.value : "")].forEach(n => {
      const key = cleanName(n).toLowerCase();
      if (key) nextNames.add(key);
    });
  }
  if (nextNames.size < oldActive) {
    const ok = confirm(`Số hồ sơ đang hoạt động giảm từ ${oldActive} xuống ${nextNames.size}.\n` +
      "Các hồ sơ bị rút khỏi 4 Tổ sẽ được đánh dấu NGỪNG HOẠT ĐỘNG (không xóa hẳn).\nTiếp tục lưu?");
    if (!ok) {
      populateTeamTextareas();
      return;
    }
  }

  createSnapshot("Trước khi lưu biên chế 4 Tổ");
  for (let i = 0; i < 4; i++) {
    const oEl = document.getElementById(`team${i + 1}Off`);
    const sEl = document.getElementById(`team${i + 1}Sol`);
    if (oEl && sEl) {
      S.teams[i].officers = parseNames(oEl.value);
      S.teams[i].soldiers = parseNames(sEl.value);
    }
  }
  const duplicatesFixed = syncFromTeamsToRosterAndAccounts();
  saveStorage();
  populateTeamTextareas();
  const rmsg = document.getElementById("rmsg");
  if (rmsg) {
    const extra = duplicatesFixed > 0
      ? ` ⚠️ Đã tự cấp lại ${duplicatesFixed} mã số bị trùng.`
      : "";
    rmsg.textContent = `✅ Đã lưu biên chế 4 Tổ: Tổng ${parseNames(S.officers).length} Đốc gác (Sĩ quan) & ${parseNames(S.soldiers).length} Chiến sĩ nghĩa vụ.${extra}`;
  }
  if (duplicatesFixed > 0) {
    alert(`⚠️ Phát hiện ${duplicatesFixed} mã số bị trùng. Hệ thống đã tự cấp mã mới không trùng và cập nhật lại danh sách 4 Tổ.`);
  }
  refresh();
}

// ===== XÁC NHẬN CHỈNH SỬA VẮNG MẶT TRƯỚC KHI CẮT LỊCH =====
function markAbsenceDraft(dateStr) {
  if (!S.absenceDraft || typeof S.absenceDraft !== "object") S.absenceDraft = {};
  S.absenceDraft[dateStr || curDate] = true;
}

function hasPendingAbsenceEdits() {
  return !!(S.absenceDraft && Object.keys(S.absenceDraft).length > 0);
}

function ensureNoPendingAbsenceEdits() {
  if (!hasPendingAbsenceEdits()) return true;
  alert("⚠️ Bạn đang có chỉnh sửa vắng mặt CHƯA XÁC NHẬN.\n" +
    "Hãy bấm nút \"✅ Xác nhận chỉnh sửa vắng mặt\" ở Phần 2 rồi mới cắt lịch.");
  return false;
}

function updateAbsenceConfirmBar() {
  const bar = document.getElementById("absenceConfirmBar");
  if (!bar) return;
  const dates = Object.keys(S.absenceDraft || {}).sort();
  bar.style.display = dates.length ? "flex" : "none";
  if (!dates.length) return;
  const text = bar.querySelector(".absence-confirm-text");
  if (text) {
    text.innerHTML = `⚠️ Có chỉnh sửa vắng mặt <b>chưa xác nhận</b>` +
      (dates.length ? ` (${escHTML(dates.map(d => vnFormat(d)).join(", "))})` : "") +
      `. Phải bấm xác nhận trước khi cắt lịch.`;
  }
}

// Thay thế người đang vắng bằng người cùng Tổ còn trống trong các ngày đã cắt sẵn.
function propagateAbsenceChange(absentNames) {
  const names = (absentNames || []).filter(Boolean);
  if (!names.length) return 0;
  let changedDays = 0;
  let d = curDate;
  for (let i = 0; i < 120; i++, d = addDay(d, 1)) {
    const day = S.days && S.days[d];
    if (!day || !Array.isArray(day.cells)) continue;
    if (!day.cells.some(c => (c || "").trim())) continue;
    const ab = absSet(day.absent || {});
    let touched = false;

    names.forEach(name => {
      const key = cleanName(name).toLowerCase();
      if (!key || !isPersonAbsentIn(ab, name)) return;
      const teamId = getPersonTeamId(name);
      const team = teamId && S.teams ? S.teams[teamId - 1] : null;

      for (let ca = 0; ca < 4; ca++) {
        for (let col = 0; col < 5; col++) {
          const keys = [0, 1, 2].map(s => (ca * 3 + s) * 5 + col);
          if (!keys.some(k => cleanName(day.cells[k] || "").toLowerCase() === key)) continue;

          const usedNow = new Set(day.cells.map(x => cleanName(x).toLowerCase()).filter(Boolean));
          const pool = col === 0 ? (team ? team.officers : []) : (team ? team.soldiers : []);
          const nightSet = getNightOnlySet();
          let repl = "";
          for (const cand of pool) {
            const ck = cleanName(cand).toLowerCase();
            if (!ck || ck === key || usedNow.has(ck)) continue;
            if (isPersonAbsentIn(ab, cand)) continue;
            if (isNightOnlyInSet(nightSet, cand)) continue;
            repl = cand;
            break;
          }
          keys.forEach(k => {
            if (cleanName(day.cells[k] || "").toLowerCase() !== key) return;
            day.cells[k] = repl;
            delete day.streaks[k];
            touched = true;
          });
        }
      }
    });

    if (touched) {
      day.teamInCa = detectTeamsInCa(day);
      if (!day.manualCredits) day.manualCredits = {};
      changedDays++;
    }
  }
  if (changedDays) saveStorage();
  return changedDays;
}

// Cắt lại tự động các ngày tương lai đã có lịch nhưng chưa bị chỉnh tay,
// sau khi danh sách vắng mặt thay đổi (thêm hoặc bớt người vắng).
function rebuildAutoUpcomingDays() {
  const futureDates = Object.keys(S.days || {})
    .filter(d => d > curDate && dayHasSchedule(d) && !S.days[d].manualEdited)
    .sort();
  if (!futureDates.length) return 0;
  let prevDay = getDayData(curDate);
  let teamMap = nextTeamMap(detectTeamsInCa(prevDay));
  let count = 0;
  futureDates.forEach(d => {
    const built = buildGeneratedDay(d, teamMap, prevDay);
    prevDay = built.day;
    teamMap = nextTeamMap(teamMap);
    count++;
  });
  saveStorage();
  return count;
}

function confirmAbsenceEdits() {
  const dates = Object.keys(S.absenceDraft || {});
  if (!dates.length) {
    alert("Không có chỉnh sửa vắng mặt nào cần xác nhận.");
    return;
  }
  const affected = new Set();
  dates.forEach(dStr => {
    const day = getDayData(dStr);
    day.absentTouched = true;
    CATS.forEach(c => parseNames(day.absent[c[0]]).forEach(n => affected.add(n)));

    // Danh sách vắng mặt có tính chất "giữ nguyên": chép sang các ngày sau
    // để ngày hôm sau cập nhật đúng người đang vắng/đi học.
    // - Ngày chưa chỉnh tay: lấy đúng danh sách mới nhất (thay toàn bộ).
    // - Ngày đã chỉnh tay: giữ danh sách riêng nhưng vẫn đồng bộ phần đã kế thừa
    //   từ ngày này (thêm người vắng mới, bỏ người đã đi làm/học lại).
    let d = addDay(dStr, 1);
    for (let i = 0; i < 90; i++, d = addDay(d, 1)) {
      const fut = S.days && S.days[d];
      if (!fut) break;
      if (!fut.absent || typeof fut.absent !== "object") fut.absent = {};
      if (fut.absentTouched === true) {
        const prevSnap = (fut.absentInherited && typeof fut.absentInherited === "object")
          ? fut.absentInherited : null;
        absenceCategoryKeys().forEach(k => {
          const today = parseNames(day.absent[k]);
          const todayKeys = new Set(today.map(n => cleanName(n).toLowerCase()));
          const prevKeys = new Set(parseNames(prevSnap ? prevSnap[k] : "").map(n => cleanName(n).toLowerCase()));
          // Bỏ những người trước đây kế thừa từ ngày này nhưng nay đã đi làm lại.
          const cur = parseNames(fut.absent[k]).filter(n => {
            const key = cleanName(n).toLowerCase();
            if (!key) return false;
            return !(prevKeys.has(key) && !todayKeys.has(key));
          });
          const seen = new Set(cur.map(n => cleanName(n).toLowerCase()));
          today.forEach(n => {
            const key = cleanName(n).toLowerCase();
            if (!key || seen.has(key)) return;
            cur.push(n);
            seen.add(key);
            affected.add(n);
          });
          parseNames(prevSnap ? prevSnap[k] : "").forEach(n => {
            const key = cleanName(n).toLowerCase();
            if (key && !todayKeys.has(key) && !seen.has(key)) affected.add(n);
          });
          fut.absent[k] = cur.join(", ");
        });
        fut.absentInherited = {};
        absenceCategoryKeys().forEach(k => {
          fut.absentInherited[k] = (day.absent[k] || "").trim();
        });
        fut.absentInheritedFrom = dStr;
        fut.absentInheritedSig = absenceCategoryKeys().map(k => (day.absent[k] || "").trim()).join("|");
        continue;
      }
      fut.absent = {};
      fut.absentInherited = {};
      absenceCategoryKeys().forEach(k => {
        fut.absent[k] = (day.absent[k] || "").trim();
        fut.absentInherited[k] = fut.absent[k];
        parseNames(fut.absent[k]).forEach(n => affected.add(n));
      });
      fut.absentInheritedFrom = dStr;
      fut.absentInheritedSig = absenceCategoryKeys().map(k => (day.absent[k] || "").trim()).join("|");
    }
  });

  const rebuilt = rebuildAutoUpcomingDays();
  const changedDays = propagateAbsenceChange(Array.from(affected));
  S.absenceDraft = {};
  saveStorage();
  render();
  alert(`✅ Đã xác nhận chỉnh sửa vắng mặt` +
    (affected.size ? ` cho ${affected.size} đồng chí` : "") +
    (rebuilt || changedDays ? `, cập nhật ${Math.max(rebuilt, changedDays)} ngày đã cắt sẵn` : "") +
    `. Bây giờ có thể cắt lịch.`);
}

function applyMultiDayAbsence() {  if (getCurrentRole() !== "commander") {
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
    dayData.absentTouched = true;
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
  if (!requireRole()) return;

  const catsContainer = document.getElementById("cats");
  catsContainer.innerHTML = "";
  ABS_PICKERS = {};
  CATS.forEach(c => {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `<div class="lb">* ${c[1]} (${c[2]}) <em id="n_${c[0]}">0</em></div>`;
    const holder = document.createElement("div");
    row.appendChild(holder);
    catsContainer.appendChild(row);
    ABS_PICKERS[c[0]] = createNameChipPicker(holder, {
      placeholder: `Nhập hoặc chọn tên (${c[1]})...`,
      emptyText: "Chưa có ai.",
      getNames: () => parseNames(getDayData(curDate).absent[c[0]]),
      onChange: (arr) => {
        const d = getDayData(curDate);
        d.absent[c[0]] = arr.join(", ");
        // Đánh dấu ngày đã chỉnh tay + chờ xác nhận: chỉ khi bấm "Xác nhận"
        // thì thay đổi mới được áp dụng và mới cho phép cắt lịch.
        d.absentTouched = true;
        markAbsenceDraft(curDate);
        saveStorage();
        refresh();
      }
    });
  });

  populateTeamTextareas();
  populateNightOnlyTextarea();
  populatePunishmentForm();
  populateBorrowRules();
  for (let t = 1; t <= 4; t++) {
    ["team" + t + "Off", "team" + t + "Sol"].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        // Chỉ lưu khi rời khỏi ô, không lưu theo từng ký tự gõ.
        el.addEventListener("blur", saveTeamsFromTextareas);
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
  attachNameSuggestions(document.getElementById("leavePerson"), getAllPersonNames);

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

// ===== ALERT BÁO ĐỎ =====
// Hiển thị hộp thoại cảnh báo khi phát hiện lỗi đỏ (lịch sai, vắng vẫn xếp gác,
// trùng ca, lẫn Tổ, nối ngày...). Hộp thoại tồn tại cho tới khi người dùng bấm OK.
// Cùng một nhóm lỗi chỉ hiện một lần để không chặn thao tác liên tục.
let lastRedAlertSignature = "";

function showRedAlert(warnings) {
  const reds = (warnings || []).filter(w => String(w).indexOf("❌") >= 0);
  if (!reds.length) {
    lastRedAlertSignature = "";
    return;
  }
  const signature = reds.map(w => String(w).split(":")[0]).join("\n");
  if (signature === lastRedAlertSignature) return;
  lastRedAlertSignature = signature;
  // Trì hoãn 1 nhịp để DOM kịp cập nhật trước khi alert chặn giao diện.
  setTimeout(() => {
    alert("⛔ PHÁT HIỆN VẤN ĐỀ CẦN XỬ LÝ:\n\n" +
      reds.join("\n\n") +
      "\n\n(Nhấn OK để tắt thông báo)");
  }, 0);
}

// Cập nhật nhãn cấp bậc hàm trong các ô lịch theo tên đang có trong ô.
function refreshRankBadges() {
  const day = getDayData(curDate);
  document.querySelectorAll("#body .cell").forEach(cell => {
    const badge = cell.querySelector(".rank-badge");
    if (!badge) return;
    const k = parseInt(badge.dataset.k, 10);
    if (!Number.isFinite(k)) return;
    const rank = typeof getPersonRank === "function" ? getPersonRank(day.cells[k] || "") : "";
    if (rank) {
      badge.textContent = rank;
      badge.title = `Cấp bậc hàm: ${getRankLabel(rank)}`;
      badge.style.display = "";
      cell.classList.add("has-rank");
    } else {
      badge.textContent = "";
      badge.removeAttribute("title");
      badge.style.display = "none";
      cell.classList.remove("has-rank");
    }
  });
  refreshPunishMarks();
  renderPunishmentList();
}

function refresh() {
  const day = getDayData(curDate);
  if (document.getElementById("body")) refreshRankBadges();
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

  // ===== Thông tin cảnh báo & mượn quân số của ngày đang xem =====
  const borrowRules = getBorrowRules();
  const nightSet = getNightOnlySet();
  const dayBorrowed = Array.isArray(day.borrowed) ? day.borrowed : [];
  const borrowedKey = {};
  dayBorrowed.forEach(b => {
    if (!b || !b.person) return;
    borrowedKey[cleanName(b.person).toLowerCase()] = true;
  });
  // Tổ nào đang vắng quá ngưỡng chiến sĩ
  const shortTeamCa = {};
  for (let ca = 0; ca < 4; ca++) {
    const tid = detectedTeams[ca] || (ca + 1);
    shortTeamCa[ca] = countAbsentSoldiersOfTeam(tid, curDate) > borrowRules.maxAbsentSoldiers;
  }
  const isBorrowAllowed = (n, caIdx) => {
    if (!n) return false;
    if (shortTeamCa[caIdx]) return true;
    const cName = cleanName(n).toLowerCase();
    return dayBorrowed.some(b =>
      b && b.person && b.ca === caIdx + 1 &&
      cleanName(b.person).toLowerCase() === cName
    );
  };

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
        if (isBorrowAllowed(n, caIdx)) {
          // Người được mượn / giao nhiệm vụ từ Tổ khác: không tính là lỗi đỏ
        } else {
          isWrongTeam = true;
          crossTeamErrors.push(`${n} thuộc Tổ ${personTeamId} nhưng đang xếp vào Ca ${caIdx + 1} của Tổ ${expectedTeamId}`);
        }
      }

      if (hasConsecutiveShift(day, n, k)) {
        isCon = true;
        consecutiveErrors.push(n);
      }
    }

    const isBad = !!(n && (ab[cName] || ab[n] || wg || isCon || isWrongTeam));
    if (IN[k]) {
      IN[k].classList.toggle("bad", isBad);
      const mark = day.borrowMarks && day.borrowMarks[k];
      IN[k].classList.toggle("borrowed", !!mark);
      if (mark) {
        IN[k].title = `Mượn từ Tổ ${mark.fromTeam}${mark.reason ? " — " + mark.reason : ""}`;
      } else if (IN[k].title && IN[k].title.indexOf("Mượn từ Tổ") === 0) {
        IN[k].title = "";
      }
    }

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
      if (!isBorrowAllowed(n, caIdx)) {
        hasCriticalError = true;
      }
    }
  }

  if (absIn.length) warnings.push("❌ BÁO ĐỎ: Chiến sĩ đang trong danh sách nghỉ/vắng (phép, ốm, công tác...) vẫn bị xếp gác: " + Array.from(new Set(absIn)).join(", "));
  if (consecutiveErrors.length) warnings.push("❌ BÁO ĐỎ: Có chiến sĩ làm 2 ca liền giờ nhau: " + Array.from(new Set(consecutiveErrors)).join(", "));
  if (wrong.length) warnings.push("❌ BÁO ĐỎ SAI CHỨC DANH (Đốc gác không thay cho Chiến sĩ và ngược lại): " + Array.from(new Set(wrong)).join(" | "));
  if (crossTeamErrors.length) warnings.push("❌ BÁO ĐỎ LẪN TỔ GÁC (Chiến sĩ chỉ thay thế trong cùng 1 Tổ cố định): " + Array.from(new Set(crossTeamErrors)).join(" | "));

  // Kiểm tra nối ngày D-1 → D cho ngày đang xem (Ca 4 · 04:00–06:00 → Ca 1 · 06:00–08:00)
  const crossDayNow = auditCrossDayConflicts().filter(c => c.from === curDate || c.to === curDate);
  if (crossDayNow.length) {
    hasCriticalError = true;
    warnings.push("❌ BÁO ĐỎ NỐI NGÀY: " + crossDayNow.map(c => c.message).join(" | "));
  }

  warnings.forEach(w => {
    const div = document.createElement("div");
    div.textContent = w;
    warnEl.appendChild(div);
  });

  // Mỗi khi có báo đỏ, bật hộp thoại alert để người dùng không bỏ sót vấn đề.
  // Alert chỉ tự tắt khi người dùng bấm OK; cùng một nhóm lỗi chỉ hiện 1 lần.
  showRedAlert(warnings);

  // ===== Cảnh báo & thông tin mượn quân số tạm thời =====
  const notes = [];
  if (borrowRules.enabled) {
    // 1) Tổ vắng quá ngưỡng
    for (let ca = 0; ca < 4; ca++) {
      const tid = detectedTeams[ca] || (ca + 1);
      const absentCount = countAbsentSoldiersOfTeam(tid, curDate);
      if (absentCount > borrowRules.maxAbsentSoldiers) {
        const borrowsOfTeam = dayBorrowed.filter(b => b && b.toTeam === tid);
        const borrowText = borrowsOfTeam.length
          ? "đã mượn: " + borrowsOfTeam.map(b => `${cleanName(b.person)} (Tổ ${b.fromTeam})`).join(", ")
          : "chưa bố trí đủ người thay";
        notes.push({
          level: "warn",
          text: `⚠️ CẢNH BÁO: Tổ ${tid} (Ca ${ca + 1}) vắng ${absentCount} chiến sĩ — vượt ngưỡng ${borrowRules.maxAbsentSoldiers}; ${borrowText}.`
        });
      }
    }

    // 2) Chiến sĩ làm quá số ngày liên tiếp mà vẫn đang gác
    const overNames = {};
    for (let k = 0; k < 60; k++) {
      const n = (day.cells[k] || "").trim();
      if (!n) continue;
      if (isNightOnlyInSet(nightSet, n)) continue;
      // Người đang bị phạt làm 7 ngày liên tục: không cảnh báo "cần nghỉ".
      if (isPunishedOn(n, curDate)) continue;
      const key = cleanName(n).toLowerCase();
      if (overNames[key]) continue;
      const streak = calculateStreak(n, curDate);
      if (streak > borrowRules.maxConsecutiveDays) {
        overNames[key] = { name: n, streak };
      }
    }
    Object.keys(overNames).forEach(key => {
      const o = overNames[key];
      notes.push({
        level: "warn",
        text: `⚠️ CẢNH BÁO: ${o.name} đã làm ${o.streak} ngày liên tiếp (ngưỡng ${borrowRules.maxConsecutiveDays}) — cần nghỉ hoặc mượn người thay.`
      });
    });

    // 3) Thông tin mượn quân số trong ngày
    dayBorrowed.forEach(b => {
      if (!b || !b.person) return;
      notes.push({
        level: "info",
        text: `🔁 MƯỢN QUÂN SỐ: ${cleanName(b.person)} (Tổ ${b.fromTeam}) → Ca ${b.ca} của Tổ ${b.toTeam}${b.reason ? " — " + b.reason : ""}.`
      });
    });

    // 4) Đổi người do làm quá số ngày
    (day.overworkSwaps || []).forEach(s => {
      if (!s || !s.out || !s.in) return;
      notes.push({
        level: "info",
        text: `🔄 ĐỔI NGƯỜI: ${cleanName(s.out)} đã làm ${s.outStreak} ngày liên tiếp → nghỉ; thay bằng ${cleanName(s.in)}${s.borrowed ? ` (mượn Tổ ${s.fromTeam})` : " (cùng Tổ)"} ở Ca ${s.ca}.`
      });
    });

    // 5) Trường hợp không còn ai thay, buộc phải giữ người quá ngày
    (day.overworkKept || []).forEach(o => {
      if (!o || !o.person) return;
      notes.push({
        level: "warn",
        text: `⚠️ CẢNH BÁO: Không còn người thay, ${cleanName(o.person)} vẫn phải gác Ca ${o.ca} dù đã làm ${o.days} ngày liên tiếp.`
      });
    });
  }

  // 6) Người đang bị phạt làm 7 ngày liên tục trong ngày đang xem
  getPunishments().forEach(p => {
    if (!isPunishedOn(p.person, curDate)) return;
    const r = punishmentRange(p);
    notes.push({
      level: "info",
      text: `⚖️ KỶ LUẬT: ${cleanName(p.person)} bị phạt làm ${r.days} ngày liên tục (từ ${vnFormat(r.start)} đến ${vnFormat(r.end)}) — luôn được xếp gác, không đổi ra nghỉ.`
    });
  });

  notes.forEach(n => {
    const div = document.createElement("div");
    div.className = n.level === "warn" ? "note-warn" : "note-info";
    div.textContent = n.text;
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
  updateAbsenceConfirmBar();
}

function render() {
  const day = getDayData(curDate);
  document.getElementById("date").value = curDate;
  document.getElementById("dow").textContent = DOW[parseDate(curDate).getDay()];
  buildScheduleTableDOM();
  for (let k = 0; k < 60; k++) {
    if (IN[k]) IN[k].value = day.cells[k] || "";
  }
  refreshRankBadges();
  CATS.forEach(c => {
    if (ABS_PICKERS[c[0]]) ABS_PICKERS[c[0]].sync();
  });
  refresh();
}

// Khởi động trang Quản lý lập lịch sau khi DOM sẵn sàng
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUI);
} else {
  initUI();
}
