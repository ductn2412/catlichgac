const fs = require("fs");
const vm = require("vm");
const path = require("path");
const ROOT = path.join(__dirname, "..") + path.sep;
const configSrc = fs.readFileSync(ROOT + "js/config.js", "utf8");
const storageSrc = fs.readFileSync(ROOT + "js/storage.js", "utf8");
const appSrc = fs.readFileSync(ROOT + "js/app.js", "utf8");

function extractInline(file, index = 0) {
  const s = fs.readFileSync(ROOT + file, "utf8");
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  const out = [];
  let m;
  while ((m = re.exec(s))) out.push(m[1]);
  return out[index];
}

function makeCtx() {
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
  const ctx = {
    console,
    JSON, Math, Date, Object, Array, String, Number, Set, Map, RegExp, Error, Boolean,
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

function loadBase(ctx, { page = null, role = "commander", withApp = false } = {}) {
  vm.runInContext(configSrc + "\n" + storageSrc + "\nglobalThis.__S = () => S;", ctx);
  vm.runInContext("loadStorage();", ctx);
  if (role) vm.runInContext(`setCurrentRole(${JSON.stringify(role)});`, ctx);
  if (withApp) {
    vm.runInContext(appSrc, ctx);
  }
  if (page) vm.runInContext(extractInline(page), ctx);
}

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + (extra ? "\n      " + extra : "")); }
}

// ============ C5: cấp mã không trùng ============
{
  const ctx = makeCtx();
  loadBase(ctx, { role: "commander" });
  const code = vm.runInContext('nextAvailableCode("CS", ["CS01","CS02","CS05","xx"])', ctx);
  check("C5: nextAvailableCode nhảy qua mã đã dùng", code === "CS06", code);
  const code2 = vm.runInContext('nextAvailableCode("SQ", [])', ctx);
  check("C5: nextAvailableCode rỗng -> SQ01", code2 === "SQ01", code2);

  // Tạo 2 người cùng mã trong 4 Tổ -> phải được cấp lại
  const S = ctx.__S();
  S.teams = [
    { id: 1, name: "Tổ 1", officers: ["A (SQ01)"], soldiers: ["X (CS01)"] },
    { id: 2, name: "Tổ 2", officers: ["B (SQ01)"], soldiers: ["Y (CS01)"] },
    { id: 3, name: "Tổ 3", officers: [], soldiers: [] },
    { id: 4, name: "Tổ 4", officers: [], soldiers: [] }
  ];
  S.personnelAccounts = [];
  const fixed = vm.runInContext("syncFromTeamsToRosterAndAccounts()", ctx);
  const codes = S.personnelAccounts.map(a => a.code);
  const uniq = new Set(codes.map(c => c.toLowerCase()));
  check("C5: mã trong danh sách 4 Tổ không trùng", uniq.size === codes.length, JSON.stringify(codes));
  check("C5: báo số mã trùng đã sửa", fixed === 2, "fixed=" + fixed);
  check("C5: 4 Tổ được cập nhật mã mới", S.teams[1].officers[0] !== "B (SQ01)" || S.teams[1].soldiers[0] !== "Y (CS01)", JSON.stringify(S.teams));
}

// ============ C5: rút người khỏi Tổ -> active:false, không mất hồ sơ ============
{
  const ctx = makeCtx();
  loadBase(ctx, { role: "commander" });
  const S = ctx.__S();
  S.teams = [
    { id: 1, name: "Tổ 1", officers: [], soldiers: ["X"] },
    { id: 2, name: "Tổ 2", officers: [], soldiers: [] },
    { id: 3, name: "Tổ 3", officers: [], soldiers: [] },
    { id: 4, name: "Tổ 4", officers: [], soldiers: [] }
  ];
  vm.runInContext("syncFromTeamsToRosterAndAccounts()", ctx);
  const xId = S.personnelAccounts.find(a => a.fullName === "X").id;
  // Rút X khỏi Tổ 1
  S.teams[0].soldiers = [];
  vm.runInContext("syncFromTeamsToRosterAndAccounts()", ctx);
  const x = S.personnelAccounts.find(a => a.id === xId);
  check("C5: hồ sơ bị rút vẫn còn", !!x, "missing");
  check("C5: hồ sơ bị rút có active=false", !!x && x.active === false, JSON.stringify(x));
  // Đưa lại -> active true và giữ nguyên id
  S.teams[0].soldiers = ["X"];
  vm.runInContext("syncFromTeamsToRosterAndAccounts()", ctx);
  const x2 = S.personnelAccounts.find(a => a.id === xId);
  check("C5: thêm lại -> active=true, giữ id", !!x2 && x2.active === true, JSON.stringify(x2));
  check("C5: syncRosterStrings bỏ qua active=false", (() => {
    x2.active = false;
    vm.runInContext("syncRosterStringsFromAccounts()", ctx);
    return !S.teams[0].soldiers.includes("X");
  })(), JSON.stringify(S.teams[0].soldiers));
}

// ============ C7: băm mật khẩu ============
{
  const ctx = makeCtx();
  loadBase(ctx, { role: "commander" });
  const sha = vm.runInContext('sha256Hex("abc")', ctx);
  check("C7: SHA-256 đúng chuẩn", sha === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", sha);

  const rec = vm.runInContext('makePasswordRecord("doi3")', ctx);
  check("C7: bản ghi có định dạng sha256$...", /^sha256\$1000\$[0-9a-f]+\$[0-9a-f]{64}$/.test(rec), rec);
  check("C7: verify đúng mật khẩu", vm.runInContext(`verifyPasswordRecord(${JSON.stringify(rec)}, "doi3")`, ctx) === true);
  check("C7: verify sai mật khẩu", vm.runInContext(`verifyPasswordRecord(${JSON.stringify(rec)}, "sai")`, ctx) === false);
  check("C7: hash 2 lần khác salt", vm.runInContext('makePasswordRecord("doi3")', ctx) !== rec);
  check("C7: vẫn xác thực được bản ghi plaintext cũ", vm.runInContext('verifyPasswordRecord("doi3", "doi3")', ctx) === true);
  check("C7: mặc định chihuy/doi3 đúng", vm.runInContext('verifyPasswordRecord(DEFAULT_COMMANDER_ACCOUNTS["chihuy"], "doi3")', ctx) === true);
  check("C7: mặc định admin/123456 đúng", vm.runInContext('verifyPasswordRecord(DEFAULT_COMMANDER_ACCOUNTS["admin"], "123456")', ctx) === true);
  check("C7: mặc định không chứa plaintext", !/^(doi3|123456)$/.test(vm.runInContext('DEFAULT_COMMANDER_ACCOUNTS["chihuy"]', ctx)));

  // Tài khoản quân nhân
  const acc = { id: 1, fullName: "CS A", code: "CS01", roleType: "soldier", teamId: 1 };
  ctx.__S().personnelAccounts = [acc];
  vm.runInContext('setAccountPassword(S.personnelAccounts[0], "matkhau1")', ctx);
  check("C7: setAccountPassword không lưu plaintext", !("password" in acc), JSON.stringify(acc));
  check("C7: verifyAccountPassword đúng", vm.runInContext('verifyAccountPassword(S.personnelAccounts[0], "matkhau1")', ctx) === true);
  check("C7: verifyAccountPassword sai", vm.runInContext('verifyAccountPassword(S.personnelAccounts[0], "x")', ctx) === false);

  // Đăng nhập quân nhân
  const ok = vm.runInContext('authenticateSoldierLogin("CS A (CS01)", "matkhau1")', ctx);
  check("C7: đăng nhập quân nhân bằng Họ tên (Mã)", !!ok && ok.id === 1, JSON.stringify(ok));
  const byPureName = vm.runInContext('authenticateSoldierLogin("CS A", "matkhau1")', ctx);
  check("C7: chặn đăng nhập bằng tên thuần", byPureName === null, JSON.stringify(byPureName));
  check("C7: sai mật khẩu bị chặn", vm.runInContext('authenticateSoldierLogin("CS A (CS01)", "sai")', ctx) === null);

  // active=false không đăng nhập được
  ctx.__S().personnelAccounts[0].active = false;
  check("C7: tài khoản ngừng hoạt động không đăng nhập", vm.runInContext('authenticateSoldierLogin("CS A (CS01)", "matkhau1")', ctx) === null);

  // migrate plaintext cũ
  const ctx2 = makeCtx();
  loadBase(ctx2, { role: "commander" });
  const S2 = ctx2.__S();
  S2.personnelAccounts = [{ id: 2, fullName: "CS B", code: "CS02", roleType: "soldier", teamId: 1, password: "111" }];
  S2.accounts = { chihuy: "doi3" };
  const did = vm.runInContext("migrateLegacyPasswords()", ctx2);
  check("C7: migrate có thay đổi", did === true);
  check("C7: migrate băm mật khẩu quân nhân", !!S2.personnelAccounts[0].passwordHash && !("password" in S2.personnelAccounts[0]), JSON.stringify(S2.personnelAccounts[0]));
  check("C7: migrate băm mật khẩu Chỉ huy", /^sha256\$/.test(S2.accounts.chihuy), S2.accounts.chihuy);
  check("C7: sau migrate vẫn đăng nhập được", vm.runInContext('authenticateSoldierLogin("CS B (CS02)", "111")', ctx2) !== null);
}

// ============ C8: escape HTML ============
{
  const ctx = makeCtx();
  loadBase(ctx, { role: "commander" });
  const out = vm.runInContext(`escHTML("<img src=x onerror=alert(1)> & ' \\"")`, ctx);
  check("C8: escape đủ 5 ký tự", out === "&lt;img src=x onerror=alert(1)&gt; &amp; &#39; &quot;", out);
  const link = vm.runInContext(`renderPersonHoverLinkHTML("<script>x</script>'")`, ctx);
  check("C8: link hover dùng data-person, không nối inline", link.includes("data-person=") && !link.includes("showPersonnelHoverCard(event, '"), link);
  check("C8: link hover đã escape tên", !link.includes("<script>"), link);
}

// ============ H1: duyệt đổi ca đúng vị trí ============
function h1Ctx() {
  const ctx = makeCtx();
  loadBase(ctx, { page: "so-truc.html", role: "commander" });
  const S = ctx.__S();
  // Tổ 1: 2 sĩ quan + 5 chiến sĩ
  S.teams = [
    { id: 1, name: "Tổ 1", officers: ["SQ A1 (SQ01)", "SQ A2 (SQ02)"], soldiers: ["CS A1 (CS01)", "CS A2 (CS02)", "CS A3 (CS03)", "CS A4 (CS04)", "CS A5 (CS05)"] },
    { id: 2, name: "Tổ 2", officers: ["SQ B1 (SQ06)"], soldiers: ["CS B1 (CS07)", "CS B2 (CS08)", "CS B3 (CS09)", "CS B4 (CS10)"] },
    { id: 3, name: "Tổ 3", officers: ["SQ C1 (SQ11)"], soldiers: ["CS C1 (CS12)", "CS C2 (CS13)", "CS C3 (CS14)", "CS C4 (CS15)"] },
    { id: 4, name: "Tổ 4", officers: ["SQ D1 (SQ16)"], soldiers: ["CS D1 (CS17)", "CS D2 (CS18)", "CS D3 (CS19)", "CS D4 (CS20)"] }
  ];
  vm.runInContext("syncFromTeamsToRosterAndAccounts()", ctx);
  const day = { cells: Array(60).fill(""), absent: {}, streaks: {}, manualCredits: {}, teamInCa: [1, 2, 3, 4] };
  // Ca 1: CS A1 ở x9, CS A2 ở x10 (cùng 3 khung)
  for (let s = 0; s < 3; s++) {
    day.cells[(0 * 3 + s) * 5 + 1] = "CS A1 (CS01)";
    day.cells[(0 * 3 + s) * 5 + 2] = "CS A2 (CS02)";
  }
  // Ca 2: CS A1 cũng có mặt ở x11 -> nếu duyệt thô sẽ bị đổi nhầm
  for (let s = 0; s < 3; s++) day.cells[(1 * 3 + s) * 5 + 3] = "CS A1 (CS01)";
  S.days = { "2026-11-12": day };
  return ctx;
}

{
  const ctx = h1Ctx();
  const d = "2026-11-12";
  const groups = vm.runInContext(`getSwapGroups(getDayData("${d}"), "CS A1 (CS01)")`, ctx);
  check("H1: gom đúng 2 nhóm vị trí", groups.length === 2 && groups[0].ca === 0 && groups[1].ca === 1, JSON.stringify(groups));

  const req = { date: d, fromPerson: "CS A1 (CS01)", toPerson: "CS A2 (CS02)", fromCa: 0, fromCol: 1 };
  const built = vm.runInContext(`buildSwapPlan(${JSON.stringify(req)})`, ctx);
  check("H1: lập được kế hoạch đổi", !built.error && built.plan.length === 3, JSON.stringify(built));

  vm.runInContext(`(function(){ const b = buildSwapPlan(${JSON.stringify(req)}); applySwapPlan(getDayData("${d}"), b.plan); })()`, ctx);
  const day = ctx.__S().days[d];
  check("H1: CS A1 rời đúng vị trí x9 ca 1", [0, 1, 2].every(s => day.cells[(0 * 3 + s) * 5 + 1] !== "CS A1 (CS01)"), JSON.stringify(day.cells));
  check("H1: CS A2 nhận đúng vị trí x9 ca 1", [0, 1, 2].every(s => day.cells[(0 * 3 + s) * 5 + 1] === "CS A2 (CS02)"));
  check("H1: CS A2 rời đúng vị trí x10 ca 1", [0, 1, 2].every(s => day.cells[(0 * 3 + s) * 5 + 2] === "CS A1 (CS01)"));
  check("H1: ca 2 của CS A1 KHÔNG bị đổi nhầm", [0, 1, 2].every(s => day.cells[(1 * 3 + s) * 5 + 3] === "CS A1 (CS01)"), JSON.stringify(day.cells));
}

{
  // Người nhận đang vắng
  const ctx = h1Ctx();
  const d = "2026-11-12";
  ctx.__S().days[d].absent = { phep: "CS A2" };
  const res = vm.runInContext(`buildSwapPlan(${JSON.stringify({ date: d, fromPerson: "CS A1 (CS01)", toPerson: "CS A2 (CS02)", fromCa: 0, fromCol: 1 })})`, ctx);
  check("H1: chặn người nhận đang vắng", !!res.error && /vắng/.test(res.error), JSON.stringify(res));
}

{
  // Khác chức danh
  const ctx = h1Ctx();
  const d = "2026-11-12";
  const res = vm.runInContext(`buildSwapPlan(${JSON.stringify({ date: d, fromPerson: "CS A1 (CS01)", toPerson: "SQ A1 (SQ01)", fromCa: 0, fromCol: 1 })})`, ctx);
  check("H1: chặn khác chức danh", !!res.error && /chức danh/.test(res.error), JSON.stringify(res));
}

{
  // Khác Tổ
  const ctx = h1Ctx();
  const d = "2026-11-12";
  // Cho CS B1 vào lịch ca 3 tại Tổ 2
  for (let s = 0; s < 3; s++) ctx.__S().days[d].cells[(2 * 3 + s) * 5 + 1] = "CS B1 (CS07)";
  const res = vm.runInContext(`buildSwapPlan(${JSON.stringify({ date: d, fromPerson: "CS A1 (CS01)", toPerson: "CS B1 (CS07)", fromCa: 0, fromCol: 1 })})`, ctx);
  check("H1: chặn khác Tổ", !!res.error && /cùng Tổ/.test(res.error), JSON.stringify(res));
}

{
  // Vị trí chọn không còn
  const ctx = h1Ctx();
  const d = "2026-11-12";
  const res = vm.runInContext(`buildSwapPlan(${JSON.stringify({ date: d, fromPerson: "CS A1 (CS01)", toPerson: "CS A2 (CS02)", fromCa: 2, fromCol: 4 })})`, ctx);
  check("H1: báo lỗi khi vị trí chọn không còn", !!res.error && /không còn/.test(res.error), JSON.stringify(res));
}

{
  // Sau khi đổi tạo 2 khung liền nhau -> chặn khi duyệt
  const ctx = h1Ctx();
  const d = "2026-11-12";
  const day = ctx.__S().days[d];
  // CS A1 còn 1 vị trí Ca 2 · x11 (cùng khung giờ với vị trí CS A2 sắp nhường)
  for (let s = 0; s < 3; s++) day.cells[(1 * 3 + s) * 5 + 3] = "CS A1 (CS01)";
  // CS A2 giữ Ca 2 · x9
  for (let s = 0; s < 3; s++) day.cells[(1 * 3 + s) * 5 + 1] = "CS A2 (CS02)";
  const S = ctx.__S();
  S.swapRequests = [{
    id: 99, date: d, fromPerson: "CS A1 (CS01)", toPerson: "CS A2 (CS02)",
    fromCa: 0, fromCol: 1, fromLabel: "Ca 1 · Vọng x9 · 06:00 – 08:00, 14:00 – 16:00, 22:00 – 24:00",
    reason: "test", status: "pending"
  }];
  const before = day.cells.slice();
  vm.runInContext("approveSwapRequest(99, true)", ctx);
  const after = ctx.__S().days[d];
  check("H1: duyệt sẽ tạo khung liền nhau -> chặn", /Không thể duyệt/.test(ctx.__alerts.join(" ")), ctx.__alerts.join(" | "));
  check("H1: khi chặn thì hoàn nguyên lịch", JSON.stringify(after.cells) === JSON.stringify(before));
  check("H1: yêu cầu vẫn ở trạng thái chờ", ctx.__S().swapRequests[0].status === "pending", ctx.__S().swapRequests[0].status);
}

// ============ H2: chỉ mượn từ Tổ còn dư ============
function h2Ctx() {
  const ctx = makeCtx();
  loadBase(ctx, { withApp: true, role: "commander" });
  const S = ctx.__S();
  S.teams = [
    { id: 1, name: "Tổ 1", officers: [], soldiers: ["CS A1", "CS A2", "CS A3", "CS A4", "CS A5"] },
    { id: 2, name: "Tổ 2", officers: [], soldiers: ["CS B1", "CS B2", "CS B3", "CS B4"] },
    { id: 3, name: "Tổ 3", officers: [], soldiers: ["CS C1", "CS C2", "CS C3", "CS C4"] },
    { id: 4, name: "Tổ 4", officers: [], soldiers: ["CS D1", "CS D2", "CS D3", "CS D4"] }
  ];
  S.days = {};
  S.nightOnly = "";
  return ctx;
}

{
  const ctx = h2Ctx();
  // Tổ 3 cần người (target), Tổ 2 và Tổ 4 cùng đang trực (đủ 4 người, không dư), Tổ 1 có 5 -> dư 1
  const teamMap = [1, 2, 3, 4];
  const got = vm.runInContext('pickBorrowedSoldier("2026-11-12", 3, new Set(), {}, {}, 2, 1, [1,2,3,4])', ctx);
  check("H2: chỉ chọn người từ Tổ có dư", !!got && got.teamId === 1, JSON.stringify(got));
}

{
  const ctx = h2Ctx();
  // Giảm Tổ 1 còn 4 -> Tổ 1 cũng không dư, tất cả đang trực -> không mượn được
  ctx.__S().teams[0].soldiers = ["CS A1", "CS A2", "CS A3", "CS A4"];
  const got = vm.runInContext('pickBorrowedSoldier("2026-11-12", 3, new Set(), {}, {}, 2, 1, [1,2,3,4])', ctx);
  check("H2: không mượn ai khi mọi Tổ đều đủ người", got === null, JSON.stringify(got));
}

{
  const ctx = h2Ctx();
  // Tổ 2 không trực hôm nay (teamMap thiếu 2) -> 4 người được coi là dư
  const got = vm.runInContext('pickBorrowedSoldier("2026-11-12", 3, new Set(), {}, {}, 2, 1, [1,3,4])', ctx);
  check("H2: Tổ không trực vẫn có thể cho mượn", !!got && got.teamId === 2, JSON.stringify(got));
}

{
  const ctx = h2Ctx();
  // Người đang chỉ làm ca đêm bị loại khỏi danh sách cho mượn
  ctx.__S().nightOnly = "CS A1, CS A2, CS A3, CS A4, CS A5";
  const ns2 = vm.runInContext("getNightOnlySet()", ctx);
  const got = vm.runInContext(`pickBorrowedSoldier("2026-11-12", 3, new Set(), {}, ${JSON.stringify(ns2)}, 2, 1, [1,2,3,4])`, ctx);
  check("H2: Tổ chỉ toàn người ca đêm không bị rút", got === null || got.teamId !== 1, JSON.stringify(got));
}

console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);
