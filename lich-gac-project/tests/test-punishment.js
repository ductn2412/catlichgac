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
      readyState: "loading", addEventListener() {},
      getElementById: id => { if (!els.has(id)) els.set(id, el(id)); return els.get(id); },
      createElement: () => el("_tmp"), body: { appendChild() {} }, activeElement: null,
      querySelectorAll() { return []; }
    },
    crypto: { getRandomValues: arr => { for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256); return arr; } },
    setTimeout, clearTimeout,
    __alerts: alerts
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
  else { fail++; console.log("FAIL  " + name + (extra ? "  -> " + extra : "")); }
}
const clean = n => ctx.cleanName(n);

const BASE = ["A", "B", "C", "D", "E", "F", "G"].map((n, i) => `${n} Test (TS0${i + 1})`);
const TEAM1 = BASE.map(n => n.replace("Test", "T1"));

vm.runInContext(`
  S.teams = [1, 2, 3, 4].map(t => ({
    id: t, name: "To " + t, officers: [],
    soldiers: ${JSON.stringify(BASE)}.map(n => n.replace("Test", "T" + t))
  }));
  S.days = {};
  S.borrowRules = { enabled: true, maxAbsentSoldiers: 3, maxConsecutiveDays: 5 };
  S.punishments = [];
`, ctx);

// ----- 1) Ưu tiên trong pickSoldiersForTeam -----
const team1 = ctx.getS().teams[0];
const PUNISHED = clean("A T1");
vm.runInContext(`S.punishments = [{ id: "p1", person: ${JSON.stringify(PUNISHED)}, start: "2027-03-01", days: 7 }];`, ctx);
const picked = ctx.pickSoldiersForTeam(team1, ctx.absSet({}), "2027-03-01");
check("Người bị phạt luôn nằm trong 4 người được chọn", picked.map(clean).includes(PUNISHED),
  picked.map(clean).join(","));

// ----- 2) Cắt 7 ngày liên tục: người bị phạt phải có mặt -----
vm.runInContext("S.days = {}; S.nightOnly = '';", ctx);
vm.runInContext(`S.punishments = [{ id: "p1", person: ${JSON.stringify(PUNISHED)}, start: "2027-03-01", days: 7 }];`, ctx);
let teamMap = [1, 2, 3, 4];
let prevDay = ctx.getDayData("2027-02-28");
const hist = [];
for (let i = 0; i < 7; i++) {
  const dStr = ctx.addDay("2027-03-01", i);
  const built = ctx.buildGeneratedDay(dStr, teamMap, prevDay);
  const ca = teamMap.indexOf(1);
  const onDuty = [];
  for (let slot = 0; slot < 3; slot++) {
    for (let col = 0; col <= 4; col++) {
      if (clean(built.day.cells[(ca * 3 + slot) * 5 + col] || "") === PUNISHED) onDuty.push(slot + ":" + col);
    }
  }
  hist.push({ date: dStr, ca, onDuty, swaps: built.overworkSwaps.slice() });
  prevDay = built.day;
  teamMap = ctx.nextTeamMap(teamMap);
}
console.log("\n=== 7 NGÀY PHẠT (Tổ 1, A T1) ===");
hist.forEach(h => console.log(`${h.date} Ca ${h.ca + 1}: ${h.onDuty.length ? h.onDuty.join(" ") : "KHÔNG CÓ MẶT"}`));

const daysPresent = hist.filter(h => h.onDuty.length > 0).length;
check("Người bị phạt có mặt đủ 7/7 ngày liên tục", daysPresent === 7,
  `chỉ ${daysPresent}/7 ngày`);

check("Không bị đổi ra nghỉ do vượt ngưỡng (overworkSwaps không chứa người bị phạt)",
  hist.every(h => !h.swaps.some(s => clean(s.out) === PUNISHED)),
  hist.flatMap(h => h.swaps.filter(s => clean(s.out) === PUNISHED).map(s => h.date)).join(","));

// ----- 3) Vắng mặt thắng: người bị phạt đang vắng thì không xếp -----
vm.runInContext("S.days = {};", ctx);
const d0 = ctx.getDayData("2027-04-01");
d0.absent = { "phep": PUNISHED };
let builtAbs = ctx.buildGeneratedDay("2027-04-01", [1, 2, 3, 4], ctx.getDayData("2027-03-31"));
let appears = builtAbs.day.cells.some(c => clean(c) === PUNISHED);
check("Người bị phạt đang vắng mặt không bị xếp gác", !appears);

// ----- 4) propagatePunishment: sửa các ngày đã cắt sẵn -----
vm.runInContext("S.days = {};", ctx);
// Cắt trước 3 ngày (không có phạt)
teamMap = [1, 2, 3, 4];
prevDay = ctx.getDayData("2027-04-30");
const pre = [];
for (let i = 0; i < 3; i++) {
  const dStr = ctx.addDay("2027-05-01", i);
  const b = ctx.buildGeneratedDay(dStr, teamMap, prevDay);
  pre.push(dStr);
  prevDay = b.day;
  teamMap = ctx.nextTeamMap(teamMap);
}
vm.runInContext(`S.punishments = [{ id: "p2", person: ${JSON.stringify(PUNISHED)}, start: "2027-05-01", days: 3 }];`, ctx);
const p2 = ctx.getPunishments()[0];
const changed = ctx.propagatePunishment(p2);
check("propagatePunishment báo có cập nhật ngày đã cắt", changed > 0, "changed=" + changed);
const propOK = pre.every(d => (ctx.getS().days[d].cells || []).some(c => clean(c) === PUNISHED));
check("Sau propagate, người bị phạt có mặt trong các ngày đã cắt", propOK,
  pre.map(d => d + ":" + (ctx.getS().days[d].cells || []).some(c => clean(c) === PUNISHED)).join(","));

// ----- 5) Sĩ quan bị phạt cũng được ưu tiên Đốc gác -----
vm.runInContext(`
  S.days = {};
  S.punishments = [{ id: "p3", person: "O1 Test (OS01)", start: "2027-06-01", days: 7 }];
  S.teams[0].officers = ["O1 Test (OS01)", "O2 Test (OS02)"];
`, ctx);
const off = ctx.pickOfficerForTeam(ctx.getS().teams[0], 1, null, ctx.absSet({}), "2027-06-01");
check("Sĩ quan bị phạt được ưu tiên làm Đốc gác", clean(off) === clean("O1 Test (OS01)"), off);

// ----- 6) punishmentRange / isPunishedOn -----
vm.runInContext(`S.punishments = [{ id: "p6", person: ${JSON.stringify(PUNISHED)}, start: "2027-07-01", days: 7 }];`, ctx);
const r = ctx.punishmentRange({ start: "2027-07-01", days: 7 });
check("punishmentRange tính đúng ngày kết thúc", r.start === "2027-07-01" && r.end === "2027-07-07",
  JSON.stringify(r));
check("isPunishedOn đúng trong/ngoài khoảng", ctx.isPunishedOn("A T1", "2027-07-07") &&
  !ctx.isPunishedOn("A T1", "2027-07-08") && !ctx.isPunishedOn("A T1", "2027-06-30"));

// ----- 7) addPunishment nhập nhiều tên cùng lúc -----
vm.runInContext("S.days = {}; S.punishments = [];", ctx);
const nameEl = ctx.document.getElementById("punishPerson");
const startEl = ctx.document.getElementById("punishStart");
nameEl.value = "A T1, B T1";
startEl.value = "2027-08-01";
ctx.addPunishment();
const names = ctx.getPunishments().map(p => clean(p.person)).sort();
check("addPunishment nhập nhiều tên cùng lúc", names.length === 2 &&
  names.includes("A T1") && names.includes("B T1"), JSON.stringify(names));

// ----- 8) Nhiều người cùng Tổ bị phạt (<=4) đều được ưu tiên xếp -----
vm.runInContext(`S.days = {}; S.punishments = [
  { id: "p8a", person: ${JSON.stringify(clean("A T1"))}, start: "2027-09-01", days: 7 },
  { id: "p8b", person: ${JSON.stringify(clean("B T1"))}, start: "2027-09-01", days: 7 },
  { id: "p8c", person: ${JSON.stringify(clean("C T1"))}, start: "2027-09-01", days: 7 }
];`, ctx);
const picked3 = ctx.pickSoldiersForTeam(ctx.getS().teams[0], ctx.absSet({}), "2027-09-01").map(clean);
check("Nhiều người cùng Tổ bị phạt đều được xếp gác",
  ["A T1", "B T1", "C T1"].every(n => picked3.includes(n)), picked3.join(","));

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
