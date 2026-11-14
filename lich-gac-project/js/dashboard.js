let chart1Instance = null;
let chart2Instance = null;
let chart3Instance = null;

function initDashboard() {
  loadStorage();
  if (!requireRole("commander")) return;
  updateTopBarShared();
  const dateInput = document.getElementById("dashDate");
  dateInput.value = fmtDate(new Date());
  const monthInput = document.getElementById("fairMonth");
  if (monthInput) monthInput.value = fmtDate(new Date()).slice(0, 7);
  renderDashboard();
}

function renderDashboard() {
  const dStr = document.getElementById("dashDate").value || fmtDate(new Date());
  const day = getDayData(dStr);
  const off = parseNames(S.officers);
  const sol = parseNames(S.soldiers);
  const ab = absSet(day.absent);

  const workingAll = {};
  const workingOff = {};
  const workingSol = {};

  for (let k = 0; k < 60; k++) {
    const n = (day.cells[k] || "").trim();
    if (!n) continue;
    const cName = cleanName(n);
    workingAll[cName] = 1;
    if (k % 5 === 0) workingOff[cName] = 1;
    else workingSol[cName] = 1;
  }

  const restO = off.filter(n => !ab[cleanName(n)] && !workingAll[cleanName(n)]);
  const restS = sol.filter(n => !ab[cleanName(n)] && !workingAll[cleanName(n)]);

  const countWorking = Object.keys(workingAll).length;
  const countRest = restO.length + restS.length;

  const countPhep = parseNames(day.absent["phep"]).length;
  const countCongTac = parseNames(day.absent["congtac"]).length;
  const countOm = parseNames(day.absent["om"]).length;
  const countOmVien = parseNames(day.absent["om_tai_vien"]).length;
  const countNghiBu = parseNames(day.absent["nghibu"]).length;
  const countHocTap = parseNames(day.absent["hoctap"]).length;
  const countKhac = parseNames(day.absent["khac"]).length;

  const totalUnit = (off.length + sol.length) || (countWorking + countRest + countPhep + countCongTac + countOm + countOmVien + countNghiBu + countHocTap + countKhac);

  document.getElementById("kpiTotalUnit").textContent = totalUnit;
  document.getElementById("kpiWorking").textContent = countWorking;
  document.getElementById("kpiRest").textContent = countRest;
  document.getElementById("kpiPhepCongTac").textContent = countPhep + countCongTac;
  document.getElementById("kpiOmTotal").textContent = countOm + countOmVien;
  document.getElementById("kpiHocTapKhac").textContent = countNghiBu + countHocTap + countKhac;

  const dutyListEl = document.getElementById("dashDutyList");
  const withStreak = (name) => {
    const n = (name || "").trim();
    if (!n || n === "-" || n === "Chưa xếp") return escHTML(n || "");
    const streak = getPersonStreak(dStr, n);
    const sup = (streak === "" || streak == null)
      ? ""
      : ` <sup class="streak-sup" title="Số ngày làm liên tiếp (mũ ${streak})">${streak}</sup>`;
    return escHTML(n) + sup;
  };
  let listHtml = "";
  // Ca lẻ (tách khung giờ) có thể có người khác nhau ở từng khung:
  // mỗi vị trí được coi là có người nếu ít nhất một trong 3 khung có tên.
  const firstFilled = (day, ca, col) => {
    for (let s = 0; s < 3; s++) {
      const v = (day.cells[(ca * 3 + s) * 5 + col] || "").trim();
      if (v) return v;
    }
    return "";
  };
  for (let ca = 0; ca < 4; ca++) {
    const docGac = firstFilled(day, ca, 0) || "Chưa xếp";
    const vong9 = firstFilled(day, ca, 1) || "-";
    const vong10 = firstFilled(day, ca, 2) || "-";
    const filledCount = [0, 1, 2, 3, 4].filter(c => firstFilled(day, ca, c) !== "").length;
    const pct = Math.round((filledCount / 5) * 100);
    listHtml += `
      <li class="duty-item" style="cursor:pointer;" onclick="window.location.href='tim-kiem.html?q=Ca+${ca + 1}'">
        <span class="duty-avatar">C${ca + 1}</span>
        <div class="duty-info">
          <span class="duty-name">Ca ${ca + 1}: Đốc gác ${withStreak(docGac)}</span>
          <span class="duty-sub">Khung giờ: ${escHTML(CA[ca].join(" · "))} | Vọng: ${withStreak(vong9)}, ${withStreak(vong10)}...</span>
        </div>
        <span class="duty-pct">${pct}%</span>
      </li>
    `;
  }
  dutyListEl.innerHTML = listHtml;

  const ctx2 = document.getElementById("chartWorkingVsRest").getContext("2d");
  if (chart2Instance) chart2Instance.destroy();
  chart2Instance = new Chart(ctx2, {
    type: "pie",
    data: {
      labels: ["Đang đi làm (Gác)", "Trực cơ động tại đơn vị"],
      datasets: [{
        data: [countWorking, countRest],
        backgroundColor: ["#00cc88", "#0088ff"],
        borderColor: "#ffffff",
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 12 } } }
      }
    }
  });

  const ctx1 = document.getElementById("chartAllStatuses").getContext("2d");
  if (chart1Instance) chart1Instance.destroy();
  chart1Instance = new Chart(ctx1, {
    type: "bar",
    data: {
      labels: ["Đi làm", "Ốm", "Ốm viện", "Nghỉ phép", "Công tác", "Nghỉ bù", "Học tập", "Công việc khác"],
      datasets: [{
        label: "Số lượng đồng chí (người)",
        data: [countWorking, countOm, countOmVien, countPhep, countCongTac, countNghiBu, countHocTap, countKhac],
        backgroundColor: [
          "#1e90ff", "#ff5252", "#d32f2f", "#9c27b0", "#ff9800", "#4caf50", "#03a9f4", "#78909c"
        ],
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });

  const ctx3 = document.getElementById("chartTodayBreakdown").getContext("2d");
  if (chart3Instance) chart3Instance.destroy();
  chart3Instance = new Chart(ctx3, {
    type: "bar",
    data: {
      labels: ["Tổng đi làm", "Tổng trực cơ động", "SQ đi làm", "CS đi làm", "SQ trực cơ động", "CS trực cơ động"],
      datasets: [{
        label: "Quân số hôm nay (người)",
        data: [countWorking, countRest, Object.keys(workingOff).length, Object.keys(workingSol).length, restO.length, restS.length],
        backgroundColor: "#1e90ff",
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 2 } }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });

  renderMonthlyFairness();
}

window.onload = initDashboard;

// ===== THỐNG KÊ CÔNG BẰNG THEO THÁNG (M1) =====
function renderMonthlyFairness() {
  const monthEl = document.getElementById("fairMonth");
  const table = document.getElementById("fairnessTable");
  const summary = document.getElementById("fairnessSummary");
  if (!monthEl || !table || !summary) return;

  const month = monthEl.value || fmtDate(new Date()).slice(0, 7);
  const result = computeMonthlyFairness(month);
  const tbody = table.querySelector("tbody");
  const rows = result.rows || [];

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--muted);">Chưa có dữ liệu lịch trong tháng này.</td></tr>`;
    summary.textContent = `Tháng ${month.split("-")[1]}/${month.split("-")[0]}: chưa có dữ liệu.`;
    return;
  }

  const totalCredit = rows.reduce((s, r) => s + (Number(r.credit) || 0), 0);
  const avg = totalCredit / rows.length;
  const max = Math.max(...rows.map(r => Number(r.credit) || 0));
  const min = Math.min(...rows.map(r => Number(r.credit) || 0));
  const spread = max - min;

  summary.innerHTML =
    `Tháng <b>${escHTML(month.split("-")[1])}/${escHTML(month.split("-")[0])}</b> · ` +
    `${rows.length} chiến sĩ · Tổng điểm công <b>${totalCredit.toFixed(1)}</b> · ` +
    `Trung bình <b>${avg.toFixed(1)}</b> · Chênh lệch cao nhất – thấp nhất <b>${spread.toFixed(1)}</b>` +
    (spread > 3 ? ` · <span style="color:#c62828;">⚠️ Chênh lệch lớn, cần cân đối</span>` : ` · <span style="color:#2e7d32;">✅ Tương đối công bằng</span>`);

  tbody.innerHTML = rows.map(r => {
    const credit = Number(r.credit) || 0;
    let color = "";
    if (rows.length > 2 && credit > avg + 0.5) color = "#c62828";
    else if (rows.length > 2 && credit < avg - 0.5) color = "#1565c0";
    return `<tr>
      <td style="text-align:center;">${r.teamId ? "Tổ " + r.teamId : "—"}</td>
      <td><b>${escHTML(r.name)}</b></td>
      <td style="text-align:center;">${r.days}</td>
      <td style="text-align:center;">${r.shifts}</td>
      <td style="text-align:center;">${r.nightCas != null ? r.nightCas : r.nightShifts}</td>
      <td style="text-align:center;">${r.dayShifts}</td>
      <td style="text-align:center;">${r.weekendDays}</td>
      <td style="text-align:center;font-weight:700;color:${color || "inherit"};">${credit.toFixed(1)}</td>
    </tr>`;
  }).join("");
}

function exportFairnessCSV() {
  const monthEl = document.getElementById("fairMonth");
  const month = (monthEl && monthEl.value) || fmtDate(new Date()).slice(0, 7);
  const result = computeMonthlyFairness(month);
  const rows = result.rows || [];
  if (!rows.length) {
    alert("Chưa có dữ liệu để xuất cho tháng này.");
    return;
  }
  const header = ["Tổ", "Họ tên", "Ngày công", "Khung gác", "Ca đêm", "Ban ngày", "Ngày cuối tuần", "Điểm công"];
  const lines = [header.join(",")];
  rows.forEach(r => {
    const cells = [
      r.teamId ? "Tổ " + r.teamId : "",
      r.name,
      r.days,
      r.shifts,
      r.nightCas != null ? r.nightCas : r.nightShifts,
      r.dayShifts,
      r.weekendDays,
      (Number(r.credit) || 0).toFixed(1)
    ];
    lines.push(cells.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
  });
  // BOM để Excel mở đúng tiếng Việt
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ThongKeCongBang_${month}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
