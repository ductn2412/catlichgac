// Kiểm thử quy tắc "số mũ công liên tiếp" hiển thị trên lịch gác (tính theo TỪNG NGÀY):
//  - Ngày đủ 3 khung = 1; hôm sau đi làm tiếp thì cộng tiếp (1 → 2 → 3...).
//  - Ngày chỉ 1 khung đêm = 0,5; hôm sau đi làm tiếp thì cộng tiếp (0,5 → 1 → 1,5...).
//  - Ngày 2 khung gồm 1 ngày + 1 đêm = 1.
//  - Ngày 2 khung ngày:
//      · Chiến sĩ nghĩa vụ: hiển thị 0,25 trên mỗi dòng và ngắt chuỗi (hôm sau về 1).
//      · Sĩ quan (Đốc gác): cộng 0,5 vào mốc hôm trước (1 → 1,5 → 2 → 3).
//  - Ngày chỉ 1 khung ngày: không hiển thị mũ.
//  - Nghỉ / vắng: không hiển thị mũ, hôm sau quay lại từ đầu.
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const ROOT = path.join(__dirname, "..") + path.sep;
const configSrc = fs.readFileSync(ROOT + "js/config.js", "utf8");
const storageSrc = fs.readFileSync(ROOT + "js/storage.js", "utf8");
const appSrc = fs.readFileSync(ROOT + "js/app.js", "utf8");

function makeCtx() {
  const store = {};
  const els = new Map();
  function el(id) {
    const classes = new Set();
    return {
      id, value: "", textContent: "", innerHTML: "", title: "", style: {}, disabled: false,
      dataset: {},
      classList: {
        add: c => classes.add(c), remove: c => classes.delete(c),
        contains: c => classes.has(c),
        toggle: (c, f) => { const v = f === undefined ? !classes.has(c) : f; if (v) classes.add(c); else classes.delete(c); }
      },
      appendChild() {}, addEventListener() {}, setAttribute() {}, removeAttribute() {}, remove() {},
      querySelector() { return null; }, querySelectorAll() { return []; },
      get classes() { return classes; }
    };
  }
  const ctx = {
    console, JSON, Math, Date, Object, Array, String, Number, Set, Map, RegExp, Error, Boolean,
    parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent, unescape, escape,
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    location: { replace() {}, href: "" },
    alert: () => {}, confirm: () => true,
    window: {},
    document: {
      readyState: "loading", addEventListener() {},
      getElementById: id => { if (!els.has(id)) els.set(id, el(id)); return els.get(id); },
      createElement: () => el("_tmp"), body: { appendChild() {} }, activeElement: null,
      querySelectorAll() { return []; }
    },
    crypto: { getRandomValues: arr => { for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256); return arr; } },
    setTimeout, clearTimeout
  };
  vm.createContext(ctx);
  return ctx;
}

const ctx = makeCtx();
vm.runInContext(configSrc + "\n" + storageSrc + "\nglobalThis.getS = () => S;", ctx);
vm.runInContext("loadStorage(); setCurrentRole('commander');", ctx);
vm.runInContext(appSrc, ctx);

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + (extra ? "  [" + extra + "]" : "")); }
}
const eq = (a, b) => Math.abs(Number(a) - Number(b)) < 0.0001;

// 60 ô = 12 dòng (ca 0..3 × slot 0..2) × 5 cột; slot 2 là ca đêm (22h-06h).
const blank = () => Array(60).fill("");
const mk = () => ({ cells: blank(), absent: {}, streaks: {}, manualCredits: {}, teamInCa: [1, 2, 3, 4] });
const cellIdx = (ca, slot, col) => (ca * 3 + slot) * 5 + col;
const put = (day, ca, slot, col, name) => { day.cells[cellIdx(ca, slot, col)] = name; };
const fillFullDay = (day, ca, col, name) => {
  put(day, ca, 0, col, name);
  put(day, ca, 1, col, name);
  put(day, ca, 2, col, name);
};

const DAYS = ["2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05", "2026-04-06"];
const days = {};
DAYS.forEach(d => { days[d] = mk(); });

// G (chiến sĩ nghĩa vụ) – chuỗi 4 ngày: đủ 3 ca → 1 ca đêm → 2 ca ngày → đủ 3 ca.
fillFullDay(days["2026-04-01"], 0, 1, "G Chuỗi");
put(days["2026-04-02"], 0, 2, 1, "G Chuỗi");
put(days["2026-04-03"], 0, 0, 1, "G Chuỗi");
put(days["2026-04-03"], 0, 1, 1, "G Chuỗi");
fillFullDay(days["2026-04-04"], 0, 1, "G Chuỗi");

// H (sĩ quan Đốc gác) – cùng chuỗi 4 ngày.
fillFullDay(days["2026-04-01"], 1, 0, "H Sĩ quan");
put(days["2026-04-02"], 1, 2, 0, "H Sĩ quan");
put(days["2026-04-03"], 1, 0, 0, "H Sĩ quan");
put(days["2026-04-03"], 1, 1, 0, "H Sĩ quan");
fillFullDay(days["2026-04-04"], 1, 0, "H Sĩ quan");

// A – chỉ ca đêm 3 ngày liền.
["2026-04-01", "2026-04-02", "2026-04-03"].forEach(d => {
  put(days[d], 2, 2, 2, "A Đêm");
});

// M – ca đêm, ngày 2 nhập tay mũ = 2, ngày 4 nghỉ, ngày 5 làm lại.
["2026-04-01", "2026-04-02", "2026-04-03"].forEach(d => {
  put(days[d], 3, 2, 3, "M Nhập tay");
});
days["2026-04-02"].streaks[cellIdx(3, 2, 3)] = 2;
days["2026-04-02"].streakManual = true;
put(days["2026-04-05"], 3, 2, 3, "M Nhập tay");

// D – chỉ 1 khung ca ngày duy nhất.
put(days["2026-04-01"], 0, 0, 4, "D Một ca");

// E – vắng mặt ngày 02/04.
days["2026-04-02"].absent = { phep: "E Vắng" };
put(days["2026-04-02"], 2, 0, 4, "E Vắng");

// F – đủ 3 ca 3 ngày liền (1 → 2 → 3).
["2026-04-01", "2026-04-02", "2026-04-03"].forEach(d => {
  fillFullDay(days[d], 1, 4, "F Liền");
});

// L – "mũ" cũ còn sót trong dữ liệu (không có cờ streakManual) phải bị bỏ qua.
fillFullDay(days["2026-04-06"], 2, 4, "L Legacy");
days["2026-04-06"].streaks[cellIdx(2, 0, 4)] = 9;

vm.runInContext("S.days = " + JSON.stringify(days) + "; S.manualCredits = {};", ctx);
vm.runInContext("S.teams = []; S.officers = 'H Sĩ quan'; S.soldiers = 'G Chuỗi\\nA Đêm\\nM Nhập tay\\nD Một ca\\nE Vắng\\nF Liền';", ctx);

const streak = (d, n) => vm.runInContext(`getPersonStreak(${JSON.stringify(d)}, ${JSON.stringify(n)})`, ctx);

// 1) Chiến sĩ nghĩa vụ: đủ 3 ca → 1 ca đêm → 2 ca ngày → đủ 3 ca = 1 → 1,5 → 0,25 → 1.
check("CS: ngày đủ 3 ca = 1", eq(streak("2026-04-01", "G Chuỗi"), 1), String(streak("2026-04-01", "G Chuỗi")));
check("CS: hôm sau ca đêm = 1,5", eq(streak("2026-04-02", "G Chuỗi"), 1.5), String(streak("2026-04-02", "G Chuỗi")));
check("CS: 2 ca ngày = 0,25", eq(streak("2026-04-03", "G Chuỗi"), 0.25), String(streak("2026-04-03", "G Chuỗi")));
check("CS: 2 ca ngày ngắt chuỗi, hôm sau về 1", eq(streak("2026-04-04", "G Chuỗi"), 1), String(streak("2026-04-04", "G Chuỗi")));

// 2) Sĩ quan: cùng chuỗi = 1 → 1,5 → 2 → 3.
check("SQ: ngày đủ 3 ca = 1", eq(streak("2026-04-01", "H Sĩ quan"), 1), String(streak("2026-04-01", "H Sĩ quan")));
check("SQ: hôm sau ca đêm = 1,5", eq(streak("2026-04-02", "H Sĩ quan"), 1.5), String(streak("2026-04-02", "H Sĩ quan")));
check("SQ: 2 ca ngày cộng 0,5 = 2", eq(streak("2026-04-03", "H Sĩ quan"), 2), String(streak("2026-04-03", "H Sĩ quan")));
check("SQ: hôm sau đủ 3 ca = 3", eq(streak("2026-04-04", "H Sĩ quan"), 3), String(streak("2026-04-04", "H Sĩ quan")));

// 3) Ca đêm liên tiếp: 0,5 → 1 → 1,5.
check("Ca đêm ngày đầu = 0,5", eq(streak("2026-04-01", "A Đêm"), 0.5), String(streak("2026-04-01", "A Đêm")));
check("Ca đêm ngày 2 = 1", eq(streak("2026-04-02", "A Đêm"), 1), String(streak("2026-04-02", "A Đêm")));
check("Ca đêm ngày 3 = 1,5", eq(streak("2026-04-03", "A Đêm"), 1.5), String(streak("2026-04-03", "A Đêm")));
check("Nghỉ không có số mũ", streak("2026-04-04", "A Đêm") === "", JSON.stringify(streak("2026-04-04", "A Đêm")));

// 4) Nhập tay được ưu tiên và làm mốc cộng tiếp.
check("Nhập tay số mũ = 2 được ưu tiên", eq(streak("2026-04-02", "M Nhập tay"), 2), String(streak("2026-04-02", "M Nhập tay")));
check("Nối tiếp sau mốc nhập tay = 2,5", eq(streak("2026-04-03", "M Nhập tay"), 2.5), String(streak("2026-04-03", "M Nhập tay")));
check("Nghỉ 1 ngày rồi làm lại ca đêm về 0,5", eq(streak("2026-04-05", "M Nhập tay"), 0.5), String(streak("2026-04-05", "M Nhập tay")));

// 5) Đủ 3 ca liên tiếp: 1 → 2 → 3.
check("Đủ 3 ca ngày 1 = 1", eq(streak("2026-04-01", "F Liền"), 1), String(streak("2026-04-01", "F Liền")));
check("Đủ 3 ca ngày 2 = 2", eq(streak("2026-04-02", "F Liền"), 2), String(streak("2026-04-02", "F Liền")));
check("Đủ 3 ca ngày 3 = 3", eq(streak("2026-04-03", "F Liền"), 3), String(streak("2026-04-03", "F Liền")));

// 6) Ngày chỉ 1 khung ca ngày: không hiển thị mũ.
check("Chỉ 1 khung ca ngày: không hiển thị mũ", streak("2026-04-01", "D Một ca") === "", JSON.stringify(streak("2026-04-01", "D Một ca")));
check("Người vắng mặt không có số mũ", streak("2026-04-02", "E Vắng") === "", JSON.stringify(streak("2026-04-02", "E Vắng")));
check("Bỏ qua mũ cũ không có cờ nhập tay", eq(streak("2026-04-06", "L Legacy"), 1), String(streak("2026-04-06", "L Legacy")));

// 7) Định dạng hiển thị dấu phẩy.
check("formatStreakText dùng dấu phẩy", vm.runInContext("formatStreakText(1.5)", ctx) === "1,5", vm.runInContext("formatStreakText(1.5)", ctx));
check("formatStreakText 0.25", vm.runInContext("formatStreakText(0.25)", ctx) === "0,25", vm.runInContext("formatStreakText(0.25)", ctx));

// 8) Bảng chấm công không bị thay đổi bởi quy tắc số mũ.
const credit = (d, n) => vm.runInContext(`getPersonDayWorkDetails(${JSON.stringify(d)}, ${JSON.stringify(n)}).credit`, ctx);
check("Chấm công: người 2 ca ngày = 0,5 công", eq(credit("2026-04-03", "G Chuỗi"), 0.5), String(credit("2026-04-03", "G Chuỗi")));
check("Chấm công: người 1 ca đêm = 0,5 công", eq(credit("2026-04-01", "A Đêm"), 0.5), String(credit("2026-04-01", "A Đêm")));
check("Chấm công: người đủ 3 khung = 1 công", eq(credit("2026-04-01", "F Liền"), 1.0), String(credit("2026-04-01", "F Liền")));
check("Chấm công: người 2 khung ngày = 0,5 công", eq(credit("2026-04-03", "H Sĩ quan"), 0.5), String(credit("2026-04-03", "H Sĩ quan")));

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
