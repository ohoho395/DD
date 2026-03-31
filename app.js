const STORAGE_KEY = "palworldDexHelper:v20260331g";
const data = mergePalworldData(window.PALWORLD_DATA, window.PALWORLD_SYNC_DATA);
const persistedState = loadPersistedState();

if (!data) {
  throw new Error("PALWORLD_DATA 未加载成功。");
}

const state = {
  view: "dex",
  selectedPalCode: data.pals[0]?.code || "",
  dexSearch: "",
  dexJob: "all",
  dexStage: "all",
  dexNightOnly: false,
  workerJob: "Handiwork",
  workerStage: "all",
  workerNightOnly: false,
  breedingChildCode: persistedState.breedingChildCode || data.featuredTargets[0]?.code || data.pals[0]?.code || "",
  breedingParent1: persistedState.breedingParent1 || data.pals[0]?.code || "",
  breedingParent2: persistedState.breedingParent2 || data.pals[1]?.code || data.pals[0]?.code || "",
  breedingChildSort: persistedState.breedingChildSort || "ease",
  breedingPairSort: persistedState.breedingPairSort || "stage",
  favoriteCombos: Array.isArray(persistedState.favoriteCombos) ? persistedState.favoriteCombos : [],
  recentPairs: Array.isArray(persistedState.recentPairs) ? persistedState.recentPairs : [],
  traitTargetText: persistedState.traitTargetText || "",
  traitParent1Text: persistedState.traitParent1Text || "",
  traitParent2Text: persistedState.traitParent2Text || "",
  traitGoal: persistedState.traitGoal || "four",
  traitRole: persistedState.traitRole || "worker",
  mapModeByPal: {},
  syncServiceAvailable: false,
  syncInFlight: false,
  lastServerSyncedAt: data.syncMeta?.syncedAt || "",
  hasTriggeredAutoRefresh: false,
};

const refs = {};
const jobsByKey = new Map(data.jobs.map((job) => [job.key, job]));
const palsByCode = new Map(data.pals.map((pal) => [pal.code, pal]));
const DEFAULT_SYNC_SERVICE_ORIGIN = "http://127.0.0.1:8765";
const FALLBACK_SYNC_SERVICE_ORIGIN = "http://localhost:8765";
const FAVORITE_COMBO_LIMIT = 24;
const RECENT_PAIR_LIMIT = 12;
const TRAIT_GOAL_SLOT_COUNTS = {
  two: 2,
  three: 3,
  four: 4,
};
const SPAWN_SOURCE_LABELS = {
  "帕鲁中介 DarkIsland": "帕鲁征募员·暗岛地带",
  "帕鲁中介 Desert Snow": "帕鲁征募员·雪漠地带",
  "帕鲁中介 Forest Volcano": "帕鲁征募员·森火地带",
  "帕鲁中介 Grass": "帕鲁征募员·草原地带",
  "帕鲁中介 Sakurajima": "帕鲁征募员·樱岛地带",
  "袭击": "据点袭击事件",
};
const ELEMENT_LABELS = {
  Neutral: "无属性",
  Fire: "火",
  Water: "水",
  Grass: "草",
  Electric: "雷",
  Ice: "冰",
  Ground: "地",
  Dark: "暗",
  Dragon: "龙",
  "无属性": "无属性",
  "火属性": "火",
  "水属性": "水",
  "草属性": "草",
  "雷属性": "雷",
  "冰属性": "冰",
  "地属性": "地",
  "暗属性": "暗",
  "龙属性": "龙",
};
const ITEM_LABELS = {
  Wool: "羊毛",
  "Lamball Mutton": "棉悠悠肉",
  "棉悠悠的羊肉": "棉悠悠肉",
  "帕鲁的体液": "帕鲁体液",
  "优质的布": "优质布",
  "严冬鹿的鹿肉": "严冬鹿肉",
  "企丸王的羽饰": "企丸王羽饰",
  "勾魂鱿的触手": "勾魂鱿触手",
  "叶泥泥的叶子": "叶泥泥叶片",
  "墨沫姬的章鱼足": "墨沫姬章鱼足",
  "天擒鸟的鸟肉": "天擒鸟肉",
  "姬小兔的发带": "姬小兔发带",
  "暗巫猫的体毛": "暗巫猫体毛",
  "朋克蜥的头冠": "朋克蜥头冠",
  "森猛犸的巨兽肉": "森猛犸肉",
  "毛掸儿的棉毛": "毛掸儿棉毛",
  "水灵儿的鱼肉": "水灵儿鱼肉",
  "波霸牛的牛肉": "波霸牛肉",
  "海月仙的水母伞": "海月仙水母伞",
  "海月灵的水母伞": "海月灵水母伞",
  "灌木羊的香草肉": "灌木羊肉",
  "炸蛋鸟的羽毛": "炸蛋鸟羽毛",
  "皮皮鸡的鸡肉": "皮皮鸡肉",
  "紫霞鹿的鹿肉": "紫霞鹿肉",
  "肚肚鳄的鳄鱼肉": "肚肚鳄肉",
  "草莽猪的猪肉": "草莽猪肉",
  "趴趴鲶的鱼肉": "趴趴鲶鱼肉",
  "连理龙的恐龙肉": "连理龙肉",
  "雷鸣童子的云朵": "雷鸣童子云团",
  Milk: "牛奶",
  Egg: "蛋",
  Honey: "蜂蜜",
  Leather: "皮革",
  Bone: "骨头",
  Horn: "角",
};
const PARTNER_SKILL_TITLE_LABELS = {
  "Fluffy Shield": "茸茸护盾",
  "Guardian of the Desert": "荒漠守护者",
  "Floral Boost": "花语增幅",
};
const PARTNER_SKILL_DESCRIPTION_LABELS = {
  "When activated, equips to the player and becomes a shield. Sometimes drops Wool when assigned to Ranch .":
    "发动后，会附着在玩家身上并化为护盾。分配到牧场时，有概率掉落羊毛。",
  "When activated, equips to the player and becomes a shield. Sometimes drops Wool when assigned to Ranch.":
    "发动后，会附着在玩家身上并化为护盾。分配到牧场时，有概率掉落羊毛。",
};
const TEXT_REPLACEMENTS = [
  ["Pal Recruiter ", "帕鲁征募员·"],
  ["帕鲁中介 ", "帕鲁中介·"],
  ["DarkIsland", "暗岛"],
  ["Desert Snow", "雪漠"],
  ["Forest Volcano", "森火"],
  ["Sakurajima", "樱岛"],
  ["Grass", "草原"],
  ["家畜牧场", "牧场"],
  ["Ranch", "牧场"],
  ["Wool", "羊毛"],
  ["Lamball Mutton", "棉悠悠肉"],
];
const TRAIT_PRESETS = [
  { label: "打工毕业", role: "worker", goal: "four", traits: ["工匠精神", "社畜", "认真", "节食"] },
  { label: "打工前期", role: "worker", goal: "two", traits: ["工匠精神", "认真"] },
  { label: "战斗毕业", role: "combat", goal: "four", traits: ["传说", "凶猛", "脑筋", "幸运"] },
  { label: "坐骑毕业", role: "mount", goal: "four", traits: ["神速", "运动健将", "灵活", "传说"] },
  { label: "通用三词条", role: "general", goal: "three", traits: ["传说", "凶猛", "幸运"] },
];
const TRAIT_ROLE_HINTS = {
  worker: "打工向建议先凑齐目标词条覆盖，再慢慢清掉杂词条。",
  combat: "战斗向不必一开始就硬冲四词条，先做出 2 到 3 个核心词条会更省时间。",
  mount: "坐骑向最看重干净词条，尽量让每只亲本各自只带 1 到 2 个目标词条。",
  general: "通用向可以先做过渡体，把最关键的 2 到 3 个词条稳住，再继续毕业。",
};

normalizeStateSelections();

document.addEventListener("DOMContentLoaded", () => {
  collectRefs();
  bindEvents();
  populateStaticUI();
  initSyncControls();
  try {
    renderAll();
  } catch (error) {
    console.error("renderAll failed", error);
  }
});

function collectRefs() {
  refs.metaPalCount = document.getElementById("meta-pal-count");
  refs.metaBreedCount = document.getElementById("meta-breed-count");
  refs.metaVersion = document.getElementById("meta-version");
  refs.metaSyncStatus = document.getElementById("meta-sync-status");
  refs.syncButton = document.getElementById("sync-button");
  refs.syncHelp = document.getElementById("sync-help");
  refs.syncLog = document.getElementById("sync-log");
  refs.syncProgressSummary = document.getElementById("sync-progress-summary");
  refs.syncProgressFill = document.getElementById("sync-progress-fill");
  refs.syncStageList = document.getElementById("sync-stage-list");

  refs.tabButtons = [...document.querySelectorAll(".tab-button")];
  refs.views = [...document.querySelectorAll(".view")];

  refs.dexSearch = document.getElementById("dex-search");
  refs.dexJobFilter = document.getElementById("dex-job-filter");
  refs.dexStageFilter = document.getElementById("dex-stage-filter");
  refs.dexNightFilter = document.getElementById("dex-night-filter");
  refs.dexList = document.getElementById("dex-list");
  refs.dexCountBadge = document.getElementById("dex-count-badge");
  refs.palDetail = document.getElementById("pal-detail");

  refs.workerJobFilter = document.getElementById("worker-job-filter");
  refs.workerStageFilter = document.getElementById("worker-stage-filter");
  refs.workerNightFilter = document.getElementById("worker-night-filter");
  refs.workerRankingNote = document.getElementById("worker-ranking-note");
  refs.workerResults = document.getElementById("worker-results");
  refs.farmSpecialists = document.getElementById("farm-specialists");
  refs.workTips = document.getElementById("work-tips");

  refs.breedingChildSelect = document.getElementById("breeding-child-select");
  refs.breedingChildSort = document.getElementById("breeding-child-sort");
  refs.featuredTargets = document.getElementById("featured-targets");
  refs.breedingChildResults = document.getElementById("breeding-child-results");
  refs.breedingParent1 = document.getElementById("breeding-parent-1");
  refs.breedingParent2 = document.getElementById("breeding-parent-2");
  refs.breedingPairSort = document.getElementById("breeding-pair-sort");
  refs.breedingPairResults = document.getElementById("breeding-pair-results");
  refs.favoriteCombos = document.getElementById("favorite-combos");
  refs.recentPairs = document.getElementById("recent-pairs");
  refs.clearFavorites = document.getElementById("clear-favorites");
  refs.clearRecents = document.getElementById("clear-recents");

  refs.traitTargetInput = document.getElementById("trait-target-input");
  refs.traitParent1Input = document.getElementById("trait-parent1-input");
  refs.traitParent2Input = document.getElementById("trait-parent2-input");
  refs.traitGoalSelect = document.getElementById("trait-goal-select");
  refs.traitRoleSelect = document.getElementById("trait-role-select");
  refs.traitSwapButton = document.getElementById("trait-swap-button");
  refs.traitClearButton = document.getElementById("trait-clear-button");
  refs.traitPresetList = document.getElementById("trait-preset-list");
  refs.traitGuideSummary = document.getElementById("trait-guide-summary");
  refs.traitGuideSteps = document.getElementById("trait-guide-steps");

  refs.sourceList = document.getElementById("source-list");
}

function bindEvents() {
  refs.tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      renderViewState();
    });
  });

  refs.dexSearch.addEventListener("input", (event) => {
    state.dexSearch = event.target.value.trim();
    renderDex();
  });

  refs.dexJobFilter.addEventListener("change", (event) => {
    state.dexJob = event.target.value;
    renderDex();
  });

  refs.dexStageFilter.addEventListener("change", (event) => {
    state.dexStage = event.target.value;
    renderDex();
  });

  refs.dexNightFilter.addEventListener("change", (event) => {
    state.dexNightOnly = event.target.checked;
    renderDex();
  });

  refs.workerJobFilter.addEventListener("change", (event) => {
    state.workerJob = event.target.value;
    renderWorkers();
  });

  refs.workerStageFilter.addEventListener("change", (event) => {
    state.workerStage = event.target.value;
    renderWorkers();
  });

  refs.workerNightFilter.addEventListener("change", (event) => {
    state.workerNightOnly = event.target.checked;
    renderWorkers();
  });

  refs.breedingChildSelect.addEventListener("change", (event) => {
    state.breedingChildCode = event.target.value;
    renderBreeding();
  });

  refs.breedingChildSort.addEventListener("change", (event) => {
    state.breedingChildSort = event.target.value;
    persistLocalState();
    renderBreeding();
  });

  refs.breedingParent1.addEventListener("change", (event) => {
    state.breedingParent1 = event.target.value;
    rememberRecentPair(state.breedingParent1, state.breedingParent2);
    persistLocalState();
    renderBreeding();
  });

  refs.breedingParent2.addEventListener("change", (event) => {
    state.breedingParent2 = event.target.value;
    rememberRecentPair(state.breedingParent1, state.breedingParent2);
    persistLocalState();
    renderBreeding();
  });

  refs.breedingPairSort.addEventListener("change", (event) => {
    state.breedingPairSort = event.target.value;
    persistLocalState();
    renderBreeding();
  });

  refs.clearFavorites.addEventListener("click", () => {
    state.favoriteCombos = [];
    persistLocalState();
    renderBreeding();
  });

  refs.clearRecents.addEventListener("click", () => {
    state.recentPairs = [];
    persistLocalState();
    renderBreeding();
  });

  refs.traitTargetInput.addEventListener("input", (event) => {
    state.traitTargetText = event.target.value;
    persistLocalState();
    renderTraitGuide();
  });

  refs.traitParent1Input.addEventListener("input", (event) => {
    state.traitParent1Text = event.target.value;
    persistLocalState();
    renderTraitGuide();
  });

  refs.traitParent2Input.addEventListener("input", (event) => {
    state.traitParent2Text = event.target.value;
    persistLocalState();
    renderTraitGuide();
  });

  refs.traitGoalSelect.addEventListener("change", (event) => {
    state.traitGoal = event.target.value;
    persistLocalState();
    renderTraitGuide();
  });

  refs.traitRoleSelect.addEventListener("change", (event) => {
    state.traitRole = event.target.value;
    persistLocalState();
    renderTraitGuide();
  });

  refs.traitSwapButton.addEventListener("click", () => {
    const nextParent1 = state.traitParent2Text;
    const nextParent2 = state.traitParent1Text;
    state.traitParent1Text = nextParent1;
    state.traitParent2Text = nextParent2;
    refs.traitParent1Input.value = state.traitParent1Text;
    refs.traitParent2Input.value = state.traitParent2Text;
    persistLocalState();
    renderTraitGuide();
  });

  refs.traitClearButton.addEventListener("click", () => {
    state.traitTargetText = "";
    state.traitParent1Text = "";
    state.traitParent2Text = "";
    state.traitGoal = "four";
    state.traitRole = "worker";
    refs.traitTargetInput.value = "";
    refs.traitParent1Input.value = "";
    refs.traitParent2Input.value = "";
    refs.traitGoalSelect.value = state.traitGoal;
    refs.traitRoleSelect.value = state.traitRole;
    persistLocalState();
    renderTraitGuide();
  });
}

function populateStaticUI() {
  refs.metaPalCount.textContent = String(data.meta.palCount);
  refs.metaBreedCount.textContent = String(data.meta.breedingComboCount);
  refs.metaVersion.textContent = data.meta.gameDataVersion;
  refs.metaSyncStatus.textContent = formatSyncStamp(data.syncMeta?.syncedAt) || "未同步";

  refs.dexJobFilter.innerHTML = [
    `<option value="all">全部岗位</option>`,
    ...data.jobs.map((job) => `<option value="${escapeHtml(job.key)}">${escapeHtml(job.label)}</option>`),
  ].join("");

  const stageOptionsHtml = data.stageOptions
    .map((option) => `<option value="${escapeHtml(option.key)}">${escapeHtml(option.label)}</option>`)
    .join("");

  refs.dexStageFilter.innerHTML = stageOptionsHtml;
  refs.workerStageFilter.innerHTML = stageOptionsHtml;
  refs.workerJobFilter.innerHTML = data.jobs
    .map((job) => `<option value="${escapeHtml(job.key)}">${escapeHtml(job.label)}</option>`)
    .join("");

  const palOptions = data.pals
    .map((pal) => `<option value="${escapeHtml(pal.code)}">${escapeHtml(pal.displayNo)} ${escapeHtml(pal.nameZh)}</option>`)
    .join("");

  refs.breedingChildSelect.innerHTML = palOptions;
  refs.breedingParent1.innerHTML = palOptions;
  refs.breedingParent2.innerHTML = palOptions;

  refs.dexSearch.value = state.dexSearch;
  refs.dexJobFilter.value = state.dexJob;
  refs.dexStageFilter.value = state.dexStage;
  refs.dexNightFilter.checked = state.dexNightOnly;
  refs.workerJobFilter.value = state.workerJob;
  refs.workerStageFilter.value = state.workerStage;
  refs.workerNightFilter.checked = state.workerNightOnly;
  refs.breedingChildSelect.value = state.breedingChildCode;
  refs.breedingChildSort.value = state.breedingChildSort;
  refs.breedingParent1.value = state.breedingParent1;
  refs.breedingParent2.value = state.breedingParent2;
  refs.breedingPairSort.value = state.breedingPairSort;
  refs.traitTargetInput.value = state.traitTargetText;
  refs.traitParent1Input.value = state.traitParent1Text;
  refs.traitParent2Input.value = state.traitParent2Text;
  refs.traitGoalSelect.value = state.traitGoal;
  refs.traitRoleSelect.value = state.traitRole;

  refs.featuredTargets.innerHTML = data.featuredTargets
    .map(
      (target) => `
        <button class="chip-button ${target.code === state.breedingChildCode ? "active" : ""}" type="button" data-child-code="${escapeHtml(target.code)}">
          ${escapeHtml(target.nameZh)}
        </button>
      `
    )
    .join("");

  refs.featuredTargets.querySelectorAll("[data-child-code]").forEach((button) => {
    button.addEventListener("click", () => {
      state.breedingChildCode = button.dataset.childCode;
      refs.breedingChildSelect.value = state.breedingChildCode;
      populateStaticUI();
      persistLocalState();
      renderBreeding();
    });
  });

  refs.traitPresetList.innerHTML = TRAIT_PRESETS
    .map(
      (preset) => `
        <button
          class="chip-button"
          type="button"
          data-trait-preset="${escapeAttribute(preset.label)}"
        >${escapeHtml(preset.label)}</button>
      `
    )
    .join("");

  refs.traitPresetList.querySelectorAll("[data-trait-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const preset = TRAIT_PRESETS.find((item) => item.label === button.dataset.traitPreset);
      if (!preset) {
        return;
      }
      state.traitTargetText = preset.traits.join("，");
      state.traitRole = preset.role;
      state.traitGoal = preset.goal;
      refs.traitTargetInput.value = state.traitTargetText;
      refs.traitRoleSelect.value = state.traitRole;
      refs.traitGoalSelect.value = state.traitGoal;
      persistLocalState();
      renderTraitGuide();
    });
  });

  refs.sourceList.innerHTML = data.sources
    .map(
      (source) => `
        <article class="source-item">
          <strong>${escapeHtml(source.label)}</strong>
          <p><a href="${escapeAttribute(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.url)}</a></p>
        </article>
      `
    )
    .join("");
}

function renderAll() {
  renderViewState();
  renderDex();
  renderWorkers();
  renderBreeding();
  renderTraitGuide();
}

function renderViewState() {
  refs.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });
  refs.views.forEach((view) => {
    view.classList.toggle("active", view.id === `view-${state.view}`);
  });
}

function renderDex() {
  const filtered = data.pals.filter((pal) => {
    const search = state.dexSearch.toLowerCase();
    const haystack = [pal.nameZh, pal.nameEn, pal.displayNo, pal.internalName, pal.code].join(" ").toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    const matchesJob = state.dexJob === "all" || (pal.work[state.dexJob] || 0) > 0;
    const matchesStage = state.dexStage === "all" || pal.stageKey === state.dexStage;
    const matchesNight = !state.dexNightOnly || pal.nocturnal;
    return matchesSearch && matchesJob && matchesStage && matchesNight;
  });

  if (!filtered.some((pal) => pal.code === state.selectedPalCode)) {
    state.selectedPalCode = filtered[0]?.code || "";
  }

  refs.dexCountBadge.textContent = `${filtered.length} 条`;

  if (filtered.length === 0) {
    refs.dexList.innerHTML = `<div class="list-empty">没有匹配的帕鲁，换个关键词试试。</div>`;
    refs.palDetail.innerHTML = `<div class="detail-empty">当前筛选条件下没有结果。</div>`;
    return;
  }

  refs.dexList.innerHTML = filtered
    .map((pal) => {
      const active = pal.code === state.selectedPalCode ? "active" : "";
      return `
        <article class="pal-card ${active}" data-pal-code="${escapeHtml(pal.code)}">
          <div class="pal-card-body">
            ${palImage(pal, "thumb")}
            <div class="title-block">
              <div class="pal-card-title">
                <div>
                  <strong>${escapeHtml(pal.displayNo)} ${escapeHtml(pal.nameZh)}</strong>
                  ${renderEnglishNameMeta(pal)}
                </div>
                <span class="badge">${escapeHtml(pal.stageLabel)}</span>
              </div>
              <div class="tag-row">
                ${pal.nocturnal ? `<span class="tag">夜行</span>` : `<span class="tag">日行</span>`}
                ${renderElementTags(pal, 2)}
                ${pal.workSummary.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  refs.dexList.querySelectorAll("[data-pal-code]").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedPalCode = card.dataset.palCode;
      renderDex();
    });
  });

  const selectedPal = palsByCode.get(state.selectedPalCode) || filtered[0];
  refs.palDetail.innerHTML = renderPalDetail(selectedPal);

  const breedingLink = document.getElementById("jump-to-breeding");
  if (breedingLink) {
    breedingLink.addEventListener("click", () => {
      state.view = "breeding";
      state.breedingChildCode = selectedPal.code;
      refs.breedingChildSelect.value = selectedPal.code;
      populateStaticUI();
      renderViewState();
      renderBreeding();
    });
  }

  bindOpenPalButtons(refs.palDetail);
  bindMapToggle(refs.palDetail, selectedPal);
}

function renderPalDetail(pal) {
  const primaryJobs = sortJobsByLevel(pal).slice(0, 6);
  const specialNote = pal.note ? `<p class="detail-copy">${escapeHtml(pal.note)}</p>` : "";
  const extraCards = [renderSpawnCard(pal), renderDropCard(pal)].filter(Boolean).join("");

  return `
    <div class="pal-detail-shell">
      <div class="pal-title">
        <div class="media-row start">
          ${palImage(pal, "thumb-lg", "eager")}
          <div class="title-block">
            <div class="tag-row">
              <span class="tag">${escapeHtml(pal.displayNo)}</span>
              <span class="tag">${escapeHtml(pal.stageLabel)}</span>
              <span class="tag">${pal.nocturnal ? "夜行" : "日行"}</span>
              <span class="tag">稀有度 ${pal.rarity}</span>
              <span class="tag">尺寸 ${escapeHtml(pal.size)}</span>
              ${renderElementTags(pal)}
            </div>
            <h2>${escapeHtml(pal.nameZh)}</h2>
            <small>${renderDetailNameMeta(pal)}</small>
            ${specialNote}
          </div>
        </div>
      </div>

      <div class="info-grid">
        ${renderHabitatCard(pal)}

        <article class="info-card">
          <h3>基础面板</h3>
          <div class="tag-row">
            <span class="tag">HP ${pal.stats.hp}</span>
            <span class="tag">攻击 ${pal.stats.attack}</span>
            <span class="tag">防御 ${pal.stats.defense}</span>
            <span class="tag">食量 ${pal.foodAmount}</span>
            <span class="tag">搬运速度 ${pal.transportSpeed}</span>
            <span class="tag">配种值 ${pal.breedingPower}</span>
          </div>
          <p class="detail-copy">${
            pal.minWildLevel == null || pal.maxWildLevel == null
              ? "普通野外等级未收录，更适合走特殊刷新、BOSS、配种或活动获取。"
              : `常见野外等级约 ${pal.minWildLevel}-${pal.maxWildLevel}。`
          }</p>
          ${
            data.syncMeta
              ? `<p class="detail-copy compact-note">当前详情优先显示本地同步缓存，最近同步：${escapeHtml(
                  formatSyncStamp(data.syncMeta.syncedAt) || "未知"
                )}。</p>`
              : ""
          }
        </article>
      </div>

      ${renderPartnerSkillCard(pal)}

      <article class="info-card">
        <h3>打工适应性</h3>
        <div class="work-chip-row">
          ${
            primaryJobs.length
              ? primaryJobs
                  .map((item) => `<span class="work-chip">${escapeHtml(item.label)} ${item.level}</span>`)
                  .join("")
              : `<span class="tag">这只更偏战斗 / 功能位</span>`
          }
        </div>
        <p class="detail-copy">${escapeHtml(workerReason(pal, primaryJobs[0]?.key || null))}</p>
      </article>

      ${extraCards ? `<div class="info-grid">${extraCards}</div>` : ""}

      <div class="action-row">
        <button id="jump-to-breeding" class="action-button secondary" type="button">去查它的配种组合</button>
        ${
          pal.palPageUrl
            ? `<a class="action-button subtle" href="${escapeAttribute(pal.palPageUrl)}" target="_blank" rel="noreferrer">打开原始页</a>`
            : ""
        }
      </div>
    </div>
  `;
}

function renderHabitatCard(pal) {
  const habitat = pal.habitat;
  const spawnRows = pal.spawns || [];
  const dayCount = habitat && typeof habitat.dayCount === "number" ? String(habitat.dayCount) : "未同步";
  const nightCount = habitat && typeof habitat.nightCount === "number" ? String(habitat.nightCount) : "未同步";
  const dayMapUrl = buildLocalMapUrl(pal, "day");
  const nightMapUrl = buildLocalMapUrl(pal, "night");
  const daySourceUrl = habitat?.dayUrl || pal.mapUrl || "";
  const nightSourceUrl = habitat?.nightUrl || fallbackNightMapUrl(pal.mapUrl);
  const currentMode = getCurrentMapMode(pal, dayMapUrl, nightMapUrl);
  const currentMapUrl = currentMode === "night" ? nightMapUrl : dayMapUrl;
  const currentSourceUrl = currentMode === "night" ? nightSourceUrl : daySourceUrl;
  const overview = spawnRows.length
    ? spawnRows
        .slice(0, 4)
        .map(
          (spawn) => `
            <div class="info-line">
              <strong>${escapeHtml(localizeSpawnSource(spawn.source))}</strong>
              <span>${escapeHtml(spawn.level)}</span>
              <span class="inline-muted">${escapeHtml(spawn.chance)}</span>
            </div>
          `
        )
        .join("")
    : `<div class="detail-copy">当前没有同步到更细的刷新区域，先参考本地等级区间：${escapeHtml(pal.spawnHint)}</div>`;

  return `
    <article class="info-card">
      <h3>栖息地速看</h3>
      <p class="detail-copy">${escapeHtml(pal.spawnHint)}</p>
      <div class="tag-row">
        <span class="tag">白天点位 ${escapeHtml(dayCount)}</span>
        <span class="tag">夜晚点位 ${escapeHtml(nightCount)}</span>
      </div>
      <div class="info-list">${overview}</div>
      <div class="map-switch">
        <button class="chip-button ${currentMode === "day" ? "active" : ""}" type="button" data-map-mode="day" data-map-url="${escapeAttribute(dayMapUrl)}" data-map-source-url="${escapeAttribute(daySourceUrl)}">白天栖息地</button>
        <button class="chip-button ${currentMode === "night" ? "active" : ""}" type="button" data-map-mode="night" data-map-url="${escapeAttribute(nightMapUrl)}" data-map-source-url="${escapeAttribute(nightSourceUrl)}">夜晚栖息地</button>
        ${
          currentMapUrl
            ? `<a class="action-button subtle" data-map-popout href="${escapeAttribute(currentMapUrl)}" target="_blank" rel="noreferrer">在新窗口打开本地地图</a>`
            : ""
        }
        ${
          currentSourceUrl
            ? `<a class="action-button subtle" data-map-source href="${escapeAttribute(currentSourceUrl)}" target="_blank" rel="noreferrer">查看原始来源</a>`
            : ""
        }
      </div>
      ${
        currentMapUrl
          ? `
            <div class="map-embed-shell">
              <iframe
                id="pal-map-frame"
                class="map-frame"
                src="${escapeAttribute(currentMapUrl)}"
                loading="lazy"
                referrerpolicy="strict-origin-when-cross-origin"
                title="${escapeAttribute(pal.nameZh)} 栖息地地图"
              ></iframe>
            </div>
            <p class="field-help">地图文件会保存在本地；下次同步成功后会整包替换新地图，并自动删掉旧地图文件。</p>
          `
          : `<p class="field-help">当前没有可用的地图地址。</p>`
      }
      <div class="action-row">
        <a class="action-button primary" href="${escapeAttribute(dayMapUrl)}" target="_blank" rel="noreferrer">打开白天本地地图</a>
        <a class="action-button secondary" href="${escapeAttribute(nightMapUrl)}" target="_blank" rel="noreferrer">打开夜晚本地地图</a>
      </div>
    </article>
  `;
}

function renderPartnerSkillCard(pal) {
  if (!pal.partnerSkill?.title && !pal.partnerSkill?.description) {
    return "";
  }
  return `
    <article class="info-card">
      <h3>伙伴技能</h3>
      ${pal.partnerSkill.title ? `<div class="tag-row"><span class="work-chip">${escapeHtml(localizePartnerSkillTitle(pal.partnerSkill.title))}</span></div>` : ""}
      ${pal.partnerSkill.description ? `<p class="detail-copy">${escapeHtml(localizePartnerSkillDescription(pal.partnerSkill.description))}</p>` : ""}
    </article>
  `;
}

function renderSpawnCard(pal) {
  if (!pal.spawns?.length) {
    return "";
  }

  return `
    <article class="info-card">
      <h3>刷新区域</h3>
      <div class="info-list">
        ${pal.spawns
          .map(
            (spawn) => `
              <div class="info-line">
                <strong>${escapeHtml(localizeSpawnSource(spawn.source))}</strong>
                <span>${escapeHtml(spawn.level)}</span>
                <span class="inline-muted">${escapeHtml(spawn.chance)}</span>
              </div>
            `
          )
          .join("")}
      </div>
    </article>
  `;
}

function renderDropCard(pal) {
  if (!pal.drops?.length) {
    return "";
  }

  return `
    <article class="info-card">
      <h3>可能掉落</h3>
      <div class="info-list">
        ${pal.drops
          .map(
            (drop) => `
              <div class="info-line">
                <strong>${escapeHtml(localizeDropName(drop.name, drop.quantity))}</strong>
                <span>${escapeHtml(drop.quantity || "数量未标注")}</span>
                <span class="inline-muted">${escapeHtml(drop.probability)}</span>
              </div>
            `
          )
          .join("")}
      </div>
    </article>
  `;
}

function renderWorkers() {
  refs.workTips.innerHTML = data.workTips
    .map(
      (tip) => `
        <article class="tip-card">
          <h3>${escapeHtml(tip.title)}</h3>
          <p>${escapeHtml(tip.body)}</p>
        </article>
      `
    )
    .join("");

  refs.farmSpecialists.innerHTML = data.farmSpecialists
    .map((entry) => {
      return `
        <article class="farm-card">
          <div class="media-row">
            ${palImage(palsByCode.get(entry.code), "thumb")}
            <div class="title-block">
              <strong>${escapeHtml(entry.displayNo)} ${escapeHtml(entry.nameZh)}</strong>
              <div class="subtext">${escapeHtml(entry.dropLabel)}</div>
            </div>
          </div>
          <p class="detail-copy">${escapeHtml(entry.note)}</p>
          <div class="action-row">
            <button class="action-button secondary" type="button" data-open-pal="${escapeHtml(entry.code)}">查看图鉴</button>
          </div>
        </article>
      `;
    })
    .join("");

  const job = state.workerJob;
  const usingSyncedRanking = Boolean(data.jobRankings?.[job]?.length);
  refs.workerRankingNote.textContent =
    job === "Farming"
      ? "牧场位更看具体产物，所以右侧单独整理了常用牧场帕鲁。"
      : usingSyncedRanking
        ? `下面的结果保留了 paldb.cc 同步榜单的原始排序，并在当前阶段和夜班筛选下做了本地过滤。`
        : `下面的结果已按「${jobLabel(job)} 等级优先，其次兼顾夜班、速度和食量」从高到低排序。`;

  const rankedEntries = getWorkerEntries(job)
    .filter((entry) => {
      if (!entry.pal) {
        return false;
      }
      if (state.workerStage !== "all" && entry.pal.stageKey !== state.workerStage) {
        return false;
      }
      if (state.workerNightOnly && !entry.pal.nocturnal) {
        return false;
      }
      return true;
    })
    .slice(0, 12);

  if (job === "Farming") {
    refs.workerResults.innerHTML = `<div class="detail-empty">牧场位更适合看右侧的“牧场常用位”，因为产物类型比牧场适应性等级更重要。</div>`;
    bindOpenPalButtons(refs.farmSpecialists);
    return;
  }

  if (rankedEntries.length === 0) {
    refs.workerResults.innerHTML = `<div class="detail-empty">当前条件下没有合适结果，放宽阶段或夜班筛选试试。</div>`;
    bindOpenPalButtons(refs.farmSpecialists);
    return;
  }

  refs.workerResults.innerHTML = rankedEntries
    .map((entry, index) => {
      const pal = entry.pal;
      const focusLevel = pal.work[job];
      const rankLabel = entry.synced ? `Paldb 第 ${entry.rank} 名` : `第 ${index + 1} 名`;
      return `
        <article class="worker-card">
          <div class="media-row">
            ${palImage(pal, "thumb")}
            <div class="title-block">
              <div class="worker-title">
                <div>
                  <strong>${escapeHtml(pal.displayNo)} ${escapeHtml(pal.nameZh)}</strong>
                  ${renderEnglishNameMeta(pal)}
                </div>
                <span class="badge">${jobLabel(job)} ${focusLevel}</span>
              </div>
              <div class="tag-row">
                <span class="tag rank-tag">${escapeHtml(rankLabel)}</span>
                <span class="tag">${escapeHtml(pal.stageLabel)}</span>
                <span class="tag">${pal.nocturnal ? "夜行" : "日行"}</span>
                ${renderElementTags(pal, 2)}
                <span class="tag">食量 ${pal.foodAmount}</span>
                <span class="tag">搬运速度 ${pal.transportSpeed}</span>
              </div>
            </div>
          </div>
          <p class="detail-copy">${escapeHtml(workerReason(pal, job))}</p>
          <div class="action-row">
            <button class="action-button secondary" type="button" data-open-pal="${escapeHtml(pal.code)}">查看图鉴</button>
          </div>
        </article>
      `;
    })
    .join("");

  bindOpenPalButtons(refs.workerResults);
  bindOpenPalButtons(refs.farmSpecialists);
}

function getWorkerEntries(job) {
  if (job === "Farming") {
    return [];
  }

  if (data.jobRankings?.[job]?.length) {
    return data.jobRankings[job]
      .map((entry) => ({
        pal: palsByCode.get(entry.code),
        rank: entry.rank,
        synced: true,
      }))
      .filter((entry) => entry.pal);
  }

  return data.pals
    .filter((pal) => (pal.work[job] || 0) > 0)
    .sort((left, right) => scoreWorker(right, job) - scoreWorker(left, job))
    .map((pal, index) => ({
      pal,
      rank: index + 1,
      synced: false,
    }));
}

function renderBreeding() {
  const child = palsByCode.get(state.breedingChildCode);
  if (!child) {
    refs.breedingChildResults.innerHTML = `<div class="detail-empty">先选择一只目标帕鲁。</div>`;
  } else {
    const combos = (data.breedingByChild[child.code] || [])
      .map((entry) => toComboObject(entry))
      .filter(isRenderableCombo)
      .sort((left, right) => comboEase(left, child.code) - comboEase(right, child.code));

    if (combos.length === 0) {
      refs.breedingChildResults.innerHTML = `<div class="detail-empty">这只帕鲁没有查到可展示的直出组合。</div>`;
    } else {
      const grouped = sortChildCombos(uniqueCombosForChild(combos), child.code);
      refs.breedingChildResults.innerHTML = grouped
        .slice(0, 24)
        .map((combo) => renderComboCard(combo, child.code))
        .join("");
    }
  }

  const pairResults = sortPairResults(getPairResults(state.breedingParent1, state.breedingParent2));
  if (!pairResults.length) {
    refs.breedingPairResults.innerHTML = `<div class="pair-result-empty">这对亲本没有查到结果。可以换另一组帕鲁再试。</div>`;
  } else {
    const cards = pairResults
      .map((entry) => {
        const childPal = entry.child;
        if (!childPal) {
          return "";
        }
        const favoriteRecord = createFavoriteRecord(
          state.breedingParent1,
          state.breedingParent2,
          childPal.code,
          entry.gender1,
          entry.gender2,
          "pair"
        );
        const isFavorite = isFavoriteCombo(favoriteRecord.key);
        return `
          <article class="pair-card ${isFavorite ? "is-favorite" : ""}">
            <div class="media-row">
              ${palImage(childPal, "thumb")}
              <div class="title-block">
                <div class="pair-title">
                  <strong>${escapeHtml(childPal.displayNo)} ${escapeHtml(childPal.nameZh)}</strong>
                  <span class="badge">${escapeHtml(childPal.stageLabel)}</span>
                </div>
                ${renderEnglishNameMeta(childPal)}
              </div>
            </div>
            <div class="tag-row">
              <span class="tag">${formatGenderRule(entry.gender1, entry.gender2)}</span>
              ${sortJobsByLevel(childPal)
                .slice(0, 3)
                .map((item) => `<span class="tag">${escapeHtml(item.label)} ${item.level}</span>`)
                .join("")}
            </div>
            <p class="pair-note">${escapeHtml(childPal.spawnHint)}</p>
            <div class="action-row">
              ${renderFavoriteButton(favoriteRecord, isFavorite)}
              <button class="action-button secondary" type="button" data-open-pal="${escapeHtml(childPal.code)}">查看图鉴</button>
            </div>
          </article>
        `;
      })
      .filter(Boolean)
      .join("");

    refs.breedingPairResults.innerHTML = cards || `<div class="pair-result-empty">这对亲本没有查到可展示的子代结果。</div>`;
  }

  renderBreedingMemory();
  bindOpenPalButtons(refs.breedingChildResults);
  bindOpenPalButtons(refs.breedingPairResults);
  bindFavoriteButtons(refs.breedingChildResults);
  bindFavoriteButtons(refs.breedingPairResults);
  bindBreedingMemoryButtons();
}

function uniqueCombosForChild(combos) {
  const seen = new Set();
  const unique = [];
  combos.forEach((combo) => {
    if (!isRenderableCombo(combo)) {
      return;
    }
    const normalized = normalizePair(combo.parent1.code, combo.parent2.code, combo.gender1, combo.gender2);
    const key = `${normalized.parentKey}|${normalized.gender1}|${normalized.gender2}|${combo.child.code}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(combo);
    }
  });
  return unique;
}

function sortChildCombos(combos, childCode) {
  const items = [...combos];
  switch (state.breedingChildSort) {
    case "favorite":
      return items.sort((left, right) => {
        const favoriteDelta = Number(isFavoriteCombo(comboRecordFromCombo(right).key)) - Number(isFavoriteCombo(comboRecordFromCombo(left).key));
        return favoriteDelta || comboEase(left, childCode) - comboEase(right, childCode);
      });
    case "early":
      return items.sort((left, right) => comboStageScore(left) - comboStageScore(right) || comboEase(left, childCode) - comboEase(right, childCode));
    case "clean":
      return items.sort((left, right) => comboSelfPenalty(left, childCode) - comboSelfPenalty(right, childCode) || comboEase(left, childCode) - comboEase(right, childCode));
    case "ease":
    default:
      return items.sort((left, right) => comboEase(left, childCode) - comboEase(right, childCode));
  }
}

function sortPairResults(results) {
  const hydrated = results
    .map((entry) => ({
      ...entry,
      child: palsByCode.get(entry.childCode),
    }))
    .filter((entry) => entry.child);

  switch (state.breedingPairSort) {
    case "favorite":
      return hydrated.sort((left, right) => {
        const leftRecord = createFavoriteRecord(state.breedingParent1, state.breedingParent2, left.childCode, left.gender1, left.gender2, "pair");
        const rightRecord = createFavoriteRecord(state.breedingParent1, state.breedingParent2, right.childCode, right.gender1, right.gender2, "pair");
        const favoriteDelta = Number(isFavoriteCombo(rightRecord.key)) - Number(isFavoriteCombo(leftRecord.key));
        return favoriteDelta || pairStageScore(left.child) - pairStageScore(right.child);
      });
    case "work":
      return hydrated.sort((left, right) => pairWorkScore(right.child) - pairWorkScore(left.child) || pairStageScore(left.child) - pairStageScore(right.child));
    case "number":
      return hydrated.sort((left, right) => compareDisplayNo(left.child.displayNo, right.child.displayNo));
    case "stage":
    default:
      return hydrated.sort((left, right) => pairStageScore(left.child) - pairStageScore(right.child) || compareDisplayNo(left.child.displayNo, right.child.displayNo));
  }
}

function getPairResults(parent1Code, parent2Code) {
  const direct = (data.breedingByPair[`${parent1Code}|${parent2Code}`] || []).map(([childCode, gender1, gender2]) => ({
    childCode,
    gender1,
    gender2,
  }));
  const reversed = (data.breedingByPair[`${parent2Code}|${parent1Code}`] || []).map(([childCode, gender1, gender2]) => ({
    childCode,
    gender1: gender2,
    gender2: gender1,
  }));

  const unique = [];
  const seen = new Set();
  [...direct, ...reversed].forEach((entry) => {
    const key = `${entry.childCode}|${entry.gender1}|${entry.gender2}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(entry);
    }
  });
  return unique;
}

function normalizePair(parent1Code, parent2Code, gender1, gender2) {
  if (parent1Code <= parent2Code) {
    return {
      parentKey: `${parent1Code}|${parent2Code}`,
      gender1,
      gender2,
    };
  }
  return {
    parentKey: `${parent2Code}|${parent1Code}`,
    gender1: gender2,
    gender2: gender1,
  };
}

function renderComboCard(combo, childCode) {
  const selfPenalty = combo.parent1.code === childCode || combo.parent2.code === childCode;
  const favoriteRecord = comboRecordFromCombo(combo);
  const isFavorite = isFavoriteCombo(favoriteRecord.key);
  return `
    <article class="combo-card ${isFavorite ? "is-favorite" : ""}">
      <div class="media-row">
        ${palImage(combo.child, "thumb")}
        <div class="title-block">
          <div class="combo-title">
            <div>
              <strong>${escapeHtml(combo.child.displayNo)} ${escapeHtml(combo.child.nameZh)}</strong>
              ${renderEnglishNameMeta(combo.child)}
            </div>
            <span class="badge">${selfPenalty ? "包含自体" : "直出可用"}</span>
          </div>
        </div>
      </div>
      <div class="combo-parents">
        <div class="combo-parent-card">
          ${palImage(combo.parent1, "thumb-sm")}
          <div class="title-block">
            <strong>${escapeHtml(combo.parent1.displayNo)} ${escapeHtml(combo.parent1.nameZh)}</strong>
            ${renderEnglishNameMeta(combo.parent1)}
          </div>
          <span class="tag gender-badge">${escapeHtml(genderLabel(combo.gender1))}</span>
        </div>
        <div class="combo-parent-card">
          ${palImage(combo.parent2, "thumb-sm")}
          <div class="title-block">
            <strong>${escapeHtml(combo.parent2.displayNo)} ${escapeHtml(combo.parent2.nameZh)}</strong>
            ${renderEnglishNameMeta(combo.parent2)}
          </div>
          <span class="tag gender-badge">${escapeHtml(genderLabel(combo.gender2))}</span>
        </div>
      </div>
      <div class="tag-row">
        <span class="tag">${escapeHtml(combo.parent1.stageLabel)}</span>
        <span class="tag">${escapeHtml(combo.parent2.stageLabel)}</span>
      </div>
      <p class="detail-copy">${escapeHtml(comboHint(combo, childCode))}</p>
      <div class="action-row">
        ${renderFavoriteButton(favoriteRecord, isFavorite)}
        <button class="action-button secondary" type="button" data-open-pal="${escapeHtml(combo.child.code)}">查看子代图鉴</button>
      </div>
    </article>
  `;
}

function toComboObject([parent1Code, parent2Code, childCode, gender1, gender2]) {
  return {
    parent1: palsByCode.get(parent1Code),
    parent2: palsByCode.get(parent2Code),
    child: palsByCode.get(childCode),
    gender1,
    gender2,
  };
}

function isRenderableCombo(combo) {
  return Boolean(combo?.parent1 && combo?.parent2 && combo?.child);
}

function comboRecordFromCombo(combo) {
  return createFavoriteRecord(combo.parent1.code, combo.parent2.code, combo.child.code, combo.gender1, combo.gender2, "child");
}

function createFavoriteRecord(parent1Code, parent2Code, childCode, gender1, gender2, source = "manual") {
  const normalized = normalizePair(parent1Code, parent2Code, gender1, gender2);
  const [safeParent1Code, safeParent2Code] = normalized.parentKey.split("|");
  return {
    key: `${normalized.parentKey}|${normalized.gender1}|${normalized.gender2}|${childCode}`,
    parent1Code: safeParent1Code,
    parent2Code: safeParent2Code,
    childCode,
    gender1: normalized.gender1,
    gender2: normalized.gender2,
    source,
  };
}

function renderFavoriteButton(record, isFavorite) {
  return `
    <button
      class="action-button ${isFavorite ? "primary" : "ghost"}"
      type="button"
      data-toggle-favorite="true"
      data-parent1-code="${escapeAttribute(record.parent1Code)}"
      data-parent2-code="${escapeAttribute(record.parent2Code)}"
      data-child-code="${escapeAttribute(record.childCode)}"
      data-gender1="${escapeAttribute(record.gender1)}"
      data-gender2="${escapeAttribute(record.gender2)}"
      data-source="${escapeAttribute(record.source)}"
    >${isFavorite ? "已收藏" : "收藏组合"}</button>
  `;
}

function isFavoriteCombo(key) {
  return state.favoriteCombos.some((entry) => entry.key === key);
}

function toggleFavoriteCombo(record) {
  if (isFavoriteCombo(record.key)) {
    state.favoriteCombos = state.favoriteCombos.filter((entry) => entry.key !== record.key);
  } else {
    state.favoriteCombos = [
      {
        ...record,
        savedAt: Date.now(),
      },
      ...state.favoriteCombos.filter((entry) => entry.key !== record.key),
    ].slice(0, FAVORITE_COMBO_LIMIT);
  }
  persistLocalState();
  renderBreeding();
}

function rememberRecentPair(parent1Code, parent2Code) {
  if (!parent1Code || !parent2Code) {
    return;
  }
  const normalized = normalizePair(parent1Code, parent2Code, "WILDCARD", "WILDCARD");
  const [safeParent1Code, safeParent2Code] = normalized.parentKey.split("|");
  state.recentPairs = [
    {
      key: normalized.parentKey,
      parent1Code: safeParent1Code,
      parent2Code: safeParent2Code,
      updatedAt: Date.now(),
    },
    ...state.recentPairs.filter((entry) => entry.key !== normalized.parentKey),
  ].slice(0, RECENT_PAIR_LIMIT);
}

function renderBreedingMemory() {
  const favoriteCards = state.favoriteCombos
    .filter((entry) => palsByCode.has(entry.parent1Code) && palsByCode.has(entry.parent2Code) && palsByCode.has(entry.childCode))
    .sort((left, right) => (right.savedAt || 0) - (left.savedAt || 0))
    .map((entry) => {
      const parent1 = palsByCode.get(entry.parent1Code);
      const parent2 = palsByCode.get(entry.parent2Code);
      const child = palsByCode.get(entry.childCode);
      return `
        <article class="memory-card is-favorite">
          <div class="memory-card-head">
            <strong>${escapeHtml(child.displayNo)} ${escapeHtml(child.nameZh)}</strong>
            <span class="badge">${escapeHtml(child.stageLabel)}</span>
          </div>
          <p>${escapeHtml(parent1.nameZh)} × ${escapeHtml(parent2.nameZh)} → ${escapeHtml(child.nameZh)}</p>
          <p>${escapeHtml(formatGenderRule(entry.gender1, entry.gender2))}</p>
          <div class="action-row">
            <button class="mini-button primary" type="button" data-load-favorite="${escapeAttribute(entry.key)}">载入这组</button>
            <button class="mini-button" type="button" data-open-pal="${escapeAttribute(child.code)}">查看图鉴</button>
            <button class="mini-button rose" type="button" data-remove-favorite="${escapeAttribute(entry.key)}">取消收藏</button>
          </div>
        </article>
      `;
    })
    .join("");

  refs.favoriteCombos.innerHTML = favoriteCards || `<div class="field-help">还没有收藏组合，看到顺手的配种结果时点一下“收藏组合”就会保存在这里。</div>`;

  const recentCards = state.recentPairs
    .filter((entry) => palsByCode.has(entry.parent1Code) && palsByCode.has(entry.parent2Code))
    .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))
    .map((entry) => {
      const parent1 = palsByCode.get(entry.parent1Code);
      const parent2 = palsByCode.get(entry.parent2Code);
      return `
        <article class="memory-card">
          <div class="memory-card-head">
            <strong>${escapeHtml(parent1.nameZh)} × ${escapeHtml(parent2.nameZh)}</strong>
            <span class="badge">常用</span>
          </div>
          <p>${escapeHtml(parent1.displayNo)} 与 ${escapeHtml(parent2.displayNo)} 的亲本组合</p>
          <div class="action-row">
            <button class="mini-button primary" type="button" data-load-pair="${escapeAttribute(entry.key)}">载入亲本</button>
            <button class="mini-button rose" type="button" data-remove-pair="${escapeAttribute(entry.key)}">移除</button>
          </div>
        </article>
      `;
    })
    .join("");

  refs.recentPairs.innerHTML = recentCards || `<div class="field-help">你改动过的亲本组合会自动记在这里，方便反复试不同子代。</div>`;
}

function bindFavoriteButtons(scope) {
  if (!scope) {
    return;
  }
  scope.querySelectorAll("[data-toggle-favorite]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleFavoriteCombo(createFavoriteRecord(
        button.dataset.parent1Code,
        button.dataset.parent2Code,
        button.dataset.childCode,
        button.dataset.gender1,
        button.dataset.gender2,
        button.dataset.source || "manual"
      ));
    });
  });
}

function bindBreedingMemoryButtons() {
  refs.favoriteCombos.querySelectorAll("[data-load-favorite]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = state.favoriteCombos.find((entry) => entry.key === button.dataset.loadFavorite);
      if (!record) {
        return;
      }
      state.breedingParent1 = record.parent1Code;
      state.breedingParent2 = record.parent2Code;
      state.breedingChildCode = record.childCode;
      persistLocalState();
      populateStaticUI();
      renderBreeding();
    });
  });

  refs.favoriteCombos.querySelectorAll("[data-remove-favorite]").forEach((button) => {
    button.addEventListener("click", () => {
      state.favoriteCombos = state.favoriteCombos.filter((entry) => entry.key !== button.dataset.removeFavorite);
      persistLocalState();
      renderBreeding();
    });
  });

  refs.recentPairs.querySelectorAll("[data-load-pair]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = state.recentPairs.find((entry) => entry.key === button.dataset.loadPair);
      if (!record) {
        return;
      }
      state.breedingParent1 = record.parent1Code;
      state.breedingParent2 = record.parent2Code;
      persistLocalState();
      populateStaticUI();
      renderBreeding();
    });
  });

  refs.recentPairs.querySelectorAll("[data-remove-pair]").forEach((button) => {
    button.addEventListener("click", () => {
      state.recentPairs = state.recentPairs.filter((entry) => entry.key !== button.dataset.removePair);
      persistLocalState();
      renderBreeding();
    });
  });

  bindOpenPalButtons(refs.favoriteCombos);
}

function comboEase(combo, childCode) {
  const parents = [combo.parent1, combo.parent2].filter(Boolean);
  const avgLevel = average(
    parents.map((pal) => (typeof pal.maxWildLevel === "number" ? pal.maxWildLevel : 70)),
  );
  const rarityPenalty = parents.reduce((sum, pal) => sum + pal.rarity * 2.5, 0);
  const variantPenalty = parents.reduce((sum, pal) => sum + (pal.isVariant ? 8 : 0), 0);
  const selfPenalty = parents.some((pal) => pal.code === childCode) ? 80 : 0;
  return avgLevel + rarityPenalty + variantPenalty + selfPenalty;
}

function comboHint(combo, childCode) {
  const selfPenalty = combo.parent1.code === childCode || combo.parent2.code === childCode;
  const pieces = [
    `${combo.parent1.stageLabel} + ${combo.parent2.stageLabel}`,
    formatGenderRule(combo.gender1, combo.gender2),
  ];
  if (selfPenalty) {
    pieces.push("这组包含目标自体，适合扩繁，不适合第一次直出。");
  }
  return pieces.join("；");
}

function comboSelfPenalty(combo, childCode) {
  return combo.parent1.code === childCode || combo.parent2.code === childCode ? 1 : 0;
}

function comboStageScore(combo) {
  return average([combo.parent1, combo.parent2].map((pal) => (typeof pal.maxWildLevel === "number" ? pal.maxWildLevel : 70)));
}

function pairStageScore(childPal) {
  return typeof childPal.maxWildLevel === "number" ? childPal.maxWildLevel : 70;
}

function pairWorkScore(childPal) {
  return sortJobsByLevel(childPal)
    .slice(0, 2)
    .reduce((sum, item, index) => sum + item.level * (index === 0 ? 10 : 4), 0);
}

function scoreWorker(pal, focusJob) {
  const primaryLevel = pal.work[focusJob] || 0;
  const secondary = sortJobsByLevel(pal)
    .filter((item) => item.key !== focusJob)
    .slice(0, 2)
    .reduce((sum, item) => sum + item.level, 0);
  let score = primaryLevel * 1000;

  if (focusJob === "Transporting") {
    score += pal.transportSpeed * 1.8;
  } else if (["Mining", "Lumbering", "Gathering"].includes(focusJob)) {
    score += pal.transportSpeed * 0.65;
  } else if (focusJob === "Handiwork") {
    score += (pal.work.Transporting || 0) * 90;
  }

  if (pal.nocturnal) {
    score += state.workerNightOnly ? 180 : 50;
  }

  if (state.workerStage === "early") {
    score -= (pal.maxWildLevel ?? 70) * 8;
    score -= pal.rarity * 18;
  } else if (state.workerStage === "mid") {
    score -= (pal.maxWildLevel ?? 70) * 4;
  }

  score += secondary * 60;
  score -= pal.foodAmount * 14;
  return score;
}

function sortJobsByLevel(pal) {
  return data.jobs
    .map((job) => ({
      key: job.key,
      label: job.label,
      level: pal.work[job.key] || 0,
    }))
    .filter((item) => item.level > 0)
    .sort((left, right) => right.level - left.level || left.label.localeCompare(right.label, "zh-CN"));
}

function workerReason(pal, focusJob) {
  const jobs = sortJobsByLevel(pal);
  if (!jobs.length) {
    return "这只帕鲁不以据点打工见长。";
  }
  const parts = [`主工 ${jobs[0].label} ${jobs[0].level}`];
  if (focusJob && pal.work[focusJob] > 0 && jobs[0].key !== focusJob) {
    parts.unshift(`目标岗位 ${jobLabel(focusJob)} ${pal.work[focusJob]}`);
  }
  if (jobs[1]) {
    parts.push(`副职 ${jobs[1].label} ${jobs[1].level}${jobs[2] ? ` / ${jobs[2].label} ${jobs[2].level}` : ""}`);
  }
  if (pal.nocturnal) {
    parts.push("可夜班");
  }
  if (focusJob === "Transporting") {
    parts.push(`搬运速度 ${pal.transportSpeed}`);
  }
  parts.push(`食量 ${pal.foodAmount}`);
  return parts.join("，") + "。";
}

function genderLabel(gender) {
  if (gender === "MALE") {
    return "公";
  }
  if (gender === "FEMALE") {
    return "母";
  }
  return "任意性别";
}

function formatGenderRule(gender1, gender2) {
  if (gender1 === "WILDCARD" && gender2 === "WILDCARD") {
    return "性别任意";
  }
  return `亲本 1：${genderLabel(gender1)} / 亲本 2：${genderLabel(gender2)}`;
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function jobLabel(key) {
  return jobsByKey.get(key)?.label || key;
}

function palImage(pal, className = "thumb", loading = "lazy") {
  if (!pal) {
    return `<div class="${className}"></div>`;
  }
  return `<img class="${className}" src="${escapeAttribute(pal.iconUrl)}" alt="${escapeAttribute(pal.nameZh)}" loading="${escapeAttribute(loading)}">`;
}

function renderElementTags(pal, limit = Infinity) {
  return uniqueStrings(pal.elements || [])
    .slice(0, limit)
    .map((element) => `<span class="tag element-tag">${escapeHtml(localizeElementLabel(element))}</span>`)
    .join("");
}

function jumpToPal(code) {
  const pal = palsByCode.get(code);
  if (!pal) {
    return;
  }
  state.view = "dex";
  state.selectedPalCode = pal.code;
  renderViewState();
  renderDex();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function bindOpenPalButtons(scope) {
  if (!scope) {
    return;
  }
  scope.querySelectorAll("[data-open-pal]").forEach((button) => {
    button.addEventListener("click", () => {
      jumpToPal(button.dataset.openPal);
    });
  });
}

function bindMapToggle(scope, pal) {
  if (!scope || !pal) {
    return;
  }
  const frame = scope.querySelector("#pal-map-frame");
  const buttons = [...scope.querySelectorAll("[data-map-mode][data-map-url]")];
  if (!frame || !buttons.length) {
    return;
  }
  const popout = scope.querySelector("[data-map-popout]");
  const sourceLink = scope.querySelector("[data-map-source]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.mapMode;
      const url = button.dataset.mapUrl;
      const sourceUrl = button.dataset.mapSourceUrl || "";
      state.mapModeByPal[pal.code] = mode;
      frame.src = url;
      buttons.forEach((item) => {
        item.classList.toggle("active", item.dataset.mapMode === mode);
      });
      if (popout) {
        popout.href = url;
      }
      if (sourceLink && sourceUrl) {
        sourceLink.href = sourceUrl;
      }
    });
  });
}

function getCurrentMapMode(pal, dayMapUrl, nightMapUrl) {
  const savedMode = state.mapModeByPal[pal.code];
  if (savedMode === "day" && dayMapUrl) {
    return "day";
  }
  if (savedMode === "night" && nightMapUrl) {
    return "night";
  }
  if (dayMapUrl) {
    return "day";
  }
  if (nightMapUrl) {
    return "night";
  }
  return "day";
}

function initSyncControls() {
  if (!refs.syncButton || !refs.syncHelp || !refs.syncLog) {
    return;
  }

  refs.syncButton.addEventListener("click", triggerSync);
  refs.syncHelp.textContent = isFileMode()
    ? "当前是直接双击打开的离线页；如果本机同步服务已经启动，按钮也可以直接使用。"
    : refs.syncHelp.textContent;
  refreshSyncStatus();
  window.setInterval(refreshSyncStatus, 4000);
}

async function triggerSync() {
  if (state.syncInFlight) {
    return;
  }
  try {
    refs.syncHelp.textContent = "正在尝试连接同步服务...";
    const response = await fetchSyncEndpoint("/api/sync", {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    state.syncInFlight = Boolean(payload.syncing);
    renderSyncStatus(payload);
  } catch (error) {
    refs.syncHelp.textContent = `同步启动失败：${error.message}`;
    refs.syncLog.textContent = `无法连接本地同步服务：${error.message}`;
    if (isFileMode()) {
      window.open(DEFAULT_SYNC_SERVICE_ORIGIN, "_blank", "noopener");
    }
  }
}

async function refreshSyncStatus() {
  try {
    const response = await fetchSyncEndpoint("/api/status", { cache: "no-store" }, state.syncServiceAvailable ? 1 : 4);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    state.syncServiceAvailable = true;
    renderSyncStatus(payload);
    maybeReloadAfterSync(payload);
  } catch (error) {
    state.syncServiceAvailable = false;
    state.syncInFlight = false;
    refs.syncButton.disabled = false;
    refs.syncHelp.textContent = isFileMode()
      ? "本机同步服务还没连上。请先重新打开桌面程序；源码模式下可用 start_helper.command（macOS）或 start_helper.bat（Windows）。"
      : "同步服务暂时没连上。请先等几秒；如果仍然这样，请重新打开桌面程序（Windows 通常是 PalworldDexHelper.exe）。";
    refs.syncLog.textContent = `无法连接本地同步服务：${error.message}`;
    renderSyncProgress(null);
  }
}

function renderSyncStatus(payload) {
  state.syncInFlight = Boolean(payload.syncing);
  refs.syncButton.disabled = Boolean(payload.syncing);
  refs.syncButton.textContent = payload.syncing ? "同步中..." : "一键同步 paldb.cc";
  const logTail = payload.logTail?.trim() || "";
  const reachedDetailEnd = /\[sync\]\s+227\/227\b/.test(logTail);
  renderSyncProgress(payload.progress);

  if (payload.syncing) {
    refs.syncHelp.textContent = reachedDetailEnd
      ? "详情数据已经抓完，正在生成并替换本地地图文件。这一步通常会比前面更慢一些。"
      : logTail
        ? "正在抓取并更新本地缓存，可以直接看下方日志确认进度。"
        : "同步任务刚启动，正在准备索引、榜单和详情请求。";
  } else if (payload.lastExitCode === 0) {
    refs.syncHelp.textContent = `同步完成，最近成功同步：${formatSyncStamp(payload.syncedAt) || "未知"}`;
  } else if (payload.syncedAt) {
    refs.syncHelp.textContent = `当前本地缓存时间：${formatSyncStamp(payload.syncedAt) || "未知"}，可以随时再点一次同步更新。`;
  } else if (payload.lastExitCode != null) {
    refs.syncHelp.textContent = "上一次同步没有完整成功，可以再点一次重试。";
  } else {
    refs.syncHelp.textContent = "点击按钮即可同步 paldb.cc 的最新图鉴、栖息地和打工榜单。";
  }

  refs.syncLog.textContent = logTail || "同步日志会显示在这里。";
  if (payload.syncedAt) {
    refs.metaSyncStatus.textContent = formatSyncStamp(payload.syncedAt) || "已同步";
  }
}

function maybeReloadAfterSync(payload) {
  const newStamp = payload.syncedAt || "";
  if (payload.syncing) {
    state.hasTriggeredAutoRefresh = false;
    return;
  }
  if (
    payload.lastExitCode === 0
    && newStamp
    && newStamp !== state.lastServerSyncedAt
    && !state.hasTriggeredAutoRefresh
  ) {
    state.lastServerSyncedAt = newStamp;
    state.hasTriggeredAutoRefresh = true;
    window.setTimeout(() => {
      window.location.reload();
    }, 800);
  }
}

function formatSyncStamp(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function fallbackNightMapUrl(dayMapUrl) {
  if (!dayMapUrl) {
    return "";
  }
  return dayMapUrl.replace("dayTimeLocations", "nightTimeLocations");
}

function buildLocalMapUrl(pal, mode) {
  const normalizedMode = mode === "night" ? "night" : "day";
  const params = new URLSearchParams({
    code: pal.code,
    mode: normalizedMode,
    label: pal.nameZh,
  });
  return `./local-map-viewer.html?${params.toString()}`;
}

function localizeElementLabel(label) {
  return ELEMENT_LABELS[label] || label;
}

function localizeDropName(name, quantity = "") {
  const baseName = stripTrailingQuantity(name, quantity);
  return tidyLocalizedText(localizeFreeText(simplifyDropName(ITEM_LABELS[baseName] || baseName)));
}

function localizeSpawnSource(source) {
  const normalized = SPAWN_SOURCE_LABELS[source] || source;
  return tidyLocalizedText(localizeFreeText(normalized))
    .replace(/^帕鲁中介·/, "帕鲁征募员·")
    .replace(/^帕鲁中介/, "帕鲁征募员");
}

function localizePartnerSkillTitle(title) {
  return tidyLocalizedText(PARTNER_SKILL_TITLE_LABELS[title] || localizeFreeText(title));
}

function localizePartnerSkillDescription(description) {
  return tidyLocalizedText(rewritePartnerSkillDescription(PARTNER_SKILL_DESCRIPTION_LABELS[description] || localizeFreeText(description)));
}

function renderEnglishNameMeta(pal) {
  if (!pal?.nameEn) {
    return "";
  }
  return `<div class="subtext">英文名：${escapeHtml(pal.nameEn)}</div>`;
}

function renderDetailNameMeta(pal) {
  const pieces = [];
  if (pal?.nameEn) {
    pieces.push(`英文名：${escapeHtml(pal.nameEn)}`);
  }
  if (pal?.internalName) {
    pieces.push(`内部名：${escapeHtml(pal.internalName)}`);
  }
  return pieces.join(" · ");
}

function isFileMode() {
  return window.location.protocol === "file:";
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function buildSyncEndpointCandidates(relativePath) {
  const candidates = [];
  const addCandidate = (value) => {
    if (!value || candidates.includes(value)) {
      return;
    }
    candidates.push(value);
  };

  if (!isFileMode()) {
    addCandidate(relativePath);
    if (window.location.origin && window.location.origin !== "null") {
      addCandidate(`${window.location.origin}${relativePath}`);
    }
  }

  addCandidate(`${DEFAULT_SYNC_SERVICE_ORIGIN}${relativePath}`);
  addCandidate(`${FALLBACK_SYNC_SERVICE_ORIGIN}${relativePath}`);
  return candidates;
}

async function fetchSyncEndpoint(path, options = {}, retryCount = 1) {
  const relativePath = path.startsWith("/") ? path : `/${path}`;
  const candidates = buildSyncEndpointCandidates(relativePath);

  let lastError = null;
  for (let attempt = 0; attempt < retryCount; attempt += 1) {
    for (const candidate of candidates) {
      try {
        return await fetch(candidate, options);
      } catch (error) {
        lastError = error;
      }
    }
    if (attempt < retryCount - 1) {
      await wait(450);
    }
  }
  throw lastError || new Error("同步服务未响应");
}

function localizeFreeText(text) {
  if (!text) {
    return "";
  }
  return TEXT_REPLACEMENTS.reduce((current, [from, to]) => current.replaceAll(from, to), text);
}

function tidyLocalizedText(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([，。！？；：])/g, "$1")
    .replace(/([，。！？；：])\s+/g, "$1")
    .replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/g, "$1$2")
    .replace(/([\u4e00-\u9fff])\s+([·])/g, "$1$2")
    .replace(/([·])\s+([\u4e00-\u9fff])/g, "$1$2")
    .trim();
}

function stripTrailingQuantity(name, quantity) {
  if (!name) {
    return "";
  }
  if (!quantity) {
    return name.trim();
  }
  const normalizedName = name.trim();
  const escapedQuantity = escapeRegExp(quantity.trim());
  return normalizedName.replace(new RegExp(`\\s*${escapedQuantity}$`), "").trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function simplifyDropName(name) {
  let current = name || "";
  const ruleBook = [
    [/^(.+)的羊肉$/, "$1肉"],
    [/^(.+)的牛肉$/, "$1肉"],
    [/^(.+)的猪肉$/, "$1肉"],
    [/^(.+)的鸡肉$/, "$1肉"],
    [/^(.+)的鹿肉$/, "$1肉"],
    [/^(.+)的鳄鱼肉$/, "$1肉"],
    [/^(.+)的恐龙肉$/, "$1肉"],
    [/^(.+)的鱼肉$/, "$1鱼肉"],
    [/^(.+)的鸟肉$/, "$1鸟肉"],
    [/^(.+)的巨兽肉$/, "$1肉"],
    [/^(.+)的羽饰$/, "$1羽饰"],
    [/^(.+)的羽毛$/, "$1羽毛"],
    [/^(.+)的头冠$/, "$1头冠"],
    [/^(.+)的叶子$/, "$1叶片"],
    [/^(.+)的章鱼足$/, "$1章鱼足"],
    [/^(.+)的水母伞$/, "$1水母伞"],
    [/^(.+)的触手$/, "$1触手"],
    [/^(.+)的云朵$/, "$1云团"],
    [/^(.+)的体毛$/, "$1体毛"],
    [/^(.+)的体液$/, "$1体液"],
  ];
  ruleBook.forEach(([pattern, replacement]) => {
    current = current.replace(pattern, replacement);
  });
  return current
    .replace(/^优质的布$/, "优质布")
    .replace(/^布$/, "布料")
    .replace(/^家畜牧场$/, "牧场");
}

function rewritePartnerSkillDescription(description) {
  return String(description || "")
    .replaceAll("将它分派到牧场，它就有机会", "分配到牧场时，它有机会")
    .replaceAll("将它分派到牧场，它就有机会从地里挖出", "分配到牧场时，它有机会挖出")
    .replaceAll("将它分派到牧场，它就有机会产下", "分配到牧场时，它有机会产出")
    .replaceAll("与它并肩作战时， ", "与它并肩作战时，")
    .replaceAll("发动后会以威力极高的 ", "发动后会以高威力的")
    .replaceAll("发动后能够发动第六感， 来探测附近地下城的位置。", "发动后会激发第六感，侦测附近地下城的位置。")
    .replaceAll("玩家的攻击会转变为地属性。", "玩家的攻击会转为地属性。")
    .replaceAll("玩家的攻击会转变为暗属性。", "玩家的攻击会转为暗属性。")
    .replaceAll("玩家的攻击会转变为水属性。", "玩家的攻击会转为水属性。")
    .replaceAll("玩家的攻击会转变为火属性。", "玩家的攻击会转为火属性。")
    .replaceAll("玩家的攻击会转变为雷属性。", "玩家的攻击会转为雷属性。")
    .replaceAll("玩家的攻击会转变为草属性。", "玩家的攻击会转为草属性。");
}

function normalizeStateSelections() {
  const defaultSelected = data.pals[0]?.code || "";
  const defaultChild = data.featuredTargets[0]?.code || data.pals[0]?.code || "";
  const defaultParent1 = data.pals[0]?.code || "";
  const defaultParent2 = data.pals[1]?.code || defaultParent1;
  state.selectedPalCode = normalizePalCode(state.selectedPalCode, defaultSelected);
  state.breedingChildCode = normalizePalCode(state.breedingChildCode, defaultChild);
  state.breedingParent1 = normalizePalCode(state.breedingParent1, defaultParent1);
  state.breedingParent2 = normalizePalCode(state.breedingParent2, defaultParent2);
  state.favoriteCombos = (state.favoriteCombos || [])
    .filter((entry) => palsByCode.has(entry.parent1Code) && palsByCode.has(entry.parent2Code) && palsByCode.has(entry.childCode))
    .slice(0, FAVORITE_COMBO_LIMIT);
  state.recentPairs = (state.recentPairs || [])
    .filter((entry) => palsByCode.has(entry.parent1Code) && palsByCode.has(entry.parent2Code))
    .slice(0, RECENT_PAIR_LIMIT);
}

function normalizePalCode(code, fallback) {
  return code && palsByCode.has(code) ? code : fallback;
}

function loadPersistedState() {
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("loadPersistedState failed", error);
    return {};
  }
}

function persistLocalState() {
  try {
    const payload = {
      breedingChildCode: state.breedingChildCode,
      breedingParent1: state.breedingParent1,
      breedingParent2: state.breedingParent2,
      breedingChildSort: state.breedingChildSort,
      breedingPairSort: state.breedingPairSort,
      favoriteCombos: state.favoriteCombos,
      recentPairs: state.recentPairs,
      traitTargetText: state.traitTargetText,
      traitParent1Text: state.traitParent1Text,
      traitParent2Text: state.traitParent2Text,
      traitGoal: state.traitGoal,
      traitRole: state.traitRole,
    };
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("persistLocalState failed", error);
  }
}

function renderSyncProgress(progress) {
  if (!refs.syncProgressSummary || !refs.syncProgressFill || !refs.syncStageList) {
    return;
  }
  const fallbackStages = [
    { id: "boot", label: "准备启动", status: "pending", progress: 0, detail: "等待同步任务开始" },
    { id: "index", label: "图鉴索引", status: "pending", progress: 0, detail: "等待读取图鉴索引" },
    { id: "rankings", label: "岗位榜单", status: "pending", progress: 0, detail: "等待读取岗位排行" },
    { id: "details", label: "帕鲁详情", status: "pending", progress: 0, detail: "等待抓取详情内容" },
    { id: "maps", label: "本地地图", status: "pending", progress: 0, detail: "等待刷新本地地图文件" },
    { id: "outputs", label: "写入缓存", status: "pending", progress: 0, detail: "等待写回本地缓存" },
  ];
  const safeProgress = progress && Array.isArray(progress.stages)
    ? progress
    : {
        overall: 0,
        summary: state.syncServiceAvailable ? "等待同步启动" : "未连接同步服务",
        stages: fallbackStages,
      };
  const overall = Math.max(0, Math.min(1, safeProgress.overall || 0));
  refs.syncProgressSummary.textContent = safeProgress.summary || "等待同步启动";
  refs.syncProgressFill.style.width = `${Math.round(overall * 100)}%`;
  refs.syncStageList.innerHTML = safeProgress.stages
    .map((stage) => {
      const percent = Math.round((stage.progress || 0) * 100);
      const detail = stage.detail || (stage.status === "completed" ? "已完成" : stage.status === "active" ? "进行中" : "等待中");
      return `
        <article class="sync-stage ${escapeAttribute(stage.status || "pending")}">
          <strong>${escapeHtml(stage.label)}</strong>
          <small>${escapeHtml(detail)}</small>
          <div class="sync-stage-meter"><span style="width: ${Math.max(0, Math.min(100, percent))}%"></span></div>
        </article>
      `;
    })
    .join("");
}

function renderTraitGuide() {
  if (!refs.traitGuideSummary || !refs.traitGuideSteps) {
    return;
  }

  const targetTraits = parseTraitList(state.traitTargetText);
  const parent1Traits = parseTraitList(state.traitParent1Text);
  const parent2Traits = parseTraitList(state.traitParent2Text);
  const goalSlots = TRAIT_GOAL_SLOT_COUNTS[state.traitGoal] || 4;

  if (!targetTraits.length) {
    refs.traitGuideSummary.innerHTML = [
      renderGuideCard("目标词条", "0", "先填目标", "先把你想毕业的词条写进去，再用下面的建议去拆亲本分工。"),
      renderGuideCard("建议方向", "起步", "先定模板", TRAIT_ROLE_HINTS[state.traitRole] || TRAIT_ROLE_HINTS.general),
      renderGuideCard("常用写法", "示例", "每行一个", "比如：工匠精神 / 社畜 / 认真 / 节食"),
    ].join("");
    refs.traitGuideSteps.innerHTML = `
      <article class="tip-card">
        <h3>先输入目标词条</h3>
        <p>支持换行、中文逗号、英文逗号或顿号分隔。你也可以先点上面的模板，把常见毕业词条直接带进来。</p>
      </article>
    `;
    return;
  }

  const focusTraits = targetTraits.slice(0, Math.min(goalSlots, targetTraits.length));
  const parent1Covered = focusTraits.filter((trait) => parent1Traits.includes(trait));
  const parent2Covered = focusTraits.filter((trait) => parent2Traits.includes(trait));
  const combinedCoverage = focusTraits.filter((trait) => parent1Covered.includes(trait) || parent2Covered.includes(trait));
  const missingTraits = focusTraits.filter((trait) => !combinedCoverage.includes(trait));
  const overlapTraits = focusTraits.filter((trait) => parent1Covered.includes(trait) && parent2Covered.includes(trait));
  const parent1Noise = parent1Traits.filter((trait) => !focusTraits.includes(trait));
  const parent2Noise = parent2Traits.filter((trait) => !focusTraits.includes(trait));
  const splitPlan = buildTraitSplitPlan(focusTraits, parent1Covered, parent2Covered);
  const readiness = getTraitReadinessLabel(focusTraits, combinedCoverage, missingTraits, overlapTraits, parent1Noise, parent2Noise);
  const summaryCards = [
    renderGuideCard(
      "目标词条",
      `${focusTraits.length}/${goalSlots}`,
      `本轮按这 ${focusTraits.length} 个来做`,
      focusTraits.join(" / ")
    ),
    renderGuideCard(
      "当前覆盖",
      `${combinedCoverage.length}/${focusTraits.length}`,
      missingTraits.length ? `还缺 ${missingTraits.length} 个` : "已全部覆盖",
      missingTraits.length ? `待补：${missingTraits.join(" / ")}` : "当前两只亲本已经把目标词条都带上了。"
    ),
    renderGuideCard(
      "亲本洁净度",
      `${parent1Noise.length + parent2Noise.length} 条杂词`,
      `A 杂词 ${parent1Noise.length} / B 杂词 ${parent2Noise.length}`,
      buildNoiseMessage(parent1Noise, parent2Noise)
    ),
    renderGuideCard(
      "建议路线",
      readiness.headline,
      readiness.subline,
      `${TRAIT_ROLE_HINTS[state.traitRole] || TRAIT_ROLE_HINTS.general} ${overlapTraits.length ? `当前重复词条：${overlapTraits.join(" / ")}。` : ""}`.trim()
    ),
    renderGuideCard(
      "优先留种",
      suggestKeepTarget(combinedCoverage, parent1Noise, parent2Noise),
      "挑后代时先看这个",
      buildKeepRuleText(focusTraits, combinedCoverage, parent1Noise, parent2Noise)
    ),
    renderGuideCard(
      "建议淘汰",
      suggestSkipTarget(missingTraits, parent1Noise, parent2Noise),
      "这些情况别恋战",
      buildSkipRuleText(missingTraits, parent1Noise, parent2Noise)
    ),
  ];
  refs.traitGuideSummary.innerHTML = summaryCards.join("");

  const steps = buildTraitGuideSteps({
    targetTraits,
    focusTraits,
    goalSlots,
    parent1Traits,
    parent2Traits,
    parent1Covered,
    parent2Covered,
    combinedCoverage,
    missingTraits,
    overlapTraits,
    parent1Noise,
    parent2Noise,
    splitPlan,
  });
  refs.traitGuideSteps.innerHTML = steps
    .map(
      (step) => `
        <article class="tip-card">
          <h3>${escapeHtml(step.title)}</h3>
          <p>${escapeHtml(step.body)}</p>
        </article>
      `
    )
    .join("");
}

function parseTraitList(text) {
  return uniqueStrings(
    String(text || "")
      .split(/[\n,，、/]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function buildTraitSplitPlan(focusTraits, parent1Covered, parent2Covered) {
  const parent1Assigned = [];
  const parent2Assigned = [];
  focusTraits.forEach((trait) => {
    const inParent1 = parent1Covered.includes(trait);
    const inParent2 = parent2Covered.includes(trait);
    if (inParent1 && !inParent2) {
      parent1Assigned.push(trait);
      return;
    }
    if (inParent2 && !inParent1) {
      parent2Assigned.push(trait);
      return;
    }
    if (parent1Assigned.length <= parent2Assigned.length) {
      parent1Assigned.push(trait);
    } else {
      parent2Assigned.push(trait);
    }
  });
  return {
    parent1Assigned,
    parent2Assigned,
  };
}

function getTraitReadinessLabel(focusTraits, combinedCoverage, missingTraits, overlapTraits, parent1Noise, parent2Noise) {
  const totalNoise = parent1Noise.length + parent2Noise.length;
  if (!combinedCoverage.length) {
    return {
      headline: "先做词条源",
      subline: "两只亲本还没带上核心目标",
    };
  }
  if (missingTraits.length) {
    return {
      headline: "先补缺口",
      subline: `优先补出 ${missingTraits.join(" / ")}`,
    };
  }
  if (totalNoise >= focusTraits.length) {
    return {
      headline: "能开配，但先洗杂词",
      subline: "覆盖已经够了，接下来更看杂词条控制",
    };
  }
  if (overlapTraits.length >= Math.max(2, Math.floor(focusTraits.length / 2))) {
    return {
      headline: "可以开始冲",
      subline: "不过两边重复词条偏多，最好继续分流",
    };
  }
  return {
    headline: "适合直接冲毕业",
    subline: "当前覆盖和洁净度都已经比较顺手",
  };
}

function buildNoiseMessage(parent1Noise, parent2Noise) {
  if (!parent1Noise.length && !parent2Noise.length) {
    return "两只亲本目前都很干净，可以优先保留目标更多的子代。";
  }
  const pieces = [];
  if (parent1Noise.length) {
    pieces.push(`A：${parent1Noise.join(" / ")}`);
  }
  if (parent2Noise.length) {
    pieces.push(`B：${parent2Noise.join(" / ")}`);
  }
  return pieces.join("；");
}

function buildTraitGuideSteps(context) {
  const {
    targetTraits,
    focusTraits,
    goalSlots,
    parent1Traits,
    parent2Traits,
    parent1Covered,
    parent2Covered,
    combinedCoverage,
    missingTraits,
    overlapTraits,
    parent1Noise,
    parent2Noise,
    splitPlan,
  } = context;
  const steps = [];

  if (targetTraits.length > goalSlots) {
    steps.push({
      title: "先收窄本轮毕业目标",
      body: `你一共填了 ${targetTraits.length} 个词条，但当前档位只按前 ${focusTraits.length} 个来做：${focusTraits.join(" / ")}。等这轮做稳之后，再补后面的备选词条。`,
    });
  } else {
    steps.push({
      title: "先把目标拆成两边亲本分工",
      body: `建议亲本 A 主带 ${formatTraitBucket(splitPlan.parent1Assigned)}，亲本 B 主带 ${formatTraitBucket(splitPlan.parent2Assigned)}。尽量让每只亲本只承担 1 到 2 个核心词条，后代会更干净。`,
    });
  }

  if (missingTraits.length) {
    steps.push({
      title: "先补出缺失词条源",
      body: `当前还缺 ${missingTraits.join(" / ")}。先去做只带这些词条的过渡体，再回来和现有亲本合并，不要直接拿大杂烩亲本硬冲。`,
    });
  } else {
    steps.push({
      title: "当前两只亲本已经能覆盖目标",
      body: `覆盖词条：${combinedCoverage.join(" / ")}。这时可以开始连续配种，优先保留“目标词条更多、杂词条更少”的子代，逐步替换掉更脏的亲本。`,
    });
  }

  if (parent1Noise.length || parent2Noise.length) {
    const dirtierParent = parent1Noise.length >= parent2Noise.length ? "亲本 A" : "亲本 B";
    const dirtierNoise = parent1Noise.length >= parent2Noise.length ? parent1Noise : parent2Noise;
    steps.push({
      title: "优先清理更脏的一边",
      body: `${dirtierParent} 当前杂词条更多：${dirtierNoise.join(" / ")}。建议先用目标覆盖相近、但更干净的后代把这一边替掉，再继续冲更高词条数。`,
    });
  } else {
    steps.push({
      title: "先留干净种，再冲更高词条",
      body: "两只亲本都没有明显杂词条，可以优先留住覆盖最多的干净后代。尤其是四词条毕业时，先稳定 2 到 3 词条过渡体，会比直接硬冲更省时间。",
    });
  }

  if (overlapTraits.length) {
    steps.push({
      title: "重复词条不等于更赚",
      body: `两边都带着 ${overlapTraits.join(" / ")}。重复能保底，但不会增加新覆盖；如果你卡很久，优先把其中一边换成“补位型”亲本，效率通常更高。`,
    });
  }

  steps.push({
    title: "留种规则",
    body: `${TRAIT_ROLE_HINTS[state.traitRole] || TRAIT_ROLE_HINTS.general} 每次看后代时，先看目标词条覆盖，再看杂词条，最后才看性格是否完全毕业。`,
  });

  steps.push({
    title: "实战筛选顺序",
    body: `推荐按这个顺序筛：1. 是否带到 ${formatTraitBucket(focusTraits.slice(0, Math.min(goalSlots, focusTraits.length)))}；2. 杂词条有没有继续变少；3. 是否能替掉更脏的那只亲本。这样最不容易在中间代上浪费时间。`,
  });

  return steps;
}

function formatTraitBucket(list) {
  return list.length ? list.join(" / ") : "待补位";
}

function renderGuideCard(title, value, label, body) {
  return `
    <article class="guide-card">
      <h4>${escapeHtml(title)}</h4>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(label)}</p>
      <p>${escapeHtml(body)}</p>
    </article>
  `;
}

function suggestKeepTarget(combinedCoverage, parent1Noise, parent2Noise) {
  if (!combinedCoverage.length) {
    return "先做词条源";
  }
  const totalNoise = parent1Noise.length + parent2Noise.length;
  if (combinedCoverage.length >= 3 && totalNoise <= 2) {
    return "高覆盖干净种";
  }
  if (combinedCoverage.length >= 2) {
    return "核心词条优先";
  }
  return "先保底覆盖";
}

function buildKeepRuleText(focusTraits, combinedCoverage, parent1Noise, parent2Noise) {
  const totalNoise = parent1Noise.length + parent2Noise.length;
  if (!combinedCoverage.length) {
    return `先优先留下能带来新目标词条的后代，哪怕当前只补到 ${focusTraits[0]} 这一条也值得留。`;
  }
  if (combinedCoverage.length >= focusTraits.length && totalNoise <= 1) {
    return "如果后代已经带齐目标词条，并且只剩 0 到 1 条杂词，这种就可以直接当毕业候选。";
  }
  return `优先留“目标词条更多、杂词更少”的后代。当前最值得追的是：${combinedCoverage.join(" / ")}。`;
}

function suggestSkipTarget(missingTraits, parent1Noise, parent2Noise) {
  const totalNoise = parent1Noise.length + parent2Noise.length;
  if (missingTraits.length >= 2) {
    return "缺口太大";
  }
  if (totalNoise >= 4) {
    return "杂词过多";
  }
  return "重复但不补位";
}

function buildSkipRuleText(missingTraits, parent1Noise, parent2Noise) {
  const totalNoise = parent1Noise.length + parent2Noise.length;
  if (missingTraits.length >= 2) {
    return `如果后代仍然缺 ${missingTraits.join(" / ")} 这类核心词条，就别在这一代停太久，继续回去补词条源更划算。`;
  }
  if (totalNoise >= 4) {
    return "如果后代虽然覆盖多，但杂词条一直压不下去，通常说明亲本太脏，直接换更干净的中间代更省。";
  }
  return "如果后代只是重复已有词条、却没有补到新目标词条，这种通常不值得久留。";
}

function compareDisplayNo(left, right) {
  const leftNumber = Number.parseInt(String(left || "").replace(/\D/g, ""), 10);
  const rightNumber = Number.parseInt(String(right || "").replace(/\D/g, ""), 10);
  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }
  return String(left || "").localeCompare(String(right || ""), "zh-CN", { numeric: true, sensitivity: "base" });
}

function mergePalworldData(baseData, syncData) {
  if (!baseData) {
    return null;
  }

  const usableSync = Boolean(
    syncData
      && ((syncData.pals && Object.keys(syncData.pals).length > 0)
        || (syncData.jobRankings && Object.keys(syncData.jobRankings).length > 0))
  );

  const mergedPals = baseData.pals.map((pal) => {
    const synced = usableSync ? syncData.pals?.[pal.code] : null;
    return {
      ...pal,
      work: { ...pal.work, ...(synced?.work || {}) },
      elements: uniqueStrings(synced?.elements || pal.elements || []),
      habitat: synced?.habitat || null,
      partnerSkill: synced?.partnerSkill || null,
      drops: synced?.drops || [],
      spawns: synced?.spawns || [],
      palPageUrl: synced?.palPageUrl || pal.palPageUrl,
    };
  });

  const syncSources = usableSync
    ? [
        {
          label: `paldb.cc 本地同步缓存（${formatSyncStamp(syncData.meta?.syncedAt) || "未知时间"}）`,
          url: syncData.meta?.sourceUrl || "https://paldb.cc/en/Pals",
        },
      ]
    : [];

  return {
    ...baseData,
    pals: mergedPals,
    syncMeta: usableSync ? syncData.meta || null : null,
    jobRankings: usableSync ? syncData.jobRankings || {} : {},
    sources: [...syncSources, ...(baseData.sources || [])],
  };
}

function uniqueStrings(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
