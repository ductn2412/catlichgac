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
        add: c => classes.add(c), remove: c => classes.delete(c),
        contains: c => classes.has(c),
        toggle: (c, f) => { const v = f === undefined ? !classes.has(c) : f; if (v) classes.add(c); else classes.delete(c); }
      },
      appendChild() {}, addEventListener() {}, setAttribute() {}, remove() {},
      querySelector() { return null; }, get classes() { return classes; }
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
      createElement: () => el("_tmp"), body: { appendChild() {} }, activeElement: null
    },
    crypto: { getRandomValues: arr => { for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256); return arr; } },
    setTimeout, clearTimeout,
    __alerts: alerts
  };
  vm.createContext(ctx);
  return ctx;
}

const ctx = makeCtx();
vm.runInContext(configSrc + "\n" + storageSrc + "\nglobalThis.__S = () => S;", ctx);
vm.runInContext("loadStorage(); setCurrentRole('commander');", ctx);
vm.runInContext(appSrc, ctx);

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

const BASE = ["A", "B", "C", "D", "E", "F", "G"].map((n, i) => `${n} Test (TS0${i + 1})`);
const TEAM1 = BASE.map(n => n.replace("Test", "T1")).map(n => n.replace(/\s*\(.*\)\s*$/, "").trim());
const NAMES = TEAM1;

vm.runInContext(`
  S.teams = [1, 2, 3, 4].map(t => ({
    id: t,
    name: "To " + t,
    officers: [],
    soldiers: ${JSON.stringify(BASE)}.map(n => n.replace("Test", "T" + t))
  }));
  S.days = {};
  S.borrowRules = { enabled: true, maxAbsentSoldiers: 3, maxConsecutiveDays: 5 };
`, ctx);

const clean = n => ctx.cleanName(n);

let teamMap = [1, 2, 3, 4];
let prevDay = null;
const start = "2026-11-13";
const history = [];
const DAYS = 21;

for (let i = 0; i < DAYS; i++) {
  const dStr = ctx.addDay(start, i);
  const built = ctx.buildGeneratedDay(dStr, teamMap, prevDay || ctx.getDayData(ctx.addDay(start, -1)));
  const ca = teamMap.indexOf(1);
  const day = built.day;
  const workers = [];
  for (let col = 1; col <= 4; col++) {
    const n = clean(day.cells[(ca * 3 + 2) * 5 + col] || "");
    if (n && TEAM1.includes(n)) workers.push({ name: n, col });
  }
  history.push({ date: dStr, ca, workers, unfilled: built.unfilled, borrowed: built.borrowed.length });
  prevDay = day;
  teamMap = ctx.nextTeamMap(teamMap);
}

console.log("\n=== LỊCH 21 NGÀY (Tổ 1) ===");
history.forEach((h, i) => {
  const names = h.workers.map(w => `${w.name.split(" ")[0]}${w.name.split(" ")[1]}(x${8 + w.col})`).join(" ");
  console.log(`Ngày ${String(i + 1).padStart(2)}: ${names}`);
});

check("Mỗi ngày Tổ 1 có đủ 4 chiến sĩ", history.every(h => h.workers.length === 4),
  history.filter(h => h.workers.length !== 4).map(h => h.date + ":" + h.workers.length).join(","));

check("Không mượn quân oan giữa các Tổ", history.every(h => h.borrowed === 0));

let maxStreak = 0;
NAMES.forEach(n => {
  let cur = 0;
  history.forEach(h => {
    if (h.workers.some(w => w.name === clean(n))) { cur++; maxStreak = Math.max(maxStreak, cur); }
    else cur = 0;
  });
});
check("Không ai làm quá 2 ngày liên tiếp", maxStreak <= 2, "maxStreak=" + maxStreak);

let maxRest = 0;
NAMES.forEach(n => {
  let cur = 0;
  history.forEach(h => {
    if (!h.workers.some(w => w.name === clean(n))) { cur++; maxRest = Math.max(maxRest, cur); }
    else cur = 0;
  });
});
check("Không ai nghỉ quá 2 ngày liên tiếp", maxRest <= 2, "maxRest=" + maxRest);

const counts = {};
NAMES.forEach(n => { counts[clean(n)] = 0; });
history.forEach(h => h.workers.forEach(w => { counts[w.name]++; }));
const vals = Object.values(counts);
check("Số ngày công cân bằng (chênh lệch <= 1)", Math.max(...vals) - Math.min(...vals) <= 1,
  JSON.stringify(counts));

let badKeep = [];
for (let i = 2; i < history.length; i++) {
  const w0 = new Set(history[i - 2].workers.map(w => w.name));
  const w1 = new Set(history[i - 1].workers.map(w => w.name));
  const w2 = new Set(history[i].workers.map(w => w.name));
  NAMES.forEach(n => {
    const name = clean(n);
    if (w0.has(name) && w1.has(name) && w2.has(name)) badKeep.push(`${name} @ ${history[i].date}`);
  });
}
check("Không ai làm 3 ngày liên tiếp (mũ 2 được nghỉ trước mũ 1)", badKeep.length === 0, badKeep.join(", "));

let rotationFails = [];
NAMES.forEach(n => {
  const name = clean(n);
  let last = null;
  history.forEach(h => {
    const w = h.workers.find(x => x.name === name);
    if (!w) return;
    if (last !== null) {
      const expected = (last % 4) + 1;
      if (w.col !== expected) rotationFails.push(`${name}: ${h.date} x${8 + last}->x${8 + w.col} (mong đợi x${8 + expected})`);
    }
    last = w.col;
  });
});
check("Vọng gác xoay vòng +1 mỗi lần đi làm", rotationFails.length === 0, rotationFails.slice(0, 6).join(" | "));

let dupCols = [];
history.forEach(h => {
  const cols = h.workers.map(w => w.col);
  if (new Set(cols).size !== cols.length) dupCols.push(h.date);
});
check("Không trùng cột vọng gác trong cùng ca", dupCols.length === 0, dupCols.join(","));

// Vắng 1 chiến sĩ: Tổ còn 6 người, vẫn phải xoay công bằng, không ai làm quá 2 ngày liền
vm.runInContext("S.days = {};", ctx);
teamMap = [1, 2, 3, 4];
prevDay = null;
const history2 = [];
for (let i = 0; i < 14; i++) {
  const dStr = ctx.addDay("2027-01-01", i);
  const dayData = ctx.getDayData(dStr);
  if (i === 3 || i === 4) {
    dayData.absent = { "Nguyễn": "A T1 (TS01)" };
  }
  const built = ctx.buildGeneratedDay(dStr, teamMap, prevDay || ctx.getDayData(ctx.addDay("2027-01-01", -1)));
  const ca = teamMap.indexOf(1);
  const workers = [];
  for (let col = 1; col <= 4; col++) {
    const n = clean(built.day.cells[(ca * 3 + 2) * 5 + col] || "");
    if (n && TEAM1.includes(n)) workers.push({ name: n, col });
  }
  history2.push({ date: dStr, workers });
  prevDay = built.day;
  teamMap = ctx.nextTeamMap(teamMap);
}
check("Khi vắng 1 người vẫn đủ 4 vị trí", history2.every(h => h.workers.length === 4),
  history2.filter(h => h.workers.length !== 4).map(h => h.date).join(","));

let maxStreak2 = 0;
NAMES.forEach(n => {
  let cur = 0;
  history2.forEach(h => {
    if (h.workers.some(w => w.name === clean(n))) { cur++; maxStreak2 = Math.max(maxStreak2, cur); }
    else cur = 0;
  });
});
check("Khi vắng 1 người không ai làm quá 2 ngày liên tiếp", maxStreak2 <= 2, "maxStreak=" + maxStreak2);

// Người chỉ làm ca đêm: vẫn xếp đủ 4 vị trí, chỉ xuất hiện ở khung đêm
vm.runInContext(`
  S.days = {};
  S.nightOnly = "A T1 (TS01)";
`, ctx);
teamMap = [1, 2, 3, 4];
prevDay = null;
  const history3 = [];
  for (let i = 0; i < 7; i++) {
    const dStr = ctx.addDay("2027-02-01", i);
    const built = ctx.buildGeneratedDay(dStr, teamMap, prevDay || ctx.getDayData(ctx.addDay("2027-02-01", -1)));
    const ca = teamMap.indexOf(1);
    const positions = [];
    for (let col = 1; col <= 4; col++) positions.push(clean(built.day.cells[(ca * 3 + 2) * 5 + col] || ""));
    history3.push({ date: dStr, ca, positions, cells: built.day.cells.slice() });
    prevDay = built.day;
    teamMap = ctx.nextTeamMap(teamMap);
  }
check("Ca đêm: mỗi ngày vẫn đủ 4 vị trí", history3.every(h => h.positions.filter(Boolean).length === 4),
  history3.map(h => h.positions.filter(Boolean).length).join(","));

let nightBad = [];
history3.forEach(h => {
  const nightSlots = ctx.nightWindowSlotsForCa(h.ca);
  const aCells = [];
  for (let slot = 0; slot < 3; slot++) {
    for (let col = 1; col <= 4; col++) {
      if (clean(h.cells[(h.ca * 3 + slot) * 5 + col] || "") === "A T1") aCells.push(slot);
    }
  }
  aCells.forEach(slot => {
    if (nightSlots.indexOf(slot) < 0) nightBad.push(`${h.date} slot${slot} (${ctx.CA[h.ca][slot]})`);
  });
  const selected = aCells.length > 0;
  if (selected && aCells.length !== nightSlots.length) {
    nightBad.push(`${h.date} đủ ${aCells.length}/${nightSlots.length} khung đêm`);
  }
});
check("Ca đêm: A chỉ xuất hiện ở khung đêm và đủ số khung", nightBad.length === 0, nightBad.join(","));

let nightDayBad = [];
history3.forEach(h => {
  for (let col = 1; col <= 4; col++) {
    const dayName = clean(h.cells[(h.ca * 3 + 0) * 5 + col] || "");
    // khung 06:00–08:00 / 08:00–10:00 / 10:00–12:00 / 12:00–14:00 là ban ngày với ca 0 và ca 1
    if ((h.ca === 0 || h.ca === 1) && dayName === "A T1") nightDayBad.push(h.date);
  }
});
check("Ca đêm: A không làm khung ban ngày", nightDayBad.length === 0, nightDayBad.join(","));

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
