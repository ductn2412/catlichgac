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

function exportToPDF(dateStr) {
  if (!window.html2pdf) {
    alert("Thư viện PDF đang tải, vui lòng thử lại.");
    return;
  }
  const element = document.getElementById("print-area");
  if (!element) {
    alert("Không tìm thấy vùng in lịch.");
    return;
  }

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
  document.body.appendChild(wrapper);

  const opt = {
    margin: [10, 10, 10, 10],
    filename: `LichGac_${dateStr || fmtDate(new Date())}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      scrollY: 0,
      windowWidth: wrapper.scrollWidth
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
