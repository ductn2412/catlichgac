function exportToExcel(dateStr) {
  if (!window.XLSX) {
    alert("Thư viện Excel đang tải, vui lòng thử lại sau giây lát.");
    return;
  }
  const day = getDayData(dateStr);
  const data = [
    ["LỊCH GÁC NGÀY " + vnFormat(dateStr)],
    [],
    ["Ca", "Khung giờ", "Đốc gác 1 (Quản lý)", "Vọng gác x9", "Vọng gác x10", "Vọng gác x11", "Vọng gác x12"]
  ];

  CA.forEach((slots, caIdx) => {
    slots.forEach((timeStr, slotIdx) => {
      const rowIdx = caIdx * 3 + slotIdx;
      const row = [
        slotIdx === 0 ? `Ca ${caIdx + 1}` : "",
        timeStr,
        day.cells[rowIdx * 5] || "",
        day.cells[rowIdx * 5 + 1] || "",
        day.cells[rowIdx * 5 + 2] || "",
        day.cells[rowIdx * 5 + 3] || "",
        day.cells[rowIdx * 5 + 4] || ""
      ];
      data.push(row);
    });
  });

  data.push([]);
  data.push(["THÔNG TIN NGHỈ & VẮNG MẶT"]);
  CATS.forEach(c => {
    data.push([c[1], day.absent[c[0]] || "Không có"]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Lịch Gác");
  XLSX.writeFile(wb, `LichGac_${dateStr}.xlsx`);
}

// Tạo bản sao vùng in đã tinh gọn, dùng chung cho cả "Xuất PDF" và "In lịch"
// để hai đường xuất luôn cho ra cùng một bố cục.
function buildPdfExportClone(dateStr) {
  const element = document.getElementById("print-area");
  if (!element) return null;

  // Nhân bản vùng in để không làm thay đổi giao diện đang hiển thị.
  const clone = element.cloneNode(true);
  clone.removeAttribute("id");
  clone.querySelectorAll(".no-print, .modal-backdrop, .bar, .roster, .import-bar").forEach(n => n.remove());
  clone.querySelectorAll("button").forEach(n => n.remove());

  // Hiện tiêu đề/footer chuẩn của bản in.
  clone.querySelectorAll(".military-print-header, .military-print-footer").forEach(n => {
    n.style.display = "flex";
  });

  // Bỏ thanh cuộn, cho bảng tràn đầy trang A4 ngang.
  clone.querySelectorAll(".scroll").forEach(n => {
    n.style.overflow = "visible";
    n.style.maxHeight = "none";
    n.style.height = "auto";
  });
  clone.querySelectorAll("table").forEach(t => {
    t.style.width = "100%";
    t.style.fontSize = "11px";
    t.style.borderCollapse = "collapse";
  });

  // Bảng lịch nằm riêng trang 1; phần còn lại (quân số, vắng mặt, chữ ký)
  // bắt đầu trang 2 để bản PDF gọn và đúng bố cục.
  const phan2Heading = Array.from(clone.querySelectorAll("h2"))
    .find(h => /Phần\s*2/i.test(h.textContent || ""));
  const phan2Section = phan2Heading ? phan2Heading.closest("section") : null;
  if (phan2Section) {
    phan2Section.style.pageBreakBefore = "always";
    phan2Section.style.breakBefore = "page";
  }

  // Rút gọn danh sách vắng mặt thành các dòng chữ (thay cho bộ chọn chip)
  // để phần còn lại của bản PDF gọn trong 1 trang.
  const catsEl = clone.querySelector("#cats");
  if (catsEl && typeof CATS !== "undefined" && typeof getDayData === "function") {
    const dayData = getDayData(dateStr);
    const summary = document.createElement("div");
    summary.className = "pdf-absence-summary";
    CATS.forEach(c => {
      const raw = (dayData.absent && dayData.absent[c[0]]) || "";
      const names = (typeof parseNames === "function")
        ? parseNames(raw)
        : String(raw).split(",").map(s => s.trim()).filter(Boolean);
      const line = document.createElement("div");
      line.className = "pdf-abs-line";
      line.innerHTML = `<b>* ${c[1]} (${c[2]}):</b> ${names.length ? names.join(", ") : "Không có"}`;
      summary.appendChild(line);
    });
    catsEl.replaceWith(summary);
  }

  // Rút gọn danh sách trực cơ động thành 2 dòng chữ.
  const restEl = clone.querySelector(".rest");
  if (restEl) {
    const summary = document.createElement("div");
    summary.className = "pdf-rest-summary";
    restEl.querySelectorAll(".part").forEach(part => {
      const ph = part.querySelector(".ph");
      const title = ph ? ph.textContent.replace(/\s+/g, " ").trim() : "";
      const names = Array.from(part.querySelectorAll(".chip"))
        .map(ch => ch.textContent.trim())
        .filter(Boolean);
      const line = document.createElement("div");
      line.className = "pdf-rest-line";
      line.innerHTML = `<b>${title}:</b> ${names.length ? names.join(", ") : "Không có"}`;
      summary.appendChild(line);
    });
    restEl.replaceWith(summary);
  }

  // Ô nhập liệu → chữ tĩnh để bản PDF không bị cắt chữ.
  clone.querySelectorAll("input, textarea, select").forEach(el => {
    const span = document.createElement("span");
    let val = el.value || "";
    if (el.tagName === "SELECT" && el.options && el.selectedIndex >= 0) {
      val = el.options[el.selectedIndex].text || "";
    }
    span.textContent = val;
    el.replaceWith(span);
  });

  const wrapper = document.createElement("div");
  wrapper.className = "pdf-export";
  wrapper.style.cssText =
    "background:#ffffff;color:#000000;width:277mm;padding:0;" +
    "font-family:'Times New Roman',serif;";
  wrapper.appendChild(clone);
  return wrapper;
}

function exportToPDF(dateStr) {
  if (!window.html2pdf) {
    alert("Thư viện PDF đang tải, vui lòng thử lại.");
    return;
  }
  const wrapper = buildPdfExportClone(dateStr);
  if (!wrapper) {
    alert("Không tìm thấy vùng in lịch.");
    return;
  }
  document.body.appendChild(wrapper);

  const opt = {
    margin: [10, 10, 10, 10],
    filename: `LichGac_${dateStr || fmtDate(new Date())}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      // Bắt buộc neo về gốc tài liệu: nếu trang đang cuộn ngang (do nội dung rộng),
      // html2canvas sẽ lấy pageXOffset làm mốc và cắt mất phần bên trái của bảng.
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      windowWidth: Math.max(document.documentElement.clientWidth, wrapper.scrollWidth)
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
    pagebreak: { mode: ["css", "legacy"], avoid: ["tr", "td", "th", ".card"] }
  };

  html2pdf().set(opt).from(wrapper).save()
    .then(() => wrapper.remove())
    .catch(err => {
      wrapper.remove();
      alert("❌ Không xuất được PDF: " + (err && err.message ? err.message : err));
    });
}

// In lịch bằng đúng bản sao đã tinh gọn của "Xuất PDF", tránh việc cửa sổ hẹp
// kích hoạt giao diện mobile và làm bảng bị cắt/tràn nhiều trang.
function printSchedule(dateStr) {
  document.querySelectorAll(".print-clone").forEach(n => n.remove());
  const wrapper = buildPdfExportClone(dateStr);
  if (!wrapper) {
    alert("Không tìm thấy vùng in lịch.");
    return;
  }
  wrapper.classList.add("print-clone");
  document.body.appendChild(wrapper);
  document.body.classList.add("printing-clone");

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    wrapper.remove();
    document.body.classList.remove("printing-clone");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  try {
    window.print();
  } catch (err) {
    cleanup();
    alert("❌ Không mở được hộp thoại in: " + (err && err.message ? err.message : err));
  }
}

function importFile(event, targetId) {
  const file = event.target.files[0];
  if (!file) return;

  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') {
    const reader = new FileReader();
    reader.onload = function(e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      const names = [];
      json.forEach(row => {
        row.forEach(cell => {
          if (cell && typeof cell === 'string') {
            const clean = cell.trim();
            if (clean && !names.includes(clean)) names.push(clean);
          }
        });
      });
      appendNamesToTextarea(targetId, names);
    };
    reader.readAsArrayBuffer(file);
  } else if (ext === 'docx' || ext === 'doc') {
    const reader = new FileReader();
    reader.onload = function(e) {
      mammoth.extractRawText({ arrayBuffer: e.target.result })
        .then(function(result) {
          const lines = result.value.split(/[\r\n,;]+/);
          const names = lines.map(x => x.trim()).filter(x => x.length > 0);
          appendNamesToTextarea(targetId, names);
        });
    };
    reader.readAsArrayBuffer(file);
  }
}

function appendNamesToTextarea(id, names) {
  const ta = document.getElementById(id);
  const current = parseNames(ta.value);
  const merged = Array.from(new Set([...current, ...names]));
  ta.value = merged.join("\n");
  ta.dispatchEvent(new Event('input'));
  alert(`Đã nhập thành công ${names.length} tên vào danh sách!`);
}
