let chart1Instance = null;
let chart2Instance = null;
let chart3Instance = null;

function initDashboard() {
  loadStorage();
  if (!requireRole("commander")) return;
  updateTopBarShared();
  const dateInput = document.getElementById("dashDate");
  dateInput.value = fmtDate(new Date());
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
  let listHtml = "";
  for (let ca = 0; ca < 4; ca++) {
    const docGac = day.cells[(ca * 3) * 5 + 0] || "Chưa xếp";
    const vong9 = day.cells[(ca * 3) * 5 + 1] || "-";
    const vong10 = day.cells[(ca * 3) * 5 + 2] || "-";
    const filledCount = [0,1,2,3,4].filter(c => (day.cells[(ca * 3) * 5 + c] || "").trim() !== "").length;
    const pct = Math.round((filledCount / 5) * 100);
    listHtml += `
      <li class="duty-item" style="cursor:pointer;" onclick="window.location.href='tim-kiem.html?q=Ca+${ca + 1}'">
        <span class="duty-avatar">C${ca + 1}</span>
        <div class="duty-info">
          <span class="duty-name">Ca ${ca + 1}: Đốc gác ${docGac}</span>
          <span class="duty-sub">Khung giờ: ${CA[ca].join(" · ")} | Vọng: ${vong9}, ${vong10}...</span>
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
        label: "Số lượng quân nhân (người)",
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
}

window.onload = initDashboard;
