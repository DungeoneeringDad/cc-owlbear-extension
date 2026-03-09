import OBR from "https://unpkg.com/@owlbear-rodeo/sdk@latest/dist/index.mjs";

const EXT_ID = "io.dungeoneeringdad.cc-shadowdark-style";
const ROOM_KEY = `${EXT_ID}/partyRecords`;
const SLOT_PREFIX = `${EXT_ID}/slot/`;
const ATTRS = ["str","dex","con","int","wis","cha"];
const LABELS = {str:"STR", dex:"DEX", con:"CON", int:"INT", wis:"WIS", cha:"CHA"};
const logEntries = [];

window.OBR = OBR;

OBR.onReady(async () => {
  initTabs();
  buildAttributes();
  buildSpellSlots();
  bindEvents();
  await loadSlot();
  await loadRoomRecords();
});

function initTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });
}

function bindEvents() {
  document.addEventListener("input", (e) => {
    if (e.target?.id && ATTRS.includes(e.target.id)) updateModifier(e.target.id);
  });

  document.addEventListener("click", (e) => {
    const attr = e.target?.dataset?.siege;
    const dmg = e.target?.dataset?.dmg;
    if (attr) doSiege(attr);
    if (dmg) rollDamage(dmg);
  });

  document.getElementById("attackBtn").addEventListener("click", doAttack);
  document.getElementById("initiativeBtn").addEventListener("click", doInitiative);
  document.getElementById("saveBtn").addEventListener("click", saveSlot);
  document.getElementById("loadBtn").addEventListener("click", loadSlot);
  document.getElementById("shareBtn").addEventListener("click", shareToRoom);
  document.getElementById("loadRoomBtn").addEventListener("click", loadRoomRecords);
  document.getElementById("exportBtn").addEventListener("click", exportJson);
  document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
  document.getElementById("importFile").addEventListener("change", importJson);
}

function buildAttributes() {
  const root = document.getElementById("attributes");
  root.innerHTML = "";
  ATTRS.forEach(attr => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `
      <div class="stat-head">
        <strong>${LABELS[attr]}</strong>
        <span class="mod" id="${attr}Mod">+0</span>
      </div>
      <label>Score<input id="${attr}" type="number" value="10"></label>
      <label>Challenge Level<input id="${attr}CL" type="number" value="0"></label>
      <label class="prime-row"><input id="${attr}Prime" type="checkbox"> Prime</label>
      <button data-siege="${attr}">Siege Check</button>
    `;
    root.appendChild(card);
  });
  ATTRS.forEach(updateModifier);
}

function buildSpellSlots() {
  const root = document.getElementById("spellSlots");
  root.innerHTML = "";
  for (let level = 1; level <= 9; level++) {
    const box = document.createElement("div");
    box.className = "spell-level";
    const wrap = document.createElement("div");
    wrap.className = "slot-wrap";
    for (let i = 0; i < 6; i++) {
      const slot = document.createElement("input");
      slot.type = "checkbox";
      slot.className = "slot";
      slot.dataset.level = String(level);
      slot.dataset.index = String(i);
      wrap.appendChild(slot);
    }
    box.innerHTML = `<strong>Level ${level}</strong>`;
    box.appendChild(wrap);
    root.appendChild(box);
  }
}

function modFor(score) {
  return Math.floor((Number(score || 10) - 10) / 2);
}

function updateModifier(attr) {
  const mod = modFor(document.getElementById(attr).value);
  document.getElementById(attr + "Mod").textContent = mod >= 0 ? `+${mod}` : String(mod);
}

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function addLog(title, detail) {
  logEntries.unshift({ title, detail, ts: new Date().toLocaleTimeString() });
  renderLog();
}

function renderLog() {
  const root = document.getElementById("diceLog");
  root.innerHTML = logEntries.slice(0, 12).map(entry => `
    <div class="log-entry">
      <strong>${escapeHtml(entry.title)}</strong>
      <div>${escapeHtml(entry.detail)}</div>
      <small>${escapeHtml(entry.ts)}</small>
    </div>
  `).join("");
}

function doAttack() {
  const roll = rollDie(20);
  const bth = Number(val("bth") || 0);
  addLog("Attack", `d20 ${roll} + BTH ${bth} = ${roll + bth}`);
}

function doInitiative() {
  const roll = rollDie(10);
  const bonus = Number(val("initBonus") || 0);
  addLog("Initiative", `d10 ${roll} + bonus ${bonus} = ${roll + bonus}`);
}

function rollDamage(code) {
  const sides = Number(code.replace("d", ""));
  addLog("Damage", `${code} = ${rollDie(sides)}`);
}

function doSiege(attr) {
  const score = Number(val(attr) || 10);
  const cl = Number(val(attr + "CL") || 0);
  const prime = document.getElementById(attr + "Prime").checked;
  const base = prime ? 12 : 18;
  const roll = rollDie(20);
  const mod = modFor(score);
  const total = roll + mod;
  const target = base + cl;
  addLog(`${LABELS[attr]} Siege`, `d20 ${roll} + mod ${mod} = ${total} vs ${target}`);
}

function selectedSlot() {
  return document.getElementById("slotSelect").value;
}

function slotKey() {
  return `${SLOT_PREFIX}${selectedSlot()}`;
}

function collectData() {
  const data = {
    name: val("name"),
    charClass: val("charClass"),
    race: val("race"),
    level: val("level"),
    alignment: val("alignment"),
    player: val("player"),
    deity: val("deity"),
    xp: val("xp"),
    hp: val("hp"),
    maxHp: val("maxHp"),
    ac: val("ac"),
    bth: val("bth"),
    initBonus: val("initBonus"),
    move: val("move"),
    notes: val("notes"),
    weapons: val("weapons"),
    armor: val("armor"),
    equipment: val("equipment"),
    treasure: val("treasure"),
    languages: val("languages"),
    spellNotes: val("spellNotes"),
    abilities: val("abilities"),
    training: val("training"),
    companions: val("companions"),
    attrs: {},
    spellSlots: {}
  };
  ATTRS.forEach(attr => {
    data.attrs[attr] = {
      score: val(attr),
      cl: val(attr + "CL"),
      prime: document.getElementById(attr + "Prime").checked
    };
  });
  document.querySelectorAll(".slot").forEach(slot => {
    data.spellSlots[`${slot.dataset.level}:${slot.dataset.index}`] = slot.checked;
  });
  return data;
}

function applyData(data) {
  if (!data) return;
  ["name","charClass","race","level","alignment","player","deity","xp","hp","maxHp","ac","bth","initBonus","move","notes","weapons","armor","equipment","treasure","languages","spellNotes","abilities","training","companions"]
    .forEach(id => setVal(id, data[id]));
  ATTRS.forEach(attr => {
    const v = data.attrs?.[attr] || {};
    setVal(attr, v.score ?? 10);
    setVal(attr + "CL", v.cl ?? 0);
    document.getElementById(attr + "Prime").checked = Boolean(v.prime);
    updateModifier(attr);
  });
  document.querySelectorAll(".slot").forEach(slot => {
    slot.checked = Boolean(data.spellSlots?.[`${slot.dataset.level}:${slot.dataset.index}`]);
  });
}

async function saveSlot() {
  localStorage.setItem(slotKey(), JSON.stringify(collectData()));
  addLog("Save", `Saved slot ${selectedSlot()}`);
}

async function loadSlot() {
  const raw = localStorage.getItem(slotKey());
  if (!raw) return;
  applyData(JSON.parse(raw));
  addLog("Load", `Loaded slot ${selectedSlot()}`);
}

async function shareToRoom() {
  try {
    const current = collectData();
    const meta = await OBR.room.getMetadata();
    const existing = Array.isArray(meta?.[ROOM_KEY]) ? meta[ROOM_KEY] : [];
    const withoutSameName = existing.filter(x => (x.name || "").trim() !== (current.name || "").trim());
    await OBR.room.setMetadata({ [ROOM_KEY]: [...withoutSameName, current] });
    addLog("Room Share", "Shared current character to room records.");
    await loadRoomRecords();
  } catch {
    addLog("Room Share", "Unable to share to room.");
  }
}

async function loadRoomRecords() {
  try {
    const meta = await OBR.room.getMetadata();
    renderParty(Array.isArray(meta?.[ROOM_KEY]) ? meta[ROOM_KEY] : []);
  } catch {
    renderParty([]);
    addLog("Room Records", "Unable to load room records.");
  }
}

function renderParty(records) {
  const root = document.getElementById("partyList");
  if (!records.length) {
    root.innerHTML = `<div class="party-card"><h3>No shared records yet</h3><div class="party-meta">Use Share to Room from a character sheet.</div></div>`;
    return;
  }
  root.innerHTML = records.map((record, idx) => `
    <div class="party-card">
      <h3>${escapeHtml(record.name || "Unnamed")}</h3>
      <div class="party-meta">${escapeHtml(record.charClass || "")} • ${escapeHtml(record.race || "")} • Level ${escapeHtml(record.level || "")}</div>
      <div>HP ${escapeHtml(record.hp || "0")}/${escapeHtml(record.maxHp || "0")} • AC ${escapeHtml(record.ac || "10")} • BTH ${escapeHtml(record.bth || "0")}</div>
      <div style="margin-top:10px"><button data-party-index="${idx}">Load to Sheet</button></div>
    </div>
  `).join("");
  root.querySelectorAll("[data-party-index]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const meta = await OBR.room.getMetadata();
      const data = Array.isArray(meta?.[ROOM_KEY]) ? meta[ROOM_KEY][Number(btn.dataset.partyIndex)] : null;
      if (data) {
        applyData(data);
        addLog("Room Record", `Loaded ${data.name || "record"} to sheet.`);
      }
    });
  });
}

function exportJson() {
  const blob = new Blob([JSON.stringify(collectData(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cc-character-sheet.json";
  a.click();
  URL.revokeObjectURL(url);
  addLog("Export", "Exported character JSON.");
}

async function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  applyData(JSON.parse(await file.text()));
  addLog("Import", `Imported ${file.name}`);
  event.target.value = "";
}

function val(id) {
  return document.getElementById(id).value;
}

function setVal(id, value) {
  document.getElementById(id).value = value ?? "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
