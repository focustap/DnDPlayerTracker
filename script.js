const character = {
  name: "Jin",
  ancestry: "Human",
  className: "Wizard",
  subclass: "Bladesinger",
  level: 3,
  background: "Sage",
  leveling: "Milestone",
  baseAC: 13,
  maxHP: 20,
  tempHP: 0,
  proficiencyBonus: 2,
  initiative: 2,
  speed: 30,
  spellSaveDC: 13,
  spellAttackBonus: 5,
  abilityScores: {
    STR: { score: 8, mod: -1 },
    DEX: { score: 15, mod: 2 },
    CON: { score: 14, mod: 2 },
    INT: { score: 17, mod: 3, primary: true },
    WIS: { score: 12, mod: 1 },
    CHA: { score: 8, mod: -1 }
  },
  savingThrows: {
    STR: -1,
    DEX: 2,
    CON: 2,
    INT: 5,
    WIS: 3,
    CHA: -1
  },
  passiveScores: {
    "Passive Perception": 13,
    "Passive Insight": 15,
    "Passive Investigation": 15
  },
  bladesong: {
    maxUses: 2,
    acBonus: 3,
    speedBonus: 10,
    durationRounds: 10,
    concentrationSaveBonus: 3
  },
  shield: {
    acBonus: 5
  },
  attacks: [
    {
      name: "Main Hand Scimitar",
      bonus: 4,
      damage: "1d6 + 2 Slashing",
      properties: "Finesse, Light, Nick"
    },
    {
      name: "Off Hand Scimitar",
      bonus: 4,
      damage: "1d6 + 2 Slashing",
      properties: "Finesse, Light"
    }
  ],
  cantrips: ["Booming Blade", "Green-Flame Blade"],
  preparedSpells: ["Shield"],
  spellSlots: {
    1: 4,
    2: 2
  },
  inventory: ["Leather Armor", "Scimitar", "Scimitar", "Spellbook", "45 GP"]
};

const storageKey = "jinCompanionState.v1";

const defaultState = {
  currentHP: character.maxHP,
  tempHP: character.tempHP,
  bladesongActive: false,
  bladesongUses: character.bladesong.maxUses,
  bladesongRounds: 0,
  shieldActive: false,
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

  if (state.bladesongActive) {
    modifiers.push({ label: "Bladesong", value: character.bladesong.acBonus });
  }

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
  return character.speed + (state.bladesongActive ? character.bladesong.speedBonus : 0);
}

function speedFormula() {
  if (!state.bladesongActive) return `${character.speed} base`;
  return `${character.speed} + ${character.bladesong.speedBonus} Bladesong`;
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

function activateBladesong() {
  if (state.bladesongActive || state.bladesongUses <= 0) return;
  state.bladesongActive = true;
  state.bladesongUses -= 1;
  state.bladesongRounds = character.bladesong.durationRounds;
  addActivity("Bladesong activated");
  saveAndRender(true);
}

function endBladesong(reason = "Bladesong ended") {
  if (!state.bladesongActive) return;
  state.bladesongActive = false;
  state.bladesongRounds = 0;
  addActivity(reason);
  saveAndRender(true);
}

function toggleShield() {
  state.shieldActive = !state.shieldActive;
  addActivity(state.shieldActive ? "Shield raised" : "Shield ended");
  saveAndRender(true);
}

function nextRound() {
  if (state.shieldActive) {
    state.shieldActive = false;
    addActivity("Shield expired");
  }

  if (state.bladesongActive) {
    state.bladesongRounds = Math.max(0, state.bladesongRounds - 1);
    if (state.bladesongRounds === 0) {
      state.bladesongActive = false;
      addActivity("Bladesong expired");
    } else {
      addActivity(`Round ${character.bladesong.durationRounds - state.bladesongRounds + 1}`);
    }
  }

  saveAndRender(true);
}

function longRest() {
  const confirmed = window.confirm("Take a Long Rest? This restores HP, Bladesong uses, spell slots, and clears active effects.");
  if (!confirmed) return;

  state.currentHP = character.maxHP;
  state.tempHP = 0;
  state.bladesongActive = false;
  state.bladesongUses = character.bladesong.maxUses;
  state.bladesongRounds = 0;
  state.shieldActive = false;
  state.slotUsage = { ...defaultState.slotUsage };
  addActivity("Long Rest completed");
  saveAndRender(true);
}

function resetLocalState() {
  const confirmed = window.confirm("Reset all saved local state for Jin?");
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

function renderAbilities(targetSelector, compact = false) {
  const target = $(targetSelector);
  target.innerHTML = Object.entries(character.abilityScores).map(([name, data]) => `
    <article class="ability-tile ${data.primary ? "is-primary" : ""}">
      <span>${name}</span>
      <strong>${data.score}</strong>
      <small>${signed(data.mod)}</small>
    </article>
  `).join("");
}

function renderStatList(selector, values, enhancedKey) {
  const target = $(selector);
  target.innerHTML = Object.entries(values).map(([label, value]) => `
    <div class="stat-row ${label === enhancedKey ? "is-enhanced" : ""}">
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

function renderSpellPage() {
  $("#spellDc").textContent = character.spellSaveDC;
  $("#spellAttack").textContent = signed(character.spellAttackBonus);
  $("#cantripList").innerHTML = character.cantrips.map((spell) => `<li>${spell}</li>`).join("");
  $("#preparedSpellList").innerHTML = character.preparedSpells.map((spell) => `<li>${spell}</li>`).join("");

  $("#slotTracker").innerHTML = Object.entries(character.spellSlots).map(([level, total]) => {
    const used = state.slotUsage[level] || 0;
    const buttons = Array.from({ length: total }, (_, index) => `
      <button
        type="button"
        class="slot-button ${index < used ? "is-used" : ""}"
        data-slot-level="${level}"
        data-slot-index="${index}"
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

  $$("[data-slot-level]").forEach((button) => {
    button.addEventListener("click", () => toggleSlot(button.dataset.slotLevel, Number(button.dataset.slotIndex)));
  });
}

function renderEffects() {
  const effects = [];
  if (state.bladesongActive) {
    effects.push({ label: "Bladesong", detail: `${state.bladesongRounds} rounds`, action: "End", handler: () => endBladesong() });
  }
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
  shell.classList.toggle("is-bladesinging", state.bladesongActive);

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

  $("#bladesongState").textContent = state.bladesongActive ? "Active" : "Inactive";
  $("#bladesongUses").textContent = `${state.bladesongUses} ${state.bladesongUses === 1 ? "use" : "uses"}`;
  $("#bladesongToggle").textContent = state.bladesongActive ? "Bladesong Active" : "Activate Bladesong";
  $("#bladesongToggle").disabled = state.bladesongActive || state.bladesongUses <= 0;
  $("#roundsRemaining").textContent = state.bladesongActive ? state.bladesongRounds : "--";
  $("#shieldButton").textContent = state.shieldActive ? "End Shield" : "Cast Shield";

  const circumference = 2 * Math.PI * 50;
  const percent = state.bladesongActive ? state.bladesongRounds / character.bladesong.durationRounds : 0;
  const arc = $("#roundArc");
  arc.style.strokeDasharray = `${circumference}`;
  arc.style.strokeDashoffset = `${circumference * (1 - percent)}`;

  const displayedSaves = { ...character.savingThrows };
  if (state.bladesongActive) {
    displayedSaves.CON = `${signed(character.savingThrows.CON)} (${signed(character.savingThrows.CON + character.bladesong.concentrationSaveBonus)} concentration)`;
  }

  renderStatList("#savingThrows", displayedSaves, state.bladesongActive ? "CON" : "");
  renderStatList("#passiveScores", character.passiveScores);
  renderStatList("#abilitySaves", displayedSaves, state.bladesongActive ? "CON" : "");
  renderStatList("#abilityPassives", character.passiveScores);
  renderStatList("#coreNumbers", {
    Initiative: signed(character.initiative),
    "Proficiency Bonus": signed(character.proficiencyBonus),
    "Base Speed": `${character.speed} ft.`,
    "Current Speed": `${currentSpeed()} ft.`
  });

  $("#inventoryText").value = state.inventory;
  $("#notesText").value = state.notes;

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

  $$("[data-hp-delta]").forEach((button) => {
    button.addEventListener("click", () => setCurrentHP(state.currentHP + Number(button.dataset.hpDelta)));
  });

  $("#bladesongToggle").addEventListener("click", activateBladesong);
  $("#endBladesong").addEventListener("click", () => endBladesong());
  $("#nextRound").addEventListener("click", nextRound);
  $("#shieldButton").addEventListener("click", toggleShield);
  $("#longRestButton").addEventListener("click", longRest);
  $("#resetLayoutButton").addEventListener("click", resetLocalState);
  $("#restoreSlots").addEventListener("click", () => {
    state.slotUsage = { ...defaultState.slotUsage };
    addActivity("Spell slots restored");
    saveAndRender();
  });

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
  renderSpellPage();
  bindEvents();
  renderCore();
}

init();
