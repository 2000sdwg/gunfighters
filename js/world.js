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
      type: rect.type || 'wall'
    };
    return [
      { ...base, x1: x1, y1: y1, x2: x2, y2: y1 },
      { ...base, x1: x2, y1: y1, x2: x2, y2: y2 },
      { ...base, x1: x2, y1: y2, x2: x1, y2: y2 },
      { ...base, x1: x1, y1: y2, x2: x1, y2: y1 }
    ];
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

  // ==================== ЗАПЕЧЁННЫЙ 1PX ФОН КАРТЫ ====================

  function bakeBackground(width, height) {
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

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx4 = (y * width + x) * 4;

        // Внутри салуна — оставим базовый тёмный цвет, поверх нарисуем доски
        if (x < 336 && y > 72 && y < 448) {
          data[idx4] = 56; data[idx4 + 1] = 38; data[idx4 + 2] = 24; data[idx4 + 3] = 255;
          continue;
        }

        // Многослойный шум для органичных пятен пыли, гравия и выжженной травы
        const nBig = smoothNoise(x, y, 42);
        const nMed = smoothNoise(x * 0.65, y * 1.45, 16); // вытянутые горизонтальные мазки референсов
        const nFine = hash2(x, y);

        // Колеи от повозок, плавно извивающиеся от салуна вглубь каньона
        const roadCenterY = 256 + Math.sin(x * 0.0085) * 14 + Math.cos(x * 0.021) * 4;
        const dFromCenter = Math.abs(y - roadCenterY);
        const rut1 = Math.abs(y - (roadCenterY - 21));
        const rut2 = Math.abs(y - (roadCenterY + 21));
        const rutDepth = Math.max(
          Math.max(0, 1 - rut1 / 6.5),
          Math.max(0, 1 - rut2 / 6.5)
        );
        // Светлый пыльный гребень между колеями
        const ridge = Math.max(0, 1 - Math.abs(dFromCenter - 11) / 8);

        // Граница перехода из городка в каньон (x ~ 825..955 с рваной линией)
        const canyonEdge = 845 + (nBig - 0.5) * 95 + (nMed - 0.5) * 35;
        const canyonBlend = G.MATH.clamp((x - canyonEdge) / 85, 0, 1);

        let rgb;
        const b = bayerAt(x, y);

        if (canyonBlend > b) {
          // Каньон: слоистая терракота с вкраплениями серого сланца и тенями колей
          let tone = 0.36 + (nBig - 0.5) * 0.45 + (nMed - 0.5) * 0.32 + (nFine - 0.5) * 0.14;
          tone += rutDepth * 0.28 - ridge * 0.10;
          // Ближе к скалам — темнее порода
          if (y < 125 || y > 395) tone += 0.22;
          const useStone = nBig > 0.72 && nMed > 0.54;
          const arr = useStone ? stoneRgb : canyonRgb;
          const scaled = G.MATH.clamp(tone, 0, 0.999) * (arr.length - 1);
          const ci = Math.floor(scaled);
          rgb = arr[(scaled - ci) > b ? Math.min(arr.length - 1, ci + 1) : ci];
        } else {
          // Пыльная улочка городка: выбеленный песок по центру, золотистая травяная подложка по обочинам
          let verge = G.MATH.clamp((dFromCenter - 68) / 56 + (nBig - 0.5) * 0.45, 0, 1);

          // Южное расширение карты: утоптанный двор-загон и грунтовая колея на юг
          if (y > 452) {
            const southRoadX = 1000 + Math.sin(y * 0.011) * 26;
            const dSouth = Math.abs(x - southRoadX);
            verge = G.MATH.clamp((dSouth - 86) / 78 + (nBig - 0.5) * 0.42, 0, 1);
            // Внутри загона земля вытоптана копытами — почти без травяной подложки
            if (x > 355 && x < 830 && y > 520 && y < 700) {
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
      { x: 340, y: 102, w: 482, h: 22, north: true },
      { x: 340, y: 392, w: 484, h: 22, north: false }
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

    // 3. Неровные деревенские заборы на выходе из городка к каньону (референс 3)
    drawSplitFence(ctx, 822, 112, 886, rng, P);
    drawSplitFence(ctx, 824, 404, 892, rng, P);

    // 4. Каменные россыпи и осыпи у подножия скал и по обочинам
    for (let i = 0; i < 210; i++) {
      const rx = 352 + rng() * (width - 400);
      const inCanyon = rx > 855;
      const ry = inCanyon
        ? (rng() < 0.72 ? (rng() < 0.5 ? 92 + rng() * 58 : 362 + rng() * 64) : 150 + rng() * (height - 250))
        : (rng() < 0.5 ? 124 + rng() * 44 : 344 + rng() * 46);
      drawPebbleCluster(ctx, rx, ry, rng, P, rng() < (inCanyon ? 0.45 : 0.22));
    }

    // Камни и щебень в южном дворе
    for (let i = 0; i < 70; i++) {
      const rx = 356 + rng() * (width - 420);
      const ry = 520 + rng() * (height - 590);
      drawPebbleCluster(ctx, rx, ry, rng, P, rng() < 0.3);
    }

    // 5. Пышные заросли золотистой степной травы и полыни (1px пучки вдоль обочин!)
    for (let i = 0; i < 640; i++) {
      const gx = 348 + rng() * (width - 400);
      let gy;
      if (rng() < 0.34) {
        // Южное расширение: сухая степь за загоном
        gy = 505 + rng() * (height - 575);
        if (gx > 355 && gx < 830 && gy > 520 && gy < 700) continue; // вытоптанный загон оставляем чистым
      } else {
        const roadY = 256 + Math.sin(gx * 0.0085) * 14;
        const side = rng() < 0.5 ? -1 : 1;
        const distOut = 64 + Math.pow(rng(), 0.75) * 96;
        gy = G.MATH.clamp(roadY + side * distOut, 86, 434);
        // Не залезаем на деревянные настилы
        if (gx < 824 && (gy < 126 || gy > 390)) continue;
      }
      if (rng() < 0.16) {
        drawSageBush(ctx, gx, gy, rng, P);
      } else {
        drawTallGrassTuft(ctx, gx, gy, rng, P);
      }
    }

    // Декоративные жерди-заборчики в южном дворе (в дополнение к укрытиям-секциям)
    drawSplitFence(ctx, 900, 548, 1090, rng, P);
    drawSplitFence(ctx, 1310, 604, 1470, rng, P);

    // Колесо от повозки у крыльца салуна (референс 1)
    drawWagonWheelProp(ctx, 350, 174, P);

    // 6. Пол салуна (детальные состаренные доски с текстурой волокон, щелями и гвоздями)
    const sx = 32, sy = 78, sw = 300, sh = 364;
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
      const pathY = 255 * (1 - t) + 148 * t + Math.sin(t * Math.PI) * -14 + (rng() - 0.5) * 6;
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
      const by = 138 + Math.floor(rng() * 16);
      if (rng() < 0.65) {
        ctx.fillStyle = rng() < 0.5 ? P.woodPale[2] : P.woodPale[1];
        ctx.fillRect(bx, by, 1 + (rng() < 0.4 ? 1 : 0), 1);
      }
    }

    // Занесённая сапогами пыль и песок у входа
    for (let i = 0; i < 320; i++) {
      const dx = 246 + Math.floor(rng() * 84);
      const dy = 200 + Math.floor(rng() * 110);
      const d = Math.hypot((dx - 324) * 0.75, dy - 255);
      if (d < 82 && rng() < 1 - d / 88) {
        ctx.fillStyle = rng() < 0.55 ? P.dirt[0] : P.dirt[1];
        ctx.fillRect(dx, dy, 1 + (rng() < 0.5 ? 1 : 0), 1);
      }
    }

    // Тёмные пятна пролитых напитков (виски, эль) у бара и столов
    const spillCenters = [
      { x: 104, y: 144, r: 6 },
      { x: 148, y: 142, r: 8 },
      { x: 196, y: 145, r: 5 },
      { x: 114, y: 324, r: 7 }, // у стола 1
      { x: 134, y: 378, r: 5 },
      { x: 236, y: 326, r: 8 }, // у стола 2
      { x: 212, y: 382, r: 6 },
      { x: 168, y: 284, r: 4 }
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
      { x: 92, y: 330, w: 46, h: 46 },
      { x: 218, y: 334, w: 46, h: 46 },
      { x: 256, y: 170, w: 18, h: 18 }
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
    const rx = 242, ry = 222, rw = 66, rh = 66;
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
    ctx.fillRect(336, 208, 22, 98);
    for (let y = 206; y < 304; y += 5) {
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

    // 2. Видимый 2.5D-фасад со стороны улицы (горизонтальные доски обшивки + окна с рамами + дверь)
    const facadeH = isNorth ? 26 : 12;
    const facadeY = isNorth ? oy + s.h - facadeH : oy + 1;

    ctx.fillStyle = wallPal[2];
    ctx.fillRect(ox + 1, facadeY, s.w - 2, facadeH);

    // Горизонтальная вагонка фасада (как на красном, бирюзовом и сером домах с референсов 1–3)
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

    // Окна и проёмы на северных фасадах (на них смотрит камера в 3/4-проекции!)
    if (isNorth) {
      const winCount = Math.max(3, Math.floor((s.w - 30) / 44));
      const step = Math.floor((s.w - 24) / winCount);
      for (let i = 0; i < winCount; i++) {
        const wx = ox + 18 + i * step;
        const wy = facadeY + 5;
        const isDoor = i === Math.floor(winCount / 2);

        if (isDoor) {
          // Входная дверь под козырьком
          ctx.fillStyle = '#140f0c';
          ctx.fillRect(wx - 1, wy - 2, 14, facadeH - 4);
          ctx.fillStyle = wallPal[0];
          ctx.fillRect(wx - 1, wy - 2, 14, 1);
          ctx.fillRect(wx - 1, wy - 1, 1, facadeH - 5);
          ctx.fillRect(wx + 12, wy - 1, 1, facadeH - 5);
          ctx.fillStyle = '#36261a';
          ctx.fillRect(wx + 1, wy, 10, facadeH - 7);
          // Латунная ручка
          ctx.fillStyle = P.brass[1];
          ctx.fillRect(wx + 8, wy + 8, 2, 2);
          // Фрамуга над дверью
          ctx.fillStyle = '#17262b';
          ctx.fillRect(wx + 1, wy - 1, 10, 2);
        } else {
          // Многосекционное окно с белой/выгоревшей рамой и тёмным стеклом (референсы 1–3)
          ctx.fillStyle = P.woodPale[0];
          ctx.fillRect(wx - 1, wy - 2, 12, 15);
          ctx.fillStyle = '#141c22';
          ctx.fillRect(wx, wy - 1, 10, 13);
          // Холодный отблеск неба в верхних стеклах
          ctx.fillStyle = P.glass[1];
          ctx.fillRect(wx + 1, wy, 3, 4);
          ctx.fillRect(wx + 6, wy, 3, 4);
          // Переплёт рамы и подоконник
          ctx.fillStyle = P.woodPale[1];
          ctx.fillRect(wx + 4, wy - 1, 2, 13);
          ctx.fillRect(wx, wy + 5, 10, 1);
          ctx.fillStyle = '#1b140f';
          ctx.fillRect(wx - 2, wy + 12, 14, 2);
        }
      }

      // Навес крыльца/веранды, чуть выступающий вниз со столбами (как на референсе 1)
      const porchY = oy + s.h - 2;
      ctx.fillStyle = '#140f0c';
      ctx.fillRect(ox + 2, porchY, s.w - 4, 7);
      for (let x = ox + 3; x < ox + s.w - 3; x += 3) {
        ctx.fillStyle = rng() < 0.5 ? P.woodPale[2] : P.woodPale[3];
        ctx.fillRect(x, porchY + 1, 2, 5);
      }
      ctx.fillStyle = P.woodPale[0];
      ctx.fillRect(ox + 3, porchY + 1, s.w - 6, 1);

      // Опорные столбы веранды
      for (let postX = ox + 14; postX < ox + s.w - 12; postX += 38) {
        ctx.fillStyle = '#140f0c';
        ctx.fillRect(postX - 1, porchY + 4, 3, 4);
        ctx.fillStyle = P.woodPale[2];
        ctx.fillRect(postX, porchY + 4, 2, 3);
        ctx.fillStyle = P.woodPale[0];
        ctx.fillRect(postX, porchY + 4, 1, 3);
      }
    }

    // 3. Детализированная крыша (серая дранка, выгоревшие пятна, конёк и свесы)
    const rx = ox + 2;
    const ry = isNorth ? oy + 2 : oy + facadeH + 1;
    const rw = s.w - 4;
    const rh = s.h - facadeH - 3;
    const ridgeY = ry + Math.floor(rh * 0.46);

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
      for (let lx = signX + 6; lx < signX + signW - 6; lx += 4) {
        ctx.fillRect(lx, py + 1, 2, 2);
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

  // Слоистая 2.5D-скала каньона (плато сверху + крутой слоистый каменный обрыв + трещины)
  function bakeCliffSprite(s, P) {
    const c = document.createElement('canvas');
    c.width = s.w;
    c.height = s.h;
    const ctx = c.getContext('2d');
    const isNorth = s.y < 150;
    const isEast = !!s.edgeEast;

    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        // Рваный пиксельный край скалы
        const edgeNoise = smoothNoise(x + s.x, y + s.y, 11);
        const distTop = y;
        const distBot = s.h - 1 - y;
        const distLeft = x;
        const distRight = s.w - 1 - x;

        const cutMargin = edgeNoise * 7;
        if (isNorth && distBot < cutMargin) continue;
        if (!isNorth && !isEast && distTop < cutMargin) continue;
        if (isEast && distLeft < cutMargin) continue;

        const n1 = smoothNoise(x + s.x, (y + s.y) * 1.8, 18);
        const n2 = hash2(x + s.x, y + s.y);
        const b = bayerAt(x, y);

        // Вертикальная стена обрыва на южном краю северных скал (2.5D объём!)
        const onCliffFace = (isNorth && distBot < 22 + edgeNoise * 10) || (isEast && distLeft < 18 + edgeNoise * 6);
        let arr = P.canyon;
        let t;

        if (onCliffFace) {
          // Горизонтальные осадочные слои (страты) на вертикальной стене обрыва
          const strata = Math.sin((y + s.y) * 0.52 + n1 * 3.0);
          t = 0.56 + strata * 0.24 + (n2 - 0.5) * 0.14;
          if (strata > 0.55) arr = P.stone; // прожилки серого камня
          if (distBot < cutMargin + 2) t = 0.96; // тёмный контур подножия
        } else {
          // Верхнее солнечное плато скалы с каменными уступами
          t = 0.20 + (n1 - 0.5) * 0.55 + (n2 - 0.5) * 0.12;
          if (isNorth && distBot < 26 + edgeNoise * 10) t = 0.05; // светлая бровка обрыва
          if (!isNorth && !isEast && distTop < cutMargin + 3) t = 0.08;
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
      sightDist: 440,
      shootRange: 380,
      telegraphTime: 0.55,
      wallRaiseFrac: 0
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

    // Бутылки на полке салуна
    [84, 108, 134, 160, 186, 212].forEach((bx) => addTarget(bx, 96, 'bottle', 5, 1, 'glass'));
    // За барной стойкой — плотный ряд бутылок (интерактивный декор)
    [76, 98, 120, 142, 164, 186, 208, 228].forEach((bx) => addTarget(bx, 106, 'bottle', 5, 1, 'glass'));
    // На столешнице стойки
    [98, 152, 204].forEach((bx) => addTarget(bx, 124, 'bottle', 5, 1, 'glass'));
    // За столиками (на столешницах sal_tbl1 / sal_tbl2)
    addTarget(101, 341, 'bottle', 5, 1, 'glass');
    addTarget(126, 354, 'bottle', 5, 1, 'glass');
    addTarget(112, 367, 'bottle', 5, 1, 'glass');
    addTarget(227, 343, 'bottle', 5, 1, 'glass');
    addTarget(252, 357, 'bottle', 5, 1, 'glass');
    addTarget(236, 371, 'bottle', 5, 1, 'glass');

    // Узкая улочка: 3 бандита + бутылка + стальные попперы
    addBandit(508, 156, {
      coatColor: '#232830', // тёмно-угольный плащ (референс 1)
      coatTrim: '#3b424d',
      hatColor: '#1a1512',
      bandana: '#8c2d23',
      gunType: 'revolver',
      hp: 78,
      patrolAmp: 14,
      patrolSpeed: 1.05,
      patrolPhase: 0.4
    });
    addTarget(565, 250, 'bottle', 5, 1, 'glass');
    addTarget(615, 298, 'steel', 10, 999, 'metal');
    addBandit(714, 224, {
      coatColor: '#22334a', // глубокий синий кафтан (референс 2)
      coatTrim: '#395273',
      hatColor: '#2b1e16',
      bandana: '#96382b',
      gunType: 'rifle',
      hp: 82,
      patrolAmp: 18,
      patrolSpeed: 0.9,
      patrolPhase: 1.9
    });
    addBandit(696, 340, {
      coatColor: '#473424', // шоколадно-коричневый плащ (референс 3)
      coatTrim: '#664d37',
      hatColor: '#241b14',
      bandana: '#78251d',
      gunType: 'revolver',
      hp: 80,
      patrolAmp: 15,
      patrolSpeed: 1.2,
      patrolPhase: 3.1
    });
    addTarget(788, 344, 'steel', 10, 999, 'metal');

    // Ущелье каньона: 2 стрелка + крепкий главарь в чёрном плаще
    addTarget(974, 232, 'bottle', 5, 1, 'glass');
    addBandit(1024, 240, {
      coatColor: '#363d33', // пыльно-оливковый плащ
      coatTrim: '#4f594b',
      hatColor: '#211914',
      bandana: '#8a2b22',
      gunType: 'rifle',
      hp: 84,
      patrolAmp: 22,
      patrolSpeed: 0.95,
      patrolPhase: 0.9
    });
    addTarget(1042, 178, 'steel', 11, 999, 'metal');
    addBandit(1176, 274, {
      coatColor: '#522620', // выцветший бордовый плащ
      coatTrim: '#733830',
      hatColor: '#1a1512',
      bandana: '#c49d56',
      gunType: 'revolver',
      hp: 85,
      patrolAmp: 24,
      patrolSpeed: 1.15,
      patrolPhase: 2.5
    });
    addTarget(1232, 164, 'steel', 11, 999, 'metal');
    addBandit(1332, 294, {
      name: 'ГЛАВАРЬ',
      coatColor: '#1c1b1a', // тяжёлый чёрный дастер
      coatTrim: '#3b3733',
      hatColor: '#120f0d',
      hatBand: '#c49d56',
      bandana: '#9e261b',
      gunType: 'rifle',
      tough: true,
      hp: 115,
      patrolAmp: 24,
      patrolSpeed: 1.0,
      patrolPhase: 4.2
    });
    addTarget(1348, 210, 'steel', 12, 999, 'metal');

    // --- ВОСТОЧНЫЙ КАНЬОН (расширение карты по X) ---
    addTarget(1584, 162, 'bottle', 5, 1, 'glass');
    addTarget(1500, 350, 'steel', 11, 999, 'metal');
    addBandit(1520, 300, {
      coatColor: '#2f3a2c', // выгоревший оливковый плащ
      coatTrim: '#46553f',
      hatColor: '#1d1712',
      bandana: '#8a2b22',
      gunType: 'rifle',
      hp: 84,
      patrolAmp: 20,
      patrolSpeed: 1.0,
      patrolPhase: 1.4
    });
    addBandit(1700, 470, {
      coatColor: '#332a3b', // пыльно-сливовый плащ
      coatTrim: '#4a3f55',
      hatColor: '#191410',
      bandana: '#b0752f',
      gunType: 'revolver',
      hp: 80,
      patrolAmp: 18,
      patrolSpeed: 1.15,
      patrolPhase: 3.7
    });

    // --- ЮЖНЫЙ ДВОР / ЗАГОН (расширение карты по Y) ---
    addTarget(608, 552, 'bottle', 5, 1, 'glass');
    addTarget(1288, 584, 'bottle', 5, 1, 'glass');
    addTarget(700, 660, 'steel', 10, 999, 'metal');
    addTarget(1200, 700, 'steel', 11, 999, 'metal');
    addTarget(1700, 560, 'steel', 11, 999, 'metal');
    addBandit(520, 640, {
      coatColor: '#3a2a20',
      coatTrim: '#5a412f',
      hatColor: '#221912',
      bandana: '#8c2d23',
      gunType: 'revolver',
      hp: 78,
      patrolAmp: 16,
      patrolSpeed: 1.05,
      patrolPhase: 0.6
    });
    addBandit(980, 660, {
      coatColor: '#21262e',
      coatTrim: '#39404a',
      hatColor: '#191411',
      bandana: '#a8352a',
      gunType: 'rifle',
      hp: 82,
      patrolAmp: 22,
      patrolSpeed: 0.95,
      patrolPhase: 2.2
    });

    // Рандомный разброс стартовых точек: боты не стоят на жёстко зашитых координатах,
    // но остаются в своей зоне и не появляются внутри препятствий.
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (t.kind !== 'bandit') continue;
      for (let attempt = 0; attempt < 12; attempt++) {
        const nx = G.MATH.clamp(t.homeX + G.MATH.rand(-70, 70), 70, width - 90);
        const ny = G.MATH.clamp(t.homeY + G.MATH.rand(-60, 60), 100, height - 110);
        if (!isFreeSpot(nx, ny, t.r + 8, solids)) continue;
        t.x = Math.round(nx);
        t.y = Math.round(ny);
        t.homeX = t.x;
        t.homeY = t.y;
        break;
      }
    }

    return list;
  }

  G.WORLD = {
    create() {
      // Расширенная карта: восток (каньон) + юг (двор-загон)
      const width = 1920;
      const height = 760;

      const solids = [
        // --- САЛУН ---
        { id: 'sal_left',   x: 24,  y: 70,  w: 16,  h: 380, mat: 'wood', type: 'wall', high: true, isCover: true },
        { id: 'sal_top',    x: 24,  y: 70,  w: 316, h: 16,  mat: 'wood', type: 'wall', high: true, isCover: true },
        { id: 'sal_bot',    x: 24,  y: 434, w: 316, h: 16,  mat: 'wood', type: 'wall', high: true, isCover: true },
        { id: 'sal_right1', x: 324, y: 70,  w: 16,  h: 146, mat: 'wood', type: 'wall', high: true, isCover: true },
        { id: 'sal_right2', x: 324, y: 294, w: 16,  h: 156, mat: 'wood', type: 'wall', high: true, isCover: true },

        // Внутри салуна
        { id: 'sal_bar',    x: 68,  y: 112, w: 164, h: 24,  mat: 'wood', type: 'counter', high: false, isCover: true },
        { id: 'sal_tbl1',   x: 92,  y: 330, w: 46,  h: 46,  mat: 'wood', type: 'table',   high: false, isCover: true },
        { id: 'sal_tbl2',   x: 218, y: 334, w: 46,  h: 46,  mat: 'wood', type: 'table',   high: false, isCover: true },
        { id: 'sal_pillar', x: 256, y: 170, w: 18,  h: 18,  mat: 'wood', type: 'pillar',  high: true,  isCover: true },

        // --- УЗКАЯ УЛОЧКА (амбарно-бордовый, сланцево-бирюзовый и выгоревший серый дома с референсов) ---
        {
          id: 'bld_n1', x: 340, y: 10, w: 232, h: 92, mat: 'wood', type: 'building', high: true, isCover: true,
          roof: '#55524c', wallTrim: '#862a20', roofPalKey: 'shingle', wallPalKey: 'barnRed', roofStyle: 'shingle', chimney: true
        },
        {
          id: 'bld_n2', x: 580, y: 10, w: 242, h: 92, mat: 'wood', type: 'building', high: true, isCover: true,
          roof: '#4d7075', wallTrim: '#4d7075', roofPalKey: 'slateTeal', wallPalKey: 'slateTeal', roofStyle: 'planks', chimney: false
        },
        {
          id: 'bld_s1', x: 340, y: 414, w: 224, h: 86, mat: 'wood', type: 'building', high: true, isCover: true,
          roof: '#706c64', wallTrim: '#968770', roofPalKey: 'shingle', wallPalKey: 'woodPale', roofStyle: 'patchy', chimney: true
        },
        {
          id: 'bld_s2', x: 574, y: 414, w: 248, h: 86, mat: 'wood', type: 'building', high: true, isCover: true,
          roof: '#55524c', wallTrim: '#756652', roofPalKey: 'shingle', wallPalKey: 'woodPale', roofStyle: 'shingle', chimney: false
        },

        // Укрытия и бочки с водой
        { id: 'crate_1',  x: 428, y: 162, w: 34, h: 34, mat: 'wood',  type: 'crate',        high: false, isCover: true },
        { id: 'crate_2',  x: 464, y: 170, w: 26, h: 26, mat: 'wood',  type: 'crate',        high: false, isCover: true },
        { id: 'wagon_1',  x: 540, y: 238, w: 62, h: 28, mat: 'wood',  type: 'wagon',        high: false, isCover: true },
        { id: 'crate_3',  x: 642, y: 320, w: 36, h: 32, mat: 'wood',  type: 'crate',        high: false, isCover: true },
        { id: 'crate_4',  x: 742, y: 176, w: 32, h: 38, mat: 'wood',  type: 'crate',        high: false, isCover: true },
        { id: 'wagon_2',  x: 712, y: 254, w: 60, h: 28, mat: 'wood',  type: 'wagon',        high: false, isCover: true },
        { id: 'crate_5',  x: 512, y: 312, w: 32, h: 30, mat: 'wood',  type: 'crate',        high: false, isCover: true },
        { id: 'crate_6',  x: 540, y: 316, w: 24, h: 24, mat: 'wood',  type: 'crate',        high: false, isCover: true },
        { id: 'barrel_1', x: 366, y: 124, w: 26, h: 26, mat: 'water', type: 'water_barrel', high: false, isCover: true },
        { id: 'barrel_2', x: 560, y: 366, w: 26, h: 26, mat: 'water', type: 'water_barrel', high: false, isCover: true },
        { id: 'barrel_3', x: 786, y: 126, w: 26, h: 26, mat: 'water', type: 'water_barrel', high: false, isCover: true },
        { id: 'barrel_4', x: 672, y: 164, w: 26, h: 26, mat: 'water', type: 'water_barrel', high: false, isCover: true },

        // --- УЩЕЛЬЕ КАНЬОНА ---
        { id: 'cliff_n1', x: 838,  y: 0,   w: 168, h: 96,  mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_n2', x: 998,  y: 0,   w: 204, h: 74,  mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_n3', x: 1192, y: 0,   w: 248, h: 106, mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_n4', x: 1440, y: 0,   w: 232, h: 88,  mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_n5', x: 1672, y: 0,   w: 246, h: 74,  mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_s1', x: 842,  y: height - 96,  w: 182, h: 96,  mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_s2', x: 1016, y: height - 76,  w: 202, h: 76,  mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_s3', x: 1206, y: height - 108, w: 234, h: 108, mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_s4', x: 1440, y: height - 92,  w: 232, h: 92,  mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_s5', x: 1672, y: height - 100, w: 246, h: 100, mat: 'rock', type: 'cliff', high: true, isCover: true },
        { id: 'cliff_e',  x: width - 44, y: 80, w: 44, h: height - 160, mat: 'rock', type: 'cliff', high: true, isCover: true, edgeEast: true },

        // Валуны-укрытия в каньоне
        { id: 'rock_1', x: 948,  y: 214, w: 46, h: 42, mat: 'rock', type: 'boulder', high: false, isCover: true },
        { id: 'rock_2', x: 1084, y: 146, w: 44, h: 38, mat: 'rock', type: 'boulder', high: false, isCover: true },
        { id: 'rock_3', x: 1108, y: 326, w: 54, h: 44, mat: 'rock', type: 'boulder', high: false, isCover: true },
        { id: 'rock_4', x: 1266, y: 230, w: 42, h: 46, mat: 'rock', type: 'boulder', high: false, isCover: true },
        { id: 'rock_5', x: 1204, y: 218, w: 46, h: 42, mat: 'rock', type: 'boulder', high: false, isCover: true },
        { id: 'rock_6', x: 1324, y: 172, w: 44, h: 40, mat: 'rock', type: 'boulder', high: false, isCover: true },
        { id: 'crate_7', x: 1010, y: 308, w: 34, h: 32, mat: 'wood', type: 'crate',   high: false, isCover: true },
        { id: 'rock_8', x: 1500, y: 214, w: 46, h: 42, mat: 'rock', type: 'boulder', high: false, isCover: true },
        { id: 'rock_9', x: 1662, y: 332, w: 50, h: 44, mat: 'rock', type: 'boulder', high: false, isCover: true },
        { id: 'crate_11', x: 1580, y: 168, w: 34, h: 32, mat: 'wood', type: 'crate', high: false, isCover: true },
        { id: 'wagon_4', x: 1720, y: 250, w: 60, h: 28, mat: 'wood', type: 'wagon', high: false, isCover: true },
        { id: 'barrel_6', x: 1440, y: 400, w: 26, h: 26, mat: 'water', type: 'water_barrel', high: false, isCover: true },
        { id: 'trough_2', x: 1758, y: 420, w: 54, h: 22, mat: 'water', type: 'trough', high: false, isCover: true },
        { id: 'hay_4', x: 1618, y: 462, w: 32, h: 24, mat: 'hay', type: 'hay', high: false, isCover: true },

        // --- ЮЖНЫЙ ДВОР / ЗАГОН (расширение карты вниз) ---
        { id: 'fence_y1', x: 360, y: 540, w: 300, h: 12, mat: 'wood', type: 'fence', high: false, isCover: true },
        { id: 'fence_y2', x: 360, y: 690, w: 120, h: 12, mat: 'wood', type: 'fence', high: false, isCover: true },
        { id: 'fence_y7', x: 540, y: 690, w: 120, h: 12, mat: 'wood', type: 'fence', high: false, isCover: true },
        { id: 'fence_y3', x: 360, y: 540, w: 12, h: 162, mat: 'wood', type: 'fence', high: false, isCover: true },
        { id: 'fence_y4', x: 648, y: 540, w: 12, h: 162, mat: 'wood', type: 'fence', high: false, isCover: true },
        { id: 'fence_y5', x: 1630, y: 556, w: 160, h: 12, mat: 'wood', type: 'fence', high: false, isCover: true },
        { id: 'fence_y6', x: 880, y: 560, w: 12, h: 120, mat: 'wood', type: 'fence', high: false, isCover: true },
        { id: 'hay_1', x: 430, y: 566, w: 36, h: 26, mat: 'hay', type: 'hay', high: false, isCover: true },
        { id: 'hay_2', x: 478, y: 574, w: 30, h: 22, mat: 'hay', type: 'hay', high: false, isCover: true },
        { id: 'hay_3', x: 1240, y: 592, w: 34, h: 26, mat: 'hay', type: 'hay', high: false, isCover: true },
        { id: 'trough_1', x: 540, y: 622, w: 58, h: 22, mat: 'water', type: 'trough', high: false, isCover: true },
        { id: 'crate_8', x: 596, y: 556, w: 32, h: 32, mat: 'wood', type: 'crate', high: false, isCover: true },
        { id: 'crate_9', x: 700, y: 624, w: 30, h: 30, mat: 'wood', type: 'crate', high: false, isCover: true },
        { id: 'crate_10', x: 1560, y: 620, w: 34, h: 32, mat: 'wood', type: 'crate', high: false, isCover: true },
        { id: 'wagon_3', x: 962, y: 598, w: 62, h: 28, mat: 'wood', type: 'wagon', high: false, isCover: true },
        { id: 'barrel_5', x: 1118, y: 660, w: 26, h: 26, mat: 'water', type: 'water_barrel', high: false, isCover: true },
        { id: 'rock_7', x: 1458, y: 546, w: 46, h: 42, mat: 'rock', type: 'boulder', high: false, isCover: true }
      ];

      // Телеграфные столбы с проводами вдоль улицы (референсы 1 и 2)
      const poles = [
        { x: 406, y: 118 },
        { x: 572, y: 114 },
        { x: 742, y: 116 },
        { x: 874, y: 106 }
      ];

      // Оливковые деревья на окраине городка (референс 3)
      const trees = [
        { x: 576, y: 36, r: 18 },
        { x: 564, y: 456, r: 22 },
        { x: 834, y: 406, r: 26 },
        { x: 1352, y: 498, r: 22 },
        { x: 764, y: 724, r: 20 },
        { x: 1806, y: 646, r: 24 }
      ];

      bakeSolidSprites(solids, trees);

      const wallSegments = [];
      const barrelSegments = [];
      const raiseSegments = [];
      const soundSegments = [];

      solids.forEach((s) => {
        const segs = rectToSegments(s);
        segs.forEach((seg) => {
          wallSegments.push(seg);
          // Поднятие оружия работает у ЛЮБЫХ препятствий (стены, ящики, бочки, столбы, заборы)
          raiseSegments.push(seg);
          if (s.high) {
            barrelSegments.push(seg);
            soundSegments.push(seg);
          }
        });
      });

      const doors = [
        { hingeX: 332, hingeY: 217, len: 36, baseAngle: Math.PI / 2,  angle: 0, vel: 0 },
        { hingeX: 332, hingeY: 293, len: 36, baseAngle: -Math.PI / 2, angle: 0, vel: 0 }
      ];

      const world = {
        width,
        height,
        solids,
        covers: solids.filter((s) => s.isCover),
        waterBarrels: solids.filter((s) => s.type === 'water_barrel'),
        poles,
        trees,
        wallSegments,
        barrelSegments,
        raiseSegments,
        soundSegments,
        doors,
        // Интерьер салуна (для клипа облачных теней и логики дневного света)
        saloon: { x: 24, y: 70, w: 316, h: 380 },
        spawnTimer: 0,
        targets: createInitialTargets(width, height, solids),
        bgCanvas: bakeBackground(width, height),

        // Рандомная точка появления бота: внутри игровых зон, без пересечения с препятствиями
        pickSpawnPoint(player, nearX, nearY) {
          const zones = [
            { x1: 352, y1: 132, x2: 820, y2: 388 },                 // узкая улочка
            { x1: 862, y1: 120, x2: width - 90, y2: 396 },          // каньон (запад и восток)
            { x1: 368, y1: 512, x2: width - 100, y2: height - 120 } // южный двор-загон
          ];
          for (let attempt = 0; attempt < 34; attempt++) {
            const z = zones[Math.floor(Math.random() * zones.length)];
            let x;
            let y;
            if (nearX !== undefined && nearY !== undefined) {
              x = G.MATH.clamp(nearX + G.MATH.rand(-150, 150), z.x1, z.x2);
              y = G.MATH.clamp(nearY + G.MATH.rand(-130, 130), z.y1, z.y2);
            } else {
              x = z.x1 + Math.random() * (z.x2 - z.x1);
              y = z.y1 + Math.random() * (z.y2 - z.y1);
            }
            if (player && G.MATH.dist(x, y, player.x, player.y) < 230) continue;
            if (!isFreeSpot(x, y, 18, solids)) continue;
            return { x: Math.round(x), y: Math.round(y) };
          }
          return {
            x: Math.round(nearX !== undefined ? nearX : 520),
            y: Math.round(nearY !== undefined ? nearY : 640)
          };
        },

        // Спавн нового бандита в случайном месте (авто-спавн и респавн после смерти)
        spawnBandit(player, opts) {
          const kits = [
            { coatColor: '#262423', coatTrim: '#3d3733', hatColor: '#1c1714', bandana: '#8a2b22', gunType: 'revolver', hp: 78 },
            { coatColor: '#22334a', coatTrim: '#395273', hatColor: '#2b1e16', bandana: '#96382b', gunType: 'rifle', hp: 82 },
            { coatColor: '#473424', coatTrim: '#664d37', hatColor: '#241b14', bandana: '#78251d', gunType: 'revolver', hp: 80 },
            { coatColor: '#363d33', coatTrim: '#4f594b', hatColor: '#211914', bandana: '#8a2b22', gunType: 'rifle', hp: 84 },
            { coatColor: '#522620', coatTrim: '#733830', hatColor: '#1a1512', bandana: '#c49d56', gunType: 'revolver', hp: 80 },
            { coatColor: '#2f3a2c', coatTrim: '#46553f', hatColor: '#1d1712', bandana: '#8a2b22', gunType: 'rifle', hp: 82 }
          ];
          const kit = opts || kits[Math.floor(Math.random() * kits.length)];
          const spot = world.pickSpawnPoint(player);
          const t = makeBandit(banditIdSeq++, spot.x, spot.y, kit);
          t.patrolPhase = Math.random() * Math.PI * 2;
          t.angle = Math.random() * Math.PI * 2;
          world.targets.push(t);
          return t;
        },

        getZoneAt(x, y) {
          if (x < 336 && y > 70 && y < 450) {
            return { id: 'saloon', label: 'САЛУН' };
          }
          if (x >= 855) {
            return { id: 'canyon', label: y > 470 ? 'ЮЖНЫЙ КАНЬОН' : 'УЩЕЛЬЕ КАНЬОНА' };
          }
          if (y > 470) {
            return { id: 'yard', label: 'ДВОР И ЗАГОН' };
          }
          return { id: 'alley', label: 'УЗКАЯ УЛОЧКА' };
        },

        getSurfaceAt(x, y) {
          if (x < 344 && y > 72 && y < 448) return 'wood';
          if (x >= 340 && x <= 824 && ((y >= 102 && y <= 124) || (y >= 392 && y <= 414))) {
            return 'wood';
          }
          return 'dirt';
        },

        updateDoors(dt, player) {
          for (let i = 0; i < doors.length; i++) {
            const d = doors[i];
            const midX = d.hingeX + Math.cos(d.baseAngle + d.angle) * (d.len * 0.55);
            const midY = d.hingeY + Math.sin(d.baseAngle + d.angle) * (d.len * 0.55);
            const dist = G.MATH.dist(player.x, player.y, midX, midY);
            if (dist < 22) {
              const pushDir = player.vx >= 0 ? (i === 0 ? -1 : 1) : (i === 0 ? 1 : -1);
              d.vel += pushDir * 16 * dt * 6;
            }
            const springAcc = -d.angle * 36 - d.vel * 5.2;
            d.vel += springAcc * dt;
            d.angle = G.MATH.clamp(d.angle + d.vel * dt, -1.35, 1.35);
          }
        },

        updateTargets(dt, player) {
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
                t.patrolPhase += dt * t.patrolSpeed;
                const targetY = t.homeY + Math.sin(t.patrolPhase) * t.patrolAmp;
                const prevY = t.y;
                t.y = G.MATH.lerp(t.y, targetY, Math.min(1, dt * 3.5));
                t.x = G.MATH.lerp(t.x, t.homeX, Math.min(1, dt * 1.8));
                const stepSpeed = Math.abs(t.y - prevY) / Math.max(0.001, dt);
                t.walkPhase += dt * (2.5 + stepSpeed * 0.14);

                if (player) {
                  const dToP = G.MATH.dist(t.x, t.y, player.x, player.y);
                  if (dToP < 380) {
                    const want = Math.atan2(player.y - t.y, player.x - t.x);
                    t.angle = G.MATH.normAngle(t.angle + G.MATH.angleDiff(t.angle, want) * Math.min(1, dt * 4.5));
                  }
                }

                // Оружие бота тоже поднимается у любого препятствия (ящик, бочка, столб, забор)
                let nearObstacle = false;
                for (let ci = 0; ci < world.covers.length; ci++) {
                  const c = world.covers[ci];
                  if (c.id === t.id) continue;
                  if (G.MATH.circleRectPush(t.x, t.y, t.r + 10, c).hit) {
                    nearObstacle = true;
                    break;
                  }
                }
                t.wallRaiseFrac = G.MATH.lerp(t.wallRaiseFrac || 0, nearObstacle ? 1 : 0, Math.min(1, dt * 10));
              } else {
                t.deathAnim = Math.min(1, t.deathAnim + dt * 3.4);
                t.bloodPool = Math.min(1, t.bloodPool + dt * 0.65);
                if (t.respawnTimer > 0) {
                  t.respawnTimer -= dt;
                  // Остановка спавна: уже существующие боты живут, но новые не появляются
                  if (t.respawnTimer <= 0 && !G.CFG.pauseSpawn) {
                    const spot = world.pickSpawnPoint(player, t.homeX, t.homeY);
                    t.alive = true;
                    t.hp = t.maxHp;
                    t.x = spot.x;
                    t.y = spot.y;
                    t.homeX = spot.x;
                    t.homeY = spot.y;
                    t.knockVx = 0;
                    t.knockVy = 0;
                    t.deathAnim = 0;
                    t.bloodPool = 0;
                    t.wobble = 0.5;
                    t.wallRaiseFrac = 0;
                  }
                }
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

          // Авто-спавн новых ботов в случайных местах (пока спавн не остановлен)
          if (G.CFG.spawnBandits !== false) {
            let aliveCount = 0;
            let banditCount = 0;
            for (let i = 0; i < world.targets.length; i++) {
              const t = world.targets[i];
              if (t.kind !== 'bandit') continue;
              banditCount++;
              if (t.alive) aliveCount++;
            }
            world.spawnTimer += dt;
            if (world.spawnTimer >= (G.CFG.botSpawnInterval || 7)) {
              world.spawnTimer = 0;
              const cap = G.CFG.botMaxAlive || 6;
              if (!G.CFG.pauseSpawn && banditCount < 18 && aliveCount < cap) {
                world.spawnBandit(player);
              }
            }
          }
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
