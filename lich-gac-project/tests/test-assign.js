const fs = require("fs");
const vm = require("vm");
const path = require("path");
const ROOT = path.join(__dirname, "..") + path.sep;
const configSrc = fs.readFileSync(ROOT + "js/config.js", "utf8");
const storageSrc = fs.readFileSync(ROOT + "js/storage.js", "utf8");

function extractInline(file, index = 0) {
  const s = fs.readFileSync(ROOT + file, "utf8");
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  const out = [];
  let m;
  while ((m = re.exec(s))) out.push(m[1]);
  return out[index];
}

function makeCtx({ role = null, confirmAnswer = true } = {}) {
  const store = {};
  const els = new Map();
  function el(id) {
    const classes = new Set();
    return {
      id, value: "", textContent: "", innerHTML: "", title: "", style: {}, disabled: false,
      classList: {
        add: c => classes.add(c),
        remove: c => classes.delete(c),
        contains: c => classes.has(c),
        toggle: (c, f) => {
          const v = f === undefined ? !classes.has(c) : f;
          if (v) classes.add(c); else classes.delete(c);
        }
      },
      appendChild() {}, addEventListener() {}, setAttribute() {}, remove() {},
      querySelector() { return null; },
      get classes() { return classes; }
    };
  }
  const alerts = [];
  const nav = [];
  const ctx = {
    console,
    JSON, Math, Date, Object, Array, String, Number, Set, Map, RegExp, Error,
    parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    location: { replace: u => nav.push(u), href: "" },
    alert: msg => alerts.push(String(msg)),
    confirm: () => confirmAnswer,
    window: {},
    document: {
      getElementById: id => { if (!els.has(id)) els.set(id, el(id)); return els.get(id); },
      createElement: () => el("_tmp"),
      body: { appendChild() {} },
      activeElement: null
    },
    FileReader: function () { throw new Error("FileReader should not be used"); },
    setTimeout, clearTimeout,
    __alerts: alerts, __nav: nav, __els: els
  };
  vm.createContext(ctx);
  return ctx;
}

function loadBase(ctx, { page = null, role = "commander" } = {}) {
  vm.runInContext(configSrc + "\n" + storageSrc + "\nglobalThis.__S = () => S;", ctx);
  vm.runInContext("loadStorage();", ctx);
  if (role) vm.runInContext(`setCurrentRole(${JSON.stringify(role)});`, ctx);
  if (page) {
    vm.runInContext(extractInline(page), ctx);
    vm.runInContext("renderAccountsTable = function(){};", ctx);
    vm.runInContext("updateTopBarShared = function(){};", ctx);
  }
}

const S_TEAMS = [
  { id: 1, name: "Tổ 1", officers: ["SQ A1", "SQ A2"], soldiers: ["CS A1", "CS A2", "CS A3", "CS A4", "CS A5"] },
  { id: 2, name: "Tổ 2", officers: ["SQ B1", "SQ B2"], soldiers: ["CS B1", "CS B2", "CS B3", "CS B4"] },
  { id: 3, name: "Tổ 3", officers: ["SQ C1", "SQ C2"], soldiers: ["CS C1", "CS C2", "CS C3", "CS C4"] },
  { id: 4, name: "Tổ 4", officers: ["SQ D1", "SQ D2"], soldiers: ["CS D1", "CS D2", "CS D3", "CS D4"] }
];

function buildDay() {
  const cells = Array(60).fill("");
  for (let ca = 0; ca < 4; ca++) {
    const t = S_TEAMS[ca];
    for (let s = 0; s < 3; s++) {
      cells[(ca * 3 + s) * 5 + 0] = t.officers[0];
      for (let c = 1; c <= 4; c++) cells[(ca * 3 + s) * 5 + c] = t.soldiers[c - 1];
    }
  }
  return {
    cells, teamInCa: [1, 2, 3, 4], absent: {}, streaks: {}, manualCredits: {},
    borrowed: [], borrowMarks: {}
  };
}

function setupAssignmentCtx(date = "2026-11-12") {
  const ctx = makeCtx();
  loadBase(ctx, { page: "quan-ly-tai-khoan.html", role: "commander" });
  const S = ctx.__S();
  S.teams = JSON.parse(JSON.stringify(S_TEAMS));
  S.days = {};
  S.days[date] = buildDay();
  S.personnelAccounts = [
    { id: 1, fullName: "CS A1", code: "CS01", roleType: "soldier", teamId: 1 },
    { id: 2, fullName: "CS A5", code: "CS02", roleType: "soldier", teamId: 1 },
    { id: 3, fullName: "SQ A1", code: "SQ01", roleType: "officer", teamId: 1 },
    { id: 4, fullName: "CS B1", code: "CS03", roleType: "soldier", teamId: 2 },
    { id: 5, fullName: "CS C1", code: "CS04", roleType: "soldier", teamId: 3 }
  ];
  return ctx;
}

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + (extra ? "\n      " + extra : "")); }
}

// ---------- C1 ----------
{
  const ctx = makeCtx();
  loadBase(ctx, { role: null });
  const role = vm.runInContext("getCurrentRole()", ctx);
  check("C1: chưa đăng nhập -> role null", role === null, "got " + JSON.stringify(role));
  vm.runInContext("requireRole()", ctx);
  check("C1: requireRole chuyển về index.html", ctx.__nav.includes("index.html"), JSON.stringify(ctx.__nav));
}

// ---------- C6 ----------
{
  const ctx = makeCtx({ role: null });
  loadBase(ctx, { role: null });
  const before = JSON.stringify(ctx.__S().days);
  vm.runInContext('restoreJSONData({ target: { files: [{ name: "x.json" }], value: "x" } })', ctx);
  check("C6: không phải Chỉ huy -> báo lỗi quyền", /Chỉ huy/.test(ctx.__alerts.join(" ")), ctx.__alerts.join(" | "));
  check("C6: không đổi dữ liệu", JSON.stringify(ctx.__S().days) === before);
}

// ---------- C4 ----------
{
  const ctx = makeCtx();
  loadBase(ctx, { role: "commander" });
  const S = ctx.__S();
  const d = "2026-11-12";
  S.days = { [d]: { cells: Array(60).fill(""), absent: {}, streaks: {}, manualCredits: { "CS A1": 1 }, teamInCa: [1, 2, 3, 4] } };
  const r = vm.runInContext(`getPersonDayWorkDetails("${d}", "CS A1")`, ctx);
  check("C4: manualCredits cũ không còn tác dụng khi không có ca", r.credit === 0, JSON.stringify(r));
}

// ---------- Assignment: valid cross-team ----------
{
  const ctx = setupAssignmentCtx();
  const d = "2026-11-12";
  vm.runInContext('openAssignmentModal("CS A1", "2026-11-12"); selectAssignmentPosition(2, 1);', ctx);
  const res = vm.runInContext("validateAssignmentSelection()", ctx);
  check("Giao nhiệm vụ: chọn Tổ 3/Ca 3/Vọng x9 hợp lệ", res.ok === true, JSON.stringify(res.errors));
  vm.runInContext("confirmAssignment()", ctx);
  const day = ctx.__S().days[d];
  const idxs = [0, 1, 2].map(s => (2 * 3 + s) * 5 + 1);
  check("Giao nhiệm vụ: đã thay đủ 3 khung", idxs.every(k => day.cells[k] === "CS A1"), JSON.stringify(idxs.map(k => day.cells[k])));
  const b = (day.borrowed || []).find(x => x.person === "CS A1" && x.ca === 3 && x.col === 1);
  check("Giao nhiệm vụ: ghi nhận mượn Tổ 1 -> Tổ 3", !!b && b.fromTeam === 1 && b.toTeam === 3 && b.assignment === true, JSON.stringify(day.borrowed));
  check("Giao nhiệm vụ: borrowMarks đủ 3 ô", idxs.every(k => day.borrowMarks[k] && day.borrowMarks[k].fromTeam === 1), JSON.stringify(day.borrowMarks));
  check("Giao nhiệm vụ: xóa manualCredits (C4)", Object.keys(day.manualCredits).length === 0, JSON.stringify(day.manualCredits));
  check("Giao nhiệm vụ: teamInCa vẫn đúng", JSON.stringify(day.teamInCa) === JSON.stringify([1, 2, 3, 4]), JSON.stringify(day.teamInCa));
  check("Giao nhiệm vụ: báo kết quả", /Đã giao nhiệm vụ/.test(ctx.__alerts.join(" ")), ctx.__alerts.join(" | "));
}

// ---------- Assignment: same team (no borrow) ----------
{
  const ctx = setupAssignmentCtx();
  const d = "2026-11-12";
  vm.runInContext('openAssignmentModal("CS A5", "2026-11-12"); selectAssignmentPosition(0, 1);', ctx);
  const res = vm.runInContext("validateAssignmentSelection()", ctx);
  check("Giao nhiệm vụ: cùng Tổ hợp lệ", res.ok === true, JSON.stringify(res.errors));
  vm.runInContext("confirmAssignment()", ctx);
  const day = ctx.__S().days[d];
  check("Giao nhiệm vụ: cùng Tổ không tạo entry mượn", !(day.borrowed || []).some(x => x.person === "CS A5"), JSON.stringify(day.borrowed));
  check("Giao nhiệm vụ: cùng Tổ không tạo borrowMark", !Object.keys(day.borrowMarks).some(k => day.cells[k] === "CS A5" && day.borrowMarks[k]), JSON.stringify(day.borrowMarks));
}

// ---------- Assignment: same-ca conflict ----------
{
  const ctx = setupAssignmentCtx();
  vm.runInContext('openAssignmentModal("CS A1", "2026-11-12"); selectAssignmentPosition(0, 2);', ctx);
  const res = vm.runInContext("validateAssignmentSelection()", ctx);
  check("Giao nhiệm vụ: chặn trùng ca", res.ok === false && res.errors.some(e => /Ca 1/.test(e)), JSON.stringify(res.errors));
}

// ---------- Assignment: adjacent slot conflict ----------
{
  const ctx = setupAssignmentCtx();
  const d = "2026-11-12";
  const day = ctx.__S().days[d];
  // CS B1 đang trực Ca 1 · 14:00–16:00 (chrono 4) tại cột x12
  day.cells[(0 * 3 + 1) * 5 + 4] = "CS B1";
  vm.runInContext('openAssignmentModal("CS B1", "2026-11-12"); toggleAssignmentSlot(' + ((1 * 3 + 1) * 5 + 4) + ');', ctx);
  const res = vm.runInContext("validateAssignmentSelection()", ctx);
  check("Giao nhiệm vụ: chặn 2 khung liền nhau", res.ok === false && res.errors.some(e => /liền nhau/.test(e)), JSON.stringify(res.errors));
}

// ---------- Assignment: adjacent across ca boundary ----------
{
  const ctx = setupAssignmentCtx();
  vm.runInContext('openAssignmentModal("CS A1", "2026-11-12"); toggleAssignmentSlot(' + ((1 * 3 + 2) * 5 + 1) + '); toggleAssignmentSlot(' + ((2 * 3 + 2) * 5 + 1) + ');', ctx);
  const res = vm.runInContext("validateAssignmentSelection()", ctx);
  check("Giao nhiệm vụ: chặn liền nhau qua biên ca", res.ok === false && res.errors.some(e => /liền nhau/.test(e)), JSON.stringify(res.errors));
}

// ---------- Assignment: previous-day boundary ----------
{
  const ctx = setupAssignmentCtx();
  const S = ctx.__S();
  S.days["2026-11-11"] = buildDay();
  S.days["2026-11-11"].cells[11 * 5 + 2] = "CS A5";
  vm.runInContext('openAssignmentModal("CS A5", "2026-11-12"); toggleAssignmentSlot(' + (0 * 5 + 1) + ');', ctx);
  const res = vm.runInContext("validateAssignmentSelection()", ctx);
  check("Giao nhiệm vụ: chặn liền khung cuối ngày trước", res.ok === false && res.errors.some(e => /hôm trước/.test(e)), JSON.stringify(res.errors));
}

// ---------- Assignment: night-only ----------
{
  const ctx = setupAssignmentCtx();
  const S = ctx.__S();
  S.nightOnly = "CS C1";
  vm.runInContext('openAssignmentModal("CS C1", "2026-11-12"); selectAssignmentPosition(0, 1);', ctx);
  const bad = vm.runInContext("validateAssignmentSelection()", ctx);
  check("Giao nhiệm vụ: người chỉ ca đêm bị chặn khung 06–08", bad.ok === false && bad.errors.some(e => /ca đêm/.test(e)), JSON.stringify(bad.errors));
  vm.runInContext('selectAssignmentPosition(0, 1); toggleAssignmentSlot(' + ((0 * 3 + 2) * 5 + 2) + ');', ctx);
  const good = vm.runInContext("validateAssignmentSelection()", ctx);
  check("Giao nhiệm vụ: người chỉ ca đêm nhận khung 22–24", good.ok === true, JSON.stringify(good.errors));
}

// ---------- Assignment: wrong position by rank ----------
{
  const ctx = setupAssignmentCtx();
  vm.runInContext('openAssignmentModal("SQ A1", "2026-11-12"); toggleAssignmentSlot(' + (0 * 5 + 1) + ');', ctx);
  const res = vm.runInContext("validateAssignmentSelection()", ctx);
  check("Giao nhiệm vụ: Sĩ quan không nhận vị trí Vọng", res.ok === false && res.errors.some(e => /Sĩ quan/.test(e)), JSON.stringify(res.errors));
}

// ---------- Assignment: absent person ----------
{
  const ctx = setupAssignmentCtx();
  const S = ctx.__S();
  S.days["2026-11-12"].absent = { phep: "CS A5" };
  vm.runInContext('openAssignmentModal("CS A5", "2026-11-12"); selectAssignmentPosition(0, 1);', ctx);
  const res = vm.runInContext("validateAssignmentSelection()", ctx);
  check("Giao nhiệm vụ: chặn người đang vắng", res.ok === false && res.errors.some(e => /vắng/.test(e)), JSON.stringify(res.errors));
}

// ---------- Assignment: two positions in same ca ----------
{
  const ctx = setupAssignmentCtx();
  vm.runInContext('openAssignmentModal("CS A5", "2026-11-12"); toggleAssignmentSlot(' + (0 * 5 + 1) + '); toggleAssignmentSlot(' + (0 * 5 + 2) + ');', ctx);
  const res = vm.runInContext("validateAssignmentSelection()", ctx);
  check("Giao nhiệm vụ: chặn 2 vị trí khác nhau trong 1 ca", res.ok === false && res.errors.some(e => /nhiều vị trí/.test(e)), JSON.stringify(res.errors));
}

// ---------- C3: chấm công không ghi đè người khác ----------
{
  const ctx = makeCtx();
  loadBase(ctx, { page: "cham-cong.html", role: "commander" });
  vm.runInContext("renderStandaloneMonthly = function(){};", ctx);
  const S = ctx.__S();
  S.officers = "SQ A1, SQ A2";
  S.soldiers = ["CS A1", "CS A2", "CS A3"].join(", ");
  const d = "2026-11-12";
  const day = buildDay();
  // Dọn cột chiến sĩ để kiểm soát
  for (let k = 0; k < 60; k++) { if (k % 5 !== 0) day.cells[k] = ""; }
  day.cells[(0 * 3) * 5 + 1] = "CS A1"; // Ca 1, x9
  day.cells[(0 * 3) * 5 + 2] = "CS A2"; // Ca 1, x10
  S.days = { [d]: day };
  vm.runInContext(`updateMonthlyCellSmart("${d}", "CS A2", "X")`, ctx);
  const after = ctx.__S().days[d];
  const a1Still = after.cells.some(c => c === "CS A1");
  const a2Placed = after.cells.filter(c => c === "CS A2").length;
  check("C3: không ghi đè người khác", a1Still === true, JSON.stringify(after.cells));
  check("C3: người được nhập vẫn được xếp đủ 3 khung", a2Placed === 3, "count=" + a2Placed);

  // Không còn vị trí trống
  const day2 = buildDay();
  for (let ca = 0; ca < 4; ca++) {
    for (let c = 1; c <= 4; c++) {
      for (let s = 0; s < 3; s++) day2.cells[(ca * 3 + s) * 5 + c] = "CS FILL " + ca + "-" + c;
    }
  }
  ctx.__S().days[d] = day2;
  ctx.__alerts.length = 0;
  vm.runInContext(`updateMonthlyCellSmart("${d}", "CS A3", "X")`, ctx);
  const after2 = ctx.__S().days[d];
  check("C3: hết chỗ -> cảnh báo, không ghi đè", /Không còn vị trí trống/.test(ctx.__alerts.join(" ")), ctx.__alerts.join(" | "));
  check("C3: hết chỗ -> không tạo manualCredits", !after2.manualCredits["CS A3"], JSON.stringify(after2.manualCredits));
}

// ---------- findShiftConflict direct ----------
{
  const ctx = setupAssignmentCtx();
  const d = "2026-11-12";
  const conflictSameCa = vm.runInContext(`findShiftConflict("${d}", "CS A1", [${(0 * 5 + 2)}], {ca:0,col:2})`, ctx);
  check("findShiftConflict: phát hiện trùng ca", !!conflictSameCa && conflictSameCa.type === "same-ca", JSON.stringify(conflictSameCa));
  const noConflict = vm.runInContext(`findShiftConflict("${d}", "CS A1", [${(2 * 3 + 0) * 5 + 1}, ${(2 * 3 + 1) * 5 + 1}, ${(2 * 3 + 2) * 5 + 1}], {ca:2,col:1})`, ctx);
  check("findShiftConflict: ca khác không xung đột", noConflict === null, JSON.stringify(noConflict));
}

console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);
