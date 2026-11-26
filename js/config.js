(function () {
  const G = (window.G = window.G || {});

  const STORAGE_KEY = 'gunfighter_keybinds_v1';
  const SETTINGS_KEY = 'gunfighter_settings_v1';

  const DEFAULT_KEYS = {
    cock: 'ShiftLeft',
    cover: 'Space',
    roll: 'Space'
  };

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

  G.CFG = {
    // Внутреннее пиксельное разрешение (низкорезный буфер для честного пиксель-арта без мыла)
    zoom: 2.0,
    pixelZoom: 2.0,

    playerRadius: 10,
    playerMaxHp: 100,
    spawnBandits: true,

    // Боты: меткость 0..1 (влияет на разброс их выстрелов) и остановка появления новых
    botAccuracy: 0.55,
    pauseSpawn: false,
    botMaxAlive: 6,
    botSpawnInterval: 7.0,

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
    debugRays: false
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

  G.loadSettings = function () {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s.botAccuracy === 'number') {
        G.CFG.botAccuracy = G.MATH.clamp(s.botAccuracy, 0, 1);
      }
      if (typeof s.pauseSpawn === 'boolean') G.CFG.pauseSpawn = s.pauseSpawn;
      if (typeof s.spawnBandits === 'boolean') G.CFG.spawnBandits = s.spawnBandits;
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
        botAccuracy: G.CFG.botAccuracy,
        pauseSpawn: G.CFG.pauseSpawn,
        spawnBandits: G.CFG.spawnBandits,
        phys: { ...G.CFG.phys }
      }));
    } catch (_) {}
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
      for (let i = 0; i < segments.length; i++) {
        const s = segments[i];
        const hit = G.MATH.raySegment(ox, oy, dx, dy, best ? best.dist : maxDist, s.x1, s.y1, s.x2, s.y2);
        if (hit) {
          hit.seg = s;
          best = hit;
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

  G.createInitialState = function () {
    return {
      time: 0,
      zone: 'saloon',
      zoneLabel: 'САЛУН',
      echoDesc: 'ЗАКРЫТОЕ ПОМЕЩЕНИЕ',
      input: {
        keys: {},
        mouseX: 0,
        mouseY: 0,
        worldMouseX: 200,
        worldMouseY: 200,
        lmb: false,
        rmb: false,
        rebindingAction: null
      },
      player: {
        x: 150,
        y: 360,
        hp: 100,
        maxHp: 100,
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

        inCover: false,
        peeking: false,
        peekFrac: 0,
        peekSide: 1,
        coverFrac: 0,
        coverObj: null,
        coverNormalX: 0,
        coverNormalY: 0,
        nearCover: null,

        weaponIdx: 0,
        weapons: G.WEAPONS.map(G.createWeaponState)
      },
      camera: {
        x: 150,
        y: 250,
        shakeX: 0,
        shakeY: 0,
        shakeMag: 0
      },
      bullets: [],
      shells: [],
      bloodDrops: [],
      flyingHats: [],
      waterRipples: [],
      particles: [],
      decals: [],
      debugRays: [],
      toast: { text: '', timer: 0 }
    };
  };

  G.loadKeys();
  G.loadSettings();
})();
