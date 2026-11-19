// Kiểm thử quy tắc "số mũ công liên tiếp" hiển thị trên lịch gác:
//  - Chỉ ca ngày: 0,25 mỗi ca, không cộng dồn sang hôm sau.
//  - Ngày có cả ca ngày lẫn ca đêm: luôn là 1.
//  - Ngày chỉ ca đêm: nối tiếp +0,5 (1 → 1,5 → 2 → 2,5...), nghỉ thì về 1.
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

function makeDay(cells) {
  return { cells, absent: {}, streaks: {}, manualCredits: {}, teamInCa: [1, 2, 3, 4] };
}
// 60 ô = 12 dòng (ca 0..3 × slot 0..2) × 5 cột; slot 2 là ca đêm (22h-06h).
function put(day, ca, slot, col, name) {
  day.cells[(ca * 3 + slot) * 5 + col] = name;
}

// Dựng dữ liệu mẫu trong Node rồi nạp vào S.days (tránh lỗi ngày dùng chung)
const blank = () => Array(60).fill("");
const mk = (cells) => ({ cells, absent: {}, streaks: {}, manualCredits: {}, teamInCa: [1, 2, 3, 4] });
const cellIdx = (ca, slot, col) => (ca * 3 + slot) * 5 + col;
const days = {};
["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-07"].forEach(d => {
  days[d] = mk(blank());
});
days["2026-03-06"] = mk(blank());

// A: chỉ ca đêm (slot 2) các ngày 01..05, nghỉ 06, làm lại 07.
["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-07"].forEach(d => {
  days[d].cells[cellIdx(0, 2, 1)] = "A Đêm";
});

// B: chỉ ca ngày, 2 khung ngày/ngày, 3 ngày liền.
["2026-03-01", "2026-03-02", "2026-03-03"].forEach(d => {
  days[d].cells[cellIdx(1, 0, 2)] = "B Ngày";
  days[d].cells[cellIdx(1, 1, 2)] = "B Ngày";
});

// C: cả ngày lẫn đêm (1 ngày + 1 đêm) trong 2 ngày liền → luôn 1.
["2026-03-01", "2026-03-02"].forEach(d => {
  days[d].cells[cellIdx(2, 0, 3)] = "C Hỗn hợp";
  days[d].cells[cellIdx(2, 2, 3)] = "C Hỗn hợp";
});

// D: chỉ 1 ca ngày duy nhất.
days["2026-03-01"].cells[cellIdx(3, 0, 4)] = "D Một ca";

// E: vắng mặt ngày 02/03.
days["2026-03-02"].absent = { phep: "E Vắng" };

// F: nhập tay số mũ = 2 cho A vào ngày 03/03.
days["2026-03-03"].streaks[cellIdx(0, 2, 1)] = 2;

vm.runInContext("S.days = " + JSON.stringify(days) + "; S.manualCredits = {};", ctx);

const S = vm.runInContext("S", ctx);
const streak = (d, n) => vm.runInContext(`getPersonStreak(${JSON.stringify(d)}, ${JSON.stringify(n)})`, ctx);

check("Ca đêm ngày đầu = 1", eq(streak("2026-03-01", "A Đêm"), 1), String(streak("2026-03-01", "A Đêm")));
check("Ca đêm ngày 2 = 1,5 (nhập tay 2 ở ngày 3 nên kiểm tra trước đó)", eq(streak("2026-03-02", "A Đêm"), 1.5), String(streak("2026-03-02", "A Đêm")));
check("Nhập tay số mũ = 2 được ưu tiên", eq(streak("2026-03-03", "A Đêm"), 2), String(streak("2026-03-03", "A Đêm")));
check("Nối tiếp sau mốc nhập tay = 2,5", eq(streak("2026-03-04", "A Đêm"), 2.5), String(streak("2026-03-04", "A Đêm")));
check("Ngày 5 tiếp tục = 3", eq(streak("2026-03-05", "A Đêm"), 3), String(streak("2026-03-05", "A Đêm")));
check("Ngày nghỉ không có số mũ", streak("2026-03-06", "A Đêm") === "", JSON.stringify(streak("2026-03-06", "A Đêm")));
check("Nghỉ 1 ngày → làm lại về 1", eq(streak("2026-03-07", "A Đêm"), 1), String(streak("2026-03-07", "A Đêm")));

check("Chỉ ca ngày 2 ca = 0,5", eq(streak("2026-03-01", "B Ngày"), 0.5), String(streak("2026-03-01", "B Ngày")));
check("Ca ngày không cộng dồn ngày 2 vẫn 0,5", eq(streak("2026-03-02", "B Ngày"), 0.5), String(streak("2026-03-02", "B Ngày")));
check("Ca ngày không cộng dồn ngày 3 vẫn 0,5", eq(streak("2026-03-03", "B Ngày"), 0.5), String(streak("2026-03-03", "B Ngày")));
check("Chỉ 1 ca ngày = 0,25", eq(streak("2026-03-01", "D Một ca"), 0.25), String(streak("2026-03-01", "D Một ca")));

check("Ngày có cả ngày + đêm = 1", eq(streak("2026-03-01", "C Hỗn hợp"), 1), String(streak("2026-03-01", "C Hỗn hợp")));
check("Ngày hỗn hợp thứ 2 vẫn = 1", eq(streak("2026-03-02", "C Hỗn hợp"), 1), String(streak("2026-03-02", "C Hỗn hợp")));

check("Người vắng mặt không có số mũ", streak("2026-03-02", "E Vắng") === "", JSON.stringify(streak("2026-03-02", "E Vắng")));

// Hàm tính công trong bảng chấm công không bị thay đổi.
const credit = (d, n) => vm.runInContext(`getPersonDayWorkDetails(${JSON.stringify(d)}, ${JSON.stringify(n)}).credit`, ctx);
check("Chấm công: người 2 ca ngày = 0,5 công", eq(credit("2026-03-01", "B Ngày"), 0.5), String(credit("2026-03-01", "B Ngày")));
check("Chấm công: người 1 ca đêm = 0,5 công", eq(credit("2026-03-01", "A Đêm"), 0.5), String(credit("2026-03-01", "A Đêm")));
check("Chấm công: người hỗn hợp 2 khung = 0,5 công", eq(credit("2026-03-01", "C Hỗn hợp"), 0.5), String(credit("2026-03-01", "C Hỗn hợp")));

// Định dạng hiển thị dấu phẩy.
check("formatStreakText dùng dấu phẩy", vm.runInContext("formatStreakText(1.5)", ctx) === "1,5", vm.runInContext("formatStreakText(1.5)", ctx));
check("formatStreakText 0.25", vm.runInContext("formatStreakText(0.25)", ctx) === "0,25", vm.runInContext("formatStreakText(0.25)", ctx));

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
