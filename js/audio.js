(function () {
  const G = (window.G = window.G || {});

  let ctx = null;
  let masterGain = null;
  let masterFilter = null;
  let tinnitusGain = null;
  let windGain = null;
  let windFilter = null;
  let noiseBuf = null;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 18;
      comp.ratio.value = 6;
      comp.attack.value = 0.002;
      comp.release.value = 0.14;

      masterFilter = ctx.createBiquadFilter();
      masterFilter.type = 'lowpass';
      masterFilter.frequency.value = 18000;
      masterFilter.Q.value = 0.6;

      masterGain = ctx.createGain();
      masterGain.gain.value = 0.82;
      masterGain.connect(masterFilter);
      masterFilter.connect(comp);
      comp.connect(ctx.destination);

      // Заранее генерируем буфер белого шума (1.5 сек)
      const len = Math.floor(ctx.sampleRate * 1.5);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      // Непрерывный узел звона в ушах при контузии (gain = 0 в норме)
      const tOsc = ctx.createOscillator();
      tOsc.type = 'sine';
      tOsc.frequency.value = 3920;
      tinnitusGain = ctx.createGain();
      tinnitusGain.gain.value = 0;
      tOsc.connect(tinnitusGain);
      tinnitusGain.connect(comp);
      tOsc.start(0);

      // Непрерывный узел процедурного воющего ветра для пыльной бури (gain = 0 вне бури)
      const wSrc = ctx.createBufferSource();
      wSrc.buffer = noiseBuf;
      wSrc.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 360;
      windFilter.Q.value = 2.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      wSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(masterFilter);
      wSrc.start(0);
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function makePanner(panVal) {
    if (ctx && typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = G.MATH.clamp(panVal || 0, -0.9, 0.9);
      p.connect(masterGain);
      return p;
    }
    return masterGain;
  }

  function playNoise(start, dur, filterType, freqStart, freqEnd, gainPeak, q, dest) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const flt = ctx.createBiquadFilter();
    flt.type = filterType;
    flt.frequency.setValueAtTime(freqStart, start);
    if (freqEnd && freqEnd !== freqStart) {
      flt.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), start + dur);
    }
    if (q) flt.Q.value = q;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(gainPeak, start + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    src.connect(flt);
    flt.connect(g);
    g.connect(dest || masterGain);
    src.start(start, Math.random() * 0.4, dur + 0.02);
    src.stop(start + dur + 0.03);
  }

  function playTone(start, dur, type, freqStart, freqEnd, gainPeak, dest) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, start);
    if (freqEnd && freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(25, freqEnd), start + dur);
    }

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(gainPeak, start + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(g);
    g.connect(dest || masterGain);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  // Чистый расчёт 12-лучевой акустики (работает и без AudioContext для AI-слуха)
  function computeAcousticEcho(x, y, world, state) {
    const segments = (world && (world.soundSegments || world.wallSegments)) || [];
    const rayCount = 12;
    const maxDist = 520;
    const hits = [];
    const raysVis = [];

    for (let i = 0; i < rayCount; i++) {
      const ang = (i / rayCount) * Math.PI * 2 + 0.13;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const hit = G.MATH.raycastSegments(x, y, dx, dy, maxDist, segments);
      if (hit) {
        const rayIdx = raysVis.length;
        raysVis.push({ x1: x, y1: y, x2: hit.x, y2: hit.y, hit: true, life: 1.0, maxLife: 1.0, echoDistracted: false });
        hits.push({
          dist: hit.dist,
          dx,
          dy,
          x: hit.x,
          y: hit.y,
          mat: (hit.seg && hit.seg.mat) || 'wood',
          rayIdx: rayIdx,
          distracted: false
        });
      } else {
        raysVis.push({ x1: x, y1: y, x2: x + dx * maxDist, y2: y + dy * maxDist, hit: false, life: 0.7, maxLife: 0.7, echoDistracted: false });
      }
    }

    const hitRatio = hits.length / rayCount;
    let distSum = 0;
    let rockHits = 0;
    for (let i = 0; i < hits.length; i++) {
      distSum += hits[i].dist;
      if (hits[i].mat === 'rock') rockHits++;
    }
    const avgDist = hits.length ? distSum / hits.length : maxDist;

    let envType = 'open';
    let envLabel = 'ОТКРЫТАЯ ПУСТОШЬ';
    const srcZone = (world && world.getZoneAt) ? world.getZoneAt(x, y).id : (state ? state.zone : 'open');

    if (hitRatio >= 0.75 && avgDist < 135) {
      envType = 'room';
      envLabel = 'ЗАКРЫТОЕ ПОМЕЩЕНИЕ';
    } else if (rockHits >= 3 || srcZone === 'canyon') {
      envType = 'canyon';
      envLabel = 'УЩЕЛЬЕ КАНЬОНА';
    } else if (hits.length >= 4 && avgDist < 220) {
      envType = 'alley';
      envLabel = 'УЗКАЯ УЛОЧКА (SLAPBACK)';
    }

    return { hits, raysVis, envType, envLabel };
  }

  // 2D-рейкастинг акустики: выпускает 12 лучей, строит отражения и обновляет описание эха
  function triggerAcousticEcho(x, y, soundType, world, state, opts) {
    const o = opts || {};
    const skipHud = !!o.skipHudUpdate;
    const distAtt = o.attenuation !== undefined ? o.attenuation : 1.0;
    const basePan = o.pan !== undefined ? o.pan : 0;
    const echoVol = G.CFG.phys.echo * distAtt;
    const echo = o.precomputedEcho || computeAcousticEcho(x, y, world, state);
    const hits = echo.hits;
    const raysVis = echo.raysVis;
    const envType = echo.envType;
    const envLabel = echo.envLabel;

    if (state && !skipHud) {
      if (!o.precomputedEcho) state.debugRays = raysVis;
      state.echoDesc = envLabel;
    }

    if (echoVol <= 0.01) return;

    const now = ctx.currentTime;
    const baseTail = soundType === 'walker' ? 1.15 : soundType === 'winchester' ? 1.05 : 0.82;

    if (envType === 'room') {
      // Короткий жёсткий отбой стен комнаты + гулкое затухание дерева
      for (let i = 0; i < 4; i++) {
        const delay = 0.022 + i * 0.028 + Math.random() * 0.012;
        const pan = basePan * 0.6 + (i % 2 === 0 ? -0.35 : 0.35);
        const dest = makePanner(pan);
        playNoise(now + delay, 0.14 + i * 0.04, 'bandpass', 950 - i * 160, 260, 0.22 * echoVol * baseTail / (1 + i * 0.45), 1.1, dest);
      }
      // Лёгкий резонансный хвост внутри салуна
      playNoise(now + 0.05, 0.34, 'lowpass', 620, 180, 0.16 * echoVol * baseTail, 0.8, makePanner(basePan * 0.5));
      return;
    }

    if (envType === 'alley') {
      // Хлёсткий slapback между стенами улицы
      const sorted = hits.slice().sort((a, b) => a.dist - b.dist).slice(0, 5);
      sorted.forEach((h, idx) => {
        const delay = 0.045 + (h.dist / 360) * 0.16 + idx * 0.018;
        const dest = makePanner(basePan * 0.55 + h.dx * 0.45);
        playNoise(now + delay, 0.16, 'bandpass', 1200 - idx * 140, 320, 0.24 * echoVol * baseTail / (1 + idx * 0.35), 1.4, dest);
      });
      // Вторичный перекат вдоль улицы
      playNoise(now + 0.24, 0.38, 'lowpass', 700, 190, 0.12 * echoVol * baseTail, 0.7, makePanner(basePan * 0.5));
      return;
    }

    if (envType === 'canyon') {
      // Гулко перекатывающееся каньонное эхо от скал с учётом расстояния лучей
      const farHits = hits.slice().sort((a, b) => a.dist - b.dist);
      const picks = farHits.length >= 4
        ? [farHits[0], farHits[Math.floor(farHits.length / 2)], farHits[farHits.length - 1]]
        : [{ dist: 190, dx: -0.6 }, { dist: 310, dx: 0.7 }, { dist: 440, dx: -0.3 }];

      picks.forEach((h, idx) => {
        const delay = 0.11 + (h.dist / 340) * 0.34 + idx * 0.14;
        const dur = 0.34 + idx * 0.18;
        const freq = 950 - idx * 230;
        const gain = (0.28 / (1 + idx * 0.55)) * echoVol * baseTail;
        const dest = makePanner(basePan * 0.5 + h.dx * 0.55);
        playNoise(now + delay, dur, 'lowpass', freq, 140, gain, 0.9, dest);
        playTone(now + delay, dur * 0.45, 'triangle', 145 - idx * 24, 55, gain * 0.38, dest);
      });
      // Дальний затухающий рокот ущелья
      playNoise(now + 0.58, 0.65, 'lowpass', 420, 110, 0.11 * echoVol * baseTail, 0.6, makePanner(basePan * 0.4));
      return;
    }

    // Открытая пустошь: сухой, короткий дальний хвост
    playNoise(now + 0.06, 0.20, 'lowpass', 650, 180, 0.09 * echoVol * baseTail, 0.7, makePanner(basePan * 0.5));
  }

  G.AUDIO = {
    computeAcousticEcho,

    unlock() {
      ensureCtx();
    },

    playShot(weapon, x, y, world, state, opts) {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      const wObj = (typeof weapon === 'string') ? { soundType: weapon } : (weapon || { soundType: 'walker' });
      const type = wObj.soundType || 'walker';

      let att = 1.0;
      let pan = 0;
      const o = opts || {};
      if (o.isEnemy || o.listenerX !== undefined) {
        const lx = o.listenerX !== undefined ? o.listenerX : (state && state.player ? state.player.x : x);
        const ly = o.listenerY !== undefined ? o.listenerY : (state && state.player ? state.player.y : y);
        const dist = Math.hypot((x || lx) - lx, (y || ly) - ly);
        att = G.MATH.clamp(1.0 - Math.max(0, dist - 70) / 880, 0.10, 0.92);
        pan = G.MATH.clamp(((x || lx) - lx) / 360, -0.88, 0.88);
      }
      const dest = (Math.abs(pan) > 0.02 || att < 0.99) ? makePanner(pan) : masterGain;

      if (type === 'walker') {
        // Тяжёлый чёрнопороховой грохот Colt Walker (.44)
        playTone(now, 0.17, 'triangle', 155, 34, 0.72 * att, dest);
        playTone(now, 0.09, 'sawtooth', 92, 32, 0.38 * att, dest);
        playNoise(now, 0.24, 'lowpass', 2400, 260, 0.75 * att, 0.9, dest);
        playNoise(now, 0.065, 'highpass', 1500, 900, 0.48 * att, 0.7, dest);
      } else if (type === 'lightning') {
        // Резкий, сухой хлопок компактного .38 Lightning
        playTone(now, 0.09, 'triangle', 230, 58, 0.48 * att, dest);
        playNoise(now, 0.14, 'bandpass', 2100, 480, 0.56 * att, 0.9, dest);
        playNoise(now, 0.045, 'highpass', 2200, 1200, 0.40 * att, 0.8, dest);
      } else {
        // Хлёсткий винтовочный кнут Winchester 1873
        playTone(now, 0.13, 'sawtooth', 210, 42, 0.58 * att, dest);
        playNoise(now, 0.20, 'lowpass', 3600, 380, 0.70 * att, 1.0, dest);
        playNoise(now, 0.055, 'highpass', 2600, 1400, 0.52 * att, 1.2, dest);
      }

      triggerAcousticEcho(x, y, type, world, state, {
        skipHudUpdate: !!o.skipHudUpdate,
        attenuation: att,
        pan: pan
      });
    },

    playCock(action) {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      if (action === 'lever') {
        // Скоба Генри: откидывание вниз + звонкий досыл вверх
        playNoise(now, 0.035, 'bandpass', 2600, 1400, 0.28, 3.0);
        playTone(now, 0.04, 'square', 680, 420, 0.12);
        playNoise(now + 0.11, 0.045, 'bandpass', 3200, 1800, 0.34, 3.5);
        playTone(now + 0.11, 0.05, 'triangle', 980, 540, 0.16);
        playNoise(now + 0.21, 0.04, 'bandpass', 2200, 1100, 0.30, 2.8);
      } else {
        // Револьверный курок SA: полувзвод (tick) -> боевой взвод (CLACK)
        playNoise(now, 0.022, 'bandpass', 3600, 2200, 0.22, 4.0);
        playTone(now, 0.02, 'square', 1350, 900, 0.10);
        playNoise(now + 0.065, 0.032, 'bandpass', 4100, 1900, 0.34, 4.2);
        playTone(now + 0.065, 0.03, 'triangle', 1750, 820, 0.15);
      }
    },

    playTriggerTension() {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      playNoise(now, 0.04, 'bandpass', 2900, 1700, 0.14, 4.5);
      playTone(now, 0.045, 'triangle', 840, 1080, 0.06);
    },

    playDryClick() {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      playNoise(now, 0.02, 'bandpass', 3800, 2000, 0.26, 5.0);
      playTone(now, 0.025, 'square', 1200, 620, 0.12);
    },

    playReloadOpen(isCylinder) {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      if (isCylinder) {
        playNoise(now, 0.05, 'bandpass', 2400, 1200, 0.25, 3.0);
        playTone(now + 0.04, 0.05, 'triangle', 1100, 650, 0.11);
      } else {
        playNoise(now, 0.04, 'bandpass', 1900, 1100, 0.20, 2.5);
      }
    },

    playReloadInsert(isCylinder) {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      const base = isCylinder ? 1650 : 1320;
      playNoise(now, 0.028, 'bandpass', 2800, 1600, 0.22, 3.2);
      playTone(now + 0.022, 0.038, 'sine', base, base * 0.76, 0.14);
    },

    playReloadClose(isCylinder) {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      playNoise(now, 0.04, 'bandpass', 3100, 1500, 0.30, 3.5);
      playTone(now, 0.045, 'triangle', isCylinder ? 920 : 760, 420, 0.15);
    },

    playShellBounce(material, intensity) {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      const vol = G.MATH.clamp(intensity || 0.5, 0.12, 1.0) * 0.16;
      const isWood = material === 'wood';
      const f1 = (isWood ? 2450 : 3400) + Math.random() * 550;
      const f2 = f1 * 1.48;
      playTone(now, isWood ? 0.038 : 0.062, 'sine', f1, f1 * 0.94, vol);
      playTone(now, isWood ? 0.028 : 0.048, 'triangle', f2, f2 * 0.92, vol * 0.55);
    },

    playImpact(material) {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      if (material === 'glass') {
        playNoise(now, 0.16, 'highpass', 3200, 1800, 0.34, 1.2);
        playTone(now, 0.07, 'sine', 4200 + Math.random() * 700, 2400, 0.14);
        playTone(now + 0.025, 0.06, 'sine', 3500 + Math.random() * 600, 1900, 0.11);
      } else if (material === 'metal') {
        const f = 920 + Math.random() * 260;
        playTone(now, 0.22, 'triangle', f, f * 0.88, 0.26);
        playTone(now, 0.14, 'square', f * 1.62, f * 1.45, 0.11);
        playNoise(now, 0.05, 'highpass', 2400, 1200, 0.22, 1.5);
      } else if (material === 'rock' || material === 'stone') {
        playNoise(now, 0.09, 'bandpass', 1800, 520, 0.28, 1.4);
        // Случайный визг рикошета от скалы
        if (Math.random() < 0.45) {
          const startF = 1600 + Math.random() * 900;
          playTone(now + 0.01, 0.16, 'sine', startF, startF * 0.32, 0.13);
        }
      } else if (material === 'water') {
        playNoise(now, 0.18, 'bandpass', 1100, 320, 0.28, 1.1);
      } else if (material === 'flesh') {
        playTone(now, 0.08, 'sine', 165, 52, 0.30);
        playNoise(now, 0.07, 'lowpass', 720, 220, 0.24, 0.9);
      } else {
        // Дерево / ящик
        playTone(now, 0.065, 'triangle', 220, 75, 0.26);
        playNoise(now, 0.08, 'bandpass', 1250, 380, 0.26, 1.2);
      }
    },

    playRoll() {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      playNoise(now, 0.21, 'bandpass', 580, 210, 0.24, 0.9);
      playTone(now + 0.07, 0.09, 'sine', 110, 52, 0.14);
    },

    playCoverSnap() {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      playTone(now, 0.07, 'triangle', 140, 62, 0.20);
      playNoise(now, 0.055, 'lowpass', 620, 240, 0.16, 0.9);
    },

    playStep(surface) {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      if (surface === 'wood') {
        playTone(now, 0.04, 'triangle', 150 + Math.random() * 30, 65, 0.08);
        playNoise(now, 0.035, 'bandpass', 620, 280, 0.06, 1.2);
      } else {
        playNoise(now, 0.045, 'bandpass', 950 + Math.random() * 250, 380, 0.07, 1.0);
      }
    },

    playDrink() {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      // Щелчок пробки + два коротких булькающих глотка
      playTone(now, 0.035, 'sine', 620, 980, 0.16);
      playTone(now + 0.08, 0.085, 'sine', 240, 440, 0.22);
      playTone(now + 0.19, 0.095, 'sine', 270, 510, 0.20);
      playNoise(now + 0.08, 0.16, 'bandpass', 720, 360, 0.09, 1.4);
    },

    playHatEquip() {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      playNoise(now, 0.09, 'bandpass', 1200, 520, 0.14, 1.1);
      playTone(now + 0.02, 0.05, 'triangle', 290, 160, 0.09);
    },

    playWaveHorn(isStart) {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      if (isStart) {
        playTone(now, 0.24, 'triangle', 196, 294, 0.18);
        playTone(now + 0.16, 0.34, 'triangle', 294, 392, 0.16);
      } else {
        playTone(now, 0.20, 'triangle', 392, 523, 0.15);
        playTone(now + 0.14, 0.30, 'sine', 523, 659, 0.14);
      }
    },

    playBanditHelp() {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      playTone(now, 0.14, 'triangle', 640, 920, 0.12);
      playTone(now + 0.14, 0.16, 'triangle', 760, 540, 0.10);
    },

    playRicochet(x, y, listenerX, listenerY) {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      let att = 1.0;
      let pan = 0;
      if (x !== undefined && listenerX !== undefined) {
        const dist = Math.hypot(x - listenerX, (y || 0) - (listenerY || 0));
        att = G.MATH.clamp(1.0 - Math.max(0, dist - 60) / 760, 0.12, 1.0);
        pan = G.MATH.clamp((x - listenerX) / 360, -0.88, 0.88);
      }
      const dest = (Math.abs(pan) > 0.02 || att < 0.99) ? makePanner(pan) : masterGain;
      const startF = 2300 + Math.random() * 850;
      const endF = 540 + Math.random() * 240;
      playTone(now, 0.22, 'sine', startF, endF, 0.28 * att, dest);
      playTone(now, 0.14, 'triangle', startF * 0.72, endF * 0.85, 0.14 * att, dest);
      playNoise(now, 0.055, 'highpass', 2400, 1200, 0.24 * att, 1.8, dest);
    },

    setConcussion(level) {
      if (!ctx || !masterFilter || !tinnitusGain) return;
      const lv = G.MATH.clamp(level || 0, 0, 1);
      const freq = 18000 - (18000 - 720) * Math.pow(lv, 0.65);
      masterFilter.frequency.value = freq;
      tinnitusGain.gain.value = lv > 0.03 ? lv * 0.024 : 0;
    },

    updateWind(stormIntensity, outdoors, timeSec) {
      if (!ctx || !windGain || !windFilter) return;
      const iv = G.MATH.clamp(stormIntensity || 0, 0, 1);
      if (iv <= 0.01) {
        windGain.gain.value = 0;
        return;
      }
      const envScale = outdoors ? 1.0 : 0.20;
      const howl = Math.sin((timeSec || 0) * 0.9) * 110 + Math.sin((timeSec || 0) * 2.3) * 45;
      windFilter.frequency.value = G.MATH.clamp(380 + howl + iv * 160, 180, 950);
      windGain.gain.value = iv * 0.16 * envScale;
    },

    playBandage() {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      playNoise(now, 0.12, 'bandpass', 1400, 720, 0.12, 1.3);
      playTone(now + 0.04, 0.09, 'sine', 420, 580, 0.07);
    },

    playBanditReloadClick(kind, x, y, listenerX, listenerY) {
      if (!ensureCtx()) return;
      const dist = (x !== undefined && listenerX !== undefined)
        ? Math.hypot(x - listenerX, (y || 0) - (listenerY || 0))
        : 120;
      if (dist > 460) return;
      const att = G.MATH.clamp(1.0 - Math.max(0, dist - 50) / 410, 0.08, 0.55);
      const pan = (listenerX !== undefined) ? G.MATH.clamp(((x || listenerX) - listenerX) / 340, -0.85, 0.85) : 0;
      const dest = (Math.abs(pan) > 0.02 || att < 0.99) ? makePanner(pan) : masterGain;
      const now = ctx.currentTime;
      if (kind === 'insert') {
        playNoise(now, 0.022, 'bandpass', 2650, 1500, 0.22 * att, 3.2, dest);
        playTone(now + 0.014, 0.032, 'sine', 1520, 1180, 0.14 * att, dest);
      } else if (kind === 'close') {
        playNoise(now, 0.032, 'bandpass', 3000, 1400, 0.28 * att, 3.4, dest);
        playTone(now, 0.040, 'triangle', 880, 420, 0.14 * att, dest);
      } else {
        playNoise(now, 0.036, 'bandpass', 1950, 1050, 0.22 * att, 2.8, dest);
      }
    },

    playDoorSlam() {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      playTone(now, 0.14, 'triangle', 128, 42, 0.48);
      playNoise(now, 0.12, 'bandpass', 780, 260, 0.42, 1.1);
      playTone(now + 0.04, 0.16, 'sine', 620, 340, 0.12);
    },

    playBirdsFlush() {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      for (let i = 0; i < 4; i++) {
        const t = now + i * 0.055;
        playNoise(t, 0.09, 'bandpass', 1750 + i * 220, 820, 0.12, 1.3);
      }
      playTone(now + 0.02, 0.07, 'sine', 2450, 3150, 0.07);
      playTone(now + 0.11, 0.08, 'sine', 2800, 2250, 0.06);
      playTone(now + 0.20, 0.06, 'sine', 2600, 3200, 0.05);
    },

    playHoofbeat(surface) {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      const isWood = surface === 'wood';
      const f1 = isWood ? 168 : 112;
      playTone(now, 0.055, 'triangle', f1 + Math.random() * 22, 52, 0.18);
      playNoise(now, 0.05, 'bandpass', isWood ? 880 : 1200, 360, 0.14, 1.2);
      playTone(now + 0.085, 0.05, 'triangle', f1 * 1.12, 58, 0.14);
      playNoise(now + 0.085, 0.045, 'bandpass', isWood ? 940 : 1280, 390, 0.11, 1.2);
    },

    playHorseNeigh() {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      playTone(now, 0.14, 'sawtooth', 420, 620, 0.13);
      playTone(now + 0.12, 0.28, 'triangle', 600, 265, 0.16);
      playNoise(now + 0.06, 0.26, 'bandpass', 1450, 650, 0.10, 1.4);
    }
  };
})();
