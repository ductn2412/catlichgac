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
      classList: {
        add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c),
        toggle: (c, f) => { const v = f === undefined ? !classes.has(c) : f; if (v) classes.add(c); else classes.delete(c); }
      },
      appendChild() {}, addEventListener() {}, setAttribute() {}, remove() {},
      querySelector() { return null; },
      get classes() { return classes; }
    };
  }
  const alerts = [];
  const ctx = {
    console, JSON, Math, Date, Object, Array, String, Number, Set, Map, RegExp, Error, Boolean,
    parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent, unescape, escape,
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    location: { replace() {}, href: "" },
    alert: msg => alerts.push(String(msg)),
    confirm: () => true,
    window: {},
    document: {
      readyState: "loading",
      addEventListener() {},
      getElementById: id => { if (!els.has(id)) els.set(id, el(id)); return els.get(id); },
      createElement: () => el("_tmp"),
      body: { appendChild() {} },
      activeElement: null
    },
    crypto: { getRandomValues: arr => { for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256); return arr; } },
    setTimeout, clearTimeout,
    __alerts: alerts, __els: els
  };
  vm.createContext(ctx);
  return ctx;
}

function loadBase(ctx, { role = "commander", withApp = false } = {}) {
  vm.runInContext(configSrc + "\n" + storageSrc + "\nglobalThis.__S = () => S;", ctx);
  vm.runInContext("loadStorage();", ctx);
  if (role) vm.runInContext(`setCurrentRole(${JSON.stringify(role)});`, ctx);
  if (withApp) vm.runInContext(appSrc, ctx);
}

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + (extra ? "\n      " + extra : "")); }
}

// ==================== 1. VẮNG MẶT STICKY ====================
{
  const ctx = makeCtx();
  loadBase(ctx, { withApp: true });
  const S = ctx.__S();
  S.days = {};
  const base = "2026-03-10";
  const next = "2026-03-11";
  const d0 = vm.runInContext(`getDayData("${base}")`, ctx);
  d0.absent = { phep: "Trần Văn Hiệp (CS01)", congtac: "", om: "", om_tai_vien: "", nghibu: "", hoctap: "", khac: "" };
  const tm = vm.runInContext(`nextTeamMap(detectTeamsInCa(getDayData("${base}")))`, ctx);
  vm.runInContext(`buildGeneratedDay("${next}", ${JSON.stringify(tm)}, getDayData("${base}"))`, ctx);
  const nd = vm.runInContext(`getDayData("${next}")`, ctx);
  check("Absence: kế thừa sang ngày mới", nd.absent && nd.absent.phep === "Trần Văn Hiệp (CS01)", JSON.stringify(nd.absent));
  check("Absence: người vắng không bị xếp gác", !nd.cells.some(c => (c || "").includes("CS01")));
  check("Absence: các mục khác vẫn đủ khóa", ["phep", "congtac", "om", "om_tai_vien", "nghibu", "hoctap", "khac"].every(k => typeof nd.absent[k] === "string"));

  // Ngày mới không có dữ liệu vắng nhưng kế thừa từ ngày gần nhất
  const d3 = vm.runInContext(`getDayData("2026-03-13")`, ctx);
  const inherited3 = vm.runInContext(`applyInheritedAbsence("2026-03-13", getDayData("2026-03-13"))`, ctx);
  check("Absence: ngày xa hơn vẫn kế thừa ngày gần nhất", inherited3 === true && d3.absent.phep.includes("CS01"));

  // Ngày đã chỉnh tay (absentTouched) không bị kế thừa đè
  const d2 = vm.runInContext(`getDayData("2026-03-12")`, ctx);
  d2.absentTouched = true;
  d2.absent = { phep: "", congtac: "", om: "", om_tai_vien: "", nghibu: "", hoctap: "", khac: "" };
  const inherited = vm.runInContext(`applyInheritedAbsence("2026-03-12", getDayData("2026-03-12"))`, ctx);
  check("Absence: ngày đã chỉnh tay không bị kế thừa đè", inherited === false && d2.absent.phep === "");
}

// ==================== 1b. ALERT BÁO ĐỎ ====================
{
  const ctx = makeCtx();
  ctx.setTimeout = fn => { fn(); return 0; };
  loadBase(ctx, { withApp: true });
  vm.runInContext('lastRedAlertSignature = "";', ctx);
  vm.runInContext('showRedAlert(["❌ BÁO ĐỎ A: người thứ nhất"]);', ctx);
  vm.runInContext('showRedAlert(["❌ BÁO ĐỎ A: người thứ hai"]);', ctx);
  check("Alert: cùng nhóm lỗi chỉ hiện 1 lần", ctx.__alerts.length === 1, JSON.stringify(ctx.__alerts));
  check("Alert: nội dung có tiêu đề cảnh báo", ctx.__alerts[0].includes("PHÁT HIỆN VẤN ĐỀ"), ctx.__alerts[0]);

  vm.runInContext('showRedAlert(["❌ BÁO ĐỎ B: vấn đề khác"]);', ctx);
  check("Alert: nhóm lỗi mới hiện thêm", ctx.__alerts.length === 2, JSON.stringify(ctx.__alerts));

  vm.runInContext('showRedAlert([]);', ctx);
  vm.runInContext('showRedAlert(["❌ BÁO ĐỎ A: lại phát sinh"]);', ctx);
  check("Alert: xử lý xong thì lỗi cũ báo lại", ctx.__alerts.length === 3, JSON.stringify(ctx.__alerts));
}

// ==================== 2. VALIDATE JSON ====================
{
  const ctx = makeCtx();
  loadBase(ctx);
  const valid = vm.runInContext(`validateBackupData({ days: {} })`, ctx);
  check("Validate: days rỗng hợp lệ (có cảnh báo)", valid.ok === true && valid.warnings.length === 1);

  const noDays = vm.runInContext(`validateBackupData({ teams: [] })`, ctx);
  check("Validate: thiếu days -> lỗi", noDays.ok === false && noDays.errors.some(e => e.includes("days")));

  const badKey = vm.runInContext(`validateBackupData({ days: { "2026-13-01": { cells: [] } } })`, ctx);
  check("Validate: khóa ngày sai -> lỗi", badKey.ok === false);

  const badCells = vm.runInContext(`validateBackupData({ days: { "2026-03-10": { cells: [1,2,3] } } })`, ctx);
  check("Validate: cells sai độ dài -> lỗi", badCells.ok === false && badCells.errors.some(e => e.includes("60")));

  const badTeams = vm.runInContext(`validateBackupData({ days: {}, teams: "x" })`, ctx);
  check("Validate: teams không phải mảng -> lỗi", badTeams.ok === false);

  const badHandover = vm.runInContext(`validateBackupData({ days: {}, handoverNotes: [] })`, ctx);
  check("Validate: handoverNotes là mảng -> lỗi", badHandover.ok === false);

  const notObj = vm.runInContext(`validateBackupData(null)`, ctx);
  check("Validate: null -> lỗi", notObj.ok === false);
}

// ==================== 3. SNAPSHOT ====================
{
  const ctx = makeCtx();
  loadBase(ctx);
  const S = ctx.__S();
  const mkCells = () => new Array(60).fill("");
  S.days = { "2026-03-10": { cells: mkCells(), absent: {} } };
  const r1 = vm.runInContext(`createSnapshot("test 1")`, ctx);
  check("Snapshot: tạo bản đầu tiên", r1.ok === true && !r1.skipped);
  const r1b = vm.runInContext(`createSnapshot("test 1")`, ctx);
  check("Snapshot: dữ liệu không đổi -> bỏ qua", r1b.ok === true && r1b.skipped === true);

  // Thay đổi dữ liệu rồi tạo 12 bản -> tối đa 10
  for (let i = 0; i < 12; i++) {
    S.days["2026-03-1" + (i % 10)] = { cells: mkCells(), absent: {}, tag: i };
    vm.runInContext(`createSnapshot("test ${i}")`, ctx);
  }
  const list = vm.runInContext(`listSnapshots()`, ctx);
  check("Snapshot: giới hạn tối đa 10 bản", list.length === 10, "len=" + list.length);

  // Khôi phục bản gần nhất sau khi xóa dữ liệu
  const before = JSON.stringify(S.days);
  S.days = {};
  const restore = vm.runInContext(`restoreLatestSnapshot()`, ctx);
  check("Snapshot: khôi phục bản gần nhất", restore.ok === true);
  const after = JSON.stringify(ctx.__S().days);
  check("Snapshot: dữ liệu sau khôi phục khớp", after === before, "before=" + before.slice(0, 80) + " after=" + after.slice(0, 80));

  const missing = vm.runInContext(`restoreSnapshotById("snap_khong_ton_tai")`, ctx);
  check("Snapshot: id không tồn tại -> lỗi", missing.ok === false);
}

// ==================== 4. AUDIT NỐI NGÀY ====================
{
  const ctx = makeCtx();
  loadBase(ctx);
  const S = ctx.__S();
  const mk = () => new Array(60).fill("");
  const a = mk(); const b = mk();
  a[11 * 5 + 1] = "Trần Văn Hiệp (CS01)"; // Ca 4 khung cuối, vọng x9
  b[0 * 5 + 2] = "Trần Văn Hiệp (CS01)";  // Ca 1 khung đầu, vọng x10
  S.days = {
    "2026-03-10": { cells: a, absent: {} },
    "2026-03-11": { cells: b, absent: {} }
  };
  const conflicts = vm.runInContext(`auditCrossDayConflicts()`, ctx);
  check("Audit: phát hiện nối ngày D-1 -> D", conflicts.length === 1 && conflicts[0].person.includes("Trần Văn Hiệp"), JSON.stringify(conflicts));

  // Cùng người nhưng không ở khung cuối/đầu -> không báo
  const a2 = mk(); const b2 = mk();
  a2[10 * 5 + 0] = "Trần Văn Hiệp (CS01)";
  b2[0 * 5 + 0] = "Trần Văn Hiệp (CS01)";
  S.days = {
    "2026-03-10": { cells: a2, absent: {} },
    "2026-03-11": { cells: b2, absent: {} }
  };
  const none = vm.runInContext(`auditCrossDayConflicts()`, ctx);
  check("Audit: không báo sai khi khác khung", none.length === 0, JSON.stringify(none));
}

// ==================== 5. SỔ BÀN GIAO ====================
{
  const ctx = makeCtx();
  loadBase(ctx);
  const ok = vm.runInContext(`addHandoverNote({ date: "2026-03-10", ca: "2", from: "A", to: "B", content: "Quân số đủ", status: "done" })`, ctx);
  check("Bàn giao: thêm hợp lệ", ok.ok === true && ok.item.content === "Quân số đủ");
  const list = vm.runInContext(`getHandoverNotes("2026-03-10")`, ctx);
  check("Bàn giao: đọc lại đúng 1 dòng", list.length === 1);

  const badDate = vm.runInContext(`addHandoverNote({ date: "10/03/2026", content: "x" })`, ctx);
  check("Bàn giao: ngày sai -> lỗi", badDate.ok === false);
  const empty = vm.runInContext(`addHandoverNote({ date: "2026-03-10", content: "   " })`, ctx);
  check("Bàn giao: nội dung rỗng -> lỗi", empty.ok === false);
  const badCa = vm.runInContext(`addHandoverNote({ date: "2026-03-10", ca: "9", content: "x" })`, ctx);
  check("Bàn giao: ca sai -> lỗi", badCa.ok === false);

  const del = vm.runInContext(`deleteHandoverNote("2026-03-10", ${JSON.stringify(ok.item.id)})`, ctx);
  check("Bàn giao: xóa dòng", del.ok === true && vm.runInContext(`getHandoverNotes("2026-03-10")`, ctx).length === 0);
}

// ==================== 6. THỐNG KÊ THÁNG ====================
{
  const ctx = makeCtx();
  loadBase(ctx);
  const S = ctx.__S();
  const mk = () => new Array(60).fill("");
  const d1 = mk();
  // Ca 1: Đốc gác A, vọng x9 B; Ca 2: Đốc gác A
  d1[0 * 5 + 0] = "A (SQ01)";
  d1[0 * 5 + 1] = "B (CS01)";
  d1[3 * 5 + 0] = "A (SQ01)";
  S.days = {
    "2026-03-07": { cells: d1, absent: {} }, // thứ Bảy
    "2026-03-08": { cells: d1, absent: {} }  // Chủ nhật
  };
  const res = vm.runInContext(`computeMonthlyFairness("2026-03")`, ctx);
  const a = res.rows.find(r => r.name.includes("A"));
  const b = res.rows.find(r => r.name.includes("B"));
  check("Tháng: A có 2 ngày công", a && a.days === 2, JSON.stringify(a));
  check("Tháng: A có 4 khung gác", a && a.shifts === 4, JSON.stringify(a));
  check("Tháng: B có 2 khung gác", b && b.shifts === 2, JSON.stringify(b));
  check("Tháng: đếm ngày cuối tuần", a && a.weekendDays === 2, JSON.stringify(a));
  check("Tháng: sắp xếp theo điểm công giảm dần", res.rows[0].credit >= res.rows[res.rows.length - 1].credit);
}

// ==================== 7. PHIÊN ĐĂNG NHẬP ====================
{
  // Tải trang không được tự gia hạn phiên đã quá 30 phút
  const ctx0 = makeCtx();
  ctx0.localStorage.setItem("lich-gac-role", "commander");
  ctx0.localStorage.setItem("lich-gac-session-at", String(Date.now() - 31 * 60 * 1000));
  loadBase(ctx0, { role: null });
  check("Phiên: tải trang không tự gia hạn phiên đã hết hạn", vm.runInContext(`isSessionExpired()`, ctx0) === true);

  const ctx = makeCtx();
  loadBase(ctx, { role: "commander" });
  vm.runInContext(`touchSession(true)`, ctx);
  check("Phiên: vừa hoạt động -> chưa hết hạn", vm.runInContext(`isSessionExpired()`, ctx) === false);

  const store = ctx.localStorage;
  store.setItem("lich-gac-session-at", String(Date.now() - 31 * 60 * 1000));
  check("Phiên: quá 30 phút -> hết hạn", vm.runInContext(`isSessionExpired()`, ctx) === true);

  vm.runInContext(`clearSession()`, ctx);
  check("Phiên: clearSession xóa vai trò", !vm.runInContext(`getCurrentRole()`, ctx));

  // Mặc định commander dùng mật khẩu mặc định -> phát hiện
  check("Bảo mật: phát hiện mật khẩu mặc định", vm.runInContext(`isUsingDefaultCommanderPassword()`, ctx) !== "");
}

console.log(`\n===== KẾT QUẢ: ${pass} pass / ${fail} fail =====`);
process.exit(fail ? 1 : 0);
