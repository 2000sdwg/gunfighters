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
    btnToggleSpawn: document.getElementById('btn-toggle-spawn'),
    bindBtns: Array.from(document.querySelectorAll('.btn-bind')),
    btnResetBinds: document.getElementById('btn-reset-binds'),
    btnToggleRays: document.getElementById('btn-toggle-rays'),
    btnToggleBandits: document.getElementById('btn-toggle-bandits'),
    toast: document.getElementById('center-toast'),
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
  for (let i = 0; i < 42; i++) {
    dustMotes.push({
      x: (i * 97) % 1400,
      y: 65 + ((i * 53) % 620),
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
    // Рисуем только узел: ствольную коробку, верхнее окно заряжания, боковую крышку,
    // скобу-рычаг, часть цевья и короткие отрезки ствола и трубки магазина — не весь карабин.
    function bakeWinchesterReceiver() {
      const { c, g } = makeOffscreen(RELOAD_W, RELOAD_H);
      const colOut = P.outline || '#140f0c';

      // Тень под узлом
      g.fillStyle = 'rgba(0, 0, 0, 0.32)';
      g.fillRect(30, 76, 102, 4);

      // --- Латунная ствольная коробка ---
      g.fillStyle = colOut;
      g.fillRect(26, 36, 78, 32);
      g.fillStyle = P.brass[2];
      g.fillRect(27, 37, 76, 30);
      g.fillStyle = P.brass[1];
      g.fillRect(27, 41, 76, 22);
      g.fillStyle = P.brass[0];
      g.fillRect(27, 37, 76, 3);
      g.fillStyle = P.brass[3];
      g.fillRect(27, 60, 76, 7);
      g.fillStyle = P.brass[4];
      g.fillRect(27, 65, 76, 2);

      // --- Боковая крышка коробки с винтами ---
      g.fillStyle = P.brass[3];
      g.fillRect(34, 43, 62, 16);
      g.fillStyle = P.brass[2];
      g.fillRect(35, 44, 60, 14);
      g.fillStyle = P.brass[1];
      g.fillRect(35, 44, 60, 1);
      g.fillStyle = P.brass[0];
      g.fillRect(44, 50, 42, 1);
      g.fillStyle = P.lead[2];
      g.fillRect(38, 46, 2, 2);
      g.fillRect(92, 46, 2, 2);
      g.fillRect(38, 55, 2, 2);
      g.fillRect(92, 55, 2, 2);

      // --- Курок и хвостовик позади коробки ---
      g.fillStyle = colOut;
      g.fillRect(20, 30, 8, 16);
      g.fillStyle = P.steelDark[2];
      g.fillRect(21, 31, 6, 14);
      g.fillStyle = P.steelDark[0];
      g.fillRect(21, 31, 3, 2);
      g.fillStyle = P.steelDark[4];
      g.fillRect(23, 36, 3, 7);

      // --- Скоба-рычаг Генри снизу (кольцо, внутри прозрачно) ---
      g.fillStyle = colOut;
      g.fillRect(38, 66, 34, 5);
      g.fillRect(38, 78, 34, 4);
      g.fillRect(38, 66, 5, 16);
      g.fillRect(67, 66, 5, 16);
      g.fillStyle = P.brass[2];
      g.fillRect(39, 67, 32, 3);
      g.fillRect(39, 77, 32, 2);
      g.fillRect(39, 67, 3, 12);
      g.fillRect(68, 67, 3, 12);
      g.fillStyle = P.brass[0];
      g.fillRect(39, 67, 32, 1);
      g.fillRect(39, 67, 3, 8);
      // Спусковой крючок внутри скобы
      g.fillStyle = P.steelDark[2];
      g.fillRect(52, 70, 3, 6);
      g.fillStyle = P.steelDark[0];
      g.fillRect(52, 70, 1, 4);

      // --- Короткий отрезок ствола (срез у правого края) ---
      g.fillStyle = colOut;
      g.fillRect(103, 39, 30, 8);
      g.fillStyle = P.steelDark[2];
      g.fillRect(104, 40, 29, 6);
      g.fillStyle = P.steelDark[1];
      g.fillRect(104, 40, 29, 3);
      g.fillStyle = P.steelDark[0];
      g.fillRect(104, 40, 29, 1);
      g.fillStyle = P.steelDark[0];
      g.fillRect(129, 37, 2, 3);
      g.fillStyle = colOut;
      g.fillRect(131, 39, 2, 8);

      // --- Трубка магазина под стволом ---
      g.fillStyle = colOut;
      g.fillRect(100, 49, 27, 6);
      g.fillStyle = P.steelDark[3];
      g.fillRect(101, 50, 26, 4);
      g.fillStyle = P.steelDark[1];
      g.fillRect(101, 50, 26, 1);

      // --- Часть деревянного цевья с латунным кольцом ---
      g.fillStyle = colOut;
      g.fillRect(96, 46, 28, 15);
      g.fillStyle = P.woodWarm[1];
      g.fillRect(97, 47, 26, 13);
      g.fillStyle = P.woodWarm[0];
      g.fillRect(97, 47, 24, 3);
      g.fillStyle = P.woodWarm[3];
      g.fillRect(97, 56, 26, 4);
      g.fillStyle = P.brass[1];
      g.fillRect(118, 46, 3, 15);
      g.fillStyle = P.brass[0];
      g.fillRect(118, 46, 1, 15);

      // --- Верхнее окно заряжания: прорезь в верхней стенке коробки ---
      g.clearRect(50, 36, 30, 9);
      g.fillStyle = 'rgba(12, 9, 7, 0.55)';
      g.fillRect(51, 37, 28, 8);
      g.fillStyle = P.brass[0];
      g.fillRect(50, 36, 30, 1);
      g.fillStyle = P.brass[3];
      g.fillRect(51, 44, 28, 2);

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

    // 1. Патрон подаётся сверху и уходит в верхнее окно коробки (рисуется ЗА фрагментом)
    for (let i = 0; i < reloadAnim.inserts.length; i++) {
      const ins = reloadAnim.inserts[i];
      if (ins.kind !== 'tube') continue;
      const p = G.MATH.clamp(ins.t / ins.dur, 0, 1);
      const ease = 1 - Math.pow(1 - p, 2);
      const cartTop = Math.round(fY - 20 + ease * 58);
      rctx.drawImage(caches.topCartridge, 60, cartTop);
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
  }

  function getCamOrigin() {
    const cX = Math.round(state.camera.x + state.camera.shakeX);
    const cY = Math.round(state.camera.y + state.camera.shakeY);
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
      target.closest('#hud-top-right, #reload-panel, #hud-bottom-left, #hud-bottom')
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
    const moveAct = coverLbl === rollLbl
      ? `${coverLbl} укр/перекат`
      : `${coverLbl} укр • ${rollLbl} перекат`;
    if (ui.controlsLegend) {
      ui.controlsLegend.textContent =
        `WASD • ЛКМ огонь • ПКМ фокус • ${cockLbl} взвод • ${moveAct} • R зарядка`;
    }
  }

  function updateSpawnButton() {
    if (!ui.btnToggleSpawn) return;
    ui.btnToggleSpawn.textContent = G.CFG.pauseSpawn ? 'Спавн ботов: СТОП' : 'Спавн ботов: ИДЁТ';
    ui.btnToggleSpawn.classList.toggle('btn-warn', !!G.CFG.pauseSpawn);
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
    updateSpawnButton();
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

    window.addEventListener('mousedown', (e) => {
      G.AUDIO.unlock();
      if (isPointerOverUI(e.target)) return;

      if (e.button === 0) {
        state.input.lmb = true;
        G.SIM.tryFire(state, world);
      } else if (e.button === 2) {
        state.input.rmb = true;
        const ws = G.SIM.getWState(state);
        if (ws.reloading) {
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
      G.SIM.switchWeapon(state, next);
    }, { passive: true });

    window.addEventListener('keydown', (e) => {
      G.AUDIO.unlock();

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
        G.SIM.handleKeyDown(state, world, e.code);
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
          G.SIM.closeReload(state);
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
          if (idx !== -1) {
            G.SIM.insertOneRound(state, world, idx);
          } else {
            G.SIM.insertOneRound(state, world);
          }
        } else {
          G.SIM.insertOneRound(state, world);
        }
      });
    }

    if (ui.btnSettings) {
      ui.btnSettings.addEventListener('click', () => {
        ui.settingsPanel.classList.toggle('hidden');
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

    // Ползунок меткости ботов: чем ниже, тем шире разброс их выстрелов
    if (ui.slAccuracy) {
      ui.slAccuracy.addEventListener('input', () => {
        G.CFG.botAccuracy = G.MATH.clamp(parseFloat(ui.slAccuracy.value), 0, 1);
        if (ui.valAccuracy) ui.valAccuracy.textContent = `${Math.round(G.CFG.botAccuracy * 100)}%`;
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

    ui.weaponSlots.forEach((slot) => {
      slot.addEventListener('click', () => {
        const idx = parseInt(slot.dataset.idx, 10);
        G.SIM.switchWeapon(state, idx);
      });
    });

    if (ui.btnInsertOne) {
      ui.btnInsertOne.addEventListener('click', () => {
        G.AUDIO.unlock();
        G.SIM.insertOneRound(state, world);
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
    return 6;
  }

  function drawNoonShadow(g, s) {
    const insideSaloon = s.x + s.w <= 338 && s.y >= 70 && s.y + s.h <= 450 && s.type !== 'wall';
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

  // Детерминированный хеш для рваных пиксельных краёв облачной тени
  function hashPix(ix, iy) {
    let n = (ix * 374761393 + iy * 668265263) ^ 0x5bf03635;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function initCloudCaches() {
    if (cloudCaches) return cloudCaches;

    // Пиксельный силуэт облака: кластер прямоугольных пятен с рваными краями.
    // Мягкость — только за счёт rgba и ступеней плотности, без сглаживания.
    function bakeOneCloud(w, h, seed) {
      const { c, g } = makeOffscreen(w, h);
      const rng = makeRng(seed);
      const cell = 3;
      const cols = Math.floor(w / cell);
      const rows = Math.floor(h / cell);
      const grid = new Float32Array(cols * rows);

      // 5–7 перекрывающихся «пиксельных» ядер облака
      const cores = [];
      const coreCount = 5 + Math.floor(rng() * 3);
      for (let i = 0; i < coreCount; i++) {
        cores.push({
          cx: (0.16 + rng() * 0.64) * cols,
          cy: (0.28 + rng() * 0.44) * rows,
          rx: (0.16 + rng() * 0.19) * cols,
          ry: (0.17 + rng() * 0.19) * rows
        });
      }

      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          let v = 0;
          for (let i = 0; i < cores.length; i++) {
            const k = cores[i];
            const dx = (cx - k.cx) / k.rx;
            const dy = (cy - k.cy) / k.ry;
            const val = 1 - Math.sqrt(dx * dx + dy * dy);
            if (val > v) v = val;
          }
          // Сдвиг по SUN: силуэт вытянут и скошен в сторону солнца, не симметричен
          const slant = ((rows - cy) / rows) * (cores[0].rx * 0.10);
          const shifted = v - (cx < cores[0].cx - slant ? 0.06 : 0) - (cx > cores[0].cx + slant ? 0.02 : 0);
          const noise = hashPix(cx + seed, cy * 3 + seed) - 0.5;
          grid[cy * cols + cx] = shifted + noise * 0.42;
        }
      }

      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          const v = grid[cy * cols + cx];
          const px = cx * cell;
          const py = cy * cell;
          if (v > 0.34) {
            // Плотное ядро
            g.fillStyle = 'rgba(26, 32, 46, 0.16)';
            g.fillRect(px, py, cell, cell);
          } else if (v > 0.15) {
            // Промежуточная плотность — честный пиксельный дизеринг по сетке
            g.fillStyle = 'rgba(26, 32, 46, 0.11)';
            if (((cx + cy) & 1) === 0) {
              g.fillRect(px, py, cell, cell);
            } else {
              g.fillRect(px + 1, py, cell - 1, cell);
              g.fillRect(px, py + 1, cell, cell - 1);
            }
          } else if (v > 0.02) {
            // Рваная кромка: отдельные пиксельные «клочки»
            if (hashPix(cx * 7 + seed, cy * 11 + seed) < 0.52) {
              g.fillStyle = 'rgba(26, 32, 46, 0.08)';
              g.fillRect(px, py, 2, 2);
              if (hashPix(cx * 3 + seed, cy * 5 + seed) < 0.32) {
                g.fillRect(px + 2, py + 1, 1, 1);
              }
            }
          }
        }
      }

      // Разрывы внутри силуэта (просветы между «клубами»)
      for (let i = 0; i < 7; i++) {
        const hx = Math.floor(rng() * cols) * cell;
        const hy = Math.floor(rng() * rows) * cell;
        if (grid[Math.floor(hy / cell) * cols + Math.floor(hx / cell)] <= 0.2) continue;
        g.clearRect(hx, hy, cell, cell);
      }

      return c;
    }

    cloudCaches = [
      bakeOneCloud(264, 138, 114),
      bakeOneCloud(342, 180, 227),
      bakeOneCloud(282, 150, 339)
    ];
    return cloudCaches;
  }

  function drawCloudShadows(g) {
    const caches = initCloudCaches();
    const period = world.width + 520;
    // Бег облаков по ветру, синхронизированный с рябью бочек
    const drift = state.time * 22;
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
      g.drawImage(cl.img, px, py);
    }
    g.restore();
  }

  function drawSaloonDaylight(g) {
    // Прохладное затемнение интерьера
    g.fillStyle = 'rgba(20, 24, 32, 0.28)';
    g.fillRect(38, 84, 286, 352);

    // Честные ступенчатые пиксельные световые пятна от открытых распашных дверей (x: 324, y: 217..293)
    // 3 градации плотности света в направлении запада без градиентов
    g.fillStyle = 'rgba(242, 218, 145, 0.26)';
    g.fillRect(296, 222, 28, 70);
    g.fillStyle = 'rgba(242, 218, 145, 0.17)';
    g.fillRect(268, 214, 28, 86);
    g.fillStyle = 'rgba(242, 218, 145, 0.09)';
    g.fillRect(240, 206, 28, 102);

    // Световые пятна от правых окон салуна (sal_right1: wy ~ 118; sal_right2: wy ~ 348)
    const windowSpots = [118, 348];
    windowSpots.forEach((wy) => {
      // Ступенчатое пятно света на полу
      g.fillStyle = 'rgba(242, 218, 145, 0.22)';
      g.fillRect(284, wy - 4, 40, 32);
      g.fillStyle = 'rgba(242, 218, 145, 0.11)';
      g.fillRect(264, wy - 1, 20, 26);

      // Тени от оконного деревянного переплёта (крестовина)
      g.fillStyle = 'rgba(20, 24, 32, 0.24)';
      g.fillRect(278, wy + 11, 46, 2); // горизонтальный переплёт
      g.fillRect(302, wy - 4, 2, 32);  // вертикальный переплёт
    });
  }

  // ==================== ДЕКАЛИ И 2.5D-КРОВЬ ====================

  function drawDecals(g) {
    for (let i = 0; i < state.decals.length; i++) {
      const dc = state.decals[i];
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
      } else {
        g.fillStyle = dc.color;
        const s = Math.max(1, Math.round(dc.r * 1.2));
        g.fillRect(Math.round(dc.x - s * 0.5), Math.round(dc.y - s * 0.5), s, s);
      }
    }
  }

  function drawBloodDrops(g) {
    if (!state.bloodDrops || !state.bloodDrops.length) return;
    for (let i = 0; i < state.bloodDrops.length; i++) {
      const bd = state.bloodDrops[i];
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

  // ==================== БОЧКИ С ВОДОЙ И ОТРАЖЕНИЯМИ ====================

  function drawWaterBarrel(g, s) {
    const P = getPal();
    const cx = Math.round(s.x + s.w * 0.5);
    const cy = Math.round(s.y + s.h * 0.5);
    const r = Math.floor(s.w * 0.5);
    const waterR = r - 3;
    const colOut = P.outline || '#140f0c';

    // Внешний контур и обод бочки
    g.fillStyle = colOut;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();

    // Деревянный обод бочки (woodWarm)
    g.fillStyle = P.woodWarm[3];
    g.beginPath();
    g.arc(cx, cy, r - 1, 0, Math.PI * 2);
    g.fill();

    // Железный обруч бочки
    g.fillStyle = P.steelDark[2];
    g.beginPath();
    g.arc(cx, cy, r - 1.5, 0, Math.PI * 2);
    g.fill();

    // Солнечный верхне-левый блик на ободе
    g.fillStyle = P.woodWarm[0];
    g.beginPath();
    g.arc(cx - 1, cy - 1, r - 2, Math.PI * 0.8, Math.PI * 1.8);
    g.fill();

    g.save();
    g.beginPath();
    g.arc(cx, cy, waterR, 0, Math.PI * 2);
    g.clip();

    // Водная гладь (water)
    g.fillStyle = P.water[3];
    g.fillRect(cx - waterR, cy - waterR, waterR * 2, waterR * 2);
    g.fillStyle = P.water[2];
    g.fillRect(cx - waterR, cy - waterR, waterR * 2, Math.floor(waterR * 1.2));
    g.fillStyle = P.water[1];
    g.fillRect(cx - waterR, cy - waterR, waterR * 2, Math.floor(waterR * 0.6));
    g.fillStyle = P.water[0];
    g.fillRect(cx - waterR, cy - waterR, waterR * 2, Math.floor(waterR * 0.25));

    // Облака в отражении
    const cloudShift = ((state.time * 2.6 + cx * 0.25) % 28) - 14;
    g.fillStyle = P.cloud[0];
    g.globalAlpha = 0.40;
    g.fillRect(Math.round(cx - 7 + cloudShift), Math.round(cy - 5), 9, 2);
    g.fillRect(Math.round(cx - 5 + cloudShift), Math.round(cy - 7), 5, 2);
    g.fillStyle = P.cloud[1];
    g.fillRect(Math.round(cx - 13 + cloudShift * 0.7), Math.round(cy + 2), 8, 2);
    g.globalAlpha = 1;

    // Внутренняя тень от обода бочки
    if (cy < 180) {
      g.fillStyle = 'rgba(20, 15, 12, 0.42)';
      g.fillRect(cx - waterR, cy - waterR, waterR * 2, 4);
    } else if (cy > 330) {
      g.fillStyle = 'rgba(20, 15, 12, 0.36)';
      g.fillRect(cx - waterR, cy + waterR - 4, waterR * 2, 4);
    }

    // Детальное отражение персонажа при приближении (dist < 62)
    const p = state.player;
    const pos = G.SIM.getRenderPos(p);
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    const dist = Math.hypot(dx, dy);

    if (dist < 62) {
      const prox = G.MATH.clamp(1 - dist / 62, 0, 1);
      // Волновое искажение
      const wobX = Math.sin(state.time * 5.2 + cy) * 1.3;
      const wobY = Math.cos(state.time * 4.4 + cx) * 0.8;
      const refX = Math.round(cx + dx * 0.26 + wobX);
      const refY = Math.round(cy + dy * 0.24 + wobY);

      g.save();
      g.translate(refX, refY);
      g.rotate(p.aimAngle);
      g.scale(1, -1);
      g.globalAlpha = 0.20 + prox * 0.52;

      // Плечи и плащ героя (cloth)
      g.fillStyle = colOut;
      g.fillRect(-6, -9, 12, 18);
      g.fillStyle = P.cloth ? P.cloth[2] : '#232d38';
      g.fillRect(-5, -8, 10, 16);
      g.fillStyle = P.cloth ? P.cloth[0] : '#4f5e6e';
      g.fillRect(-5, -8, 3, 4);

      // Руки (skin)
      g.fillStyle = P.skin ? P.skin[1] : '#c49876';
      g.fillRect(3, 4, 3, 3);
      g.fillRect(3, -4, 3, 3);

      // Красная бандана (barnRed)
      g.fillStyle = P.barnRed[1];
      g.fillRect(1, -3, 3, 6);
      g.fillStyle = P.barnRed[0];
      g.fillRect(2, -2, 2, 2);

      // Овальная шляпа героя (leather)
      drawDetailedHat(g, -1, 0, P.leather[3], P.leather[2], P.leather[4], P.leather[0]);

      // Оружие в руках в зеркальном отражении
      const w = G.SIM.getWeapon(state);
      const visLen = Math.max(4, Math.round(w.barrelLen * (1 - (p.wallRaiseFrac || 0) * 0.65)));
      if (w.id === 'walker') {
        g.fillStyle = P.steelLight[1];
        g.fillRect(5, 3, Math.round(visLen * 0.72), 2);
        g.fillStyle = P.steelLight[0];
        g.fillRect(5, 3, Math.round(visLen * 0.72), 1);
      } else if (w.id === 'winchester') {
        g.fillStyle = P.brass[1];
        g.fillRect(4, 2, 5, 3);
        g.fillStyle = P.steelDark[1];
        g.fillRect(9, 3, Math.round(visLen * 0.78), 2);
      } else {
        g.fillStyle = P.steelDark[1];
        g.fillRect(5, 3, Math.round(visLen * 0.72), 2);
        g.fillStyle = P.steelDark[0];
        g.fillRect(5, 3, Math.round(visLen * 0.72), 1);
      }

      g.restore();
    }

    // Вспышка выстрела на воде
    if (p.flashTimer > 0 && dist < 130) {
      const fl = (p.flashTimer / 0.06) * (1 - dist / 130);
      g.fillStyle = `rgba(248, 218, 128, ${0.52 * fl})`;
      g.beginPath();
      g.arc(cx + dx * 0.12, cy + dy * 0.12, waterR * 0.85, 0, Math.PI * 2);
      g.fill();
    }

    // Круги ряби на воде
    if (state.waterRipples) {
      for (let i = 0; i < state.waterRipples.length; i++) {
        const rp = state.waterRipples[i];
        if (rp.barrelId !== s.id) continue;
        const frac = Math.max(0, rp.life / rp.maxLife);
        g.strokeStyle = `rgba(224, 238, 240, ${rp.alpha * frac})`;
        g.lineWidth = 1;
        g.beginPath();
        g.arc(Math.round(rp.x), Math.round(rp.y), Math.round(rp.r), 0, Math.PI * 2);
        g.stroke();
      }
    }

    // Блики ряби на поверхности
    const shimmer = Math.round(Math.sin(state.time * 2.8 + cx) * 1.2);
    g.fillStyle = 'rgba(236, 244, 240, 0.58)';
    g.fillRect(cx - 4 + shimmer, cy - 3, 4, 1);
    g.fillRect(cx + 1 - shimmer, cy + 3, 3, 1);

    g.restore();
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

      // Окна салуна (на sal_right1: y ~ 118; sal_right2: y ~ 348)
      if (s.id === 'sal_right1' || s.id === 'sal_right2') {
        const wy = (s.id === 'sal_right1') ? (118 - s.y) : (348 - s.y);
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
      g.fillRect(72, 3, 24, 1);
      g.fillRect(122, 3, 14, 1);

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

      // Вторая бутылка и стаканы справа
      g.fillStyle = P.foliage[1];
      g.fillRect(134, 4, 3, 5);
      g.fillStyle = P.woodPale[0];
      g.fillRect(135, 3, 1, 1);
      g.fillStyle = P.glass[0];
      g.fillRect(134, 5, 1, 2);

      g.fillStyle = P.glass[1];
      g.fillRect(140, 5, 2, 3);
      g.fillStyle = P.glass[0];
      g.fillRect(140, 5, 1, 1);

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
        // Покерный стол: карты, фишки, стакан
        // Карты
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
        // Стакан виски
        g.fillStyle = P.glass[1];
        g.fillRect(34, 20, 3, 3);
        g.fillStyle = P.glass[0];
        g.fillRect(34, 20, 1, 1);
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

  function drawSolid(g, s) {
    if (s.type === 'water_barrel') {
      drawWaterBarrel(g, s);
      return;
    }
    if (s.baked && s.baked.canvas) {
      g.drawImage(s.baked.canvas, Math.round(s.x + s.baked.ox), Math.round(s.y + s.baked.oy));
      return;
    }
    drawSaloonInteriorSolid(g, s);
  }

  function drawPolesAndWires(g) {
    if (!world.poles || !world.poles.length) return;
    const P = getPal();
    const poles = world.poles;

    g.strokeStyle = 'rgba(20, 14, 10, 0.22)';
    g.lineWidth = 1;
    for (let i = 0; i < poles.length - 1; i++) {
      const a = poles[i];
      const b = poles[i + 1];
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
      [-3, 3].forEach((off) => {
        g.beginPath();
        g.moveTo(a.x, a.y + off);
        g.quadraticCurveTo((a.x + b.x) * 0.5, (a.y + b.y) * 0.5 + off + 6, b.x, b.y + off);
        g.stroke();
      });
    }

    for (let i = 0; i < poles.length; i++) {
      const p = poles[i];
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

  function drawTrees(g) {
    if (!world.trees || !world.trees.length) return;
    for (let i = 0; i < world.trees.length; i++) {
      const tr = world.trees[i];
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

  function drawBanditAlive(g, t) {
    const P = getPal();
    const wob = t.wobble > 0 ? Math.sin(state.time * 44) * t.wobble * 2.2 : 0;
    const tx = Math.round(t.x + wob);
    const ty = Math.round(t.y);
    const stride = Math.sin(t.walkPhase || 0) * 3.2;
    const sway = Math.sin(t.walkPhase || 0) * 0.07;
    const hurt = t.hurtTimer > 0;
    const scale = t.tough ? 1.12 : 1.0;
    const colOut = P.outline || '#140f0c';

    g.fillStyle = 'rgba(18, 12, 9, 0.42)';
    g.beginPath();
    g.ellipse(tx + Math.round(SUN.dx * 6), ty + Math.round(SUN.dy * 6), 9 * scale, 8 * scale, 0.3, 0, Math.PI * 2);
    g.fill();

    g.save();
    g.translate(tx, ty);
    g.scale(scale, scale);
    g.rotate((t.angle || 0) + sway + (hurt ? -0.20 : 0));

    // Сапоги (leather)
    g.fillStyle = colOut;
    g.fillRect(Math.round(-2 + stride), -6, 5, 3);
    g.fillRect(Math.round(-2 - stride), 3, 5, 3);

    // Пальто / плащ бандита (скруглённый пиксельный силуэт)
    const coatLag = Math.round(Math.sin((t.walkPhase || 0) * 2) * 1.0);
    const raiseFrac = t.wallRaiseFrac || 0;
    g.fillStyle = colOut;
    fillRoundPix(g, -10, -7 + coatLag, 4, 14);
    g.fillStyle = t.coatColor;
    fillRoundPix(g, -9, -6 + coatLag, 3, 12);

    // Рука с оружием (у препятствия ствол поднимается вверх и укорачивается)
    const gunY = 4 - Math.round(raiseFrac * 1.6);
    g.fillStyle = t.coatColor;
    g.fillRect(2, 3, 5, 4);
    g.fillStyle = P.skin ? P.skin[1] : '#c49876';
    g.fillRect(5, 3.5, 3, 3);
    if (t.gunType === 'rifle') {
      const gunLenR = Math.max(4, Math.round(12 * (1 - raiseFrac * 0.55)));
      g.fillStyle = P.woodWarm[2];
      g.fillRect(1, 4, 9, 2);
      g.fillStyle = P.steelDark[4];
      g.fillRect(10, gunY, gunLenR, 2);
      g.fillStyle = P.steelDark[1];
      g.fillRect(10, gunY, gunLenR - 1, 1);
      if (raiseFrac > 0.3) {
        g.fillStyle = P.steelDark[0];
        g.fillRect(10 + gunLenR - 1, gunY - 1, 2, 3);
      }
    } else {
      const gunLenP = Math.max(3, Math.round(8 * (1 - raiseFrac * 0.5)));
      g.fillStyle = P.steelDark[3];
      g.fillRect(7, gunY, gunLenP, 2);
      g.fillStyle = P.steelDark[1];
      g.fillRect(8, gunY, Math.max(1, gunLenP - 1), 1);
      if (raiseFrac > 0.3) {
        g.fillStyle = P.steelDark[0];
        g.fillRect(7 + gunLenP - 1, gunY - 1, 2, 3);
      }
    }

    // Тело (скруглённые пиксельные углы — силуэт читается как человек, а не кубик)
    g.fillStyle = t.hitFlash > 0 ? '#f2dfb8' : colOut;
    fillRoundPix(g, -7, -10, 14, 20);
    g.fillStyle = t.hitFlash > 0 ? '#fff2d4' : t.coatColor;
    fillRoundPix(g, -6, -9, 12, 18);
    g.fillStyle = t.coatTrim;
    fillRoundPix(g, -5, -8, 6, 5);
    fillRoundPix(g, -5, 3, 6, 5);
    g.fillStyle = colOut;
    g.fillRect(-3, -6, 1, 12);
    g.fillStyle = P.woodWarm[1];
    g.fillRect(-4, -2, 6, 2);

    // Бандана
    g.fillStyle = t.bandana;
    g.fillRect(1, -4, 3, 8);
    g.fillStyle = colOut;
    g.fillRect(0, -4, 1, 8);

    // Овальная шляпа бандита
    drawDetailedHat(g, -1, 0, t.hatColor, t.coatTrim, t.hatBand, t.tough ? P.leather[1] : P.leather[0]);

    // Телеграф прицеливания (блеск ствола при наведении на игрока)
    if (t.telegraphFrac > 0) {
      const isRifle = t.gunType === 'rifle';
      const gx = Math.round((isRifle ? 21 : 14) - raiseFrac * 4);
      const gy = 4 - Math.round(raiseFrac * 1.6);
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
  }

  function drawFlyingHats(g) {
    if (!state.flyingHats || !state.flyingHats.length) return;
    const P = getPal();
    for (let i = 0; i < state.flyingHats.length; i++) {
      const h = state.flyingHats[i];
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

  function drawDeadBandits(g) {
    if (G.CFG.spawnBandits === false) return;
    for (let i = 0; i < world.targets.length; i++) {
      const t = world.targets[i];
      if (t.kind === 'bandit' && !t.alive) {
        drawBanditDead(g, t);
      }
    }
  }

  function drawTargets(g) {
    const P = getPal();
    for (let i = 0; i < world.targets.length; i++) {
      const t = world.targets[i];
      if (!t.alive) continue;

      if (t.kind === 'bandit') {
        if (G.CFG.spawnBandits !== false) drawBanditAlive(g, t);
        continue;
      }

      const wob = t.wobble > 0 ? Math.sin(state.time * 42) * t.wobble * 2.4 : 0;
      const tx = Math.round(t.x + wob);
      const ty = Math.round(t.y);

      const shLen = t.kind === 'bottle' ? 3 : 6;
      if (t.kind !== 'bottle') {
        // Пиксельная тень мишени (у бутылок — своя, прямоугольная)
        g.fillStyle = 'rgba(20, 14, 9, 0.36)';
        g.beginPath();
        g.ellipse(tx + Math.round(SUN.dx * shLen), ty + Math.round(SUN.dy * shLen), t.r, t.r * 0.82, 0.3, 0, Math.PI * 2);
        g.fill();
      }

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
      } else if (t.kind === 'steel') {
        g.fillStyle = '#1f2326';
        g.beginPath();
        g.arc(tx, ty, t.r, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = t.hitFlash > 0 ? '#f5e3ab' : P.stone[1];
        g.beginPath();
        g.arc(tx, ty, t.r - 1.5, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = P.stone[0];
        g.fillRect(tx - 4, ty - 5, 4, 2);
        g.fillStyle = P.barnRed[1];
        g.beginPath();
        g.arc(tx, ty, t.r * 0.42, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = P.cloud[0];
        g.fillRect(tx - 1, ty - 1, 2, 2);
      }
    }
  }

  function drawShells(g) {
    const P = getPal();
    for (let i = 0; i < state.shells.length; i++) {
      const sh = state.shells[i];
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

  function drawUpturnedMuzzle(g, w, wallFrac, mx, my) {
    if (wallFrac <= 0.25) return;
    const vis = G.MATH.clamp((wallFrac - 0.25) / 0.75, 0, 1);

    g.save();
    g.translate(Math.round(mx), Math.round(my));
    g.globalAlpha = vis;

    g.fillStyle = 'rgba(0, 0, 0, 0.50)';
    g.beginPath();
    g.arc(1, 1, w.id === 'winchester' ? 4 : 3.2, 0, Math.PI * 2);
    g.fill();

    if (w.id === 'winchester') {
      g.fillStyle = '#4a4e52';
      g.beginPath();
      g.arc(-2.5, 0, 2.0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#8d9499';
      g.fillRect(-3, -1, 1, 1);

      g.fillStyle = '#222528';
      g.beginPath();
      g.arc(0.5, 0, 3.6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#8c9299';
      g.beginPath();
      g.arc(0.5, 0, 2.8, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#dce2e6';
      g.fillRect(-1, -2, 2, 1);

      g.fillStyle = '#0a0807';
      g.beginPath();
      g.arc(0.5, 0, 1.5, 0, Math.PI * 2);
      g.fill();

      g.fillStyle = '#e3c068';
      g.fillRect(3, -1, 1, 2);
    } else if (w.id === 'walker') {
      g.fillStyle = '#2b2824';
      g.beginPath();
      g.arc(0, 0, 3.6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#d4cfc5';
      g.beginPath();
      g.arc(0, 0, 2.9, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#faf7f0';
      g.fillRect(-2, -2, 2, 1);

      g.fillStyle = '#090706';
      g.beginPath();
      g.arc(0, 0, 1.7, 0, Math.PI * 2);
      g.fill();

      g.fillStyle = '#e3c068';
      g.fillRect(2, -1, 2, 1);
    } else {
      g.fillStyle = '#1b1e21';
      g.beginPath();
      g.arc(0, 0, 3.0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#6c747d';
      g.beginPath();
      g.arc(0, 0, 2.3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#b4bdc7';
      g.fillRect(-1, -2, 1, 1);

      g.fillStyle = '#090706';
      g.beginPath();
      g.arc(0, 0, 1.2, 0, Math.PI * 2);
      g.fill();

      g.fillStyle = '#c8cfd6';
      g.fillRect(2, 0, 1, 1);
    }

    g.restore();
  }

  function drawWeapon(g, w, ws, p) {
    const P = getPal();
    const kick = (p.recoilKickAnim || 0) * 3.0;
    const cockProg = ws.cockTimer > 0 && ws.cockDuration > 0
      ? 1 - ws.cockTimer / ws.cockDuration
      : 0;
    const wallFrac = p.wallRaiseFrac || 0;
    const walkBob = p.speed > 12 && !p.rolling && !p.inCover ? Math.sin(p.walkPhase || 0) * 0.7 : 0;
    const cylSwing = ws.reloading && w.uiShape === 'cylinder' ? (ws.reloadOpenFrac || 0) : 0;
    const pitchScale = 1 - wallFrac * 0.58;

    g.save();
    g.translate(6, 4.5 + walkBob);

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

    if (w.id === 'walker') {
      g.fillStyle = P.woodWarm[1];
      g.fillRect(-4, -1, 3, 2);
      g.fillStyle = P.outline || '#140f0c';
      g.fillRect(-2, -2, 4, 4);
      g.fillStyle = P.steelLight[2];
      g.fillRect(-1, -1, 3, 3);

      const cylW = 7;
      g.fillStyle = P.outline || '#140f0c';
      g.fillRect(2, -2, cylW, 5);
      g.fillStyle = P.steelLight[1];
      g.fillRect(2, -1, cylW - 1, 3);
      g.fillStyle = P.steelLight[0];
      g.fillRect(2, -1, cylW - 1, 1);

      const bStart = 2 + cylW;
      const effLen = Math.max(3, Math.round((w.barrelLen - 9) * pitchScale));
      g.fillStyle = P.outline || '#140f0c';
      g.fillRect(bStart, -1.5, effLen + 1, 3);
      g.fillStyle = P.steelLight[1];
      g.fillRect(bStart, -1, effLen, 2);
      g.fillStyle = P.steelLight[0];
      g.fillRect(bStart, -1, effLen, 1);

      g.fillStyle = P.cloth ? P.cloth[2] : '#232d38';
      g.fillRect(Math.round(bStart - 4), Math.round(-5 + wallFrac * 1.2), 4, 3);
      g.fillStyle = P.skin ? P.skin[1] : '#c49876';
      g.fillRect(Math.round(bStart - 2), Math.round(-3.5 + wallFrac * 1.2), 3, 3);

      if (wallFrac <= 0.35) {
        g.fillStyle = P.brass[0];
        g.fillRect(bStart + effLen - 1, -1, 1, 1);
      }
      const hammerBack = ws.cocked ? 1 : (ws.cockTimer > 0 ? cockProg : 0);
      g.fillStyle = P.steelLight[3];
      g.fillRect(Math.round(4.5 - wallFrac * 1.2 - hammerBack * 2.2), -1, 2, 2);

      if (ws.cockTimer > 0) {
        const reach = Math.sin(cockProg * Math.PI);
        g.fillStyle = P.skin ? P.skin[1] : '#c49876';
        g.fillRect(Math.round(3 + reach * 2), Math.round(-6 + reach * 4.5), 3, 3);
      }
    } else if (w.id === 'lightning') {
      g.fillStyle = P.woodWarm[3];
      g.fillRect(-3, -1, 3, 2);
      g.fillStyle = P.outline || '#140f0c';
      g.fillRect(-1, -2, 4, 4);
      g.fillStyle = P.steelDark[2];
      g.fillRect(0, -1, 3, 3);

      const cylW = 6;
      g.fillStyle = P.outline || '#140f0c';
      g.fillRect(2, -2, cylW, 4);
      g.fillStyle = P.steelDark[1];
      g.fillRect(2, -1, cylW - 1, 3);
      g.fillStyle = P.steelDark[0];
      g.fillRect(2, -1, cylW - 1, 1);

      const bStart = 2 + cylW;
      const bLen = Math.max(3, Math.round((w.barrelLen - 8) * pitchScale));
      g.fillStyle = P.outline || '#140f0c';
      g.fillRect(bStart, -1.5, bLen + 1, 3);
      g.fillStyle = P.steelDark[1];
      g.fillRect(bStart, -1, bLen, 2);
      g.fillStyle = P.steelDark[0];
      g.fillRect(bStart, -1, bLen, 1);

      g.fillStyle = P.cloth ? P.cloth[2] : '#232d38';
      g.fillRect(Math.round(bStart - 4), Math.round(-5 + wallFrac * 1.2), 4, 3);
      g.fillStyle = P.skin ? P.skin[1] : '#c49876';
      g.fillRect(Math.round(bStart - 2), Math.round(-3.5 + wallFrac * 1.2), 3, 3);

      if (wallFrac <= 0.35) {
        g.fillStyle = P.steelDark[0];
        g.fillRect(bStart + bLen - 1, -1, 1, 1);
      }

      const pull = ws.daPullTimer > 0 ? 1 - ws.daPullTimer / w.triggerPullTime : 0;
      g.fillStyle = P.steelDark[0];
      g.fillRect(Math.round(4.2 - wallFrac - pull * 2), -1, 2, 1);
    } else {
      // Winchester 1873
      const recStart = Math.round(5.5 - wallFrac * 2.8);
      const foreLen = Math.max(3, Math.round(9 * pitchScale));
      const steelLen = Math.max(4, Math.round((w.barrelLen - 13) * pitchScale));

      // Приклад
      g.fillStyle = P.outline || '#140f0c';
      g.fillRect(Math.round(-4 + wallFrac * 2.5), -2, Math.max(4, Math.round(10 * (1 - wallFrac * 0.4))), 4);
      g.fillStyle = P.woodWarm[1];
      g.fillRect(Math.round(-3 + wallFrac * 2.5), -1, Math.max(3, Math.round(9 * (1 - wallFrac * 0.4))), 2);
      g.fillStyle = P.woodWarm[0];
      g.fillRect(Math.round(-3 + wallFrac * 2.5), -1, Math.max(3, Math.round(9 * (1 - wallFrac * 0.4))), 1);

      // Латунная ствольная коробка (brass)
      const recW = Math.max(3, Math.round(7 * (1 - wallFrac * 0.35)));
      g.fillStyle = P.outline || '#140f0c';
      g.fillRect(recStart, -2, recW, 5);
      g.fillStyle = P.brass[2];
      g.fillRect(recStart + 1, -1, Math.max(2, recW - 1), 3);
      g.fillStyle = P.brass[0];
      g.fillRect(recStart + 1, -1, Math.max(2, recW - 1), 1);

      // Курок
      const hammerBack = ws.cocked ? 1 : (ws.cockTimer > 0 ? cockProg : 0);
      g.fillStyle = P.steelDark[1];
      g.fillRect(Math.round(recStart - 1 - hammerBack * 1.5), -2, 2, 2);

      // Деревянное цевьё + латунное кольцо
      const barX = recStart + Math.max(3, Math.round(5.5 * (1 - wallFrac * 0.35)));
      g.fillStyle = P.outline || '#140f0c';
      g.fillRect(barX, -2, foreLen, 4);
      g.fillStyle = P.woodWarm[1];
      g.fillRect(barX, -2, foreLen, 3);
      g.fillStyle = P.woodWarm[0];
      g.fillRect(barX, -2, foreLen, 1);
      g.fillStyle = P.brass[1];
      g.fillRect(barX + foreLen - 2, -2, 2, 3);

      // Воронёный длинный ствол и подствольная трубка (steelDark)
      g.fillStyle = P.steelDark[3];
      g.fillRect(barX, -1, steelLen + 1, 3);
      g.fillStyle = P.steelDark[1];
      g.fillRect(barX, -1, steelLen, 2);
      g.fillStyle = P.steelDark[0];
      g.fillRect(barX, -1, steelLen, 1);

      // Характерная скоба-рычаг Генри снизу коробки (пиксельно, без stroke)
      const swing = ws.cockTimer > 0 ? Math.sin(cockProg * Math.PI) : 0;
      const lx = recStart + 1 - Math.round(swing * 2.5);
      const ly = 2 + Math.round(swing * 5.5);
      g.fillStyle = P.outline || '#140f0c';
      g.fillRect(lx, ly, 4, 3);
      g.fillStyle = P.brass[2];
      g.fillRect(lx + 1, ly + 1, 2, 1);

      // ==================== ДВУРУЧНЫЙ ХВАТ ВИНЧЕСТЕРА (без «оторванной» руки) ====================
      // Левая рука идёт НЕПРЕРЫВНО от плеча в корпусе к цевью: плечо -> предплечье -> кисть.
      const foreMidX = Math.round(barX + foreLen * 0.45);
      const armMidX = Math.round((3 + foreMidX) * 0.5);
      const lift = Math.round(wallFrac * 1.2);

      // Плечо (внутри силуэта корпуса — визуально соединено с туловищем)
      g.fillStyle = P.outline || '#140f0c';
      g.fillRect(2, -6 + lift, 6, 6);
      g.fillStyle = P.cloth ? P.cloth[1] : '#35424f';
      g.fillRect(3, -5 + lift, 5, 5);
      g.fillStyle = P.cloth ? P.cloth[0] : '#4f5e6e';
      g.fillRect(3, -5 + lift, 5, 1);

      // Предплечье (диагональ от плеча к цевью)
      g.fillStyle = P.outline || '#140f0c';
      g.fillRect(armMidX - 2, -5 + lift, 5, 5);
      g.fillStyle = P.cloth ? P.cloth[2] : '#232d38';
      g.fillRect(armMidX - 1, -4 + lift, 4, 4);

      // Запястье и кисть, поддерживающая деревянное цевьё снизу
      g.fillStyle = P.outline || '#140f0c';
      g.fillRect(foreMidX - 2, -2 + lift, 6, 5);
      g.fillStyle = P.cloth ? P.cloth[3] : '#1c242b';
      g.fillRect(foreMidX - 1, -1 + lift, 5, 4);
      g.fillStyle = P.skin ? P.skin[1] : '#c49876';
      g.fillRect(foreMidX, 1 + lift, 4, 2);
      g.fillStyle = P.skin ? P.skin[0] : '#deb592';
      g.fillRect(foreMidX, 1 + lift, 3, 1);

      // 2. Задняя (правая) рука: обхватывает шейку приклада / рычаг позади коробки
      // Кисть двигается вместе с рычагом при взводе скобы (cockTimer > 0)
      const rHandX = recStart + 1 - Math.round(swing * 2.5);
      const rHandY = Math.round(swing * 4.5);
      // Рукав правой руки — от корпуса к шейке
      g.fillStyle = P.outline || '#140f0c';
      g.fillRect(recStart - 4, -1, 6, 5);
      g.fillStyle = P.cloth ? P.cloth[1] : '#35424f';
      g.fillRect(recStart - 3, 0, 5, 4);
      // Кисть правой руки на шейке/скобе
      g.fillStyle = P.outline || '#140f0c';
      g.fillRect(rHandX - 1, rHandY + 1, 4, 4);
      g.fillStyle = P.skin ? P.skin[1] : '#c49876';
      g.fillRect(rHandX, rHandY + 1, 3, 3);
      g.fillStyle = P.skin ? P.skin[0] : '#deb592';
      g.fillRect(rHandX, rHandY + 1, 3, 1);
    }

    if (ws.reloading) {
      const ins = ws.insertAnim > 0 ? Math.sin((ws.insertAnim / w.reloadOneTime) * Math.PI) : 0;
      g.fillStyle = P.skin ? P.skin[1] : '#cca17c';
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

  function drawPlayer(g) {
    const P = getPal();
    const p = state.player;
    const w = G.SIM.getWeapon(state);
    const ws = G.SIM.getWState(state);
    const pos = G.SIM.getRenderPos(p);
    const wallFrac = p.wallRaiseFrac || 0;
    const walking = !p.rolling && !p.inCover && p.speed > 12;
    const stride = walking ? Math.sin(p.walkPhase || 0) * 3.4 : 0;
    const bodySway = walking ? Math.sin(p.walkPhase || 0) * 0.07 : 0;
    const hatBob = walking ? Math.abs(Math.sin(p.walkPhase || 0)) * 0.8 : 0;
    const colOut = P.outline || '#140f0c';

    g.save();
    g.translate(Math.round(pos.x), Math.round(pos.y));

    g.fillStyle = 'rgba(18, 12, 9, 0.46)';
    g.beginPath();
    g.ellipse(
      Math.round(SUN.dx * (p.rolling ? 4 : 6.5)),
      Math.round(SUN.dy * (p.rolling ? 4 : 6.5)),
      p.rolling ? 10.5 : 9.4,
      p.rolling ? 7 : 8.2,
      0.3,
      0,
      Math.PI * 2
    );
    g.fill();

    if (p.rolling) {
      const rollAng = Math.atan2(p.rollDy, p.rollDx);
      const prog = 1 - p.rollTimer / G.CFG.rollDur;
      g.rotate(rollAng);
      g.scale(1.14 - Math.sin(prog * Math.PI) * 0.2, 0.82);
      g.fillStyle = colOut;
      fillRoundPix(g, -9, -8, 18, 16);
      g.fillStyle = P.cloth ? P.cloth[2] : '#1e2730';
      fillRoundPix(g, -8, -7, 16, 14);
      g.fillStyle = P.barnRed[1];
      g.fillRect(-2, -6, 4, 12);
      g.fillStyle = P.leather[3];
      g.fillRect(Math.round(Math.cos(prog * Math.PI * 2) * 3 - 4), -4, 8, 8);
      g.restore();
      return;
    }

    // Поза укрытия: в «сложенном» виде корпус сжат, при выглядывании — наклон к цели
    const peek = p.peekFrac || 0;
    if (peek > 0.01) {
      const lean = peek * 0.16 * (p.peekSide || 1);
      g.rotate(p.aimAngle + bodySway + lean);
      g.translate(peek * 2.2, peek * 0.8);
      g.scale(1.02, 0.96);
    } else {
      g.rotate(p.aimAngle + bodySway);
      if (p.inCover) g.scale(0.9, 0.9);
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
    g.fillStyle = colOut;
    fillRoundPix(g, -10, -7 + coatLag, 4, 14);
    g.fillStyle = P.cloth ? P.cloth[3] : '#1c242b';
    fillRoundPix(g, -9, -6 + coatLag, 3, 12);

    drawWeapon(g, w, ws, p);

    // Тело и плечи в плаще (cloth) — скруглённые пиксельные углы
    g.fillStyle = colOut;
    fillRoundPix(g, -7, -10, 14, 20);
    g.fillStyle = P.cloth ? P.cloth[2] : '#1d252e';
    fillRoundPix(g, -6, -9, 12, 18);
    g.fillStyle = P.cloth ? P.cloth[1] : '#33404d';
    fillRoundPix(g, -5, -8, 6, 5);
    fillRoundPix(g, -5, 3, 6, 5);
    g.fillStyle = P.cloth ? P.cloth[0] : '#475766';
    g.fillRect(-4, -8, 4, 2);

    // Рука, опирающаяся на кромку укрытия при выглядывании (поверх корпуса, у самого края)
    if (peek > 0.3) {
      g.fillStyle = colOut;
      g.fillRect(6, Math.round(1 - peek), 5, 5);
      g.fillStyle = P.cloth ? P.cloth[1] : '#35424f';
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
    g.fillStyle = P.barnRed[1];
    g.fillRect(1, -4, 3, 8);
    g.fillStyle = P.barnRed[0];
    g.fillRect(1, -3, 2, 3);

    // Овальная шляпа персонажа (leather)
    const hx = Math.round(-1 + hatBob * 0.4);
    drawDetailedHat(g, hx, 0, P.leather[3], P.leather[1], P.leather[4], P.leather[0]);

    if (wallFrac > 0.25) {
      const muzzleX = w.id === 'winchester' ? 9.5 : 8.8;
      const muzzleY = 6.2;
      drawUpturnedMuzzle(g, w, wallFrac, muzzleX, muzzleY);
    }

    g.restore();
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

  function drawParticles(g) {
    for (let i = 0; i < state.particles.length; i++) {
      const pt = state.particles[i];
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

  function drawDustMotes(g, dt) {
    const P = getPal();
    for (let i = 0; i < dustMotes.length; i++) {
      const m = dustMotes[i];
      m.x += m.vx * dt;
      m.y += (m.vy + Math.sin(state.time * 1.4 + m.phase) * 1.6) * dt;
      if (m.x > world.width) m.x -= world.width;
      if (m.y < 65) m.y = world.height - 70;
      if (m.y > world.height - 70) m.y = 65;

      const alpha = 0.24 + 0.16 * Math.sin(state.time * 2.2 + m.phase);
      g.fillStyle = P.grass[0];
      g.globalAlpha = alpha;
      g.fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
    }
    g.globalAlpha = 1;
  }

  function drawDebugRays(g) {
    if (!G.CFG.debugRays) return;
    for (let i = 0; i < state.debugRays.length; i++) {
      const r = state.debugRays[i];
      const alpha = Math.max(0, r.life / r.maxLife) * 0.80;
      g.strokeStyle = r.hit ? `rgba(126, 186, 178, ${alpha})` : `rgba(212, 174, 89, ${alpha * 0.45})`;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(Math.round(r.x1), Math.round(r.y1));
      g.lineTo(Math.round(r.x2), Math.round(r.y2));
      g.stroke();
      if (r.hit) {
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

  function drawMuzzleGlow(g) {
    const p = state.player;
    if (p.flashTimer <= 0) return;
    const m = G.SIM.getMuzzlePos(state);
    const fl = p.flashTimer / 0.06;
    const mx = Math.round(m.x);
    const my = Math.round(m.y);

    const r1 = Math.round(48 * fl + 10);
    const r2 = Math.round(28 * fl + 6);
    const r3 = Math.round(12 * fl + 3);

    // Ступенчатое пиксельное свечение (3 концентрических круга с низкой прозрачностью, без radialGradient)
    g.fillStyle = `rgba(242, 218, 145, ${0.08 * fl})`;
    g.beginPath();
    g.arc(mx, my, r1, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = `rgba(242, 218, 145, ${0.16 * fl})`;
    g.beginPath();
    g.arc(mx, my, r2, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = `rgba(255, 248, 220, ${0.32 * fl})`;
    g.beginPath();
    g.arc(mx, my, r3, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = `rgba(255, 255, 255, ${0.55 * fl})`;
    g.fillRect(mx - 2, my - 2, 4, 4);
  }

  // ==================== ЭКРАННЫЕ ЭЛЕМЕНТЫ И ДВОЙНОЙ ПРИЦЕЛ ====================

  function drawWorldOverlaysOnScreen() {
    const p = state.player;
    const pos = G.SIM.getRenderPos(p);

    ctx.save();
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'center';
    if (p.inCover && !p.peeking) {
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
    } else if (!p.inCover && p.nearCover) {
      const scr = worldToScreen(pos.x, pos.y - 22);
      const sx = Math.round(scr.x);
      const sy = Math.round(scr.y);
      const lbl = G.keyLabel(G.CFG.keys.cover).toUpperCase();
      const txt = `[${lbl}] УКРЫТИЕ`;
      const tw = Math.round(txt.length * 8 + 14);
      ctx.fillStyle = 'rgba(20, 15, 11, 0.84)';
      ctx.fillRect(sx - Math.floor(tw * 0.5), sy - 14, tw, 18);
      ctx.strokeStyle = '#6b5944';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - Math.floor(tw * 0.5) + 0.5, sy - 13.5, tw - 1, 17);
      ctx.fillStyle = '#dfd4be';
      ctx.fillText(txt, sx, sy - 1);
    }

    for (let i = 0; i < world.targets.length; i++) {
      const t = world.targets[i];
      if (t.kind === 'bandit' && t.alive && t.tough) {
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

  function drawCrosshairs() {
    const p = state.player;
    const w = G.SIM.getWeapon(state);
    const ws = G.SIM.getWState(state);
    const pos = G.SIM.getRenderPos(p);
    const pScr = worldToScreen(pos.x, pos.y);
    const mx = Math.round(state.input.mouseX);
    const my = Math.round(state.input.mouseY);

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

  function drawNoonVignette() {
    const grad = ctx.createRadialGradient(
      viewW * 0.5, viewH * 0.5, Math.min(viewW, viewH) * 0.34,
      viewW * 0.5, viewH * 0.5, Math.max(viewW, viewH) * 0.72
    );
    grad.addColorStop(0, 'rgba(255, 232, 185, 0.0)');
    grad.addColorStop(1, 'rgba(24, 16, 11, 0.28)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  // ==================== ОБНОВЛЕНИЕ КОМПАКТНОГО HUD ====================

  function updateHUD() {
    const p = state.player;
    const w = G.SIM.getWeapon(state);
    const ws = G.SIM.getWState(state);

    if (ui.hpBarFill) {
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

    if (ui.zoneName) ui.zoneName.textContent = state.zoneLabel || 'САЛУН';
    if (ui.echoInfo) ui.echoInfo.textContent = state.echoDesc || 'ЗАКРЫТОЕ ПОМЕЩЕНИЕ';

    if (ui.statusLine) {
      if (p.rolling) {
        ui.statusLine.textContent = 'ПЕРЕКАТ';
      } else if (ws.reloading) {
        ui.statusLine.textContent = 'ПЕРЕЗАРЯДКА — КЛИК ПО КАМОРЕ ИЛИ [R]';
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
  }

  // ==================== ГЛАВНЫЙ ЦИКЛ ====================

  function renderFrame(dt) {
    const zoom = getZoom();
    const org = getCamOrigin();

    pctx.imageSmoothingEnabled = false;
    pctx.fillStyle = '#17120f';
    pctx.fillRect(0, 0, pixW, pixH);

    pctx.save();
    pctx.translate(-org.x, -org.y);

    pctx.drawImage(world.bgCanvas, 0, 0);
    drawSaloonDaylight(pctx);

    for (let i = 0; i < world.solids.length; i++) {
      drawNoonShadow(pctx, world.solids[i]);
    }
    drawCloudShadows(pctx);

    drawDecals(pctx);
    drawDeadBandits(pctx);
    drawShells(pctx);
    drawFlyingHats(pctx);

    for (let i = 0; i < world.solids.length; i++) {
      if (!world.solids[i].high) drawSolid(pctx, world.solids[i]);
    }

    drawTargets(pctx);
    drawDoors(pctx);

    drawPlayer(pctx);
    drawBullets(pctx);
    drawBloodDrops(pctx);

    for (let i = 0; i < world.solids.length; i++) {
      if (world.solids[i].high) drawSolid(pctx, world.solids[i]);
    }
    drawPolesAndWires(pctx);
    drawTrees(pctx);

    drawParticles(pctx);
    drawDustMotes(pctx, dt);
    drawMuzzleGlow(pctx);
    drawDebugRays(pctx);

    pctx.restore();

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#17120f';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.drawImage(pixCanvas, 0, 0, pixW, pixH, 0, 0, pixW * zoom, pixH * zoom);

    drawNoonVignette();
    drawWorldOverlaysOnScreen();
    drawCrosshairs();

    updateReloadAnim(dt);
    drawReloadWidget();
  }

  let lastTs = 0;
  function loop(ts) {
    const dt = lastTs ? Math.min(0.033, (ts - lastTs) / 1000) : 0.016;
    lastTs = ts;

    const wm = screenToWorld(state.input.mouseX, state.input.mouseY);
    state.input.worldMouseX = wm.x;
    state.input.worldMouseY = wm.y;

    G.SIM.update(state, world, dt);
    renderFrame(dt);
    updateHUD();

    requestAnimationFrame(loop);
  }

  function init() {
    resize();
    initReloadCaches();
    state = G.createInitialState();
    world = G.WORLD.create();
    state.input.mouseX = viewW * 0.6;
    state.input.mouseY = viewH * 0.5;
    bindEvents();
    refreshKeybindLabels();
    syncSettingsUI();
    updateHUD();
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
