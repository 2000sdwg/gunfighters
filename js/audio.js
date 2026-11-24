(function () {
  const G = (window.G = window.G || {});

  let ctx = null;
  let masterGain = null;
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

      masterGain = ctx.createGain();
      masterGain.gain.value = 0.82;
      masterGain.connect(comp);
      comp.connect(ctx.destination);

      // Заранее генерируем буфер белого шума (1.5 сек)
      const len = Math.floor(ctx.sampleRate * 1.5);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
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

  // 2D-рейкастинг акустики: выпускает 12 лучей, строит отражения и обновляет описание эха
  function triggerAcousticEcho(x, y, soundType, world, state) {
    const echoVol = G.CFG.phys.echo;
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
        hits.push({ dist: hit.dist, dx, dy, x: hit.x, y: hit.y, mat: (hit.seg && hit.seg.mat) || 'wood' });
        raysVis.push({ x1: x, y1: y, x2: hit.x, y2: hit.y, hit: true, life: 1.0, maxLife: 1.0 });
      } else {
        raysVis.push({ x1: x, y1: y, x2: x + dx * maxDist, y2: y + dy * maxDist, hit: false, life: 0.7, maxLife: 0.7 });
      }
    }

    if (state) {
      state.debugRays = raysVis;
    }

    const hitRatio = hits.length / rayCount;
    const avgDist = hits.length
      ? hits.reduce((acc, h) => acc + h.dist, 0) / hits.length
      : maxDist;

    let envType = 'open';
    let envLabel = 'ОТКРЫТАЯ ПУСТОШЬ';
    const rockHits = hits.filter((h) => h.mat === 'rock').length;

    if (hitRatio >= 0.75 && avgDist < 135) {
      envType = 'room';
      envLabel = 'ЗАКРЫТОЕ ПОМЕЩЕНИЕ';
    } else if (rockHits >= 3 || (state && state.zone === 'canyon')) {
      envType = 'canyon';
      envLabel = 'УЩЕЛЬЕ КАНЬОНА';
    } else if (hits.length >= 4 && avgDist < 220) {
      envType = 'alley';
      envLabel = 'УЗКАЯ УЛОЧКА (SLAPBACK)';
    }

    if (state) {
      state.echoDesc = envLabel;
    }

    if (echoVol <= 0.01) return;

    const now = ctx.currentTime;
    const baseTail = soundType === 'walker' ? 1.15 : soundType === 'winchester' ? 1.05 : 0.82;

    if (envType === 'room') {
      // Короткий жёсткий отбой стен комнаты + гулкое затухание дерева
      for (let i = 0; i < 4; i++) {
        const delay = 0.022 + i * 0.028 + Math.random() * 0.012;
        const pan = (i % 2 === 0 ? -0.45 : 0.45);
        const dest = makePanner(pan);
        playNoise(now + delay, 0.14 + i * 0.04, 'bandpass', 950 - i * 160, 260, 0.22 * echoVol * baseTail / (1 + i * 0.45), 1.1, dest);
      }
      // Лёгкий резонансный хвост внутри салуна
      playNoise(now + 0.05, 0.34, 'lowpass', 620, 180, 0.16 * echoVol * baseTail, 0.8);
      return;
    }

    if (envType === 'alley') {
      // Хлёсткий slapback между стенами улицы
      const sorted = hits.slice().sort((a, b) => a.dist - b.dist).slice(0, 5);
      sorted.forEach((h, idx) => {
        const delay = 0.045 + (h.dist / 360) * 0.16 + idx * 0.018;
        const dest = makePanner(h.dx * 0.75);
        playNoise(now + delay, 0.16, 'bandpass', 1200 - idx * 140, 320, 0.24 * echoVol * baseTail / (1 + idx * 0.35), 1.4, dest);
      });
      // Вторичный перекат вдоль улицы
      playNoise(now + 0.24, 0.38, 'lowpass', 700, 190, 0.12 * echoVol * baseTail, 0.7);
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
        const dest = makePanner(h.dx * 0.85);
        playNoise(now + delay, dur, 'lowpass', freq, 140, gain, 0.9, dest);
        playTone(now + delay, dur * 0.45, 'triangle', 145 - idx * 24, 55, gain * 0.38, dest);
      });
      // Дальний затухающий рокот ущелья
      playNoise(now + 0.58, 0.65, 'lowpass', 420, 110, 0.11 * echoVol * baseTail, 0.6);
      return;
    }

    // Открытая пустошь: сухой, короткий дальний хвост
    playNoise(now + 0.06, 0.20, 'lowpass', 650, 180, 0.09 * echoVol * baseTail, 0.7);
  }

  G.AUDIO = {
    unlock() {
      ensureCtx();
    },

    playShot(weapon, x, y, world, state) {
      if (!ensureCtx()) return;
      const now = ctx.currentTime;
      const type = weapon.soundType || 'walker';

      if (type === 'walker') {
        // Тяжёлый чёрнопороховой грохот Colt Walker (.44)
        playTone(now, 0.17, 'triangle', 155, 34, 0.72);
        playTone(now, 0.09, 'sawtooth', 92, 32, 0.38);
        playNoise(now, 0.24, 'lowpass', 2400, 260, 0.75, 0.9);
        playNoise(now, 0.065, 'highpass', 1500, 900, 0.48, 0.7);
      } else if (type === 'lightning') {
        // Резкий, сухой хлопок компактного .38 Lightning
        playTone(now, 0.09, 'triangle', 230, 58, 0.48);
        playNoise(now, 0.14, 'bandpass', 2100, 480, 0.56, 0.9);
        playNoise(now, 0.045, 'highpass', 2200, 1200, 0.40, 0.8);
      } else {
        // Хлёсткий винтовочный кнут Winchester 1873
        playTone(now, 0.13, 'sawtooth', 210, 42, 0.58);
        playNoise(now, 0.20, 'lowpass', 3600, 380, 0.70, 1.0);
        playNoise(now, 0.055, 'highpass', 2600, 1400, 0.52, 1.2);
      }

      triggerAcousticEcho(x, y, type, world, state);
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
    }
  };
})();
