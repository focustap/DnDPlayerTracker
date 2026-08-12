const character = {
  name: "Jin Ardyn",
  ancestry: "Human",
  className: "Rogue",
  subclass: "Arcane Trickster",
  level: 3,
  background: "Sage",
  leveling: "Milestone",
  baseAC: 13,
  maxHP: 24,
  tempHP: 0,
  proficiencyBonus: 2,
  initiative: 4,
  speed: 30,
  spellSaveDC: 13,
  spellAttackBonus: 5,
  sneakAttack: "2d6",
  abilityScores: {
    STR: { score: 8, mod: -1 },
    DEX: { score: 15, mod: 2, primary: true },
    CON: { score: 15, mod: 2 },
    INT: { score: 17, mod: 3, primary: true },
    WIS: { score: 10, mod: 0 },
    CHA: { score: 8, mod: -1 }
  },
  savingThrows: {
    STR: -1,
    DEX: 4,
    CON: 2,
    INT: 5,
    WIS: 0,
    CHA: -1
  },
  passiveScores: {
    "Passive Perception": 12,
    "Passive Insight": 10,
    "Passive Investigation": 15
  },
  shield: {
    acBonus: 5
  },
  attacks: [
    {
      name: "Scimitar",
      bonus: 4,
      damage: "1d6 + 2 Slashing",
      properties: "Finesse, Light, Nick mastery"
    },
    {
      name: "Second Scimitar",
      bonus: 4,
      damage: "1d6 + 2 Slashing",
      properties: "Finesse, Light, Nick"
    },
    {
      name: "Shortbow",
      bonus: 4,
      damage: "1d6 + 2 Piercing",
      properties: "Ranged, Vex mastery"
    }
  ],
  cantrips: ["Minor Illusion", "Green-Flame Blade", "True Strike", "Booming Blade"],
  preparedSpells: ["Shield", "Silent Image", "Silvery Barbs"],
  spellSlots: {
    1: 2
  },
  inventory: ["Leather Armor", "Scimitar", "Scimitar", "Shortbow", "Spellbook", "45 GP"]
};

const storageKey = "jinArdynRogueTracker.v1";

const defaultState = {
  currentHP: character.maxHP,
  tempHP: character.tempHP,
  shieldActive: false,
  sneakAttackAvailable: true,
  cunningActionUsed: "",
  slotUsage: Object.fromEntries(Object.entries(character.spellSlots).map(([level]) => [level, 0])),
  inventory: character.inventory.join("\n"),
  notes: "",
  activity: ["Ready for the session"]
};

let state = loadState();

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return { ...defaultState, ...saved, slotUsage: { ...defaultState.slotUsage, ...(saved?.slotUsage || {}) } };
  } catch {
    return { ...defaultState };
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function signed(value) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function clamp(number, min, max) {
  return Math.min(Math.max(number, min), max);
}

function activeACModifiers() {
  const modifiers = [];

  if (state.shieldActive) {
    modifiers.push({ label: "Shield", value: character.shield.acBonus });
  }

  return modifiers;
}

function currentAC() {
  return character.baseAC + activeACModifiers().reduce((total, effect) => total + effect.value, 0);
}

function acFormula() {
  const modifiers = activeACModifiers();
  if (!modifiers.length) return `${character.baseAC} base`;

  return `${character.baseAC} + ${modifiers.map((effect) => `${effect.value} ${effect.label}`).join(" + ")} = ${currentAC()}`;
}

function currentSpeed() {
  return character.speed;
}

function speedFormula() {
  return `${character.speed} base`;
}

function slotsRemaining(level = "1") {
  const total = character.spellSlots[level] || 0;
  const used = state.slotUsage[level] || 0;
  return `${total - used}/${total}`;
}

function addActivity(text) {
  state.activity = [text, ...state.activity.filter((item) => item !== text)].slice(0, 5);
}

function setCurrentHP(value, allowAboveMax = false) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return;
  state.currentHP = allowAboveMax ? Math.max(0, parsed) : clamp(parsed, 0, character.maxHP);
  saveAndRender();
}

function setTempHP(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return;
  state.tempHP = Math.max(0, parsed);
  saveAndRender();
}

function applyHPAdjustment(direction) {
  const amount = Math.max(0, Number($("#hpAdjustAmount").value) || 0);
  if (!amount) return;

  if (direction === "damage") {
    state.currentHP = clamp(state.currentHP - amount, 0, character.maxHP);
    addActivity(`${amount} damage taken`);
  } else {
    state.currentHP = clamp(state.currentHP + amount, 0, character.maxHP);
    addActivity(`${amount} HP healed`);
  }

  saveAndRender();
}

function toggleShield() {
  state.shieldActive = !state.shieldActive;
  addActivity(state.shieldActive ? "Shield raised" : "Shield ended");
  saveAndRender(true);
}

function useSneakAttack() {
  if (!state.sneakAttackAvailable) return;
  state.sneakAttackAvailable = false;
  addActivity("Sneak Attack used");
  saveAndRender();
}

function setCunningAction(action) {
  state.cunningActionUsed = state.cunningActionUsed === action ? "" : action;
  addActivity(state.cunningActionUsed ? `${action} used` : "Cunning Action cleared");
  saveAndRender();
}

function nextRound() {
  if (state.shieldActive) {
    state.shieldActive = false;
    addActivity("Shield expired");
  }

  state.sneakAttackAvailable = true;
  state.cunningActionUsed = "";
  addActivity("Turn reset");
  saveAndRender(true);
}

function longRest() {
  const confirmed = window.confirm("Take a Long Rest? This restores HP, spell slots, turn resources, and clears active effects.");
  if (!confirmed) return;

  state.currentHP = character.maxHP;
  state.tempHP = 0;
  state.shieldActive = false;
  state.sneakAttackAvailable = true;
  state.cunningActionUsed = "";
  state.slotUsage = { ...defaultState.slotUsage };
  addActivity("Long Rest completed");
  saveAndRender(true);
}

function resetLocalState() {
  const confirmed = window.confirm("Reset all saved local state for Jin Ardyn?");
  if (!confirmed) return;
  state = { ...defaultState, slotUsage: { ...defaultState.slotUsage } };
  saveAndRender(true);
}

function toggleSlot(level, index) {
  const used = state.slotUsage[level] || 0;
  state.slotUsage[level] = index < used ? index : index + 1;
  addActivity(`Level ${level} slots updated`);
  saveAndRender();
}

function restoreSlots() {
  state.slotUsage = { ...defaultState.slotUsage };
  addActivity("Spell slots restored");
  saveAndRender();
}

function renderAbilities(targetSelector) {
  const target = $(targetSelector);
  target.innerHTML = Object.entries(character.abilityScores).map(([name, data]) => `
    <article class="ability-tile ${data.primary ? "is-primary" : ""}">
      <span>${name}</span>
      <strong>${data.score}</strong>
      <small>${signed(data.mod)}</small>
    </article>
  `).join("");
}

function renderStatList(selector, values) {
  const target = $(selector);
  target.innerHTML = Object.entries(values).map(([label, value]) => `
    <div class="stat-row">
      <span>${label}</span>
      <strong>${typeof value === "number" ? signed(value) : value}</strong>
    </div>
  `).join("");
}

function renderAttacks() {
  $("#attackList").innerHTML = character.attacks.map((attack) => `
    <article class="attack-item">
      <div>
        <h3>${attack.name}</h3>
        <p>${attack.damage}</p>
        <small>${attack.properties}</small>
      </div>
      <strong class="attack-bonus">${signed(attack.bonus)}</strong>
    </article>
  `).join("");

  $("#quickCantrips").innerHTML = character.cantrips.map((spell) => `<span class="pill">${spell}</span>`).join("");
}

function slotTrackerMarkup(source) {
  return Object.entries(character.spellSlots).map(([level, total]) => {
    const used = state.slotUsage[level] || 0;
    const buttons = Array.from({ length: total }, (_, index) => `
      <button
        type="button"
        class="slot-button ${index < used ? "is-used" : ""}"
        data-slot-level="${level}"
        data-slot-index="${index}"
        data-slot-source="${source}"
        aria-label="Toggle level ${level} spell slot ${index + 1}">
      </button>
    `).join("");

    return `
      <div class="slot-row">
        <strong>Level ${level}</strong>
        <div class="slot-buttons">${buttons}</div>
      </div>
    `;
  }).join("");
}

function bindSlotButtons() {
  $$("[data-slot-level]").forEach((button) => {
    button.addEventListener("click", () => toggleSlot(button.dataset.slotLevel, Number(button.dataset.slotIndex)));
  });
}

function renderSpellPage() {
  $("#spellDc").textContent = character.spellSaveDC;
  $("#spellAttack").textContent = signed(character.spellAttackBonus);
  $("#cantripList").innerHTML = character.cantrips.map((spell) => `<li>${spell}</li>`).join("");
  $("#preparedSpellList").innerHTML = character.preparedSpells.map((spell) => `<li>${spell}</li>`).join("");
  $("#slotTracker").innerHTML = slotTrackerMarkup("spells");
  bindSlotButtons();
}

function renderRoguePanel() {
  $("#sneakAttackDice").textContent = character.sneakAttack;
  $("#sneakAttackState").textContent = state.sneakAttackAvailable ? "Available this turn" : "Used this turn";
  $("#sneakAttackState").classList.toggle("is-unavailable", !state.sneakAttackAvailable);
  $("#sneakAttackButton").disabled = !state.sneakAttackAvailable;
  $("#sneakAttackButton").textContent = state.sneakAttackAvailable ? "Mark Sneak Attack Used" : "Sneak Attack Used";

  $$("#cunningActions [data-cunning-action]").forEach((button) => {
    button.classList.toggle("is-used", state.cunningActionUsed === button.dataset.cunningAction);
  });

  $("#railSpellDc").textContent = character.spellSaveDC;
  $("#railSpellAttack").textContent = signed(character.spellAttackBonus);
  $("#railSpellSlots").textContent = slotsRemaining("1").replace("/", " / ");
  $("#railSlotTracker").innerHTML = slotTrackerMarkup("rail");
  bindSlotButtons();
}

function renderEffects() {
  const effects = [];
  if (state.shieldActive) {
    effects.push({ label: "Shield", detail: "+5 AC", action: "End", handler: toggleShield });
  }

  const target = $("#activeEffects");
  target.innerHTML = effects.length ? "" : `<p class="helper">No active effects.</p>`;

  effects.forEach((effect) => {
    const chip = document.createElement("div");
    chip.className = "effect-chip";
    chip.innerHTML = `<span><strong>${effect.label}</strong> ${effect.detail}</span><button type="button">${effect.action}</button>`;
    chip.querySelector("button").addEventListener("click", effect.handler);
    target.appendChild(chip);
  });
}

function renderActivity() {
  $("#activityLog").innerHTML = state.activity.map((item, index) => `
    <li><span>${item}</span><small>${index === 0 ? "Now" : "Earlier"}</small></li>
  `).join("");
}

function renderCore() {
  const shell = $(".arcane-shell");
  shell.classList.toggle("is-arcane-ready", state.sneakAttackAvailable);

  $("#armorClass").textContent = currentAC();
  $("#acFormula").textContent = acFormula();
  $("#currentHp").value = state.currentHP;
  $("#maxHp").textContent = character.maxHP;
  $("#tempHp").value = state.tempHP;
  $("#hpBar").style.width = `${clamp((state.currentHP / character.maxHP) * 100, 0, 100)}%`;
  $("#initiative").textContent = signed(character.initiative);
  $("#speed").textContent = currentSpeed();
  $("#speedFormula").textContent = speedFormula();
  $("#proficiency").textContent = signed(character.proficiencyBonus);
  $("#shieldButton").textContent = state.shieldActive ? "End Shield" : "Cast Shield";
  $("#overviewSneakAttack").textContent = character.sneakAttack;
  $("#overviewSneakState").textContent = state.sneakAttackAvailable ? "Available" : "Used this turn";
  $("#overviewSpellSlots").textContent = slotsRemaining("1");

  renderStatList("#savingThrows", character.savingThrows);
  renderStatList("#passiveScores", character.passiveScores);
  renderStatList("#abilitySaves", character.savingThrows);
  renderStatList("#abilityPassives", character.passiveScores);
  renderStatList("#coreNumbers", {
    Initiative: signed(character.initiative),
    "Proficiency Bonus": signed(character.proficiencyBonus),
    "Base Speed": `${character.speed} ft.`,
    "Current Speed": `${currentSpeed()} ft.`,
    "Sneak Attack": character.sneakAttack
  });

  $("#inventoryText").value = state.inventory;
  $("#notesText").value = state.notes;

  renderSpellPage();
  renderRoguePanel();
  renderEffects();
  renderActivity();
}

function saveAndRender(bumpAC = false) {
  saveState();
  renderCore();

  if (bumpAC) {
    const ac = $("#armorClass");
    ac.classList.remove("bump");
    requestAnimationFrame(() => {
      ac.classList.add("bump");
      window.setTimeout(() => ac.classList.remove("bump"), 220);
    });
  }
}

function bindEvents() {
  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      const page = button.dataset.pageTarget;
      $$(".nav-item").forEach((item) => item.classList.toggle("is-active", item === button));
      $$(".page").forEach((panel) => panel.classList.toggle("is-visible", panel.dataset.page === page));
      $(".arcane-shell").dataset.page = page;
    });
  });

  $("#hpMinus").addEventListener("click", () => setCurrentHP(state.currentHP - 1));
  $("#hpPlus").addEventListener("click", () => setCurrentHP(state.currentHP + 1));
  $("#currentHp").addEventListener("change", (event) => setCurrentHP(event.target.value, true));
  $("#tempHp").addEventListener("change", (event) => setTempHP(event.target.value));
  $("#damageButton").addEventListener("click", () => applyHPAdjustment("damage"));
  $("#healButton").addEventListener("click", () => applyHPAdjustment("heal"));

  $("#sneakAttackButton").addEventListener("click", useSneakAttack);
  $$("#cunningActions [data-cunning-action]").forEach((button) => {
    button.addEventListener("click", () => setCunningAction(button.dataset.cunningAction));
  });

  $("#nextRound").addEventListener("click", nextRound);
  $("#shieldButton").addEventListener("click", toggleShield);
  $("#longRestButton").addEventListener("click", longRest);
  $("#resetLayoutButton").addEventListener("click", resetLocalState);
  $("#restoreSlots").addEventListener("click", restoreSlots);
  $("#restoreRailSlots").addEventListener("click", restoreSlots);

  $("#inventoryText").addEventListener("input", (event) => {
    state.inventory = event.target.value;
    saveState();
  });

  $("#notesText").addEventListener("input", (event) => {
    state.notes = event.target.value;
    saveState();
  });
}

function init() {
  renderAbilities("#abilityStrip");
  renderAbilities("#abilityCards");
  renderAttacks();
  bindEvents();
  renderCore();
}

init();
