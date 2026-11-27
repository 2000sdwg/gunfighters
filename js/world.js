(function () {
  const G = (window.G = window.G || {});

  // Совместимость со старым G.PALETTE, опираясь на новую 5-ступенчатую G.PAL из config.js
  function getPal() {
    if (G.PAL) return G.PAL;
    return {
      dirt: ['#cbb58e', '#b39a72', '#977d58', '#786041', '#54412b'],
      canyon: ['#b8845c', '#996544', '#7b4c32', '#5b3623', '#3b2115'],
      stone: ['#9c998e', '#7e7c73', '#616059', '#454540', '#2b2b28'],
      grass: ['#e3c068', '#c89e45', '#a37b2f', '#785820', '#4f3814'],
      foliage: ['#8ea164', '#6d824d', '#50643b', '#38472b', '#222c1b'],
      barnRed: ['#a83c2e', '#862a20', '#631d17', '#42120f', '#260a08'],
      slateTeal: ['#6b9196', '#4d7075', '#365257', '#24383c', '#152225'],
      woodPale: ['#b8ab93', '#968770', '#756652', '#524637', '#332b22'],
      woodWarm: ['#8f633e', '#724c2d', '#573820', '#3d2616', '#26170d'],
      shingle: ['#8f8a80', '#706c64', '#55524c', '#3c3935', '#242220'],
      water: ['#7ba4ad', '#56808c', '#3b616e', '#26434f', '#172b33'],
      cloud: ['#e8e3d5', '#cfc8b6', '#a8a293'],
      blood: ['#c9241c', '#991812', '#6e100c', '#450907'],
      steelLight: ['#e3dfd5', '#bab6ac', '#8b8880', '#5c5a54', '#33312e'],
      steelDark:  ['#9ea6b0', '#707882', '#4c535c', '#2f343b', '#1a1d21'],
      brass:      ['#f2da91', '#d6ae52', '#ad8232', '#78561d', '#422d0e'],
      lead:       ['#b8b4ad', '#8f8b85', '#696661', '#474542', '#292726'],
      leather:    ['#8f6544', '#6b472d', '#4c311e', '#332013', '#1c110a'],
      cloth:      ['#4f5e6e', '#35424f', '#232d38', '#171e26', '#0e1318'],
      skin:       ['#deb592', '#c49876', '#9e7456', '#75533c', '#4a3223'],
      glass:      ['#b8d4d9', '#7ba4ad', '#4d7075', '#2c474f', '#17262b'],
      outline:    '#140f0c'
    };
  }

  G.PALETTE = {
    roadLight: '#cbb58e',
    roadMid: '#977d58',
    roadWarm: '#786041',
    roadShadow: '#54412b',
    roadGrey: '#968c7a',
    grassBright: '#e3c068',
    grassMid: '#c89e45',
    grassDark: '#785820',
    sageLight: '#6d824d',
    sageMid: '#50643b',
    sageDark: '#38472b',
    flowerRed: '#9e382b',
    barnRed: '#862a20',
    barnRedHi: '#a83c2e',
    barnRedDark: '#42120f',
    slateTeal: '#4d7075',
    slateTealHi: '#6b9196',
    slateTealDark: '#24383c',
    woodBleached: '#968770',
    woodMid: '#756652',
    woodDark: '#42362a',
    shingleLight: '#8f8a80',
    shingleMid: '#55524c',
    shingleDark: '#3c3935',
    canyonLight: '#b8845c',
    canyonMid: '#7b4c32',
    canyonDark: '#5b3623',
    rockGrey: '#7e7c73',
    rockGreyHi: '#9c998e',
    bloodBright: '#c9241c',
    bloodMid: '#991812',
    bloodDark: '#450907'
  };

  // Детерминированный RNG и 2D-шум для органичных переходов и дизеренга
  function makeRng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function hash2(ix, iy) {
    let n = (ix * 374761393 + iy * 668265263) ^ 0x5bf03635;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function smoothNoise(x, y, scale) {
    const fx = x / scale;
    const fy = y / scale;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = fx - ix;
    const ty = fy - iy;
    const ux = tx * tx * (3 - 2 * tx);
    const uy = ty * ty * (3 - 2 * ty);
    const a = hash2(ix, iy);
    const b = hash2(ix + 1, iy);
    const c = hash2(ix, iy + 1);
    const d = hash2(ix + 1, iy + 1);
    return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy;
  }

  // Матрица упорядоченного дизеренга Байера 4x4 (0..1)
  const BAYER4 = [
    0 / 16,  8 / 16,  2 / 16, 10 / 16,
    12 / 16, 4 / 16, 14 / 16,  6 / 16,
    3 / 16, 11 / 16,  1 / 16,  9 / 16,
    15 / 16, 7 / 16, 13 / 16,  5 / 16
  ];

  function bayerAt(x, y) {
    return BAYER4[((y & 3) << 2) | (x & 3)];
  }

  function hexToRgb(hex) {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }

  function pickDithered(palArr, t, x, y) {
    const n = palArr.length - 1;
    const scaled = G.MATH.clamp(t, 0, 0.999) * n;
    const idx = Math.floor(scaled);
    const frac = scaled - idx;
    const chosen = frac > bayerAt(x, y) ? Math.min(n, idx + 1) : idx;
    return palArr[chosen];
  }

  function rectToSegments(rect) {
    const x1 = rect.x;
    const y1 = rect.y;
    const x2 = rect.x + rect.w;
    const y2 = rect.y + rect.h;
    const base = {
      id: rect.id,
      mat: rect.mat || 'wood',
      high: !!rect.high,
      type: rect.type || 'wall',
      isCover: !!rect.isCover,
      solid: rect
    };
    return [
      { ...base, x1: x1, y1: y1, x2: x2, y2: y1 },
      { ...base, x1: x2, y1: y1, x2: x2, y2: y2 },
      { ...base, x1: x2, y1: y2, x2: x1, y2: y2 },
      { ...base, x1: x1, y1: y2, x2: x1, y2: y1 }
    ];
  }

  function toPlayerList(playerOrList) {
    if (!playerOrList) return [];
    if (Array.isArray(playerOrList)) return playerOrList.filter(Boolean);
    if (playerOrList.players) return Object.values(playerOrList.players).filter(Boolean);
    return [playerOrList];
  }

  function nearestPlayer(playerOrList, x, y) {
    const list = toPlayerList(playerOrList);
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!p || p.dead) continue;
      const d = Math.hypot((p.x || 0) - x, (p.y || 0) - y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best || list[0] || null;
  }

  function clearRemovedCoverFromPlayers(state, removed) {
    const list = toPlayerList(state ? (state.players || state.player) : null);
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!removed || p.coverObj === removed) {
        p.inCover = false;
        p.peeking = false;
        p.coverObj = null;
      }
      if (!removed || p.nearCover === removed) {
        p.nearCover = null;
      }
    }
  }

  function initDestructibleProps(s) {
    if (!s) return s;
    if (s.type === 'crate' || s.type === 'table' || s.type === 'hay' || s.type === 'fence') {
      s.destructible = true;
      s.indestructibleCover = true;
      s.breachHp = 180;
      s.maxBreachHp = 180;
      s.hitCount = 0;
      s.breached = false;
      s.damageStage = 0;
    } else if (s.type === 'water_barrel' || s.type === 'trough') {
      s.destructible = true;
      s.indestructibleCover = true;
      s.isWaterContainer = true;
      s.waterLevel = 1.0;
      s.holes = [];
      s.waterEmpty = false;
      s.damageStage = 0;
    }
    return s;
  }

  // ==================== ДЕТАЛЬНАЯ 1PX ФЛОРА И ЭЛЕМЕНТЫ РЕФЕРЕНСОВ ====================

  // Густой пучок высокой золотистой степной травы (тонкие 1px стебли, как на референсах 1–3)
  function drawTallGrassTuft(ctx, x, y, rng, P) {
    const px = Math.round(x);
    const py = Math.round(y);
    const blades = 4 + Math.floor(rng() * 5);

    // Мягкая контактная тень в основании пучка
    ctx.fillStyle = 'rgba(32, 22, 13, 0.34)';
    ctx.fillRect(px - 2, py + 1, blades + 4, 2);

    for (let b = 0; b < blades; b++) {
      const bx = px + b - Math.floor(blades * 0.4) + Math.floor(rng() * 2);
      const h = 4 + Math.floor(rng() * 5);
      const lean = rng() < 0.35 ? -1 : rng() < 0.7 ? 1 : 0;
      for (let step = 0; step < h; step++) {
        const sy = py - step;
        const sx = bx + (step >= h - 2 ? lean : 0);
        const frac = step / Math.max(1, h - 1);
        ctx.fillStyle = frac < 0.25
          ? P.grass[3]
          : frac < 0.6
            ? P.grass[2]
            : frac < 0.85
              ? P.grass[1]
              : P.grass[0];
        ctx.fillRect(sx, sy, 1, 1);
      }
    }
    // Редкие приглушённо-красные степные цветки (как на референсе 1)
    if (rng() < 0.16) {
      ctx.fillStyle = P.barnRed[0];
      ctx.fillRect(px + Math.floor(rng() * 3), py - 3 - Math.floor(rng() * 2), 1, 1);
    }
  }

  // Полынный кустарник с объёмной пиксельной шапкой и полуденной тенью (референсы 1–2)
  function drawSageBush(ctx, x, y, rng, P) {
    const px = Math.round(x);
    const py = Math.round(y);
    const rx = 4 + Math.floor(rng() * 4);
    const ry = 3 + Math.floor(rng() * 2);

    // Полуденная тень куста (на юго-восток)
    ctx.fillStyle = 'rgba(24, 17, 11, 0.36)';
    for (let dy = -ry; dy <= ry; dy++) {
      for (let dx = -rx; dx <= rx; dx++) {
        if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1.0) {
          ctx.fillRect(px + dx + 2, py + dy + 2, 1, 1);
        }
      }
    }

    // Многослойная листва куста (верх-лево светлее от солнца, низ-право глубже в тени)
    for (let dy = -ry; dy <= ry; dy++) {
      for (let dx = -rx; dx <= rx; dx++) {
        const d2 = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
        if (d2 > 0.95 + (hash2(px + dx, py + dy) - 0.5) * 0.35) continue;
        const light = 0.5 - (dx / (rx * 2.2)) - (dy / (ry * 2.1)) + (hash2(px + dx * 3, py + dy * 3) - 0.5) * 0.28;
        const idx = light > 0.72 ? 0 : light > 0.48 ? 1 : light > 0.25 ? 2 : 3;
        ctx.fillStyle = P.foliage[idx];
        ctx.fillRect(px + dx, py + dy, 1, 1);
      }
    }
    if (rng() < 0.22) {
      ctx.fillStyle = P.barnRed[0];
      ctx.fillRect(px - 1 + Math.floor(rng() * 3), py - 1 + Math.floor(rng() * 2), 1, 1);
    }
  }

  // Детальный булыжник / камень с гранью на солнце и сколом
  function drawPebbleCluster(ctx, x, y, rng, P, big) {
    const px = Math.round(x);
    const py = Math.round(y);
    const rw = big ? 6 + Math.floor(rng() * 5) : 3 + Math.floor(rng() * 3);
    const rh = big ? 4 + Math.floor(rng() * 3) : 2 + Math.floor(rng() * 2);

    ctx.fillStyle = 'rgba(22, 15, 10, 0.36)';
    ctx.fillRect(px + 2, py + 2, rw, rh);

    for (let dy = 0; dy < rh; dy++) {
      for (let dx = 0; dx < rw; dx++) {
        // Скругляем углы на 1px
        if ((dx === 0 || dx === rw - 1) && (dy === 0 || dy === rh - 1)) continue;
        const shade = (dx / rw) * 0.45 + (dy / rh) * 0.55 + (hash2(px + dx, py + dy) - 0.5) * 0.2;
        const idx = shade < 0.28 ? 0 : shade < 0.52 ? 1 : shade < 0.76 ? 2 : 3;
        ctx.fillStyle = P.stone[idx];
        ctx.fillRect(px + dx, py + dy, 1, 1);
      }
    }
  }

  // Неровный деревенский забор из жердей (как на референсе 3)
  function drawSplitFence(ctx, x1, y1, x2, rng, P) {
    ctx.fillStyle = 'rgba(20, 14, 10, 0.34)';
    ctx.fillRect(x1 + 2, y1 + 3, x2 - x1, 3);

    // Две кривоватые горизонтальные жерди
    for (let x = x1; x < x2; x++) {
      const sag = Math.round(Math.sin((x - x1) * 0.14) * 0.6);
      ctx.fillStyle = P.woodPale[4];
      ctx.fillRect(x, y1 + sag + 1, 1, 1);
      ctx.fillStyle = P.woodPale[2];
      ctx.fillRect(x, y1 + sag, 1, 1);
      if ((x + sag) % 3 === 0) {
        ctx.fillStyle = P.woodPale[1];
        ctx.fillRect(x, y1 + sag - 1, 1, 1);
      }
    }
    // Вертикальные колья с тенью
    for (let x = x1; x <= x2; x += 15) {
      const jitter = rng() < 0.5 ? 0 : 1;
      ctx.fillStyle = 'rgba(20, 14, 10, 0.42)';
      ctx.fillRect(x + 2, y1 - 2 + jitter, 3, 7);
      ctx.fillStyle = P.woodPale[4];
      ctx.fillRect(x - 1, y1 - 4 + jitter, 3, 7);
      ctx.fillStyle = P.woodPale[2];
      ctx.fillRect(x - 1, y1 - 4 + jitter, 2, 5);
      ctx.fillStyle = P.woodPale[0];
      ctx.fillRect(x - 1, y1 - 4 + jitter, 1, 2);
    }
  }

  // Колесо повозки со спицами (как у веранды салуна на референсе 1)
  function drawWagonWheelProp(ctx, cx, cy, P) {
    ctx.fillStyle = 'rgba(20, 14, 9, 0.38)';
    ctx.fillRect(cx - 5, cy + 3, 12, 4);
    const r = 6;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.hypot(dx, dy);
        if (d <= r + 0.3 && d >= r - 1.3) {
          ctx.fillStyle = dy < 0 ? P.woodWarm[1] : P.woodWarm[4];
          ctx.fillRect(cx + dx, cy + dy, 1, 1);
        }
      }
    }
    // Спицы и ступица
    ctx.fillStyle = P.woodWarm[2];
    for (let i = -r + 2; i <= r - 2; i++) {
      ctx.fillRect(cx + i, cy, 1, 1);
      ctx.fillRect(cx, cy + i, 1, 1);
      ctx.fillRect(cx + Math.round(i * 0.7), cy + Math.round(i * 0.7), 1, 1);
      ctx.fillRect(cx + Math.round(i * 0.7), cy - Math.round(i * 0.7), 1, 1);
    }
    ctx.fillStyle = '#383430';
    ctx.fillRect(cx - 1, cy - 1, 3, 3);
    ctx.fillStyle = '#807a72';
    ctx.fillRect(cx - 1, cy - 1, 1, 1);
  }

  // ==================== ЕДИНАЯ ГЕОМЕТРИЯ КАРТЫ (2920x840) ====================
  // Расширение по X (коридорный каньон с развилками) и по Y (запас по краям ущелья).
  const MAP_W = 2920;
  const MAP_H = 840;
  const MAP_STORAGE_KEY = 'gunfighter_custom_map_v1';

  G.EDITOR_PALETTE = [
    { type: 'crate',        label: 'Ящик',      w: 34, h: 32, mat: 'wood',  high: false, rotatable: false },
    { type: 'water_barrel', label: 'Бочка',     w: 26, h: 26, mat: 'water', high: false, rotatable: false },
    { type: 'hay',          label: 'Тюк сена',  w: 34, h: 26, mat: 'hay',   high: false, rotatable: false },
    { type: 'trough',       label: 'Корыто',    w: 56, h: 22, mat: 'water', high: false, rotatable: true },
    { type: 'fence',        label: 'Забор',     w: 96, h: 12, mat: 'wood',  high: false, rotatable: true },
    { type: 'low_wall',     label: 'Кам. стена',w: 80, h: 14, mat: 'rock',  high: false, rotatable: true },
    { type: 'boulder',      label: 'Валун',     w: 46, h: 42, mat: 'rock',  high: false, rotatable: false },
    { type: 'wagon',        label: 'Повозка',   w: 62, h: 28, mat: 'wood',  high: true,  rotatable: true },
    { type: 'table',        label: 'Стол',      w: 46, h: 46, mat: 'wood',  high: false, rotatable: false },
    { type: 'wall',         label: 'Выс. стена',w: 96, h: 16, mat: 'wood',  high: true,  rotatable: true },
    { type: 'pillar',       label: 'Столб',     w: 18, h: 18, mat: 'wood',  high: true,  rotatable: false }
  ];
  // Сдвиг улицы, салуна и дверей вниз, чтобы северные амбары были по-настоящему крупными.
  const STREET_SHIFT = 110;
  const SALOON = { x: 24, y: 70 + STREET_SHIFT, w: 316, h: 380 }; // 24..340 × 180..560
  const STREET_TOP = 102 + STREET_SHIFT;   // 212 — северный настил
  const STREET_BOT = 392 + STREET_SHIFT;   // 502 — южный настил
  const STREET_MID = 256 + STREET_SHIFT;   // 366 — ось дороги

  // ==================== ЗАПЕЧЁННЫЙ 1PX ФОН КАРТЫ ====================

  function bakeBackground(width, height) {
    const SY = STREET_SHIFT;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const rng = makeRng(187719);
    const P = getPal();

    // 1. Попиксельный рендер земли через ImageData (быстрый и с честным дизеренгом Байера!)
    const img = ctx.createImageData(width, height);
    const data = img.data;

    const dirtRgb = P.dirt.map(hexToRgb);
    const canyonRgb = P.canyon.map(hexToRgb);
    const stoneRgb = P.stone.map(hexToRgb);
    const grassRgb = P.grass.map(hexToRgb);
    const waterRgb = P.water.map(hexToRgb);
    const woodPaleRgb = P.woodPale.map(hexToRgb);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx4 = (y * width + x) * 4;

        // Внутри салуна — оставим базовый тёмный цвет, поверх нарисуем доски
        if (x < 336 && y > 72 + SY && y < 448 + SY) {
          data[idx4] = 56; data[idx4 + 1] = 38; data[idx4 + 2] = 24; data[idx4 + 3] = 255;
          continue;
        }

        // Многослойный шум для органичных пятен пыли, гравия и выжженной травы
        const nBig = smoothNoise(x, y, 42);
        const nMed = smoothNoise(x * 0.65, y * 1.45, 16); // вытянутые горизонтальные мазки референсов
        const nFine = hash2(x, y);

        // Колеи от повозок, плавно извивающиеся от салуна к мосту и расходящиеся по коридорам каньона
        const roadCenterY = 256 + SY + Math.sin(x * 0.0085) * 14 + Math.cos(x * 0.021) * 4;
        const dFromCenter = Math.abs(y - roadCenterY);
        let effTrackDist = dFromCenter;
        let inCorridorFloor = false;

        if (x > 1310) {
          // Ветвления коридоров и развилок в каньоне
          let dMin = 999;
          // 1. Северное ущелье (Arm A -> East-North Alley)
          if (x <= 1860) dMin = Math.min(dMin, Math.abs(y - (152 + Math.sin(x * 0.015) * 8)));
          else if (x <= 2490) dMin = Math.min(dMin, Math.abs(y - (128 + Math.sin(x * 0.018) * 7)));
          // 2. Центральный проход (Arm B -> Middle Narrows)
          if (x <= 1860) dMin = Math.min(dMin, Math.abs(y - (448 + Math.cos(x * 0.013) * 8)));
          else if (x <= 2490) dMin = Math.min(dMin, Math.abs(y - (405 + Math.sin(x * 0.014) * 7)));
          // 3. Южный рукав (Arm C -> Smuggler Cut)
          if (x <= 2500) dMin = Math.min(dMin, Math.abs(y - (702 + Math.sin(x * 0.014) * 9)));
          // 4. Поперечные развилки (север-юг)
          if (y >= 145 && y <= 705) dMin = Math.min(dMin, Math.abs(x - (1362 + Math.sin(y * 0.015) * 8)));
          if (y >= 125 && y <= 705) dMin = Math.min(dMin, Math.abs(x - (1845 + Math.cos(y * 0.014) * 9)));
          if (y >= 125 && y <= 705) dMin = Math.min(dMin, Math.abs(x - (2475 + Math.sin(y * 0.014) * 9)));
          // 5. Восточный котёл вокруг каменного шпиля (mesa_spire)
          if (x > 2475 && x <= 2810) {
            dMin = Math.min(dMin, Math.abs(y - (195 + Math.sin(x * 0.015) * 10)));
            dMin = Math.min(dMin, Math.abs(y - (585 + Math.cos(x * 0.015) * 10)));
            if (y >= 190 && y <= 595) dMin = Math.min(dMin, Math.abs(x - (2775 + Math.sin(y * 0.016) * 8)));
          }
          effTrackDist = dMin;
          inCorridorFloor = dMin < 36;
        }

        const rut1 = Math.abs(effTrackDist - 18);
        const rutDepth = x <= 1310
          ? Math.max(Math.max(0, 1 - Math.abs(y - (roadCenterY - 21)) / 6.5), Math.max(0, 1 - Math.abs(y - (roadCenterY + 21)) / 6.5))
          : Math.max(0, 1 - rut1 / 5.5);
        // Светлый пыльный гребень между колеями
        const ridge = Math.max(0, 1 - Math.abs(effTrackDist - 9) / 7);

        // Ручей в каньоне (извилистый сланцево-бирюзовый с песчано-галечными берегами)
        const streamX = 1275 + Math.sin(y * 0.012) * 26 + Math.cos(y * 0.032) * 10;
        const dStream = Math.abs(x - streamX);
        const inCanyonStream = x > 940 && dStream <= 24;
        const isBridge = x >= 1234 && x <= 1278 && y >= 335 && y <= 395;
        const inCreekWater = inCanyonStream && dStream <= 14 && !isBridge;
        const inCreekBank = inCanyonStream && dStream > 14 && dStream <= 24 && !isBridge;

        // Граница перехода из городка в каньон (x ~ 825..955 с рваной линией)
        const canyonEdge = 845 + (nBig - 0.5) * 95 + (nMed - 0.5) * 35;
        const canyonBlend = G.MATH.clamp((x - canyonEdge) / 85, 0, 1);

        let rgb;
        const b = bayerAt(x, y);

        if (isBridge) {
          // Деревянный настил мостика через ручей на дороге
          const plankRow = y % 5;
          const plankN = hash2(Math.floor(y / 5), x);
          if (plankRow === 4) {
            rgb = woodPaleRgb[4]; // тёмный шов между досками
          } else {
            const toneIdx = plankN < 0.28 ? 1 : plankN < 0.72 ? 2 : 3;
            rgb = woodPaleRgb[toneIdx];
            if (plankRow === 0 && b < 0.45) rgb = woodPaleRgb[Math.max(0, toneIdx - 1)];
          }
        } else if (inCreekWater) {
          // Бирюзово-сланцевый ручей с рябью и дизерингом Байера
          const flowWave = Math.sin(y * 0.18 + x * 0.12 + nBig * 4);
          let wTone = 0.35 + (dStream / 14) * 0.38 + (flowWave - 0.5) * 0.22 + (nFine - 0.5) * 0.12;
          const scaled = G.MATH.clamp(wTone, 0, 0.999) * (waterRgb.length - 1);
          const ci = Math.floor(scaled);
          rgb = waterRgb[(scaled - ci) > b ? Math.min(waterRgb.length - 1, ci + 1) : ci];
        } else if (inCreekBank) {
          // Песчано-галечный берег ручья (гравий, галька, смесь песка и камня)
          const bankT = (dStream - 14) / 10;
          let bTone = 0.26 + bankT * 0.38 + (nFine - 0.5) * 0.26;
          const bankArr = nFine > 0.45 ? stoneRgb : dirtRgb;
          const scaled = G.MATH.clamp(bTone, 0, 0.999) * (bankArr.length - 1);
          const ci = Math.floor(scaled);
          rgb = bankArr[(scaled - ci) > b ? Math.min(bankArr.length - 1, ci + 1) : ci];
        } else if (canyonBlend > b) {
          // Каньон: слоистая терракота с пыльными утоптанными коридорами и сланцем
          let tone = 0.36 + (nBig - 0.5) * 0.45 + (nMed - 0.5) * 0.32 + (nFine - 0.5) * 0.14;
          tone += rutDepth * 0.26 - ridge * 0.10;
          if (!inCorridorFloor && x > 1310) tone += 0.16;
          if (y < 105 || y > height - 95) tone += 0.20;
          const useStone = nBig > 0.72 && nMed > 0.54;
          const useTrailSand = inCorridorFloor && (nBig < 0.35 && effTrackDist < 22);
          const arr = useStone ? stoneRgb : (useTrailSand ? dirtRgb : canyonRgb);
          const scaled = G.MATH.clamp(tone, 0, 0.999) * (arr.length - 1);
          const ci = Math.floor(scaled);
          rgb = arr[(scaled - ci) > b ? Math.min(arr.length - 1, ci + 1) : ci];
        } else {
          // Пыльная улочка городка: выбеленный песок по центру, золотистая травяная подложка по обочинам
          let verge = G.MATH.clamp((dFromCenter - 68) / 56 + (nBig - 0.5) * 0.45, 0, 1);

          // Южное расширение карты: утоптанный двор-загон и грунтовая колея на юг
          if (y > 452 + SY) {
            const southRoadX = 1000 + Math.sin(y * 0.011) * 26;
            const dSouth = Math.abs(x - southRoadX);
            verge = G.MATH.clamp((dSouth - 86) / 78 + (nBig - 0.5) * 0.42, 0, 1);
            // Внутри загона земля вытоптана копытами — почти без травяной подложки
            if (x > 40 && x < 342 && y > 588 && y < 748) {
              verge = Math.min(verge, 0.34 + (nMed - 0.5) * 0.18);
            }
          }

          if (x > 348 && verge > 0.52 + (b - 0.5) * 0.45) {
            // Подложка сухой травы на обочинах
            const gt = G.MATH.clamp(0.32 + (nMed - 0.5) * 0.48 + (nFine - 0.5) * 0.22, 0, 0.999) * (grassRgb.length - 1);
            const gi = Math.floor(gt);
            rgb = grassRgb[(gt - gi) > b ? Math.min(grassRgb.length - 1, gi + 1) : gi];
          } else {
            // Дорога: горизонтальная пыльная кладка + колеи + редкий серый гравий
            let tone = 0.28 + (nBig - 0.5) * 0.38 + (nMed - 0.5) * 0.34 + (nFine - 0.5) * 0.14;
            tone += rutDepth * 0.34 - ridge * 0.14;
            // Лёгкий серый оттенок утоптанной дороги (как на референсе 3)
            const isGravel = nFine > 0.93 && dFromCenter < 60;
            const arr = isGravel ? stoneRgb : dirtRgb;
            const scaled = G.MATH.clamp(tone, 0, 0.999) * (arr.length - 1);
            const ci = Math.floor(scaled);
            rgb = arr[(scaled - ci) > b ? Math.min(arr.length - 1, ci + 1) : ci];
          }
        }

        data[idx4] = rgb[0];
        data[idx4 + 1] = rgb[1];
        data[idx4 + 2] = rgb[2];
        data[idx4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // 2. Деревянные настилы-тротуары и веранды вдоль фасадов улицы (с козырьковыми тенями и ступенями)
    const boardwalks = [
      { x: 340, y: 102 + SY, w: 500, h: 22, north: true },
      { x: 340, y: 392 + SY, w: 502, h: 22, north: false }
    ];
    boardwalks.forEach((b) => {
      // Полуденная тень от кромки деревянного помоста на дорогу
      ctx.fillStyle = 'rgba(22, 15, 10, 0.38)';
      ctx.fillRect(b.x + 2, b.north ? b.y + b.h : b.y - 3, b.w, 4);

      ctx.fillStyle = P.woodPale[4];
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // Индивидуальные поперёк уложенные выгоревшие доски шириной 4px
      for (let x = b.x; x < b.x + b.w; x += 4) {
        const wIdx = rng() < 0.25 ? 1 : rng() < 0.72 ? 2 : 3;
        ctx.fillStyle = P.woodPale[wIdx];
        ctx.fillRect(x, b.y + 1, 3, b.h - 2);
        // Солнечный блик на ребре доски
        ctx.fillStyle = P.woodPale[Math.max(0, wIdx - 1)];
        ctx.fillRect(x, b.y + 1, 3, 2);
        // Тёмные швы и гвозди
        ctx.fillStyle = P.woodPale[4];
        ctx.fillRect(x + 3, b.y, 1, b.h);
        if (rng() < 0.45) {
          ctx.fillStyle = '#241d17';
          ctx.fillRect(x + 1, b.y + 3, 1, 1);
          ctx.fillRect(x + 1, b.y + b.h - 4, 1, 1);
        }
        // Тонкие волокна и трещины
        if (rng() < 0.3) {
          ctx.fillStyle = P.woodPale[3];
          ctx.fillRect(x + 1, b.y + 6 + Math.floor(rng() * 8), 1, 4);
        }
      }

      // Прохладная тень от навеса веранды (у самого фасада)
      ctx.fillStyle = 'rgba(18, 13, 10, 0.32)';
      ctx.fillRect(b.x, b.north ? b.y : b.y + b.h - 9, b.w, 9);

      // Столбы веранды и коновязи
      for (let px = b.x + 18; px < b.x + b.w - 10; px += 46) {
        const py = b.north ? b.y + b.h - 5 : b.y + 2;
        ctx.fillStyle = 'rgba(18, 12, 8, 0.45)';
        ctx.fillRect(px + 2, py + 2, 4, 5);
        ctx.fillStyle = P.woodPale[4];
        ctx.fillRect(px, py, 4, 4);
        ctx.fillStyle = P.woodPale[1];
        ctx.fillRect(px, py, 2, 2);
      }
    });

    // 2.1. Деревянный мост через ручей в каньоне (переправа на дороге)
    const brX = 1234, brY = 335, brW = 44, brH = 60;
    // Тень от южной кромки моста на воду ручья
    ctx.fillStyle = 'rgba(15, 24, 28, 0.52)';
    ctx.fillRect(brX, brY + brH, brW, 6);
    // Продольные опорные балки моста
    ctx.fillStyle = P.woodWarm[4];
    ctx.fillRect(brX - 2, brY - 2, brW + 4, 3);
    ctx.fillRect(brX - 2, brY + brH - 1, brW + 4, 3);
    ctx.fillStyle = P.woodWarm[1];
    ctx.fillRect(brX - 2, brY - 2, brW + 4, 1);
    // Перила мостика (деревянные стойки и прогоны с гвоздями)
    for (let px = brX; px <= brX + brW; px += 12) {
      ctx.fillStyle = P.woodPale[4];
      ctx.fillRect(px, brY - 5, 2, 6);
      ctx.fillRect(px, brY + brH - 1, 2, 6);
      ctx.fillStyle = P.woodPale[1];
      ctx.fillRect(px, brY - 5, 1, 5);
      ctx.fillRect(px, brY + brH - 1, 1, 5);
    }
    ctx.fillStyle = P.woodPale[2];
    ctx.fillRect(brX - 1, brY - 5, brW + 2, 1);
    ctx.fillRect(brX - 1, brY + brH + 4, brW + 2, 1);

    // 3. Неровные деревенские заборы на выходе из городка к каньону (референс 3)
    drawSplitFence(ctx, 840, 112 + SY, 906, rng, P);
    drawSplitFence(ctx, 842, 404 + SY, 910, rng, P);

    // 4. Каменные россыпи и осыпи у подножия скал, в коридорах каньона и по обочинам
    for (let i = 0; i < 360; i++) {
      const rx = 352 + rng() * (width - 410);
      const inCanyon = rx > 855;
      const ry = inCanyon
        ? 85 + rng() * (height - 170)
        : (rng() < 0.5 ? 124 + rng() * 44 + SY : 344 + rng() * 46 + SY);
      drawPebbleCluster(ctx, rx, ry, rng, P, rng() < (inCanyon ? 0.45 : 0.22));
    }

    // Камни и щебень в южном дворе
    for (let i = 0; i < 95; i++) {
      const rx = 40 + rng() * (width - 120);
      const ry = 570 + rng() * (height - 640);
      drawPebbleCluster(ctx, rx, ry, rng, P, rng() < 0.3);
    }

    // 5. Пышные заросли золотистой степной травы и полыни (1px пучки вдоль обочин и в ущелье!)
    for (let i = 0; i < 920; i++) {
      const gx = 348 + rng() * (width - 410);
      let gy;
      if (gx > 1320) {
        // Кусты и сухая трава по кромкам скал в коридорах каньона
        gy = 86 + rng() * (height - 172);
      } else if (rng() < 0.34) {
        // Южное расширение: сухая степь за забором
        gy = 505 + SY + rng() * (height - 575 - SY);
        if (gx > 40 && gx < 342 && gy > 588 && gy < 748) continue;
      } else {
        const roadY = 256 + SY + Math.sin(gx * 0.0085) * 14;
        const side = rng() < 0.5 ? -1 : 1;
        const distOut = 64 + Math.pow(rng(), 0.75) * 96;
        gy = G.MATH.clamp(roadY + side * distOut, 86 + SY, 434 + SY);
        if (gx < 842 && (gy < 126 + SY || gy > 390 + SY)) continue;
      }
      if (rng() < (gx > 1320 ? 0.28 : 0.16)) {
        drawSageBush(ctx, gx, gy, rng, P);
      } else {
        drawTallGrassTuft(ctx, gx, gy, rng, P);
      }
    }

    // Декоративные жерди-заборчики в южном дворе и на южной кромке каньона
    drawSplitFence(ctx, 380, 700, 560, rng, P);
    drawSplitFence(ctx, 1410, 742, 1550, rng, P);

    // Колесо от повозки у крыльца салуна (референс 1)
    drawWagonWheelProp(ctx, 350, 174 + SY, P);

    // 6. Пол салуна (детальные состаренные доски с текстурой волокон, щелями и гвоздями)
    const sx = 32, sy = 78 + SY, sw = 300, sh = 364;
    const plankH = 10;
    for (let y = sy; y < sy + sh; y += plankH) {
      // Высокая вариативность оттенков досок по G.PAL.woodWarm
      const baseIdx = rng() < 0.28 ? 1 : rng() < 0.65 ? 2 : rng() < 0.90 ? 3 : 4;
      ctx.fillStyle = P.woodWarm[baseIdx];
      ctx.fillRect(sx, y, sw, plankH - 1);

      // Продольные волокна древесины и микро-текстура (1px линии)
      for (let ly = 1; ly < plankH - 2; ly += 2) {
        ctx.fillStyle = ly === 1 ? 'rgba(224, 194, 148, 0.12)' : 'rgba(20, 15, 12, 0.18)';
        ctx.fillRect(sx, y + ly, sw, 1);
      }
      // Тёмный шов между досками
      ctx.fillStyle = P.outline || P.woodWarm[4];
      ctx.fillRect(sx, y + plankH - 1, sw, 1);

      // Поперечные стыки, сучки и пары гвоздей
      let x = sx + 18 + Math.floor(rng() * 45);
      while (x < sx + sw - 14) {
        // Стык досок
        ctx.fillStyle = P.outline || P.woodWarm[4];
        ctx.fillRect(x, y, 1, plankH);

        // Пары железных гвоздей в торцах досок
        ctx.fillStyle = P.lead ? P.lead[3] : '#474542';
        ctx.fillRect(x - 3, y + 2, 1, 1);
        ctx.fillRect(x - 3, y + plankH - 3, 1, 1);
        ctx.fillRect(x + 2, y + 2, 1, 1);
        ctx.fillRect(x + 2, y + plankH - 3, 1, 1);
        ctx.fillStyle = P.outline || '#140f0c';
        ctx.fillRect(x - 3, y + 3, 1, 1);
        ctx.fillRect(x + 2, y + 3, 1, 1);

        // Сучки и микро-трещины
        if (rng() < 0.32) {
          const kx = x - 14 - Math.floor(rng() * 16);
          if (kx > sx + 4) {
            ctx.fillStyle = P.woodWarm[4];
            ctx.fillRect(kx, y + 3, 3, 3);
            ctx.fillStyle = P.woodWarm[1];
            ctx.fillRect(kx + 1, y + 4, 1, 1);
          }
        }
        x += 44 + Math.floor(rng() * 56);
      }
    }

    // Потёртая светлая тропа износа между входом и барной стойкой + перед стойкой
    // Траектория от двери (324, 255) к стойке (150, 148)
    for (let i = 0; i < 950; i++) {
      const t = rng();
      const pathX = 320 * (1 - t) + 148 * t + (rng() - 0.5) * 8;
      const pathY = (255 + SY) * (1 - t) + (148 + SY) * t + Math.sin(t * Math.PI) * -14 + (rng() - 0.5) * 6;
      const spread = 7 + Math.sin(t * Math.PI) * 11;
      const px = Math.floor(pathX + (rng() - 0.5) * spread * 2);
      const py = Math.floor(pathY + (rng() - 0.5) * spread * 1.6);
      if (px >= sx + 4 && px < sx + sw - 6 && py >= sy + 4 && py < sy + sh - 6) {
        const wearTone = rng() < 0.45 ? P.woodPale[1] : rng() < 0.80 ? P.woodPale[2] : P.dirt[1];
        ctx.fillStyle = wearTone;
        ctx.fillRect(px, py, 1 + (rng() < 0.35 ? 1 : 0), 1);
      }
    }
    // Износ пола вдоль всей барной стойки (x: 72..228, y: 138..156)
    for (let i = 0; i < 520; i++) {
      const bx = 74 + Math.floor(rng() * 154);
      const by = 138 + SY + Math.floor(rng() * 16);
      if (rng() < 0.65) {
        ctx.fillStyle = rng() < 0.5 ? P.woodPale[2] : P.woodPale[1];
        ctx.fillRect(bx, by, 1 + (rng() < 0.4 ? 1 : 0), 1);
      }
    }

    // Занесённая сапогами пыль и песок у входа
    for (let i = 0; i < 320; i++) {
      const dx = 246 + Math.floor(rng() * 84);
      const dy = 200 + SY + Math.floor(rng() * 110);
      const d = Math.hypot((dx - 324) * 0.75, dy - (255 + SY));
      if (d < 82 && rng() < 1 - d / 88) {
        ctx.fillStyle = rng() < 0.55 ? P.dirt[0] : P.dirt[1];
        ctx.fillRect(dx, dy, 1 + (rng() < 0.5 ? 1 : 0), 1);
      }
    }

    // Тёмные пятна пролитых напитков (виски, эль) у бара и столов
    const spillCenters = [
      { x: 104, y: 144 + SY, r: 6 },
      { x: 148, y: 142 + SY, r: 8 },
      { x: 196, y: 145 + SY, r: 5 },
      { x: 114, y: 324 + SY, r: 7 }, // у стола 1
      { x: 134, y: 378 + SY, r: 5 },
      { x: 236, y: 326 + SY, r: 8 }, // у стола 2
      { x: 212, y: 382 + SY, r: 6 },
      { x: 168, y: 284 + SY, r: 4 }
    ];
    spillCenters.forEach((sp) => {
      const r = sp.r;
      for (let dy = -r; dy <= r; dy++) {
        const maxDx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)) * 1.5);
        for (let dx = -maxDx; dx <= maxDx; dx++) {
          if (rng() < 0.82) {
            const tone = (dx * dx + dy * dy < (r * 0.5) * (r * 0.5))
              ? (P.leather ? P.leather[4] : P.woodWarm[4])
              : P.woodWarm[4];
            ctx.fillStyle = tone;
            ctx.fillRect(sp.x + dx, sp.y + dy, 1, 1);
          }
        }
      }
    });

    // Мелкий пиксельный сор/щепки у стен, углов и столов
    for (let i = 0; i < 280; i++) {
      let cx, cy;
      const wallSide = rng();
      if (wallSide < 0.3) {
        cx = sx + 2 + Math.floor(rng() * 8);
        cy = sy + 4 + Math.floor(rng() * (sh - 8));
      } else if (wallSide < 0.55) {
        cx = sx + 4 + Math.floor(rng() * (sw - 8));
        cy = sy + 2 + Math.floor(rng() * 8);
      } else if (wallSide < 0.8) {
        cx = sx + 4 + Math.floor(rng() * (sw - 8));
        cy = sy + sh - 8 + Math.floor(rng() * 6);
      } else {
        cx = sx + sw - 10 + Math.floor(rng() * 8);
        cy = sy + 4 + Math.floor(rng() * (sh - 8));
      }
      const debrisCol = rng() < 0.4 ? P.woodPale[0] : rng() < 0.7 ? P.dirt[2] : (P.outline || P.woodWarm[4]);
      ctx.fillStyle = debrisCol;
      ctx.fillRect(cx, cy, 1 + (rng() < 0.3 ? 1 : 0), 1);
    }
    const tableScraps = [
      { x: 92, y: 330 + SY, w: 46, h: 46 },
      { x: 218, y: 334 + SY, w: 46, h: 46 },
      { x: 256, y: 170 + SY, w: 18, h: 18 }
    ];
    tableScraps.forEach((tb) => {
      for (let i = 0; i < 45; i++) {
        const ang = rng() * Math.PI * 2;
        const rad = 24 + rng() * 10;
        const tx = Math.floor(tb.x + tb.w * 0.5 + Math.cos(ang) * rad);
        const ty = Math.floor(tb.y + tb.h * 0.5 + Math.sin(ang) * rad);
        if (tx >= sx + 2 && tx < sx + sw - 2 && ty >= sy + 2 && ty < sy + sh - 2) {
          ctx.fillStyle = rng() < 0.5 ? P.woodPale[0] : (P.outline || P.woodWarm[4]);
          ctx.fillRect(tx, ty, 1, 1);
        }
      }
    });

    // Узорчатый потёртый ковёр в салуне (бордовый + состаренная охра + бахрома)
    const rx = 242, ry = 222 + SY, rw = 66, rh = 66;
    ctx.fillStyle = 'rgba(20, 15, 12, 0.38)';
    ctx.fillRect(rx + 2, ry + 2, rw, rh);
    // Бахрома по бокам
    ctx.fillStyle = P.woodPale[1];
    for (let fy = ry + 1; fy < ry + rh; fy += 2) {
      ctx.fillRect(rx - 2, fy, 2, 1);
      ctx.fillRect(rx + rw, fy, 2, 1);
    }
    ctx.fillStyle = P.barnRed[3];
    ctx.fillRect(rx, ry, rw, rh);
    ctx.fillStyle = P.barnRed[1];
    ctx.fillRect(rx + 2, ry + 2, rw - 4, rh - 4);
    // Золотистая рамка с пиксельным орнаментом
    ctx.fillStyle = P.grass[2];
    ctx.fillRect(rx + 5, ry + 5, rw - 10, rh - 10);
    ctx.fillStyle = P.barnRed[2];
    ctx.fillRect(rx + 8, ry + 8, rw - 16, rh - 16);
    for (let ox = rx + 6; ox < rx + rw - 6; ox += 4) {
      ctx.fillStyle = P.grass[0];
      ctx.fillRect(ox, ry + 6, 2, 1);
      ctx.fillRect(ox, ry + rh - 7, 2, 1);
    }
    // Центральный медальон
    ctx.fillStyle = P.grass[1];
    ctx.fillRect(rx + 18, ry + 18, rw - 36, rh - 36);
    ctx.fillStyle = P.slateTeal[2];
    ctx.fillRect(rx + 21, ry + 21, rw - 42, rh - 42);
    ctx.fillStyle = P.barnRed[0];
    ctx.fillRect(rx + 26, ry + 26, rw - 52, rh - 52);

    // Деревянное крыльцо салуна снаружи распашных дверей
    ctx.fillStyle = 'rgba(20, 14, 9, 0.36)';
    ctx.fillRect(336, 208 + SY, 22, 98);
    for (let y = 206 + SY; y < 304 + SY; y += 5) {
      ctx.fillStyle = y % 10 === 0 ? P.woodPale[2] : P.woodPale[3];
      ctx.fillRect(334, y, 22, 4);
      ctx.fillStyle = P.woodPale[1];
      ctx.fillRect(334, y, 22, 1);
      ctx.fillStyle = P.woodPale[4];
      ctx.fillRect(334, y + 4, 22, 1);
    }

    return canvas;
  }

  // ==================== ЗАПЕЧЁННЫЕ 2.5D-СПРАЙТЫ ЗДАНИЙ, СКАЛ И ОБЪЕКТОВ ====================

  // 2.5D-здание в духе референсов: крыша из черепицы/дранки + видимый деревянный фасад с окнами и козырьком
  function bakeBuildingSprite(s, P) {
    const padTop = 10;
    const padBot = s.y < 200 ? 8 : 4;
    const cw = s.w + 4;
    const ch = s.h + padTop + padBot;
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext('2d');
    const rng = makeRng(s.x * 31 + s.y * 17 + 99);

    const isNorth = s.y < 200;
    const wallPal = P[s.wallPalKey || 'woodPale'] || P.woodPale;
    const roofPal = P[s.roofPalKey || 'shingle'] || P.shingle;

    const ox = 2;
    const oy = padTop;

    // 1. Базовая коробка здания (контур)
    ctx.fillStyle = '#140f0c';
    ctx.fillRect(ox, oy, s.w, s.h);

    // 2. Видимый 2.5D-фасад со стороны улицы рисуется ТОЛЬКО для северных амбаров (isNorth).
    // Для нижних (южных) зданий видны только крыши и козырёк навеса над тротуаром!
    const facadeH = isNorth ? Math.max(26, Math.min(38, Math.round(s.h * 0.18))) : 0;

    if (isNorth) {
      const facadeY = oy + s.h - facadeH;
      ctx.fillStyle = wallPal[2];
      ctx.fillRect(ox + 1, facadeY, s.w - 2, facadeH);

      // Горизонтальная вагонка фасада
      for (let y = facadeY; y < facadeY + facadeH; y += 3) {
        const shade = y === facadeY ? 0 : y > facadeY + facadeH - 4 ? 3 : 1;
        ctx.fillStyle = wallPal[shade];
        ctx.fillRect(ox + 2, y, s.w - 4, 2);
        ctx.fillStyle = wallPal[4];
        ctx.fillRect(ox + 2, y + 2, s.w - 4, 1);
      }

      // Вертикальные угловые доски (наличники)
      ctx.fillStyle = wallPal[0];
      ctx.fillRect(ox + 2, facadeY, 3, facadeH);
      ctx.fillRect(ox + s.w - 5, facadeY, 3, facadeH);

      // Окна и входная дверь на северном фасаде
      const winCount = Math.max(3, Math.floor((s.w - 30) / 44));
      const step = Math.floor((s.w - 24) / winCount);
      for (let i = 0; i < winCount; i++) {
        const wx = ox + 18 + i * step;
        const wy = facadeY + 5;
        const isDoor = i === Math.floor(winCount / 2);

        if (isDoor) {
          ctx.fillStyle = '#140f0c';
          ctx.fillRect(wx - 1, wy - 2, 14, facadeH - 4);
          ctx.fillStyle = wallPal[0];
          ctx.fillRect(wx - 1, wy - 2, 14, 1);
          ctx.fillRect(wx - 1, wy - 1, 1, facadeH - 5);
          ctx.fillRect(wx + 12, wy - 1, 1, facadeH - 5);
          ctx.fillStyle = '#36261a';
          ctx.fillRect(wx + 1, wy, 10, facadeH - 7);
          ctx.fillStyle = P.brass[1];
          ctx.fillRect(wx + 8, wy + 8, 2, 2);
          ctx.fillStyle = '#17262b';
          ctx.fillRect(wx + 1, wy - 1, 10, 2);
        } else {
          ctx.fillStyle = P.woodPale[0];
          ctx.fillRect(wx - 1, wy - 2, 12, 15);
          ctx.fillStyle = '#141c22';
          ctx.fillRect(wx, wy - 1, 10, 13);
          ctx.fillStyle = P.glass[1];
          ctx.fillRect(wx + 1, wy, 3, 4);
          ctx.fillRect(wx + 6, wy, 3, 4);
          ctx.fillStyle = P.woodPale[1];
          ctx.fillRect(wx + 4, wy - 1, 2, 13);
          ctx.fillRect(wx, wy + 5, 10, 1);
          ctx.fillStyle = '#1b140f';
          ctx.fillRect(wx - 2, wy + 12, 14, 2);
        }
      }

      // Навес крыльца/веранды, выступающий вниз со столбами
      const porchY = oy + s.h - 2;
      ctx.fillStyle = '#140f0c';
      ctx.fillRect(ox + 2, porchY, s.w - 4, 7);
      for (let x = ox + 3; x < ox + s.w - 3; x += 3) {
        ctx.fillStyle = rng() < 0.5 ? P.woodPale[2] : P.woodPale[3];
        ctx.fillRect(x, porchY + 1, 2, 5);
      }
      ctx.fillStyle = P.woodPale[0];
      ctx.fillRect(ox + 3, porchY + 1, s.w - 6, 1);

      for (let postX = ox + 14; postX < ox + s.w - 12; postX += 38) {
        ctx.fillStyle = '#140f0c';
        ctx.fillRect(postX - 1, porchY + 4, 3, 4);
        ctx.fillStyle = P.woodPale[2];
        ctx.fillRect(postX, porchY + 4, 2, 3);
        ctx.fillStyle = P.woodPale[0];
        ctx.fillRect(postX, porchY + 4, 1, 3);
      }
    } else {
      // Южные дома: виден ТОЛЬКО козырёк-навес с северной стороны крыши над тротуаром (без фасада!)
      const porchY = oy - 5;
      ctx.fillStyle = 'rgba(20, 14, 10, 0.34)';
      ctx.fillRect(ox + 4, porchY + 3, s.w - 4, 5);
      ctx.fillStyle = '#140f0c';
      ctx.fillRect(ox + 2, porchY, s.w - 4, 6);
      for (let x = ox + 3; x < ox + s.w - 3; x += 3) {
        ctx.fillStyle = rng() < 0.5 ? P.woodPale[1] : P.woodPale[2];
        ctx.fillRect(x, porchY + 1, 2, 4);
      }
      ctx.fillStyle = P.woodPale[0];
      ctx.fillRect(ox + 3, porchY + 1, s.w - 6, 1);
    }

    // 3. Детализированная крыша (для южных домов занимает весь контур здания без фасада)
    const rx = ox + 2;
    const ry = oy + 2;
    const rw = s.w - 4;
    const rh = isNorth ? (s.h - facadeH - 3) : (s.h - 4);
    const ridgeY = ry + Math.floor(rh * 0.48);

    ctx.fillStyle = roofPal[2];
    ctx.fillRect(rx, ry, rw, rh);

    for (let y = ry; y < ry + rh; y++) {
      const southSlope = y > ridgeY;
      const row = y - ry;
      for (let x = rx; x < rx + rw; x++) {
        const col = x - rx;
        let idx = southSlope ? 3 : 1;

        if (s.roofStyle === 'shingle') {
          // Черепица / дранка: чёткие ряды каждые 4px со смещением кирпичиком (референсы 2 и 3)
          const tileRow = Math.floor(row / 4);
          const shift = (tileRow & 1) * 3;
          const localY = row % 4;
          const localX = (col + shift) % 6;
          const tileHash = hash2(Math.floor((col + shift) / 6), tileRow + s.x);

          if (localY === 3) {
            idx = 4; // тёмная тень под кромкой ряда дранки
          } else if (localX === 0) {
            idx = Math.min(4, idx + 1); // вертикальный стык
          } else {
            const varShift = tileHash < 0.22 ? -1 : tileHash > 0.78 ? 1 : 0;
            idx = G.MATH.clamp(idx + varShift, 0, 4);
            if (!southSlope && localY === 0 && tileHash < 0.45) idx = 0;
          }
        } else if (s.roofStyle === 'patchy') {
          // Выгоревшая пятнистая крыша с потёртыми светлыми досками (референс 3)
          const n = smoothNoise(x, y, 12);
          const rowLine = row % 4 === 3;
          if (rowLine) idx = 4;
          else if (n > 0.68) idx = southSlope ? 1 : 0;
          else if (n < 0.34) idx = southSlope ? 4 : 2;
          else idx = southSlope ? 3 : 1;
        } else {
          // Продольная дощатая крыша (бирюзовый дом)
          const plankLine = col % 5 === 0;
          const ph = hash2(Math.floor(col / 5), s.y);
          if (plankLine) idx = 4;
          else idx = G.MATH.clamp(idx + (ph < 0.3 ? -1 : ph > 0.72 ? 1 : 0), 0, 4);
        }

        ctx.fillStyle = roofPal[idx];
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Деревянный парапет-вывеска (false-front) над северным фасадом (классика Дикого Запада, референс 1 и 2)
    if (isNorth) {
      const py = ry + rh - 6;
      ctx.fillStyle = wallPal[4];
      ctx.fillRect(rx, py, rw, 6);
      ctx.fillStyle = wallPal[1];
      ctx.fillRect(rx + 1, py + 1, rw - 2, 4);
      ctx.fillStyle = wallPal[0];
      ctx.fillRect(rx + 2, py, rw - 4, 1);
      // Табличка по центру парапета
      const signW = Math.min(84, Math.floor(rw * 0.42));
      const signX = rx + Math.floor((rw - signW) * 0.5);
      ctx.fillStyle = '#140f0c';
      ctx.fillRect(signX, py - 2, signW, 7);
      ctx.fillStyle = '#b8a88a';
      ctx.fillRect(signX + 1, py - 1, signW - 2, 5);
      ctx.fillStyle = '#382a1e';
      if (s.signText === 'SHERIFF') {
        // Золотая звезда шерифа и надпись
        ctx.fillStyle = P.brass[0];
        ctx.fillRect(signX + 4, py + 1, 2, 2);
        ctx.fillStyle = '#26170d';
        for (let lx = signX + 9; lx < signX + signW - 6; lx += 4) {
          ctx.fillRect(lx, py + 1, 2, 2);
        }
      } else {
        for (let lx = signX + 6; lx < signX + signW - 6; lx += 4) {
          ctx.fillRect(lx, py + 1, 2, 2);
        }
      }
    }

    // Для южных зданий — только верхняя кромка фриза со стороны улицы (без перевёрнутого фасада)
    if (!isNorth) {
      ctx.fillStyle = wallPal[4];
      ctx.fillRect(rx, ry - 1, rw, 3);
      ctx.fillStyle = wallPal[1];
      ctx.fillRect(rx + 1, ry, rw - 2, 1);
      if (s.buildingType === 'smithy') {
        // Чугунная вытяжная труба горна на крыше кузницы
        const fx = rx + Math.floor(rw * 0.25);
        const fy = ridgeY - 8;
        ctx.fillStyle = 'rgba(18, 12, 9, 0.42)';
        ctx.fillRect(fx + 2, fy + 2, 9, 9);
        ctx.fillStyle = '#140f0c';
        ctx.fillRect(fx, fy, 8, 8);
        ctx.fillStyle = P.steelDark[2];
        ctx.fillRect(fx + 1, fy + 1, 6, 6);
        ctx.fillStyle = P.steelDark[0];
        ctx.fillRect(fx + 1, fy + 1, 3, 2);
        ctx.fillStyle = '#090706';
        ctx.fillRect(fx + 3, fy + 3, 2, 2);
      }
    }

    // Конёк крыши с объёмным бликом и тенью
    ctx.fillStyle = roofPal[4];
    ctx.fillRect(rx, ridgeY + 1, rw, 2);
    ctx.fillStyle = roofPal[0];
    ctx.fillRect(rx, ridgeY - 1, rw, 2);

    // Кирпичная печная труба с тенью по скату (референсы 2 и 3)
    if (s.chimney) {
      const cx = ox + s.w - 38;
      const cy = ridgeY - 11;
      ctx.fillStyle = 'rgba(18, 12, 9, 0.42)';
      ctx.fillRect(cx + 3, cy + 4, 13, 13);
      ctx.fillStyle = P.barnRed[4];
      ctx.fillRect(cx, cy, 12, 12);
      // Кирпичная кладка
      for (let by = 1; by < 11; by += 2) {
        for (let bx = 1; bx < 11; bx += 3) {
          const sh = (by + bx) % 4 === 0 ? 0 : 1;
          ctx.fillStyle = P.barnRed[sh];
          ctx.fillRect(cx + bx, cy + by, 2, 1);
        }
      }
      // Тёмное отверстие дымохода и карниз
      ctx.fillStyle = '#17120f';
      ctx.fillRect(cx + 3, cy + 3, 6, 6);
      ctx.fillStyle = '#29231f';
      ctx.fillRect(cx + 4, cy + 4, 4, 4);
    }

    return { canvas: c, ox: -ox, oy: -oy };
  }

  // Круглая деревянная водонапорная башня на брусьях (референсы вестерна)
  function bakeWaterTowerSprite(s, P) {
    const cw = s.w + 14;
    const ch = s.h + 18;
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext('2d');
    const ox = 7;
    const oy = 6;
    const cx = ox + s.w * 0.5;
    const cy = oy + s.h * 0.45;
    const r = s.w * 0.44;

    // 1. Полуденная тень башни на землю
    ctx.fillStyle = 'rgba(18, 12, 8, 0.44)';
    ctx.fillRect(Math.round(cx - r + 8), Math.round(cy + r - 4), Math.round(s.w + 4), 14);

    // 2. 4 массивных деревянных столба с перекрестьями (на каменных тумбах)
    const legCoords = [
      [cx - r + 3, cy + r - 12],
      [cx + r - 7, cy + r - 12],
      [cx - r + 7, cy + r - 3],
      [cx + r - 11, cy + r - 3]
    ];
    legCoords.forEach(([lx, ly]) => {
      ctx.fillStyle = P.stone[2];
      ctx.fillRect(Math.round(lx - 1), Math.round(ly + 5), 5, 4);
      ctx.fillStyle = P.stone[0];
      ctx.fillRect(Math.round(lx - 1), Math.round(ly + 5), 5, 1);
      ctx.fillStyle = P.woodWarm[4];
      ctx.fillRect(Math.round(lx), Math.round(ly), 4, 7);
      ctx.fillStyle = P.woodWarm[2];
      ctx.fillRect(Math.round(lx), Math.round(ly), 3, 7);
      ctx.fillStyle = P.woodWarm[0];
      ctx.fillRect(Math.round(lx), Math.round(ly), 1, 7);
    });

    // 3. Круглый чан из выгоревших досок (G.PAL.woodWarm) с железными обручами
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = Math.hypot(x, y);
        if (d > r) continue;
        const px = Math.round(cx + x);
        const py = Math.round(cy + y * 0.88);

        if (d > r - 1.2) {
          ctx.fillStyle = P.outline || '#140f0c';
        } else {
          const stave = Math.abs(x) % 5 === 0;
          const shade = (x / r) * 0.45 + (y / r) * 0.55;
          let col = shade < -0.2 ? P.woodPale[1] : shade < 0.2 ? P.woodPale[2] : shade < 0.55 ? P.woodPale[3] : P.woodPale[4];
          if (stave) col = P.woodPale[4];
          ctx.fillStyle = col;
        }
        ctx.fillRect(px, py, 1, 1);
      }
    }

    // Железные обручи чана (steelDark)
    [-r * 0.45, 0, r * 0.45].forEach((offsetY) => {
      const hy = Math.round(cy + offsetY * 0.88);
      const hoopW = Math.round(Math.sqrt(Math.max(0, r * r - offsetY * offsetY)));
      ctx.fillStyle = P.steelDark[4];
      ctx.fillRect(Math.round(cx - hoopW), hy, hoopW * 2, 2);
      ctx.fillStyle = P.steelDark[1];
      ctx.fillRect(Math.round(cx - hoopW), hy, hoopW * 2, 1);
      ctx.fillStyle = P.steelDark[0];
      ctx.fillRect(Math.round(cx - hoopW), hy, 4, 1);
    });

    // 4. Коническая крыша из дранки с латунным наконечником
    const roofR = r + 2;
    const peakY = cy - r * 0.6 - 12;
    for (let y = cy - r * 0.6; y >= peakY; y--) {
      const t = (cy - r * 0.6 - y) / (cy - r * 0.6 - peakY);
      const curR = Math.round(roofR * (1 - t));
      const py = Math.round(y);
      for (let x = -curR; x <= curR; x++) {
        let col = x < 0 ? P.shingle[1] : P.shingle[3];
        if ((x + y) % 4 === 0) col = P.shingle[4];
        if (Math.abs(x) === curR) col = P.outline || '#140f0c';
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(cx + x), py, 1, 1);
      }
    }
    ctx.fillStyle = P.brass[1];
    ctx.fillRect(Math.round(cx - 1), Math.round(peakY - 4), 3, 5);
    ctx.fillStyle = P.brass[0];
    ctx.fillRect(Math.round(cx), Math.round(peakY - 4), 1, 2);

    return { canvas: c, ox: -ox, oy: -oy };
  }

  // Кузнечная наковальня на деревянном чурбаке
  function bakeAnvilSprite(s, P) {
    const c = document.createElement('canvas');
    c.width = s.w;
    c.height = s.h;
    const ctx = c.getContext('2d');
    const w = s.w, h = s.h;

    // Дубовый чурбак (основание)
    ctx.fillStyle = P.outline || '#140f0c';
    ctx.fillRect(2, 4, w - 4, h - 4);
    ctx.fillStyle = P.woodWarm[3];
    ctx.fillRect(3, 5, w - 6, h - 6);
    ctx.fillStyle = P.woodWarm[1];
    ctx.fillRect(3, 5, w - 6, 2);
    ctx.fillStyle = P.steelDark[3];
    ctx.fillRect(2, h - 4, w - 4, 2);
    ctx.fillStyle = P.steelDark[1];
    ctx.fillRect(2, h - 4, w - 4, 1);

    // Чугунная наковальня с коническим рогом
    ctx.fillStyle = P.outline || '#140f0c';
    ctx.fillRect(1, 3, 5, 4);
    ctx.fillRect(0, 4, 3, 2);
    ctx.fillStyle = P.steelDark[1];
    ctx.fillRect(1, 3, 4, 3);
    ctx.fillStyle = P.steelDark[0];
    ctx.fillRect(1, 3, 4, 1);

    // Рабочая поверхность наковальни
    ctx.fillStyle = P.outline || '#140f0c';
    ctx.fillRect(5, 2, w - 8, 6);
    ctx.fillStyle = P.steelDark[1];
    ctx.fillRect(6, 3, w - 10, 4);
    ctx.fillStyle = P.steelDark[0];
    ctx.fillRect(6, 2, w - 10, 1); // полированный верхний отблеск

    // Отверстие под инструмент
    ctx.fillStyle = '#0a0807';
    ctx.fillRect(w - 7, 3, 2, 2);

    // Кузнечный молот рядом
    ctx.fillStyle = P.woodWarm[1];
    ctx.fillRect(w - 5, h - 6, 4, 1);
    ctx.fillStyle = P.steelDark[1];
    ctx.fillRect(w - 3, h - 7, 2, 3);

    return { canvas: c, ox: 0, oy: 0 };
  }

  // Слоистая 2.5D-скала каньона (плато сверху + крутой слоистый каменный обрыв + трещины)
  function bakeCliffSprite(s, P) {
    const c = document.createElement('canvas');
    c.width = s.w;
    c.height = s.h;
    const ctx = c.getContext('2d');
    const isInterior = !!s.interior;
    const isNorth = !isInterior && s.y < 150;
    const isEast = !isInterior && !!s.edgeEast;

    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        // Рваный пиксельный край скалы
        const edgeNoise = smoothNoise(x + s.x, y + s.y, 11);
        const distTop = y;
        const distBot = s.h - 1 - y;
        const distLeft = x;
        const distRight = s.w - 1 - x;

        const cutMargin = edgeNoise * 7;
        if (isInterior) {
          if (distTop < cutMargin || distBot < cutMargin || distLeft < cutMargin * 0.85 || distRight < cutMargin * 0.85) continue;
        } else {
          if (isNorth && distBot < cutMargin) continue;
          if (!isNorth && !isEast && distTop < cutMargin) continue;
          if (isEast && distLeft < cutMargin) continue;
        }

        const n1 = smoothNoise(x + s.x, (y + s.y) * 1.8, 18);
        const n2 = hash2(x + s.x, y + s.y);

        // Вертикальная стена обрыва на южном краю скал и внутренних меса-островков (2.5D объём!)
        const onCliffFace = isInterior
          ? (distBot < 22 + edgeNoise * 8 || distLeft < 9 + edgeNoise * 4 || distRight < 11 + edgeNoise * 5)
          : ((isNorth && distBot < 22 + edgeNoise * 10) || (isEast && distLeft < 18 + edgeNoise * 6));
        let arr = P.canyon;
        let t;

        if (onCliffFace) {
          // Горизонтальные осадочные слои (страты) на стенах ущелья
          const strata = Math.sin((y + s.y) * 0.52 + n1 * 3.0);
          t = 0.54 + strata * 0.24 + (n2 - 0.5) * 0.14;
          if (strata > 0.55) arr = P.stone;
          if (isInterior && (distBot < cutMargin + 2 || distRight < cutMargin * 0.85 + 2)) t = 0.94;
          else if (distBot < cutMargin + 2) t = 0.96;
        } else {
          // Верхнее солнечное плато скалы с каменными уступами
          t = 0.22 + (n1 - 0.5) * 0.52 + (n2 - 0.5) * 0.12;
          if (isInterior && (distBot < 26 + edgeNoise * 8 || distTop < cutMargin + 4 || distLeft < 13 + edgeNoise * 4)) {
            t = 0.06; // яркая солнечная бровка плато
          } else {
            if (isNorth && distBot < 26 + edgeNoise * 10) t = 0.05;
            if (!isNorth && !isEast && distTop < cutMargin + 3) t = 0.08;
          }
          if (n1 > 0.74) arr = P.stone;
        }

        ctx.fillStyle = pickDithered(arr, t, x, y);
        ctx.fillRect(x, y, 1, 1);
      }
    }

    return { canvas: c, ox: 0, oy: 0 };
  }

  // Объёмный валун-укрытие (серо-охристый слоистый камень с рваным силуэтом)
  function bakeBoulderSprite(s, P) {
    const c = document.createElement('canvas');
    c.width = s.w;
    c.height = s.h;
    const ctx = c.getContext('2d');
    const cx = s.w * 0.5;
    const cy = s.h * 0.5;
    const rx = s.w * 0.48;
    const ry = s.h * 0.48;

    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        const n = smoothNoise(x + s.x, y + s.y, 9);
        const d = Math.hypot(nx, ny) + (n - 0.5) * 0.28;
        if (d > 1.0) continue;

        const isOutline = d > 0.90;
        if (isOutline) {
          ctx.fillStyle = '#241812';
          ctx.fillRect(x, y, 1, 1);
          continue;
        }

        // Полуденное освещение: верх-лево светлее, низ-право в тени + каменные прожилки
        const light = 0.45 + nx * 0.34 + ny * 0.42 + (n - 0.5) * 0.32;
        const useStone = n > 0.46;
        const arr = useStone ? P.stone : P.canyon;
        ctx.fillStyle = pickDithered(arr, light, x, y);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return { canvas: c, ox: 0, oy: 0 };
  }

  // Детализированный деревянный ящик (с фактурой досок, диагональными планками и гвоздями)
  function bakeCrateSprite(s, P) {
    const c = document.createElement('canvas');
    c.width = s.w;
    c.height = s.h;
    const ctx = c.getContext('2d');
    const w = s.w, h = s.h;

    ctx.fillStyle = '#1f160f';
    ctx.fillRect(0, 0, w, h);

    // Внутренние доски крышки
    for (let y = 3; y < h - 3; y++) {
      const seam = (y - 3) % 5 === 4;
      for (let x = 3; x < w - 3; x++) {
        const n = hash2(x + s.x, y + s.y);
        ctx.fillStyle = seam ? P.woodWarm[4] : P.woodWarm[n < 0.3 ? 1 : n < 0.78 ? 2 : 3];
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Диагональная рейка-распорка
    for (let i = 4; i < Math.min(w, h) - 4; i++) {
      const px = Math.round(3 + (i - 3) * ((w - 6) / (Math.min(w, h) - 6)));
      const py = i;
      ctx.fillStyle = P.woodWarm[4];
      ctx.fillRect(px - 1, py + 1, 4, 2);
      ctx.fillStyle = P.woodWarm[1];
      ctx.fillRect(px - 1, py - 1, 3, 2);
      ctx.fillStyle = P.woodWarm[0];
      ctx.fillRect(px - 1, py - 1, 2, 1);
    }

    // Внешняя деревянная рама со скосом на полуденном солнце
    ctx.fillStyle = P.woodWarm[0];
    ctx.fillRect(1, 1, w - 2, 3);
    ctx.fillRect(1, 1, 3, h - 2);
    ctx.fillStyle = P.woodWarm[3];
    ctx.fillRect(1, h - 4, w - 2, 3);
    ctx.fillRect(w - 4, 1, 3, h - 2);
    ctx.fillStyle = P.woodWarm[4];
    ctx.strokeRect(3.5, 3.5, w - 7, h - 7);

    // Железные уголки и гвозди
    ctx.fillStyle = '#2e2c2a';
    [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]].forEach(([gx, gy]) => {
      ctx.fillRect(gx, gy, 1, 1);
    });

    return { canvas: c, ox: 0, oy: 0 };
  }

  // Детализированная крытая повозка со складками брезента и облучком
  function bakeWagonSprite(s, P) {
    const c = document.createElement('canvas');
    c.width = s.w + 8;
    c.height = s.h + 8;
    const ctx = c.getContext('2d');
    const ox = 4, oy = 4, w = s.w, h = s.h;

    // 4 деревянных колеса со спицами, выступающие по бокам
    ctx.fillStyle = '#1c140e';
    [[7, -2], [w - 19, -2], [7, h - 1], [w - 19, h - 1]].forEach(([wx, wy]) => {
      ctx.fillStyle = '#1f1610';
      ctx.fillRect(ox + wx, oy + wy, 12, 3);
      ctx.fillStyle = P.woodWarm[1];
      ctx.fillRect(ox + wx + 1, oy + wy + 1, 10, 1);
    });

    // Деревянный кузов и оглобля спереди
    ctx.fillStyle = '#24180f';
    ctx.fillRect(ox - 4, oy + Math.floor(h * 0.5) - 2, 6, 4);
    ctx.fillRect(ox, oy, w, h);
    ctx.fillStyle = P.woodWarm[2];
    ctx.fillRect(ox + 1, oy + 1, w - 2, h - 2);
    ctx.fillStyle = P.woodWarm[0];
    ctx.fillRect(ox + 1, oy + 1, w - 2, 2);

    // Выгоревший парусиновый тент с продольными дугами и тенью по южному боку
    const tx = ox + 8, ty = oy + 2, tw = w - 12, th = h - 4;
    for (let y = 0; y < th; y++) {
      const arch = Math.sin((y / (th - 1)) * Math.PI); // 0 по краям, 1 на гребне тента
      for (let x = 0; x < tw; x++) {
        const rib = x % 11 === 0;
        const n = hash2(x + s.x, y + s.y);
        let t = (1 - arch) * 0.65 + (y / th) * 0.35 + (n - 0.5) * 0.14;
        if (rib) t += 0.26;
        ctx.fillStyle = pickDithered(P.woodPale, t, x, y);
        ctx.fillRect(tx + x, ty + y, 1, 1);
      }
    }
    ctx.fillStyle = '#2b221a';
    ctx.fillRect(tx, ty, tw, 1);
    ctx.fillRect(tx, ty + th - 1, tw, 1);

    // Сиденье кучера спереди
    ctx.fillStyle = P.woodWarm[3];
    ctx.fillRect(ox + 2, oy + 3, 5, h - 6);
    ctx.fillStyle = P.woodWarm[1];
    ctx.fillRect(ox + 2, oy + 3, 4, 2);

    return { canvas: c, ox: -ox, oy: -oy };
  }

  // Пышное оливковое дерево с 1px пиксельной листвой (как слева на референсе 3)
  function bakeTreeSprite(tr, P) {
    const r = tr.r;
    const size = r * 2 + 12;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const cx = Math.floor(size * 0.5);
    const cy = Math.floor(size * 0.5);
    const rng = makeRng(tr.x * 41 + tr.y * 13);

    // Собираем крону из 7 перекрывающихся объёмных пучков листвы
    const lobes = [{ dx: 0, dy: 0, lr: r * 0.72 }];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rng() * 0.4;
      lobes.push({
        dx: Math.cos(a) * r * 0.42,
        dy: Math.sin(a) * r * 0.42,
        lr: r * (0.48 + rng() * 0.14)
      });
    }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let bestD = 99;
        for (let i = 0; i < lobes.length; i++) {
          const l = lobes[i];
          const d = Math.hypot(x - (cx + l.dx), y - (cy + l.dy)) / l.lr;
          if (d < bestD) bestD = d;
        }
        const leafN = hash2(x + tr.x, y + tr.y);
        if (bestD > 0.96 + (leafN - 0.5) * 0.24) continue;

        // Вектор солнца сверху-слева: яркие оливковые и золотистые листья с солнечной стороны
        const nx = (x - cx) / r;
        const ny = (y - cy) / r;
        let shade = 0.44 + nx * 0.36 + ny * 0.38 + (smoothNoise(x, y, 5) - 0.5) * 0.42;
        if (bestD > 0.86) shade += 0.28; // тёмный контур кроны
        const arr = shade < 0.18 && leafN < 0.45 ? P.grass : P.foliage;
        ctx.fillStyle = pickDithered(arr, shade, x, y);
        ctx.fillRect(x, y, 1, 1);
      }
    }

    return { canvas: c, ox: -cx, oy: -cy };
  }

  // Тюк сена — новое укрытие южного двора (плотная солома + верёвочные стяжки)
  function bakeHaySprite(s, P) {
    const c = document.createElement('canvas');
    c.width = s.w;
    c.height = s.h;
    const ctx = c.getContext('2d');
    const w = s.w;
    const h = s.h;

    // Контур со скошенными на 1px углами
    ctx.fillStyle = '#20170f';
    ctx.fillRect(1, 0, w - 2, h);
    ctx.fillRect(0, 1, w, h - 2);

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const n = hash2(x + s.x, y + s.y);
        let idx = n < 0.22 ? 0 : n < 0.60 ? 1 : n < 0.86 ? 2 : 3;
        // Верх-лево на солнце, низ-право в полуденной тени
        if (y <= 2 || x <= 2) idx = Math.max(0, idx - 1);
        if (y >= h - 3 || x >= w - 3) idx = Math.min(4, idx + 1);
        ctx.fillStyle = P.grass[idx];
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Торчащие соломинки по кромке
    for (let x = 2; x < w - 2; x += 3) {
      if (hash2(x + s.y, 7) < 0.5) {
        ctx.fillStyle = P.grass[0];
        ctx.fillRect(x, 1, 1, 2);
      }
      if (hash2(x + s.x, 13) < 0.4) {
        ctx.fillStyle = P.grass[3];
        ctx.fillRect(x, h - 3, 1, 2);
      }
    }

    // Верёвочные стяжки (leather)
    const band1 = Math.floor(w * 0.30);
    const band2 = Math.floor(w * 0.66);
    [band1, band2].forEach((bx) => {
      ctx.fillStyle = P.leather[4];
      ctx.fillRect(bx, 1, 3, h - 2);
      ctx.fillStyle = P.leather[2];
      ctx.fillRect(bx, 1, 2, h - 2);
      ctx.fillStyle = P.leather[0];
      ctx.fillRect(bx, 1, 2, 1);
    });

    return { canvas: c, ox: 0, oy: 0 };
  }

  // Корыто с водой — укрытие с "водной" акустикой и брызгами (mat: water)
  function bakeTroughSprite(s, P) {
    const c = document.createElement('canvas');
    c.width = s.w;
    c.height = s.h;
    const ctx = c.getContext('2d');
    const w = s.w;
    const h = s.h;

    ctx.fillStyle = '#1a120c';
    ctx.fillRect(1, 0, w - 2, h);
    ctx.fillRect(0, 1, w, h - 2);

    // Деревянные борта
    ctx.fillStyle = P.woodWarm[2];
    ctx.fillRect(1, 1, w - 2, h - 2);
    ctx.fillStyle = P.woodWarm[0];
    ctx.fillRect(1, 1, w - 2, 2);
    ctx.fillStyle = P.woodWarm[4];
    ctx.fillRect(1, h - 4, w - 2, 3);

    // Внутренняя водная гладь со ступенчатыми тонами
    const ix = 4;
    const iy = 4;
    const iw = w - 8;
    const ih = h - 9;
    ctx.fillStyle = P.water[3];
    ctx.fillRect(ix, iy, iw, ih);
    ctx.fillStyle = P.water[2];
    ctx.fillRect(ix, iy, iw, Math.max(1, Math.floor(ih * 0.62)));
    ctx.fillStyle = P.water[1];
    ctx.fillRect(ix, iy, iw, Math.max(1, Math.floor(ih * 0.32)));
    // Пиксельные блики-рябь
    ctx.fillStyle = P.water[0];
    ctx.fillRect(ix + 2, iy + 1, Math.max(2, Math.floor(iw * 0.35)), 1);
    ctx.fillRect(ix + Math.floor(iw * 0.55), iy + Math.max(1, ih - 3), Math.max(2, Math.floor(iw * 0.28)), 1);

    // Железные обручи на торцах
    ctx.fillStyle = P.steelDark[3];
    ctx.fillRect(2, 1, 2, h - 2);
    ctx.fillRect(w - 4, 1, 2, h - 2);
    ctx.fillStyle = P.steelDark[1];
    ctx.fillRect(2, 1, 1, h - 2);
    ctx.fillRect(w - 4, 1, 1, h - 2);

    return { canvas: c, ox: 0, oy: 0 };
  }

  // Секция жердевого забора — укрытие (горизонтальная или вертикальная)
  function bakeFenceSprite(s, P) {
    const c = document.createElement('canvas');
    c.width = s.w;
    c.height = s.h;
    const ctx = c.getContext('2d');
    const w = s.w;
    const h = s.h;
    const horizontal = w >= h;
    const rng = makeRng(s.x * 17 + s.y * 29 + 7);

    ctx.fillStyle = 'rgba(20, 14, 10, 0.34)';
    ctx.fillRect(2, 3, w, Math.max(2, Math.floor(h * 0.5)));

    if (horizontal) {
      // Две жерди с лёгким провисом
      for (let pass = 0; pass < 2; pass++) {
        const ry = Math.floor(h * (pass === 0 ? 0.24 : 0.58));
        for (let x = 0; x < w; x++) {
          const sag = Math.round(Math.sin((x / Math.max(1, w)) * Math.PI) * 1.2);
          ctx.fillStyle = P.woodPale[4];
          ctx.fillRect(x, ry + sag + 2, 1, 2);
          ctx.fillStyle = P.woodPale[2];
          ctx.fillRect(x, ry + sag, 1, 2);
          ctx.fillStyle = P.woodPale[0];
          ctx.fillRect(x, ry + sag, 1, 1);
        }
      }
      // Столбы
      for (let x = 2; x < w - 2; x += 26) {
        const jitter = rng() < 0.5 ? 0 : 1;
        ctx.fillStyle = 'rgba(20, 14, 10, 0.42)';
        ctx.fillRect(x + 2, 1 + jitter, 4, h - 1);
        ctx.fillStyle = P.woodPale[4];
        ctx.fillRect(x, jitter, 4, h - 1);
        ctx.fillStyle = P.woodPale[2];
        ctx.fillRect(x, jitter, 3, h - 2);
        ctx.fillStyle = P.woodPale[0];
        ctx.fillRect(x, jitter, 1, 3);
      }
    } else {
      // Вертикальная секция: два прогона и поперечные столбы
      for (let pass = 0; pass < 2; pass++) {
        const rx = Math.floor(w * (pass === 0 ? 0.26 : 0.60));
        for (let y = 0; y < h; y++) {
          const sag = Math.round(Math.sin((y / Math.max(1, h)) * Math.PI) * 1.2);
          ctx.fillStyle = P.woodPale[4];
          ctx.fillRect(rx + sag + 2, y, 2, 1);
          ctx.fillStyle = P.woodPale[2];
          ctx.fillRect(rx + sag, y, 2, 1);
          ctx.fillStyle = P.woodPale[0];
          ctx.fillRect(rx + sag, y, 1, 1);
        }
      }
      for (let y = 2; y < h - 2; y += 26) {
        const jitter = rng() < 0.5 ? 0 : 1;
        ctx.fillStyle = 'rgba(20, 14, 10, 0.42)';
        ctx.fillRect(1 + jitter, y + 2, w - 1, 4);
        ctx.fillStyle = P.woodPale[4];
        ctx.fillRect(jitter, y, w - 1, 4);
        ctx.fillStyle = P.woodPale[2];
        ctx.fillRect(jitter, y, w - 2, 3);
        ctx.fillStyle = P.woodPale[0];
        ctx.fillRect(jitter, y, 3, 1);
      }
    }

    return { canvas: c, ox: 0, oy: 0 };
  }

  // Низкая каменная стенка — простреливаемое укрытие (кладка из плитняка)
  function bakeLowWallSprite(s, P) {
    const c = document.createElement('canvas');
    c.width = s.w;
    c.height = s.h;
    const ctx = c.getContext('2d');
    const w = s.w;
    const h = s.h;

    // Контур и основание
    ctx.fillStyle = P.outline || '#140f0c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = P.stone[3];
    ctx.fillRect(1, 1, w - 2, h - 2);

    // Ряды кладки со сдвигом (пиксельные камни)
    for (let row = 0; row < Math.max(2, Math.floor((h - 2) / 4)); row++) {
      const y = 1 + row * 4;
      if (y > h - 2) break;
      const shift = (row & 1) * 5;
      for (let x = 1; x < w - 1; x++) {
        const k = hash2(x + s.x, y + s.y + row);
        const seam = ((x + shift) % 11 === 0) || (y === 1) || (y >= h - 2);
        if (seam) {
          ctx.fillStyle = P.stone[4];
        } else if (k < 0.28) {
          ctx.fillStyle = P.stone[0];
        } else if (k < 0.62) {
          ctx.fillStyle = P.stone[1];
        } else {
          ctx.fillStyle = P.stone[2];
        }
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Солнечная кромка сверху и полуденная тень у основания
    ctx.fillStyle = P.stone[0];
    ctx.fillRect(1, 1, w - 2, 1);
    ctx.fillStyle = P.stone[4];
    ctx.fillRect(1, h - 2, w - 2, 1);
    ctx.fillStyle = 'rgba(20, 14, 10, 0.34)';
    ctx.fillRect(2, h, w - 2, 2);

    return { canvas: c, ox: 0, oy: 0 };
  }

  function bakeWallOrPillarSprite(s, P) {
    const w = Math.round(s.w);
    const h = Math.round(s.h);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const colOut = P.outline || '#140f0c';

    ctx.fillStyle = colOut;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = P.woodWarm[3];
    ctx.fillRect(1, 1, w - 2, h - 2);
    ctx.fillStyle = P.woodWarm[1];
    ctx.fillRect(2, 2, w - 4, h - 4);
    ctx.fillStyle = P.woodWarm[0];
    ctx.fillRect(2, 2, w - 4, Math.min(2, h - 4));

    if (w > h) {
      ctx.fillStyle = P.woodWarm[4];
      ctx.fillRect(2, Math.floor(h * 0.5), w - 4, 1);
      for (let x = 14; x < w - 6; x += 16) {
        ctx.fillStyle = P.woodWarm[4];
        ctx.fillRect(x, 2, 1, h - 4);
        ctx.fillStyle = P.lead ? P.lead[3] : '#474542';
        ctx.fillRect(x - 2, 3, 1, 1);
        ctx.fillRect(x - 2, h - 4, 1, 1);
      }
    } else {
      ctx.fillStyle = P.woodWarm[4];
      ctx.fillRect(Math.floor(w * 0.5), 2, 1, h - 4);
      for (let y = 14; y < h - 6; y += 16) {
        ctx.fillStyle = P.woodWarm[4];
        ctx.fillRect(2, y, w - 4, 1);
        ctx.fillStyle = P.lead ? P.lead[3] : '#474542';
        ctx.fillRect(3, y - 2, 1, 1);
        ctx.fillRect(w - 4, y - 2, 1, 1);
      }
    }
    return { canvas: c, ox: 0, oy: 0 };
  }

  function bakeTableSprite(s, P) {
    const w = Math.round(s.w);
    const h = Math.round(s.h);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const colOut = P.outline || '#140f0c';

    ctx.fillStyle = colOut;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = P.woodWarm[3];
    ctx.fillRect(1, 1, w - 2, h - 2);
    ctx.fillStyle = P.woodWarm[1];
    ctx.fillRect(2, 2, w - 4, h - 4);
    ctx.fillStyle = P.woodWarm[0];
    ctx.fillRect(2, 2, w - 4, 2);
    for (let y = 8; y < h - 4; y += 7) {
      ctx.fillStyle = P.woodWarm[4];
      ctx.fillRect(2, y, w - 4, 1);
    }
    return { canvas: c, ox: 0, oy: 0 };
  }

  function bakeSolidSprites(solids, trees) {
    const P = getPal();
    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      if (s.type === 'building') s.baked = bakeBuildingSprite(s, P);
      else if (s.type === 'cliff') s.baked = bakeCliffSprite(s, P);
      else if (s.type === 'boulder') s.baked = bakeBoulderSprite(s, P);
      else if (s.type === 'crate') s.baked = bakeCrateSprite(s, P);
      else if (s.type === 'wagon') s.baked = bakeWagonSprite(s, P);
      else if (s.type === 'hay') s.baked = bakeHaySprite(s, P);
      else if (s.type === 'trough') s.baked = bakeTroughSprite(s, P);
      else if (s.type === 'fence') s.baked = bakeFenceSprite(s, P);
      else if (s.type === 'low_wall') s.baked = bakeLowWallSprite(s, P);
      else if (s.type === 'water_tower') s.baked = bakeWaterTowerSprite(s, P);
      else if (s.type === 'anvil') s.baked = bakeAnvilSprite(s, P);
      else if ((s.type === 'wall' || s.type === 'pillar') && !String(s.id).startsWith('sal_')) s.baked = bakeWallOrPillarSprite(s, P);
      else if (s.type === 'table' && !String(s.id).startsWith('sal_')) s.baked = bakeTableSprite(s, P);
    }
    for (let i = 0; i < trees.length; i++) {
      trees[i].baked = bakeTreeSprite(trees[i], P);
    }
  }

  // ==================== МИШЕНИ И ПЕРЕБАЛАНСИРОВАННЫЕ БАНДИТЫ ====================

  let banditIdSeq = 1000;

  // Единая фабрика бандита (используется и стартовым ростером, и рандомным спавном)
  function makeBandit(id, x, y, opts) {
    opts = opts || {};
    return {
      id: id,
      x: x,
      y: y,
      homeX: x,
      homeY: y,
      kind: 'bandit',
      mat: 'flesh',
      r: 11,
      hp: opts.hp || 80,
      maxHp: opts.hp || 80,
      alive: true,
      hitFlash: 0,
      hurtTimer: 0,
      wobble: 0,
      respawnTimer: 0,
      name: opts.name || 'БАНДИТ',
      coatColor: opts.coatColor || '#262423',
      coatTrim: opts.coatTrim || '#3d3733',
      hatColor: opts.hatColor || '#1c1714',
      hatBand: opts.hatBand || '#7d2820',
      bandana: opts.bandana || '#8a2b22',
      gunType: opts.gunType || 'revolver',
      tough: !!opts.tough,
      angle: opts.angle !== undefined ? opts.angle : Math.PI,
      patrolAmp: opts.patrolAmp || 16,
      patrolSpeed: opts.patrolSpeed || 1.1,
      patrolPhase: opts.patrolPhase || 0,
      walkPhase: 0,
      knockVx: 0,
      knockVy: 0,
      deathAnim: 0,
      fallAngle: 0,
      bloodPool: 0,
      aimTimer: 0,
      shootCooldown: 0.8 + ((opts.patrolPhase || 0) * 0.4) % 0.8,
      aimState: 'patrol',
      sightDist: opts.gunType === 'rifle' ? 480 : 420,
      shootRange: opts.gunType === 'rifle' ? 440 : 360,
      telegraphTime: 0.55,
      wallRaiseFrac: 0,

      // FSM & тактическое поведение
      aiState: 'patrol',
      patrolWaypoints: [
        { x: x, y: y },
        { x: x + Math.round(G.MATH.rand(-45, 45)), y: y + Math.round(G.MATH.rand(-35, 35)) },
        { x: x + Math.round(G.MATH.rand(-40, 40)), y: y + Math.round(G.MATH.rand(-40, 40)) }
      ],
      patrolIdx: 0,
      patrolWaitTimer: 0,
      lastKnownX: null,
      lastKnownY: null,
      searchTimer: 0,
      searchRole: opts.gunType === 'rifle' ? 'hold' : 'hunt',
      alertTimer: 0,
      alertAngle: opts.angle !== undefined ? opts.angle : Math.PI,
      inCover: false,
      peeking: false,
      crouchFrac: 0,
      coverObj: null,
      isDodging: false,
      dodgeTimer: 0,
      dodgeCooldown: 0,
      dodgeDx: 0,
      dodgeDy: 0,

      // Побег за подмогой
      fleeTimer: 0,
      fleeTarget: null,
      fledOnce: false,
      calledBackup: false,
      isReinforcement: !!opts.isReinforcement
    };
  }

  // Свободна ли точка под размещение бота (не внутри препятствий и не за краем карты)
  function isFreeSpot(x, y, r, solids) {
    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      if (x > s.x - r && x < s.x + s.w + r && y > s.y - r && y < s.y + s.h + r) {
        return false;
      }
    }
    return true;
  }

  function buildPatrolWaypoints(hx, hy, solids) {
    const pts = [{ x: hx, y: hy }];
    for (let p = 0; p < 2; p++) {
      let placed = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        const nx = G.MATH.clamp(hx + Math.round(G.MATH.rand(-64, 64)), 60, MAP_W - 80);
        const ny = G.MATH.clamp(hy + Math.round(G.MATH.rand(-52, 52)), 90, MAP_H - 90);
        if (isFreeSpot(nx, ny, 14, solids)) {
          pts.push({ x: nx, y: ny });
          placed = true;
          break;
        }
      }
      if (!placed) pts.push({ x: hx, y: hy });
    }
    return pts;
  }

  function getBanditRosterCandidates(shift) {
    const P = getPal();
    const s = shift || 0;
    return [
      {
        x: 508, y: 156 + s,
        opts: {
          coatColor: P.cloth[2], coatTrim: P.cloth[0], hatColor: P.leather[4], bandana: P.barnRed[1],
          gunType: 'revolver', hp: 78, patrolAmp: 14, patrolSpeed: 1.05, patrolPhase: 0.4
        }
      },
      {
        x: 1154, y: 240,
        opts: {
          coatColor: P.foliage[3], coatTrim: P.foliage[2], hatColor: P.leather[3], bandana: P.barnRed[1],
          gunType: 'rifle', hp: 84, patrolAmp: 22, patrolSpeed: 0.95, patrolPhase: 0.9
        }
      },
      {
        x: 1560, y: 152,
        opts: {
          coatColor: P.barnRed[3], coatTrim: P.barnRed[2], hatColor: P.leather[4], bandana: P.brass[1],
          gunType: 'revolver', hp: 82, patrolAmp: 20, patrolSpeed: 1.1, patrolPhase: 2.5
        }
      },
      {
        x: 2730, y: 385,
        opts: {
          name: 'ГЛАВАРЬ',
          coatColor: P.steelDark[4], coatTrim: P.steelDark[2], hatColor: P.outline, hatBand: P.brass[1], bandana: P.barnRed[0],
          gunType: 'rifle', tough: true, hp: 115, patrolAmp: 24, patrolSpeed: 1.0, patrolPhase: 4.2
        }
      },
      {
        x: 192, y: 668,
        opts: {
          coatColor: P.leather[3], coatTrim: P.leather[1], hatColor: P.leather[4], bandana: P.barnRed[1],
          gunType: 'revolver', hp: 78, patrolAmp: 16, patrolSpeed: 1.05, patrolPhase: 0.6
        }
      },
      {
        x: 714, y: 224 + s,
        opts: {
          coatColor: P.slateTeal[3], coatTrim: P.slateTeal[2], hatColor: P.leather[3], bandana: P.barnRed[0],
          gunType: 'rifle', hp: 82, patrolAmp: 18, patrolSpeed: 0.9, patrolPhase: 1.9
        }
      },
      {
        x: 1865, y: 355,
        opts: {
          coatColor: P.foliage[3], coatTrim: P.foliage[1], hatColor: P.leather[4], bandana: P.barnRed[1],
          gunType: 'rifle', hp: 84, patrolAmp: 20, patrolSpeed: 1.0, patrolPhase: 1.4
        }
      },
      {
        x: 2150, y: 405,
        opts: {
          coatColor: P.canyon[3], coatTrim: P.canyon[2], hatColor: P.leather[4], bandana: P.brass[2],
          gunType: 'revolver', hp: 80, patrolAmp: 18, patrolSpeed: 1.15, patrolPhase: 3.7
        }
      },
      {
        x: 1585, y: 448,
        opts: {
          coatColor: P.woodWarm[3], coatTrim: P.woodWarm[1], hatColor: P.leather[3], bandana: P.barnRed[2],
          gunType: 'revolver', hp: 80, patrolAmp: 15, patrolSpeed: 1.15, patrolPhase: 3.1
        }
      },
      {
        x: 2170, y: 706,
        opts: {
          coatColor: P.steelDark[3], coatTrim: P.steelDark[1], hatColor: P.leather[4], bandana: P.barnRed[0],
          gunType: 'rifle', hp: 82, patrolAmp: 22, patrolSpeed: 0.95, patrolPhase: 2.2
        }
      }
    ];
  }

  function createInitialTargets(width, height, solids) {
    const list = [];
    let tid = 1;

    function addTarget(x, y, kind, r, hp, mat) {
      list.push({
        id: tid++,
        x,
        y,
        kind,
        r,
        hp,
        maxHp: hp,
        mat,
        alive: true,
        hitFlash: 0,
        wobble: 0,
        respawnTimer: 0
      });
    }

    // Баланс HP под новое оружие:
    // Обычные бандиты 78–85 HP -> Winchester (92) ваншотит, Walker (50) — 2 выстрела, Lightning (28) — 3 выстрела.
    // Главарь в конце каньона 115 HP -> держит 1 выстрел из Винчестера.
    function addBandit(x, y, opts) {
      list.push(makeBandit(tid++, x, y, opts));
    }

    // Бутылки на полке салуна (интерьер сдвинут вместе с улицей)
    [84, 108, 134, 160, 186, 212].forEach((bx) => addTarget(bx, 96 + STREET_SHIFT, 'bottle', 5, 1, 'glass'));
    // За барной стойкой — плотный ряд бутылок (интерактивный декор)
    [76, 98, 120, 142, 164, 186, 208, 228].forEach((bx) => addTarget(bx, 106 + STREET_SHIFT, 'bottle', 5, 1, 'glass'));
    // На столешнице стойки
    [98, 152, 204].forEach((bx) => addTarget(bx, 124 + STREET_SHIFT, 'bottle', 5, 1, 'glass'));
    // Стол 2: бутылки-мишени (на sal_tbl1 остаётся только интерактивный бурбон)
    addTarget(227, 343 + STREET_SHIFT, 'bottle', 5, 1, 'glass');
    addTarget(252, 357 + STREET_SHIFT, 'bottle', 5, 1, 'glass');
    addTarget(236, 371 + STREET_SHIFT, 'bottle', 5, 1, 'glass');

    // Главная улица: мишени (бандиты берутся из общего ростера ниже с учётом лимита ботов)
    addTarget(565, 250 + STREET_SHIFT, 'bottle', 5, 1, 'glass');
    addTarget(615, 298 + STREET_SHIFT, 'steel', 10, 999, 'metal');
    addTarget(788, 344 + STREET_SHIFT, 'steel', 10, 999, 'metal');

    // Ущелье каньона и коридорные развилки
    addTarget(1104, 232, 'bottle', 5, 1, 'glass');
    addTarget(1172, 178, 'steel', 11, 999, 'metal');
    addTarget(1362, 164, 'steel', 11, 999, 'metal');
    addTarget(1520, 152, 'steel', 11, 999, 'metal');
    addTarget(1840, 162, 'bottle', 5, 1, 'glass');
    addTarget(1790, 350, 'steel', 11, 999, 'metal');
    addTarget(2120, 128, 'steel', 11, 999, 'metal');
    addTarget(2610, 195, 'steel', 12, 999, 'metal');

    // Распределённый ростер бандитов (улица, коридоры каньона, восточный котёл, южный двор)
    const banditCandidates = getBanditRosterCandidates(STREET_SHIFT);
    const initialCap = G.CFG.spawnBandits === false ? 0 : (G.CFG.botMaxAlive !== undefined ? G.CFG.botMaxAlive : 5);
    const initialCount = Math.min(banditCandidates.length, Math.max(0, initialCap));
    for (let i = 0; i < initialCount; i++) {
      addBandit(banditCandidates[i].x, banditCandidates[i].y, banditCandidates[i].opts);
    }

    // --- ЮЖНЫЙ ДВОР / ЗАГОН ---
    addTarget(180, 660, 'bottle', 5, 1, 'glass');
    addTarget(700, 742, 'bottle', 5, 1, 'glass');
    addTarget(150, 726, 'steel', 10, 999, 'metal');
    addTarget(620, 690, 'steel', 11, 999, 'metal');

    // Рандомный разброс стартовых точек: боты не стоят на жёстко зашитых координатах,
    // но остаются в своей зоне и не появляются внутри препятствий.
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (t.kind !== 'bandit') continue;
      for (let attempt = 0; attempt < 16; attempt++) {
        const nx = G.MATH.clamp(t.homeX + G.MATH.rand(-45, 45), 70, width - 90);
        const ny = G.MATH.clamp(t.homeY + G.MATH.rand(-35, 35), 95, height - 95);
        if (!isFreeSpot(nx, ny, t.r + 8, solids)) continue;
        t.x = Math.round(nx);
        t.y = Math.round(ny);
        t.homeX = t.x;
        t.homeY = t.y;
        break;
      }
      t.patrolWaypoints = buildPatrolWaypoints(t.homeX, t.homeY, solids);
    }

    return list;
  }

  G.WORLD = {
    create() {
      // Расширенная карта: восток (каньон) + юг (двор-загон)
      const width = MAP_W;
      const height = MAP_H;

      const solids = [
        // --- САЛУН (сдвинут вниз вместе с улицей) ---
        { id: 'sal_left',   x: 24,  y: SALOON.y,       w: 16,  h: 380, mat: 'wood', type: 'wall', high: true, isCover: true },
        { id: 'sal_top',    x: 24,  y: SALOON.y,       w: 316, h: 16,  mat: 'wood', type: 'wall', high: true, isCover: true },
        { id: 'sal_bot',    x: 24,  y: SALOON.y + 364, w: 316, h: 16,  mat: 'wood', type: 'wall', high: true, isCover: true },
        { id: 'sal_right1', x: 324, y: SALOON.y,       w: 16,  h: 146, mat: 'wood', type: 'wall', high: true, isCover: true },
        { id: 'sal_right2', x: 324, y: SALOON.y + 224, w: 16,  h: 156, mat: 'wood', type: 'wall', high: true, isCover: true },

        // Внутри салуна
        { id: 'sal_bar',    x: 68,  y: SALOON.y + 42,  w: 164, h: 24, mat: 'wood', type: 'counter', high: false, isCover: true },
        { id: 'sal_tbl1',   x: 92,  y: SALOON.y + 260, w: 46,  h: 46, mat: 'wood', type: 'table',   high: false, isCover: true },
        { id: 'sal_tbl2',   x: 218, y: SALOON.y + 264, w: 46,  h: 46, mat: 'wood', type: 'table',   high: false, isCover: true },
        { id: 'sal_pillar', x: 256, y: SALOON.y + 100, w: 18,  h: 18, mat: 'wood', type: 'pillar',  high: true,  isCover: true },

        // --- СЕВЕРНЫЕ АМБАРЫ (крупные вестерн-пропорции + проулок между ними) ---
        {
          id: 'bld_n1', x: 336, y: 30, w: 260, h: 170, mat: 'wood', type: 'building', high: true, isCover: true,
          signText: 'GENERAL STORE', roof: '#55524c', wallTrim: '#862a20', roofPalKey: 'shingle', wallPalKey: 'barnRed', roofStyle: 'shingle', chimney: true
        },
        {
          id: 'bld_n2', x: 640, y: 30, w: 260, h: 170, mat: 'wood', type: 'building', high: true, isCover: true,
          signText: 'TELEGRAPH', roof: '#4d7075', wallTrim: '#4d7075', roofPalKey: 'slateTeal', wallPalKey: 'slateTeal', roofStyle: 'planks', chimney: false
        },
        // Водонапорная башня на окраине северного ряда
        { id: 'water_tower', x: 914, y: 34, w: 56, h: 64, mat: 'wood', type: 'water_tower', high: true, isCover: true },

        // --- ЮЖНЫЕ ДОМА (ниже южного настила) ---
        {
          id: 'bld_s1', x: 336, y: 524, w: 250, h: 158, mat: 'wood', type: 'building', high: true, isCover: true,
          signText: 'SHERIFF', buildingType: 'sheriff', roof: '#706c64', wallTrim: '#968770', roofPalKey: 'shingle', wallPalKey: 'woodPale', roofStyle: 'patchy', chimney: true
        },
        {
          id: 'bld_s2', x: 600, y: 524, w: 262, h: 158, mat: 'wood', type: 'building', high: true, isCover: true,
          signText: 'BLACKSMITH', buildingType: 'smithy', roof: '#55524c', wallTrim: '#756652', roofPalKey: 'shingle', wallPalKey: 'woodPale', roofStyle: 'shingle', chimney: false
        },
        // Кузнечный двор: наковальня на чурбаке и закалочное корыто
        { id: 'anvil_1', x: 885, y: 546, w: 20, h: 16, mat: 'metal', type: 'anvil', high: false, isCover: true },
        { id: 'trough_quench', x: 914, y: 544, w: 42, h: 22, mat: 'water', type: 'trough', high: false, isCover: true },

        // Укрытия и бочки с водой вдоль улицы (повозки высокие high: true, ящики и бочки низкие)
        { id: 'crate_1',  x: 428, y: 272, w: 34, h: 34, mat: 'wood',  type: 'crate',        high: false, isCover: true },
        { id: 'crate_2',  x: 464, y: 280, w: 26, h: 26, mat: 'wood',  type: 'crate',        high: false, isCover: true },
        { id: 'wagon_1',  x: 540, y: 348, w: 62, h: 28, mat: 'wood',  type: 'wagon',        high: true,  isCover: true },
        { id: 'crate_3',  x: 642, y: 430, w: 36, h: 32, mat: 'wood',  type: 'crate',        high: false, isCover: true },
        { id: 'crate_4',  x: 742, y: 286, w: 32, h: 38, mat: 'wood',  type: 'crate',        high: false, isCover: true },
        { id: 'wagon_2',  x: 712, y: 364, w: 60, h: 28, mat: 'wood',  type: 'wagon',        high: true,  isCover: true },
        { id: 'crate_5',  x: 512, y: 422, w: 32, h: 30, mat: 'wood',  type: 'crate',        high: false, isCover: true },
        { id: 'crate_6',  x: 540, y: 426, w: 24, h: 24, mat: 'wood',  type: 'crate',        high: false, isCover: true },
        { id: 'barrel_1', x: 366, y: 234, w: 26, h: 26, mat: 'water', type: 'water_barrel', high: false, isCover: true },
        { id: 'barrel_2', x: 560, y: 476, w: 26, h: 26, mat: 'water', type: 'water_barrel', high: false, isCover: true },
        { id: 'barrel_3', x: 786, y: 236, w: 26, h: 26, mat: 'water', type: 'water_barrel', high: false, isCover: true },
        { id: 'barrel_4', x: 672, y: 274, w: 26, h: 26, mat: 'water', type: 'water_barrel', high: false, isCover: true },

        // Низкие каменные стенки — новые простреливаемые укрытия на улице и во дворе
        { id: 'lwall_1', x: 470, y: 398, w: 72, h: 14, mat: 'rock', type: 'low_wall', high: false, isCover: true },
        { id: 'lwall_2', x: 728, y: 476, w: 78, h: 14, mat: 'rock', type: 'low_wall', high: false, isCover: true },

        // Переправа через ручей в ущелье: деревянные перила мостика и выступающие валуны
        { id: 'bridge_rail_n', x: 1234, y: 330, w: 44, h: 6, mat: 'wood', type: 'fence', high: false, isCover: true },
        { id: 'bridge_rail_s', x: 1234, y: 396, w: 44, h: 6, mat: 'wood', type: 'fence', high: false, isCover: true },
        { id: 'stream_rock_1', x: 1262, y: 236, w: 32, h: 28, mat: 'rock', type: 'boulder', high: false, isCover: true },
        { id: 'stream_rock_2', x: 1238, y: 462, w: 34, h: 30, mat: 'rock', type: 'boulder', high: false, isCover: true },

        // --- УЩЕЛЬЕ КАНЬОНА: КОРИДОРНАЯ СЕТКА С РАЗВИЛКАМИ (960..2920) ---
        // Периметр ущелья (север и юг)
        { id: 'cliff_n1', x: 960,  y: 0, w: 180, h: 96, mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_n2', x: 1140, y: 0, w: 220, h: 74, mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_n3', x: 1360, y: 0, w: 280, h: 90, mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_n4', x: 1640, y: 0, w: 300, h: 82, mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_n5', x: 1940, y: 0, w: 320, h: 78, mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_n6', x: 2260, y: 0, w: 340, h: 92, mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_n7', x: 2600, y: 0, w: 320, h: 80, mat: 'rock', type: 'cliff', high: true, isCover: true },

        { id: 'cliff_s1', x: 964,  y: height - 92, w: 200, h: 92, mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_s2', x: 1164, y: height - 80, w: 240, h: 80, mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_s3', x: 1404, y: height - 86, w: 290, h: 86, mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_s4', x: 1694, y: height - 92, w: 310, h: 92, mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_s5', x: 2004, y: height - 84, w: 320, h: 84, mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_s6', x: 2324, y: height - 94, w: 310, h: 94, mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_s7', x: 2634, y: height - 86, w: 286, h: 86, mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_e',  x: width - 48, y: 68, w: 48, h: height - 136, mat: 'rock', type: 'cliff', high: true, isCover: true, edgeEast: true },

        // Внутренние скальные массивы-месы: делят каньон на 3 рукава, поперечные перемычки и восточный котёл
        { id: 'mesa_w1',    x: 1400, y: 205, w: 350, h: 195, mat: 'rock', type: 'cliff', high: true, isCover: true, interior: true },
        { id: 'mesa_w2',    x: 1410, y: 495, w: 330, h: 160, mat: 'rock', type: 'cliff', high: true, isCover: true, interior: true },
        { id: 'mesa_e1',    x: 1950, y: 175, w: 410, h: 180, mat: 'rock', type: 'cliff', high: true, isCover: true, interior: true },
        { id: 'mesa_e2',    x: 1965, y: 455, w: 425, h: 195, mat: 'rock', type: 'cliff', high: true, isCover: true, interior: true },
        { id: 'mesa_spire', x: 2560, y: 280, w: 135, h: 210, mat: 'rock', type: 'cliff', high: true, isCover: true, interior: true },

        // Валуны, повозки и укрытия в коридорах и на развилках каньона
        { id: 'rock_1',  x: 1070, y: 214, w: 46, h: 42, mat: 'rock', type: 'boulder', high: false, isCover: true },
        { id: 'rock_2',  x: 1206, y: 146, w: 44, h: 38, mat: 'rock', type: 'boulder', high: false, isCover: true },
        { id: 'rock_3',  x: 1206, y: 414, w: 50, h: 40, mat: 'rock', type: 'boulder', high: false, isCover: true },
        { id: 'rock_4',  x: 1340, y: 240, w: 42, h: 44, mat: 'rock', type: 'boulder', high: false, isCover: true },
        { id: 'rock_6',  x: 1310, y: 164, w: 44, h: 40, mat: 'rock', type: 'boulder', high: false, isCover: true },
        { id: 'crate_7', x: 1130, y: 308, w: 34, h: 32, mat: 'wood', type: 'crate', high: false, isCover: true },
        { id: 'lwall_3', x: 1250, y: 500, w: 78, h: 14, mat: 'rock', type: 'low_wall', high: false, isCover: true },

        // Северный коридор (Arm A) + Центральный (Arm B) + Южное русло (Arm C)
        { id: 'rock_5',   x: 1510, y: 128, w: 46, h: 40, mat: 'rock', type: 'boulder', high: false, isCover: true },
        { id: 'crate_12', x: 1640, y: 116, w: 34, h: 32, mat: 'wood', type: 'crate', high: false, isCover: true },
        { id: 'lwall_a1', x: 1570, y: 176, w: 72, h: 14, mat: 'rock', type: 'low_wall', high: false, isCover: true },
        { id: 'wagon_4',  x: 1505, y: 434, w: 62, h: 28, mat: 'wood', type: 'wagon', high: true, isCover: true },
        { id: 'barrel_6', x: 1625, y: 420, w: 26, h: 26, mat: 'water', type: 'water_barrel', high: false, isCover: true },
        { id: 'lwall_4',  x: 1670, y: 446, w: 70, h: 14, mat: 'rock', type: 'low_wall', high: false, isCover: true },
        { id: 'hay_4',    x: 1520, y: 688, w: 32, h: 24, mat: 'hay', type: 'hay', high: false, isCover: true },
        { id: 'crate_13', x: 1615, y: 674, w: 34, h: 32, mat: 'wood', type: 'crate', high: false, isCover: true },
        { id: 'rock_c1',  x: 1445, y: 710, w: 44, h: 38, mat: 'rock', type: 'boulder', high: false, isCover: true },

        // Средняя перемычка-разветвление (1750..1950)
        { id: 'rock_10',  x: 1815, y: 270, w: 46, h: 42, mat: 'rock', type: 'boulder', high: false, isCover: true },
        { id: 'crate_11', x: 1850, y: 530, w: 34, h: 32, mat: 'wood', type: 'crate', high: false, isCover: true },
        { id: 'trough_2', x: 1795, y: 615, w: 54, h: 22, mat: 'water', type: 'trough', high: false, isCover: true },

        // Восточные коридоры (1950..2420)
        { id: 'rock_e1',   x: 2110, y: 108, w: 44, h: 38, mat: 'rock', type: 'boulder', high: false, isCover: true },
        { id: 'lwall_e1',  x: 2245, y: 146, w: 74, h: 14, mat: 'rock', type: 'low_wall', high: false, isCover: true },
        { id: 'rock_11',   x: 2055, y: 382, w: 44, h: 40, mat: 'rock', type: 'boulder', high: false, isCover: true },
        { id: 'crate_e1',  x: 2220, y: 402, w: 34, h: 32, mat: 'wood', type: 'crate', high: false, isCover: true },
        { id: 'wagon_5',   x: 2075, y: 684, w: 62, h: 28, mat: 'wood', type: 'wagon', high: true, isCover: true },
        { id: 'barrel_e1', x: 2205, y: 672, w: 26, h: 26, mat: 'water', type: 'water_barrel', high: false, isCover: true },
        { id: 'crate_e2',  x: 2265, y: 696, w: 34, h: 32, mat: 'wood', type: 'crate', high: false, isCover: true },

        // Восточный котёл вокруг шпиля (2390..2870)
        { id: 'lwall_e2',  x: 2445, y: 356, w: 72, h: 14, mat: 'rock', type: 'low_wall', high: false, isCover: true },
        { id: 'crate_e3',  x: 2485, y: 208, w: 34, h: 32, mat: 'wood', type: 'crate', high: false, isCover: true },
        { id: 'barrel_e2', x: 2748, y: 306, w: 26, h: 26, mat: 'water', type: 'water_barrel', high: false, isCover: true },
        { id: 'wagon_6',   x: 2735, y: 432, w: 62, h: 28, mat: 'wood', type: 'wagon', high: true, isCover: true },
        { id: 'hay_5',     x: 2610, y: 562, w: 34, h: 24, mat: 'hay', type: 'hay', high: false, isCover: true },
        { id: 'rock_e2',   x: 2755, y: 566, w: 46, h: 42, mat: 'rock', type: 'boulder', high: false, isCover: true },

        // --- ЮЖНЫЙ ДВОР / ЗАГОН (под салуном) ---
        { id: 'fence_y1', x: 56,  y: 596, w: 244, h: 12, mat: 'wood', type: 'fence', high: false, isCover: true },
        { id: 'fence_y2', x: 56,  y: 736, w: 90,  h: 12, mat: 'wood', type: 'fence', high: false, isCover: true },
        { id: 'fence_y7', x: 196, y: 736, w: 104, h: 12, mat: 'wood', type: 'fence', high: false, isCover: true },
        { id: 'fence_y3', x: 56,  y: 596, w: 12,  h: 152, mat: 'wood', type: 'fence', high: false, isCover: true },
        { id: 'fence_y4', x: 300, y: 596, w: 12,  h: 152, mat: 'wood', type: 'fence', high: false, isCover: true },
        { id: 'hay_1',    x: 96,  y: 626, w: 36, h: 26, mat: 'hay', type: 'hay', high: false, isCover: true },
        { id: 'hay_2',    x: 150, y: 634, w: 30, h: 22, mat: 'hay', type: 'hay', high: false, isCover: true },
        { id: 'trough_1', x: 210, y: 690, w: 58, h: 22, mat: 'water', type: 'trough', high: false, isCover: true },
        { id: 'crate_8',  x: 262, y: 626, w: 32, h: 32, mat: 'wood', type: 'crate', high: false, isCover: true },
        { id: 'lwall_5',  x: 90,  y: 700, w: 76, h: 14, mat: 'rock', type: 'low_wall', high: false, isCover: true },

        // Южная полоса за домами (обход с фланга)
        { id: 'hay_3',    x: 400, y: 700, w: 34, h: 26, mat: 'hay', type: 'hay', high: false, isCover: true },
        { id: 'crate_9',  x: 460, y: 724, w: 30, h: 30, mat: 'wood', type: 'crate', high: false, isCover: true },
        { id: 'fence_y5', x: 520, y: 706, w: 160, h: 12, mat: 'wood', type: 'fence', high: false, isCover: true },
        { id: 'crate_10', x: 720, y: 700, w: 34, h: 32, mat: 'wood', type: 'crate', high: false, isCover: true },
        { id: 'wagon_3',  x: 780, y: 728, w: 62, h: 28, mat: 'wood', type: 'wagon', high: true, isCover: true },
        { id: 'barrel_5', x: 858, y: 690, w: 26, h: 26, mat: 'water', type: 'water_barrel', high: false, isCover: true }
      ];

      // Телеграфные столбы с проводами вдоль улицы (референсы 1 и 2)
      const poles = [
        { x: 406, y: 118 + STREET_SHIFT },
        { x: 600, y: 114 + STREET_SHIFT },
        { x: 780, y: 116 + STREET_SHIFT },
        { x: 930, y: 106 + STREET_SHIFT }
      ];

      // Оливковые деревья на окраине городка и в карманах каньона
      const trees = [
        { x: 620, y: 206, r: 18 },
        { x: 900, y: 500, r: 22 },
        { x: 946, y: 420, r: 26 },
        { x: 300, y: 760, r: 20 },
        { x: 1850, y: 120, r: 22 },
        { x: 1840, y: 705, r: 24 },
        { x: 2475, y: 138, r: 22 },
        { x: 2795, y: 685, r: 24 }
      ];

      function clonePlainSolid(s) {
        return {
          id: s.id,
          x: Math.round(s.x),
          y: Math.round(s.y),
          w: Math.round(s.w),
          h: Math.round(s.h),
          mat: s.mat || 'wood',
          type: s.type || 'wall',
          high: !!s.high,
          isCover: s.isCover !== undefined ? !!s.isCover : true,
          label: s.label,
          signColor: s.signColor,
          facadeColor: s.facadeColor,
          interior: !!s.interior,
          edgeEast: !!s.edgeEast
        };
      }

      const defaultSolidsSnapshot = solids.map(clonePlainSolid);

      // Если пользователь сохранил свою карту в редакторе, восстанавливаем её из localStorage
      try {
        const rawMap = localStorage.getItem(MAP_STORAGE_KEY);
        if (rawMap) {
          const parsed = JSON.parse(rawMap);
          if (Array.isArray(parsed) && parsed.length > 0) {
            solids.length = 0;
            for (let i = 0; i < parsed.length; i++) {
              const item = parsed[i];
              if (item && typeof item.x === 'number' && typeof item.y === 'number' && item.w > 0 && item.h > 0) {
                solids.push(clonePlainSolid(item));
              }
            }
          }
        }
      } catch (_) {}

      bakeSolidSprites(solids, trees);

      solids.forEach((s) => initDestructibleProps(s));

      const wallSegments = [];
      const barrelSegments = [];
      const raiseSegments = [];
      const soundSegments = [];

      function fillSegmentsFromSolids() {
        wallSegments.length = 0;
        barrelSegments.length = 0;
        raiseSegments.length = 0;
        soundSegments.length = 0;
        for (let i = 0; i < solids.length; i++) {
          const s = solids[i];
          const segs = rectToSegments(s);
          for (let j = 0; j < segs.length; j++) {
            const seg = segs[j];
            wallSegments.push(seg);
            barrelSegments.push(seg);
            // Ствол поднимается и акустика отражается ТОЛЬКО у высоких преград (high: true)
            if (s.high) {
              raiseSegments.push(seg);
              soundSegments.push(seg);
            }
          }
        }
      }
      fillSegmentsFromSolids();

      const doors = [
        { hingeX: 332, hingeY: 217 + STREET_SHIFT, len: 36, baseAngle: Math.PI / 2,  angle: 0, vel: 0 },
        { hingeX: 332, hingeY: 293 + STREET_SHIFT, len: 36, baseAngle: -Math.PI / 2, angle: 0, vel: 0 }
      ];

      const saloonZone = { id: 'saloon', x: SALOON.x, y: SALOON.y, w: SALOON.w, h: SALOON.h };

      const world = {
        width,
        height,
        solids,
        covers: solids.filter((s) => s.isCover),
        waterBarrels: solids.filter((s) => s.type === 'water_barrel'),
        waterContainers: solids.filter((s) => s.type === 'water_barrel' || s.type === 'trough'),
        puddles: [],
        poles,
        trees,
        wallSegments,
        barrelSegments,
        raiseSegments,
        soundSegments,
        doors,
        // Интерьер салуна и список закрытых помещений (для порохового дыма, теней и логики зон)
        saloon: { ...saloonZone },
        indoorZones: [saloonZone],
        interactables: [
          { id: 'saloon_bourbon', kind: 'bourbon', x: 115, y: SALOON.y + 278, label: 'ВЫПИТЬ БУРБОН', r: 46 },
          { id: 'saloon_hatrack', kind: 'hatrack', x: 54,  y: SALOON.y + 132, label: 'СМЕНИТЬ ШЛЯПУ', r: 44 },
          { id: 'saloon_medkit',  kind: 'medkit',  x: 248, y: SALOON.y + 54,  label: 'ВЗЯТЬ БИНТЫ',  r: 44 }
        ],
        streetShift: STREET_SHIFT,
        streetTop: STREET_TOP,
        streetBot: STREET_BOT,
        spawnTimer: 0,
        targets: createInitialTargets(width, height, solids),
        bgCanvas: bakeBackground(width, height),

        initDestructibleProps,
        bakeSolidSprites(targetSolids, targetTrees) {
          bakeSolidSprites(targetSolids || world.solids, targetTrees || []);
        },

        rebuildGeometry() {
          world.covers = world.solids.filter((s) => s.isCover);
          world.waterBarrels = world.solids.filter((s) => s.type === 'water_barrel');
          world.waterContainers = world.solids.filter((s) => s.type === 'water_barrel' || s.type === 'trough');
          fillSegmentsFromSolids();
        },

        editorSeq: 1,

        addEditorSolid(opts) {
          const tpl = opts || {};
          const s = {
            id: tpl.id || ('ed_' + Date.now().toString(36) + '_' + (world.editorSeq++)),
            x: Math.round(tpl.x || 0),
            y: Math.round(tpl.y || 0),
            w: Math.max(8, Math.round(tpl.w || 32)),
            h: Math.max(8, Math.round(tpl.h || 32)),
            mat: tpl.mat || 'wood',
            type: tpl.type || 'crate',
            high: !!tpl.high,
            isCover: tpl.isCover !== undefined ? !!tpl.isCover : true
          };
          initDestructibleProps(s);
          bakeSolidSprites([s], []);
          world.solids.push(s);
          world.rebuildGeometry();
          return s;
        },

        findSolidAtPoint(x, y) {
          // Ищем с конца списка, отдавая приоритет недавно добавленным и обычным укрытиям (кроме зданий/краёв карты при наличии поверх них укрытий)
          for (let i = world.solids.length - 1; i >= 0; i--) {
            const s = world.solids[i];
            if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) {
              return s;
            }
          }
          return null;
        },

        removeSolidById(id, state) {
          const idx = world.solids.findIndex((s) => s.id === id);
          if (idx === -1) return false;
          const removed = world.solids[idx];
          world.solids.splice(idx, 1);
          world.puddles = world.puddles.filter((pd) => pd.barrelId !== id && pd.containerId !== id);
          clearRemovedCoverFromPlayers(state, removed);
          for (let i = 0; i < world.targets.length; i++) {
            const t = world.targets[i];
            if (t.coverObj === removed) {
              t.inCover = false;
              t.peeking = false;
              t.coverObj = null;
            }
          }
          world.rebuildGeometry();
          return true;
        },

        exportSolidsJSON() {
          return JSON.stringify(world.solids.map(clonePlainSolid), null, 2);
        },

        saveCustomMap() {
          try {
            localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(world.solids.map(clonePlainSolid)));
            return true;
          } catch (_) {
            return false;
          }
        },

        resetCustomMap(state) {
          try {
            localStorage.removeItem(MAP_STORAGE_KEY);
          } catch (_) {}
          if (state && state.decals) state.decals = [];
          world.applyNetworkSolids(defaultSolidsSnapshot, state);
        },

        exportSolidsList() {
          return world.solids.map(clonePlainSolid);
        },

        applyNetworkSolids(list, state) {
          if (!Array.isArray(list)) return;
          world.solids.length = 0;
          for (let i = 0; i < list.length; i++) {
            const s = clonePlainSolid(list[i]);
            initDestructibleProps(s);
            world.solids.push(s);
          }
          bakeSolidSprites(world.solids, []);
          world.puddles = [];
          clearRemovedCoverFromPlayers(state, null);
          world.rebuildGeometry();
        },

        getIndoorZoneAt(x, y) {
          for (let i = 0; i < world.indoorZones.length; i++) {
            const z = world.indoorZones[i];
            if (x >= z.x + 8 && x <= z.x + z.w - 8 && y >= z.y + 8 && y <= z.y + z.h - 8) {
              return z;
            }
          }
          return null;
        },

        // Водные зоны (лужи от пробитых бочек/корыт + текущие струи) для системной совместимости с огнём
        getWaterZones() {
          const zones = [];
          for (let i = 0; i < world.puddles.length; i++) {
            const pd = world.puddles[i];
            if (pd.r > 1.5 && (pd.alpha === undefined || pd.alpha > 0.05)) zones.push(pd);
          }
          const containers = world.waterContainers || world.waterBarrels || [];
          for (let i = 0; i < containers.length; i++) {
            const b = containers[i];
            if (!b.holes || !b.holes.length || (b.waterLevel || 0) <= 0) continue;
            const cx = b.x + b.w * 0.5;
            const cy = b.y + b.h * 0.5;
            for (let j = 0; j < b.holes.length; j++) {
              const h = b.holes[j];
              zones.push({
                id: `${b.id}_jet_${j}`,
                x: cx + h.nx * (b.w * 0.5 + 8),
                y: cy + h.ny * (b.h * 0.5 + 8),
                r: 9,
                maxR: 12,
                wet: true,
                extinguishesFire: true
              });
            }
          }
          return zones;
        },

        isPointWet(x, y) {
          const zones = world.getWaterZones();
          for (let i = 0; i < zones.length; i++) {
            const z = zones[i];
            if (G.MATH.dist(x, y, z.x, z.y) <= z.r) return true;
          }
          return false;
        },

        computeSafePuddlePos(container) {
          let px = container.x + container.w * 0.5;
          let py = container.y + container.h * 0.5;
          // На главной улице не даём центру лужи лезть вверх/вниз на деревянный тротуар-настил
          if (px >= 335 && px <= 865) {
            if (container.y >= STREET_TOP - 6 && container.y <= STREET_TOP + 34) {
              py = Math.max(py, STREET_TOP + 29);
            } else if (container.y + container.h >= STREET_BOT - 12 && container.y <= STREET_BOT + 28) {
              py = Math.min(py, STREET_BOT - 14);
            }
          }
          // Слегка отодвигаем центр от близких заборов/стен/зданий
          let pushX = 0;
          let pushY = 0;
          for (let i = 0; i < world.solids.length; i++) {
            const s = world.solids[i];
            if (s === container) continue;
            if (s.type !== 'fence' && s.type !== 'wall' && s.type !== 'building' && s.type !== 'cliff' && s.type !== 'low_wall') {
              continue;
            }
            const nx = G.MATH.clamp(px, s.x, s.x + s.w);
            const ny = G.MATH.clamp(py, s.y, s.y + s.h);
            const dx = px - nx;
            const dy = py - ny;
            const d = Math.hypot(dx, dy);
            if (d < 22) {
              if (d > 0.5) {
                const w = (22 - d) * 0.45;
                pushX += (dx / d) * w;
                pushY += (dy / d) * w;
              } else {
                pushY += (py < s.y + s.h * 0.5 ? -8 : 8);
              }
            }
          }
          px += G.MATH.clamp(pushX, -10, 10);
          py += G.MATH.clamp(pushY, -10, 10);
          return { x: Math.round(px), y: Math.round(py) };
        },

        ensureContainerPuddle(container) {
          for (let i = 0; i < world.puddles.length; i++) {
            const p = world.puddles[i];
            if (p.containerId === container.id || p.barrelId === container.id) return p;
          }
          const pos = world.computeSafePuddlePos(container);
          const pd = {
            id: `puddle_${container.id}`,
            containerId: container.id,
            barrelId: container.id,
            x: pos.x,
            y: pos.y,
            r: container.type === 'trough' ? 12 : 10,
            maxR: container.type === 'trough' ? 36 : 30,
            absorbDelay: 7.0,
            alpha: 1.0,
            wet: true,
            extinguishesFire: true
          };
          world.puddles.push(pd);
          return pd;
        },

        ensureBarrelPuddle(barrel) {
          return world.ensureContainerPuddle(barrel);
        },

        updateWaterContainersAndPuddles(dt) {
          const containers = world.waterContainers || world.waterBarrels || [];
          for (let i = 0; i < containers.length; i++) {
            const b = containers[i];
            if (b.holes && b.holes.length > 0 && b.waterLevel > 0) {
              const drain = (0.065 + b.holes.length * 0.095) * dt;
              b.waterLevel = Math.max(0, b.waterLevel - drain);
              const pd = world.ensureContainerPuddle(b);
              pd.r = Math.min(pd.maxR, pd.r + (2.4 + b.holes.length * 2.5) * dt);
              pd.absorbDelay = 7.0;
              pd.alpha = 1.0;
              if (b.waterLevel <= 0) {
                b.waterEmpty = true;
                b.damageStage = Math.max(b.damageStage || 0, 1);
              }
            }
          }
          // Постепенное впитывание и высыхание луж после опустошения бочки/корыта
          for (let i = world.puddles.length - 1; i >= 0; i--) {
            const pd = world.puddles[i];
            let linked = null;
            for (let j = 0; j < containers.length; j++) {
              if (containers[j].id === pd.containerId || containers[j].id === pd.barrelId) {
                linked = containers[j];
                break;
              }
            }
            if (linked && (linked.waterLevel || 0) > 0 && linked.holes && linked.holes.length > 0) {
              pd.absorbDelay = 7.0;
              pd.alpha = 1.0;
              continue;
            }
            if ((pd.absorbDelay || 0) > 0) {
              pd.absorbDelay = Math.max(0, pd.absorbDelay - dt);
            } else {
              pd.r = Math.max(0, pd.r - 2.8 * dt);
              pd.alpha = Math.max(0, (pd.alpha !== undefined ? pd.alpha : 1.0) - 0.16 * dt);
              if (pd.alpha <= 0.02 || pd.r <= 1.5) {
                world.puddles.splice(i, 1);
              }
            }
          }
        },

        updateWaterBarrelsAndPuddles(dt) {
          return world.updateWaterContainersAndPuddles(dt);
        },

        // Повреждение и износ укрытий (неразрушимые укрытия со стадиями бреши + физика бочек и корыт)
        damageSolid(solid, dmg, hitX, hitY, bdx, bdy, state, weaponId) {
          if (!solid || !solid.destructible) return { destroyed: false };

          const cx = solid.x + solid.w * 0.5;
          const cy = solid.y + solid.h * 0.5;

          // Особая физика бочки с водой и корыта (обе ёмкости не исчезают)
          if (solid.type === 'water_barrel' || solid.type === 'trough') {
            if (!solid.holes) solid.holes = [];
            const pushHole = (px, py, forceNx, forceNy) => {
              if (solid.holes.length >= 4) return;
              const lx = G.MATH.clamp(px - cx, -solid.w * 0.44, solid.w * 0.44);
              const ly = G.MATH.clamp(py - cy, -solid.h * 0.44, solid.h * 0.44);
              for (let k = 0; k < solid.holes.length; k++) {
                if (Math.hypot(solid.holes[k].lx - lx, solid.holes[k].ly - ly) < 3.5) return;
              }
              let nx = forceNx;
              let ny = forceNy;
              if (nx === undefined || ny === undefined) {
                const nLen = Math.hypot(lx / Math.max(1, solid.w * 0.5), ly / Math.max(1, solid.h * 0.5)) || 1;
                nx = (lx / Math.max(1, solid.w * 0.5)) / nLen;
                ny = (ly / Math.max(1, solid.h * 0.5)) / nLen;
              }
              solid.holes.push({ lx, ly, nx, ny });
            };

            const entryX = hitX !== undefined ? hitX : cx;
            const entryY = hitY !== undefined ? hitY : cy;
            const bLen = Math.hypot(bdx || 0, bdy || 0);
            const ndx = bLen > 1e-4 ? bdx / bLen : 1;
            const ndy = bLen > 1e-4 ? bdy / bLen : 0;

            pushHole(entryX, entryY);

            const isWinchester = weaponId === 'winchester';
            if (isWinchester) {
              // Винчестер сразу прошивает стенку на входе и противоположной стенке выхода
              let txMax = Infinity;
              let tyMax = Infinity;
              if (ndx > 1e-5) txMax = (solid.x + solid.w - 1 - entryX) / ndx;
              else if (ndx < -1e-5) txMax = (solid.x + 1 - entryX) / ndx;
              if (ndy > 1e-5) tyMax = (solid.y + solid.h - 1 - entryY) / ndy;
              else if (ndy < -1e-5) tyMax = (solid.y + 1 - entryY) / ndy;
              const tOut = G.MATH.clamp(Math.min(txMax, tyMax), 4, Math.max(solid.w, solid.h));
              const ex = entryX + ndx * tOut;
              const ey = entryY + ndy * tOut;
              pushHole(ex, ey, ndx, ndy);
            }

            if ((solid.waterLevel || 0) > 0) {
              const burstDrain = isWinchester ? 0.22 : 0.12;
              solid.waterLevel = Math.max(0, (solid.waterLevel || 1) - burstDrain);
              const pd = world.ensureContainerPuddle(solid);
              pd.r = Math.min(pd.maxR, pd.r + (isWinchester ? 7.5 : 4.5));
              pd.absorbDelay = 7.0;
              pd.alpha = 1.0;
              if (solid.waterLevel <= 0) solid.waterEmpty = true;
            }
            solid.damageStage = Math.max(solid.damageStage || 0, (solid.waterEmpty || solid.holes.length >= 2) ? 1 : 0);
            return { destroyed: false, holes: solid.holes.length, stage: solid.damageStage };
          }

          // Неразрушимые укрытия (crate, hay, table, fence): износ до простреливаемого состояния
          solid.hitCount = (solid.hitCount || 0) + 1;
          solid.breachHp = Math.max(0, (solid.breachHp !== undefined ? solid.breachHp : 180) - dmg);
          if (solid.breachHp <= 0) {
            solid.breached = true;
            solid.damageStage = 2;
          } else if (solid.breachHp < (solid.maxBreachHp || 180)) {
            solid.damageStage = Math.max(solid.damageStage || 0, 1);
          }
          return { destroyed: false, breached: !!solid.breached, stage: solid.damageStage };
        },

        // Рандомная точка появления бота: внутри игровых зон и коридоров каньона, без пересечения со скалами
        pickSpawnPoint(player, nearX, nearY) {
          const zones = [
            { x1: 360, y1: 245, x2: 930, y2: 492 },       // главная улица
            { x1: 990, y1: 120, x2: 1320, y2: 710 },      // западное ущелье и ручей
            { x1: 1390, y1: 105, x2: 1740, y2: 192 },     // каньон: северный рукав
            { x1: 1390, y1: 412, x2: 1740, y2: 482 },     // каньон: центральный проход
            { x1: 1400, y1: 668, x2: 1740, y2: 742 },     // каньон: южное русло
            { x1: 1770, y1: 120, x2: 1930, y2: 710 },     // средняя перемычка
            { x1: 1960, y1: 95,  x2: 2370, y2: 162 },     // восточный северный коридор
            { x1: 1960, y1: 370, x2: 2380, y2: 440 },     // восточная узкая засада
            { x1: 1980, y1: 664, x2: 2390, y2: 740 },     // южная контрабандная тропа
            { x1: 2410, y1: 130, x2: width - 90, y2: 710 }, // восточный котёл у шпиля
            { x1: 54,  y1: 610, x2: 295, y2: 730 },       // южный двор-загон
            { x1: 365, y1: 700, x2: 920, y2: height - 34 } // южная полоса за домами
          ];
          for (let attempt = 0; attempt < 42; attempt++) {
            const z = zones[Math.floor(Math.random() * zones.length)];
            let x;
            let y;
            if (nearX !== undefined && nearY !== undefined) {
              x = G.MATH.clamp(nearX + G.MATH.rand(-140, 140), 70, width - 90);
              y = G.MATH.clamp(nearY + G.MATH.rand(-120, 120), 90, height - 90);
            } else {
              x = z.x1 + Math.random() * (z.x2 - z.x1);
              y = z.y1 + Math.random() * (z.y2 - z.y1);
            }
            const playersList = toPlayerList(player);
            let tooClose = false;
            for (let pi = 0; pi < playersList.length; pi++) {
              const pl = playersList[pi];
              if (!pl.dead && G.MATH.dist(x, y, pl.x, pl.y) < 230) {
                tooClose = true;
                break;
              }
            }
            if (tooClose) continue;
            if (!isFreeSpot(x, y, 18, solids)) continue;
            return { x: Math.round(x), y: Math.round(y) };
          }
          return { x: 640, y: 365 };
        },

        // Немедленное приведение числа живых бандитов к настроенному лимиту (из слайдера в HUD)
        enforceBotCap(player) {
          const cap = G.CFG.botMaxAlive !== undefined ? G.CFG.botMaxAlive : 5;
          const aliveList = [];
          for (let i = 0; i < world.targets.length; i++) {
            const t = world.targets[i];
            if (t.kind === 'bandit' && t.alive) aliveList.push(t);
          }
          if (aliveList.length > cap) {
            const pList = toPlayerList(player);
            if (pList.length > 0) {
              const minPlayerDist = (bx, by) => {
                let best = Infinity;
                for (let pi = 0; pi < pList.length; pi++) {
                  const pl = pList[pi];
                  if (pl.dead) continue;
                  const d = G.MATH.dist(bx, by, pl.x, pl.y);
                  if (d < best) best = d;
                }
                return isFinite(best) ? best : G.MATH.dist(bx, by, pList[0].x, pList[0].y);
              };
              aliveList.sort((a, b) => minPlayerDist(b.x, b.y) - minPlayerDist(a.x, a.y));
            }
            const toRemove = aliveList.length - cap;
            for (let i = 0; i < toRemove; i++) {
              const victim = aliveList[i];
              const idx = world.targets.indexOf(victim);
              if (idx !== -1) world.targets.splice(idx, 1);
            }
          }
        },

        getAliveBanditsCount() {
          let cnt = 0;
          for (let i = 0; i < world.targets.length; i++) {
            const bt = world.targets[i];
            if (bt.kind === 'bandit' && bt.alive) cnt++;
          }
          return cnt;
        },

        // Удалённая точка побега (у края ущелья или границы карты, дальше от игрока)
        pickFleePoint(bandit, player) {
          const anchors = [
            { x: 1080, y: 120 },
            { x: 1120, y: 720 },
            { x: 1620, y: 132 },
            { x: 1620, y: 705 },
            { x: 2220, y: 124 },
            { x: 2240, y: 706 },
            { x: 2795, y: 205 },
            { x: 2795, y: 580 },
            { x: 520,  y: 760 },
            { x: 68,   y: 710 }
          ];
          const refP = nearestPlayer(player, bandit.x, bandit.y);
          let best = { x: width - 95, y: height * 0.5 };
          let bestScore = Infinity;
          for (let i = 0; i < anchors.length; i++) {
            const a = anchors[i];
            if (!isFreeSpot(a.x, a.y, 16, solids)) continue;
            const dSelf = G.MATH.dist(bandit.x, bandit.y, a.x, a.y);
            const dPlayer = refP ? G.MATH.dist(refP.x, refP.y, a.x, a.y) : 400;
            if (dSelf < 45) continue;
            const score = dSelf - dPlayer * 0.55;
            if (score < bestScore) {
              bestScore = score;
              best = { x: a.x, y: a.y };
            }
          }
          return best;
        },

        // Спавн нового бандита (ручной/волновой/подкрепление)
        spawnBandit(player, opts, nearX, nearY) {
          const P = getPal();
          const kits = [
            { coatColor: P.cloth[3],     coatTrim: P.cloth[1],     hatColor: P.leather[4], bandana: P.barnRed[1], gunType: 'revolver', hp: 78 },
            { coatColor: P.slateTeal[3], coatTrim: P.slateTeal[2], hatColor: P.leather[3], bandana: P.barnRed[0], gunType: 'rifle',    hp: 82 },
            { coatColor: P.leather[3],   coatTrim: P.leather[1],   hatColor: P.leather[4], bandana: P.barnRed[2], gunType: 'revolver', hp: 80 },
            { coatColor: P.foliage[3],   coatTrim: P.foliage[2],   hatColor: P.leather[3], bandana: P.barnRed[1], gunType: 'rifle',    hp: 84 },
            { coatColor: P.barnRed[3],   coatTrim: P.barnRed[2],   hatColor: P.leather[4], bandana: P.brass[1],   gunType: 'revolver', hp: 80 },
            { coatColor: P.canyon[3],    coatTrim: P.canyon[2],    hatColor: P.leather[4], bandana: P.barnRed[1], gunType: 'rifle',    hp: 82 }
          ];
          const kit = opts || kits[Math.floor(Math.random() * kits.length)];
          const spot = world.pickSpawnPoint(player, nearX, nearY);
          const t = makeBandit(banditIdSeq++, spot.x, spot.y, kit);
          t.patrolWaypoints = buildPatrolWaypoints(spot.x, spot.y, solids);
          t.patrolPhase = Math.random() * Math.PI * 2;
          t.angle = Math.random() * Math.PI * 2;
          world.targets.push(t);
          return t;
        },

        // Вызов подмоги сбежавшим бандитом
        callReinforcements(player, nearX, nearY, count) {
          const spawned = [];
          const n = G.MATH.clamp(count || 1, 1, 2);
          for (let i = 0; i < n; i++) {
            const b = world.spawnBandit(player, {
              isReinforcement: true,
              coatColor: i % 2 === 0 ? getPal().barnRed[3] : getPal().cloth[3],
              coatTrim: i % 2 === 0 ? getPal().barnRed[1] : getPal().cloth[1],
              hatColor: getPal().leather[4],
              bandana: getPal().brass[0],
              gunType: i === 1 ? 'rifle' : 'revolver',
              hp: 78
            }, nearX, nearY);
            const targetP = nearestPlayer(player, b.x, b.y);
            if (targetP) {
              b.aiState = 'search';
              b.lastKnownX = targetP.x;
              b.lastKnownY = targetP.y;
              b.searchTimer = 11.0;
              b.searchRole = 'hunt';
              b.angle = Math.atan2(targetP.y - b.y, targetP.x - b.x);
            }
            spawned.push(b);
          }
          return spawned;
        },

        // Единоразовый ручной респавн стартовых бандитов
        respawnBanditsManual(player, state) {
          world.targets = world.targets.filter((t) => t.kind !== 'bandit');
          const candidates = getBanditRosterCandidates(STREET_SHIFT);
          const cap = G.CFG.botMaxAlive !== undefined ? G.CFG.botMaxAlive : 5;
          const want = cap > 0 ? Math.min(candidates.length, cap) : 5;
          for (let i = 0; i < want; i++) {
            const cand = candidates[i];
            const spot = isFreeSpot(cand.x, cand.y, 14, solids) ? { x: cand.x, y: cand.y } : world.pickSpawnPoint(player);
            const b = makeBandit(banditIdSeq++, spot.x, spot.y, cand.opts);
            b.patrolWaypoints = buildPatrolWaypoints(spot.x, spot.y, solids);
            world.targets.push(b);
          }
          world.spawnTimer = 0;
          if (state && state.saloonProps) {
            state.saloonProps.bourbonAvailable = true;
          }
        },

        // Спавн волны N с плавным ростом численности, доли винтовок и периодическим главарём
        spawnWave(waveNum, player, state) {
          const P = getPal();
          world.targets = world.targets.filter((t) => t.kind !== 'bandit');
          const count = Math.min(18, 3 + waveNum * 2);
          const hasBoss = waveNum >= 2 && (waveNum % 2 === 0 || waveNum >= 3);
          for (let i = 0; i < count; i++) {
            const isBoss = hasBoss && i === 0;
            const rifleChance = G.MATH.clamp(0.22 + waveNum * 0.08, 0.25, 0.65);
            const isRifle = isBoss || Math.random() < rifleChance;
            const kit = isBoss
              ? {
                  name: 'ГЛАВАРЬ',
                  coatColor: P.steelDark[4],
                  coatTrim: P.steelDark[2],
                  hatColor: P.outline,
                  hatBand: P.brass[0],
                  bandana: P.barnRed[0],
                  gunType: 'rifle',
                  tough: true,
                  hp: 105 + waveNum * 12
                }
              : {
                  coatColor: isRifle ? P.slateTeal[3] : P.cloth[3],
                  coatTrim: isRifle ? P.slateTeal[2] : P.cloth[1],
                  hatColor: P.leather[4],
                  bandana: isRifle ? P.barnRed[0] : P.barnRed[1],
                  gunType: isRifle ? 'rifle' : 'revolver',
                  hp: 76 + Math.min(24, (waveNum - 1) * 4)
                };
            const b = world.spawnBandit(player, kit);
            const targetP = nearestPlayer(player, b.x, b.y);
            if (waveNum >= 2 && targetP) {
              b.aiState = 'search';
              b.lastKnownX = targetP.x;
              b.lastKnownY = targetP.y;
              b.searchTimer = 10.0;
              b.searchRole = isRifle && i % 2 === 0 ? 'hold' : 'hunt';
            }
          }
          world.spawnTimer = 0;
          if (state && state.saloonProps) {
            state.saloonProps.bourbonAvailable = true;
          }
        },

        getZoneAt(x, y) {
          if (x < SALOON.x + SALOON.w && y > SALOON.y && y < SALOON.y + SALOON.h) {
            return { id: 'saloon', label: 'САЛУН' };
          }
          if (x >= 960) {
            if (x >= 1950) return { id: 'canyon', label: 'ВОСТОЧНЫЙ КАНЬОН' };
            return { id: 'canyon', label: y > 520 ? 'ЮЖНЫЙ КАНЬОН' : 'УЩЕЛЬЕ КАНЬОНА' };
          }
          if (y > 560) {
            return { id: 'yard', label: 'ДВОР И ЗАГОН' };
          }
          return { id: 'alley', label: 'ГЛАВНАЯ УЛИЦА' };
        },

        getSurfaceAt(x, y) {
          if (x < SALOON.x + SALOON.w + 4 && y > SALOON.y + 2 && y < SALOON.y + 378) return 'wood';
          if (x >= 340 && x <= 845 && ((y >= STREET_TOP && y <= STREET_TOP + 22) || (y >= STREET_BOT && y <= STREET_BOT + 22))) {
            return 'wood';
          }
          // Мостик и ручей в каньоне (координаты согласованы с bakeBackground)
          if (x >= 1234 && x <= 1278 && y >= 335 && y <= 395) return 'wood';
          const creekX = 1275 + Math.sin(y * 0.012) * 26 + Math.cos(y * 0.032) * 10;
          if (x > 940 && Math.abs(x - creekX) <= 14 && (y < 335 || y > 395)) return 'water';
          return 'dirt';
        },

        updateDoors(dt, playerOrList) {
          const playersList = toPlayerList(playerOrList);
          for (let i = 0; i < doors.length; i++) {
            const d = doors[i];
            const midX = d.hingeX + Math.cos(d.baseAngle + d.angle) * (d.len * 0.55);
            const midY = d.hingeY + Math.sin(d.baseAngle + d.angle) * (d.len * 0.55);
            for (let pi = 0; pi < playersList.length; pi++) {
              const pl = playersList[pi];
              if (!pl || pl.dead) continue;
              const dist = G.MATH.dist(pl.x, pl.y, midX, midY);
              if (dist < 22) {
                const pushDir = pl.vx >= 0 ? (i === 0 ? -1 : 1) : (i === 0 ? 1 : -1);
                d.vel += pushDir * 16 * dt * 6;
              }
            }
            const springAcc = -d.angle * 36 - d.vel * 5.2;
            d.vel += springAcc * dt;
            d.angle = G.MATH.clamp(d.angle + d.vel * dt, -1.35, 1.35);
          }
        },

        updateTargets(dt, player, state) {
          world.updateWaterBarrelsAndPuddles(dt);
          for (let i = 0; i < world.targets.length; i++) {
            const t = world.targets[i];
            if (t.hitFlash > 0) t.hitFlash = Math.max(0, t.hitFlash - dt);
            if (t.wobble > 0) t.wobble = Math.max(0, t.wobble - dt * 3.5);

            if (t.kind === 'bandit') {
              if (t.hurtTimer > 0) t.hurtTimer = Math.max(0, t.hurtTimer - dt);

              if (Math.hypot(t.knockVx, t.knockVy) > 1) {
                t.x += t.knockVx * dt;
                t.y += t.knockVy * dt;
                const damp = Math.exp(-10 * dt);
                t.knockVx *= damp;
                t.knockVy *= damp;
                for (let j = 0; j < world.solids.length; j++) {
                  const res = G.MATH.circleRectPush(t.x, t.y, t.r, world.solids[j]);
                  if (res.hit) {
                    t.x = res.x;
                    t.y = res.y;
                  }
                }
              }

              if (t.alive) {
                t.patrolPhase += dt;
                if (t.dodgeCooldown > 0) t.dodgeCooldown = Math.max(0, t.dodgeCooldown - dt);

                const prevX = t.x;
                const prevY = t.y;

                if (t.isDodging) {
                  t.dodgeTimer -= dt;
                  t.x += t.dodgeDx * dt;
                  t.y += t.dodgeDy * dt;
                  if (t.dodgeTimer <= 0) {
                    t.isDodging = false;
                  }
                } else if (t.aiState === 'flee') {
                  t.inCover = false;
                  t.peeking = false;
                  t.fleeTimer = (t.fleeTimer || 0) - dt;
                  if (!t.fleeTarget) {
                    t.fleeTarget = world.pickFleePoint(t, player);
                  }
                  const fdx = t.fleeTarget.x - t.x;
                  const fdy = t.fleeTarget.y - t.y;
                  const fdist = Math.hypot(fdx, fdy);
                  if (fdist > 8) {
                    const fspd = 78;
                    t.x += (fdx / fdist) * fspd * dt;
                    t.y += (fdy / fdist) * fspd * dt;
                    const wantAngle = Math.atan2(fdy, fdx);
                    t.angle = G.MATH.normAngle(t.angle + G.MATH.angleDiff(t.angle, wantAngle) * Math.min(1, dt * 8.0));
                  }
                  if ((fdist <= 26 || t.fleeTimer <= 0) && !t.calledBackup) {
                    t.calledBackup = true;
                    const backupCount = Math.random() < 0.45 ? 2 : 1;
                    world.callReinforcements(player, t.x, t.y, backupCount);
                    if (G.AUDIO && G.AUDIO.playBanditHelp) G.AUDIO.playBanditHelp();
                    if (state) {
                      if (state.toast) {
                        state.toast.text = 'БЕГЛЕЦ ВЫЗВАЛ ПОДМОГУ!';
                        state.toast.timer = 1.6;
                      }
                      if (state.floatTexts) {
                        state.floatTexts.push({
                          x: t.x, y: t.y - 16,
                          text: `+${backupCount} ПОДМОГА!`,
                          color: G.PAL.barnRed[0],
                          life: 1.5, maxLife: 1.5, big: true
                        });
                      }
                    }
                    // Вызвав подмогу, сам бандит возвращается к поиску ближайшего игрока
                    const targetP = nearestPlayer(player, t.x, t.y);
                    t.aiState = 'search';
                    t.lastKnownX = targetP ? targetP.x : t.x;
                    t.lastKnownY = targetP ? targetP.y : t.y;
                    t.searchTimer = 9.0;
                    t.searchRole = 'hunt';
                  }
                } else if (t.aiState === 'patrol') {
                  t.inCover = false;
                  t.peeking = false;
                  const wps = t.patrolWaypoints;
                  if (wps && wps.length > 0) {
                    if (t.patrolWaitTimer > 0) {
                      t.patrolWaitTimer -= dt;
                      // Осматривается на точке маршрута
                      t.angle = G.MATH.normAngle(t.angle + Math.sin(t.patrolPhase * 1.3) * 0.45 * dt);
                    } else {
                      const wp = wps[t.patrolIdx % wps.length];
                      const wdx = wp.x - t.x;
                      const wdy = wp.y - t.y;
                      const wdist = Math.hypot(wdx, wdy);
                      if (wdist > 8) {
                        const spd = 34 * (t.patrolSpeed || 1.0);
                        t.x += (wdx / wdist) * spd * dt;
                        t.y += (wdy / wdist) * spd * dt;
                        const wantAngle = Math.atan2(wdy, wdx);
                        t.angle = G.MATH.normAngle(t.angle + G.MATH.angleDiff(t.angle, wantAngle) * Math.min(1, dt * 4.5));
                      } else {
                        t.patrolWaitTimer = 1.4 + Math.random() * 1.6;
                        t.patrolIdx = (t.patrolIdx + 1) % wps.length;
                      }
                    }
                  }
                } else if (t.aiState === 'alert') {
                  t.inCover = false;
                  t.peeking = false;
                  t.alertTimer -= dt;
                  t.angle = G.MATH.normAngle(t.angle + G.MATH.angleDiff(t.angle, t.alertAngle) * Math.min(1, dt * 5.2));
                  if (t.alertTimer <= 0) {
                    t.aiState = 'patrol';
                  }
                } else if (t.aiState === 'search') {
                  t.inCover = false;
                  t.peeking = false;
                  t.searchTimer -= dt;
                  if (t.lastKnownX !== null && t.lastKnownY !== null) {
                    const ldx = t.lastKnownX - t.x;
                    const ldy = t.lastKnownY - t.y;
                    const ldist = Math.hypot(ldx, ldy);
                    const wantAngle = Math.atan2(ldy, ldx);
                    if (t.searchRole === 'hunt' && ldist > 22) {
                      // Револьверщики осторожно выдвигаются проверить последний контакт
                      const spd = 40;
                      t.x += (ldx / ldist) * spd * dt;
                      t.y += (ldy / ldist) * spd * dt;
                      t.angle = G.MATH.normAngle(t.angle + G.MATH.angleDiff(t.angle, wantAngle) * Math.min(1, dt * 5.0));
                    } else {
                      // Стрелки с винтовками или уже дошедшие держат угол на прицеле
                      t.angle = G.MATH.normAngle(t.angle + G.MATH.angleDiff(t.angle, wantAngle) * Math.min(1, dt * 5.5));
                    }
                  }
                  if (t.searchTimer <= 0) {
                    t.aiState = 'alert';
                    t.alertTimer = 1.6;
                    t.alertAngle = t.angle;
                    t.lastKnownX = null;
                    t.lastKnownY = null;
                  }
                }

                // Выталкивание из твёрдых препятствий и границ карты
                t.x = G.MATH.clamp(t.x, 34, world.width - 34);
                t.y = G.MATH.clamp(t.y, 24, world.height - 24);
                let bumpedWall = false;
                for (let j = 0; j < world.solids.length; j++) {
                  const res = G.MATH.circleRectPush(t.x, t.y, t.r, world.solids[j]);
                  if (res.hit) {
                    t.x = res.x;
                    t.y = res.y;
                    bumpedWall = true;
                  }
                }
                if (bumpedWall && t.aiState === 'patrol' && t.patrolWaypoints && t.patrolWaypoints.length > 0) {
                  t.patrolIdx = (t.patrolIdx + 1) % t.patrolWaypoints.length;
                }

                const stepSpeed = Math.hypot(t.x - prevX, t.y - prevY) / Math.max(0.001, dt);
                if (stepSpeed > 4 && !t.inCover && !t.isDodging) {
                  t.walkPhase += dt * (2.2 + stepSpeed * 0.14);
                }

                // Ствол бота поднимается ТОЛЬКО у ВЫСОКИХ преград (high: true) или в приседе за низким укрытием!
                let nearHighWall = false;
                for (let ci = 0; ci < world.solids.length; ci++) {
                  const s = world.solids[ci];
                  if (!s.high) continue;
                  if (G.MATH.circleRectPush(t.x, t.y, t.r + 9, s).hit) {
                    nearHighWall = true;
                    break;
                  }
                }
                const wantCrouch = (t.inCover && !t.peeking) ? 1.0 : 0.0;
                t.crouchFrac = G.MATH.lerp(t.crouchFrac || 0, wantCrouch, Math.min(1, dt * 11));
                const wantRaise = (t.inCover && !t.peeking) ? 1.0 : (nearHighWall ? 1.0 : 0.0);
                t.wallRaiseFrac = G.MATH.lerp(t.wallRaiseFrac || 0, wantRaise, Math.min(1, dt * 10));
              } else {
                t.deathAnim = Math.min(1, t.deathAnim + dt * 3.4);
                t.bloodPool = Math.min(1, t.bloodPool + dt * 0.65);
              }
              continue;
            }

            if (!t.alive && t.respawnTimer > 0) {
              t.respawnTimer -= dt;
              if (t.respawnTimer <= 0) {
                t.alive = true;
                t.hp = t.maxHp;
                t.wobble = 0.6;
              }
            }
          }
          world.spawnTimer = 0;
        },

        resetTargets() {
          world.targets = createInitialTargets(width, height, solids);
          world.spawnTimer = 0;
        }
      };

      return world;
    }
  };
})();
