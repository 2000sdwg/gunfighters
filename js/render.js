(function () {
  const G = (window.G = window.G || {});

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // Виртуальный низкоразрешённый пиксельный буфер мира (1:1 сетка пиксель-арта)
  const pixCanvas = document.createElement('canvas');
  const pctx = pixCanvas.getContext('2d');

  // Ссылки на элементы компактного HUD (Шаг 1: Style Lock UI)
  const ui = {
    zoneName: document.getElementById('zone-name'),
    echoInfo: document.getElementById('echo-info'),
    statusLine: document.getElementById('status-line'),
    btnSettings: document.getElementById('btn-settings'),
    settingsPanel: document.getElementById('settings-panel'),
    slInertia: document.getElementById('sl-inertia'),
    valInertia: document.getElementById('val-inertia'),
    slRecoil: document.getElementById('sl-recoil'),
    valRecoil: document.getElementById('val-recoil'),
    slSpring: document.getElementById('sl-spring'),
    valSpring: document.getElementById('val-spring'),
    slEcho: document.getElementById('sl-echo'),
    valEcho: document.getElementById('val-echo'),
    slAccuracy: document.getElementById('sl-accuracy'),
    valAccuracy: document.getElementById('val-accuracy'),
    btnDiffEasy: document.getElementById('btn-diff-easy'),
    btnDiffMedium: document.getElementById('btn-diff-medium'),
    btnDiffHard: document.getElementById('btn-diff-hard'),
    slBotCap: document.getElementById('sl-bot-cap'),
    valBotCap: document.getElementById('val-bot-cap'),
    slBotInterval: document.getElementById('sl-bot-interval'),
    valBotInterval: document.getElementById('val-bot-interval'),
    btnToggleSpawn: document.getElementById('btn-toggle-spawn'),
    btnRespawnEnemies: document.getElementById('btn-respawn-enemies'),
    btnToggleWaves: document.getElementById('btn-toggle-waves'),
    bindBtns: Array.from(document.querySelectorAll('.btn-bind')),
    btnResetBinds: document.getElementById('btn-reset-binds'),
    btnToggleRays: document.getElementById('btn-toggle-rays'),
    btnToggleBandits: document.getElementById('btn-toggle-bandits'),
    btnToggleStorm: document.getElementById('btn-toggle-storm'),
    btnSpawnHorse: document.getElementById('btn-spawn-horse'),
    btnToggleGodMode: document.getElementById('btn-toggle-godmode'),
    horseHudRow: document.getElementById('horse-hud-row'),
    horseHpFill: document.getElementById('horse-hp-fill'),
    horseCalmFill: document.getElementById('horse-calm-fill'),
    horseHudVal: document.getElementById('horse-hud-val'),
    toast: document.getElementById('center-toast'),
    hatMenu: document.getElementById('hat-menu'),
    hatList: document.getElementById('hat-list'),
    hatKillsCount: document.getElementById('hat-kills-count'),
    btnCloseHats: document.getElementById('btn-close-hats'),
    waveLabel: document.getElementById('wave-label'),
    waveEnemies: document.getElementById('wave-enemies'),
    bandageSlot: document.getElementById('bandage-slot'),
    bandageCount: document.getElementById('bandage-count'),
    bleedBadge: document.getElementById('bleed-badge'),
    btnEditor: document.getElementById('btn-editor'),
    editorPanel: document.getElementById('editor-panel'),
    btnEditorPlace: document.getElementById('btn-editor-place'),
    btnEditorRotate: document.getElementById('btn-editor-rotate'),
    btnEditorErase: document.getElementById('btn-editor-erase'),
    btnEditorTabObjects: document.getElementById('btn-editor-tab-objects'),
    btnEditorTabNpc: document.getElementById('btn-editor-tab-npc'),
    editorPalette: document.getElementById('editor-palette'),
    btnEditorSave: document.getElementById('btn-editor-save'),
    btnEditorCopy: document.getElementById('btn-editor-copy'),
    btnEditorReset: document.getElementById('btn-editor-reset'),
    btnNetwork: document.getElementById('btn-network'),
    networkPanel: document.getElementById('network-panel'),
    netName: document.getElementById('net-name'),
    btnNetMode: document.getElementById('btn-net-mode'),
    btnNetFf: document.getElementById('btn-net-ff'),
    btnNetHost: document.getElementById('btn-net-host'),
    netRoomCode: document.getElementById('net-room-code'),
    btnNetCopyRoom: document.getElementById('btn-net-copy-room'),
    netJoinCode: document.getElementById('net-join-code'),
    btnNetJoin: document.getElementById('btn-net-join'),
    btnNetOffer: document.getElementById('btn-net-offer'),
    btnNetAcceptOffer: document.getElementById('btn-net-accept-offer'),
    btnNetApplyAnswer: document.getElementById('btn-net-apply-answer'),
    btnNetCopyManual: document.getElementById('btn-net-copy-manual'),
    netManualCode: document.getElementById('net-manual-code'),
    netStatus: document.getElementById('net-status'),
    netPlayersList: document.getElementById('net-players-list'),
    btnNetDisconnect: document.getElementById('btn-net-disconnect'),
    reloadPanel: document.getElementById('reload-panel'),
    reloadTitle: document.getElementById('reload-title'),
    reloadCanvas: document.getElementById('reload-canvas'),
    reloadSlots: document.getElementById('reload-slots'),
    btnInsertOne: document.getElementById('btn-insert-one'),
    weaponSlots: Array.from(document.querySelectorAll('#weapons-bar .w-slot')),
    ammoDots: document.getElementById('ammo-dots'),
    ammoCount: document.getElementById('ammo-count'),
    mechState: document.getElementById('mech-state'),
    controlsLegend: document.getElementById('controls-legend'),
    hpBox: document.getElementById('hp-box'),
    hpBarFill: document.getElementById('hp-bar-fill'),
    hpNum: document.getElementById('hp-num')
  };

  const rctx = ui.reloadCanvas ? ui.reloadCanvas.getContext('2d') : null;
  if (rctx) rctx.imageSmoothingEnabled = false;

  // Единый вектор полуденного солнца (высокое солнце, плотные короткие тени на юго-восток)
  const SUN = {
    dx: 0.58,
    dy: 0.82
  };

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

  let viewW = window.innerWidth;
  let viewH = window.innerHeight;
  let pixW = 480;
  let pixH = 270;
  let state = null;
  let world = null;

  // Плывущие полуденные пылинки
  const dustMotes = [];
  for (let i = 0; i < 64; i++) {
    dustMotes.push({
      x: (i * 157) % 2880,
      y: 65 + ((i * 53) % 700),
      vx: 4 + (i % 5) * 1.4,
      vy: 0.6 + ((i % 3) - 1) * 0.8,
      phase: i * 1.3
    });
  }

  let lastAmmoKey = '';
  let lastReloadVis = false;
  let lastReloadTitle = '';
  let lastWeaponIdx = -1;
  let lastToastText = '';
  let lastToastVisible = false;
  let lastWaveKey = '';
  let lastHatMenuKey = '';
  let lastInvKey = '';
  let lastEditorKey = '';
  let lastEditorTab = '';
  let lastNetKey = '';
  let netUiTimer = 0;

  let fpsAccum = 0;
  let fpsFrames = 0;
  let curFps = 60;
  let curFrameMs = 16.7;

  const vignetteCanvas = document.createElement('canvas');
  const vctx = vignetteCanvas.getContext('2d');

  const discCache = new Map();
  const DISC_CACHE_LIMIT = 256;

  function getCachedPixelDisc(radius, color) {
    const qr = Math.max(2, Math.round(radius / 2) * 2);
    const key = `${color}|${qr}`;
    let entry = discCache.get(key);
    if (entry) return entry;

    if (discCache.size >= DISC_CACHE_LIMIT) {
      const oldestKey = discCache.keys().next().value;
      if (oldestKey !== undefined) discCache.delete(oldestKey);
    }

    const sz = qr * 2 + 1;
    const c = document.createElement('canvas');
    c.width = sz;
    c.height = sz;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = color;
    for (let dy = -qr; dy <= qr; dy++) {
      const span = Math.floor(Math.sqrt(qr * qr - dy * dy));
      if (span >= 0) {
        g.fillRect(qr - span, qr + dy, span * 2 + 1, 1);
      }
    }
    entry = { canvas: c, qr: qr, half: qr };
    discCache.set(key, entry);
    return entry;
  }

  function isInView(x, y, w, h, org, pad) {
    const p = pad !== undefined ? pad : 48;
    return !(x + w < org.x - p || x > org.x + pixW + p || y + h < org.y - p || y > org.y + pixH + p);
  }

  // ==================== ЗАПЕЧЁННЫЙ ВИДЖЕТ ИММЕРСИВНОЙ ПЕРЕЗАРЯДКИ (136x84, ПРОЗРАЧНЫЙ) ====================

  const RELOAD_W = 136;
  const RELOAD_H = 84;
  const CYL_CX = 68;
  const CYL_CY = 42;
  const CYL_R = 29;
  const CHAMBER_ORBIT = 16.5;
  const CHAMBER_R = 6.2;

  const reloadAnim = {
    hoverSlot: -1,
    cylAngle: -Math.PI * 0.5,
    cylVel: 0,
    joltX: 0,
    joltY: 0,
    gatePress: 0,
    pressFlash: null,
    shells: [],      // падающие гильзы в виджете (макс 6)
    inserts: [],     // влетающие патроны в каморы/окно Винчестера
    caches: null
  };

  function makeOffscreen(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return { c, g };
  }

  function initReloadCaches() {
    if (reloadAnim.caches) return reloadAnim.caches;
    const P = getPal();

    // 1. Попиксельно растеризованный барабан револьвера (без arc)
    function bakeCylinderBody(lightSteel) {
      const size = 64;
      const { c, g } = makeOffscreen(size, size);
      const cx = 32;
      const cy = 32;
      const r = CYL_R;

      const colOut = P.outline || '#140f0c';
      const colHi  = lightSteel ? P.steelLight[0] : P.steelDark[0];
      const colMid = lightSteel ? P.steelLight[1] : P.steelDark[1];
      const colSh  = lightSteel ? P.steelLight[3] : P.steelDark[3];
      const colDk  = lightSteel ? P.steelLight[4] : P.steelDark[4];

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const d = Math.hypot(dx, dy);
          if (d > r + 0.6) continue;

          // 6 камор: оставляем отверстия радиусом 4.8px открытыми, а вокруг отверстия 1px фаску
          let inHole = false;
          let inChamfer = false;
          for (let k = 0; k < 6; k++) {
            const a = k * (Math.PI / 3);
            const chx = cx + Math.cos(a) * CHAMBER_ORBIT;
            const chy = cy + Math.sin(a) * CHAMBER_ORBIT;
            const cd = Math.hypot(x - chx, y - chy);
            if (cd <= 4.8) {
              inHole = true;
              break;
            } else if (cd <= 5.8) {
              inChamfer = true;
              break;
            }
          }
          if (inHole) continue; // прозрачная камора для вставки спрайта

          if (inChamfer) {
            g.fillStyle = (dx + dy < 0) ? colHi : colSh;
            g.fillRect(x, y, 1, 1);
            continue;
          }

          // Дольки/флейты барабана (flutes)
          const ang = Math.atan2(dy, dx);
          const fluteWave = Math.cos((ang + Math.PI / 6) * 6);
          const effR = r - (fluteWave > 0.45 ? (fluteWave - 0.45) * 3.1 : 0);
          if (d > effR + 0.5) continue;

          if (d > effR - 1.1) {
            g.fillStyle = colOut;
          } else {
            const shade = (dx / r) * 0.45 + (dy / r) * 0.55;
            if (d > effR - 3.0) {
              g.fillStyle = shade < -0.1 ? colHi : shade < 0.35 ? colMid : colDk;
            } else {
              g.fillStyle = shade < -0.25 ? colHi : shade < 0.2 ? colMid : shade < 0.6 ? colSh : colDk;
            }
          }
          g.fillRect(x, y, 1, 1);
        }
      }

      // Центральная ось и храповик-звёздочка экстрактора
      g.fillStyle = colDk;
      g.fillRect(cx - 5, cy - 5, 10, 10);
      for (let i = 0; i < 6; i++) {
        const a = i * (Math.PI / 3);
        const ex = Math.round(cx + Math.cos(a) * 5.6);
        const ey = Math.round(cy + Math.sin(a) * 5.6);
        g.fillStyle = colHi;
        g.fillRect(ex - 1, ey - 1, 2, 2);
      }
      g.fillStyle = colMid;
      g.fillRect(cx - 3, cy - 3, 6, 6);
      g.fillStyle = colOut;
      g.fillRect(cx - 1, cy - 1, 2, 2);

      return c;
    }

    // Пустая камора барабана (пиксельная фаска, глубокая тень и верхне-левый блик стенки)
    function bakeEmptyChamber(lightSteel) {
      const { c, g } = makeOffscreen(14, 14);
      const cx = 7, cy = 7;
      const colHi = lightSteel ? P.steelLight[1] : P.steelDark[1];
      const colSh = lightSteel ? P.steelLight[3] : P.steelDark[3];
      const colOut = P.outline || '#140f0c';

      for (let y = 0; y < 14; y++) {
        for (let x = 0; x < 14; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const d = Math.hypot(dx, dy);
          if (d > 5.8) continue;
          if (d > 4.7) {
            g.fillStyle = (dx + dy < 0) ? colHi : colSh;
          } else if (d > 3.6 && dx < 0 && dy < 0) {
            g.fillStyle = colHi;
          } else {
            g.fillStyle = colOut;
          }
          g.fillRect(x, y, 1, 1);
        }
      }
      return c;
    }

    // Заряженный патрон со стороны донца (латунь G.PAL.brass + капсюль G.PAL.lead)
    function bakeLiveRound() {
      const { c, g } = makeOffscreen(14, 14);
      const cx = 7, cy = 7;
      for (let y = 0; y < 14; y++) {
        for (let x = 0; x < 14; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const d = Math.hypot(dx, dy);
          if (d > 5.8) continue;
          if (d > 4.8) {
            g.fillStyle = P.brass[3];
          } else if (d > 2.6) {
            g.fillStyle = (dx + dy < 0) ? P.brass[0] : P.brass[1];
          } else if (d > 1.8) {
            g.fillStyle = P.outline || '#140f0c';
          } else {
            g.fillStyle = (dx < 0 && dy < 0) ? P.lead[0] : P.lead[1];
          }
          g.fillRect(x, y, 1, 1);
        }
      }
      return c;
    }

    // Стреляная гильза со следом бойка на капсюле и пороховым нагаром
    function bakeSpentRound() {
      const { c, g } = makeOffscreen(14, 14);
      const cx = 7, cy = 7;
      for (let y = 0; y < 14; y++) {
        for (let x = 0; x < 14; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const d = Math.hypot(dx, dy);
          if (d > 5.8) continue;
          if (d > 4.8) {
            g.fillStyle = P.brass[4];
          } else if (d > 2.6) {
            g.fillStyle = (dx + dy < 0) ? P.brass[2] : P.brass[3];
          } else if (d > 1.2) {
            g.fillStyle = P.brass[4];
          } else {
            g.fillStyle = P.outline || '#140f0c'; // кратер от бойка
          }
          g.fillRect(x, y, 1, 1);
        }
      }
      return c;
    }

    // Падающая стреляная гильза (латунь с фланцем, проточкой и тёмным открытым дульцем)
    function bakeFallingShell() {
      const { c, g } = makeOffscreen(14, 7);
      // Фланец донца
      g.fillStyle = P.brass[2];
      g.fillRect(0, 0, 2, 7);
      g.fillStyle = P.brass[0];
      g.fillRect(0, 0, 1, 3);
      // Проточка
      g.fillStyle = P.brass[4];
      g.fillRect(2, 1, 1, 5);
      // Корпус гильзы
      g.fillStyle = P.brass[1];
      g.fillRect(3, 1, 8, 5);
      g.fillStyle = P.brass[0];
      g.fillRect(3, 1, 8, 2);
      g.fillStyle = P.brass[3];
      g.fillRect(3, 5, 8, 1);
      // Открытое дульце
      g.fillStyle = P.brass[4];
      g.fillRect(11, 1, 1, 5);
      g.fillStyle = P.outline || '#140f0c';
      g.fillRect(12, 1, 2, 5);
      return c;
    }

    // Вертикальный патрон для подачи сверху в окно Винчестера
    function bakeTopCartridge() {
      const { c, g } = makeOffscreen(8, 20);
      // Фланец донца сверху
      g.fillStyle = P.brass[2];
      g.fillRect(0, 0, 8, 2);
      g.fillStyle = P.brass[0];
      g.fillRect(1, 0, 3, 1);
      // Проточка
      g.fillStyle = P.brass[4];
      g.fillRect(1, 2, 6, 1);
      // Латунная гильза
      g.fillStyle = P.brass[1];
      g.fillRect(1, 3, 6, 9);
      g.fillStyle = P.brass[0];
      g.fillRect(1, 3, 2, 9);
      g.fillStyle = P.brass[3];
      g.fillRect(5, 3, 2, 9);
      // Дульце и кримп
      g.fillStyle = P.brass[4];
      g.fillRect(1, 12, 6, 1);
      // Оживальная свинцовая пуля, направленная вниз
      g.fillStyle = P.lead[1];
      g.fillRect(2, 13, 4, 4);
      g.fillStyle = P.lead[0];
      g.fillRect(2, 13, 1, 3);
      g.fillStyle = P.lead[2];
      g.fillRect(3, 17, 2, 2);
      return c;
    }

    // Патрон под углом 30-35 градусов для вставки в камору барабана
    function bakeAngledCartridge() {
      const { c, g } = makeOffscreen(18, 18);
      // Наклонный силуэт патрона
      g.fillStyle = P.brass[2];
      g.fillRect(1, 1, 5, 3);
      g.fillStyle = P.brass[0];
      g.fillRect(1, 1, 2, 2);
      // Тело гильзы
      g.fillStyle = P.brass[1];
      g.fillRect(4, 3, 7, 7);
      g.fillStyle = P.brass[0];
      g.fillRect(4, 3, 7, 2);
      g.fillStyle = P.brass[3];
      g.fillRect(5, 8, 6, 3);
      // Свинцовая пуля на конце
      g.fillStyle = P.lead[1];
      g.fillRect(10, 9, 5, 5);
      g.fillStyle = P.lead[0];
      g.fillRect(10, 9, 3, 2);
      g.fillStyle = P.lead[2];
      g.fillRect(13, 12, 3, 3);
      return c;
    }

    // Крупный фрагмент револьвера вокруг откинутого барабана (все 6 камор открыты!)
    function bakeRevolverFrame(lightSteel) {
      const { c, g } = makeOffscreen(RELOAD_W, RELOAD_H);
      const steel = lightSteel ? P.steelLight : P.steelDark;
      const colOut = P.outline || '#140f0c';

      // Слева: щиток рамки, курок и шейка рукоятки
      g.fillStyle = colOut;
      g.fillRect(10, 16, 26, 54);
      g.fillStyle = steel[3];
      g.fillRect(12, 18, 22, 50);
      g.fillStyle = steel[1];
      g.fillRect(14, 20, 18, 46);
      g.fillStyle = steel[0];
      g.fillRect(14, 20, 18, 2);

      // Деревянная щёчка рукоятки
      g.fillStyle = P.woodWarm[3];
      g.fillRect(6, 42, 16, 32);
      g.fillStyle = P.woodWarm[1];
      g.fillRect(7, 43, 14, 29);
      g.fillStyle = P.woodWarm[0];
      g.fillRect(7, 43, 14, 2);
      g.fillStyle = P.lead[2];
      g.fillRect(13, 56, 2, 2);

      // Взведённый курок
      g.fillStyle = steel[1];
      g.fillRect(18, 12, 6, 10);
      g.fillStyle = steel[0];
      g.fillRect(18, 12, 6, 2);
      g.fillStyle = colOut;
      g.fillRect(24, 12, 2, 4);

      // Справа: передний мостик рамки и начало ствола
      g.fillStyle = colOut;
      g.fillRect(98, 26, 34, 24);
      g.fillStyle = steel[3];
      g.fillRect(100, 28, 30, 20);
      g.fillStyle = steel[1];
      g.fillRect(100, 30, 30, 16);
      g.fillStyle = steel[0];
      g.fillRect(100, 30, 30, 3);

      // Пульный вход ствола у барабана
      g.fillStyle = steel[0];
      g.fillRect(98, 33, 2, 10);

      // Снизу: петля и кран барабана (crane)
      g.fillStyle = steel[2];
      g.fillRect(44, 62, 28, 8);
      g.fillStyle = steel[0];
      g.fillRect(44, 62, 28, 1);
      g.fillStyle = colOut;
      g.fillRect(44, 69, 28, 1);

      return c;
    }

    // Крупный план УЗЛА ПЕРЕЗАРЯДКИ Winchester 1873 (136x84, прозрачный фон).
    // 6. Детализированный фрагмент Винчестера 1873 (136x84):
    // Слева приклад (уходит за левый край), по центру латунно-стальная ствольная коробка и скоба Генри,
    // справа цевьё и длинный восьмигранный ствол с подствольным магазином, уходящие за правый край без мушки.
    function bakeWinchesterReceiver() {
      const { c, g } = makeOffscreen(RELOAD_W, RELOAD_H);
      const colOut = P.outline || '#140f0c';

      // Мягкая тень под фрагментом карабина (до самых краёв)
      g.fillStyle = 'rgba(0, 0, 0, 0.34)';
      g.fillRect(0, 76, RELOAD_W, 5);

      // --- 1. Деревянный приклад слева (шейка + гребень приклада уходят за x = 0) ---
      for (let x = 0; x < 34; x++) {
        // Плавное сужение приклада от гребня (x=0) к шейке (x=28..33)
        const t = x / 33;
        const topY = Math.round(G.MATH.lerp(42, 39, t));
        const botY = Math.round(G.MATH.lerp(74, 62, t * 0.85));
        const h = Math.max(12, botY - topY);

        g.fillStyle = colOut;
        g.fillRect(x, topY - 1, 1, h + 2);
        g.fillStyle = P.woodWarm[2];
        g.fillRect(x, topY, 1, h);
        // Солнечный гребень сверху
        g.fillStyle = P.woodWarm[1];
        g.fillRect(x, topY, 1, 5);
        g.fillStyle = P.woodWarm[0];
        g.fillRect(x, topY, 1, 2);
        // Тень внизу приклада
        g.fillStyle = P.woodWarm[3];
        g.fillRect(x, topY + h - 4, 1, 4);
        // Продольные волокна орехового дерева
        if ((x + topY) % 5 === 0) {
          g.fillStyle = P.woodWarm[3];
          g.fillRect(x, topY + 6, 1, 2);
        }
        if ((x * 2) % 7 === 0) {
          g.fillStyle = P.woodWarm[1];
          g.fillRect(x, topY + Math.floor(h * 0.55), 1, 2);
        }
      }

      // Металлический хвостовик коробки на гребне шейки приклада
      g.fillStyle = colOut;
      g.fillRect(14, 37, 20, 4);
      g.fillStyle = P.brass[2];
      g.fillRect(15, 38, 19, 2);
      g.fillStyle = P.brass[0];
      g.fillRect(16, 38, 17, 1);

      // --- 2. Латунно-стальная ствольная коробка (центр: x=32..92) ---
      g.fillStyle = colOut;
      g.fillRect(32, 36, 61, 32);
      g.fillStyle = P.brass[2];
      g.fillRect(33, 37, 59, 30);
      g.fillStyle = P.brass[1];
      g.fillRect(33, 41, 59, 21);
      g.fillStyle = P.brass[0];
      g.fillRect(33, 37, 59, 3);
      g.fillStyle = P.brass[3];
      g.fillRect(33, 60, 59, 7);
      g.fillStyle = P.brass[4];
      g.fillRect(33, 65, 59, 2);

      // Стальной затворный клин сверху спереди + витые торцы
      g.fillStyle = P.steelDark[2];
      g.fillRect(34, 38, 15, 4);
      g.fillStyle = P.steelDark[0];
      g.fillRect(35, 38, 13, 1);

      // Боковая крышка коробки с винтами и окном подачи
      g.fillStyle = P.brass[3];
      g.fillRect(38, 43, 50, 16);
      g.fillStyle = P.brass[2];
      g.fillRect(39, 44, 48, 14);
      g.fillStyle = P.brass[1];
      g.fillRect(39, 44, 48, 1);
      g.fillStyle = P.steelDark[2];
      g.fillRect(58, 47, 24, 8);
      g.fillStyle = P.steelDark[1];
      g.fillRect(59, 48, 22, 6);
      g.fillStyle = P.steelDark[0];
      g.fillRect(60, 48, 20, 1);
      // Винты боковой крышки
      g.fillStyle = P.lead[1];
      g.fillRect(42, 46, 2, 2);
      g.fillRect(83, 46, 2, 2);
      g.fillRect(42, 55, 2, 2);
      g.fillRect(83, 55, 2, 2);

      // --- 3. Взведённый курок позади коробки ---
      g.fillStyle = colOut;
      g.fillRect(25, 29, 9, 13);
      g.fillStyle = P.steelDark[2];
      g.fillRect(26, 30, 7, 11);
      g.fillStyle = P.steelDark[0];
      g.fillRect(26, 30, 3, 2);
      g.fillStyle = P.steelDark[4];
      g.fillRect(28, 34, 4, 6);

      // --- 4. Скоба-рычаг Генри и спуск ---
      g.fillStyle = colOut;
      g.fillRect(31, 66, 36, 5);
      g.fillRect(31, 78, 36, 4);
      g.fillRect(31, 66, 5, 16);
      g.fillRect(62, 66, 5, 16);
      g.fillStyle = P.brass[2];
      g.fillRect(32, 67, 34, 3);
      g.fillRect(32, 77, 34, 2);
      g.fillRect(32, 67, 3, 12);
      g.fillRect(63, 67, 3, 12);
      g.fillStyle = P.brass[0];
      g.fillRect(32, 67, 34, 1);
      g.fillRect(32, 67, 3, 8);
      // Спусковой крючок внутри скобы
      g.fillStyle = P.steelDark[2];
      g.fillRect(48, 69, 3, 6);
      g.fillStyle = P.steelDark[0];
      g.fillRect(48, 69, 1, 4);

      // --- 5. Воронёный восьмигранный ствол (уходит за правый край x = RELOAD_W без мушки) ---
      const bX = 92;
      const bW = RELOAD_W - bX;
      g.fillStyle = colOut;
      g.fillRect(bX, 38, bW, 9);
      g.fillStyle = P.steelDark[3];
      g.fillRect(bX, 44, bW, 2);
      g.fillStyle = P.steelDark[2];
      g.fillRect(bX, 41, bW, 3);
      g.fillStyle = P.steelDark[1];
      g.fillRect(bX, 39, bW, 3);
      g.fillStyle = P.steelDark[0];
      g.fillRect(bX, 39, bW, 1);

      // --- 6. Подствольная трубка магазина (уходит за правый край x = RELOAD_W) ---
      g.fillStyle = colOut;
      g.fillRect(bX, 48, bW, 6);
      g.fillStyle = P.steelDark[3];
      g.fillRect(bX, 49, bW, 4);
      g.fillStyle = P.steelDark[1];
      g.fillRect(bX, 49, bW, 1);

      // --- 7. Деревянное цевьё спереди коробки с латунным кольцом (x=90..118) ---
      g.fillStyle = colOut;
      g.fillRect(90, 46, 28, 15);
      g.fillStyle = P.woodWarm[1];
      g.fillRect(91, 47, 26, 13);
      g.fillStyle = P.woodWarm[0];
      g.fillRect(91, 47, 24, 3);
      g.fillStyle = P.woodWarm[3];
      g.fillRect(91, 56, 26, 4);
      // Латунное переднее кольцо (обоймица)
      g.fillStyle = P.brass[1];
      g.fillRect(111, 46, 3, 15);
      g.fillStyle = P.brass[0];
      g.fillRect(111, 46, 1, 15);

      // --- 8. Верхнее окно заряжания (строго x=50..80 для точного совпадения с подачей патрона) ---
      g.clearRect(50, 36, 30, 9);
      g.fillStyle = 'rgba(12, 9, 7, 0.58)';
      g.fillRect(51, 37, 28, 8);
      g.fillStyle = P.brass[0];
      g.fillRect(50, 36, 30, 1);
      g.fillStyle = P.brass[3];
      g.fillRect(51, 44, 28, 2);

      return c;
    }

    // Наклонный винтовочный патрон (~38°, пуля вниз-вперёд) — запекается один раз
    function bakeAngledRifle() {
      const { c, g } = makeOffscreen(24, 24);
      const colOut = P.outline || '#140f0c';
      const ang = 0.66;                       // наклон оси патрона
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const len = 19;
      const cx = 12;
      const cy = 12;

      // Тёмный контур силуэта
      for (let t = 0; t <= len; t++) {
        const px = Math.round(cx + dx * (t - len * 0.5));
        const py = Math.round(cy + dy * (t - len * 0.5));
        g.fillStyle = colOut;
        g.fillRect(px - 1, py - 1, 4, 4);
      }
      // Тело патрона: фланец, проточка, латунь, дульце, свинцовая пуля
      for (let t = 0; t <= len; t++) {
        const px = Math.round(cx + dx * (t - len * 0.5));
        const py = Math.round(cy + dy * (t - len * 0.5));
        let col;
        if (t < 2) col = P.brass[2];
        else if (t < 3) col = P.brass[4];
        else if (t < 12) col = (t % 4 === 0) ? P.brass[0] : P.brass[1];
        else if (t < 14) col = P.brass[3];
        else col = (t % 2 === 0) ? P.lead[0] : P.lead[1];
        g.fillStyle = col;
        g.fillRect(px, py, 2, 2);
      }
      return c;
    }

    reloadAnim.caches = {
      walkerCyl: bakeCylinderBody(true),
      lightningCyl: bakeCylinderBody(false),
      walkerEmpty: bakeEmptyChamber(true),
      lightningEmpty: bakeEmptyChamber(false),
      liveRound: bakeLiveRound(),
      spentRound: bakeSpentRound(),
      fallingShell: bakeFallingShell(),
      topCartridge: bakeTopCartridge(),
      angledRifle: bakeAngledRifle(),
      angledCartridge: bakeAngledCartridge(),
      walkerFrame: bakeRevolverFrame(true),
      lightningFrame: bakeRevolverFrame(false),
      winchesterReceiver: bakeWinchesterReceiver()
    };
    return reloadAnim.caches;
  }

  function getChamberCenter(slotIdx, openFrac, cylAngle) {
    const cx = Math.round(CYL_CX + reloadAnim.joltX);
    const cy = Math.round(G.MATH.lerp(RELOAD_H + 18, CYL_CY, openFrac) + reloadAnim.joltY);
    const a = cylAngle + slotIdx * (Math.PI / 3);
    return {
      x: cx + Math.cos(a) * CHAMBER_ORBIT,
      y: cy + Math.sin(a) * CHAMBER_ORBIT
    };
  }

  function processReloadEvents() {
    if (!state.reloadEvents || !state.reloadEvents.length) return;
    while (state.reloadEvents.length > 0) {
      const ev = state.reloadEvents.shift();
      if (ev.type === 'open_cylinder') {
        reloadAnim.shells = [];
        reloadAnim.inserts = [];
        reloadAnim.joltX = 0;
        reloadAnim.joltY = 3;
        reloadAnim.cylVel = 0.5;
        const slots = ev.ejectedSlots || [];
        for (let i = 0; i < slots.length; i++) {
          const sIdx = slots[i];
          const pos = getChamberCenter(sIdx, 1, reloadAnim.cylAngle);
          reloadAnim.shells.push({
            x: pos.x,
            y: pos.y,
            vx: G.MATH.rand(-26, 30),
            vy: G.MATH.rand(-36, -14),
            rot: G.MATH.rand(-0.8, 0.8),
            vrot: G.MATH.rand(-8, 8),
            delay: i * 0.032,
            life: 1.4
          });
        }
      } else if (ev.type === 'insert_cylinder') {
        const pos = getChamberCenter(ev.slotIdx, 1, reloadAnim.cylAngle);
        // Вставка патрона под углом ~32 градуса
        const ang = 32 * (Math.PI / 180);
        const dist = 32;
        reloadAnim.inserts.push({
          kind: 'cylinder',
          slotIdx: ev.slotIdx,
          startX: pos.x - Math.sin(ang) * dist,
          startY: pos.y - Math.cos(ang) * dist,
          endX: pos.x,
          endY: pos.y,
          t: 0,
          dur: 0.16
        });
        reloadAnim.joltX = -1.2;
        reloadAnim.joltY = 2.0;
      } else if (ev.type === 'open_tube') {
        reloadAnim.shells = [];
        reloadAnim.inserts = [];
        reloadAnim.gatePress = 0;
      } else if (ev.type === 'insert_tube') {
        // Патрон подаётся сверху и уходит в верхнее окно ствольной коробки
        reloadAnim.inserts.push({
          kind: 'tube',
          startX: 64,
          startY: 0,
          endX: 64,
          endY: 0,
          t: 0,
          dur: 0.22
        });
        reloadAnim.gatePress = 1.0;
        reloadAnim.joltY = 1.6;
      } else if (ev.type === 'close') {
        reloadAnim.hoverSlot = -1;
        reloadAnim.inserts = [];
        reloadAnim.pressFlash = null;
      }
    }
  }

  function updateReloadAnim(dt) {
    processReloadEvents();
    reloadAnim.joltX *= Math.exp(-16 * dt);
    reloadAnim.joltY *= Math.exp(-16 * dt);
    if (reloadAnim.gatePress > 0) {
      reloadAnim.gatePress = Math.max(0, reloadAnim.gatePress - dt * 5.2);
    }
    if (reloadAnim.cylVel) {
      reloadAnim.cylAngle += reloadAnim.cylVel * dt;
      reloadAnim.cylVel *= Math.exp(-20 * dt);
    }
    if (reloadAnim.pressFlash) {
      reloadAnim.pressFlash.timer = Math.max(0, reloadAnim.pressFlash.timer - dt);
      if (reloadAnim.pressFlash.timer <= 0) reloadAnim.pressFlash = null;
    }

    for (let i = reloadAnim.shells.length - 1; i >= 0; i--) {
      const sh = reloadAnim.shells[i];
      if (sh.delay > 0) {
        sh.delay -= dt;
        continue;
      }
      sh.life -= dt;
      sh.vy += 390 * dt;
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.rot += sh.vrot * dt;
      if (sh.life <= 0 || sh.y > RELOAD_H + 14) {
        reloadAnim.shells.splice(i, 1);
      }
    }

    for (let i = reloadAnim.inserts.length - 1; i >= 0; i--) {
      const ins = reloadAnim.inserts[i];
      ins.t += dt;
      if (ins.t >= ins.dur) {
        if (ins.kind === 'cylinder') {
          reloadAnim.pressFlash = { x: ins.endX, y: ins.endY, timer: 0.08 };
          reloadAnim.cylVel = (reloadAnim.cylVel || 0) + 0.16;
        }
        reloadAnim.inserts.splice(i, 1);
      }
    }
  }

  function drawReloadWidget() {
    if (!rctx) return;
    const w = G.SIM.getWeapon(state);
    const ws = G.SIM.getWState(state);
    if (!ws.reloading) return;

    const caches = initReloadCaches();
    const P = getPal();
    const openFrac = G.MATH.clamp(ws.reloadOpenFrac || 0, 0, 1);

    // Полностью прозрачный фон
    rctx.clearRect(0, 0, RELOAD_W, RELOAD_H);

    if (w.uiShape === 'cylinder') {
      G.SIM.ensureChambers(w, ws);
      const isLight = w.id === 'walker';
      const cylImg = isLight ? caches.walkerCyl : caches.lightningCyl;
      const frameImg = isLight ? caches.walkerFrame : caches.lightningFrame;
      const emptyImg = isLight ? caches.walkerEmpty : caches.lightningEmpty;
      const cx = Math.round(CYL_CX + reloadAnim.joltX);
      const cy = Math.round(G.MATH.lerp(RELOAD_H + 18, CYL_CY, openFrac) + reloadAnim.joltY);

      // 1. Падающая тень под барабаном и сам откинутый барабан по центру
      rctx.fillStyle = 'rgba(18, 12, 8, 0.38)';
      rctx.beginPath();
      rctx.ellipse(cx + 2, cy + 3, 30, 28, 0.25, 0, Math.PI * 2);
      rctx.fill();
      rctx.drawImage(cylImg, cx - 32, cy - 32);

      const flyingSlots = {};
      for (let i = 0; i < reloadAnim.inserts.length; i++) {
        const ins = reloadAnim.inserts[i];
        if (ins.kind === 'cylinder') flyingSlots[ins.slotIdx] = true;
      }

      // 3. Все 6 круглых камор барабана (кликабельны и открыты)
      for (let i = 0; i < 6; i++) {
        const pos = getChamberCenter(i, openFrac, reloadAnim.cylAngle);
        const px = Math.round(pos.x);
        const py = Math.round(pos.y);
        const st = ws.chambers[i];
        const isHovered = reloadAnim.hoverSlot === i && st === 'empty';

        if (st === 'live' && !flyingSlots[i]) {
          rctx.drawImage(caches.liveRound, px - 7, py - 7);
        } else if (st === 'spent') {
          rctx.drawImage(caches.spentRound, px - 7, py - 7);
        } else {
          rctx.drawImage(emptyImg, px - 7, py - 7);
          if (isHovered) {
            // Пиксельное выделение каморы при наведении
            rctx.fillStyle = P.brass[0];
            rctx.fillRect(px - 6, py - 2, 1, 4);
            rctx.fillRect(px + 5, py - 2, 1, 4);
            rctx.fillRect(px - 2, py - 6, 4, 1);
            rctx.fillRect(px - 2, py + 5, 4, 1);
          }
        }
      }

      // 4. Падающие гильзы
      for (let i = 0; i < reloadAnim.shells.length; i++) {
        const sh = reloadAnim.shells[i];
        if (sh.delay > 0) continue;
        rctx.save();
        rctx.translate(Math.round(sh.x), Math.round(sh.y));
        rctx.rotate(sh.rot);
        rctx.drawImage(caches.fallingShell, -7, -3.5);
        rctx.restore();
      }

      // 5. Вставка патрона под углом 30-35 градусов
      for (let i = 0; i < reloadAnim.inserts.length; i++) {
        const ins = reloadAnim.inserts[i];
        if (ins.kind !== 'cylinder') continue;
        const p = G.MATH.clamp(ins.t / ins.dur, 0, 1);
        const ease = 1 - Math.pow(1 - p, 2);
        const ix = Math.round(G.MATH.lerp(ins.startX, ins.endX, ease));
        const iy = Math.round(G.MATH.lerp(ins.startY, ins.endY, ease));
        const rot = (1 - ease) * -0.55; // поворот из наклона в плоскость каморы
        rctx.save();
        rctx.translate(ix, iy);
        rctx.rotate(rot);
        rctx.drawImage(caches.angledCartridge, -9, -9);
        rctx.restore();
      }

      // 6. Вспышка-щелчок при досыле патрона
      if (reloadAnim.pressFlash) {
        const fx = Math.round(reloadAnim.pressFlash.x);
        const fy = Math.round(reloadAnim.pressFlash.y);
        rctx.fillStyle = '#ffffff';
        rctx.fillRect(fx - 1, fy - 1, 2, 2);
        rctx.fillStyle = P.brass[0];
        rctx.fillRect(fx - 3, fy, 6, 1);
        rctx.fillRect(fx, fy - 3, 1, 6);
      }
      return;
    }

    // ==================== ВИНЧЕСТЕР 1873: УЗЕЛ ПЕРЕЗАРЯДКИ ====================
    const fY = Math.round(G.MATH.lerp(24, 0, openFrac) + reloadAnim.joltY);

    // 1. Патрон залетает сбоку-сверху под углом ~38° и уходит в окно коробки
    for (let i = 0; i < reloadAnim.inserts.length; i++) {
      const ins = reloadAnim.inserts[i];
      if (ins.kind !== 'tube') continue;
      const p = G.MATH.clamp(ins.t / ins.dur, 0, 1);
      const ease = 1 - Math.pow(1 - p, 2);
      if (p < 0.72) {
        // Наклонная фаза: летит по диагонали к окну
        const k = p / 0.72;
        const ix = Math.round(G.MATH.lerp(104, 66, k));
        const iy = Math.round(G.MATH.lerp(fY - 8, fY + 32, k));
        rctx.drawImage(caches.angledRifle, ix - 12, iy - 12);
      } else {
        // Доворот по оси коробки и уход внутрь
        const k = (p - 0.72) / 0.28;
        const iy = Math.round(G.MATH.lerp(fY + 26, fY + 50, k));
        rctx.drawImage(caches.topCartridge, 60, iy);
      }
    }

    // 2. Запечённый фрагмент узла: коробка, окно, боковая крышка, скоба, цевьё, ствол
    rctx.drawImage(caches.winchesterReceiver, 0, fY);

    // 3. Крышка окна закрывается после досыла патрона
    const gateDip = Math.round(reloadAnim.gatePress * 3);
    rctx.fillStyle = P.brass[2];
    rctx.fillRect(50, fY + 34 + gateDip, 30, 3);
    rctx.fillStyle = P.brass[0];
    rctx.fillRect(50, fY + 34 + gateDip, 30, 1);
    rctx.fillStyle = P.outline || '#140f0c';
    rctx.fillRect(50, fY + 37 + gateDip, 30, 1);

    // 4. Подсказка «сюда вставлять» — только целыми пикселями, без сглаженных линий
    if (ws.ammo < w.capacity) {
      const pulse = 0.45 + 0.4 * Math.sin(state.time * 5);
      rctx.fillStyle = `rgba(242, 218, 145, ${pulse})`;
      rctx.fillRect(52, fY + 30, 1, 3);
      rctx.fillRect(77, fY + 30, 1, 3);
      rctx.fillRect(52, fY + 30, 26, 1);
    }
  }

  function getReloadCanvasLocalPos(e) {
    const rect = ui.reloadCanvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * RELOAD_W,
      y: ((e.clientY - rect.top) / rect.height) * RELOAD_H
    };
  }

  function hitTestChamber(lx, ly, openFrac) {
    let best = -1;
    let bestD = CHAMBER_R + 3.2;
    for (let i = 0; i < 6; i++) {
      const pos = getChamberCenter(i, openFrac, reloadAnim.cylAngle);
      const d = Math.hypot(lx - pos.x, ly - pos.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  // ==================== МАСШТАБ И КООРДИНАТЫ ====================

  function getZoom() {
    return G.CFG.pixelZoom || G.CFG.zoom || 2.0;
  }

  function resize() {
    const zoom = getZoom();
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = viewW;
    canvas.height = viewH;
    ctx.imageSmoothingEnabled = false;

    pixW = Math.ceil(viewW / zoom);
    pixH = Math.ceil(viewH / zoom);
    pixCanvas.width = pixW;
    pixCanvas.height = pixH;
    pctx.imageSmoothingEnabled = false;

    vignetteCanvas.width = Math.max(1, viewW);
    vignetteCanvas.height = Math.max(1, viewH);
    if (vctx) {
      vctx.clearRect(0, 0, vignetteCanvas.width, vignetteCanvas.height);
      const grad = vctx.createRadialGradient(
        viewW * 0.5, viewH * 0.5, Math.min(viewW, viewH) * 0.34,
        viewW * 0.5, viewH * 0.5, Math.max(viewW, viewH) * 0.72
      );
      grad.addColorStop(0, 'rgba(255, 232, 185, 0.0)');
      grad.addColorStop(1, 'rgba(24, 16, 11, 0.28)');
      vctx.fillStyle = grad;
      vctx.fillRect(0, 0, viewW, viewH);
    }
  }

  function getCamOrigin() {
    let swayX = 0;
    let swayY = 0;
    const p = state && state.player;
    if (p && !p.dead) {
      const conc = Math.max(p.critical ? 0.8 : 0, p.concussion || 0);
      if (conc > 0.08) {
        swayX = Math.sin(state.time * 2.4) * 2.6 * conc;
        swayY = Math.cos(state.time * 1.9) * 1.9 * conc;
      }
    }
    const cX = Math.round(state.camera.x + state.camera.shakeX + swayX);
    const cY = Math.round(state.camera.y + state.camera.shakeY + swayY);
    return {
      x: cX - Math.floor(pixW * 0.5),
      y: cY - Math.floor(pixH * 0.5)
    };
  }

  function screenToWorld(sx, sy) {
    const zoom = getZoom();
    const org = getCamOrigin();
    return {
      x: sx / zoom + org.x,
      y: sy / zoom + org.y
    };
  }

  function worldToScreen(wx, wy) {
    const zoom = getZoom();
    const org = getCamOrigin();
    return {
      x: (wx - org.x) * zoom,
      y: (wy - org.y) * zoom
    };
  }

  function isPointerOverUI(target) {
    return !!(
      target &&
      target.closest &&
      target.closest('#hud-top-right, #editor-panel, #reload-panel, #hud-bottom-left, #hud-bottom, #hat-menu')
    );
  }

  function refreshKeybindLabels() {
    ui.bindBtns.forEach((btn) => {
      const act = btn.dataset.action;
      const listening = state.input.rebindingAction === act;
      btn.classList.toggle('listening', listening);
      btn.textContent = listening ? 'НАЖМИ КЛАВИШУ...' : G.keyLabel(G.CFG.keys[act]);
    });

    const cockLbl = G.keyLabel(G.CFG.keys.cock);
    const coverLbl = G.keyLabel(G.CFG.keys.cover);
    const rollLbl = G.keyLabel(G.CFG.keys.roll);
    const intLbl = G.keyLabel(G.CFG.keys.interact);
    const bandLbl = G.keyLabel(G.CFG.keys.bandage || 'KeyQ');
    const moveAct = coverLbl === rollLbl
      ? `${coverLbl} укр/перекат`
      : `${coverLbl} укр • ${rollLbl} перекат`;
    if (ui.controlsLegend) {
      ui.controlsLegend.textContent =
        `WASD • ЛКМ огонь • ПКМ фокус • ${cockLbl} взвод • ${moveAct} • ${intLbl} действие • ${bandLbl} бинты • R зарядка`;
    }
  }

  function updateSpawnButton() {
    if (!ui.btnToggleSpawn) return;
    ui.btnToggleSpawn.textContent = G.CFG.pauseSpawn ? 'Спавн ботов: СТОП' : 'Спавн ботов: ИДЁТ';
    ui.btnToggleSpawn.classList.toggle('btn-warn', !!G.CFG.pauseSpawn);
  }

  function updateWavesButton() {
    if (!ui.btnToggleWaves) return;
    const active = !!(state && state.waves && state.waves.active);
    ui.btnToggleWaves.textContent = active ? 'Остановить волны' : 'Запустить волны';
    ui.btnToggleWaves.classList.toggle('btn-warn', active);
  }

  function updateGodModeButton() {
    if (!ui.btnToggleGodMode) return;
    const on = !!(G.CFG && G.CFG.godMode);
    ui.btnToggleGodMode.textContent = `Бессмертие: ${on ? 'ВКЛ' : 'ВЫКЛ'}`;
    ui.btnToggleGodMode.classList.toggle('active', on);
  }

  // Приводим элементы настроек к значениям из G.CFG (после загрузки из localStorage)
  function syncSettingsUI() {
    if (ui.slInertia && ui.valInertia) {
      ui.slInertia.value = G.CFG.phys.inertia;
      ui.valInertia.textContent = G.CFG.phys.inertia.toFixed(2);
    }
    if (ui.slRecoil && ui.valRecoil) {
      ui.slRecoil.value = G.CFG.phys.recoil;
      ui.valRecoil.textContent = G.CFG.phys.recoil.toFixed(2);
    }
    if (ui.slSpring && ui.valSpring) {
      ui.slSpring.value = G.CFG.phys.spring;
      ui.valSpring.textContent = G.CFG.phys.spring.toFixed(2);
    }
    if (ui.slEcho && ui.valEcho) {
      ui.slEcho.value = G.CFG.phys.echo;
      ui.valEcho.textContent = G.CFG.phys.echo.toFixed(2);
    }
    if (ui.slAccuracy && ui.valAccuracy) {
      ui.slAccuracy.value = G.CFG.botAccuracy;
      ui.valAccuracy.textContent = `${Math.round(G.CFG.botAccuracy * 100)}%`;
    }
    if (ui.slBotCap && ui.valBotCap) {
      const cap = G.CFG.botMaxAlive !== undefined ? G.CFG.botMaxAlive : 5;
      ui.slBotCap.value = cap;
      ui.valBotCap.textContent = `${cap}`;
    }
    if (ui.slBotInterval && ui.valBotInterval) {
      const sec = Math.round(G.CFG.botSpawnInterval !== undefined ? G.CFG.botSpawnInterval : 12);
      ui.slBotInterval.value = sec;
      ui.valBotInterval.textContent = `${sec}с`;
    }
    updateSpawnButton();
    updateWavesButton();
    updateDiffButtons();
    updateGodModeButton();
  }

  function updateDiffButtons() {
    const diff = G.CFG.botDifficulty || 'hard';
    if (ui.btnDiffEasy) ui.btnDiffEasy.classList.toggle('active', diff === 'easy');
    if (ui.btnDiffMedium) ui.btnDiffMedium.classList.toggle('active', diff === 'medium');
    if (ui.btnDiffHard) ui.btnDiffHard.classList.toggle('active', diff === 'hard');
  }

  function getEditorTpl(type) {
    const pal = G.EDITOR_PALETTE || [];
    for (let i = 0; i < pal.length; i++) {
      if (pal[i].type === type) return pal[i];
    }
    return pal[0] || { category: 'objects', kind: 'solid', type: 'crate', label: 'Ящик', w: 34, h: 32, mat: 'wood', high: false, rotatable: false };
  }

  function getEditorPlaceBox() {
    const ed = state && state.editor;
    if (!ed) return null;
    const tpl = getEditorTpl(ed.selectedType);
    const rot = !!(ed.rotated && tpl.rotatable);
    const w = rot ? tpl.h : tpl.w;
    const h = rot ? tpl.w : tpl.h;
    const wm = screenToWorld(state.input.mouseX, state.input.mouseY);
    const step = ed.gridStep || 8;
    const x = G.MATH.clamp(Math.round((wm.x - w * 0.5) / step) * step, 8, world.width - w - 8);
    const y = G.MATH.clamp(Math.round((wm.y - h * 0.5) / step) * step, 8, world.height - h - 8);
    return { tpl, x, y, cx: Math.round(x + w * 0.5), cy: Math.round(y + h * 0.5), w, h, wm };
  }

  function buildEditorPaletteDOM() {
    if (!ui.editorPalette) return;
    ui.editorPalette.innerHTML = '';
    const pal = G.EDITOR_PALETTE || [];
    const activeTab = (state && state.editor && state.editor.tab) || 'objects';
    lastEditorTab = activeTab;
    let firstInTab = null;
    let hasSelected = false;
    for (let i = 0; i < pal.length; i++) {
      const item = pal[i];
      if ((item.category || 'objects') !== activeTab) continue;
      if (!firstInTab) firstInTab = item;
      if (state && state.editor && state.editor.selectedType === item.type) hasSelected = true;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'editor-item';
      btn.dataset.type = item.type;
      const lblSpan = document.createElement('span');
      lblSpan.textContent = item.label;
      const szSpan = document.createElement('span');
      szSpan.className = 'editor-item-size';
      szSpan.textContent = item.category === 'npc' ? 'NPC' : `${item.w}×${item.h}`;
      btn.appendChild(lblSpan);
      btn.appendChild(szSpan);
      btn.addEventListener('click', () => {
        if (!state || !state.editor) return;
        state.editor.selectedType = item.type;
        state.editor.tool = 'place';
        lastEditorKey = '';
      });
      ui.editorPalette.appendChild(btn);
    }
    if (state && state.editor && !hasSelected && firstInTab) {
      state.editor.selectedType = firstInTab.type;
    }
  }

  function bindEvents() {
    window.addEventListener('resize', resize);

    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      state.input.mouseX = e.clientX;
      state.input.mouseY = e.clientY;
    });

    function isClientNet() {
      return !!(state && state.netRole === 'client' && G.NET);
    }

    function isTypingTarget(target) {
      if (!target) return false;
      const tag = (target.tagName || '').toUpperCase();
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!target.isContentEditable;
    }

    function copyTextToClipboard(text, okMsg, fallbackMsg) {
      if (!text) return;
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          () => G.SIM.showToast(state, okMsg, 1.5),
          () => G.SIM.showToast(state, fallbackMsg, 1.5)
        );
      } else {
        G.SIM.showToast(state, fallbackMsg, 1.5);
      }
    }

    function dispatchClientKeyAction(code) {
      if (!G.NET) return;
      if (code === 'Escape') {
        if (state.hatMenuOpen) {
          state.hatMenuOpen = false;
          return;
        }
        if (ui.networkPanel && !ui.networkPanel.classList.contains('hidden')) {
          ui.networkPanel.classList.add('hidden');
          return;
        }
        G.NET.sendClientCommand('action', { code: '__act:escape' });
        return;
      }
      if (code === 'KeyV') {
        G.CFG.debugRays = !G.CFG.debugRays;
        G.SIM.showToast(state, G.CFG.debugRays ? 'ЛУЧИ ЭХА: ВКЛ' : 'ЛУЧИ ЭХА: ВЫКЛ', 0.9);
        return;
      }
      if (code === 'Digit1') { G.NET.sendClientCommand('action', { code: '__act:weapon_0' }); return; }
      if (code === 'Digit2') { G.NET.sendClientCommand('action', { code: '__act:weapon_1' }); return; }
      if (code === 'Digit3') { G.NET.sendClientCommand('action', { code: '__act:weapon_2' }); return; }
      if (code === 'KeyR') { G.NET.sendClientCommand('action', { code: '__act:reload' }); return; }

      if (G.matchesKey('interact', code)) {
        const lp = G.SIM.resolvePlayer ? G.SIM.resolvePlayer(state) : state.player;
        if (lp && lp.nearInteractable && lp.nearInteractable.kind === 'hatrack') {
          state.hatMenuOpen = !state.hatMenuOpen;
          if (state.hatMenuOpen && G.AUDIO.playHatEquip) G.AUDIO.playHatEquip();
        } else {
          G.NET.sendClientCommand('action', { code: '__act:interact' });
        }
        return;
      }
      if (G.matchesKey('bandage', code) || code === 'KeyQ') {
        G.NET.sendClientCommand('action', { code: '__act:bandage' });
        return;
      }
      if (G.matchesKey('cock', code)) {
        G.NET.sendClientCommand('action', { code: '__act:cock' });
      }
      const isCov = G.matchesKey('cover', code);
      const isRol = G.matchesKey('roll', code);
      if (isCov && isRol) {
        G.NET.sendClientInputIfNeeded(state, true);
        G.NET.sendClientCommand('action', { code: '__act:cover_roll' });
      } else if (isCov) {
        G.NET.sendClientCommand('action', { code: '__act:cover' });
      } else if (isRol) {
        G.NET.sendClientInputIfNeeded(state, true);
        G.NET.sendClientCommand('action', { code: '__act:roll' });
      }
    }

    window.addEventListener('mousedown', (e) => {
      G.AUDIO.unlock();
      if (isPointerOverUI(e.target)) return;

      // Обработка кликов в режиме Редактора уровня (только оффлайн или хост)
      if (state.editor && state.editor.active) {
        if (isClientNet()) {
          G.SIM.toggleEditorMode(state, world, false);
          return;
        }
        const wm = screenToWorld(e.clientX, e.clientY);
        if (e.button === 2 || state.editor.tool === 'erase') {
          const hit = world.findEditorEntityAt ? world.findEditorEntityAt(wm.x, wm.y) : null;
          if (hit && world.removeEditorEntity && world.removeEditorEntity(hit, state)) {
            if (G.NET && G.NET.broadcastMapSync) G.NET.broadcastMapSync(state, world);
            G.SIM.showToast(state, `УДАЛЕНО: ${String(hit.label || hit.kind).toUpperCase()}`, 0.9);
          }
          return;
        }
        if (e.button === 0 && state.editor.tool === 'place') {
          const box = getEditorPlaceBox();
          if (box) {
            const knd = box.tpl.kind || 'solid';
            let placed = false;
            if (knd === 'solid' && world.addEditorSolid) {
              world.addEditorSolid({
                x: box.x,
                y: box.y,
                w: box.w,
                h: box.h,
                mat: box.tpl.mat,
                type: box.tpl.type,
                high: box.tpl.high,
                isCover: true,
                isHitchingPost: !!box.tpl.isHitchingPost,
                interior: !!box.tpl.interior
              });
              placed = true;
            } else if (knd === 'tree' && world.addEditorTree) {
              world.addEditorTree(box.cx, box.cy, box.tpl.r || 22);
              placed = true;
            } else if (knd === 'pole' && world.addEditorPole) {
              world.addEditorPole(box.cx, box.cy);
              placed = true;
            } else if (knd === 'bottle' && world.addEditorBottle) {
              world.addEditorBottle(box.cx, box.cy);
              placed = true;
            } else if (knd === 'bandit' && world.addEditorBandit) {
              world.addEditorBandit(box.cx, box.cy, box.tpl);
              placed = true;
            } else if (knd === 'horse' && world.placeEditorHorse) {
              world.placeEditorHorse(box.cx, box.cy, state);
              placed = true;
            } else if (knd === 'sheep' && world.addEditorSheep) {
              world.addEditorSheep(box.cx, box.cy);
              placed = true;
            }
            if (placed) {
              if (G.NET && G.NET.broadcastMapSync) G.NET.broadcastMapSync(state, world);
              G.SIM.showToast(state, `ДОБАВЛЕНО: ${box.tpl.label.toUpperCase()}`, 0.8);
            }
          }
          return;
        }
        return;
      }

      if (e.button === 0) {
        state.input.lmb = true;
        if (isClientNet()) {
          G.NET.sendClientInputIfNeeded(state, true);
          G.NET.sendClientCommand('fire');
        } else {
          G.SIM.tryFire(state, world);
        }
      } else if (e.button === 2) {
        state.input.rmb = true;
        const ws = G.SIM.getWState(state);
        if (isClientNet()) {
          G.NET.sendClientInputIfNeeded(state, true);
          if (ws && ws.reloading) G.NET.sendClientCommand('close_reload');
        } else if (ws.reloading) {
          G.SIM.closeReload(state);
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) state.input.lmb = false;
      if (e.button === 2) state.input.rmb = false;
    });

    window.addEventListener('blur', () => {
      state.input.keys = {};
      state.input.lmb = false;
      state.input.rmb = false;
    });

    window.addEventListener('wheel', (e) => {
      if (isPointerOverUI(e.target)) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      const next = (state.player.weaponIdx + dir + G.WEAPONS.length) % G.WEAPONS.length;
      if (isClientNet()) {
        G.NET.sendClientCommand('switch_weapon', { idx: next });
      } else {
        G.SIM.switchWeapon(state, next);
      }
    }, { passive: true });

    window.addEventListener('keydown', (e) => {
      G.AUDIO.unlock();

      if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) {
        if (e.code === 'Escape' && document.activeElement && document.activeElement.blur) {
          document.activeElement.blur();
        }
        return;
      }

      if (state.input.rebindingAction) {
        e.preventDefault();
        if (e.code !== 'Escape') {
          G.CFG.keys[state.input.rebindingAction] = e.code;
          G.saveKeys();
        }
        state.input.rebindingAction = null;
        refreshKeybindLabels();
        return;
      }

      if (e.code === 'Space' || e.code.startsWith('Arrow')) {
        e.preventDefault();
      }

      if (!state.input.keys[e.code]) {
        state.input.keys[e.code] = true;
        if (isClientNet()) {
          dispatchClientKeyAction(e.code);
        } else {
          G.SIM.handleKeyDown(state, world, e.code);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      state.input.keys[e.code] = false;
    });

    if (ui.reloadCanvas) {
      ui.reloadCanvas.addEventListener('mousemove', (e) => {
        const w = G.SIM.getWeapon(state);
        const ws = G.SIM.getWState(state);
        if (!ws.reloading || w.uiShape !== 'cylinder') {
          reloadAnim.hoverSlot = -1;
          return;
        }
        const pt = getReloadCanvasLocalPos(e);
        reloadAnim.hoverSlot = hitTestChamber(pt.x, pt.y, ws.reloadOpenFrac || 1);
      });

      ui.reloadCanvas.addEventListener('mouseleave', () => {
        reloadAnim.hoverSlot = -1;
      });

      ui.reloadCanvas.addEventListener('mousedown', (e) => {
        if (e.button === 2) {
          if (isClientNet()) G.NET.sendClientCommand('close_reload');
          else G.SIM.closeReload(state);
          return;
        }
        if (e.button !== 0) return;
        G.AUDIO.unlock();
        const w = G.SIM.getWeapon(state);
        const ws = G.SIM.getWState(state);
        if (!ws.reloading) return;

        if (w.uiShape === 'cylinder') {
          const pt = getReloadCanvasLocalPos(e);
          const idx = hitTestChamber(pt.x, pt.y, ws.reloadOpenFrac || 1);
          const targetIdx = idx !== -1 ? idx : undefined;
          if (isClientNet()) G.NET.sendClientCommand('insert_round', { chamberIdx: targetIdx });
          else G.SIM.insertOneRound(state, world, targetIdx);
        } else {
          if (isClientNet()) G.NET.sendClientCommand('insert_round', {});
          else G.SIM.insertOneRound(state, world);
        }
      });
    }

    if (ui.btnSettings) {
      ui.btnSettings.addEventListener('click', () => {
        ui.settingsPanel.classList.toggle('hidden');
        if (!ui.settingsPanel.classList.contains('hidden') && ui.networkPanel) {
          ui.networkPanel.classList.add('hidden');
        }
        state.input.rebindingAction = null;
        refreshKeybindLabels();
      });
    }

    function bindSlider(el, valEl, key) {
      if (!el || !valEl) return;
      el.addEventListener('input', () => {
        const v = parseFloat(el.value);
        G.CFG.phys[key] = v;
        valEl.textContent = v.toFixed(2);
        G.saveSettings();
      });
    }
    bindSlider(ui.slInertia, ui.valInertia, 'inertia');
    bindSlider(ui.slRecoil, ui.valRecoil, 'recoil');
    bindSlider(ui.slSpring, ui.valSpring, 'spring');
    bindSlider(ui.slEcho, ui.valEcho, 'echo');

    // Кнопки сложности AI ботов (Лёгкий / Средний / Тяжёлый)
    [
      [ui.btnDiffEasy, 'easy'],
      [ui.btnDiffMedium, 'medium'],
      [ui.btnDiffHard, 'hard']
    ].forEach(([btn, diffId]) => {
      if (!btn) return;
      btn.addEventListener('click', () => {
        G.CFG.botDifficulty = diffId;
        updateDiffButtons();
        G.saveSettings();
        const prof = G.getBotDiffProfile ? G.getBotDiffProfile() : null;
        G.SIM.showToast(state, `СЛОЖНОСТЬ AI: ${(prof ? prof.label : diffId).toUpperCase()}`, 1.2);
      });
    });

    // Ползунок меткости ботов: чем ниже, тем шире разброс их выстрелов
    if (ui.slAccuracy) {
      ui.slAccuracy.addEventListener('input', () => {
        G.CFG.botAccuracy = G.MATH.clamp(parseFloat(ui.slAccuracy.value), 0, 1);
        if (ui.valAccuracy) ui.valAccuracy.textContent = `${Math.round(G.CFG.botAccuracy * 100)}%`;
        G.saveSettings();
      });
    }

    // Ползунок максимума живых врагов (с немедленным применением на карте)
    if (ui.slBotCap) {
      ui.slBotCap.addEventListener('input', () => {
        G.CFG.botMaxAlive = Math.round(G.MATH.clamp(parseFloat(ui.slBotCap.value), 0, 15));
        if (ui.valBotCap) ui.valBotCap.textContent = `${G.CFG.botMaxAlive}`;
        if (world && world.enforceBotCap) world.enforceBotCap(state ? state.player : null);
        G.saveSettings();
      });
    }

    // Ползунок интервала спавна ботов (в секундах)
    if (ui.slBotInterval) {
      ui.slBotInterval.addEventListener('input', () => {
        G.CFG.botSpawnInterval = G.MATH.clamp(parseFloat(ui.slBotInterval.value), 3, 30);
        if (ui.valBotInterval) ui.valBotInterval.textContent = `${Math.round(G.CFG.botSpawnInterval)}с`;
        G.saveSettings();
      });
    }

    // Кнопка остановки спавна: существующие боты продолжают воевать
    if (ui.btnToggleSpawn) {
      ui.btnToggleSpawn.addEventListener('click', () => {
        G.CFG.pauseSpawn = !G.CFG.pauseSpawn;
        updateSpawnButton();
        G.saveSettings();
        G.SIM.showToast(state, G.CFG.pauseSpawn ? 'СПАВН ОСТАНОВЛЕН' : 'СПАВН ВОЗОБНОВЛЁН', 1.1);
      });
    }

    // Единоразовый ручной респавн врагов
    if (ui.btnRespawnEnemies) {
      ui.btnRespawnEnemies.addEventListener('click', () => {
        if (state && state.waves && state.waves.active && G.SIM.stopWaveMode) {
          G.SIM.stopWaveMode(state);
        }
        if (world && world.respawnBanditsManual) {
          world.respawnBanditsManual(state.player, state);
        }
        updateWavesButton();
        G.SIM.showToast(state, 'ВРАГИ ВОЗРОЖДЕНЫ', 1.2);
      });
    }

    // Запуск / остановка режима волн
    if (ui.btnToggleWaves) {
      ui.btnToggleWaves.addEventListener('click', () => {
        if (state && state.waves && state.waves.active) {
          G.SIM.stopWaveMode(state);
        } else {
          G.SIM.startWaveMode(state, world);
        }
        updateWavesButton();
      });
    }

    // Закрытие меню выбора шляп
    if (ui.btnCloseHats) {
      ui.btnCloseHats.addEventListener('click', () => {
        if (state) state.hatMenuOpen = false;
      });
    }

    ui.bindBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.action;
        state.input.rebindingAction = state.input.rebindingAction === act ? null : act;
        refreshKeybindLabels();
      });
    });

    if (ui.btnResetBinds) {
      ui.btnResetBinds.addEventListener('click', () => {
        G.resetKeys();
        state.input.rebindingAction = null;
        refreshKeybindLabels();
        G.SIM.showToast(state, 'КЛАВИШИ СБРОШЕНЫ', 0.9);
      });
    }

    if (ui.btnToggleRays) {
      ui.btnToggleRays.addEventListener('click', () => {
        G.CFG.debugRays = !G.CFG.debugRays;
        ui.btnToggleRays.textContent = `Лучи (V): ${G.CFG.debugRays ? 'ВКЛ' : 'ВЫКЛ'}`;
      });
    }

    if (ui.btnToggleBandits) {
      ui.btnToggleBandits.addEventListener('click', () => {
        G.CFG.spawnBandits = !G.CFG.spawnBandits;
        ui.btnToggleBandits.textContent = `Бандиты: ${G.CFG.spawnBandits ? 'ВКЛ' : 'ВЫКЛ'}`;
        G.saveSettings();
      });
    }

    if (ui.btnToggleStorm) {
      ui.btnToggleStorm.addEventListener('click', () => {
        if (state && state.dustStorm && state.dustStorm.active) {
          G.SIM.stopDustStorm(state);
          G.SIM.showToast(state, 'ПЫЛЬНАЯ БУРЯ ОСТАНОВЛЕНА', 1.1);
        } else {
          G.SIM.triggerDustStorm(state, world, 32);
        }
      });
    }

    if (ui.btnSpawnHorse) {
      ui.btnSpawnHorse.addEventListener('click', () => {
        if (!world || !world.spawnHorse) return;
        const plist = G.SIM && G.SIM.getPlayers ? G.SIM.getPlayers(state) : [state.player];
        world.spawnHorse(plist);
        G.SIM.showToast(state, 'ЛОШАДЬ У КОНОВЯЗИ', 1.3);
        updateHUD();
      });
    }

    if (ui.btnToggleGodMode) {
      ui.btnToggleGodMode.addEventListener('click', () => {
        G.CFG.godMode = !G.CFG.godMode;
        if (G.CFG.godMode && state && state.player) {
          const lp = state.player;
          lp.hp = lp.maxHp || 100;
          lp.critical = false;
          lp.bleeding = false;
          lp.dead = false;
          lp.stunTimer = 0;
        }
        updateGodModeButton();
        G.saveSettings();
        G.SIM.showToast(state, G.CFG.godMode ? 'БЕССМЕРТИЕ: ВКЛ' : 'БЕССМЕРТИЕ: ВЫКЛ', 1.2);
        updateHUD();
      });
    }

    if (ui.bandageSlot) {
      ui.bandageSlot.addEventListener('click', () => {
        G.AUDIO.unlock();
        if (isClientNet()) G.NET.sendClientCommand('bandage');
        else if (G.SIM.tryUseBandage) G.SIM.tryUseBandage(state);
      });
    }

    buildEditorPaletteDOM();
    if (ui.btnEditor) {
      ui.btnEditor.addEventListener('click', () => {
        if (isClientNet()) {
          G.SIM.showToast(state, 'РЕДАКТОР ДОСТУПЕН ТОЛЬКО ХОСТУ', 1.3);
          return;
        }
        if (G.SIM.toggleEditorMode) {
          G.SIM.toggleEditorMode(state, world);
          if (state.editor && state.editor.active) {
            if (ui.settingsPanel) ui.settingsPanel.classList.add('hidden');
            if (ui.networkPanel) ui.networkPanel.classList.add('hidden');
          }
          lastEditorKey = '';
        }
      });
    }
    if (ui.btnEditorPlace) {
      ui.btnEditorPlace.addEventListener('click', () => {
        if (state && state.editor) state.editor.tool = 'place';
        lastEditorKey = '';
      });
    }
    if (ui.btnEditorRotate) {
      ui.btnEditorRotate.addEventListener('click', () => {
        if (state && state.editor) state.editor.rotated = !state.editor.rotated;
        lastEditorKey = '';
      });
    }
    if (ui.btnEditorErase) {
      ui.btnEditorErase.addEventListener('click', () => {
        if (state && state.editor) state.editor.tool = 'erase';
        lastEditorKey = '';
      });
    }
    if (ui.btnEditorTabObjects) {
      ui.btnEditorTabObjects.addEventListener('click', () => {
        if (!state || !state.editor) return;
        state.editor.tab = 'objects';
        state.editor.tool = 'place';
        buildEditorPaletteDOM();
        lastEditorKey = '';
      });
    }
    if (ui.btnEditorTabNpc) {
      ui.btnEditorTabNpc.addEventListener('click', () => {
        if (!state || !state.editor) return;
        state.editor.tab = 'npc';
        state.editor.tool = 'place';
        buildEditorPaletteDOM();
        lastEditorKey = '';
      });
    }
    if (ui.btnEditorSave) {
      ui.btnEditorSave.addEventListener('click', () => {
        const ok = world && world.saveCustomMap ? world.saveCustomMap() : false;
        G.SIM.showToast(state, ok ? 'КАРТА СОХРАНЕНА В LOCALSTORAGE' : 'ОШИБКА СОХРАНЕНИЯ', 1.4);
      });
    }
    if (ui.btnEditorCopy) {
      ui.btnEditorCopy.addEventListener('click', () => {
        if (!world || !world.exportSolidsJSON) return;
        const json = world.exportSolidsJSON();
        G.lastExportedMapJson = json;
        copyTextToClipboard(json, 'JSON КАРТЫ СКОПИРОВАН В БУФЕР', 'JSON ПОДГОТОВЛЕН (G.lastExportedMapJson)');
      });
    }
    if (ui.btnEditorReset) {
      ui.btnEditorReset.addEventListener('click', () => {
        if (isClientNet()) return;
        if (world && world.resetCustomMap) {
          world.resetCustomMap(state);
          if (G.NET && G.NET.broadcastMapSync) G.NET.broadcastMapSync(state, world);
          G.SIM.showToast(state, 'КАРТА СБРОШЕНА К ИСХОДНОЙ', 1.4);
        }
      });
    }

    // ==================== СЕТЕВОЙ ЛОББИ UI (WEBRTC P2P) ====================

    if (ui.btnNetwork) {
      ui.btnNetwork.addEventListener('click', () => {
        if (!ui.networkPanel) return;
        ui.networkPanel.classList.toggle('hidden');
        if (!ui.networkPanel.classList.contains('hidden')) {
          if (ui.settingsPanel) ui.settingsPanel.classList.add('hidden');
          if (state.editor && state.editor.active && G.SIM.toggleEditorMode) {
            G.SIM.toggleEditorMode(state, world, false);
          }
          lastNetKey = '';
          updateNetUI();
        }
      });
    }

    if (ui.netName) {
      ui.netName.addEventListener('input', () => {
        const nm = ui.netName.value.slice(0, 18);
        if (G.NET && G.NET.updateLocalProfile) G.NET.updateLocalProfile(state, nm || 'СТРЕЛОК');
        else G.CFG.playerName = nm || 'СТРЕЛОК';
        lastNetKey = '';
      });
    }

    if (ui.btnNetMode) {
      ui.btnNetMode.addEventListener('click', () => {
        if (isClientNet()) return;
        const nextMode = state.mpMode === 'pvp' ? 'coop' : 'pvp';
        if (G.NET && G.NET.setRoomSettings) G.NET.setRoomSettings(state, { mpMode: nextMode });
        else state.mpMode = nextMode;
        lastNetKey = '';
        updateNetUI();
      });
    }

    if (ui.btnNetFf) {
      ui.btnNetFf.addEventListener('click', () => {
        if (isClientNet()) return;
        const nextFf = !state.friendlyFire;
        if (G.NET && G.NET.setRoomSettings) G.NET.setRoomSettings(state, { friendlyFire: nextFf });
        else state.friendlyFire = nextFf;
        lastNetKey = '';
        updateNetUI();
      });
    }

    if (ui.btnNetHost) {
      ui.btnNetHost.addEventListener('click', () => {
        if (!G.NET || !G.NET.hostRoom) return;
        G.NET.hostRoom(state, world, {
          mpMode: state.mpMode || 'coop',
          friendlyFire: !!state.friendlyFire
        }).then(() => {
          lastNetKey = '';
          lastEditorKey = '';
          updateNetUI();
        });
        lastNetKey = '';
        updateNetUI();
      });
    }

    if (ui.btnNetCopyRoom) {
      ui.btnNetCopyRoom.addEventListener('click', () => {
        const info = G.NET && G.NET.getStatusInfo ? G.NET.getStatusInfo(state) : null;
        if (info && info.roomCode) {
          copyTextToClipboard(info.roomCode, `КОД ${info.roomCode} СКОПИРОВАН`, `КОД: ${info.roomCode}`);
        }
      });
    }

    if (ui.btnNetJoin) {
      ui.btnNetJoin.addEventListener('click', () => {
        if (!G.NET || !G.NET.joinRoom) return;
        const code = ui.netJoinCode ? ui.netJoinCode.value : '';
        G.NET.joinRoom(state, world, code).then(() => {
          lastNetKey = '';
          lastEditorKey = '';
          updateNetUI();
        });
        lastNetKey = '';
        updateNetUI();
      });
    }

    if (ui.btnNetOffer) {
      ui.btnNetOffer.addEventListener('click', () => {
        if (!G.NET || !G.NET.createManualOffer) return;
        G.NET.createManualOffer(state, world, {
          mpMode: state.mpMode || 'coop',
          friendlyFire: !!state.friendlyFire
        }).then((res) => {
          if (ui.netManualCode && res && res.code) ui.netManualCode.value = res.code;
          lastNetKey = '';
          updateNetUI();
        }).catch((err) => {
          G.SIM.showToast(state, String((err && err.message) || 'ОШИБКА OFFER'), 1.8);
          lastNetKey = '';
          updateNetUI();
        });
      });
    }

    if (ui.btnNetAcceptOffer) {
      ui.btnNetAcceptOffer.addEventListener('click', () => {
        if (!G.NET || !G.NET.acceptManualOffer) return;
        const raw = ui.netManualCode ? ui.netManualCode.value : '';
        G.NET.acceptManualOffer(state, world, raw).then((res) => {
          if (ui.netManualCode && res && res.code) ui.netManualCode.value = res.code;
          lastNetKey = '';
          lastEditorKey = '';
          updateNetUI();
        }).catch((err) => {
          G.SIM.showToast(state, String((err && err.message) || 'ОШИБКА OFFER'), 1.8);
          lastNetKey = '';
          updateNetUI();
        });
      });
    }

    if (ui.btnNetApplyAnswer) {
      ui.btnNetApplyAnswer.addEventListener('click', () => {
        if (!G.NET || !G.NET.applyManualAnswer) return;
        const raw = ui.netManualCode ? ui.netManualCode.value : '';
        G.NET.applyManualAnswer(raw).then(() => {
          lastNetKey = '';
          updateNetUI();
        }).catch((err) => {
          G.SIM.showToast(state, String((err && err.message) || 'ОШИБКА ANSWER'), 1.8);
          lastNetKey = '';
          updateNetUI();
        });
      });
    }

    if (ui.btnNetCopyManual) {
      ui.btnNetCopyManual.addEventListener('click', () => {
        const txt = ui.netManualCode ? ui.netManualCode.value.trim() : '';
        if (txt) {
          copyTextToClipboard(txt, 'P2P КОД СКОПИРОВАН', 'ВЫДЕЛИ И СКОПИРУЙ ИЗ ПОЛЯ');
        }
      });
    }

    if (ui.btnNetDisconnect) {
      ui.btnNetDisconnect.addEventListener('click', () => {
        if (G.NET && G.NET.disconnect) G.NET.disconnect(state, world);
        if (ui.netManualCode) ui.netManualCode.value = '';
        lastNetKey = '';
        lastEditorKey = '';
        updateNetUI();
      });
    }

    ui.weaponSlots.forEach((slot) => {
      slot.addEventListener('click', () => {
        const idx = parseInt(slot.dataset.idx, 10);
        if (isClientNet()) G.NET.sendClientCommand('switch_weapon', { idx });
        else G.SIM.switchWeapon(state, idx);
      });
    });

    if (ui.btnInsertOne) {
      ui.btnInsertOne.addEventListener('click', () => {
        G.AUDIO.unlock();
        if (isClientNet()) G.NET.sendClientCommand('insert_round', {});
        else G.SIM.insertOneRound(state, world);
      });
    }
  }

  // ==================== ПОЛУДЕННЫЕ ТЕНИ И ЕСТЕСТВЕННЫЙ СВЕТ ====================

  function getShadowLength(s) {
    if (s.type === 'cliff') return 18;
    if (s.type === 'building') return 15;
    if (s.type === 'wall' || s.type === 'pillar') return 11;
    if (s.type === 'wagon') return 8;
    if (s.type === 'boulder') return 8;
    if (s.type === 'water_barrel') return 6;
    if (s.type === 'hay') return 7;
    if (s.type === 'trough') return 5;
    if (s.type === 'fence') return 9;
    if (s.type === 'hitching_post' || s.isHitchingPost) return 5;
    if (s.type === 'low_wall') return 5;
    return 6;
  }

  function drawNoonShadow(g, s) {
    const sal = (world && world.saloon) || { x: 24, y: 170, w: 440, h: 460 };
    const insideSaloon = s.x + s.w <= sal.x + sal.w + 2 && s.y >= sal.y && s.y + s.h <= sal.y + sal.h && s.type !== 'wall';
    const len = insideSaloon ? getShadowLength(s) * 0.45 : getShadowLength(s);
    const sx = Math.round(SUN.dx * len);
    const sy = Math.round(SUN.dy * len);

    g.fillStyle = insideSaloon ? 'rgba(18, 12, 8, 0.25)' : 'rgba(20, 14, 10, 0.36)';

    if (s.type === 'water_barrel' || s.type === 'boulder') {
      const cx = Math.round(s.x + s.w * 0.5);
      const cy = Math.round(s.y + s.h * 0.5);
      g.beginPath();
      g.ellipse(cx + Math.round(sx * 0.72), cy + Math.round(sy * 0.72), s.w * 0.48, s.h * 0.44, 0.3, 0, Math.PI * 2);
      g.fill();
      return;
    }

    const x1 = s.x;
    const y1 = s.y;
    const x2 = s.x + s.w;
    const y2 = s.y + s.h;

    g.beginPath();
    g.moveTo(x1, y2);
    g.lineTo(x1 + sx, y2 + sy);
    g.lineTo(x2 + sx, y2 + sy);
    g.lineTo(x2 + sx, y1 + sy);
    g.lineTo(x2, y1);
    g.lineTo(x2, y2);
    g.closePath();
    g.fill();
  }

  function makeRng(seed) {
    let s = (seed || 1) >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  let cloudCaches = null;

  // Скорость ветра облаков (px/s) — синхронизирует небо и отражения в бочках
  const CLOUD_WIND = 22;

  // Полупрозрачный цвет из палитры (без градиентов и размытия)
  function palRgba(hex, a) {
    const h = String(hex).replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g2 = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g2}, ${b}, ${a})`;
  }

  // Детерминированный хеш для рваных пиксельных краёв облачной тени
  function hashPix(ix, iy) {
    let n = (ix * 374761393 + iy * 668265263) ^ 0x5bf03635;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function initCloudCaches() {
    if (cloudCaches) return cloudCaches;

    // Цельный кучный силуэт облака из плотно перекрывающихся овальных «клубов» (без шума и оторванных пикселей)
    function bakeOneCloud(w, h, seed) {
      const { c, g } = makeOffscreen(w, h);
      const P0 = getPal();
      const coldBase = (P0.slateTeal && P0.slateTeal[4]) || '#152225';
      const cCore = palRgba(coldBase, 0.34);
      const cMid = palRgba(coldBase, 0.22);
      const cEdge = palRgba(coldBase, 0.11);
      const rng = makeRng(seed);
      const cell = 4;
      const cols = Math.floor(w / cell);
      const rows = Math.floor(h / cell);
      const grid = new Float32Array(cols * rows);

      // Единый плотный кластер из 7–9 перекрывающихся клубов вокруг центра масс
      const puffs = [{
        cx: cols * (0.48 + (rng() - 0.5) * 0.08),
        cy: rows * (0.50 + (rng() - 0.5) * 0.08),
        rx: cols * (0.24 + rng() * 0.06),
        ry: rows * (0.26 + rng() * 0.06)
      }];
      const extraCount = 6 + Math.floor(rng() * 3); // всего 7–9 клубов
      for (let i = 0; i < extraCount; i++) {
        const ang = (i / extraCount) * Math.PI * 2 + (rng() - 0.5) * 0.45;
        const distK = 0.38 + rng() * 0.45;
        puffs.push({
          cx: puffs[0].cx + Math.cos(ang) * cols * 0.22 * distK,
          cy: puffs[0].cy + Math.sin(ang) * rows * 0.20 * distK,
          rx: cols * (0.14 + rng() * 0.11),
          ry: rows * (0.17 + rng() * 0.12)
        });
      }

      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          let v = 0;
          for (let i = 0; i < puffs.length; i++) {
            const pf = puffs[i];
            const dx = (cx - pf.cx) / pf.rx;
            const dy = (cy - pf.cy) / pf.ry;
            const val = 1 - Math.sqrt(dx * dx + dy * dy);
            if (val > v) v = val;
          }
          // Небольшой сдвиг тени в сторону полуденного солнца (без шумовой россыпи)
          const slant = ((rows - cy) / rows) * (puffs[0].rx * 0.08);
          const shifted = v - (cx < puffs[0].cx - slant ? 0.04 : 0) - (cx > puffs[0].cx + slant ? 0.015 : 0);
          grid[cy * cols + cx] = shifted;
        }
      }

      // 3 чистых ступенчатых слоя с единой пиксельной сеткой cell×cell
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          const v = grid[cy * cols + cx];
          const px = cx * cell;
          const py = cy * cell;
          if (v > 0.40) {
            g.fillStyle = cCore;
            g.fillRect(px, py, cell, cell);
          } else if (v > 0.20) {
            g.fillStyle = cMid;
            g.fillRect(px, py, cell, cell);
          } else if (v > 0.04) {
            g.fillStyle = cEdge;
            g.fillRect(px, py, cell, cell);
          }
        }
      }

      return c;
    }

    cloudCaches = [
      bakeOneCloud(272, 144, 114),
      bakeOneCloud(348, 184, 227),
      bakeOneCloud(296, 156, 339)
    ];
    return cloudCaches;
  }

  function drawCloudShadows(g, org) {
    const caches = initCloudCaches();
    const period = world.width + 520;
    // Бег облаков по ветру, синхронизированный с рябью бочек
    const drift = state.time * CLOUD_WIND;
    // Тень смещается вдоль направления SUN — облака «плывут» под наклоном, а не строго по оси X
    const sunK = SUN.dy / Math.max(0.001, SUN.dx);

    const clouds = [
      { img: caches[0], x: ((drift * 1.0 + 90) % period) - 260,   y: 46 + Math.sin(state.time * 0.05) * 16 },
      { img: caches[1], x: ((drift * 1.15 + 580) % period) - 310,  y: 178 + Math.cos(state.time * 0.04) * 22 },
      { img: caches[2], x: ((drift * 0.9 + 1140) % period) - 270, y: 312 + Math.sin(state.time * 0.06) * 18 },
      { img: caches[1], x: ((drift * 1.05 + 1560) % period) - 320, y: 470 + Math.sin(state.time * 0.045) * 20 },
      { img: caches[0], x: ((drift * 0.95 + 300) % period) - 280, y: 596 + Math.cos(state.time * 0.05) * 16 }
    ];

    g.save();
    // Строго исключаем интерьер салуна (границы берём из данных мира, а не хардкодом)
    const sal = world.saloon || { x: 24, y: 70, w: 316, h: 380 };
    g.beginPath();
    g.rect(0, 0, world.width, sal.y);
    g.rect(0, sal.y + sal.h, world.width, Math.max(10, world.height - (sal.y + sal.h)));
    g.rect(sal.x + sal.w, sal.y, Math.max(10, world.width - (sal.x + sal.w)), sal.h);
    g.clip();

    for (let i = 0; i < clouds.length; i++) {
      const cl = clouds[i];
      const px = Math.round(cl.x);
      const py = Math.round(cl.y + (cl.x - world.width * 0.5) * 0.02 * sunK);
      if (org && !isInView(px, py, cl.img.width, cl.img.height, org, 16)) continue;
      g.drawImage(cl.img, px, py);
    }
    g.restore();
  }

  function drawSaloonDaylight(g) {
    // Все координаты привязаны строго к world.saloon и world.layout
    const lay = (world && world.layout) || null;
    const sal = (world && world.saloon) || (lay && lay.saloon) || { x: 24, y: 170, w: 440, h: 460 };
    const bx = sal.x;
    const by = sal.y;
    const rightIn = bx + sal.w - 16;
    const doorMidY = (lay && lay.doorCenterY) || (by + Math.round(sal.h * 0.5));

    // Прохладное затемнение интерьера
    g.fillStyle = 'rgba(20, 24, 32, 0.28)';
    g.fillRect(bx + 14, by + 14, sal.w - 30, sal.h - 28);

    // Честные ступенчатые пиксельные световые пятна от открытых распашных дверей
    g.fillStyle = 'rgba(242, 218, 145, 0.26)';
    g.fillRect(rightIn - 28, doorMidY - 38, 28, 76);
    g.fillStyle = 'rgba(242, 218, 145, 0.17)';
    g.fillRect(rightIn - 56, doorMidY - 46, 28, 92);
    g.fillStyle = 'rgba(242, 218, 145, 0.09)';
    g.fillRect(rightIn - 84, doorMidY - 54, 28, 108);

    // Световые пятна от правых окон салуна
    const win1Y = (lay && lay.win1Y) || (by + 72);
    const win2Y = (lay && lay.win2Y) || (by + sal.h - 100);
    const windowSpots = [win1Y, win2Y];
    windowSpots.forEach((wy) => {
      g.fillStyle = 'rgba(242, 218, 145, 0.22)';
      g.fillRect(rightIn - 40, wy - 4, 40, 32);
      g.fillStyle = 'rgba(242, 218, 145, 0.11)';
      g.fillRect(rightIn - 60, wy - 1, 20, 26);

      // Тени от оконного деревянного переплёта (крестовина)
      g.fillStyle = 'rgba(20, 24, 32, 0.24)';
      g.fillRect(rightIn - 46, wy + 11, 46, 2);
      g.fillRect(rightIn - 22, wy - 4, 2, 32);
    });
  }

  // ==================== ДЕКАЛИ И 2.5D-КРОВЬ ====================

  // Попиксельный круг/эллипс для эффектов дыма, луж и ступенчатого свечения (без arc)
  function drawPixelDisc(g, cx, cy, r) {
    const rad = Math.max(1, Math.round(r));
    const icx = Math.round(cx);
    const icy = Math.round(cy);
    for (let dy = -rad; dy <= rad; dy++) {
      const span = Math.floor(Math.sqrt(rad * rad - dy * dy));
      if (span >= 0) {
        g.fillRect(icx - span, icy + dy, span * 2 + 1, 1);
      }
    }
  }

  function drawDecals(g, org) {
    const P = getPal();
    for (let i = 0; i < state.decals.length; i++) {
      const dc = state.decals[i];
      const rad = dc.w ? Math.max(dc.w, dc.h || dc.w) : (dc.r || 6) * 2;
      if (org && !isInView(dc.x - rad, dc.y - rad, rad * 2, rad * 2, org, 24)) continue;
      if (dc.kind === 'blood') {
        g.save();
        g.translate(Math.round(dc.x), Math.round(dc.y));
        g.rotate(dc.angle || 0);
        const w = Math.max(2, Math.round(dc.r * (dc.stretch || 1.4)));
        const h = Math.max(2, Math.round(dc.r * 0.82));
        g.fillStyle = dc.color;
        g.fillRect(-Math.floor(w * 0.5), -Math.floor(h * 0.5), w, h);
        if (w >= 4) {
          g.fillRect(Math.floor(w * 0.35), -1, 2, 1);
        }
        g.restore();
      } else if (dc.kind === 'glasspool') {
        // Лужица разлитого напитка и пиксельные осколки стекла на месте бутылки
        const x = Math.round(dc.x);
        const y = Math.round(dc.y);
        g.fillStyle = dc.color;
        g.fillRect(x - 4, y - 1, 8, 3);
        g.fillRect(x - 2, y - 3, 5, 6);
        g.fillStyle = 'rgba(184, 212, 217, 0.55)';
        g.fillRect(x - 3, y - 1, 2, 1);
        g.fillRect(x + 2, y + 1, 1, 1);
        g.fillRect(x + 4, y - 2, 1, 1);
        g.fillRect(x - 5, y + 2, 1, 1);
      } else if (dc.kind === 'wood_rubble' || dc.kind === 'barrel_rubble') {
        const x = Math.round(dc.x);
        const y = Math.round(dc.y);
        const hw = Math.max(6, Math.round((dc.w || 26) * 0.42));
        const hh = Math.max(5, Math.round((dc.h || 24) * 0.38));
        g.fillStyle = P.outline;
        g.fillRect(x - hw, y - hh + 2, hw * 2 - 2, 3);
        g.fillRect(x - hw + 4, y + 1, hw * 2 - 4, 3);
        g.fillStyle = P.woodWarm[3];
        g.fillRect(x - hw + 1, y - hh + 2, hw * 2 - 4, 2);
        g.fillStyle = P.woodWarm[1];
        g.fillRect(x - hw + 5, y + 1, hw + 4, 2);
        g.fillRect(x - 4, y - 5, 3, hh * 2 - 2);
        if (dc.kind === 'barrel_rubble') {
          g.fillStyle = P.steelDark[2];
          g.fillRect(x - 7, y - 2, 14, 2);
          g.fillRect(x - 5, y + 3, 10, 2);
        }
      } else if (dc.kind === 'hay_rubble') {
        const x = Math.round(dc.x);
        const y = Math.round(dc.y);
        g.fillStyle = P.grass[3];
        g.fillRect(x - 10, y - 5, 20, 10);
        g.fillStyle = P.grass[1];
        g.fillRect(x - 8, y - 4, 7, 2);
        g.fillRect(x + 1, y + 1, 8, 2);
        g.fillStyle = P.grass[0];
        g.fillRect(x - 4, y - 1, 6, 1);
      } else {
        g.fillStyle = dc.color;
        const s = Math.max(1, Math.round(dc.r * 1.2));
        g.fillRect(Math.round(dc.x - s * 0.5), Math.round(dc.y - s * 0.5), s, s);
      }
    }
  }

  function isJetPointBlocked(wx, wy, container) {
    if (world && world.solids) {
      for (let i = 0; i < world.solids.length; i++) {
        const s = world.solids[i];
        if (s === container) continue;
        if (wx >= s.x && wx <= s.x + s.w && wy >= s.y && wy <= s.y + s.h) return true;
      }
    }
    const lay = world && world.layout;
    const stX1 = lay ? lay.streetStartX : 464;
    const stX2 = lay ? lay.streetEndX : 1248;
    if (world && world.streetTop && wx >= stX1 && wx <= stX2 && container.y >= world.streetTop + 18 && wy < world.streetTop + 22) {
      return true;
    }
    return false;
  }

  function drawPuddles(g, org) {
    if (!world || !world.puddles || !world.puddles.length) return;
    const P = getPal();
    const lay = world.layout;
    const stTop = lay ? lay.streetTop : world.streetTop;
    const stBot = lay ? lay.streetBot : world.streetBot;
    const stX1 = lay ? lay.streetStartX : 464;
    const stX2 = lay ? lay.streetEndX : 1248;
    const hasStreetBounds = stTop !== undefined && stBot !== undefined;
    for (let i = 0; i < world.puddles.length; i++) {
      const pd = world.puddles[i];
      const fade = pd.alpha !== undefined ? G.MATH.clamp(pd.alpha, 0, 1) : 1.0;
      const r = Math.round(pd.r);
      if (fade <= 0.02 || r < 2) continue;
      const px = Math.round(pd.x);
      const py = Math.round(pd.y);
      if (org && !isInView(px - r, py - r, r * 2, r * 2, org, 16)) continue;

      const onMainStreet = hasStreetBounds && px >= stX1 - 20 && px <= stX2 + 24 && py >= stTop - 16 && py <= stBot + 36;
      if (onMainStreet) {
        g.save();
        g.beginPath();
        g.rect(stX1 - 4, stTop + 22, (stX2 - stX1) + 12, stBot - (stTop + 22));
        g.clip();
      }

      g.globalAlpha = 0.72 * fade;
      const outerDisc = getCachedPixelDisc(r, P.water[3]);
      g.drawImage(outerDisc.canvas, px - outerDisc.half, py - outerDisc.half);
      if (r >= 4) {
        const innerDisc = getCachedPixelDisc(Math.max(2, r - 3), P.water[2]);
        g.drawImage(innerDisc.canvas, px - 1 - innerDisc.half, py - 1 - innerDisc.half);
      }
      g.globalAlpha = 0.85 * fade;
      g.fillStyle = P.water[0];
      g.fillRect(px - Math.max(2, Math.floor(r * 0.4)), py - Math.max(2, Math.floor(r * 0.4)), Math.max(3, Math.floor(r * 0.45)), 1);

      if (onMainStreet) {
        g.restore();
      }
    }
    g.globalAlpha = 1;
  }

  function drawBloodTrail(g, org) {
    if (!state.bloodTrail || !state.bloodTrail.length) return;
    const P = getPal();
    for (let i = 0; i < state.bloodTrail.length; i++) {
      const tr = state.bloodTrail[i];
      if (org && !isInView(tr.x - 4, tr.y - 4, 8, 8, org, 16)) continue;
      const frac = G.MATH.clamp(tr.life / tr.maxLife, 0, 1);
      g.globalAlpha = Math.min(0.85, frac * 1.15);
      g.fillStyle = tr.r > 2.4 ? P.blood[1] : P.blood[0];
      const sz = Math.max(2, Math.round(tr.r));
      g.fillRect(Math.round(tr.x), Math.round(tr.y), sz, Math.max(1, sz - 1));
    }
    g.globalAlpha = 1;
  }

  function drawBloodDrops(g, org) {
    if (!state.bloodDrops || !state.bloodDrops.length) return;
    for (let i = 0; i < state.bloodDrops.length; i++) {
      const bd = state.bloodDrops[i];
      if (org && !isInView(bd.x - 6, bd.y - 12, 12, 24, org, 16)) continue;
      g.fillStyle = 'rgba(24, 10, 8, 0.34)';
      g.fillRect(Math.round(bd.x + SUN.dx * bd.z * 0.25), Math.round(bd.y + SUN.dy * bd.z * 0.25), 2, 1);

      const drawY = bd.y - bd.z * 0.48;
      const prevY = bd.py - bd.z * 0.48;
      g.strokeStyle = bd.color;
      g.lineWidth = Math.max(1, Math.round(bd.size * 0.8));
      g.beginPath();
      g.moveTo(Math.round(bd.px), Math.round(prevY));
      g.lineTo(Math.round(bd.x), Math.round(drawY));
      g.stroke();

      const sz = Math.max(1, Math.round(bd.size));
      g.fillStyle = bd.color;
      g.fillRect(Math.round(bd.x - sz * 0.5), Math.round(drawY - sz * 0.5), sz, sz);
    }
  }

  // ==================== БОЧКИ С ВОДОЙ И ОТРАЖЕНИЯМИ (OFFSCREEN КЭШ, БЕЗ ARC) ====================

  const barrelShellCaches = {};
  const waterScratchCanvas = document.createElement('canvas');
  waterScratchCanvas.width = 48;
  waterScratchCanvas.height = 48;
  const waterScratchCtx = waterScratchCanvas.getContext('2d');
  waterScratchCtx.imageSmoothingEnabled = false;

  function drawPixelRing(g, cx, cy, radius) {
    const r = Math.round(radius);
    if (r < 1) return;
    let x = r;
    let y = 0;
    let err = 1 - x;
    const icx = Math.round(cx);
    const icy = Math.round(cy);
    while (x >= y) {
      g.fillRect(icx + x, icy + y, 1, 1);
      g.fillRect(icx + y, icy + x, 1, 1);
      g.fillRect(icx - y, icy + x, 1, 1);
      g.fillRect(icx - x, icy + y, 1, 1);
      g.fillRect(icx - x, icy - y, 1, 1);
      g.fillRect(icx - y, icy - x, 1, 1);
      g.fillRect(icx + y, icy - x, 1, 1);
      g.fillRect(icx + x, icy - y, 1, 1);
      y++;
      if (err < 0) {
        err += 2 * y + 1;
      } else {
        x--;
        err += 2 * (y - x + 1);
      }
    }
  }

  function getBarrelCaches(bw, bh) {
    const w = Math.max(18, Math.round(bw));
    const h = Math.max(18, Math.round(bh));
    const key = w + 'x' + h;
    if (barrelShellCaches[key]) return barrelShellCaches[key];

    const P = getPal();
    const colOut = P.outline || '#140f0c';
    const cx = Math.floor(w * 0.5);
    const cy = Math.floor(h * 0.5);
    const r = Math.floor(Math.min(w, h) * 0.5);
    const waterR = Math.max(4, r - 4);
    const staves = 14;

    const shellCanvas = document.createElement('canvas');
    shellCanvas.width = w;
    shellCanvas.height = h;
    const sg = shellCanvas.getContext('2d');
    sg.imageSmoothingEnabled = false;

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = w;
    maskCanvas.height = h;
    const mg = maskCanvas.getContext('2d');
    mg.imageSmoothingEnabled = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d = Math.hypot(dx, dy);

        if (d <= waterR + 0.25) {
          mg.fillStyle = '#ffffff';
          mg.fillRect(x, y, 1, 1);
          continue;
        }
        if (d > r + 0.35) continue;

        const sunDot = (dx * SUN.dx + dy * SUN.dy) / Math.max(1, d);
        if (d >= r - 0.85) {
          // 1px контур + выступающие грани
          sg.fillStyle = colOut;
        } else if (d >= r - 2.0) {
          // Выступающий железный обруч по наружному периметру
          if (sunDot < -0.25) sg.fillStyle = P.steelDark[1];
          else if (sunDot > 0.35) sg.fillStyle = P.steelDark[4];
          else sg.fillStyle = P.steelDark[2];
        } else {
          // Объёмная толщина деревянного обода и клёпок (woodWarm)
          const ang = Math.atan2(dy, dx);
          const pos = ((ang + Math.PI) / (Math.PI * 2)) * staves;
          const staveIdx = Math.floor(pos);
          const staveFrac = pos - staveIdx;

          if (staveFrac < 0.17) {
            // Тёмный стык между клёпками
            sg.fillStyle = colOut;
          } else if (d <= waterR + 1.15) {
            // Внутренняя кромка обода (светлее снизу-справа где падает солнце, темнее вверху-слева)
            sg.fillStyle = sunDot > 0.2 ? P.woodWarm[1] : P.woodWarm[4];
          } else if (sunDot < -0.25) {
            sg.fillStyle = (staveIdx % 2 === 0) ? P.woodWarm[0] : P.woodWarm[1];
          } else if (sunDot > 0.30) {
            sg.fillStyle = (staveIdx % 2 === 0) ? P.woodWarm[3] : P.woodWarm[4];
          } else {
            sg.fillStyle = (staveIdx % 2 === 0) ? P.woodWarm[1] : P.woodWarm[2];
          }
        }
        sg.fillRect(x, y, 1, 1);
      }
    }

    // Пиксельные заклёпки (lead) на железном обруче
    const rivetR = r - 1.3;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const rx = Math.round(cx + Math.cos(a) * rivetR - 0.5);
      const ry = Math.round(cy + Math.sin(a) * rivetR - 0.5);
      sg.fillStyle = colOut;
      sg.fillRect(rx, ry, 2, 2);
      sg.fillStyle = P.lead[0];
      sg.fillRect(rx, ry, 1, 1);
    }

    barrelShellCaches[key] = { shell: shellCanvas, mask: maskCanvas, cx, cy, r, waterR, w, h };
    return barrelShellCaches[key];
  }

  function drawWaterBarrel(g, s) {
    const P = getPal();
    const bw = Math.max(18, Math.round(s.w));
    const bh = Math.max(18, Math.round(s.h));
    const cache = getBarrelCaches(bw, bh);
    const sx = Math.round(s.x);
    const sy = Math.round(s.y);
    const cx = sx + cache.cx;
    const cy = sy + cache.cy;
    const r = cache.r;
    const waterR = cache.waterR;
    const colOut = P.outline || '#140f0c';

    const wLvl = s.waterLevel !== undefined ? G.MATH.clamp(s.waterLevel, 0, 1) : 1.0;

    // Ближайший живой игрок + проверка вспышки и активной ряби
    const plsBarrel = (G.SIM && G.SIM.getPlayers) ? G.SIM.getPlayers(state) : [state.player];
    let p = state.player;
    let bestBDist = Infinity;
    for (let pi = 0; pi < plsBarrel.length; pi++) {
      const cand = plsBarrel[pi];
      if (!cand || cand.dead) continue;
      const cpos = G.SIM.getRenderPos(cand);
      const cd = Math.hypot(cpos.x - cx, cpos.y - cy);
      if (cd < bestBDist) {
        bestBDist = cd;
        p = cand;
      }
    }
    const pos = p ? G.SIM.getRenderPos(p) : { x: cx + 999, y: cy + 999 };
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    const dist = Math.hypot(dx, dy);

    let hasRipple = false;
    if (state.waterRipples && state.waterRipples.length && wLvl > 0.05) {
      for (let i = 0; i < state.waterRipples.length; i++) {
        if (state.waterRipples[i].barrelId === s.id) {
          hasRipple = true;
          break;
        }
      }
    }
    const hasFlash = !!(p && p.flashTimer > 0 && dist < 130 && wLvl > 0.05);
    const hasReflection = !!(p && !p.dead && dist < 62 && wLvl > 0.05);

    // Единый рендер воды для всех видимых бочек (без расхождения между «быстрой» и «детальной» веткой)
    const wg = waterScratchCtx;
    const lx = cache.cx;
    const ly = cache.cy;
    wg.clearRect(0, 0, cache.w, cache.h);
    wg.save();

    if (wLvl <= 0.05) {
      // Пустое дощатое дно высохшей бочки
      wg.fillStyle = P.woodWarm[4];
      wg.fillRect(lx - waterR, ly - waterR, waterR * 2, waterR * 2);
      wg.fillStyle = P.woodWarm[3];
      for (let py = -waterR; py < waterR; py += 3) {
        wg.fillRect(lx - waterR, ly + py, waterR * 2, 2);
      }
    } else {
      wg.fillStyle = P.water[3];
      wg.fillRect(lx - waterR, ly - waterR, waterR * 2, waterR * 2);
      wg.fillStyle = P.water[2];
      wg.fillRect(lx - waterR, ly - waterR, waterR * 2, Math.floor(waterR * (0.4 + 0.8 * wLvl)));
      wg.fillStyle = P.water[1];
      wg.fillRect(lx - waterR, ly - waterR, waterR * 2, Math.floor(waterR * (0.2 + 0.4 * wLvl)));
      wg.fillStyle = P.water[0];
      wg.fillRect(lx - waterR, ly - waterR, waterR * 2, Math.floor(waterR * 0.22 * wLvl));

      // Облака в отражении
      const cloudShift = ((state.time * CLOUD_WIND * 0.12 + cx * 0.25) % 28) - 14;
      wg.fillStyle = P.cloud[0];
      wg.globalAlpha = 0.42;
      wg.fillRect(Math.round(lx - 7 + cloudShift), Math.round(ly - 5), 9, 2);
      wg.fillRect(Math.round(lx - 5 + cloudShift), Math.round(ly - 7), 5, 2);
      wg.fillStyle = P.cloud[1];
      wg.fillRect(Math.round(lx - 13 + cloudShift * 0.7), Math.round(ly + 2), 8, 2);
      wg.globalAlpha = 1;
    }

    // Внутренняя тень стенки над зеркалом воды (меняет глубину при падении waterLevel)
    const rimShadowDepth = wLvl <= 0.05 ? 5 : Math.max(2, Math.round(2 + (1 - wLvl) * 6));
    wg.fillStyle = 'rgba(20, 15, 12, 0.48)';
    wg.fillRect(lx - waterR, ly - waterR, waterR * 2, rimShadowDepth);
    wg.fillRect(lx - waterR, ly - waterR, Math.max(2, Math.round(rimShadowDepth * 0.75)), waterR * 2);

    // Плавное появление отражения ближайшего живого игрока при приближении (dist < 62)
    if (hasReflection) {
      const prox = G.MATH.clamp(1 - dist / 62, 0, 1);
      const wobX = Math.sin(state.time * 5.2 + cy) * 1.3;
      const wobY = Math.cos(state.time * 4.4 + cx) * 0.8;
      const refX = Math.round(lx + dx * 0.26 + wobX);
      const refY = Math.round(ly + dy * 0.24 + wobY);

      wg.save();
      wg.translate(refX, refY);
      wg.rotate(p.aimAngle);
      wg.scale(1, -1);
      wg.globalAlpha = prox * 0.72;

      wg.fillStyle = colOut;
      wg.fillRect(-6, -9, 12, 18);
      wg.fillStyle = p.coatColor || (P.cloth ? P.cloth[2] : '#232d38');
      wg.fillRect(-5, -8, 10, 16);
      wg.fillStyle = p.coatTrim || (P.cloth ? P.cloth[0] : '#4f5e6e');
      wg.fillRect(-5, -8, 3, 4);

      wg.fillStyle = P.skin ? P.skin[1] : '#c49876';
      wg.fillRect(3, 4, 3, 3);
      wg.fillRect(3, -4, 3, 3);

      wg.fillStyle = p.bandanaColor || P.barnRed[1];
      wg.fillRect(1, -3, 3, 6);
      wg.fillStyle = p.bandanaColor || P.barnRed[0];
      wg.fillRect(2, -2, 2, 2);

      const refHat = p.hatId || (p.id === state.localPlayerId ? G.CFG.selectedHat : 'classic') || 'classic';
      drawPlayerHat(wg, -1, 0, refHat);

      const w = G.SIM.getWeapon(state, p);
      const visLen = Math.max(4, Math.round(w.barrelLen * (1 - (p.wallRaiseFrac || 0) * 0.65)));
      if (w.id === 'walker') {
        wg.fillStyle = P.steelLight[1];
        wg.fillRect(5, 3, Math.round(visLen * 0.72), 2);
        wg.fillStyle = P.steelLight[0];
        wg.fillRect(5, 3, Math.round(visLen * 0.72), 1);
      } else if (w.id === 'winchester') {
        wg.fillStyle = P.brass[1];
        wg.fillRect(4, 2, 5, 3);
        wg.fillStyle = P.steelDark[1];
        wg.fillRect(9, 3, Math.round(visLen * 0.78), 2);
      } else {
        wg.fillStyle = P.steelDark[1];
        wg.fillRect(5, 3, Math.round(visLen * 0.72), 2);
        wg.fillStyle = P.steelDark[0];
        wg.fillRect(5, 3, Math.round(visLen * 0.72), 1);
      }
      wg.restore();
    }

    // Попиксельная вспышка выстрела на воде (без arc())
    if (hasFlash) {
      const fl = (p.flashTimer / 0.06) * (1 - dist / 130);
      wg.globalAlpha = 0.52 * fl;
      wg.fillStyle = P.brass[0];
      drawPixelDisc(wg, lx + dx * 0.12, ly + dy * 0.12, waterR * 0.85);
      wg.globalAlpha = 1;
    }

    // Попиксельные круги ряби на воде (без arc() / stroke())
    if (state.waterRipples && wLvl > 0.05) {
      for (let i = 0; i < state.waterRipples.length; i++) {
        const rp = state.waterRipples[i];
        if (rp.barrelId !== s.id) continue;
        const frac = Math.max(0, rp.life / rp.maxLife);
        wg.globalAlpha = rp.alpha * frac;
        wg.fillStyle = P.cloud[0];
        drawPixelRing(wg, Math.round(rp.x - sx), Math.round(rp.y - sy), Math.round(rp.r));
      }
      wg.globalAlpha = 1;
    }

    // Блики ряби на поверхности
    if (wLvl > 0.05) {
      const shimmer = Math.round(Math.sin(state.time * 2.8 + cx) * 1.2);
      wg.fillStyle = P.cloud[0];
      wg.globalAlpha = 0.58;
      wg.fillRect(lx - 4 + shimmer, ly - 3, 4, 1);
      wg.fillRect(lx + 1 - shimmer, ly + 3, 3, 1);
      wg.globalAlpha = 1;
    }

    // Обрезаем зеркало воды строго по попиксельной круглой маске
    wg.globalCompositeOperation = 'destination-in';
    wg.drawImage(cache.mask, 0, 0);
    wg.restore();

    // Рисуем зеркало воды + запечённый деревянный корпус с клёпками, обручем и заклёпками
    g.drawImage(waterScratchCanvas, 0, 0, cache.w, cache.h, sx, sy, cache.w, cache.h);
    g.drawImage(cache.shell, sx, sy);

    // Пробоины в стенке бочки и вытекающие струи воды (G.PAL.water, остановка о заборы/стены)
    if (s.holes && s.holes.length > 0) {
      for (let i = 0; i < s.holes.length; i++) {
        const h = s.holes[i];
        const hx = Math.round(cx + h.nx * (r - 1));
        const hy = Math.round(cy + h.ny * (r - 1));
        g.fillStyle = colOut;
        g.fillRect(hx - 1, hy - 1, 3, 3);
        if (wLvl > 0.05) {
          g.fillStyle = P.water[0];
          g.fillRect(hx, hy, 1, 1);
          const jetLen = Math.round(5 + wLvl * 7);
          const flowPhase = (state.time * 14 + i * 3.1) % 3;
          for (let step = 1; step <= jetLen; step += 2) {
            const jx = Math.round(hx + h.nx * step);
            const jy = Math.round(hy + h.ny * step + (step * step) * 0.04 + (step === Math.floor(flowPhase) ? 1 : 0));
            if (isJetPointBlocked(jx, jy, s)) {
              g.fillStyle = P.water[0];
              g.fillRect(jx, jy, 1, 1);
              break;
            }
            g.fillStyle = step < 4 ? P.water[0] : (step < 8 ? P.water[1] : P.water[2]);
            g.fillRect(jx, jy, 2, 1);
          }
        }
      }
    }
  }

  function drawWaterTrough(g, s) {
    const P = getPal();
    const sx = Math.round(s.x);
    const sy = Math.round(s.y);
    const sw = Math.round(s.w);
    const sh = Math.round(s.h);
    const colOut = P.outline || '#140f0c';

    if (s.baked && s.baked.canvas) {
      g.drawImage(s.baked.canvas, sx + s.baked.ox, sy + s.baked.oy);
    }

    const ix = sx + 4;
    const iy = sy + 4;
    const iw = Math.max(6, sw - 8);
    const ih = Math.max(4, sh - 9);
    const cx = sx + Math.floor(sw * 0.5);
    const cy = sy + Math.floor(sh * 0.5);
    const wLvl = s.waterLevel !== undefined ? G.MATH.clamp(s.waterLevel, 0, 1) : 1.0;

    if (wLvl <= 0.05) {
      // Пустое сырое дощатое дно высохшего корыта
      g.fillStyle = P.woodWarm[4];
      g.fillRect(ix, iy, iw, ih);
      g.fillStyle = P.woodWarm[3];
      for (let py = 1; py < ih; py += 3) {
        g.fillRect(ix, iy + py, iw, 2);
      }
      g.fillStyle = 'rgba(20, 15, 12, 0.45)';
      g.fillRect(ix, iy, iw, 3);
      g.fillRect(ix, iy, 3, ih);
    } else {
      // Обновляем уровень воды внутри корыта, глубину тени борта и отражение
      g.fillStyle = P.water[3];
      g.fillRect(ix, iy, iw, ih);
      g.fillStyle = P.water[2];
      g.fillRect(ix, iy, iw, Math.max(1, Math.floor(ih * (0.35 + 0.45 * wLvl))));
      g.fillStyle = P.water[1];
      g.fillRect(ix, iy, iw, Math.max(1, Math.floor(ih * 0.32 * wLvl)));

      const rimDepth = Math.max(1, Math.round(1 + (1 - wLvl) * 4));
      g.fillStyle = 'rgba(20, 15, 12, 0.46)';
      g.fillRect(ix, iy, iw, rimDepth);
      g.fillRect(ix, iy, Math.max(2, rimDepth), ih);

      // Облака и блики воды
      const shimmer = Math.round(Math.sin(state.time * 2.5 + sx * 0.2) * 2);
      g.fillStyle = P.cloud[0];
      g.globalAlpha = 0.44;
      g.fillRect(G.MATH.clamp(ix + 4 + shimmer, ix + 1, ix + iw - 7), iy + 2, 6, 2);
      g.globalAlpha = 0.65;
      g.fillStyle = P.water[0];
      g.fillRect(G.MATH.clamp(ix + 2 + shimmer, ix + 1, ix + iw - 9), iy + 1, Math.max(3, Math.floor(iw * 0.28)), 1);
      g.fillRect(G.MATH.clamp(ix + Math.floor(iw * 0.55) - shimmer, ix + 2, ix + iw - 6), iy + Math.max(1, ih - 3), Math.max(2, Math.floor(iw * 0.22)), 1);
      g.globalAlpha = 1;

      // Отражение проходящего рядом бойца (ближайшего живого игрока, без создания буферов каждый кадр)
      const plsTrough = (G.SIM && G.SIM.getPlayers) ? G.SIM.getPlayers(state) : [state.player];
      let p = null;
      let bestTDist = 56;
      for (let pi = 0; pi < plsTrough.length; pi++) {
        const cand = plsTrough[pi];
        if (!cand || cand.dead) continue;
        const cpos = G.SIM.getRenderPos(cand);
        const cd = Math.hypot(cpos.x - cx, cpos.y - cy);
        if (cd < bestTDist) {
          bestTDist = cd;
          p = cand;
        }
      }
      if (p) {
        const pos = G.SIM.getRenderPos(p);
        const dx = pos.x - cx;
        const dy = pos.y - cy;
        const dist = bestTDist;
        if (dist < 56) {
          g.save();
          g.beginPath();
          g.rect(ix, iy, iw, ih);
          g.clip();
          const prox = G.MATH.clamp(1 - dist / 56, 0, 1);
          g.globalAlpha = 0.18 + prox * 0.36;
          g.fillStyle = p.coatColor || (P.cloth ? P.cloth[2] : colOut);
          const rx = Math.round(cx + dx * 0.22);
          const ry = Math.round(cy + dy * 0.18);
          g.fillRect(rx - 4, ry - 4, 8, 8);
          g.fillStyle = P.leather[2];
          g.fillRect(rx - 3, ry - 3, 6, 5);
          g.restore();
        }
      }

      // Рябь в корыте при попаданиях
      if (state.waterRipples) {
        for (let i = 0; i < state.waterRipples.length; i++) {
          const rp = state.waterRipples[i];
          if (rp.barrelId !== s.id) continue;
          const frac = Math.max(0, rp.life / rp.maxLife);
          const rpx = G.MATH.clamp(Math.round(rp.x), ix + 2, ix + iw - 3);
          const rpy = G.MATH.clamp(Math.round(rp.y), iy + 2, iy + ih - 3);
          g.save();
          g.beginPath();
          g.rect(ix, iy, iw, ih);
          g.clip();
          g.globalAlpha = rp.alpha * frac;
          g.fillStyle = P.cloud[0];
          drawPixelRing(g, rpx, rpy, Math.round(rp.r));
          g.restore();
        }
      }
    }

    // Пробоины в деревянных бортах и вытекающие струи (обрезанные по препятствиям)
    if (s.holes && s.holes.length > 0) {
      for (let i = 0; i < s.holes.length; i++) {
        const h = s.holes[i];
        const hx = Math.round(G.MATH.clamp(cx + h.lx, sx + 1, sx + sw - 2));
        const hy = Math.round(G.MATH.clamp(cy + h.ly, sy + 1, sy + sh - 2));
        g.fillStyle = colOut;
        g.fillRect(hx - 1, hy - 1, 3, 3);
        if (wLvl > 0.05) {
          g.fillStyle = P.water[0];
          g.fillRect(hx, hy, 1, 1);
          const jetLen = Math.round(4 + wLvl * 7);
          const flowPhase = (state.time * 14 + i * 2.9) % 3;
          for (let step = 1; step <= jetLen; step += 2) {
            const jx = Math.round(hx + h.nx * step);
            const jy = Math.round(hy + h.ny * step + (step * step) * 0.04 + (step === Math.floor(flowPhase) ? 1 : 0));
            if (isJetPointBlocked(jx, jy, s)) {
              g.fillStyle = P.water[0];
              g.fillRect(jx, jy, 1, 1);
              break;
            }
            g.fillStyle = step < 4 ? P.water[0] : (step < 8 ? P.water[1] : P.water[2]);
            g.fillRect(jx, jy, 2, 1);
          }
        }
      }
    }
  }

  // ==================== ОБЪЕКТЫ МИРА ====================

  function bakeSaloonInteriorSolid(s, P) {
    const { c, g } = makeOffscreen(s.w, s.h);
    const colOut = P.outline || '#140f0c';

    if (s.type === 'wall' || s.type === 'pillar') {
      g.fillStyle = colOut;
      g.fillRect(0, 0, s.w, s.h);
      g.fillStyle = P.woodWarm[3];
      g.fillRect(1, 1, s.w - 2, s.h - 2);
      g.fillStyle = P.woodWarm[1];
      g.fillRect(2, 2, s.w - 4, s.h - 4);
      g.fillStyle = P.woodWarm[0];
      g.fillRect(2, 2, s.w - 4, 2);

      // Дощатая обшивка со швами и гвоздями
      g.fillStyle = P.woodWarm[4];
      if (s.w > s.h) {
        // Горизонтальная стена
        g.fillRect(2, Math.floor(s.h * 0.5), s.w - 4, 1);
        for (let x = 14; x < s.w - 6; x += 16) {
          g.fillStyle = P.woodWarm[4];
          g.fillRect(x, 2, 1, s.h - 4);
          // Гвозди
          g.fillStyle = P.lead ? P.lead[3] : '#474542';
          g.fillRect(x - 2, 3, 1, 1);
          g.fillRect(x - 2, s.h - 4, 1, 1);
        }
      } else {
        // Вертикальная стена / столб
        g.fillRect(Math.floor(s.w * 0.5), 2, 1, s.h - 4);
        for (let y = 14; y < s.h - 6; y += 16) {
          g.fillStyle = P.woodWarm[4];
          g.fillRect(2, y, s.w - 4, 1);
          // Гвозди
          g.fillStyle = P.lead ? P.lead[3] : '#474542';
          g.fillRect(3, y - 2, 1, 1);
          g.fillRect(s.w - 4, y - 2, 1, 1);
        }
      }

      // Окна салуна (привязаны к world.layout)
      if (s.id === 'sal_right1' || s.id === 'sal_right2') {
        const lay = world && world.layout;
        const winAbsY = (s.id === 'sal_right1')
          ? ((lay && lay.win1Y) || (s.y + 72))
          : ((lay && lay.win2Y) || (s.y + 90));
        const wy = G.MATH.clamp(winAbsY - s.y, 8, Math.max(8, s.h - 34));
        // Объёмная рама окна
        g.fillStyle = colOut;
        g.fillRect(0, wy - 2, s.w, 28);
        g.fillStyle = P.woodPale[1];
        g.fillRect(1, wy - 1, s.w - 2, 26);
        g.fillStyle = P.woodPale[0];
        g.fillRect(2, wy, s.w - 4, 2);

        // Стекло окна
        g.fillStyle = P.glass ? P.glass[3] : '#2c474f';
        g.fillRect(3, wy + 2, s.w - 6, 20);

        // Деревянный оконный переплёт
        g.fillStyle = P.woodPale[2];
        g.fillRect(2, wy + 11, s.w - 4, 2);
        g.fillRect(Math.floor(s.w * 0.5), wy + 2, 2, 20);

        // Блики стекла
        g.fillStyle = P.glass ? P.glass[0] : '#b8d4d9';
        g.fillRect(4, wy + 4, 2, 5);
        g.fillRect(4, wy + 15, 2, 5);
        g.fillStyle = P.glass ? P.glass[1] : '#7ba4ad';
        g.fillRect(5, wy + 5, 2, 4);
        g.fillRect(5, wy + 16, 2, 4);
      }
      return c;
    }

    if (s.type === 'counter') {
      // Барная стойка салуна
      g.fillStyle = colOut;
      g.fillRect(0, 0, s.w, s.h);
      g.fillStyle = P.woodWarm[3];
      g.fillRect(1, 1, s.w - 2, s.h - 2);

      // Филенчатые декоративные деревянные панели на фасаде стойки
      for (let px = 8; px < s.w - 18; px += 28) {
        g.fillStyle = P.woodWarm[4];
        g.fillRect(px, 4, 24, s.h - 8);
        g.fillStyle = P.woodWarm[2];
        g.fillRect(px + 1, 5, 22, s.h - 10);
        g.fillStyle = P.woodWarm[1];
        g.fillRect(px + 2, 6, 20, s.h - 12);
        g.fillStyle = P.woodWarm[0];
        g.fillRect(px + 2, 6, 20, 1);
      }

      // Столешница и потёртости
      g.fillStyle = P.woodWarm[1];
      g.fillRect(2, 2, s.w - 4, 5);
      g.fillStyle = P.woodPale[2];
      g.fillRect(18, 3, 16, 1);
      g.fillRect(Math.round(s.w * 0.42), 3, 24, 1);
      g.fillRect(Math.max(36, s.w - 42), 3, 18, 1);

      // Латунная окантовка по переднему ребру столешницы
      g.fillStyle = P.brass[0];
      g.fillRect(2, 2, s.w - 4, 1);
      g.fillStyle = P.brass[2];
      g.fillRect(2, s.h - 3, s.w - 4, 2);
      g.fillStyle = P.brass[4];
      g.fillRect(2, s.h - 1, s.w - 4, 1);

      // Мелкие декоративные стаканы и бутылки на стойке (не мишени!)
      // Бутылка виски
      g.fillStyle = P.canyon[1];
      g.fillRect(28, 4, 3, 5);
      g.fillStyle = P.woodPale[0];
      g.fillRect(29, 3, 1, 1); // пробка
      g.fillStyle = P.glass[0];
      g.fillRect(28, 5, 1, 2); // блик стекла

      // Стаканчик
      g.fillStyle = P.glass[1];
      g.fillRect(34, 5, 2, 3);
      g.fillStyle = P.glass[0];
      g.fillRect(34, 5, 1, 1);

      // Вторая бутылка и стаканы ближе к правому краю стойки
      const rbX = Math.max(80, s.w - 30);
      g.fillStyle = P.foliage[1];
      g.fillRect(rbX, 4, 3, 5);
      g.fillStyle = P.woodPale[0];
      g.fillRect(rbX + 1, 3, 1, 1);
      g.fillStyle = P.glass[0];
      g.fillRect(rbX, 5, 1, 2);

      g.fillStyle = P.glass[1];
      g.fillRect(rbX + 6, 5, 2, 3);
      g.fillStyle = P.glass[0];
      g.fillRect(rbX + 6, 5, 1, 1);

      return c;
    }

    if (s.type === 'table') {
      // Дощатый стол
      g.fillStyle = colOut;
      g.fillRect(0, 0, s.w, s.h);
      g.fillStyle = P.woodWarm[3];
      g.fillRect(1, 1, s.w - 2, s.h - 2);
      g.fillStyle = P.woodWarm[1];
      g.fillRect(2, 2, s.w - 4, s.h - 4);
      g.fillStyle = P.woodWarm[0];
      g.fillRect(2, 2, s.w - 4, 2);

      // Продольные доски столешницы
      g.fillStyle = P.woodWarm[4];
      for (let py = 10; py < s.h - 4; py += 9) {
        g.fillRect(2, py, s.w - 4, 1);
      }

      if (s.id === 'sal_tbl1') {
        // Покерный стол: карты и стопки фишек (без лишнего стакана — рядом интерактивный бурбон)
        g.fillStyle = '#f5ede1';
        g.fillRect(11, 14, 4, 5);
        g.fillRect(19, 18, 5, 4);
        g.fillRect(27, 12, 4, 5);
        // Масти карт
        g.fillStyle = P.barnRed[0];
        g.fillRect(12, 15, 2, 2);
        g.fillStyle = colOut;
        g.fillRect(28, 13, 2, 2);
        // Стопки фишек (красные, золотые, синие)
        g.fillStyle = P.barnRed[1];
        g.fillRect(16, 26, 3, 3);
        g.fillStyle = P.brass[1];
        g.fillRect(21, 28, 3, 3);
        g.fillStyle = P.slateTeal[1];
        g.fillRect(26, 25, 3, 3);
      } else {
        // Стол 2: бутылка эля, стакан и карты
        g.fillStyle = P.foliage[1];
        g.fillRect(14, 15, 4, 5);
        g.fillStyle = P.woodPale[0];
        g.fillRect(15, 14, 2, 1); // пробка
        g.fillStyle = P.glass[0];
        g.fillRect(14, 16, 1, 2);

        // Карты
        g.fillStyle = '#f5ede1';
        g.fillRect(24, 22, 5, 4);
        g.fillStyle = P.barnRed[0];
        g.fillRect(25, 23, 2, 2);

        // Стакан
        g.fillStyle = P.glass[1];
        g.fillRect(30, 16, 3, 3);
        g.fillStyle = P.glass[0];
        g.fillRect(30, 16, 1, 1);
      }

      return c;
    }
    return c;
  }

  function drawSaloonInteriorSolid(g, s) {
    const P = getPal();
    if (!s.interiorBaked) {
      s.interiorBaked = bakeSaloonInteriorSolid(s, P);
    }
    g.drawImage(s.interiorBaked, s.x, s.y);
  }

  function drawCoverDamageOverlay(g, s) {
    if (!s || !s.damageStage || s.damageStage <= 0) return;
    if (s.type === 'water_barrel' || s.type === 'trough') return;
    const P = getPal();
    const x = Math.round(s.x);
    const y = Math.round(s.y);
    const w = Math.round(s.w);
    const h = Math.round(s.h);
    const colOut = P.outline || '#140f0c';
    const isHay = s.type === 'hay';

    // Стадия 1: сколы, выбоины и глубокие щели
    g.fillStyle = colOut;
    g.fillRect(x + Math.floor(w * 0.24), y + 2, 2, Math.max(4, Math.floor(h * 0.52)));
    g.fillRect(x + Math.floor(w * 0.24) + 1, y + Math.floor(h * 0.48), 5, 2);
    g.fillStyle = isHay ? P.grass[4] : P.woodWarm[4];
    g.fillRect(x + Math.floor(w * 0.60), y + Math.floor(h * 0.28), Math.max(4, Math.floor(w * 0.24)), 2);
    g.fillStyle = isHay ? P.grass[0] : P.woodPale[1];
    g.fillRect(x + Math.floor(w * 0.24) + 2, y + 3, 2, 2);

    // Стадия 2 (breached === true): сквозные пробоины, расщеплённые доски / выбитые пучки сена
    if (s.damageStage >= 2 || s.breached) {
      if (isHay) {
        g.fillStyle = P.grass[4];
        g.fillRect(x + Math.floor(w * 0.30), y + Math.floor(h * 0.25), Math.max(6, Math.floor(w * 0.34)), Math.max(5, Math.floor(h * 0.42)));
        g.fillStyle = colOut;
        g.fillRect(x + Math.floor(w * 0.38), y + Math.floor(h * 0.34), Math.max(4, Math.floor(w * 0.18)), Math.max(3, Math.floor(h * 0.24)));
        g.fillStyle = P.grass[0];
        g.fillRect(x + 2, y + Math.floor(h * 0.45), 4, 1);
        g.fillRect(x + w - 6, y + Math.floor(h * 0.30), 5, 1);
        g.fillRect(x + Math.floor(w * 0.45), y - 1, 2, 3);
      } else {
        // Две тёмные сквозные пробоины и светлые сколы расщеплённой древесины
        const hx1 = x + Math.floor(w * 0.32);
        const hy1 = y + Math.floor(h * 0.26);
        const hx2 = x + Math.floor(w * 0.62);
        const hy2 = y + Math.floor(h * 0.52);
        g.fillStyle = colOut;
        g.fillRect(hx1 - 1, hy1 - 1, 6, Math.max(5, Math.floor(h * 0.44)));
        g.fillRect(hx2 - 1, hy2 - 1, 5, Math.max(4, Math.floor(h * 0.36)));
        g.fillRect(x + Math.floor(w * 0.48), y + 1, 2, Math.max(5, h - 2));
        // Светлые обломанные доски/щепки по краям бреши
        g.fillStyle = P.woodPale[0];
        g.fillRect(hx1 - 2, hy1, 2, 3);
        g.fillRect(hx1 + 5, hy1 + 1, 2, 2);
        g.fillRect(hx2 - 2, hy2, 2, 2);
        g.fillStyle = P.woodPale[1];
        g.fillRect(x + 3, y + 3, 5, 2);
        g.fillRect(x + Math.floor(w * 0.54), y + Math.floor(h * 0.72), 6, 2);
      }
    }
  }

  function drawSolid(g, s) {
    if (s.type === 'water_barrel') {
      drawWaterBarrel(g, s);
      return;
    }
    if (s.type === 'trough') {
      drawWaterTrough(g, s);
      return;
    }
    if (s.baked && s.baked.canvas) {
      g.drawImage(s.baked.canvas, Math.round(s.x + s.baked.ox), Math.round(s.y + s.baked.oy));
      drawCoverDamageOverlay(g, s);
      return;
    }
    drawSaloonInteriorSolid(g, s);
    drawCoverDamageOverlay(g, s);
  }

  function drawPolesAndWires(g, org) {
    if (!world.poles || !world.poles.length) return;
    const P = getPal();
    const poles = world.poles;

    g.strokeStyle = 'rgba(20, 14, 10, 0.22)';
    g.lineWidth = 1;
    for (let i = 0; i < poles.length - 1; i++) {
      const a = poles[i];
      const b = poles[i + 1];
      const minX = Math.min(a.x, b.x);
      const maxX = Math.max(a.x, b.x);
      const minY = Math.min(a.y, b.y);
      const maxY = Math.max(a.y, b.y);
      if (org && !isInView(minX, minY, maxX - minX + 24, maxY - minY + 32, org, 32)) continue;
      g.beginPath();
      g.moveTo(a.x + 12, a.y + 18);
      g.quadraticCurveTo((a.x + b.x) * 0.5 + 12, (a.y + b.y) * 0.5 + 24, b.x + 12, b.y + 18);
      g.stroke();
    }

    g.strokeStyle = 'rgba(28, 22, 18, 0.72)';
    g.lineWidth = 1;
    for (let i = 0; i < poles.length - 1; i++) {
      const a = poles[i];
      const b = poles[i + 1];
      const minX = Math.min(a.x, b.x);
      const maxX = Math.max(a.x, b.x);
      const minY = Math.min(a.y, b.y);
      const maxY = Math.max(a.y, b.y);
      if (org && !isInView(minX, minY, maxX - minX + 16, maxY - minY + 16, org, 32)) continue;
      [-3, 3].forEach((off) => {
        g.beginPath();
        g.moveTo(a.x, a.y + off);
        g.quadraticCurveTo((a.x + b.x) * 0.5, (a.y + b.y) * 0.5 + off + 6, b.x, b.y + off);
        g.stroke();
      });
    }

    for (let i = 0; i < poles.length; i++) {
      const p = poles[i];
      if (org && !isInView(p.x - 10, p.y - 10, 28, 30, org, 32)) continue;
      g.fillStyle = 'rgba(18, 13, 9, 0.36)';
      g.fillRect(p.x + 2, p.y + 2, 10, 14);
      g.fillStyle = '#1f1610';
      g.fillRect(p.x - 2, p.y - 6, 4, 12);
      g.fillStyle = P.woodWarm[2];
      g.fillRect(p.x - 1, p.y - 5, 2, 10);
      g.fillStyle = P.slateTeal[0];
      g.fillRect(p.x - 1, p.y - 5, 2, 1);
      g.fillRect(p.x - 1, p.y + 4, 2, 1);
      g.fillStyle = P.woodWarm[0];
      g.fillRect(p.x - 2, p.y - 2, 4, 4);
      g.fillStyle = P.woodWarm[3];
      g.fillRect(p.x, p.y, 2, 2);
    }
  }

  function drawTrees(g, org) {
    if (!world.trees || !world.trees.length) return;
    for (let i = 0; i < world.trees.length; i++) {
      const tr = world.trees[i];
      const rad = (tr.r || 18) * 1.4;
      if (org && !isInView(tr.x - rad, tr.y - rad, rad * 2 + 16, rad * 2 + 16, org, 32)) continue;
      g.fillStyle = 'rgba(20, 14, 10, 0.34)';
      g.beginPath();
      g.ellipse(
        Math.round(tr.x + SUN.dx * 15),
        Math.round(tr.y + SUN.dy * 15),
        tr.r * 0.94,
        tr.r * 0.84,
        0.2,
        0,
        Math.PI * 2
      );
      g.fill();

      if (tr.baked && tr.baked.canvas) {
        g.drawImage(tr.baked.canvas, Math.round(tr.x + tr.baked.ox), Math.round(tr.y + tr.baked.oy));
      }
    }
  }

  function drawDoors(g) {
    const P = getPal();
    world.doors.forEach((d) => {
      const a = d.baseAngle + d.angle;
      const ex = d.hingeX + Math.cos(a) * d.len;
      const ey = d.hingeY + Math.sin(a) * d.len;

      g.strokeStyle = 'rgba(18, 12, 8, 0.34)';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(d.hingeX + 3, d.hingeY + 4);
      g.lineTo(ex + 3, ey + 4);
      g.stroke();

      g.strokeStyle = P.woodWarm[4];
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(d.hingeX, d.hingeY);
      g.lineTo(ex, ey);
      g.stroke();

      g.strokeStyle = P.woodWarm[1];
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(d.hingeX, d.hingeY);
      g.lineTo(ex, ey);
      g.stroke();

      g.strokeStyle = P.woodWarm[0];
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(d.hingeX, d.hingeY);
      g.lineTo(ex, ey);
      g.stroke();

      g.fillStyle = P.grass[1];
      g.fillRect(d.hingeX - 2, d.hingeY - 2, 4, 4);
    });
  }

  // ==================== БАНДИТЫ, ШЛЯПЫ И МИШЕНИ ====================

  // Пиксельное «скругление» прямоугольника: 1px срезанные углы (без arc и сглаживания)
  function fillRoundPix(g, x, y, w, h) {
    if (w <= 2 || h <= 2) {
      g.fillRect(x, y, w, h);
      return;
    }
    g.fillRect(x + 1, y, w - 2, h);
    g.fillRect(x, y + 1, w, h - 2);
  }

  function drawBanditDead(g, t) {
    const P = getPal();
    const pool = t.bloodPool || 0;
    const fall = t.deathAnim || 0;

    if (pool > 0.02) {
      const pr = 5 + pool * 10;
      const px = Math.round(t.x);
      const py = Math.round(t.y);
      g.fillStyle = P.blood[3];
      g.fillRect(px - Math.round(pr), py - Math.round(pr * 0.65), Math.round(pr * 2), Math.round(pr * 1.3));
      g.fillRect(px - Math.round(pr * 0.65), py - Math.round(pr), Math.round(pr * 1.3), Math.round(pr * 2));
      g.fillStyle = P.blood[2];
      g.fillRect(px - Math.round(pr * 0.78), py - Math.round(pr * 0.52), Math.round(pr * 1.56), Math.round(pr * 1.04));
      g.fillStyle = P.blood[1];
      g.fillRect(px - Math.round(pr * 0.52), py - Math.round(pr * 0.35), Math.round(pr * 1.04), Math.round(pr * 0.7));
      g.fillStyle = P.blood[0];
      g.fillRect(px - Math.round(pr * 0.25), py - Math.round(pr * 0.18), Math.round(pr * 0.5), Math.round(pr * 0.36));
    }

    g.save();
    g.translate(Math.round(t.x), Math.round(t.y));
    g.rotate(t.fallAngle || 0);
    const stretch = 1 + fall * 0.30;
    g.scale(stretch, 1 - fall * 0.14);

    g.fillStyle = '#14100d';
    g.fillRect(-14, -5, 7, 4);
    g.fillRect(-14, 1, 7, 4);
    g.fillStyle = '#33271e';
    g.fillRect(-12, -4, 4, 2);
    g.fillRect(-12, 2, 4, 2);

    g.fillStyle = '#120f0d';
    fillRoundPix(g, -9, -8, 16, 16);
    g.fillStyle = t.coatColor;
    fillRoundPix(g, -8, -7, 14, 14);
    g.fillStyle = t.coatTrim;
    fillRoundPix(g, -6, -5, 10, 10);

    g.fillStyle = P.blood[1];
    g.fillRect(-2, -3, 5, 6);
    g.fillStyle = P.blood[0];
    g.fillRect(-1, -2, 3, 3);

    g.fillStyle = t.bandana;
    g.fillRect(4, -3, 3, 6);
    g.fillStyle = '#bd9170';
    g.fillRect(6, -3, 5, 6);
    g.fillStyle = '#291f19';
    g.fillRect(7, -3, 4, 6);

    g.fillStyle = '#242629';
    g.fillRect(6, 7, t.gunType === 'rifle' ? 14 : 7, 2);
    g.fillStyle = '#7a8085';
    g.fillRect(8, 7, t.gunType === 'rifle' ? 11 : 5, 1);

    g.restore();
  }

  const hatCaches = {};

  function getCachedHat(brimColor, crownColor, bandColor, highlightColor) {
    const key = `${brimColor}_${crownColor}_${bandColor}_${highlightColor}`;
    if (hatCaches[key]) return hatCaches[key];

    const size = 26;
    const { c, g } = makeOffscreen(size, size);
    const cx = 13;
    const cy = 13;
    const P = getPal();
    const colOut = P.outline || '#140f0c';

    // 1. Поля шляпы (овальный силуэт, rx = 9.5, ry = 7.5, изогнутые края)
    const rx = 9.5;
    const ry = 7.5;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d2 = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
        if (d2 > 1.05) continue;

        if (d2 > 0.82) {
          g.fillStyle = colOut;
        } else {
          // Изогнутые поля с подъёмом к бокам и верхне-левым бликом
          if (dx < -2 && dy < -1) {
            g.fillStyle = highlightColor;
          } else if (Math.abs(dy) > 4.2) {
            g.fillStyle = (dy < 0) ? highlightColor : brimColor;
          } else if (dx > 2 && dy > 1) {
            g.fillStyle = colOut;
          } else {
            g.fillStyle = brimColor;
          }
        }
        g.fillRect(x, y, 1, 1);
      }
    }

    // 2. Опоясывающая лента (hat band)
    const bandRx = 5.6;
    const bandRy = 4.2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const bd = (dx * dx) / (bandRx * bandRx) + (dy * dy) / (bandRy * bandRy);
        if (bd <= 1.0 && bd > 0.58) {
          g.fillStyle = bandColor;
          g.fillRect(x, y, 1, 1);
        }
      }
    }

    // 3. Тулья шляпы (crown) с сужением и продольным заломом (crease)
    const crownRx = 4.8;
    const crownRy = 3.2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const cd = (dx * dx) / (crownRx * crownRx) + (dy * dy) / (crownRy * crownRy);
        if (cd > 1.0) continue;

        if (cd > 0.84) {
          g.fillStyle = colOut;
        } else if (Math.abs(dy) <= 0.6 && Math.abs(dx) <= 3.6) {
          // Продольный залом по центру тульи
          g.fillStyle = colOut;
        } else if (dy < 0) {
          g.fillStyle = (dx < 0 && dy < -1) ? highlightColor : crownColor;
        } else {
          g.fillStyle = colOut;
        }
        g.fillRect(x, y, 1, 1);
      }
    }

    // 1-2px верхне-левые акцентные блики
    g.fillStyle = highlightColor;
    g.fillRect(cx - 3, cy - 3, 2, 1);
    g.fillRect(cx - 7, cy - 3, 2, 1);

    hatCaches[key] = c;
    return c;
  }

  function drawDetailedHat(g, hx, hy, brimColor, crownColor, bandColor, highlightColor) {
    const c = getCachedHat(brimColor, crownColor, bandColor, highlightColor);
    g.drawImage(c, Math.round(hx - 13), Math.round(hy - 13));
  }

  // Offscreen-кэш 6 сменных шляп игрока (строго в G.PAL, размер 30x30 для широкополого Сомбреро)
  const playerHatCaches = {};
  function getPlayerHatCanvas(hatId) {
    const id = hatId || 'classic';
    if (playerHatCaches[id]) return playerHatCaches[id];

    const P = getPal();
    const colOut = P.outline || '#140f0c';
    const size = 30;
    const cx = 15;
    const cy = 15;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;

    let rx = 9.5;
    let ry = 7.5;
    let brimBase = P.leather[3];
    let brimDark = P.leather[4];
    let brimHi = P.leather[0];
    let crownBase = P.leather[1];
    let crownHi = P.leather[0];
    let bandCol = P.leather[4];
    let cRx = 4.8;
    let cRy = 3.2;
    let hasCrease = true;

    if (id === 'gunslinger') {
      rx = 10.2; ry = 8.0;
      brimBase = P.woodPale[3];
      brimDark = P.leather[4];
      brimHi = P.woodPale[0];
      crownBase = P.woodPale[2];
      crownHi = P.woodPale[0];
      bandCol = P.leather[3];
    } else if (id === 'sheriff') {
      rx = 9.8; ry = 7.8;
      brimBase = P.leather[3];
      brimDark = P.leather[4];
      brimHi = P.leather[1];
      crownBase = P.leather[2];
      crownHi = P.leather[0];
      bandCol = P.leather[4];
    } else if (id === 'bowler') {
      rx = 7.2; ry = 6.2;
      brimBase = P.cloth[4];
      brimDark = P.outline;
      brimHi = P.cloth[1];
      crownBase = P.cloth[3];
      crownHi = P.cloth[0];
      bandCol = P.barnRed[1];
      cRx = 4.4; cRy = 4.2;
      hasCrease = false;
    } else if (id === 'sombrero') {
      rx = 12.6; ry = 11.4;
      brimBase = P.woodPale[2];
      brimDark = P.woodPale[3];
      brimHi = P.woodPale[0];
      crownBase = P.woodPale[1];
      crownHi = P.woodPale[0];
      bandCol = P.barnRed[1];
      cRx = 4.6; cRy = 4.2;
      hasCrease = false;
    } else if (id === 'legend') {
      rx = 11.0; ry = 9.0;
      brimBase = P.cloth[4];
      brimDark = P.outline;
      brimHi = P.brass[0];
      crownBase = P.cloth[3];
      crownHi = P.brass[0];
      bandCol = P.brass[1];
    }

    // 1. Поля шляпы
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d2 = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
        if (d2 > 1.05) continue;

        // Потрёпанные выемки на краю у шляпы стрелка
        if (id === 'gunslinger' && d2 > 0.72 && ((x === cx - 8 && y === cy + 4) || (x === cx + 9 && y === cy - 2))) {
          continue;
        }

        if (d2 > 0.85) {
          g.fillStyle = id === 'legend' ? P.brass[0] : colOut;
        } else if (id === 'legend' && d2 > 0.72) {
          g.fillStyle = P.brass[2];
        } else if (id === 'sombrero' && d2 > 0.66) {
          // Пиксельный узор на широких полях сомбреро в barnRed / brass / woodPale
          const pat = ((x + y) & 3);
          if (pat === 0) g.fillStyle = P.barnRed[0];
          else if (pat === 2) g.fillStyle = P.brass[0];
          else g.fillStyle = brimHi;
        } else {
          if (dx < -2 && dy < -1) {
            g.fillStyle = brimHi;
          } else if (Math.abs(dy) > ry * 0.56) {
            g.fillStyle = (dy < 0) ? brimHi : brimBase;
          } else if (dx > 2 && dy > 1) {
            g.fillStyle = brimDark;
          } else {
            g.fillStyle = brimBase;
          }
        }
        g.fillRect(x, y, 1, 1);
      }
    }

    // 2. Лента вокруг тульи
    const bandRx = cRx + 1.0;
    const bandRy = cRy + 1.0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const bd = (dx * dx) / (bandRx * bandRx) + (dy * dy) / (bandRy * bandRy);
        if (bd <= 1.0 && bd > 0.56) {
          g.fillStyle = bandCol;
          g.fillRect(x, y, 1, 1);
        }
      }
    }

    // 3. Тулья шляпы
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const cd = (dx * dx) / (cRx * cRx) + (dy * dy) / (cRy * cRy);
        if (cd > 1.0) continue;

        if (cd > 0.84) {
          g.fillStyle = colOut;
        } else if (hasCrease && Math.abs(dy) <= 0.6 && Math.abs(dx) <= 3.6) {
          g.fillStyle = colOut;
        } else if (dy < 0) {
          g.fillStyle = (dx < 0 && dy < -1) ? crownHi : crownBase;
        } else {
          g.fillStyle = id === 'sombrero' ? P.woodPale[3] : (id === 'bowler' ? P.cloth[4] : colOut);
        }
        g.fillRect(x, y, 1, 1);
      }
    }

    // Детализированные акценты конкретных моделей
    if (id === 'sheriff') {
      // Аккуратная чёткая золотая полоска на тулье без золотой обводки по периметру
      g.fillStyle = P.brass[1];
      g.fillRect(cx - 3, cy + 1, 7, 1);
      g.fillStyle = P.brass[0];
      g.fillRect(cx - 2, cy + 1, 1, 1);
    } else if (id === 'bowler') {
      // Изогнутый блик купольного котелка
      g.fillStyle = P.cloth[0];
      g.fillRect(cx - 2, cy - 2, 3, 1);
      g.fillRect(cx - 3, cy - 1, 1, 2);
    } else if (id === 'sombrero') {
      g.fillStyle = P.brass[0];
      g.fillRect(cx - 1, cy - 1, 2, 2);
    } else if (id === 'legend') {
      g.fillStyle = P.brass[0];
      g.fillRect(cx - 3, cy - 2, 2, 1);
      g.fillStyle = '#ffffff';
      g.fillRect(cx - 3, cy - 2, 1, 1);
    } else {
      g.fillStyle = crownHi;
      g.fillRect(cx - 3, cy - 3, 2, 1);
      g.fillRect(cx - 7, cy - 3, 2, 1);
    }

    playerHatCaches[id] = c;
    return c;
  }

  function drawPlayerHat(g, hx, hy, hatId) {
    const c = getPlayerHatCanvas(hatId || G.CFG.selectedHat || 'classic');
    g.drawImage(c, Math.round(hx - 15), Math.round(hy - 15));
  }

  function drawStunStars(g, x, y, P) {
    const t = state ? state.time : 0;
    for (let i = 0; i < 3; i++) {
      const a = t * 9.0 + i * 2.0944;
      const sx = Math.round(x + Math.cos(a) * 8);
      const sy = Math.round(y - 14 + Math.sin(a) * 3.5);
      g.fillStyle = P.outline || '#140f0c';
      g.fillRect(sx - 2, sy - 2, 4, 4);
      g.fillStyle = P.brass[0];
      g.fillRect(sx - 1, sy - 1, 2, 2);
      g.fillStyle = '#fff9df';
      g.fillRect(sx - 1, sy - 1, 1, 1);
    }
  }

  function drawBanditAlive(g, t) {
    const P = getPal();
    const wob = t.wobble > 0 ? Math.sin(state.time * 44) * t.wobble * 2.2 : 0;
    const tx = Math.round(t.x + wob);
    const ty = Math.round(t.y);
    const crouchF = G.MATH.clamp(t.crouchFrac || 0, 0, 1);
    const raiseFrac = G.MATH.clamp(t.wallRaiseFrac || 0, 0, 1);
    const walking = !crouchF && !t.inCover && !t.isDodging;
    const stride = walking ? Math.sin(t.walkPhase || 0) * 3.2 : 0;
    const sway = walking ? Math.sin(t.walkPhase || 0) * 0.07 : 0;
    const hurt = t.hurtTimer > 0;
    const scale = t.tough ? 1.12 : 1.0;
    const colOut = P.outline || '#140f0c';

    // Контактная тень (в приседе чуть компактнее)
    g.fillStyle = `rgba(18, 12, 9, ${0.42 + crouchF * 0.08})`;
    g.beginPath();
    g.ellipse(
      tx + Math.round(SUN.dx * (6 - crouchF * 2)),
      ty + Math.round(SUN.dy * (6 - crouchF * 2)),
      (9 - crouchF * 1.3) * scale,
      (8 - crouchF * 0.9) * scale,
      0.3,
      0,
      Math.PI * 2
    );
    g.fill();

    g.save();
    g.translate(tx, ty);
    g.scale(scale * (1 - crouchF * 0.14), scale * (1 - crouchF * 0.08));
    // В уклонении корпус резко кренится вбок
    const dodgeTilt = t.isDodging ? Math.sin(state.time * 24) * 0.22 : 0;
    g.rotate((t.angle || 0) + sway + dodgeTilt + (hurt ? -0.20 : 0));

    // Сапоги (в приседе поджаты под корпус)
    if (crouchF < 0.6) {
      g.fillStyle = colOut;
      g.fillRect(Math.round(-2 + stride), -6, 5, 3);
      g.fillRect(Math.round(-2 - stride), 3, 5, 3);
    }

    // Пальто / плащ бандита (скруглённый пиксельный силуэт)
    const coatLag = Math.round(Math.sin((t.walkPhase || 0) * 2) * 1.0 * (1 - crouchF));
    g.fillStyle = colOut;
    fillRoundPix(g, -10 + Math.round(crouchF * 2), -7 + coatLag, 4, 14);
    g.fillStyle = t.coatColor;
    fillRoundPix(g, -9 + Math.round(crouchF * 2), -6 + coatLag, 3, 12);

    // Поэтапный 3D-подъём ствола бандита без уродливого линейного сжатия
    const pitchAng = raiseFrac * (Math.PI * 0.45);
    const cosPitch = Math.cos(pitchAng);
    const sinPitch = Math.sin(pitchAng);
    const pullX = Math.round(raiseFrac * 3.8);
    const pullY = Math.round(raiseFrac * 1.8);

    const gunY = 4 - pullY;
    const wId = t.weaponId || (t.gunType === 'rifle' ? 'winchester' : 'walker');
    const isRifle = wId === 'winchester';
    const isWalker = wId === 'walker';
    const kick = Math.round((t.recoilKickAnim || 0) * (isRifle ? 2.5 : 2.0));
    const reloadShift = Math.round((t.reloadOpenFrac || 0) * 1.6);

    // Правое предплечье/кисть сгибаются к груди (при ранении в руку — кровавый след на рукаве)
    g.fillStyle = t.coatColor;
    g.fillRect(Math.round(2 - pullX * 0.5 - kick * 0.5), Math.round(3 - pullY * 0.5), 5, 4);
    if (t.armWounded) {
      g.fillStyle = P.blood[0];
      g.fillRect(Math.round(3 - pullX * 0.5 - kick * 0.5), Math.round(3 - pullY * 0.5), 3, 2);
      g.fillStyle = P.blood[1];
      g.fillRect(Math.round(4 - pullX * 0.5 - kick * 0.5), Math.round(5 - pullY * 0.5), 2, 1);
    }
    g.fillStyle = P.skin ? P.skin[1] : '#c49876';
    g.fillRect(Math.round(5 - pullX * 0.7 - kick), Math.round(3.5 - pullY * 0.5), 3, 3);

    let tipX = 15;
    if (isRifle) {
      // Левая рука тянется от левого плеча (-2, -7) к цевью винтовки
      g.fillStyle = t.coatColor;
      g.fillRect(-1, -6, 5, 4);
      g.fillRect(Math.round(3 - pullX * 0.4 - kick * 0.5), Math.round(-3 - pullY * 0.4), 5, 4);
      g.fillStyle = P.skin ? P.skin[1] : '#c49876';
      g.fillRect(Math.round(7 - pullX * 0.6 - kick), Math.round(1 - pullY * 0.5), 3, 3);

      const recX = Math.round(1 - pullX * 0.5 - kick);
      const barStart = recX + Math.max(3, Math.round(8 * cosPitch));
      const gunLenR = Math.max(2, Math.round(12 * cosPitch));
      tipX = barStart + gunLenR;

      g.fillStyle = P.woodWarm[2];
      g.fillRect(recX, gunY, Math.max(3, barStart - recX), 2);
      g.fillStyle = P.steelDark[4];
      g.fillRect(barStart, gunY, gunLenR, 2);
      g.fillStyle = P.steelDark[1];
      g.fillRect(barStart, gunY, Math.max(1, gunLenR - 1), 1);
      if (t.reloadOpenFrac > 0.25) {
        g.fillStyle = P.brass[0];
        g.fillRect(recX + 2, gunY - 1, 2, 1);
      }
      if (sinPitch > 0.35) {
        g.fillStyle = P.steelDark[0];
        g.fillRect(barStart, gunY - 1, Math.max(2, gunLenR), 1);
      }
    } else {
      const baseLen = isWalker ? 9 : 6;
      const barStart = Math.round(7 - pullX * 0.6 - kick);
      const gunLenP = Math.max(2, Math.round(baseLen * cosPitch));
      tipX = barStart + gunLenP;
      const ramp = isWalker ? P.steelLight : P.steelDark;
      g.fillStyle = ramp[3];
      g.fillRect(barStart, gunY, gunLenP, 2);
      g.fillStyle = ramp[1];
      g.fillRect(barStart + 1, gunY, Math.max(1, gunLenP - 1), 1);
      if (t.reloadOpenFrac > 0.25) {
        // Откинутый барабан при перезарядке бандита
        g.fillStyle = P.brass[1];
        g.fillRect(barStart - 1, gunY + reloadShift, 2, 2);
      }
      if (sinPitch > 0.35) {
        g.fillStyle = ramp[0];
        g.fillRect(barStart, gunY - 1, Math.max(2, gunLenP), 1);
      }
    }
    if (t.flashTimer > 0 && raiseFrac < 0.45) {
      g.fillStyle = '#fff5c0';
      g.fillRect(tipX, gunY - 1, 3, 3);
      g.fillStyle = P.brass[0];
      g.fillRect(tipX + 2, gunY, 2, 1);
    }

    // Тело (скруглённые пиксельные углы + группировка плеч в приседе)
    g.fillStyle = t.hitFlash > 0 ? '#f2dfb8' : colOut;
    fillRoundPix(g, -7, -10, 14, 20);
    g.fillStyle = t.hitFlash > 0 ? '#fff2d4' : t.coatColor;
    fillRoundPix(g, -6, -9, 12, 18);
    g.fillStyle = t.coatTrim;
    fillRoundPix(g, -5, -8, 6, 5);
    fillRoundPix(g, -5, 3, 6, 5);
    if (crouchF > 0.3) {
      // Пригнутые плечи прижаты к укрытию
      g.fillStyle = t.coatTrim;
      g.fillRect(-5, -10, 10, 2);
    }
    g.fillStyle = colOut;
    g.fillRect(-3, -6, 1, 12);
    g.fillStyle = P.woodWarm[1];
    g.fillRect(-4, -2, 6, 2);

    // Бандана
    g.fillStyle = t.bandana;
    g.fillRect(1, -4, 3, 8);
    g.fillStyle = colOut;
    g.fillRect(0, -4, 1, 8);

    // Овальная шляпа бандита (в приседе ниже к краю укрытия)
    const hx = -1 + Math.round(crouchF * 1.5);
    drawDetailedHat(g, hx, 0, t.hatColor, t.coatTrim, t.hatBand, t.tough ? P.leather[1] : P.leather[0]);

    // Верхняя фаза подъёма ствола (дульный срез и мушка)
    if (raiseFrac > 0.38) {
      drawUpturnedMuzzle(
        g,
        t.gunType === 'rifle' ? { id: 'winchester' } : { id: 'lightning' },
        raiseFrac,
        t.gunType === 'rifle' ? 9 : 8,
        5
      );
    }

    // Телеграф прицеливания (блеск ствола при наведении на игрока)
    if (t.telegraphFrac > 0 && raiseFrac < 0.45) {
      const isRifle = t.gunType === 'rifle';
      const gx = Math.round((isRifle ? 21 : 14) - raiseFrac * 6);
      const gy = gunY;
      const glintPulse = Math.sin(state.time * 26) > 0;
      g.fillStyle = glintPulse ? '#ffffff' : P.brass[0];
      g.fillRect(gx, gy - 1, 2, 2);
      if (t.telegraphFrac > 0.6) {
        g.fillStyle = '#ffffff';
        g.fillRect(gx - 1, gy, 4, 1);
        g.fillRect(gx + 1, gy - 2, 1, 4);
      }
    }

    g.restore();

    if (t.hp < t.maxHp || t.tough) {
      const bw = t.tough ? 26 : 20;
      const frac = G.MATH.clamp(t.hp / t.maxHp, 0, 1);
      const bx = Math.round(tx - bw * 0.5);
      const by = Math.round(ty - (t.tough ? 20 : 17));
      g.fillStyle = colOut;
      g.fillRect(bx - 1, by - 1, bw + 2, 4);
      g.fillStyle = '#331614';
      g.fillRect(bx, by, bw, 2);
      g.fillStyle = t.tough ? P.grass[0] : P.blood[0];
      g.fillRect(bx, by, Math.max(1, Math.round(bw * frac)), 2);
    }
    if (t.reloading) {
      const rw = 14;
      const rFrac = G.MATH.clamp((t.ammo || 0) / Math.max(1, t.maxAmmo || 6), 0, 1);
      const rx = Math.round(tx - rw * 0.5);
      const ry = Math.round(ty - (t.tough ? 24 : 21));
      g.fillStyle = colOut;
      g.fillRect(rx - 1, ry - 1, rw + 2, 3);
      g.fillStyle = P.woodWarm[3];
      g.fillRect(rx, ry, rw, 1);
      g.fillStyle = P.brass[0];
      g.fillRect(rx, ry, Math.max(1, Math.round(rw * rFrac)), 1);
    }
    if (t.stunTimer > 0) {
      drawStunStars(g, tx, ty, P);
    }
  }

  function drawFlyingHats(g, org) {
    if (!state.flyingHats || !state.flyingHats.length) return;
    const P = getPal();
    for (let i = 0; i < state.flyingHats.length; i++) {
      const h = state.flyingHats[i];
      if (org && !isInView(h.x - 10, h.y - 16, 20, 24, org, 24)) continue;
      g.fillStyle = 'rgba(18, 12, 8, 0.36)';
      g.fillRect(
        Math.round(h.x + SUN.dx * (2 + h.z * 0.3) - 5),
        Math.round(h.y + SUN.dy * (2 + h.z * 0.3) - 4),
        10,
        8
      );

      g.save();
      g.translate(Math.round(h.x), Math.round(h.y - h.z * 0.48));
      g.rotate(h.rot);
      drawDetailedHat(g, 0, 0, h.hatColor, P.leather[3], h.hatBand, P.leather[0]);
      g.restore();
    }
  }

  function drawDeadBandits(g, org) {
    if (G.CFG.spawnBandits === false) return;
    for (let i = 0; i < world.targets.length; i++) {
      const t = world.targets[i];
      if (t.kind === 'bandit' && !t.alive) {
        if (org && !isInView(t.x - 24, t.y - 24, 48, 48, org, 32)) continue;
        drawBanditDead(g, t);
      }
    }
  }

  function drawTargets(g, org) {
    const P = getPal();
    for (let i = 0; i < world.targets.length; i++) {
      const t = world.targets[i];
      if (!t.alive) continue;
      if (org && !isInView(t.x - 20, t.y - 20, 40, 40, org, 32)) continue;

      if (t.kind === 'bandit') {
        if (G.CFG.spawnBandits !== false) drawBanditAlive(g, t);
        continue;
      }

      const wob = t.wobble > 0 ? Math.sin(state.time * 42) * t.wobble * 2.4 : 0;
      const tx = Math.round(t.x + wob);
      const ty = Math.round(t.y);

      if (t.kind === 'bottle') {
        // Пиксельная бутылка: корпус, горлышко, пробка и блик стекла (только G.PAL)
        const colOut = P.outline || '#140f0c';
        const isGreen = t.id % 3 !== 0;
        const bodyCol = isGreen ? P.foliage[2] : P.woodWarm[2];
        const bodyLit = isGreen ? P.foliage[1] : P.woodWarm[1];

        g.fillStyle = 'rgba(20, 14, 9, 0.34)';
        g.fillRect(tx + 1, ty + 2, 6, 2);

        // Корпус
        g.fillStyle = colOut;
        g.fillRect(tx - 3, ty - 2, 6, 5);
        g.fillStyle = bodyCol;
        g.fillRect(tx - 2, ty - 1, 4, 4);
        g.fillStyle = bodyLit;
        g.fillRect(tx - 2, ty - 1, 2, 3);

        // Горлышко и пробка
        g.fillStyle = colOut;
        g.fillRect(tx - 2, ty - 5, 4, 4);
        g.fillStyle = bodyCol;
        g.fillRect(tx - 1, ty - 4, 2, 3);
        g.fillStyle = P.woodPale[1];
        g.fillRect(tx - 1, ty - 6, 2, 1);
        g.fillStyle = colOut;
        g.fillRect(tx - 1, ty - 7, 2, 1);

        // Блик стекла
        g.fillStyle = P.glass[0];
        g.fillRect(tx - 1, ty - 1, 1, 2);
        g.fillRect(tx - 4, ty, 1, 1);
      }
    }
  }

  function drawShells(g, org) {
    const P = getPal();
    for (let i = 0; i < state.shells.length; i++) {
      const sh = state.shells[i];
      if (org && !isInView(sh.x - 6, sh.y - 10, 12, 16, org, 16)) continue;
      g.fillStyle = 'rgba(20, 15, 12, 0.45)';
      g.fillRect(
        Math.round(sh.x + SUN.dx * (1.5 + sh.z * 0.25) - 2),
        Math.round(sh.y + SUN.dy * (1.5 + sh.z * 0.25) - 1),
        5,
        2
      );

      g.save();
      g.translate(Math.round(sh.x), Math.round(sh.y - sh.z * 0.45));
      g.rotate(sh.rot);

      // Латунная гильза с фланцем, проточкой и открытым дульцем
      g.fillStyle = P.brass[2];
      g.fillRect(-3, -1.5, 1, 3);
      g.fillStyle = P.brass[0];
      g.fillRect(-3, -1.5, 1, 1);
      g.fillStyle = P.brass[1];
      g.fillRect(-2, -1, 4, 2);
      g.fillStyle = P.brass[0];
      g.fillRect(-2, -1, 4, 1);
      g.fillStyle = P.outline || '#140f0c';
      g.fillRect(2, -1, 1, 2);

      g.restore();
    }
  }

  // ==================== ОРУЖИЕ, ОТКИДЫВАНИЕ БАРАБАНА НА МОДЕЛИ И КОВБОЙ ====================

  // Попиксельный диск (без arc/сглаживания) — для ракурса дульного среза
  function pxDisc(g, cx, cy, r, color) {
    g.fillStyle = color;
    const rr = Math.round(r);
    for (let dy = -rr; dy <= rr; dy++) {
      const w = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      if (w <= 0) continue;
      g.fillRect(cx - w, cy + dy, w * 2, 1);
    }
  }

  function drawSleeveSpan(g, x1, y1, x2, y2, thickness, colFill, colHi, colOut) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(3, Math.ceil(dist * 0.7));
    const r = Math.max(1, thickness);
    g.fillStyle = colOut;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      g.fillRect(Math.round(x1 + (x2 - x1) * k - r - 1), Math.round(y1 + (y2 - y1) * k - r - 1), r * 2 + 2, r * 2 + 2);
    }
    g.fillStyle = colFill;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      g.fillRect(Math.round(x1 + (x2 - x1) * k - r), Math.round(y1 + (y2 - y1) * k - r), r * 2, r * 2);
    }
    if (colHi) {
      g.fillStyle = colHi;
      for (let i = 0; i <= steps; i++) {
        const k = i / steps;
        g.fillRect(Math.round(x1 + (x2 - x1) * k - r), Math.round(y1 + (y2 - y1) * k - r), r * 2, 1);
      }
    }
  }

  function drawUpturnedMuzzle(g, w, wallFrac, mx, my) {
    if (wallFrac <= 0.32) return;
    const vis = G.MATH.clamp((wallFrac - 0.32) / 0.68, 0, 1);
    const P = getPal();
    const colOut = P.outline || '#140f0c';

    g.save();
    g.translate(Math.round(mx), Math.round(my));
    g.globalAlpha = vis;

    const isWin = w.id === 'winchester';
    const isWalker = w.id === 'walker';
    const outerR = isWin ? 4.4 : (isWalker ? 4.0 : 3.6);

    // Короткая тень на груди и правом плече героя под вертикально прижатым стволом
    g.fillStyle = 'rgba(14, 10, 8, 0.48)';
    g.fillRect(-outerR - 2, 0, outerR * 2 + 3, outerR + 5);

    if (isWin) {
      // Прижатая к груди латунная ствольная коробка и деревянное цевьё в обхвате левой руки
      g.fillStyle = colOut;
      g.fillRect(-7, 1, 11, 6);
      g.fillStyle = P.brass[2];
      g.fillRect(-6, 2, 5, 4);
      g.fillStyle = P.brass[0];
      g.fillRect(-6, 2, 5, 1);
      g.fillStyle = P.woodWarm[2];
      g.fillRect(-1, 2, 4, 4);
      g.fillStyle = P.woodWarm[0];
      g.fillRect(-1, 2, 4, 1);
      // Левая кисть обхватывает прижатое к груди цевьё
      g.fillStyle = colOut;
      g.fillRect(-1, 0, 4, 4);
      g.fillStyle = P.skin ? P.skin[1] : '#c49876';
      g.fillRect(0, 1, 3, 2);

      // Круглый дульный срез строго вверх в камеру + подствольная трубка магазина
      pxDisc(g, 1, 0, outerR, colOut);
      pxDisc(g, 1, 0, outerR - 1, P.steelDark[2]);
      pxDisc(g, 1, 0, outerR - 2, P.steelDark[1]);
      // Подствольная трубка спереди ствола
      g.fillStyle = colOut;
      g.fillRect(2, -4, 3, 3);
      g.fillStyle = P.steelDark[1];
      g.fillRect(2, -3, 2, 2);
      // Тёмный канал ствола + блик фаски + латунная мушка
      g.fillStyle = '#0a0807';
      g.fillRect(0, -1, 3, 3);
      g.fillStyle = P.steelLight[0];
      g.fillRect(-1, -2, 2, 1);
      g.fillStyle = P.brass[0];
      g.fillRect(1, -outerR - 1, 1, 2);
    } else if (isWalker) {
      // Прижатый к груди массивный барабан Уолкера и рукоять
      g.fillStyle = colOut;
      g.fillRect(-6, 2, 9, 5);
      g.fillStyle = P.woodWarm[1];
      g.fillRect(-6, 3, 3, 3);
      g.fillStyle = P.steelLight[2];
      g.fillRect(-3, 2, 6, 4);
      g.fillStyle = P.steelLight[0];
      g.fillRect(-3, 2, 6, 1);

      pxDisc(g, 1, -1, outerR, colOut);
      pxDisc(g, 1, -1, outerR - 1, P.steelLight[2]);
      pxDisc(g, 1, -1, outerR - 2, P.steelLight[1]);
      // Контрастный канал ствола, блик фаски и латунная мушка
      g.fillStyle = '#0a0807';
      g.fillRect(0, -2, 2, 2);
      g.fillStyle = '#ffffff';
      g.fillRect(-1, -3, 2, 1);
      g.fillStyle = P.brass[0];
      g.fillRect(1, -4, 1, 1);
    } else {
      // Компактный Lightning: прижатая вороненая рамка/барабан и поднятый ствол
      g.fillStyle = colOut;
      g.fillRect(-5, 2, 8, 4);
      g.fillStyle = P.steelDark[2];
      g.fillRect(-4, 3, 6, 3);
      g.fillStyle = P.steelDark[0];
      g.fillRect(-4, 3, 5, 1);

      pxDisc(g, 1, -1, outerR, colOut);
      pxDisc(g, 1, -1, outerR - 1, P.steelDark[2]);
      pxDisc(g, 1, -1, outerR - 2, P.steelDark[1]);
      g.fillStyle = '#0a0807';
      g.fillRect(0, -2, 2, 2);
      g.fillStyle = P.steelLight[0];
      g.fillRect(-1, -3, 1, 1);
    }

    g.restore();
  }

  function drawWeapon(g, w, ws, p) {
    const P = getPal();
    const colOut = P.outline || '#140f0c';
    const kick = (p.recoilKickAnim || 0) * 3.0;
    const cockProg = ws.cockTimer > 0 && ws.cockDuration > 0
      ? 1 - ws.cockTimer / ws.cockDuration
      : 0;
    const tuck = G.MATH.clamp((p.coverFrac || 0) * (1 - (p.peekFrac || 0)), 0, 1);
    const drinkTuck = p.drinking ? 0.92 : 0;
    const wallFrac = Math.max(p.wallRaiseFrac || 0, tuck, drinkTuck);
    const walkBob = p.speed > 12 && !p.rolling && !p.inCover ? Math.sin(p.walkPhase || 0) * 0.7 : 0;
    const cylSwing = ws.reloading && w.uiShape === 'cylinder' ? (ws.reloadOpenFrac || 0) : 0;

    // 3-фазный физический подъём ствола вверх с прижатием приклада/локтей к груди и правому плечу
    const pitchAng = wallFrac * (Math.PI * 0.46);
    const cosPitch = Math.cos(pitchAng);
    const sinPitch = Math.sin(pitchAng);
    const pullBack = wallFrac * 6.0;
    const pullInY = wallFrac * 2.8;

    g.save();
    const ox = 6 - pullBack;
    const oy = 4.5 + walkBob - pullInY;
    g.translate(Math.round(ox), Math.round(oy));

    // Якорные точки плеч игрока в локальной системе оружия
    const lShoulderX = -2 - ox;
    const lShoulderY = -7.5 - oy;
    const rShoulderX = -2 - ox;
    const rShoulderY = 7.5 - oy;

    if (cylSwing > 0.05) {
      g.rotate(cylSwing * 0.38);
      g.translate(cylSwing * 2.2, cylSwing * 1.5);
    }

    if (ws.reloading) {
      const ins = ws.insertAnim > 0 ? Math.sin((ws.insertAnim / w.reloadOneTime) * Math.PI) : 0;
      g.rotate(-0.42 - ins * 0.14);
      g.translate(-2, -2);
    } else if (w.action === 'lever' && ws.cockTimer > 0) {
      const swing = Math.sin(cockProg * Math.PI);
      g.rotate(-swing * 0.06);
      g.translate(-swing * 2.2, 0);
    } else if (w.action === 'sa' && ws.cockTimer > 0) {
      const pull = Math.sin(cockProg * Math.PI);
      g.rotate(-pull * 0.12);
    }

    g.translate(-kick, 0);

    const sleeveMid = P.cloth ? P.cloth[1] : '#35424f';
    const sleeveDark = P.cloth ? P.cloth[2] : '#232d38';
    const sleeveHi = P.cloth ? P.cloth[0] : '#4f5e6e';
    const skinMid = P.skin ? P.skin[1] : '#c49876';
    const skinHi = P.skin ? P.skin[0] : '#deb592';
    const smoking = !!(p.smokingState);
    if (smoking) {
      g.rotate(0.10);
      g.translate(-1, 1);
    }

    // При упоре в стену короткая тень оружия ложится на правое плечо/грудь
    if (wallFrac > 0.35) {
      g.fillStyle = 'rgba(14, 10, 8, 0.34)';
      g.fillRect(-3, -2, 8, 6);
    }

    if (w.id === 'walker') {
      const cylLen = Math.max(3, Math.round(7 * cosPitch));
      const bStart = 2 + cylLen;
      const bLen = Math.max(2, Math.round((w.barrelLen - 9) * cosPitch));

      // Левая поддерживающая рука (прижатие локтя к корпусу при wallFrac -> 1)
      const handX = Math.round(bStart - 3);
      const handY = 2;
      if (!smoking) {
        const elX = Math.round((lShoulderX + handX) * 0.42 - sinPitch * 2.5);
        const elY = Math.round((lShoulderY + handY) * 0.52 + wallFrac * 2.5);
        drawSleeveSpan(g, lShoulderX, lShoulderY, elX, elY, 2, sleeveMid, sleeveHi, colOut);
        drawSleeveSpan(g, elX, elY, handX, handY, 2, sleeveDark, null, colOut);
      }

      // Правый локоть сгибается и подтягивается вплотную к корпусу
      const rElX = Math.round(rShoulderX - sinPitch * 2.0);
      const rElY = Math.round(rShoulderY - wallFrac * 3.0);
      drawSleeveSpan(g, rShoulderX, rShoulderY, rElX, rElY, 2, sleeveMid, sleeveHi, colOut);
      drawSleeveSpan(g, rElX, rElY, -1, 1, 2, sleeveDark, null, colOut);

      // Рукоять и рамка револьвера Кольт Уолкер
      g.fillStyle = P.woodWarm[1];
      g.fillRect(-3, -1, Math.max(2, Math.round(3 * cosPitch)), 2);
      g.fillStyle = colOut;
      g.fillRect(-2, -2, 4, 4);
      g.fillStyle = P.steelLight[2];
      g.fillRect(-1, -1, 3, 3);

      // Барабан
      g.fillStyle = colOut;
      g.fillRect(2, -2, cylLen, 5);
      g.fillStyle = P.steelLight[1];
      g.fillRect(2, -1, Math.max(2, cylLen - 1), 3);
      g.fillStyle = P.steelLight[0];
      g.fillRect(2, -1, Math.max(2, cylLen - 1), 1);

      // Ствол
      const liftY = -Math.round(sinPitch * 1.5);
      g.fillStyle = colOut;
      g.fillRect(bStart, -1.5 + liftY, bLen + 1, 3);
      g.fillStyle = P.steelLight[1];
      g.fillRect(bStart, -1 + liftY, bLen, 2);
      g.fillStyle = sinPitch > 0.35 ? '#ffffff' : P.steelLight[0];
      g.fillRect(bStart, -1 + liftY, bLen, 1);

      if (!smoking) {
        g.fillStyle = colOut;
        g.fillRect(handX - 1, handY - 1, 5, 4);
        g.fillStyle = skinMid;
        g.fillRect(handX, handY, 4, 3);
        g.fillStyle = skinHi;
        g.fillRect(handX, handY, 3, 1);
      }

      if (wallFrac <= 0.55) {
        g.fillStyle = P.brass[0];
        g.fillRect(bStart + bLen - 1, -1 + liftY - Math.round(sinPitch * 1.5), 1, 1);
      }

      const hammerBack = ws.cocked ? 1 : (ws.cockTimer > 0 ? cockProg : 0);
      g.fillStyle = P.steelLight[3];
      g.fillRect(Math.round(3.5 - hammerBack * 2.0), -1 - Math.round(sinPitch * 1.5), 2, 2);

      if (ws.cockTimer > 0) {
        const reach = Math.sin(cockProg * Math.PI);
        g.fillStyle = skinMid;
        g.fillRect(Math.round(3 + reach * 2), Math.round(-6 + reach * 4.5), 3, 3);
      }
    } else if (w.id === 'lightning') {
      const cylLen = Math.max(3, Math.round(6 * cosPitch));
      const bStart = 2 + cylLen;
      const bLen = Math.max(2, Math.round((w.barrelLen - 8) * cosPitch));

      const handL = Math.round(bStart - 3);
      const handY = 2;
      if (!smoking) {
        const elX = Math.round((lShoulderX + handL) * 0.42 - sinPitch * 2.5);
        const elY = Math.round((lShoulderY + handY) * 0.52 + wallFrac * 2.5);
        drawSleeveSpan(g, lShoulderX, lShoulderY, elX, elY, 2, sleeveMid, sleeveHi, colOut);
        drawSleeveSpan(g, elX, elY, handL, handY, 2, sleeveDark, null, colOut);
      }
      const rElX = Math.round(rShoulderX - sinPitch * 2.0);
      const rElY = Math.round(rShoulderY - wallFrac * 3.0);
      drawSleeveSpan(g, rShoulderX, rShoulderY, rElX, rElY, 2, sleeveMid, sleeveHi, colOut);
      drawSleeveSpan(g, rElX, rElY, -1, 1, 2, sleeveDark, null, colOut);

      g.fillStyle = P.woodWarm[3];
      g.fillRect(-3, -1, Math.max(2, Math.round(3 * cosPitch)), 2);
      g.fillStyle = colOut;
      g.fillRect(-1, -2, 4, 4);
      g.fillStyle = P.steelDark[2];
      g.fillRect(0, -1, 3, 3);

      g.fillStyle = colOut;
      g.fillRect(2, -2, cylLen, 4);
      g.fillStyle = P.steelDark[1];
      g.fillRect(2, -1, Math.max(2, cylLen - 1), 3);
      g.fillStyle = P.steelDark[0];
      g.fillRect(2, -1, Math.max(2, cylLen - 1), 1);

      const liftY = -Math.round(sinPitch * 1.5);
      g.fillStyle = colOut;
      g.fillRect(bStart, -1.5 + liftY, bLen + 1, 3);
      g.fillStyle = P.steelDark[1];
      g.fillRect(bStart, -1 + liftY, bLen, 2);
      g.fillStyle = P.steelDark[0];
      g.fillRect(bStart, -1 + liftY, bLen, 1);

      if (!smoking) {
        g.fillStyle = colOut;
        g.fillRect(handL - 1, handY - 1, 5, 4);
        g.fillStyle = skinMid;
        g.fillRect(handL, handY, 4, 3);
        g.fillStyle = skinHi;
        g.fillRect(handL, handY, 3, 1);
      }

      if (wallFrac <= 0.55) {
        g.fillStyle = P.steelDark[0];
        g.fillRect(bStart + bLen - 1, -1 + liftY - Math.round(sinPitch * 1.5), 1, 1);
      }

      const pull = ws.daPullTimer > 0 ? 1 - ws.daPullTimer / w.triggerPullTime : 0;
      g.fillStyle = P.steelDark[0];
      g.fillRect(Math.round(3.5 - pull * 2), -1 - Math.round(sinPitch * 1.5), 2, 1);
    } else {
      // ==================== ВИНЧЕСТЕР 1873: ДВУРУЧНЫЙ ХВАТ И ПРИЖАТИЕ К ГРУДИ У СТЕН ====================
      const stockLen = Math.max(3, Math.round(8 * cosPitch));
      const stockStart = -3;
      const recStart = stockStart + stockLen;
      const recW = Math.max(3, Math.round(6 * cosPitch));
      const barX = recStart + recW - 1;
      const foreLen = Math.max(2, Math.round(8 * cosPitch));
      const steelLen = Math.max(3, Math.round((w.barrelLen - 13) * cosPitch));
      const liftY = -Math.round(sinPitch * 1.5);

      const foreMidX = Math.round(barX + foreLen * 0.55);
      const foreMidY = Math.round(1 + liftY * 0.5);
      const swing = ws.cockTimer > 0 ? Math.sin(cockProg * Math.PI) : 0;
      const rHandX = Math.round(recStart - 1 - swing * 2.5);
      const rHandY = Math.round(2 + swing * 3.8);

      // 1. ЛЕВАЯ РУКА: прижатый к телу локоть при wallFrac -> 1 ведёт к цевью
      if (!smoking) {
        const lElX = Math.round(lShoulderX + (foreMidX - lShoulderX) * 0.42 - sinPitch * 3.0);
        const lElY = Math.round(lShoulderY + (foreMidY - lShoulderY) * 0.50 + wallFrac * 2.8);
        drawSleeveSpan(g, lShoulderX, lShoulderY, lElX, lElY, 2, sleeveMid, sleeveHi, colOut);
        drawSleeveSpan(g, lElX, lElY, foreMidX, foreMidY + 1, 2, sleeveDark, null, colOut);
      }

      // 2. ПРАВАЯ РУКА: локоть подтягивается вплотную к правому боку, кисть держит шейку приклада
      const rElX = Math.round((rShoulderX + rHandX) * 0.46 - sinPitch * 2.4);
      const rElY = Math.round((rShoulderY + rHandY) * 0.5 + 1.5 - wallFrac * 2.4);
      drawSleeveSpan(g, rShoulderX, rShoulderY, rElX, rElY, 2, sleeveMid, sleeveHi, colOut);
      drawSleeveSpan(g, rElX, rElY, rHandX, rHandY, 2, sleeveDark, null, colOut);

      // Приклад (woodWarm)
      g.fillStyle = colOut;
      g.fillRect(stockStart, -2, stockLen + 1, 4);
      g.fillStyle = P.woodWarm[1];
      g.fillRect(stockStart + 1, -1, Math.max(2, stockLen - 1), 2);
      g.fillStyle = P.woodWarm[0];
      g.fillRect(stockStart + 1, -1, Math.max(2, stockLen - 1), 1);

      // Латунная ствольная коробка (в фазе 2 видны верхняя грань коробки и окно подачи)
      g.fillStyle = colOut;
      g.fillRect(recStart, -2 + Math.round(liftY * 0.4), recW + 1, 5);
      g.fillStyle = P.brass[2];
      g.fillRect(recStart + 1, -1 + Math.round(liftY * 0.4), Math.max(2, recW - 1), 3);
      g.fillStyle = P.brass[0];
      g.fillRect(recStart + 1, -1 + Math.round(liftY * 0.4), Math.max(2, recW - 1), 1);

      // Курок
      const hammerBack = ws.cocked ? 1 : (ws.cockTimer > 0 ? cockProg : 0);
      g.fillStyle = P.steelDark[1];
      g.fillRect(Math.round(recStart - 1 - hammerBack * 1.5), -2 + liftY, 2, 2);

      // Деревянное цевьё + латунное кольцо
      g.fillStyle = colOut;
      g.fillRect(barX, -2 + liftY, foreLen, 4);
      g.fillStyle = P.woodWarm[1];
      g.fillRect(barX, -2 + liftY, foreLen, 3);
      g.fillStyle = P.woodWarm[0];
      g.fillRect(barX, -2 + liftY, foreLen, 1);
      g.fillStyle = P.brass[1];
      g.fillRect(barX + foreLen - 2, -2 + liftY, 2, 3);

      // Воронёный ствол и трубка магазина (световой блик усиливается при подъёме)
      g.fillStyle = P.steelDark[3];
      g.fillRect(barX, -1 + liftY, steelLen + 1, 3);
      g.fillStyle = P.steelDark[1];
      g.fillRect(barX, -1 + liftY, steelLen, 2);
      g.fillStyle = sinPitch > 0.35 ? '#ffffff' : P.steelDark[0];
      g.fillRect(barX, -1 + liftY, steelLen, 1);
      if (wallFrac <= 0.55) {
        g.fillStyle = P.brass[0];
        g.fillRect(barX + steelLen - 1, -1 + liftY - Math.round(sinPitch * 1.5), 1, 1);
      }

      // Характерная скоба Генри снизу коробки
      const lx = Math.round(recStart + 1 - swing * 2.5);
      const ly = Math.round(2 + swing * 4.5);
      g.fillStyle = colOut;
      g.fillRect(lx, ly, 4, 3);
      g.fillStyle = P.brass[2];
      g.fillRect(lx + 1, ly + 1, 2, 1);

      // Кисть ЛЕВОЙ руки обхватывает деревянное цевьё снизу-слева
      if (!smoking) {
        g.fillStyle = colOut;
        g.fillRect(foreMidX - 1, foreMidY - 2, 5, 5);
        g.fillStyle = skinMid;
        g.fillRect(foreMidX, foreMidY - 1, 4, 3);
        g.fillStyle = skinHi;
        g.fillRect(foreMidX, foreMidY - 1, 3, 1);
      }

      // Кисть ПРАВОЙ руки на шейке/скобе (движется при взводе)
      g.fillStyle = colOut;
      g.fillRect(rHandX - 1, rHandY - 1, 4, 4);
      g.fillStyle = skinMid;
      g.fillRect(rHandX, rHandY, 3, 3);
      g.fillStyle = skinHi;
      g.fillRect(rHandX, rHandY, 3, 1);
    }

    if (ws.reloading) {
      const ins = ws.insertAnim > 0 ? Math.sin((ws.insertAnim / w.reloadOneTime) * Math.PI) : 0;
      g.fillStyle = skinMid;
      g.fillRect(Math.round(5 + ins * 3), Math.round(-7.5 + ins * 4.5), 3, 3);
      if (ws.insertAnim > 0) {
        g.fillStyle = P.brass[0];
        g.fillRect(Math.round(7 + ins * 2), Math.round(-4.5 + ins * 2.5), 3, 1);
      }
    }

    if (p.flashTimer > 0) {
      const fl = p.flashTimer / 0.06;
      const fx = Math.round(w.barrelLen);
      g.fillStyle = P.canyon[0];
      g.fillRect(fx, -3, Math.round(10 * fl + 3), 6);
      g.fillStyle = P.brass[0];
      g.fillRect(fx, -2, Math.round(7 * fl + 2), 4);
      g.fillStyle = '#ffffff';
      g.fillRect(fx, -1, Math.round(4 * fl + 1), 2);
    }

    g.restore();
  }

  function drawPlayer(g, targetPlayer) {
    const P = getPal();
    const p = targetPlayer || state.player;
    if (!p) return;
    const hatId = p.hatId || (p.id === state.localPlayerId ? G.CFG.selectedHat : 'classic') || 'classic';
    const coatDark = p.coatColor || (P.cloth ? P.cloth[2] : '#1d252e');
    const coatBack = p.coatColor || (P.cloth ? P.cloth[3] : '#1c242b');
    const coatLight = p.coatTrim || (P.cloth ? P.cloth[1] : '#33404d');
    const coatHi = P.cloth ? P.cloth[0] : '#475766';
    const bandanaDark = p.bandanaColor || P.barnRed[1];
    const bandanaBright = p.bandanaColor || P.barnRed[0];
    const colOut = P.outline || '#140f0c';

    if (p.dead) {
      g.save();
      g.translate(Math.round(p.x), Math.round(p.y));
      g.fillStyle = 'rgba(18, 12, 9, 0.35)';
      g.fillRect(-10, -4, 20, 9);
      g.fillStyle = colOut;
      g.fillRect(-9, -4, 18, 8);
      g.fillStyle = coatDark;
      g.fillRect(-8, -3, 16, 6);
      g.fillStyle = bandanaDark;
      g.fillRect(2, -2, 3, 4);
      g.restore();
      return;
    }

    const w = G.SIM.getWeapon(state, p);
    const ws = G.SIM.getWState(state, p);
    const pos = G.SIM.getRenderPos(p);
    const tuckFrac = G.MATH.clamp((p.coverFrac || 0) * (1 - (p.peekFrac || 0)), 0, 1);
    const wallFrac = Math.max(p.wallRaiseFrac || 0, tuckFrac);
    const crouchF = G.MATH.clamp(p.crouchFrac || 0, 0, 1);
    const walking = !p.rolling && !p.inCover && p.speed > 12;
    const stride = walking ? Math.sin(p.walkPhase || 0) * 3.4 : 0;
    const bodySway = walking ? Math.sin(p.walkPhase || 0) * 0.07 : 0;
    const hatBob = walking ? Math.abs(Math.sin(p.walkPhase || 0)) * 0.8 : 0;

    g.save();
    g.translate(Math.round(pos.x), Math.round(pos.y - (p.mountedHorse ? 2 : 0)));

    const rollProg = p.rolling ? G.MATH.clamp(1 - p.rollTimer / G.CFG.rollDur, 0, 1) : 0;
    const rollSquash = p.rolling ? Math.sin(rollProg * Math.PI) : 0;

    // Контактная тень (всадник не рисует отдельную тень под копытами коня)
    if (!p.mountedHorse) {
      g.fillStyle = `rgba(18, 12, 9, ${0.46 + rollSquash * 0.12 + crouchF * 0.08})`;
      g.beginPath();
      g.ellipse(
        Math.round(SUN.dx * (p.rolling ? 3.5 : 6.5 - crouchF * 2.2)),
        Math.round(SUN.dy * (p.rolling ? 3.5 : 6.5 - crouchF * 2.2)),
        (p.rolling ? 9.5 : 9.4) - rollSquash * 2.6 - crouchF * 1.4,
        (p.rolling ? 7.2 : 8.2) - rollSquash * 1.4 - crouchF * 0.9,
        0.3,
        0,
        Math.PI * 2
      );
      g.fill();
    }

    if (p.rolling) {
      // Реалистичный кувырок ВПЕРЁД через плечо/спину строго вдоль вектора движения rollAng
      const rollAng = Math.atan2(p.rollDy, p.rollDx);
      g.rotate(rollAng);

      if (rollProg < 0.28) {
        // Фаза 1: Вход / нырок вперёд (голова и шляпа наклоняются к земле, руки прижаты)
        const k = rollProg / 0.28;
        g.scale(1 - k * 0.22, 1 + k * 0.04);
        g.translate(Math.round(k * 2.5), 0);

        // Тело и сгруппированные плечи
        g.fillStyle = colOut;
        fillRoundPix(g, -7, -10, 14, 20);
        g.fillStyle = coatDark;
        fillRoundPix(g, -6, -9, 12, 18);
        g.fillStyle = coatLight;
        fillRoundPix(g, -5, -8, 6, 5);
        fillRoundPix(g, -5, 3, 6, 5);

        // Прижатое к груди оружие
        g.fillStyle = P.steelDark[1];
        g.fillRect(0, -1, 5, 2);
        g.fillStyle = P.woodWarm[1];
        g.fillRect(-3, -1, 3, 2);

        // Красная бандана и наклонённая вперёд выбранная шляпа
        g.fillStyle = bandanaDark;
        g.fillRect(1, -4, 3, 8);
        drawPlayerHat(g, Math.round(k * 4), 0, hatId);
      } else if (rollProg < 0.74) {
        // Фаза 2: Переворот через спину (сжатый силуэт, шляпа скрыта под корпусом, мелькают складки плаща, пояс и сапоги)
        const k = (rollProg - 0.28) / 0.46;
        const archScaleX = 0.76 - Math.sin(k * Math.PI) * 0.14;
        g.scale(archScaleX, 1.02);

        // Спина плаща со складками (перекатывается сверху)
        g.fillStyle = colOut;
        fillRoundPix(g, -9, -9, 18, 18);
        g.fillStyle = P.cloth ? P.cloth[2] : '#1e2730';
        fillRoundPix(g, -8, -8, 16, 16);

        // Прокатывающиеся поперёк спины складки плаща
        const creaseOff = Math.round((k - 0.5) * 6);
        g.fillStyle = P.cloth ? P.cloth[1] : '#33404d';
        g.fillRect(creaseOff - 2, -6, 2, 12);
        g.fillStyle = P.cloth ? P.cloth[3] : '#171e26';
        g.fillRect(creaseOff + 2, -6, 2, 12);

        // Кожаный пояс и латунная пряжка проходят от тыла через верхнюю точку
        const beltX = Math.round(G.MATH.lerp(-5, 5, k));
        g.fillStyle = P.leather[2];
        g.fillRect(beltX, -7, 2, 14);
        g.fillStyle = P.brass[0];
        g.fillRect(beltX, -1, 2, 2);

        // Подошвы сапог, пролетающие через высшую точку (во второй половине переворота)
        if (k > 0.22) {
          const bT = G.MATH.clamp((k - 0.22) / 0.78, 0, 1);
          const bootX = Math.round(G.MATH.lerp(-7, 6, bT));
          g.fillStyle = colOut;
          g.fillRect(bootX - 1, -6, 6, 4);
          g.fillRect(bootX - 1, 2, 6, 4);
          g.fillStyle = P.leather[3];
          g.fillRect(bootX, -5, 4, 3);
          g.fillRect(bootX, 3, 4, 3);
          // Светлые набойки подошв сапог в верхней точке переката
          g.fillStyle = P.leather[1];
          g.fillRect(bootX + 2, -5, 2, 3);
          g.fillRect(bootX + 2, 3, 2, 3);
        }

        // Край полей шляпы слегка виден снизу только на входе/выходе фазы 2
        if (k < 0.20) {
          g.fillStyle = P.leather[4];
          g.fillRect(5, -4, 3, 8);
        } else if (k > 0.80) {
          g.fillStyle = P.leather[4];
          g.fillRect(-5, -4, 3, 8);
        }
      } else {
        // Фаза 3: Выход на ноги в боевую стойку
        const k = (rollProg - 0.74) / 0.26;
        g.scale(G.MATH.lerp(0.80, 1.0, k), 1.0);

        // Опорные сапоги впереди выходят на землю
        const stepFwd = Math.round((1 - k) * 4);
        g.fillStyle = colOut;
        fillRoundPix(g, stepFwd - 1, -6, 6, 4);
        fillRoundPix(g, stepFwd - 2, 2, 6, 4);
        g.fillStyle = P.leather[3];
        g.fillRect(stepFwd, -5, 4, 2);
        g.fillRect(stepFwd - 1, 3, 4, 2);

        // Полы плаща распрямляются сзади
        g.fillStyle = colOut;
        fillRoundPix(g, -9, -7, 4, 14);
        g.fillStyle = coatBack;
        fillRoundPix(g, -8, -6, 3, 12);

        // Распрямляющийся корпус
        g.fillStyle = colOut;
        fillRoundPix(g, -7, -10, 14, 20);
        g.fillStyle = coatDark;
        fillRoundPix(g, -6, -9, 12, 18);
        g.fillStyle = coatLight;
        fillRoundPix(g, -5, -8, 6, 5);
        fillRoundPix(g, -5, 3, 6, 5);

        // Оружие возвращается вперёд
        g.fillStyle = P.steelDark[1];
        g.fillRect(Math.round(3 + k * 4), 2, 6, 2);

        // Шляпа поднимается на место
        g.fillStyle = bandanaDark;
        g.fillRect(1, -4, 3, 8);
        drawPlayerHat(g, Math.round(-4 + k * 3), 0, hatId);
      }

      g.restore();
      return;
    }

    // Поза укрытия: сдвиг прижатия к укрытию ДО локального поворота корпуса
    const peek = p.peekFrac || 0;
    const coverF = p.coverFrac || 0;
    if (coverF > 0.01 && p.coverObj) {
      g.translate(Math.round(-p.coverNormalX * coverF * 1.6), Math.round(-p.coverNormalY * coverF * 1.6));
    }

    if (peek > 0.01 || coverF > 0.01) {
      const coverAngle = p.coverObj
        ? Math.atan2(-p.coverNormalY, -p.coverNormalX)
        : p.aimAngle;
      const aimA = p.aimAngle + (p.peekSide || 1) * 0.16 * peek;
      const blended = coverAngle + G.MATH.angleDiff(coverAngle, aimA) * peek;
      g.rotate(blended + bodySway * (1 - coverF));
      if (peek > 0.01) {
        g.translate(peek * 2.2, peek * 0.8);
      }
    } else {
      g.rotate(p.aimAngle + bodySway);
    }

    // Сжатие силуэта при приседе за низким укрытием
    if (crouchF > 0.01) {
      g.scale(1 - crouchF * 0.14, 1 - crouchF * 0.08);
    }

    if (walking) {
      g.fillStyle = colOut;
      fillRoundPix(g, Math.round(-2 + stride), -6, 5, 3);
      fillRoundPix(g, Math.round(-2 - stride), 3, 5, 3);
    } else if (peek > 0.25) {
      // Опорная нога сзади — стойка «из-за укрытия»
      g.fillStyle = colOut;
      fillRoundPix(g, Math.round(-6 - peek * 2), 3, 6, 4);
      g.fillStyle = P.leather[3];
      fillRoundPix(g, Math.round(-5 - peek * 2), 4, 5, 3);
    }

    const coatLag = walking ? Math.round(Math.sin((p.walkPhase || 0) * 2) * 1.1) : 0;
    const coatBackX = -10 + Math.round(crouchF * 2.5);
    g.fillStyle = colOut;
    fillRoundPix(g, coatBackX, -7 + coatLag, 4, 14);
    g.fillStyle = coatBack;
    fillRoundPix(g, coatBackX + 1, -6 + coatLag, 3, 12);

    drawWeapon(g, w, ws, p);

    // Тело и плечи в плаще (cloth) — скруглённые пиксельные углы
    g.fillStyle = colOut;
    fillRoundPix(g, -7, -10, 14, 20);
    g.fillStyle = coatDark;
    fillRoundPix(g, -6, -9, 12, 18);
    g.fillStyle = coatLight;
    fillRoundPix(g, -5, -8, 6, 5);
    fillRoundPix(g, -5, 3, 6, 5);
    g.fillStyle = coatHi;
    g.fillRect(-4, -8, 4, 2);

    // Сгруппированные плечи при приседе за низким укрытием
    if (coverF > 0.35 || crouchF > 0.25) {
      g.fillStyle = coatLight;
      g.fillRect(-6, -10, 12, 2);
      g.fillStyle = coatHi;
      g.fillRect(-5, -10, 4, 1);
    }

    // Рука, опирающаяся на кромку укрытия при выглядывании (поверх корпуса)
    if (peek > 0.3) {
      g.fillStyle = colOut;
      g.fillRect(6, Math.round(1 - peek), 5, 5);
      g.fillStyle = coatLight;
      g.fillRect(7, Math.round(2 - peek), 4, 4);
      g.fillStyle = P.skin ? P.skin[1] : '#c49876';
      g.fillRect(9, Math.round(5 - peek), 3, 2);
    }

    // Патронташ / ремень (leather) и пряжка (brass)
    g.fillStyle = P.leather[2];
    g.fillRect(-4, -5, 2, 10);
    g.fillStyle = P.brass[0];
    g.fillRect(-4, -1, 2, 2);

    // Красная бандана (barnRed)
    g.fillStyle = bandanaDark;
    g.fillRect(1, -4, 3, 8);
    g.fillStyle = bandanaBright;
    g.fillRect(1, -3, 2, 3);

    // Сигарета, прикуривание и подробный 4-фазный цикл курения (после 5 сек простоя) И распитие бурбона
    const smState = p.smokingState;
    const drinking = !!p.drinking;
    const drinkProg = drinking ? G.MATH.clamp((p.drinkTimer || 0) / (p.drinkDur || 1.8), 0, 1) : 0;
    const drinkLiftRaw = drinking
      ? (drinkProg < 0.28 ? drinkProg / 0.28 : (drinkProg > 0.82 ? Math.max(0, (1 - drinkProg) / 0.18) : 1.0))
      : 0;
    const drinkLift = drinkLiftRaw * drinkLiftRaw * (3 - 2 * drinkLiftRaw);
    const drinkGlug = (drinking && drinkProg >= 0.28 && drinkProg <= 0.82) ? Math.sin((drinkProg - 0.28) * Math.PI * 6) : 0;
    const hx = Math.round(-1 + hatBob * 0.4 + crouchF * 1.5 - drinkLift * 1.8);
    const colSkin = P.skin ? P.skin[1] : '#c49876';
    const colSkinSh = P.skin ? P.skin[2] : '#9e7457';
    const colSleeve = P.cloth ? P.cloth[1] : '#35424f';
    const colSleeveHi = P.cloth ? P.cloth[0] : '#4b5a69';
    let brimGlowAlpha = 0;
    let brimGlowCol = '242, 218, 145';
    let cigInMouth = false;
    let exhalePuffT = 0;

    if (drinking) {
      // Рука с янтарной бутылкой бурбона поднимается ко рту под полями шляпы
      const elX = -2.0 + 4.5 * drinkLift;
      const elY = -10.5 + 4.2 * drinkLift;
      const handX = 3.5 + 3.2 * drinkLift;
      const handY = -9.5 + (6.8 + drinkGlug * 0.6) * drinkLift;
      const ielX = Math.round(elX);
      const ielY = Math.round(elY);
      const ix = Math.round(handX);
      const iy = Math.round(handY);

      drawSleeveSpan(g, -1, -7, ielX, ielY, 2, colSleeve, colSleeveHi, colOut);
      drawSleeveSpan(g, ielX, ielY, ix - 1, iy, 2, P.cloth ? P.cloth[2] : colSleeve, colSleeveHi, colOut);

      // Манжета и кисть
      g.fillStyle = colOut;
      g.fillRect(ix - 2, iy - 2, 2, 4);
      g.fillStyle = colSleeveHi;
      g.fillRect(ix - 2, iy - 1, 1, 2);
      g.fillStyle = colOut;
      g.fillRect(ix - 1, iy - 2, 5, 4);
      g.fillStyle = colSkinSh;
      g.fillRect(ix, iy - 1, 3, 2);
      g.fillStyle = colSkin;
      g.fillRect(ix + 1, iy - 2, 3, 2);

      // Янтарная бутылка бурбона, наклонённая горлышком к лицу
      const bx = ix + 2;
      const by = iy;
      g.save();
      g.translate(bx, by);
      g.rotate(-0.45 + drinkLift * 1.15 + drinkGlug * 0.08);
      g.fillStyle = colOut;
      g.fillRect(-3, -6, 6, 8);
      g.fillRect(-2, -9, 4, 3);
      g.fillStyle = P.woodWarm[1];
      g.fillRect(-2, -5, 4, 6);
      g.fillStyle = P.brass[1];
      g.fillRect(-2, -4, 3, 4);
      g.fillStyle = P.brass[0];
      g.fillRect(-1, -8, 2, 3);
      g.fillStyle = P.cloud[0];
      g.fillRect(-1, -3, 3, 2);
      g.fillStyle = P.glass[0];
      g.fillRect(-2, -5, 1, 2);
      g.restore();
    } else if (smState === 'lighting') {
      const lt = p.smokeAnimTime || 0;
      cigInMouth = true;
      // Фаза поднесения спички левой рукой к кончику самокрутки под полями шляпы
      const matchLift = lt < 0.28 ? lt / 0.28 : (lt > 1.08 ? Math.max(0, 1 - (lt - 1.08) / 0.36) : 1);
      const mhX = Math.round(4.5 + 2.5 * matchLift);
      const mhY = Math.round(-10.5 + 8.5 * matchLift);
      drawSleeveSpan(g, -1, -6, mhX - 1, mhY, 3, colSleeve, colSleeveHi, colOut);
      // Кисть левой руки
      g.fillStyle = colOut;
      g.fillRect(mhX - 1, mhY - 2, 4, 4);
      g.fillStyle = colSkin;
      g.fillRect(mhX, mhY - 1, 3, 2);

      // Самокрутка в зубах под передним краем шляпы
      g.fillStyle = colOut;
      g.fillRect(hx + 5, -2, 5, 3);
      g.fillStyle = P.cloud[0];
      g.fillRect(hx + 5, -1, 4, 1);

      // Спичка и вспышка пламени у кончика самокрутки
      if (lt > 0.14 && lt < 1.34) {
        g.fillStyle = P.woodWarm[1];
        g.fillRect(mhX + 2, mhY, 2, 1);
      }
      if (lt >= 0.40 && lt <= 1.02) {
        const flick = Math.sin(state.time * 42) > 0;
        const fx = hx + 9;
        const fy = -2;
        g.fillStyle = P.canyon[0];
        g.fillRect(fx - 1, fy, 4, 3);
        g.fillStyle = flick ? '#ffffff' : P.brass[0];
        g.fillRect(fx, fy, 2, 2);
        brimGlowAlpha = flick ? 0.62 : 0.44;
        brimGlowCol = '242, 218, 145';
      }
    } else if (smState === 'smoking') {
      const cyc = (p.smokeAnimTime || 0) % 4.2;
      // tMouth: 0 = рука естественно отведена в сторону от корпуса, 1 = поднесена ко рту под шляпу
      let tMouth = 0;
      let inhalePower = 0;
      if (cyc < 1.30) {
        tMouth = 0;
      } else if (cyc < 1.95) {
        const u = (cyc - 1.30) / 0.65;
        tMouth = u * u * (3 - 2 * u);
      } else if (cyc < 2.75) {
        tMouth = 1;
        inhalePower = Math.sin(((cyc - 1.95) / 0.80) * Math.PI);
      } else if (cyc < 3.40) {
        const u = (cyc - 2.75) / 0.65;
        tMouth = 1 - u * u * (3 - 2 * u);
        if (cyc >= 2.85) exhalePuffT = (cyc - 2.85) / 0.75;
      } else {
        tMouth = 0;
        if (cyc < 3.65) exhalePuffT = (cyc - 2.85) / 0.80;
      }

      // Анатомическая поза левой руки со сгибом локтя: от плеча (-1,-7) -> локоть (-3,-12) -> запястье/кисть (2.5,-13.5)
      const elX = -3.0 + 5.0 * tMouth;
      const elY = -12.0 + 4.5 * tMouth;
      const handX = 2.5 + 4.0 * tMouth;
      const handY = -13.5 + 12.5 * tMouth;
      const ielX = Math.round(elX);
      const ielY = Math.round(elY);
      const ix = Math.round(handX);
      const iy = Math.round(handY);

      // Плечо -> локоть -> предплечье (чёткий двузвенный рукав)
      drawSleeveSpan(g, -1, -7, ielX, ielY, 2, colSleeve, colSleeveHi, colOut);
      drawSleeveSpan(g, ielX, ielY, ix - 1, iy, 2, P.cloth ? P.cloth[2] : colSleeve, colSleeveHi, colOut);

      // Светлая манжета рукава у запястья
      g.fillStyle = colOut;
      g.fillRect(ix - 2, iy - 2, 2, 4);
      g.fillStyle = colSleeveHi;
      g.fillRect(ix - 2, iy - 1, 1, 2);

      // Кисть и пальцы с 1px контуром
      g.fillStyle = colOut;
      g.fillRect(ix - 1, iy - 2, 5, 4);
      g.fillStyle = colSkinSh;
      g.fillRect(ix, iy - 1, 3, 2);
      g.fillStyle = colSkin;
      g.fillRect(ix + 1, iy - 2, 3, 2);
      // Выступающие пальцы, сжимающие самокрутку
      g.fillStyle = P.skin ? P.skin[0] : colSkin;
      g.fillRect(ix + 2, iy - 1, 2, 1);

      // Сигарета: когда рука отведена в сторону (tMouth=0), торчит между пальцами вверх-вперёд до (7.5, -14.5)
      const cx = tMouth > 0.75 ? (hx + 5) : (ix + 2);
      const cy = tMouth > 0.75 ? -1 : (iy - 1);
      cigInMouth = tMouth > 0.75;

      g.fillStyle = colOut;
      g.fillRect(cx - 1, cy - 1, 6, 3);
      g.fillStyle = P.cloud[1];
      g.fillRect(cx, cy, 4, 1);
      g.fillStyle = P.cloud[0];
      g.fillRect(cx + 1, cy, 3, 1);

      // Тлеющий оранжево-красный кончик (или яркий уголь на затяжке) строго у конца сигареты
      if (inhalePower > 0.35) {
        g.fillStyle = P.canyon[0];
        g.fillRect(cx + 4, cy - 1, 2, 3);
        g.fillStyle = inhalePower > 0.72 ? '#ffffff' : P.brass[0];
        g.fillRect(cx + 4, cy, 2, 1);
        brimGlowAlpha = 0.25 + 0.40 * inhalePower;
        brimGlowCol = '232, 118, 52';
      } else {
        const smolder = Math.sin(state.time * 4.5) > 0.35;
        g.fillStyle = smolder ? P.brass[0] : P.barnRed[0];
        g.fillRect(cx + 4, cy, 1, 1);
      }
    }

    // Овальная шляпа персонажа (выбранная модель, в приседе чуть ниже к кромке укрытия)
    drawPlayerHat(g, hx, 0, hatId);

    // Отблеск огонька спички или тлеющей сигареты на передней кромке полей шляпы
    if (brimGlowAlpha > 0.01) {
      g.fillStyle = 'rgba(' + brimGlowCol + ', ' + brimGlowAlpha.toFixed(2) + ')';
      g.fillRect(hx + 3, -3, 2, 7);
    }

    // Выступающий вперёд кончик сигареты поверх края шляпы в момент затяжки + облачко выдоха
    if (cigInMouth && smState === 'smoking') {
      g.fillStyle = P.cloud[0];
      g.fillRect(hx + 7, -1, 2, 1);
      g.fillStyle = brimGlowAlpha > 0.3 ? P.brass[0] : P.barnRed[0];
      g.fillRect(hx + 9, -1, 1, 1);
    }
    if (exhalePuffT > 0 && exhalePuffT < 1) {
      const px = Math.round(hx + 7 + exhalePuffT * 7);
      const py = Math.round(-1 - exhalePuffT * 2);
      const pa = Math.max(0, (1 - exhalePuffT) * 0.55);
      g.fillStyle = 'rgba(244, 240, 232, ' + pa.toFixed(2) + ')';
      g.fillRect(px, py - 1, 3, 2);
      g.fillRect(px + 2, py, 2, 2);
    }

    // Верхняя фаза подъёма ствола (прижатый к груди/правому плечу вертикальный ствол)
    if (wallFrac > 0.32) {
      const muzzleX = (w.id === 'winchester' ? 9.8 : 8.8) - wallFrac * 1.4;
      const muzzleY = 5.2 - wallFrac * 1.6;
      drawUpturnedMuzzle(g, w, wallFrac, muzzleX, muzzleY);
    }

    g.restore();

    if (p.stunTimer > 0) {
      drawStunStars(g, Math.round(pos.x), Math.round(pos.y), P);
    }
  }

  function drawHorse(g, org) {
    const h = world && world.horse;
    if (!h) return;
    if (org && !isInView(h.x - 30, h.y - 30, 60, 60, org, 36)) return;
    const P = getPal();
    const colOut = P.outline || '#140f0c';
    const isDead = h.state === 'dead';
    const isBucking = h.state === 'bucking';
    const isGrazing = h.state === 'grazing';

    // Привязь верёвкой к коновязи (до корпуса, чтобы не перекрывала всадника/гриву)
    if (h.tied && !isDead && h.postX !== undefined) {
      const headX = h.x + Math.cos(h.angle || 0) * 14;
      const headY = h.y + Math.sin(h.angle || 0) * 14;
      const px0 = Math.round(h.postX);
      const py0 = Math.round(h.postY);
      const px1 = Math.round(headX);
      const py1 = Math.round(headY);
      const steps = 10;
      g.fillStyle = P.woodPale[2];
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const sag = Math.sin(u * Math.PI) * 3;
        g.fillRect(Math.round(px0 + (px1 - px0) * u), Math.round(py0 + (py1 - py0) * u + sag), 1, 1);
      }
    }

    const hx = Math.round(h.x);
    const hy = Math.round(h.y);

    if (isDead) {
      g.save();
      g.translate(hx, hy);
      g.rotate(h.angle || 0);
      g.fillStyle = 'rgba(18, 12, 9, 0.35)';
      g.fillRect(-14, -8, 28, 17);
      g.fillStyle = P.blood[2];
      fillRoundPix(g, -10, -7, 16, 14);
      g.fillStyle = colOut;
      fillRoundPix(g, -13, -7, 26, 14);
      g.fillStyle = P.leather[2];
      fillRoundPix(g, -12, -6, 24, 12);
      g.fillStyle = P.leather[4];
      g.fillRect(-15, -3, 4, 6);
      g.fillRect(10, -4, 7, 8);
      g.restore();
      return;
    }

    // Длинная полуденная тень лошади
    const shScale = isBucking ? 1.35 : 1.0;
    g.fillStyle = 'rgba(18, 12, 9, 0.38)';
    g.fillRect(
      Math.round(hx + SUN.dx * 8 * shScale - 11),
      Math.round(hy + SUN.dy * 8 * shScale - 6),
      22,
      12
    );

    const flash = (h.hitFlash || 0) > 0;
    const stride = ((h.speed || 0) > 15 || isBucking) ? Math.sin(h.gallopPhase || 0) : 0;
    const buckLift = isBucking ? Math.round(Math.abs(Math.sin((h.buckTimer || 0) * 14)) * 3.5) : 0;
    const headExtend = isGrazing ? Math.round(Math.sin(h.grazePhase || 0) * 1.5 + 2) : (isBucking ? -3 : 0);

    g.save();
    g.translate(hx, hy - buckLift);
    g.rotate(h.angle || 0);

    // Анимированные копыта на скачке / дыбах
    g.fillStyle = colOut;
    g.fillRect(Math.round(5 + stride * 4), -8, 4, 2);
    g.fillRect(Math.round(5 - stride * 4), 6, 4, 2);
    g.fillRect(Math.round(-10 - stride * 3.5), -8, 4, 2);
    g.fillRect(Math.round(-10 + stride * 3.5), 6, 4, 2);

    // Хвост (развевается на скорости)
    const tailWag = Math.round(stride * 2);
    g.fillStyle = colOut;
    fillRoundPix(g, -17, -2 + tailWag, 6, 4);
    g.fillStyle = flash ? '#f2dfb8' : P.leather[4];
    g.fillRect(-16, -1 + tailWag, 4, 2);

    // Мощный корпус гнедого коня
    g.fillStyle = flash ? '#f2dfb8' : colOut;
    fillRoundPix(g, -13, -7, 25, 14);
    g.fillStyle = flash ? '#fff2d4' : P.leather[2];
    fillRoundPix(g, -12, -6, 23, 12);
    g.fillStyle = flash ? '#fff2d4' : P.leather[1];
    fillRoundPix(g, -9, -5, 17, 10);
    // Солнечный блик вдоль спины
    g.fillStyle = flash ? '#ffffff' : P.leather[0];
    g.fillRect(-6, -3, 11, 4);

    // Грива вдоль шеи
    g.fillStyle = colOut;
    g.fillRect(6, -3, 7, 6);
    g.fillStyle = P.leather[4];
    g.fillRect(7, -2, 5, 4);

    // Шея и голова (вытягивается вниз при пощипывании травы, вздымается на дыбах)
    const hBaseX = 11 + headExtend;
    g.fillStyle = flash ? '#f2dfb8' : colOut;
    fillRoundPix(g, hBaseX, -4, 9, 8);
    g.fillStyle = flash ? '#fff2d4' : P.leather[2];
    fillRoundPix(g, hBaseX + 1, -3, 7, 6);
    g.fillStyle = P.leather[0];
    g.fillRect(hBaseX + 2, -2, 4, 3);
    // Ноздри и уши
    g.fillStyle = colOut;
    g.fillRect(hBaseX + 1, -5, 2, 2);
    g.fillRect(hBaseX + 1, 3, 2, 2);
    g.fillStyle = P.leather[4];
    g.fillRect(hBaseX + 7, -2, 1, 4);
    // Уздечка и поводья
    g.fillStyle = P.brass[1];
    g.fillRect(hBaseX + 5, -3, 1, 6);

    // Седло и стремена (если не сбрасывает седло)
    g.fillStyle = colOut;
    fillRoundPix(g, -4, -6, 9, 12);
    g.fillStyle = P.woodWarm[1];
    fillRoundPix(g, -3, -5, 7, 10);
    g.fillStyle = P.woodWarm[0];
    g.fillRect(-2, -3, 5, 6);
    g.fillStyle = P.brass[1];
    g.fillRect(0, -6, 2, 1);
    g.fillRect(0, 5, 2, 1);
    g.fillRect(2, -2, 2, 4); // Лука седла

    g.restore();

    // Полоски HP и спокойствия (показываются при езде, ранении или испуге)
    if (h.hp < (h.maxHp || 150) || (h.calm !== undefined && h.calm < 98) || h.state === 'ridden' || isBucking || h.state === 'stampede') {
      const bw = 22;
      const bx = hx - 11;
      const by = hy - 20;
      const hpFrac = G.MATH.clamp((h.hp || 0) / (h.maxHp || 150), 0, 1);
      const calmFrac = G.MATH.clamp((h.calm !== undefined ? h.calm : 100) / (h.maxCalm || 100), 0, 1);
      g.fillStyle = colOut;
      g.fillRect(bx - 1, by - 1, bw + 2, 6);
      g.fillStyle = '#331614';
      g.fillRect(bx, by, bw, 2);
      g.fillStyle = P.blood[0];
      g.fillRect(bx, by, Math.max(1, Math.round(bw * hpFrac)), 2);
      g.fillStyle = '#152225';
      g.fillRect(bx, by + 3, bw, 1);
      g.fillStyle = calmFrac > 0.35 ? P.water[0] : P.brass[0];
      g.fillRect(bx, by + 3, Math.max(1, Math.round(bw * calmFrac)), 1);
    }
  }

  function drawSheep(g, org) {
    const list = world && world.sheep;
    if (!list || !list.length) return;
    const P = getPal();
    const colOut = P.outline || '#140f0c';
    const faceCol = P.leather ? P.leather[4] : '#1c110a';

    for (let i = 0; i < list.length; i++) {
      const sh = list[i];
      if (!sh) continue;
      if (org && !isInView(sh.x - 16, sh.y - 16, 32, 32, org, 24)) continue;

      const sx = Math.round(sh.x);
      const sy = Math.round(sh.y);

      if (!sh.alive) {
        g.save();
        g.translate(sx, sy);
        g.rotate(sh.angle || 0);
        g.fillStyle = 'rgba(18, 12, 9, 0.32)';
        g.fillRect(-7, -5, 14, 10);
        g.fillStyle = P.blood[2];
        fillRoundPix(g, -6, -5, 10, 9);
        g.fillStyle = colOut;
        fillRoundPix(g, -6, -4, 11, 8);
        g.fillStyle = P.cloud[2];
        fillRoundPix(g, -5, -3, 9, 6);
        g.fillStyle = P.cloud[1];
        g.fillRect(-4, -3, 6, 4);
        g.fillStyle = faceCol;
        g.fillRect(4, -2, 3, 4);
        g.restore();
        continue;
      }

      // Короткая полуденная тень по вектору SUN (без arc())
      g.fillStyle = 'rgba(20, 14, 9, 0.34)';
      g.fillRect(Math.round(sx + SUN.dx * 4 - 5), Math.round(sy + SUN.dy * 4 - 4), 10, 8);

      const flash = (sh.hitFlash || 0) > 0;
      const isWalking = sh.state === 'walk' || sh.state === 'flee';
      const stride = isWalking ? Math.round(Math.sin(sh.walkPhase || 0) * 1.6) : 0;
      const headDip = sh.state === 'graze' ? Math.round(Math.sin(sh.grazePhase || 0) * 1.1 + 1.5) : 0;

      g.save();
      g.translate(sx, sy);
      g.rotate(sh.angle || 0);

      // Короткие тёмные ножки
      g.fillStyle = colOut;
      g.fillRect(-4 + stride, -5, 2, 2);
      g.fillRect(2 - stride, -5, 2, 2);
      g.fillRect(-4 - stride, 3, 2, 2);
      g.fillRect(2 + stride, 3, 2, 2);

      // Пушистая пиксельная шерсть (контур 1px + кучные кластеры в G.PAL.cloud)
      g.fillStyle = flash ? '#f2dfb8' : colOut;
      fillRoundPix(g, -7, -5, 13, 10);
      g.fillRect(-5, -6, 9, 12);
      g.fillRect(-8, -3, 14, 6);

      g.fillStyle = flash ? '#fff2d4' : P.cloud[2];
      fillRoundPix(g, -6, -4, 11, 8);
      g.fillRect(-4, -5, 7, 10);

      // Освещение шерсти по полуденному солнцу (верх-лево светлее)
      g.fillStyle = flash ? '#ffffff' : P.cloud[1];
      fillRoundPix(g, -6, -4, 9, 7);
      g.fillStyle = flash ? '#ffffff' : P.cloud[0];
      g.fillRect(-5, -4, 5, 4);
      g.fillRect(-2, -5, 4, 3);
      g.fillRect(1, -2, 2, 2);

      // Хвостик
      g.fillStyle = colOut;
      g.fillRect(-8, -1, 2, 2);
      g.fillStyle = P.cloud[1];
      g.fillRect(-7, -1, 1, 2);

      // Тёмная мордочка и ушки (наклоняется и тянется вперёд при щипании травы)
      const hx = 4 + headDip;
      g.fillStyle = colOut;
      g.fillRect(hx, -3, 5, 6);
      g.fillStyle = faceCol;
      g.fillRect(hx + 1, -2, 3, 4);
      // Ушки по бокам головы
      g.fillStyle = colOut;
      g.fillRect(hx, -4, 2, 2);
      g.fillRect(hx, 2, 2, 2);
      // Белый хохолок на лбу и крошечный блик морды
      g.fillStyle = P.cloud[0];
      g.fillRect(hx, -1, 2, 2);
      g.fillStyle = P.woodPale[2];
      g.fillRect(hx + 3, -1, 1, 2);

      g.restore();
    }
  }

  function drawBirdFlocks(g, org) {
    const flocks = world && world.birdFlocks;
    if (!flocks || !flocks.length) return;
    const P = getPal();
    const cols = [P.steelDark[4], P.woodWarm[3], P.woodPale[2]];

    for (let fi = 0; fi < flocks.length; fi++) {
      const flock = flocks[fi];
      if (!flock || flock.state === 'gone') continue;
      if (flock.state === 'perched' && org && !isInView(flock.homeX - 36, flock.homeY - 36, 72, 72, org, 48)) continue;

      for (let bi = 0; bi < flock.birds.length; bi++) {
        const b = flock.birds[bi];
        if (org && !isInView(b.x - 10, b.y - b.z * 0.45 - 10, 20, 20, org, 48)) continue;
        const px = Math.round(b.x);
        const py = Math.round(b.y - b.z * 0.45);

        // Тень на земле / крыше
        if (b.z > 0.5) {
          g.fillStyle = 'rgba(18, 12, 8, 0.28)';
          g.fillRect(Math.round(b.x + SUN.dx * (2 + b.z * 0.22)), Math.round(b.y + SUN.dy * (2 + b.z * 0.22)), 2, 2);
        }

        g.fillStyle = cols[b.colorIdx || 0];
        if (flock.state === 'flying') {
          const flap = Math.sin(b.wingPhase || 0) > 0;
          g.fillRect(px, py, 2, 1);
          if (flap) {
            g.fillRect(px - 2, py - 1, 2, 1);
            g.fillRect(px + 2, py - 1, 2, 1);
          } else {
            g.fillRect(px - 2, py + 1, 2, 1);
            g.fillRect(px + 2, py + 1, 2, 1);
          }
        } else {
          // Сидят на крыше (мелкие компактные воробьи/вороны с единым контуром)
          g.fillStyle = P.outline;
          g.fillRect(px - 1, py - 1, 4, 3);
          g.fillStyle = cols[b.colorIdx || 0];
          g.fillRect(px, py, 2, 2);
          g.fillStyle = P.brass[1];
          g.fillRect(px + 2, py, 1, 1);
        }
      }
    }
  }

  function drawBullets(g) {
    for (let i = 0; i < state.bullets.length; i++) {
      const b = state.bullets[i];
      g.strokeStyle = 'rgba(242, 212, 134, 0.85)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(Math.round(b.px), Math.round(b.py));
      g.lineTo(Math.round(b.x), Math.round(b.y));
      g.stroke();

      g.fillStyle = '#fff9df';
      g.fillRect(Math.round(b.x), Math.round(b.y), 2, 2);
    }
  }

  function drawParticles(g, org) {
    for (let i = 0; i < state.particles.length; i++) {
      const pt = state.particles[i];
      if (org && !isInView(pt.x - 6, pt.y - 6, 12, 12, org, 16)) continue;
      const frac = Math.max(0, pt.life / pt.maxLife);
      g.globalAlpha = frac * pt.alpha;
      g.fillStyle = pt.color;
      if (pt.kind === 'smoke') {
        const s = Math.max(2, Math.round(pt.size * 1.4));
        const x = Math.round(pt.x - s * 0.5);
        const y = Math.round(pt.y - s * 0.5);
        g.fillRect(x + 1, y, Math.max(1, s - 2), s);
        g.fillRect(x, y + 1, s, Math.max(1, s - 2));
      } else {
        const s = Math.max(1, Math.round(pt.size));
        g.fillRect(Math.round(pt.x - s * 0.5), Math.round(pt.y - s * 0.5), s, s);
      }
    }
    g.globalAlpha = 1;
  }

  function drawDustMotes(g, dt, org) {
    const P = getPal();
    for (let i = 0; i < dustMotes.length; i++) {
      const m = dustMotes[i];
      m.x += m.vx * dt;
      m.y += (m.vy + Math.sin(state.time * 1.4 + m.phase) * 1.6) * dt;
      if (m.x > world.width) m.x -= world.width;
      if (m.y < 65) m.y = world.height - 70;
      if (m.y > world.height - 70) m.y = 65;

      if (org && !isInView(m.x, m.y, 2, 2, org, 8)) continue;
      const alpha = 0.24 + 0.16 * Math.sin(state.time * 2.2 + m.phase);
      g.fillStyle = P.grass[0];
      g.globalAlpha = alpha;
      g.fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
    }
    g.globalAlpha = 1;
  }

  function drawDebugRays(g) {
    if (!G.CFG.debugRays) return;
    const P = getPal();
    for (let i = 0; i < state.debugRays.length; i++) {
      const r = state.debugRays[i];
      const alpha = Math.max(0, r.life / r.maxLife) * 0.80;
      if (r.echoDistracted) {
        g.strokeStyle = `rgba(242, 218, 145, ${Math.min(1, alpha * 1.15)})`;
      } else {
        g.strokeStyle = r.hit ? `rgba(126, 186, 178, ${alpha})` : `rgba(212, 174, 89, ${alpha * 0.45})`;
      }
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(Math.round(r.x1), Math.round(r.y1));
      g.lineTo(Math.round(r.x2), Math.round(r.y2));
      g.stroke();
      if (r.echoDistracted) {
        const ex = Math.round(r.x2);
        const ey = Math.round(r.y2);
        g.fillStyle = P.outline;
        g.fillRect(ex - 3, ey - 3, 7, 7);
        g.fillStyle = P.brass[0];
        g.fillRect(ex - 2, ey - 2, 5, 5);
        g.fillStyle = P.barnRed[0];
        g.fillRect(ex - 1, ey - 1, 3, 3);
      } else if (r.hit) {
        g.fillStyle = `rgba(235, 200, 110, ${alpha})`;
        g.fillRect(Math.round(r.x2 - 1), Math.round(r.y2 - 1), 3, 3);
      }
    }
    const p = state.player;
    if (p.wallBlocked && p.wallHitX != null) {
      const hand = G.SIM.getHandOrigin(p);
      g.strokeStyle = 'rgba(217, 100, 74, 0.92)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(Math.round(hand.x), Math.round(hand.y));
      g.lineTo(Math.round(p.wallHitX), Math.round(p.wallHitY));
      g.stroke();
      g.fillStyle = '#d9644a';
      g.fillRect(Math.round(p.wallHitX - 1), Math.round(p.wallHitY - 1), 3, 3);
    }
  }

  function drawGunSmokeClouds(g, org) {
    const clouds = state && state.gunSmokeClouds;
    const flashes = state && state.smokeFlashes;
    const hasClouds = !!(clouds && clouds.length);
    const hasFlashes = !!(flashes && flashes.length);
    if (!hasClouds && !hasFlashes) return;
    const P = getPal();
    const zones = (world && world.indoorZones) || [];
    if (!zones.length) return;

    // Если в видимой области нет ни одного indoorZone — выходим сразу
    let anyZoneVisible = false;
    for (let zIdx = 0; zIdx < zones.length; zIdx++) {
      const z = zones[zIdx];
      if (!org || isInView(z.x, z.y, z.w, z.h, org, 24)) {
        anyZoneVisible = true;
        break;
      }
    }
    if (!anyZoneVisible) return;

    g.save();
    g.beginPath();
    for (let zIdx = 0; zIdx < zones.length; zIdx++) {
      const z = zones[zIdx];
      g.rect(z.x + 8, z.y + 8, z.w - 16, z.h - 16);
    }
    g.clip();

    if (hasClouds) {
      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        const r = Math.max(6, Math.round(c.r));
        const cx = Math.round(c.x);
        const cy = Math.round(c.y);
        if (org && !isInView(cx - r, cy - r, r * 2, r * 2, org, 24)) continue;

        const lifeFrac = G.MATH.clamp(c.life / c.maxLife, 0, 1);
        const fade = Math.min(1, lifeFrac * 1.45);
        const dens = c.density || 0.8;

        g.globalAlpha = 0.24 * fade * dens;
        const d1 = getCachedPixelDisc(r, P.stone[2]);
        g.drawImage(d1.canvas, cx - d1.half, cy - d1.half);

        g.globalAlpha = 0.34 * fade * dens;
        const d2 = getCachedPixelDisc(Math.round(r * 0.76), P.cloud[2]);
        g.drawImage(d2.canvas, cx - 2 - d2.half, cy - 1 - d2.half);

        g.globalAlpha = 0.42 * fade * dens;
        const d3 = getCachedPixelDisc(Math.round(r * 0.50), P.cloud[1]);
        g.drawImage(d3.canvas, cx + 2 - d3.half, cy - 2 - d3.half);
        const d4 = getCachedPixelDisc(Math.round(r * 0.42), P.cloud[1]);
        g.drawImage(d4.canvas, cx - Math.round(r * 0.35) - d4.half, cy + Math.round(r * 0.2) - d4.half);

        g.globalAlpha = 0.30 * fade;
        const d5 = getCachedPixelDisc(Math.round(r * 0.28), P.cloud[0]);
        g.drawImage(d5.canvas, cx - 1 - d5.half, cy - Math.round(r * 0.25) - d5.half);
      }
    }

    // Освещение внутри задымлённого помещения от вспышек выстрелов (подсвечивает дым и силуэты)
    if (hasFlashes) {
      for (let i = 0; i < flashes.length; i++) {
        const fl = flashes[i];
        const fx = Math.round(fl.x);
        const fy = Math.round(fl.y);
        const fr = Math.round(fl.r);
        if (org && !isInView(fx - fr, fy - fr, fr * 2, fr * 2, org, 24)) continue;

        const k = G.MATH.clamp(fl.life / fl.maxLife, 0, 1);
        g.globalAlpha = 0.14 * k;
        const f1 = getCachedPixelDisc(Math.round(fl.r * (0.65 + 0.35 * k)), P.brass[0]);
        g.drawImage(f1.canvas, fx - f1.half, fy - f1.half);

        g.globalAlpha = 0.26 * k;
        const f2 = getCachedPixelDisc(Math.round(fl.r * 0.45), P.grass[0]);
        g.drawImage(f2.canvas, fx - f2.half, fy - f2.half);

        g.globalAlpha = 0.42 * k;
        const f3 = getCachedPixelDisc(Math.round(fl.r * 0.18), '#ffffff');
        g.drawImage(f3.canvas, fx - f3.half, fy - f3.half);
      }
    }

    g.restore();
    g.globalAlpha = 1;
  }

  function drawMuzzleGlow(g, org) {
    const P = getPal();
    const plsGlow = (G.SIM && G.SIM.getPlayers) ? G.SIM.getPlayers(state) : (state.player ? [state.player] : []);
    const glows = [];

    for (let i = 0; i < plsGlow.length; i++) {
      const pl = plsGlow[i];
      if (pl && !pl.dead && pl.flashTimer > 0) {
        const m = G.SIM.getMuzzlePos(state, pl);
        glows.push({ x: m.x, y: m.y, fl: pl.flashTimer / 0.06, rScale: 1.0 });
      }
    }
    if (state.smokeFlashes && state.smokeFlashes.length) {
      for (let i = 0; i < state.smokeFlashes.length; i++) {
        const sf = state.smokeFlashes[i];
        glows.push({ x: sf.x, y: sf.y, fl: sf.life / sf.maxLife, rScale: sf.r / 58 });
      }
    }

    if (!glows.length) return;
    g.save();
    for (let i = 0; i < glows.length; i++) {
      const gl = glows[i];
      const fl = G.MATH.clamp(gl.fl, 0, 1);
      const mx = Math.round(gl.x);
      const my = Math.round(gl.y);
      const r1 = Math.round((46 * fl + 10) * gl.rScale);
      if (org && !isInView(mx - r1, my - r1, r1 * 2, r1 * 2, org, 16)) continue;

      const r2 = Math.round((26 * fl + 6) * gl.rScale);
      const r3 = Math.round((11 * fl + 3) * gl.rScale);

      // Ступенчатое попиксельное свечение строго без arc() и createRadialGradient
      g.globalAlpha = 0.09 * fl;
      const g1 = getCachedPixelDisc(r1, P.brass[0]);
      g.drawImage(g1.canvas, mx - g1.half, my - g1.half);

      g.globalAlpha = 0.18 * fl;
      const g2 = getCachedPixelDisc(r2, P.grass[0]);
      g.drawImage(g2.canvas, mx - g2.half, my - g2.half);

      g.globalAlpha = 0.34 * fl;
      const g3 = getCachedPixelDisc(r3, P.cloud[0]);
      g.drawImage(g3.canvas, mx - g3.half, my - g3.half);

      g.globalAlpha = 0.62 * fl;
      g.fillStyle = '#ffffff';
      g.fillRect(mx - 2, my - 2, 4, 4);
    }
    g.restore();
    g.globalAlpha = 1;
  }

  // ==================== ЭКРАННЫЕ ЭЛЕМЕНТЫ И ДВОЙНОЙ ПРИЦЕЛ ====================

  // Интерактивные объекты салуна: Бутылка Бурбона (G.PAL.brass/woodWarm/glass) и Вешалка со шляпами
  let hatrackSpriteCache = null;

  function getHatrackCanvas(P) {
    if (hatrackSpriteCache) return hatrackSpriteCache;
    const c = document.createElement('canvas');
    c.width = 30;
    c.height = 32;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const colOut = P.outline || '#140f0c';
    const cx = 14;
    const cy = 18;

    // 1. Деревянная крестовина основания у пола (4 лапы с 1px контуром и объёмом)
    g.fillStyle = colOut;
    g.fillRect(cx - 8, cy + 5, 16, 4);
    g.fillRect(cx - 2, cy - 1, 4, 14);
    g.fillStyle = P.woodWarm[3];
    g.fillRect(cx - 7, cy + 6, 14, 2);
    g.fillRect(cx - 1, cy, 2, 12);
    g.fillStyle = P.woodWarm[2];
    g.fillRect(cx - 7, cy + 6, 7, 1);
    g.fillRect(cx - 1, cy, 1, 6);
    g.fillStyle = P.woodWarm[1];
    g.fillRect(cx - 6, cy + 6, 3, 1);

    // 2. Вертикальная резная стойка вешалки (от основания к верху)
    g.fillStyle = colOut;
    g.fillRect(cx - 2, cy - 12, 5, 20);
    g.fillStyle = P.woodWarm[3];
    g.fillRect(cx - 1, cy - 11, 3, 18);
    g.fillStyle = P.woodWarm[2];
    g.fillRect(cx - 1, cy - 11, 2, 17);
    g.fillStyle = P.woodWarm[1];
    g.fillRect(cx - 1, cy - 11, 1, 14);

    // Декоративное латунное кольцо на стойке и верхнее навершие
    g.fillStyle = colOut;
    g.fillRect(cx - 2, cy - 14, 5, 3);
    g.fillStyle = P.brass[1];
    g.fillRect(cx - 1, cy - 13, 3, 2);
    g.fillStyle = P.brass[0];
    g.fillRect(cx - 1, cy - 13, 2, 1);
    g.fillStyle = P.brass[1];
    g.fillRect(cx - 1, cy - 2, 3, 1);

    // 3. Расходящиеся деревянные рожки-крючки с латунными наконечниками
    // Левый верхний крючок
    g.fillStyle = colOut;
    g.fillRect(cx - 8, cy - 12, 7, 3);
    g.fillStyle = P.woodWarm[2];
    g.fillRect(cx - 7, cy - 11, 6, 1);
    g.fillStyle = P.brass[0];
    g.fillRect(cx - 8, cy - 12, 2, 2);

    // Правый верхний крючок
    g.fillStyle = colOut;
    g.fillRect(cx + 2, cy - 11, 7, 3);
    g.fillStyle = P.woodWarm[2];
    g.fillRect(cx + 2, cy - 10, 6, 1);
    g.fillStyle = P.brass[0];
    g.fillRect(cx + 7, cy - 11, 2, 2);

    // Нижний левый крючок
    g.fillStyle = colOut;
    g.fillRect(cx - 6, cy - 4, 5, 3);
    g.fillStyle = P.woodWarm[2];
    g.fillRect(cx - 5, cy - 3, 4, 1);
    g.fillStyle = P.brass[1];
    g.fillRect(cx - 6, cy - 4, 2, 2);

    // 4. Шляпы, висящие на крючках (используются запечённые пиксельные спрайты из getPlayerHatCanvas + 1px пиксели)
    g.drawImage(getPlayerHatCanvas('classic'), cx - 9 - 15, cy - 10 - 15);

    // Вторая светлая фетровая шляпа на правом верхнем крючке (1px без arc)
    const h2x = cx + 7;
    const h2y = cy - 9;
    g.fillStyle = colOut;
    g.fillRect(h2x - 5, h2y - 4, 10, 8);
    g.fillRect(h2x - 6, h2y - 3, 12, 6);
    g.fillStyle = P.woodPale[2];
    g.fillRect(h2x - 5, h2y - 2, 10, 4);
    g.fillRect(h2x - 4, h2y - 3, 8, 6);
    g.fillStyle = P.woodPale[1];
    g.fillRect(h2x - 4, h2y - 3, 5, 4);
    g.fillStyle = P.barnRed[1];
    g.fillRect(h2x - 2, h2y - 2, 4, 4);
    g.fillStyle = P.woodPale[0];
    g.fillRect(h2x - 1, h2y - 1, 2, 2);

    hatrackSpriteCache = c;
    return c;
  }

  function drawSaloonInteractables(g) {
    if (!world || !world.interactables) return;
    const P = getPal();
    const colOut = P.outline || '#140f0c';

    for (let i = 0; i < world.interactables.length; i++) {
      const it = world.interactables[i];
      const ix = Math.round(it.x);
      const iy = Math.round(it.y);

      if (it.kind === 'bourbon') {
        if (!state.saloonProps || !state.saloonProps.bourbonAvailable) continue;
        // Полуденная тень от бутылки на столешнице по SUN
        g.fillStyle = 'rgba(20, 14, 10, 0.45)';
        g.fillRect(ix - 2, iy + 2, 7, 4);
        // Янтарная бутылка Бурбона (brass / woodWarm) + блик glass + пробка
        g.fillStyle = colOut;
        g.fillRect(ix - 4, iy - 4, 7, 8);
        g.fillRect(ix - 2, iy - 7, 3, 3);
        g.fillStyle = P.woodWarm[1];
        g.fillRect(ix - 3, iy - 3, 5, 6);
        g.fillStyle = P.brass[1];
        g.fillRect(ix - 3, iy - 2, 4, 4);
        g.fillStyle = P.brass[0];
        g.fillRect(ix - 1, iy - 5, 1, 3);
        // Бумажная этикетка и пробка
        g.fillStyle = P.cloud[0];
        g.fillRect(ix - 2, iy, 3, 2);
        g.fillStyle = P.barnRed[1];
        g.fillRect(ix - 2, iy + 1, 3, 1);
        g.fillStyle = P.woodPale[0];
        g.fillRect(ix - 1, iy - 6, 1, 1);
        // Верхне-левый блик стекла
        g.fillStyle = P.glass[0];
        g.fillRect(ix - 3, iy - 3, 1, 3);
      } else if (it.kind === 'hatrack') {
        // Настоящая стоячая деревянная стойка-вешалка с крестовиной, крючками и шляпами (из offscreen-кэша)
        const rackCanvas = getHatrackCanvas(P);
        g.fillStyle = 'rgba(20, 14, 10, 0.42)';
        g.fillRect(ix - 6, iy + 5, 14, 5);
        g.fillRect(ix - 2, iy + 3, 7, 9);
        g.drawImage(rackCanvas, ix - 14, iy - 18);
      } else if (it.kind === 'medkit') {
        // Аптечка с бинтами на стойке / ящике (светлое дерево + красный крест G.PAL.barnRed[0])
        g.fillStyle = 'rgba(20, 14, 10, 0.44)';
        g.fillRect(ix - 5, iy + 2, 13, 6);
        g.fillStyle = colOut;
        g.fillRect(ix - 7, iy - 5, 14, 10);
        g.fillStyle = P.woodPale[1];
        g.fillRect(ix - 6, iy - 4, 12, 8);
        g.fillStyle = P.woodPale[0];
        g.fillRect(ix - 6, iy - 4, 11, 2);
        // Белая медицинская крышка и красный крест
        g.fillStyle = P.cloud[0];
        g.fillRect(ix - 4, iy - 3, 8, 6);
        g.fillStyle = P.barnRed[0];
        g.fillRect(ix - 1, iy - 2, 2, 4);
        g.fillRect(ix - 2, iy - 1, 4, 2);
        g.fillStyle = P.brass[0];
        g.fillRect(ix - 2, iy + 3, 4, 1);
      }
    }
  }

  function drawDustStorm(g, org) {
    const ds = state && state.dustStorm;
    if (!ds || (!ds.active && (ds.intensity || 0) <= 0.01)) return;
    const iv = G.MATH.clamp(ds.intensity || 0, 0, 1);
    if (iv <= 0.01) return;
    const P = getPal();

    // 1. Перекати-поле с подпрыгиванием, вращением и контактной тенью по SUN (вне помещений и в кадре)
    if (ds.tumbleweeds && ds.tumbleweeds.length) {
      for (let i = 0; i < ds.tumbleweeds.length; i++) {
        const tw = ds.tumbleweeds[i];
        const tx = Math.round(tw.x);
        const ty = Math.round(tw.y);
        const r = tw.r || 8;
        if (org && !isInView(tx - r - 6, ty - r - 8, r * 2 + 12, r * 2 + 16, org, 24)) continue;
        if (world && world.getIndoorZoneAt && world.getIndoorZoneAt(tx, ty)) continue;

        const bz = Math.abs(Math.sin(tw.bouncePhase || 0)) * 5.5;
        // Контактная тень на земле по SUN
        g.globalAlpha = 0.34 * iv;
        g.fillStyle = P.outline;
        g.fillRect(Math.round(tx + SUN.dx * (2 + bz * 0.4) - r * 0.6), Math.round(ty + SUN.dy * (2 + bz * 0.4) - 2), Math.round(r * 1.3), 4);

        g.save();
        g.globalAlpha = Math.min(0.95, 0.45 + 0.55 * iv);
        g.translate(tx, Math.round(ty - bz));
        g.rotate(tw.rot || 0);
        g.fillStyle = P.woodWarm[3];
        g.fillRect(-r + 1, -r + 2, r * 2 - 2, r * 2 - 4);
        g.fillStyle = P.grass[3];
        g.fillRect(-r + 2, -r + 1, r * 2 - 4, r * 2 - 2);
        g.fillStyle = P.grass[2];
        g.fillRect(-r + 3, -r + 3, r + 2, 2);
        g.fillRect(-2, -r + 2, 2, r * 2 - 4);
        g.fillRect(-r + 2, 1, r * 2 - 4, 2);
        g.fillStyle = P.grass[0];
        g.fillRect(-r + 3, -r + 2, 4, 1);
        g.fillRect(1, -2, 2, 3);
        g.restore();
      }
    }

    // 2. Пыльная дымка вокруг салуна (макс. 4 прямоугольника без clip('evenodd'))
    const vx0 = org.x - 4;
    const vy0 = org.y - 4;
    const vx1 = org.x + pixW + 4;
    const vy1 = org.y + pixH + 4;
    g.globalAlpha = 0.16 * iv;
    g.fillStyle = P.dirt[1];

    const salRaw = (world && world.saloon) || null;
    if (!salRaw) {
      g.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    } else {
      const sx0 = Math.max(vx0, salRaw.x + 8);
      const sy0 = Math.max(vy0, salRaw.y + 8);
      const sx1 = Math.min(vx1, salRaw.x + salRaw.w - 8);
      const sy1 = Math.min(vy1, salRaw.y + salRaw.h - 8);
      if (sx1 <= sx0 || sy1 <= sy0) {
        g.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
      } else {
        if (sy0 > vy0) g.fillRect(vx0, vy0, vx1 - vx0, sy0 - vy0);
        if (vy1 > sy1) g.fillRect(vx0, sy1, vx1 - vx0, vy1 - sy1);
        if (sx0 > vx0) g.fillRect(vx0, sy0, sx0 - vx0, sy1 - sy0);
        if (vx1 > sx1) g.fillRect(sx1, sy0, vx1 - sx1, sy1 - sy0);
      }
    }

    // 3. Быстрые диагональные пиксельные полосы песка и песчинки (пропускаем внутри indoorZones)
    const windSpeedX = 280;
    const windSpeedY = 96;
    const streakCount = Math.round(18 + iv * 34);
    for (let i = 0; i < streakCount; i++) {
      const seed = (i * 137) % 997;
      const sx = org.x + ((((seed * 19 - state.time * windSpeedX * (0.85 + (i % 5) * 0.12)) % (pixW + 40)) + (pixW + 40)) % (pixW + 40)) - 20;
      const sy = org.y + ((((seed * 31 + state.time * windSpeedY * (0.85 + (i % 4) * 0.14)) % (pixH + 40)) + (pixH + 40)) % (pixH + 40)) - 20;
      const ix = Math.round(sx);
      const iy = Math.round(sy);
      if (world && world.getIndoorZoneAt && world.getIndoorZoneAt(ix, iy)) continue;

      const len = 3 + (i % 4);
      g.globalAlpha = (0.32 + (i % 3) * 0.12) * iv;
      g.fillStyle = (i % 3 === 0) ? P.canyon[0] : P.dirt[0];
      for (let s = 0; s < len; s++) {
        g.fillRect(ix - s, iy + Math.round(s * 0.34), 2, 1);
      }
    }

    g.globalAlpha = 1;
  }

  function drawWorldOverlaysOnScreen() {
    const p = state.player;
    const pos = p ? G.SIM.getRenderPos(p) : { x: 150, y: 360 };
    const plsOverlay = (G.SIM && G.SIM.getPlayers) ? G.SIM.getPlayers(state) : (p ? [p] : []);

    ctx.save();
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'center';

    // Никнеймы и компактные HP-полоски удалённых игроков
    for (let i = 0; i < plsOverlay.length; i++) {
      const pl = plsOverlay[i];
      if (!pl || pl.id === state.localPlayerId) continue;
      const plPos = G.SIM.getRenderPos(pl);
      const scr = worldToScreen(plPos.x, plPos.y - 22);
      if (scr.x < -60 || scr.x > viewW + 60 || scr.y < -40 || scr.y > viewH + 40) continue;
      const sx = Math.round(scr.x);
      const sy = Math.round(scr.y);
      const label = pl.dead ? `${pl.name || 'СТРЕЛОК'} (ПАЛ)` : (pl.name || 'СТРЕЛОК');
      ctx.font = 'bold 10px "Courier New", monospace';
      ctx.fillStyle = '#140f0c';
      ctx.fillText(label, sx + 1, sy - 4);
      ctx.fillStyle = pl.dead ? '#a89f91' : '#f2da91';
      ctx.fillText(label, sx, sy - 5);
      if (!pl.dead) {
        const hpFrac = G.MATH.clamp((pl.hp || 0) / Math.max(1, pl.maxHp || 100), 0, 1);
        ctx.fillStyle = '#140f0c';
        ctx.fillRect(sx - 18, sy - 2, 36, 4);
        ctx.fillStyle = '#332013';
        ctx.fillRect(sx - 17, sy - 1, 34, 2);
        ctx.fillStyle = state.mpMode === 'pvp' ? '#c9241c' : '#8ea164';
        ctx.fillRect(sx - 17, sy - 1, Math.max(1, Math.round(34 * hpFrac)), 2);
      }
    }

    ctx.font = 'bold 12px "Courier New", monospace';
    if (p && !p.dead && p.inCover && !p.peeking) {
      const scr = worldToScreen(pos.x, pos.y - 22);
      const sx = Math.round(scr.x);
      const sy = Math.round(scr.y);
      ctx.fillStyle = 'rgba(20, 15, 11, 0.88)';
      ctx.fillRect(sx - 68, sy - 14, 136, 18);
      ctx.strokeStyle = '#c89e45';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - 67.5, sy - 13.5, 135, 17);
      ctx.fillStyle = '#ebd194';
      ctx.fillText('[ПКМ] ВЫГЛЯНУТЬ', sx, sy - 1);
    }

    // Пиксельный прогресс-бар перевязки бинтами / питья бурбона над игроками
    for (let i = 0; i < plsOverlay.length; i++) {
      const pl = plsOverlay[i];
      if (!pl || pl.dead) continue;
      const plPos = G.SIM.getRenderPos(pl);
      const offY = pl.id === state.localPlayerId ? 28 : 34;
      if (pl.bandaging) {
        const scr = worldToScreen(plPos.x, plPos.y - offY);
        const sx = Math.round(scr.x);
        const sy = Math.round(scr.y);
        const frac = G.MATH.clamp((pl.bandageTimer || 0) / (pl.bandageDur || 2.5), 0, 1);
        ctx.fillStyle = '#140f0c';
        ctx.fillRect(sx - 38, sy - 14, 76, 14);
        ctx.fillStyle = '#332013';
        ctx.fillRect(sx - 37, sy - 13, 74, 12);
        ctx.fillStyle = '#8ea164';
        ctx.fillRect(sx - 36, sy - 12, Math.max(2, Math.round(72 * frac)), 4);
        ctx.font = 'bold 9px "Courier New", monospace';
        ctx.fillStyle = '#f2da91';
        ctx.fillText('ПЕРЕВЯЗКА...', sx, sy - 3);
      } else if (pl.drinking) {
        const scr = worldToScreen(plPos.x, plPos.y - offY);
        const sx = Math.round(scr.x);
        const sy = Math.round(scr.y);
        const frac = G.MATH.clamp((pl.drinkTimer || 0) / (pl.drinkDur || 1.8), 0, 1);
        ctx.fillStyle = '#140f0c';
        ctx.fillRect(sx - 52, sy - 14, 104, 14);
        ctx.fillStyle = '#332013';
        ctx.fillRect(sx - 51, sy - 13, 102, 12);
        ctx.fillStyle = '#d4ae59';
        ctx.fillRect(sx - 50, sy - 12, Math.max(2, Math.round(100 * frac)), 4);
        ctx.font = 'bold 9px "Courier New", monospace';
        ctx.fillStyle = '#f2da91';
        ctx.fillText('ВЫПИВАЕТ БУРБОН...', sx, sy - 3);
      }
    }

    if (state.nearInteractable && state.nearInteractable.kind !== 'horse_dismount' && !state.hatMenuOpen) {
      const it = state.nearInteractable;
      const keyLbl = G.keyLabel(G.CFG.keys.interact);
      const msg = `[${keyLbl}] ${it.label}`;
      const scr = worldToScreen(it.x, it.y - 18);
      const sx = Math.round(scr.x);
      const sy = Math.round(scr.y);
      const boxW = Math.max(120, Math.round(ctx.measureText(msg).width + 18));
      const halfW = Math.round(boxW * 0.5);
      ctx.fillStyle = 'rgba(20, 15, 11, 0.90)';
      ctx.fillRect(sx - halfW, sy - 14, boxW, 18);
      ctx.strokeStyle = '#c89e45';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - halfW + 0.5, sy - 13.5, boxW - 1, 17);
      ctx.fillStyle = '#f2da91';
      ctx.fillText(msg, sx, sy - 1);
    }

    for (let i = 0; i < world.targets.length; i++) {
      const t = world.targets[i];
      if (t.kind !== 'bandit' || !t.alive) continue;
      if (t.aiState === 'flee' && !t.noAmmoFlee) {
        const scr = worldToScreen(t.x, t.y - 26);
        if (scr.x > -40 && scr.x < viewW + 40 && scr.y > -40 && scr.y < viewH + 40) {
          ctx.font = 'bold 11px "Courier New", monospace';
          const blink = Math.sin(state.time * 14) > 0;
          ctx.fillStyle = '#140f0c';
          ctx.fillText('! ПОДМОГА', Math.round(scr.x) + 1, Math.round(scr.y) + 1);
          ctx.fillStyle = blink ? '#f2da91' : '#a83c2e';
          ctx.fillText('! ПОДМОГА', Math.round(scr.x), Math.round(scr.y));
        }
      } else if (t.aiState === 'no_ammo_retreat') {
        const scr = worldToScreen(t.x, t.y - 26);
        if (scr.x > -40 && scr.x < viewW + 40 && scr.y > -40 && scr.y < viewH + 40) {
          ctx.font = 'bold 10px "Courier New", monospace';
          ctx.fillStyle = '#140f0c';
          ctx.fillText('ПУСТО!', Math.round(scr.x) + 1, Math.round(scr.y) + 1);
          ctx.fillStyle = '#d6ae52';
          ctx.fillText('ПУСТО!', Math.round(scr.x), Math.round(scr.y));
        }
      } else if (t.tough) {
        const scr = worldToScreen(t.x, t.y - 24);
        if (scr.x > -40 && scr.x < viewW + 40 && scr.y > -40 && scr.y < viewH + 40) {
          ctx.font = 'bold 11px "Courier New", monospace';
          ctx.fillStyle = '#120d0a';
          ctx.fillText(t.name, Math.round(scr.x) + 1, Math.round(scr.y) + 1);
          ctx.fillStyle = '#e3c068';
          ctx.fillText(t.name, Math.round(scr.x), Math.round(scr.y));
        }
      }
    }

    if (state.floatTexts && state.floatTexts.length) {
      for (let i = 0; i < state.floatTexts.length; i++) {
        const ft = state.floatTexts[i];
        const frac = G.MATH.clamp(ft.life / ft.maxLife, 0, 1);
        const scr = worldToScreen(ft.x, ft.y);
        const sx = Math.round(scr.x);
        const sy = Math.round(scr.y);
        ctx.globalAlpha = Math.min(1, frac * 1.4);
        ctx.font = ft.big ? 'bold 15px "Courier New", monospace' : 'bold 12px "Courier New", monospace';
        ctx.fillStyle = '#120d0a';
        ctx.fillText(ft.text, sx + 2, sy + 2);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, sx, sy);
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  const editorGhostCache = {};
  function getEditorGhostStub(tpl, w, h) {
    const key = `${tpl.type}|${w}x${h}`;
    if (!editorGhostCache[key]) {
      const knd = tpl.kind || 'solid';
      if (knd === 'tree') {
        const tr = { x: 0, y: 0, r: tpl.r || 22 };
        if (world && world.bakeSolidSprites) world.bakeSolidSprites([], [tr]);
        editorGhostCache[key] = { kind: 'tree', baked: tr.baked };
      } else {
        const stub = {
          id: 'ghost_' + key,
          x: 0,
          y: 0,
          w: w,
          h: h,
          mat: tpl.mat,
          type: tpl.type,
          high: tpl.high,
          isCover: true,
          isHitchingPost: !!tpl.isHitchingPost,
          interior: !!tpl.interior
        };
        if (tpl.type !== 'water_barrel' && world && world.bakeSolidSprites) {
          world.bakeSolidSprites([stub], []);
        }
        editorGhostCache[key] = stub;
      }
    }
    return editorGhostCache[key];
  }

  function drawEditorOverlay(g, org) {
    const ed = state && state.editor;
    if (!ed || !ed.active) return;
    const P = getPal();

    // Пиксельная сетка 8x8 в зоне видимости
    const step = ed.gridStep || 8;
    const startX = Math.floor(org.x / step) * step;
    const startY = Math.floor(org.y / step) * step;
    g.save();
    g.fillStyle = 'rgba(242, 218, 145, 0.14)';
    for (let gy = startY; gy < org.y + pixH + step; gy += step * 2) {
      for (let gx = startX; gx < org.x + pixW + step; gx += step * 2) {
        g.fillRect(gx, gy, 1, 1);
      }
    }

    const wm = screenToWorld(state.input.mouseX, state.input.mouseY);
    const hoverHit = world.findEditorEntityAt ? world.findEditorEntityAt(wm.x, wm.y) : null;
    ed.hoverEntity = hoverHit;
    ed.hoverSolidId = (hoverHit && hoverHit.kind === 'solid' && hoverHit.obj) ? hoverHit.obj.id : null;

    if (ed.tool === 'place') {
      const box = getEditorPlaceBox();
      if (box) {
        const knd = box.tpl.kind || 'solid';
        g.globalAlpha = 0.56;
        if (knd === 'solid') {
          const stub = getEditorGhostStub(box.tpl, box.w, box.h);
          if (stub.type === 'water_barrel') {
            const bc = getBarrelCaches(box.w, box.h);
            g.fillStyle = P.water[2];
            drawPixelDisc(g, box.x + bc.cx, box.y + bc.cy, bc.waterR);
            g.drawImage(bc.shell, box.x, box.y);
          } else if (stub.baked && stub.baked.canvas) {
            g.drawImage(stub.baked.canvas, Math.round(box.x + stub.baked.ox), Math.round(box.y + stub.baked.oy));
          } else {
            g.fillStyle = P.woodWarm[1];
            g.fillRect(box.x, box.y, box.w, box.h);
          }
        } else if (knd === 'tree') {
          const stub = getEditorGhostStub(box.tpl, box.w, box.h);
          if (stub.baked && stub.baked.canvas) {
            g.drawImage(stub.baked.canvas, Math.round(box.cx + stub.baked.ox), Math.round(box.cy + stub.baked.oy));
          }
        } else if (knd === 'pole') {
          g.fillStyle = P.woodWarm[2];
          g.fillRect(box.cx - 2, box.cy - 6, 4, 12);
        } else if (knd === 'bottle') {
          g.fillStyle = P.foliage[1];
          g.fillRect(box.cx - 2, box.cy - 3, 4, 6);
        } else if (knd === 'bandit') {
          g.fillStyle = box.tpl.tough ? P.steelDark[3] : P.barnRed[1];
          fillRoundPix(g, box.cx - 6, box.cy - 8, 12, 16);
          g.fillStyle = P.brass[0];
          g.fillRect(box.cx - 2, box.cy - 2, 4, 4);
        } else if (knd === 'horse') {
          g.fillStyle = P.leather[2];
          fillRoundPix(g, box.cx - 12, box.cy - 6, 24, 12);
        } else if (knd === 'sheep') {
          g.fillStyle = P.cloud[0];
          fillRoundPix(g, box.cx - 6, box.cy - 5, 12, 10);
        }
        g.globalAlpha = 0.92;
        g.fillStyle = P.brass[0];
        g.fillRect(box.x - 1, box.y - 1, box.w + 2, 1);
        g.fillRect(box.x - 1, box.y + box.h, box.w + 2, 1);
        g.fillRect(box.x - 1, box.y, 1, box.h);
        g.fillRect(box.x + box.w, box.y, 1, box.h);
      }
    }

    // Красная пиксельная рамка подсветки редактируемого объекта под курсором (locked-здания и салун не подсвечиваются)
    if (hoverHit) {
      const rx = Math.round(hoverHit.x);
      const ry = Math.round(hoverHit.y);
      const rw = Math.round(hoverHit.w);
      const rh = Math.round(hoverHit.h);
      g.globalAlpha = ed.tool === 'erase' ? 0.95 : 0.45;
      g.fillStyle = P.blood[0];
      g.fillRect(rx - 2, ry - 2, rw + 4, 2);
      g.fillRect(rx - 2, ry + rh, rw + 4, 2);
      g.fillRect(rx - 2, ry, 2, rh);
      g.fillRect(rx + rw, ry, 2, rh);
    }

    g.restore();
  }

  function drawCrosshairs() {
    const mx = Math.round(state.input.mouseX);
    const my = Math.round(state.input.mouseY);

    if (state.editor && state.editor.active) {
      const ed = state.editor;
      ctx.save();
      ctx.fillStyle = '#0d0a08';
      ctx.fillRect(mx - 6, my - 2, 12, 4);
      ctx.fillRect(mx - 2, my - 6, 4, 12);
      ctx.fillStyle = ed.tool === 'erase' ? '#c9241c' : '#f2da91';
      ctx.fillRect(mx - 5, my - 1, 10, 2);
      ctx.fillRect(mx - 1, my - 5, 2, 10);
      ctx.restore();
      return;
    }

    const p = state.player;
    const w = G.SIM.getWeapon(state);
    const ws = G.SIM.getWState(state);
    const pos = G.SIM.getRenderPos(p);
    const pScr = worldToScreen(pos.x, pos.y);

    const aimDist = Math.max(38, Math.hypot(mx - pScr.x, my - pScr.y));
    const realX = Math.round(pScr.x + Math.cos(p.aimAngle) * aimDist);
    const realY = Math.round(pScr.y + Math.sin(p.aimAngle) * aimDist);
    const lagDist = Math.hypot(realX - mx, realY - my);

    if (lagDist > 6) {
      ctx.save();
      ctx.strokeStyle = 'rgba(212, 92, 68, 0.36)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(realX, realY);
      ctx.stroke();
      ctx.restore();
    }

    // Точка реального положения мыши: 4x4 чёрный контур + 2x2 белый центр
    ctx.fillStyle = '#0d0a08';
    ctx.fillRect(mx - 2, my - 2, 4, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mx - 1, my - 1, 2, 2);

    // При фокусе (ПКМ) — тонкий белый акцент с мягкой пульсацией
    if (state.input.rmb) {
      const pulse = Math.sin(state.time * 8) * 0.25 + 0.75;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.80 * pulse})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(mx - 4.5, my - 4.5, 9, 9);
    }

    const spreadPx = Math.round(G.MATH.clamp(Math.tan(p.spread) * aimDist, 6, 98));
    const locked = lagDist < 9;
    const col = p.wallBlocked
      ? '#c9883c'
      : locked
        ? '#e34234'
        : '#c74b3a';

    const tick = 8;
    ctx.fillStyle = '#120d0a';
    ctx.fillRect(realX - spreadPx - tick - 1, realY - 2, tick + 2, 4);
    ctx.fillRect(realX + spreadPx - 1, realY - 2, tick + 2, 4);
    ctx.fillRect(realX - 2, realY - spreadPx - tick - 1, 4, tick + 2);
    ctx.fillRect(realX - 2, realY + spreadPx - 1, 4, tick + 2);
    ctx.fillRect(realX - 3, realY - 3, 6, 6);

    ctx.fillStyle = col;
    ctx.fillRect(realX - spreadPx - tick, realY - 1, tick, 2);
    ctx.fillRect(realX + spreadPx, realY - 1, tick, 2);
    ctx.fillRect(realX - 1, realY - spreadPx - tick, 2, tick);
    ctx.fillRect(realX - 1, realY + spreadPx, 2, tick);
    ctx.fillRect(realX - 2, realY - 2, 4, 4);

    if (state.hitConfirm && state.hitConfirm.timer > 0) {
      const hc = state.hitConfirm;
      const frac = hc.timer / hc.maxTimer;
      const d1 = 6;
      const d2 = hc.fatal ? 15 : 12;
      ctx.save();
      ctx.globalAlpha = Math.min(1, frac * 1.4);
      ctx.strokeStyle = '#120d0a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(realX - d2, realY - d2); ctx.lineTo(realX - d1, realY - d1);
      ctx.moveTo(realX + d2, realY - d2); ctx.lineTo(realX + d1, realY - d1);
      ctx.moveTo(realX - d2, realY + d2); ctx.lineTo(realX - d1, realY + d1);
      ctx.moveTo(realX + d2, realY + d2); ctx.lineTo(realX + d1, realY + d1);
      ctx.stroke();

      ctx.strokeStyle = hc.fatal ? '#ff4030' : '#f2d079';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(realX - d2, realY - d2); ctx.lineTo(realX - d1, realY - d1);
      ctx.moveTo(realX + d2, realY - d2); ctx.lineTo(realX + d1, realY - d1);
      ctx.moveTo(realX - d2, realY + d2); ctx.lineTo(realX - d1, realY + d1);
      ctx.moveTo(realX + d2, realY + d2); ctx.lineTo(realX + d1, realY + d1);
      ctx.stroke();
      ctx.restore();
    }

    if (w.action === 'da' && ws.daCooldownTimer > 0) {
      const frac = ws.daCooldownTimer / w.daCooldown;
      ctx.strokeStyle = 'rgba(214, 177, 98, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(realX, realY, spreadPx + 6, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * frac);
      ctx.stroke();
    } else if (ws.cockTimer > 0 && ws.cockDuration > 0) {
      const frac = 1 - ws.cockTimer / ws.cockDuration;
      ctx.strokeStyle = 'rgba(140, 176, 107, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(realX, realY, spreadPx + 6, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * frac);
      ctx.stroke();
    }

    if (p.wallBlocked) {
      const label = 'УПОР В СТЕНУ (СТВОЛ ВВЕРХ)';
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#120d0a';
      ctx.fillText(label, realX + 1, realY - spreadPx - 13);
      ctx.fillStyle = '#e6b25c';
      ctx.fillText(label, realX, realY - spreadPx - 14);
    }
  }

  function drawFpsBadge() {
    if (!G.CFG.debugRays) return;
    const text = `FPS: ${curFps} (${curFrameMs.toFixed(1)} ms)`;
    ctx.save();
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const bw = Math.ceil(ctx.measureText(text).width) + 12;
    const bh = 18;
    const bx = 12;
    const by = 12;
    ctx.fillStyle = 'rgba(20, 15, 12, 0.88)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#c89e45';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    ctx.fillStyle = curFps >= 50 ? '#8ea164' : (curFps >= 30 ? '#f2da91' : '#c9241c');
    ctx.fillText(text, bx + 6, by + 4);
    ctx.restore();
  }

  function drawNoonVignette() {
    if (vignetteCanvas.width > 0 && vignetteCanvas.height > 0) {
      ctx.drawImage(vignetteCanvas, 0, 0);
    }
  }

  // Короткий красный акцент по краям экрана при попадании (ступенчатые полосы, без градиентов)
  function drawHurtAccent() {
    const p = state.player;
    if (!p || p.hurtTimer <= 0) return;
    const P = getPal();
    const k = G.MATH.clamp(p.hurtTimer / 0.35, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.08 + 0.18 * k;
    ctx.fillStyle = P.blood ? P.blood[0] : '#c9241c';
    const bands = [10, 6, 3];
    let off = 0;
    for (let i = 0; i < bands.length; i++) {
      const t = bands[i];
      ctx.fillRect(off, off, viewW - off * 2, t);
      ctx.fillRect(off, viewH - off - t, viewW - off * 2, t);
      ctx.fillRect(off, off, t, viewH - off * 2);
      ctx.fillRect(viewW - off - t, off, t, viewH - off * 2);
      off += t;
    }
    ctx.restore();
  }

  // ==================== ОБНОВЛЕНИЕ КОМПАКТНОГО HUD ====================

  function updateHatMenuUI() {
    if (!ui.hatMenu || !ui.hatList) return;
    const open = !!(state && state.hatMenuOpen);
    const kills = G.CFG.kills || 0;
    const sel = G.CFG.selectedHat || 'classic';
    const key = `${open}|${kills}|${sel}`;
    if (key === lastHatMenuKey) return;
    lastHatMenuKey = key;

    ui.hatMenu.classList.toggle('hidden', !open);
    if (!open) return;

    if (ui.hatKillsCount) {
      ui.hatKillsCount.textContent = `УБИЙСТВ: ${kills}`;
    }

    ui.hatList.innerHTML = '';
    const hats = G.HATS || [];
    for (let i = 0; i < hats.length; i++) {
      const h = hats[i];
      const unlocked = G.isHatUnlocked ? G.isHatUnlocked(h.id) : true;
      const active = h.id === sel;

      const row = document.createElement('div');
      row.className = 'hat-item' + (active ? ' active' : '') + (!unlocked ? ' locked' : '');

      const prev = document.createElement('canvas');
      prev.width = 30;
      prev.height = 30;
      prev.className = 'hat-preview';
      const pg = prev.getContext('2d');
      if (pg) {
        pg.imageSmoothingEnabled = false;
        pg.drawImage(getPlayerHatCanvas(h.id), 0, 0);
      }

      const info = document.createElement('div');
      info.className = 'hat-info';
      const nm = document.createElement('div');
      nm.className = 'hat-name';
      nm.textContent = h.name;
      const ds = document.createElement('div');
      ds.className = 'hat-meta';
      ds.textContent = h.desc;
      info.appendChild(nm);
      info.appendChild(ds);

      const badge = document.createElement('div');
      badge.className = 'hat-badge';
      if (active) badge.textContent = 'НАДЕТА';
      else if (unlocked) badge.textContent = 'ДОСТУПНА';
      else badge.textContent = `${kills}/${h.kills} УБ.`;

      row.appendChild(prev);
      row.appendChild(info);
      row.appendChild(badge);

      if (unlocked) {
        row.addEventListener('click', () => {
          G.setSelectedHat(h.id);
          if (state && state.player) state.player.hatId = h.id;
          if (G.NET && G.NET.updateLocalProfile) G.NET.updateLocalProfile(state, undefined, h.id);
          if (G.AUDIO.playHatEquip) G.AUDIO.playHatEquip();
          G.SIM.showToast(state, `ШЛЯПА: ${h.name.toUpperCase()}`, 1.2);
          lastHatMenuKey = '';
          updateHatMenuUI();
        });
      }

      ui.hatList.appendChild(row);
    }
  }

  function updateEditorUI() {
    const ed = state && state.editor;
    if (!ed) return;
    const isClient = state.netRole === 'client';
    if (isClient && ed.active && G.SIM && G.SIM.toggleEditorMode) {
      G.SIM.toggleEditorMode(state, world, false);
    }
    const activeTab = ed.tab || 'objects';
    if (activeTab !== lastEditorTab) {
      buildEditorPaletteDOM();
    }
    const key = `${ed.active}|${ed.tool}|${activeTab}|${ed.selectedType}|${ed.rotated}|${isClient}`;
    if (key === lastEditorKey) return;
    lastEditorKey = key;

    if (ui.btnEditor) {
      ui.btnEditor.disabled = isClient;
      ui.btnEditor.title = isClient ? 'Редактор доступен только хосту комнаты' : 'Редактор уровня';
      ui.btnEditor.classList.toggle('active', !!ed.active);
    }
    if (ui.editorPanel) ui.editorPanel.classList.toggle('hidden', !ed.active || isClient);
    if (ui.btnEditorPlace) ui.btnEditorPlace.classList.toggle('active', ed.tool === 'place');
    if (ui.btnEditorErase) {
      ui.btnEditorErase.classList.toggle('active', ed.tool === 'erase');
      ui.btnEditorErase.classList.toggle('btn-warn', ed.tool === 'erase');
    }
    if (ui.btnEditorTabObjects) ui.btnEditorTabObjects.classList.toggle('active', activeTab === 'objects');
    if (ui.btnEditorTabNpc) ui.btnEditorTabNpc.classList.toggle('active', activeTab === 'npc');
    if (ui.btnEditorRotate) {
      ui.btnEditorRotate.textContent = ed.rotated ? 'Повернуть [Q]: ВЕРТ' : 'Повернуть [Q]';
    }
    if (ui.editorPalette) {
      const btns = ui.editorPalette.children || [];
      for (let i = 0; i < btns.length; i++) {
        const b = btns[i];
        if (b && b.dataset) {
          b.classList.toggle('active', b.dataset.type === ed.selectedType);
        }
      }
    }
  }

  function updateNetUI() {
    if (!G.NET || !G.NET.getStatusInfo) return;
    const info = G.NET.getStatusInfo(state);
    const rosterSig = info.roster.map((r) => `${r.id}:${r.name}:${r.rttMs}:${r.kills}:${r.deaths}`).join(',');
    const key = `${info.role}|${info.roomCode}|${info.statusText}|${info.mpMode}|${info.friendlyFire}|${rosterSig}`;
    if (key === lastNetKey) return;
    lastNetKey = key;

    const online = info.role !== 'offline';
    const isClient = info.role === 'client';
    if (ui.btnNetwork) {
      ui.btnNetwork.classList.toggle('active', online);
      ui.btnNetwork.textContent = online ? (isClient ? '🌐 КЛИЕНТ' : `🌐 ХОСТ (${info.roster.length})`) : '🌐 СЕТЬ';
    }
    if (ui.btnNetMode) {
      ui.btnNetMode.disabled = isClient;
      ui.btnNetMode.textContent = info.mpMode === 'pvp' ? 'Режим: PvP Дуэль' : 'Режим: Кооп';
    }
    if (ui.btnNetFf) {
      ui.btnNetFf.disabled = isClient;
      ui.btnNetFf.textContent = info.friendlyFire ? 'Огонь по своим: ВКЛ' : 'Огонь по своим: ВЫКЛ';
      ui.btnNetFf.classList.toggle('btn-warn', !!info.friendlyFire);
    }
    if (ui.netRoomCode) {
      ui.netRoomCode.textContent = info.roomCode || '---';
    }
    if (ui.btnNetCopyRoom) {
      ui.btnNetCopyRoom.classList.toggle('hidden', !info.roomCode);
    }
    if (ui.netStatus) {
      ui.netStatus.textContent = info.statusText || 'ОФФЛАЙН';
    }
    if (ui.btnNetDisconnect) {
      ui.btnNetDisconnect.classList.toggle('hidden', !online);
    }
    if (ui.netPlayersList) {
      ui.netPlayersList.innerHTML = '';
      for (let i = 0; i < info.roster.length; i++) {
        const r = info.roster[i];
        const row = document.createElement('div');
        row.className = 'net-roster-row' + (r.isLocal ? ' local' : '');
        const left = document.createElement('span');
        left.textContent = (r.isLocal ? '★ ' : '') + r.name;
        const right = document.createElement('span');
        right.className = 'net-roster-meta';
        right.textContent = `${r.kills}/${r.deaths} • ${r.rttMs}мс`;
        row.appendChild(left);
        row.appendChild(right);
        ui.netPlayersList.appendChild(row);
      }
    }
  }

  function updateHUD(dt) {
    const p = state.player;
    const w = G.SIM.getWeapon(state);
    const ws = G.SIM.getWState(state);

    if (ui.hpBarFill) {
      const P = getPal();
      if (G.CFG && G.CFG.godMode) {
        ui.hpBarFill.style.width = '100%';
        ui.hpBarFill.style.background = (P.brass && P.brass[0]) || '#f2da91';
        if (ui.hpNum) ui.hpNum.textContent = '∞';
      } else {
        const curHp = Math.max(0, p.hp !== undefined ? p.hp : 100);
        const maxHp = p.maxHp || 100;
        const pct = Math.round((curHp / maxHp) * 100);
        ui.hpBarFill.style.width = `${pct}%`;
        if (pct > 50) {
          ui.hpBarFill.style.background = '#6d824d';
        } else if (pct > 25) {
          ui.hpBarFill.style.background = '#c89e45';
        } else {
          ui.hpBarFill.style.background = '#c9241c';
        }
        if (ui.hpNum) ui.hpNum.textContent = `${Math.round(curHp)} / ${maxHp}`;
      }
    }

    if (ui.horseHudRow) {
      const hr = world && world.horse;
      const showHorse = !!(p.mountedHorse && hr && hr.state !== 'dead');
      ui.horseHudRow.classList.toggle('hidden', !showHorse);
      if (showHorse) {
        const hHp = Math.max(0, Math.round(hr.hp || 0));
        const hMax = hr.maxHp || 150;
        const hCalm = Math.max(0, Math.round(hr.calm !== undefined ? hr.calm : 100));
        if (ui.horseHpFill) ui.horseHpFill.style.width = `${Math.round((hHp / hMax) * 100)}%`;
        if (ui.horseCalmFill) ui.horseCalmFill.style.width = `${hCalm}%`;
        if (ui.horseHudVal) ui.horseHudVal.textContent = `${hHp} HP`;
      }
    }

    if (ui.zoneName) ui.zoneName.textContent = state.zoneLabel || 'САЛУН';
    if (ui.echoInfo) ui.echoInfo.textContent = state.echoDesc || 'ЗАКРЫТОЕ ПОМЕЩЕНИЕ';

    if (ui.waveLabel && ui.waveEnemies) {
      const aliveCount = world && world.getAliveBanditsCount ? world.getAliveBanditsCount() : 0;
      const wv = state.waves || { active: false, wave: 0, phase: 'idle', breakTimer: 0 };
      const brkSec = wv.active && wv.phase === 'break' ? Math.max(1, Math.ceil(wv.breakTimer || 0)) : 0;
      const waveKey = `${wv.active}|${wv.wave}|${wv.phase}|${brkSec}|${aliveCount}`;
      if (waveKey !== lastWaveKey) {
        lastWaveKey = waveKey;
        if (wv.active) {
          if (wv.phase === 'break') {
            ui.waveLabel.textContent = `ПЕРЕДЫШКА: ${brkSec}с`;
            ui.waveLabel.classList.add('wave-break');
          } else {
            ui.waveLabel.textContent = `ВОЛНА ${wv.wave}`;
            ui.waveLabel.classList.remove('wave-break');
          }
        } else {
          ui.waveLabel.textContent = 'СВОБОДНЫЙ БОЙ';
          ui.waveLabel.classList.remove('wave-break');
        }
        ui.waveEnemies.textContent = `ВРАГОВ: ${aliveCount}`;
        updateWavesButton();
      }
    }

    updateHatMenuUI();
    updateEditorUI();
    netUiTimer += (dt || 0.016);
    if (netUiTimer >= 0.25) {
      netUiTimer = 0;
      updateNetUI();
    }

    if (ui.statusLine) {
      if (state.editor && state.editor.active) {
        ui.statusLine.textContent = state.editor.tool === 'erase' ? 'РЕДАКТОР: УДАЛЕНИЕ [ПКМ / ЛКМ]' : 'РЕДАКТОР: РАЗМЕЩЕНИЕ [ЛКМ]';
      } else if (p.bandaging) {
        const pctB = Math.round(G.MATH.clamp((p.bandageTimer || 0) / (p.bandageDur || 2.5), 0, 1) * 100);
        ui.statusLine.textContent = `ПЕРЕВЯЗКА: ${pctB}% (БЕЗ ОРУЖИЯ)`;
      } else if (p.drinking) {
        const pctD = Math.round(G.MATH.clamp((p.drinkTimer || 0) / (p.drinkDur || 1.8), 0, 1) * 100);
        ui.statusLine.textContent = `БУРБОН: ${pctD}% (ВОССТАНОВЛЕНИЕ)`;
      } else if (p.stunTimer > 0) {
        ui.statusLine.textContent = 'ОГЛУШЁН!';
      } else if (p.mountedHorse) {
        ui.statusLine.textContent = 'ВЕРХОМ НА ЛОШАДИ ([E] СЛЕЗТЬ)';
      } else if (p.rolling) {
        ui.statusLine.textContent = 'ПЕРЕКАТ';
      } else if (ws.reloading) {
        ui.statusLine.textContent = 'ПЕРЕЗАРЯДКА — КЛИК ПО КАМОРЕ ИЛИ [R]';
      } else if (p.critical || p.bleeding) {
        const bandLbl = G.keyLabel(G.CFG.keys.bandage || 'KeyQ');
        ui.statusLine.textContent = `КРИТИЧЕСКОЕ РАНЕНИЕ — [${bandLbl}] БИНТЫ`;
      } else if (p.inCover) {
        ui.statusLine.textContent = p.peeking ? 'УКРЫТИЕ: ВЫГЛЯДЫВАНИЕ' : 'В УКРЫТИИ (ПКМ — ВЫГЛЯНУТЬ)';
      } else if (p.wallBlocked) {
        ui.statusLine.textContent = 'УПОР В СТЕНУ — СТВОЛ ВВЕРХ';
      } else if (state.input.rmb) {
        ui.statusLine.textContent = 'ФОКУС — СТАБИЛИЗАЦИЯ';
      } else {
        ui.statusLine.textContent = 'ГОТОВ К БОЮ';
      }
    }

    if (ui.bandageSlot && ui.bandageCount) {
      const cnt = p.bandages !== undefined ? p.bandages : 2;
      const maxB = p.maxBandages || 3;
      const invKey = `${cnt}|${maxB}|${!!p.bandaging}|${!!p.bleeding}|${!!p.critical}|${(p.concussion || 0) > 0.2}`;
      if (invKey !== lastInvKey) {
        lastInvKey = invKey;
        ui.bandageCount.textContent = `${cnt}/${maxB}`;
        ui.bandageSlot.classList.toggle('empty', cnt <= 0);
        ui.bandageSlot.classList.toggle('active-use', !!p.bandaging);
        if (ui.bleedBadge) {
          const showCrit = !!(p.bleeding || p.critical || (p.concussion || 0) > 0.25);
          ui.bleedBadge.classList.toggle('hidden', !showCrit);
          if (showCrit) {
            ui.bleedBadge.textContent = p.bleeding ? 'КРОВОТЕЧЕНИЕ' : 'КОНТУЗИЯ';
          }
        }
      }
    }

    if (lastWeaponIdx !== p.weaponIdx) {
      lastWeaponIdx = p.weaponIdx;
      ui.weaponSlots.forEach((el, idx) => {
        el.classList.toggle('active', idx === p.weaponIdx);
      });
    }

    if (ui.ammoDots && ui.ammoCount) {
      let ammoKey;
      if (w.uiShape === 'cylinder') {
        G.SIM.ensureChambers(w, ws);
        ammoKey = `${w.id}|${ws.chambers.join(',')}`;
      } else {
        ammoKey = `${w.id}|${ws.ammo}|${ws.spent}|${w.capacity}`;
      }
      if (ammoKey !== lastAmmoKey) {
        lastAmmoKey = ammoKey;
        ui.ammoDots.innerHTML = '';
        if (w.uiShape === 'cylinder') {
          for (let i = 0; i < ws.chambers.length; i++) {
            const dot = document.createElement('div');
            dot.className = 'ammo-dot';
            if (ws.chambers[i] === 'live') dot.classList.add('live');
            else if (ws.chambers[i] === 'spent') dot.classList.add('spent');
            ui.ammoDots.appendChild(dot);
          }
        } else {
          for (let i = 0; i < w.capacity; i++) {
            const dot = document.createElement('div');
            dot.className = 'ammo-dot';
            if (i < ws.ammo) dot.classList.add('live');
            else if (i < ws.ammo + ws.spent) dot.classList.add('spent');
            ui.ammoDots.appendChild(dot);
          }
        }
        ui.ammoCount.textContent = `${ws.ammo}/${w.capacity}`;
      }
    }

    if (ui.mechState) {
      const cockLbl = G.keyLabel(G.CFG.keys.cock);
      if (ws.reloading) {
        ui.mechState.textContent = 'ЗАРЯДКА';
        ui.mechState.className = 'mech-busy';
      } else if (ws.cockTimer > 0) {
        ui.mechState.textContent = w.action === 'lever' ? 'СКОБА...' : 'ВЗВОД...';
        ui.mechState.className = 'mech-busy';
      } else if (w.action === 'da') {
        if (ws.ammo <= 0) {
          ui.mechState.textContent = 'ПУСТО [R]';
          ui.mechState.className = 'mech-need';
        } else if (ws.daCooldownTimer > 0 || ws.daPullTimer > 0) {
          ui.mechState.textContent = 'СПУСК DA';
          ui.mechState.className = 'mech-busy';
        } else {
          ui.mechState.textContent = 'DA ГОТОВ';
          ui.mechState.className = 'mech-ready';
        }
      } else {
        if (ws.ammo <= 0 && !ws.chamberSpent) {
          ui.mechState.textContent = 'ПУСТО [R]';
          ui.mechState.className = 'mech-need';
        } else if (!ws.cocked) {
          ui.mechState.textContent = w.action === 'lever'
            ? `СКОБА [${cockLbl}]`
            : `ВЗВОД [${cockLbl}]`;
          ui.mechState.className = 'mech-need';
        } else {
          ui.mechState.textContent = 'ВЗВЕДЁН';
          ui.mechState.className = 'mech-ready';
        }
      }
    }

    if (ui.reloadPanel) {
      if (ws.reloading !== lastReloadVis) {
        lastReloadVis = ws.reloading;
        ui.reloadPanel.classList.toggle('hidden', !ws.reloading);
      }
      if (ws.reloading && ui.reloadTitle) {
        const title = `${w.name.toUpperCase()} • ${ws.ammo}/${w.capacity}`;
        if (title !== lastReloadTitle) {
          lastReloadTitle = title;
          ui.reloadTitle.textContent = title;
        }
      }
    }

    if (ui.toast) {
      const toastVis = state.toast.timer > 0 && !!state.toast.text;
      if (toastVis !== lastToastVisible || (toastVis && state.toast.text !== lastToastText)) {
        lastToastVisible = toastVis;
        lastToastText = state.toast.text;
        ui.toast.classList.toggle('hidden', !toastVis);
        if (toastVis) ui.toast.textContent = state.toast.text;
      }
    }

    if (ui.btnToggleRays) {
      ui.btnToggleRays.textContent = `Лучи (V): ${G.CFG.debugRays ? 'ВКЛ' : 'ВЫКЛ'}`;
    }
    if (ui.btnToggleBandits) {
      ui.btnToggleBandits.textContent = `Бандиты: ${G.CFG.spawnBandits ? 'ВКЛ' : 'ВЫКЛ'}`;
    }
    if (ui.btnToggleStorm) {
      const stormOn = !!(state && state.dustStorm && state.dustStorm.active);
      ui.btnToggleStorm.textContent = `Пыльная буря: ${stormOn ? 'ВКЛ' : 'ВЫКЛ'}`;
      ui.btnToggleStorm.classList.toggle('btn-warn', stormOn);
    }
  }

  // ==================== ГЛАВНЫЙ ЦИКЛ ====================

  const _playersDrawBuf = [];

  function renderFrame(dt) {
    const zoom = getZoom();
    const org = getCamOrigin();
    if (state) {
      if (!state.viewRect) {
        state.viewRect = { x: org.x, y: org.y, w: pixW, h: pixH };
      } else {
        state.viewRect.x = org.x;
        state.viewRect.y = org.y;
        state.viewRect.w = pixW;
        state.viewRect.h = pixH;
      }
    }

    pctx.imageSmoothingEnabled = false;
    pctx.fillStyle = '#17120f';
    pctx.fillRect(0, 0, pixW, pixH);

    pctx.save();
    pctx.translate(-org.x, -org.y);

    if (world.bgCanvas) {
      const sx = Math.max(0, Math.floor(org.x));
      const sy = Math.max(0, Math.floor(org.y));
      const ex = Math.min(world.bgCanvas.width, Math.ceil(org.x + pixW));
      const ey = Math.min(world.bgCanvas.height, Math.ceil(org.y + pixH));
      const sw = ex - sx;
      const sh = ey - sy;
      if (sw > 0 && sh > 0) {
        pctx.drawImage(world.bgCanvas, sx, sy, sw, sh, sx, sy, sw, sh);
      }
    }
    drawSaloonDaylight(pctx);

    for (let i = 0; i < world.solids.length; i++) {
      const s = world.solids[i];
      const shLen = getShadowLength(s);
      if (!isInView(s.x, s.y, s.w + Math.ceil(SUN.dx * shLen), s.h + Math.ceil(SUN.dy * shLen), org, 24)) continue;
      drawNoonShadow(pctx, s);
    }
    drawCloudShadows(pctx, org);

    drawDecals(pctx, org);
    drawBloodTrail(pctx, org);
    drawPuddles(pctx, org);
    drawDeadBandits(pctx, org);
    drawShells(pctx, org);
    drawFlyingHats(pctx, org);

    for (let i = 0; i < world.solids.length; i++) {
      const s = world.solids[i];
      if (!s.high && isInView(s.x, s.y, s.w, s.h, org, 48)) drawSolid(pctx, s);
    }
    drawSaloonInteractables(pctx);

    drawTargets(pctx, org);
    drawDoors(pctx);
    drawSheep(pctx, org);
    drawHorse(pctx, org);

    const srcPlayers = (G.SIM && G.SIM.getPlayers) ? G.SIM.getPlayers(state) : [state.player];
    if (srcPlayers.length <= 1) {
      if (srcPlayers[0]) drawPlayer(pctx, srcPlayers[0]);
    } else {
      _playersDrawBuf.length = 0;
      for (let i = 0; i < srcPlayers.length; i++) {
        if (srcPlayers[i]) _playersDrawBuf.push(srcPlayers[i]);
      }
      _playersDrawBuf.sort((a, b) => (a.y || 0) - (b.y || 0));
      for (let i = 0; i < _playersDrawBuf.length; i++) {
        drawPlayer(pctx, _playersDrawBuf[i]);
      }
    }
    drawBullets(pctx);
    drawBloodDrops(pctx, org);

    for (let i = 0; i < world.solids.length; i++) {
      const s = world.solids[i];
      if (s.high && isInView(s.x, s.y, s.w, s.h, org, 48)) drawSolid(pctx, s);
    }
    drawPolesAndWires(pctx, org);
    drawTrees(pctx, org);
    drawBirdFlocks(pctx, org);

    drawParticles(pctx, org);
    drawGunSmokeClouds(pctx, org);
    drawDustMotes(pctx, dt, org);
    drawDustStorm(pctx, org);
    drawMuzzleGlow(pctx, org);
    drawDebugRays(pctx);
    drawEditorOverlay(pctx, org);

    pctx.restore();

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#17120f';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.drawImage(pixCanvas, 0, 0, pixW, pixH, 0, 0, pixW * zoom, pixH * zoom);

    // Эффект двоения экрана при контузии / критическом состоянии (с сохранением чёткой пиксельной сетки)
    const pConc = state && state.player && !state.player.dead ? Math.max(state.player.critical ? 0.8 : 0, state.player.concussion || 0) : 0;
    if (pConc > 0.08) {
      const dblX = Math.round(Math.sin(state.time * 4.5) * 4 * pConc) * Math.max(1, Math.round(zoom * 0.5));
      const dblY = Math.round(Math.cos(state.time * 3.1) * 2.5 * pConc) * Math.max(1, Math.round(zoom * 0.5));
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 0.24 * G.MATH.clamp(pConc, 0, 1);
      ctx.drawImage(pixCanvas, 0, 0, pixW, pixH, dblX, dblY, pixW * zoom, pixH * zoom);
      ctx.restore();
    }

    drawNoonVignette();
    drawHurtAccent();
    drawWorldOverlaysOnScreen();
    drawFpsBadge();
    drawCrosshairs();

    updateReloadAnim(dt);
    drawReloadWidget();
  }

  let lastTs = 0;
  let fpsWorkAccum = 0;
  function loop(ts) {
    const rawDt = lastTs ? Math.max(0.001, (ts - lastTs) / 1000) : 0.016;
    const dt = Math.min(0.033, rawDt);
    lastTs = ts;
    const tStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : ts;

    const wm = screenToWorld(state.input.mouseX, state.input.mouseY);
    state.input.worldMouseX = wm.x;
    state.input.worldMouseY = wm.y;

    if (G.NET && G.NET.step) {
      G.NET.step(state, world, dt);
    } else {
      G.SIM.update(state, world, dt);
    }
    renderFrame(dt);
    updateHUD(dt);

    const tEnd = (typeof performance !== 'undefined' && performance.now) ? performance.now() : ts;
    fpsAccum += rawDt;
    fpsWorkAccum += Math.max(0.1, tEnd - tStart);
    fpsFrames++;
    if (fpsAccum >= 0.3) {
      curFps = Math.round(fpsFrames / fpsAccum);
      curFrameMs = fpsWorkAccum / fpsFrames;
      fpsAccum = 0;
      fpsWorkAccum = 0;
      fpsFrames = 0;
    }

    requestAnimationFrame(loop);
  }

  function init() {
    resize();
    initReloadCaches();
    state = G.createInitialState();
    world = G.WORLD.create();
    state.input.mouseX = viewW * 0.6;
    state.input.mouseY = viewH * 0.5;
    if (ui.netName) ui.netName.value = G.CFG.playerName || 'СТРЕЛОК';
    bindEvents();
    refreshKeybindLabels();
    syncSettingsUI();
    updateHUD();
    updateNetUI();
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
