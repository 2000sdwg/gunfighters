(function () {
  const G = (window.G = window.G || {});

  const STORAGE_KEY = 'gunfighter_keybinds_v1';
  const SETTINGS_KEY = 'gunfighter_settings_v1';
  const PROGRESS_KEY = 'gunfighter_progress_v1';

  const DEFAULT_KEYS = {
    cock: 'ShiftLeft',
    cover: 'Space',
    roll: 'Space',
    interact: 'KeyE',
    bandage: 'KeyQ'
  };

  // Каталог сменных шляп (открываются за убийства, хранятся в localStorage)
  G.HATS = [
    { id: 'classic',    name: 'Классическая ковбойская', kills: 0,  desc: 'Проверенная временем фетровая шляпа' },
    { id: 'gunslinger', name: 'Потрёпанная шляпа стрелка', kills: 5,  desc: 'Выгоревшие поля с боевым заломом' },
    { id: 'sheriff',    name: 'Шляпа шерифа',            kills: 15, desc: 'Латунная лента и звезда закона' },
    { id: 'bowler',     name: 'Котелок джентльмена',      kills: 25, desc: 'Городской шик прерий с алой лентой' },
    { id: 'sombrero',   name: 'Сомбреро',                 kills: 40, desc: 'Широкие расшитые поля от палящего солнца' },
    { id: 'legend',     name: 'Шляпа Легенды Полудня',    kills: 60, desc: 'Тёмный силуэт с золотой окантовкой' }
  ];

  // Единая расширенная 5-ступенчатая палитра по референсам (тёплое солнце + прохладные тени)
  G.PAL = {
    // Пыльная дорога и сухая земля (5 тонов: от выжженного песка до глубокой колеи)
    dirt: ['#cbb58e', '#b39a72', '#977d58', '#786041', '#54412b'],
    // Терракота и камень каньона
    canyon: ['#b8845c', '#996544', '#7b4c32', '#5b3623', '#3b2115'],
    // Серые сланцевые камни и булыжники у обочин
    stone: ['#9c998e', '#7e7c73', '#616059', '#454540', '#2b2b28'],
    // Золотистая сухая трава (референсы 1–3)
    grass: ['#e3c068', '#c89e45', '#a37b2f', '#785820', '#4f3814'],
    // Полынь, кусты и оливковая листва (референс 3)
    foliage: ['#8ea164', '#6d824d', '#50643b', '#38472b', '#222c1b'],
    // Амбарный бордовый фасад (референсы 1 и 2)
    barnRed: ['#a83c2e', '#862a20', '#631d17', '#42120f', '#260a08'],
    // Сланцево-бирюзовый фасад (референсы 1 и 2)
    slateTeal: ['#6b9196', '#4d7075', '#365257', '#24383c', '#152225'],
    // Выгоревшее на солнце серебристо-бежевое дерево (референсы 1 и 3)
    woodPale: ['#b8ab93', '#968770', '#756652', '#524637', '#332b22'],
    // Тёплое старое дерево салуна, стоек и настилов
    woodWarm: ['#8f633e', '#724c2d', '#573820', '#3d2616', '#26170d'],
    // Серая дранка / черепица крыш (референсы 2 и 3)
    shingle: ['#8f8a80', '#706c64', '#55524c', '#3c3935', '#242220'],
    // Небо и отражение в воде (приглушённая бирюза + кремовые облака)
    water: ['#7ba4ad', '#56808c', '#3b616e', '#26434f', '#172b33'],
    cloud: ['#e8e3d5', '#cfc8b6', '#a8a293'],
    // Кровь (смачные пиксельные брызги)
    blood: ['#c9241c', '#991812', '#6e100c', '#450907'],

    // 5-ступенчатые рампы материалов (от [0] блика к [4] тени)
    steelLight: ['#e3dfd5', '#bab6ac', '#8b8880', '#5c5a54', '#33312e'], // полированная сталь (Walker, блики)
    steelDark:  ['#9ea6b0', '#707882', '#4c535c', '#2f343b', '#1a1d21'], // воронёная сталь (Lightning, Winchester)
    brass:      ['#f2da91', '#d6ae52', '#ad8232', '#78561d', '#422d0e'], // латунь (коробка, гильзы, декор бара)
    lead:       ['#b8b4ad', '#8f8b85', '#696661', '#474542', '#292726'], // свинец (пули, капсюли, фурнитура)
    leather:    ['#8f6544', '#6b472d', '#4c311e', '#332013', '#1c110a'], // кожа (шляпы, ремни, сапоги)
    cloth:      ['#4f5e6e', '#35424f', '#232d38', '#171e26', '#0e1318'], // ткань (плащ героя)
    skin:       ['#deb592', '#c49876', '#9e7456', '#75533c', '#4a3223'], // руки и лицо
    glass:      ['#b8d4d9', '#7ba4ad', '#4d7075', '#2c474f', '#17262b'], // стекло окон и блики
    outline:    '#140f0c'                                                // единый тёмно-умбровый контур
  };

  // Профили сложности AI бандитов
  G.BOT_DIFFICULTY = {
    easy: {
      id: 'easy',
      label: 'Лёгкий',
      reactMult: 1.45,
      dodgeSkill: 0.25,
      spreadMult: 1.55,
      tacticalCover: 0.35,
      avoidFriendlyFire: false,
      shootCooldownMult: 1.35
    },
    medium: {
      id: 'medium',
      label: 'Средний',
      reactMult: 1.0,
      dodgeSkill: 0.65,
      spreadMult: 1.0,
      tacticalCover: 0.78,
      avoidFriendlyFire: 0.55,
      shootCooldownMult: 1.0
    },
    hard: {
      id: 'hard',
      label: 'Тяжёлый',
      reactMult: 0.72,
      dodgeSkill: 1.0,
      spreadMult: 0.75,
      tacticalCover: 1.0,
      avoidFriendlyFire: true,
      shootCooldownMult: 0.85
    }
  };

  G.CFG = {
    // Внутреннее пиксельное разрешение (низкорезный буфер для честного пиксель-арта без мыла)
    zoom: 2.0,
    pixelZoom: 2.0,

    playerRadius: 10,
    playerMaxHp: 100,
    spawnBandits: true,

    // Боты: сложность, меткость 0..1, лимит живых врагов, интервал спавна и пауза
    botDifficulty: 'hard',
    botAccuracy: 0.55,
    pauseSpawn: false,
    botMaxAlive: 5,
    botSpawnInterval: 12.0,

    walkSpeed: 105,
    focusSpeed: 58,
    reloadSpeed: 52,

    // Быстрый тактический перекат (~41 px) — резкий и отзывчивый темп
    rollDur: 0.24,
    rollSpeed: 170,
    rollCooldown: 0.45,
    rollEndSpread: 0.11,

    // Укрытия
    coverDetectDist: 28,
    coverPeekOffset: 13,

    // Слайдеры физики и звука
    phys: {
      inertia: 1.0,
      recoil: 1.0,
      spring: 1.0,
      echo: 1.0
    },

    keys: { ...DEFAULT_KEYS },
    debugRays: false,
    godMode: false,

    // Прогресс игрока (убийства, награды и выбранная шляпа)
    kills: 0,
    selectedHat: 'classic',
    unlocks: [],
    playerName: 'СТРЕЛОК'
  };

  G.loadKeys = function () {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        G.CFG.keys = { ...DEFAULT_KEYS, ...parsed };
      }
    } catch (_) {
      G.CFG.keys = { ...DEFAULT_KEYS };
    }
  };

  G.saveKeys = function () {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(G.CFG.keys));
    } catch (_) {}
  };

  G.resetKeys = function () {
    G.CFG.keys = { ...DEFAULT_KEYS };
    G.saveKeys();
  };

  // ==================== СОХРАНЕНИЕ ИГРОВЫХ НАСТРОЕК (МЕТКОСТЬ БОТОВ / СПАВН / ФИЗИКА) ====================

  G.getBotDiffProfile = function () {
    const key = G.CFG.botDifficulty || 'hard';
    return (G.BOT_DIFFICULTY && G.BOT_DIFFICULTY[key]) || G.BOT_DIFFICULTY.medium;
  };

  G.loadSettings = function () {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s.botDifficulty === 'string' && G.BOT_DIFFICULTY && G.BOT_DIFFICULTY[s.botDifficulty]) {
        G.CFG.botDifficulty = s.botDifficulty;
      }
      if (typeof s.botAccuracy === 'number') {
        G.CFG.botAccuracy = G.MATH.clamp(s.botAccuracy, 0, 1);
      }
      if (typeof s.botMaxAlive === 'number') {
        G.CFG.botMaxAlive = Math.round(G.MATH.clamp(s.botMaxAlive, 0, 15));
      }
      if (typeof s.botSpawnInterval === 'number') {
        G.CFG.botSpawnInterval = G.MATH.clamp(s.botSpawnInterval, 3, 30);
      }
      if (typeof s.pauseSpawn === 'boolean') G.CFG.pauseSpawn = s.pauseSpawn;
      if (typeof s.spawnBandits === 'boolean') G.CFG.spawnBandits = s.spawnBandits;
      if (typeof s.godMode === 'boolean') G.CFG.godMode = s.godMode;
      if (typeof s.playerName === 'string' && s.playerName.trim()) {
        G.CFG.playerName = s.playerName.trim().slice(0, 18);
      }
      if (s.phys && typeof s.phys === 'object') {
        ['inertia', 'recoil', 'spring', 'echo'].forEach((k) => {
          if (typeof s.phys[k] === 'number') G.CFG.phys[k] = s.phys[k];
        });
      }
    } catch (_) {}
  };

  G.saveSettings = function () {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        botDifficulty: G.CFG.botDifficulty || 'hard',
        botAccuracy: G.CFG.botAccuracy,
        botMaxAlive: G.CFG.botMaxAlive,
        botSpawnInterval: G.CFG.botSpawnInterval,
        pauseSpawn: G.CFG.pauseSpawn,
        spawnBandits: G.CFG.spawnBandits,
        godMode: !!G.CFG.godMode,
        playerName: G.CFG.playerName || 'СТРЕЛОК',
        phys: { ...G.CFG.phys }
      }));
    } catch (_) {}
  };

  // ==================== ПРОГРЕСС (УБИЙСТВА И ШЛЯПЫ) ====================

  G.getHatDef = function (id) {
    for (let i = 0; i < G.HATS.length; i++) {
      if (G.HATS[i].id === id) return G.HATS[i];
    }
    return G.HATS[0];
  };

  G.isHatUnlocked = function (id) {
    const def = G.getHatDef(id);
    return (G.CFG.kills || 0) >= (def.kills || 0);
  };

  G.isUnlocked = function (key, state) {
    if (!key) return true;
    const isStory = !!(state && state.storyMode);
    if (!isStory) return true;
    const list = (G.CFG && Array.isArray(G.CFG.unlocks)) ? G.CFG.unlocks : [];
    return list.indexOf(key) !== -1;
  };

  G.grantUnlock = function (key) {
    if (!key) return false;
    if (!Array.isArray(G.CFG.unlocks)) G.CFG.unlocks = [];
    if (G.CFG.unlocks.indexOf(key) === -1) {
      G.CFG.unlocks.push(String(key));
      G.saveProgress();
      return true;
    }
    return false;
  };

  G.saveProgress = function () {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({
        kills: G.CFG.kills || 0,
        selectedHat: G.CFG.selectedHat || 'classic',
        unlocks: Array.isArray(G.CFG.unlocks) ? G.CFG.unlocks : []
      }));
    } catch (_) {}
  };

  G.loadProgress = function () {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (typeof p.kills === 'number' && isFinite(p.kills)) {
        G.CFG.kills = Math.max(0, Math.floor(p.kills));
      }
      if (typeof p.selectedHat === 'string') {
        const def = G.getHatDef(p.selectedHat);
        G.CFG.selectedHat = G.isHatUnlocked(def.id) ? def.id : 'classic';
      }
      if (Array.isArray(p.unlocks)) {
        G.CFG.unlocks = p.unlocks.filter((u) => typeof u === 'string' && u.length > 0);
      }
    } catch (_) {}
  };

  G.setSelectedHat = function (id) {
    if (!G.isHatUnlocked(id)) return false;
    G.CFG.selectedHat = G.getHatDef(id).id;
    G.saveProgress();
    return true;
  };

  G.addKill = function (delta) {
    const prev = G.CFG.kills || 0;
    const next = prev + Math.max(1, delta || 1);
    G.CFG.kills = next;
    G.saveProgress();
    const unlocked = [];
    for (let i = 0; i < G.HATS.length; i++) {
      const h = G.HATS[i];
      if (h.kills > prev && h.kills <= next) unlocked.push(h);
    }
    return unlocked;
  };

  G.matchesKey = function (action, code) {
    const bound = G.CFG.keys[action];
    if (!bound) return false;
    if (bound === 'ShiftLeft' || bound === 'ShiftRight') {
      return code === 'ShiftLeft' || code === 'ShiftRight';
    }
    if (bound === 'ControlLeft' || bound === 'ControlRight') {
      return code === 'ControlLeft' || code === 'ControlRight';
    }
    return code === bound;
  };

  G.keyLabel = function (code) {
    if (!code) return '—';
    if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
    if (code === 'ControlLeft' || code === 'ControlRight') return 'Ctrl';
    if (code === 'Space') return 'Пробел';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    return code;
  };

  // Перебалансированный арсенал (логичный урон, падение урона по дистанции и заметно разный разброс):
  // 1) Colt Walker (SA, .44) — 50 урона (2 выстрела), средний разброс, сильная отдача, хорош на средней дистанции
  // 2) Colt 1877 Lightning (DA, .38) — 28 урона (3-4 выстрела), широкий разброс, спад урона вдаль, король тесных комнат
  // 3) Winchester 1873 (.44-40) — 92 урона (ваншот обычного бандита), кучный с ПКМ, но тяжёлый на ходу и упирается в стены
  G.WEAPONS = [
    {
      id: 'walker',
      name: 'Colt Walker (SA)',
      action: 'sa',
      capacity: 6,
      barrelLen: 19,
      wallCheckLen: 21,
      weight: 1.18,
      springK: 162,
      damping: 15.2,
      recoilKick: 0.28,
      recoilPush: 6.0,

      // Ощутимый револьверный разброс: от бедра гуляет, с ПКМ собирается в рабочую кучу
      baseSpread: 0.044,
      moveSpread: 0.098,
      focusMult: 0.46,
      bloomPerShot: 0.075,
      bloomDecay: 0.14,
      maxSpread: 0.28,

      cockTime: 0.22,
      reloadOneTime: 0.23,

      // Логичный урон тяжёлого .44 револьвера (2 попадания по бандиту)
      damage: 50,
      falloffStart: 220,
      falloffEnd: 460,
      falloffMinMult: 0.68,
      bulletSpeed: 960,
      penetration: 1,

      soundType: 'walker',
      colorSteel: '#c8c4bc',
      colorGrip: '#6e4527',
      uiShape: 'cylinder'
    },
    {
      id: 'lightning',
      name: 'Colt 1877 Lightning (DA)',
      action: 'da',
      capacity: 6,
      barrelLen: 14,
      wallCheckLen: 16,
      weight: 0.72,
      springK: 230,
      damping: 18.5,
      recoilKick: 0.19,
      recoilPush: 3.6,

      // Широкий ближнебойный разброс + увод от тугого самовзвода
      baseSpread: 0.085,
      moveSpread: 0.130,
      focusMult: 0.64,
      bloomPerShot: 0.095,
      bloomDecay: 0.13,
      maxSpread: 0.34,

      triggerPullTime: 0.095,
      triggerTug: 0.048,
      daCooldown: 0.40,
      reloadOneTime: 0.20,

      // Лёгкий короткоствол .38: 3 выстрела вблизи, ощутимый спад урона на дистанции
      damage: 28,
      falloffStart: 130,
      falloffEnd: 310,
      falloffMinMult: 0.52,
      bulletSpeed: 810,
      penetration: 0,

      soundType: 'lightning',
      colorSteel: '#5d636b',
      colorGrip: '#3b2b20',
      uiShape: 'cylinder'
    },
    {
      id: 'winchester',
      name: 'Winchester 1873',
      action: 'lever',
      capacity: 8,
      barrelLen: 33,
      wallCheckLen: 35,
      weight: 1.62,
      springK: 108,
      damping: 10.8,
      recoilKick: 0.23,
      recoilPush: 5.2,

      // На ходу и от бедра заметно мажет, но с ПКМ стоя даёт почти снайперскую кучность
      baseSpread: 0.024,
      moveSpread: 0.155,
      focusMult: 0.22,
      bloomPerShot: 0.055,
      bloomDecay: 0.13,
      maxSpread: 0.30,

      cockTime: 0.36,
      reloadOneTime: 0.24,

      // Мощный винтовочный калибр: 1 точный выстрел валит обычного бандита даже через каньон
      damage: 92,
      falloffStart: 500,
      falloffEnd: 820,
      falloffMinMult: 0.88,
      bulletSpeed: 1280,
      penetration: 2,

      soundType: 'winchester',
      colorSteel: '#6c7075',
      colorBrass: '#c99b49',
      colorGrip: '#754726',
      uiShape: 'tube'
    }
  ];

  // Математика и единый сегментный рейкастер
  G.MATH = {
    clamp(v, min, max) {
      return v < min ? min : v > max ? max : v;
    },
    lerp(a, b, t) {
      return a + (b - a) * t;
    },
    rand(min, max) {
      return min + Math.random() * (max - min);
    },
    makeRng(seed) {
      let s = (seed || 1) >>> 0;
      return function () {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
      };
    },
    dist(x1, y1, x2, y2) {
      return Math.hypot(x2 - x1, y2 - y1);
    },
    normAngle(a) {
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return a;
    },
    angleDiff(from, to) {
      return G.MATH.normAngle(to - from);
    },
    raySegment(ox, oy, dx, dy, maxDist, x1, y1, x2, y2) {
      const sx = x2 - x1;
      const sy = y2 - y1;
      const denom = dx * sy - dy * sx;
      if (Math.abs(denom) < 1e-7) return null;
      const qpx = x1 - ox;
      const qpy = y1 - oy;
      const t = (qpx * sy - qpy * sx) / denom;
      const u = (qpx * dy - qpy * dx) / denom;
      if (t >= 0 && t <= maxDist && u >= 0 && u <= 1) {
        const len = Math.hypot(sx, sy) || 1;
        let nx = -sy / len;
        let ny = sx / len;
        if (nx * dx + ny * dy > 0) {
          nx = -nx;
          ny = -ny;
        }
        return { dist: t, x: ox + dx * t, y: oy + dy * t, nx, ny };
      }
      return null;
    },
    raycastSegments(ox, oy, dx, dy, maxDist, segments) {
      let best = null;
      let curMax = maxDist;
      let rMinX = ox;
      let rMaxX = ox;
      let rMinY = oy;
      let rMaxY = oy;
      const ex = ox + dx * maxDist;
      const ey = oy + dy * maxDist;
      if (ex < rMinX) rMinX = ex; else rMaxX = ex;
      if (ey < rMinY) rMinY = ey; else rMaxY = ey;

      for (let i = 0; i < segments.length; i++) {
        const s = segments[i];
        if (s.maxX !== undefined && (s.maxX < rMinX || s.minX > rMaxX || s.maxY < rMinY || s.minY > rMaxY)) {
          continue;
        }
        const hit = G.MATH.raySegment(ox, oy, dx, dy, curMax, s.x1, s.y1, s.x2, s.y2);
        if (hit) {
          hit.seg = s;
          best = hit;
          curMax = hit.dist;
        }
      }
      return best;
    },
    circleRectPush(cx, cy, r, rect) {
      const nearX = G.MATH.clamp(cx, rect.x, rect.x + rect.w);
      const nearY = G.MATH.clamp(cy, rect.y, rect.y + rect.h);
      const dx = cx - nearX;
      const dy = cy - nearY;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) return { x: cx, y: cy, hit: false };
      const d = Math.sqrt(d2);
      if (d > 1e-4) {
        const push = r - d;
        return { x: cx + (dx / d) * push, y: cy + (dy / d) * push, hit: true };
      }
      const left = cx - rect.x;
      const right = rect.x + rect.w - cx;
      const top = cy - rect.y;
      const bottom = rect.y + rect.h - cy;
      const m = Math.min(left, right, top, bottom);
      if (m === left) return { x: rect.x - r, y: cy, hit: true };
      if (m === right) return { x: rect.x + rect.w + r, y: cy, hit: true };
      if (m === top) return { x: cx, y: rect.y - r, hit: true };
      return { x: cx, y: rect.y + rect.h + r, hit: true };
    }
  };

  G.createWeaponState = function (w) {
    return {
      ammo: w.capacity,
      spent: 0,
      cocked: true,
      chamberSpent: false,
      cockTimer: 0,
      cockDuration: w.cockTime || 0,
      leverEjected: false,
      daPullTimer: 0,
      daCooldownTimer: 0,
      reloading: false,
      insertAnim: 0
    };
  };

  G.createPlayerState = function (id, x, y, opts) {
    opts = opts || {};
    const pid = id || 'local';
    const defSp = (G.WORLD_LAYOUT && G.WORLD_LAYOUT.playerSpawn) || { x: 215, y: 400 };
    const px = x !== undefined ? x : defSp.x;
    const py = y !== undefined ? y : defSp.y;
    return {
      id: pid,
      name: (opts.name || G.CFG.playerName || 'СТРЕЛОК').slice(0, 18),
      isLocal: opts.isLocal !== undefined ? !!opts.isLocal : (pid === 'local'),
      hatId: opts.hatId || G.CFG.selectedHat || 'classic',
      coatColor: opts.coatColor || null,
      coatTrim: opts.coatTrim || null,
      bandanaColor: opts.bandanaColor || null,

      x: px,
      y: py,
      hp: 100,
      maxHp: 100,
      dead: false,
      respawnTimer: 0,
      hurtTimer: 0,
      regenTimer: 0,
      vx: 0,
      vy: 0,
      speed: 0,
      aimAngle: 0,
      aimVel: 0,
      targetAngle: 0,
      spread: 0.044,
      bloom: 0,
      breathPhase: 0,
      walkPhase: 0,
      wallBlocked: false,
      wallHitDist: 999,
      wallRaiseFrac: 0,
      flashTimer: 0,
      recoilKickAnim: 0,

      rolling: false,
      rollTimer: 0,
      rollCooldown: 0,
      rollDx: 0,
      rollDy: 0,
      stunTimer: 0,
      snakeSlowTimer: 0,
      fireDmgCd: 0,
      mountedHorse: false,
      knockVx: 0,
      knockVy: 0,
      doorHitCd: 0,

      inCover: false,
      peeking: false,
      peekFrac: 0,
      peekSide: 1,
      coverFrac: 0,
      crouchFrac: 0,
      coverObj: null,
      coverNormalX: 0,
      coverNormalY: 0,
      nearCover: null,
      nearInteractable: null,

      idleTimer: 0,
      smokingState: null,
      smokeAnimTime: 0,

      // Критическое состояние, кровотечение, контузия и бинты
      critical: false,
      bleeding: false,
      bleedDripTimer: 0,
      concussion: 0,
      indoorRingTimer: 0,
      bandages: 2,
      maxBandages: 3,
      bandaging: false,
      bandageTimer: 0,
      bandageDur: 2.5,
      drinking: false,
      drinkTimer: 0,
      drinkDur: 1.8,

      kills: 0,
      deaths: 0,

      weaponIdx: 0,
      weapons: G.WEAPONS.map(G.createWeaponState),

      input: {
        keys: {},
        worldMouseX: px + 60,
        worldMouseY: py,
        lmb: false,
        rmb: false
      }
    };
  };

  G.syncPlayersCache = function (state) {
    if (!state) return [];
    if (!state._playersArr) state._playersArr = [];
    const arr = state._playersArr;
    arr.length = 0;
    if (state.players) {
      for (const k in state.players) {
        const pl = state.players[k];
        if (pl) arr.push(pl);
      }
    } else if (state.player) {
      arr.push(state.player);
    }
    return arr;
  };

  G.getPlayersList = function (state) {
    if (!state) return [];
    if (state._playersArr && state.players) {
      let cnt = 0;
      for (const k in state.players) {
        if (state.players[k]) cnt++;
      }
      if (cnt === state._playersArr.length) return state._playersArr;
    }
    return G.syncPlayersCache(state);
  };

  G.createInitialState = function () {
    const localId = 'local';
    const defSp = (G.WORLD_LAYOUT && G.WORLD_LAYOUT.playerSpawn) || { x: 215, y: 400 };
    const localPlayer = G.createPlayerState(localId, defSp.x, defSp.y, {
      isLocal: true,
      name: G.CFG.playerName || 'СТРЕЛОК',
      hatId: G.CFG.selectedHat || 'classic'
    });

    const state = {
      time: 0,
      zone: 'saloon',
      zoneLabel: 'САЛУН',
      echoDesc: 'ЗАКРЫТОЕ ПОМЕЩЕНИЕ',
      localPlayerId: localId,
      screen: 'menu', // 'menu' | 'playing' | 'paused' | 'editor'
      storyMode: false,
      currentMapId: 'default',
      currentMapName: 'Полуденный городок (Стандартная)',
      players: {
        [localId]: localPlayer
      },
      _playersArr: [localPlayer],
      mpMode: 'coop', // 'coop' | 'pvp'
      friendlyFire: false,
      netRole: 'offline', // 'offline' | 'host' | 'client'
      input: {
        keys: {},
        mouseX: 0,
        mouseY: 0,
        worldMouseX: defSp.x + 60,
        worldMouseY: defSp.y,
        lmb: false,
        rmb: false,
        rebindingAction: null
      },
      camera: {
        x: defSp.x,
        y: defSp.y,
        shakeX: 0,
        shakeY: 0,
        shakeMag: 0
      },
      bullets: [],
      shells: [],
      bloodDrops: [],
      bloodTrail: [],
      flyingHats: [],
      waterRipples: [],
      particles: [],
      decals: [],
      gunSmokeClouds: [],
      smokeFlashes: [],
      debugRays: [],
      toast: { text: '', timer: 0 },
      nearInteractable: null,
      hatMenuOpen: false,
      saloonProps: {
        bourbonAvailable: true,
        bourbonInHand: false
      },
      fleeCooldown: 0,
      dustStorm: {
        active: false,
        intensity: 0,
        timer: 0,
        duration: 0,
        cooldown: 36,
        tumbleweeds: []
      },
      editor: {
        active: false,
        tool: 'place', // 'place' | 'move' | 'erase'
        tab: 'objects', // 'terrain' | 'buildings' | 'objects' | 'npc'
        selectedType: 'crate',
        rotated: false,
        gridStep: 4,
        brushSize: 1,
        selectedEntity: null,
        pendingTagId: '',
        pendingRequiresUnlock: '',
        hoverSolidId: null,
        hoverEntity: null,
        camX: 250,
        camY: 360
      },
      viewRect: null,
      waves: {
        active: false,
        wave: 0,
        phase: 'idle', // 'idle' | 'fighting' | 'break'
        breakTimer: 0,
        totalSpawned: 0
      }
    };

    // Обратная совместимость: state.player всегда указывает на локального игрока
    Object.defineProperty(state, 'player', {
      get() {
        return (this.players && this.players[this.localPlayerId]) || (this.players && Object.values(this.players)[0]) || null;
      },
      set(val) {
        if (val && this.players) {
          this.players[this.localPlayerId] = val;
        }
      },
      enumerable: true,
      configurable: true
    });

    return state;
  };

  G.loadKeys();
  G.loadSettings();
  G.loadProgress();
})();
