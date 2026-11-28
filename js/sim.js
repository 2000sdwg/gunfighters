(function () {
  const G = (window.G = window.G || {});

  function getPal() {
    if (G.PAL) return G.PAL;
    return {
      dirt: ['#cbb58e', '#b39a72', '#977d58', '#786041', '#54412b'],
      canyon: ['#b8845c', '#996544', '#7b4c32', '#5b3623', '#3b2115'],
      stone: ['#9c998e', '#7e7c73', '#616059', '#454540', '#2b2b28'],
      woodWarm: ['#8f633e', '#724c2d', '#573820', '#3d2616', '#26170d'],
      water: ['#7ba4ad', '#56808c', '#3b616e', '#26434f', '#172b33'],
      blood: ['#c9241c', '#991812', '#6e100c', '#450907']
    };
  }

  function resolvePlayer(state, player) {
    if (player) return player;
    if (!state) return null;
    if (state.players && state.localPlayerId && state.players[state.localPlayerId]) {
      return state.players[state.localPlayerId];
    }
    return state.player || null;
  }

  function getPlayers(state) {
    if (!state) return [];
    if (G.getPlayersList) return G.getPlayersList(state);
    return state.player ? [state.player] : [];
  }

  function isLocalPlayer(state, p) {
    if (!p || !state || !state.localPlayerId) return true;
    return p.id === state.localPlayerId;
  }

  function isPlayerGod(state, p) {
    return !!(G.CFG && G.CFG.godMode && isLocalPlayer(state, p));
  }

  function resolveCircleSolids(obj, r, world, passes) {
    if (!obj || !world || !world.solids) return;
    const nPass = passes || 2;
    const solids = world.solids;
    for (let pass = 0; pass < nPass; pass++) {
      for (let i = 0; i < solids.length; i++) {
        const s = solids[i];
        if (s.walkThrough || s._storyHidden) continue;
        if (obj.x < s.x - 220 || obj.x > s.x + s.w + 220 || obj.y < s.y - 220 || obj.y > s.y + s.h + 220) continue;
        const rad = s.type === 'fence' ? r + 2 : r;
        const res = G.MATH.circleRectPush(obj.x, obj.y, rad, s);
        if (res.hit) {
          obj.x = res.x;
          obj.y = res.y;
        }
      }
    }
  }

  // Пошаговая коллизия против «проскакивания» тонких заборов при кувырке, скачке и отбросе
  function moveCircleWithSolids(obj, dx, dy, r, world, minX, maxX, minY, maxY) {
    const dist = Math.hypot(dx, dy);
    const steps = dist > 5 ? Math.max(2, Math.ceil(dist / 4)) : 1;
    const sx = dx / steps;
    const sy = dy / steps;
    for (let st = 0; st < steps; st++) {
      obj.x = G.MATH.clamp(obj.x + sx, minX, maxX);
      obj.y = G.MATH.clamp(obj.y + sy, minY, maxY);
      resolveCircleSolids(obj, r, world, 2);
    }
  }

  function showToastFor(state, p, text, dur) {
    if (!state || !text) return;
    if (isLocalPlayer(state, p)) {
      state.toast.text = text;
      state.toast.timer = dur || 1.4;
    }
  }

  function pushNetEvent(state, ev) {
    if (!state || state.netRole !== 'host') return;
    if (!state.netEvents) state.netEvents = [];
    if (state.netEvents.length >= 64) state.netEvents.shift();
    state.netEvents.push(ev);
  }

  function getWeapon(state, player) {
    const p = resolvePlayer(state, player);
    return G.WEAPONS[(p && p.weaponIdx) || 0];
  }

  function getWeaponById(id) {
    for (let i = 0; i < G.WEAPONS.length; i++) {
      if (G.WEAPONS[i].id === id) return G.WEAPONS[i];
    }
    return G.WEAPONS[0];
  }

  function getBotDiff() {
    if (G.getBotDiffProfile) return G.getBotDiffProfile();
    return (G.BOT_DIFFICULTY && G.BOT_DIFFICULTY.medium) || {
      id: 'medium', reactMult: 1.0, dodgeSkill: 0.65, spreadMult: 1.0, tacticalCover: 0.78, avoidFriendlyFire: 0.55, shootCooldownMult: 1.0
    };
  }

  function stepAimSpring(actor, angleKey, targetAngle, wDef, dt, rateScale) {
    const scale = rateScale !== undefined ? rateScale : 1.0;
    const inertia = (G.CFG.phys && G.CFG.phys.inertia) || 1.0;
    const springMul = ((G.CFG.phys && G.CFG.phys.spring) || 1.0) * scale;
    const wt = Math.max(0.3, wDef.weight || 1.0);
    const effK = ((wDef.springK || 162) / (wt * inertia)) * springMul;
    const effDamp = ((wDef.damping || 15.2) / Math.sqrt(wt * inertia)) / Math.sqrt(Math.max(0.25, springMul));
    actor.aimVel = actor.aimVel || 0;
    const subDt = dt * 0.5;
    for (let s = 0; s < 2; s++) {
      const diff = G.MATH.angleDiff(actor[angleKey] || 0, targetAngle);
      const acc = diff * effK - actor.aimVel * effDamp;
      actor.aimVel += acc * subDt;
      actor[angleKey] = G.MATH.normAngle((actor[angleKey] || 0) + actor.aimVel * subDt);
    }
  }

  function getWState(state, player) {
    const p = resolvePlayer(state, player);
    return p.weapons[p.weaponIdx || 0];
  }

  // ==================== ПОКАМОРНОЕ СОСТОЯНИЕ БАРАБАНА (ШАГ 1, ФАЙЛ 3/4) ====================

  function ensureChambers(w, ws) {
    if (w.uiShape !== 'cylinder') return;
    if (!Array.isArray(ws.chambers) || ws.chambers.length !== w.capacity) {
      ws.chambers = [];
      for (let i = 0; i < w.capacity; i++) {
        if (i < ws.ammo) ws.chambers.push('live');
        else if (i < ws.ammo + ws.spent) ws.chambers.push('spent');
        else ws.chambers.push('empty');
      }
      ws.cylinderIdx = 0;
    }
    if (ws.cylinderIdx === undefined) ws.cylinderIdx = 0;
  }

  function syncChamberCounts(w, ws) {
    if (w.uiShape !== 'cylinder') return;
    ensureChambers(w, ws);
    let live = 0;
    let spent = 0;
    for (let i = 0; i < ws.chambers.length; i++) {
      if (ws.chambers[i] === 'live') live++;
      else if (ws.chambers[i] === 'spent') spent++;
    }
    ws.ammo = live;
    ws.spent = spent;
  }

  function pushReloadEvent(state, ev) {
    if (!state.reloadEvents) state.reloadEvents = [];
    if (state.reloadEvents.length > 32) state.reloadEvents.shift();
    state.reloadEvents.push(ev);
  }

  function showToast(state, text, dur) {
    state.toast.text = text;
    state.toast.timer = dur || 1.15;
  }

  function spawnFloatText(state, x, y, text, color, big) {
    if (!state.floatTexts) state.floatTexts = [];
    if (state.floatTexts.length > 24) state.floatTexts.shift();
    state.floatTexts.push({
      x: x + G.MATH.rand(-4, 4),
      y: y - 10,
      vy: big ? -28 : -22,
      text: text,
      color: color || '#ebd194',
      big: !!big,
      life: big ? 0.95 : 0.72,
      maxLife: big ? 0.95 : 0.72
    });
  }

  function triggerHitConfirm(state, fatal) {
    state.hitConfirm = {
      timer: fatal ? 0.22 : 0.14,
      maxTimer: fatal ? 0.22 : 0.14,
      fatal: !!fatal
    };
  }

  function getRenderPos(player) {
    const pf = player.peekFrac || 0;
    if (pf <= 0.001 || !player.coverObj) {
      return { x: player.x, y: player.y };
    }
    const off = G.CFG.coverPeekOffset * pf;
    return {
      x: player.x + (player.peekDirX || 0) * off,
      y: player.y + (player.peekDirY || 0) * off
    };
  }

  function getHandOrigin(player) {
    const pos = getRenderPos(player);
    const a = player.aimAngle;
    const rightX = -Math.sin(a) * 4.5;
    const rightY = Math.cos(a) * 4.5;
    return {
      x: pos.x + rightX + Math.cos(a) * 4,
      y: pos.y + rightY + Math.sin(a) * 4
    };
  }

  function getMuzzlePos(state, player) {
    const p = resolvePlayer(state, player);
    const w = getWeapon(state, p);
    const origin = getHandOrigin(p);
    const kickBack = (p.recoilKickAnim || 0) * 3.0;
    const len = Math.max(8, w.barrelLen - kickBack);
    return {
      x: origin.x + Math.cos(p.aimAngle) * len,
      y: origin.y + Math.sin(p.aimAngle) * len
    };
  }

  function addWaterRipple(state, barrelId, x, y, maxR, strength) {
    if (!state.waterRipples) state.waterRipples = [];
    if (state.waterRipples.length > 40) state.waterRipples.shift();
    state.waterRipples.push({
      barrelId: barrelId,
      x: x,
      y: y,
      r: 1.5,
      maxR: maxR || 11,
      speed: 14 + (strength || 1) * 10,
      alpha: Math.min(0.85, 0.35 + (strength || 0.5) * 0.45),
      life: 0.75,
      maxLife: 0.75
    });
  }

  // Пересекает ли отрезок прямоугольник (Liang–Barsky, без аллокаций)
  function segmentCrossesRect(x1, y1, x2, y2, r) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    let t0 = 0;
    let t1 = 1;

    if (Math.abs(dx) < 1e-9) {
      if (x1 < r.x || x1 > r.x + r.w) return false;
    } else {
      let ta = (r.x - x1) / dx;
      let tb = (r.x + r.w - x1) / dx;
      if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) return false;
    }

    if (Math.abs(dy) < 1e-9) {
      if (y1 < r.y || y1 > r.y + r.h) return false;
    } else {
      let ta = (r.y - y1) / dy;
      let tb = (r.y + r.h - y1) / dy;
      if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) return false;
    }

    return true;
  }

  // Частицы попадания в материал укрытия (щепки, брызги, искры, сено)
  function spawnCoverImpact(state, x, y, mat, dirAngle) {
    const P = getPal();
    let colors;
    let kind = 'debris';
    if (mat === 'water') {
      colors = [P.water[0], P.water[1], P.cloud[0]];
    } else if (mat === 'rock' || mat === 'stone') {
      colors = [P.stone[0], P.stone[1], P.stone[2]];
      kind = 'spark';
    } else if (mat === 'metal') {
      colors = ['#f5e3ab', '#e3c068', '#ffffff'];
      kind = 'spark';
    } else if (mat === 'hay') {
      colors = [P.grass[0], P.grass[1], P.grass[2]];
    } else {
      colors = [P.woodWarm[1], P.woodWarm[2], P.woodWarm[3]];
    }
    spawnParticles(state, x, y, 7, {
      baseAngle: dirAngle,
      spread: 0.9,
      minSpeed: 26,
      maxSpeed: 88,
      minLife: 0.16,
      maxLife: 0.36,
      minSize: 1.2,
      maxSize: 2.4,
      drag: 6.5,
      colors: colors,
      alpha: 0.9,
      kind: kind
    });
  }

  // Мгновенное прерывание курения с выбросом тлеющего окурка на землю
  function interruptSmoking(state, player) {
    if (!player) return;
    player.idleTimer = 0;
    if (!player.smokingState) return;
    const wasSmoking = player.smokingState === 'smoking' || (player.smokingState === 'lighting' && (player.smokeAnimTime || 0) > 0.45);
    player.smokingState = null;
    player.smokeAnimTime = 0;

    if (wasSmoking) {
      const ang = player.aimAngle || 0;
      const bx = player.x + Math.cos(ang) * 7;
      const by = player.y + Math.sin(ang) * 7;
      // Крошечный тлеющий окурок с искрами и сизым дымком
      spawnParticles(state, bx, by, 3, {
        baseAngle: ang + 0.5,
        spread: 0.8,
        minSpeed: 14,
        maxSpeed: 34,
        minLife: 0.18,
        maxLife: 0.42,
        minSize: 1.0,
        maxSize: 1.6,
        drag: 7.0,
        colors: ['#c9241c', '#f2da91'],
        alpha: 0.95,
        kind: 'spark'
      });
      spawnParticles(state, bx, by, 2, {
        baseAngle: -Math.PI * 0.4,
        spread: 0.5,
        minSpeed: 8,
        maxSpeed: 18,
        minLife: 0.45,
        maxLife: 0.85,
        minSize: 1.6,
        maxSize: 2.8,
        grow: 2.0,
        drag: 3.0,
        colors: ['#cfc8b6', '#9c998e'],
        alpha: 0.45,
        kind: 'smoke'
      });
      addDecal(state, bx, by, 1.3, '#cfc8b6');
    }
  }

  // Резкий отскок / уклонение бандита перпендикулярно линии огня
  function triggerBanditDodge(t, threatDx, threatDy, state, world) {
    if (!t || !t.alive || t.isDodging || (t.dodgeCooldown || 0) > 0) return;
    const diff = getBotDiff();
    if (diff.dodgeSkill < 1 && Math.random() > diff.dodgeSkill) return;
    const len = Math.hypot(threatDx, threatDy) || 1;
    const ndx = threatDx / len;
    const ndy = threatDy / len;
    const side = Math.random() < 0.5 ? 1 : -1;
    const px = -ndy * side;
    const py = ndx * side;
    const spd = 175 * (0.85 + 0.20 * (diff.dodgeSkill || 0.65));
    t.isDodging = true;
    t.dodgeTimer = 0.26;
    t.dodgeCooldown = 2.6 * (diff.reactMult || 1.0);
    t.dodgeDx = px * spd;
    t.dodgeDy = py * spd;
    t.inCover = false;
    t.peeking = false;
    t.aimTimer = 0;
    t.telegraphFrac = 0;

    if (state && world) {
      const P = getPal();
      const isWood = world.getSurfaceAt(t.x, t.y) === 'wood';
      spawnParticles(state, t.x, t.y, 7, {
        baseAngle: Math.atan2(-py, -px),
        spread: 0.7,
        minSpeed: 18,
        maxSpeed: 52,
        minLife: 0.22,
        maxLife: 0.44,
        minSize: 1.4,
        maxSize: 3.0,
        grow: 2.2,
        colors: isWood ? [P.woodWarm[1], P.woodWarm[2]] : [P.dirt[0], P.dirt[1]],
        alpha: 0.5,
        kind: 'smoke'
      });
    }
  }

  function checkBarrelWallCollision(actor, weapon, world) {
    const pos = (actor.aimAngle !== undefined) ? getRenderPos(actor) : actor;
    const a = (actor.aimAngle !== undefined) ? actor.aimAngle : (actor.angle || 0);
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const rx = -dy;
    const ry = dx;

    const segments = world.raiseSegments;
    const ignoreId = (actor.inCover && actor.peeking && actor.coverObj && !actor.coverObj.high)
      ? actor.coverObj.id
      : null;

    const maxCheck = (weapon.wallCheckLen || 21) + 5;
    let bestHit = null;
    for (let i = 0; i < 2; i++) {
      const off = i === 0 ? 4.2 : 1.2;
      const baseLen = i === 0 ? maxCheck : (maxCheck - 1);
      const ox = pos.x + rx * off;
      const oy = pos.y + ry * off;
      const limit = bestHit ? Math.min(baseLen, bestHit.dist) : baseLen;
      const ex = ox + dx * limit;
      const ey = oy + dy * limit;
      const rMinX = ox < ex ? ox : ex;
      const rMaxX = ox > ex ? ox : ex;
      const rMinY = oy < ey ? oy : ey;
      const rMaxY = oy > ey ? oy : ey;
      for (let s = 0; s < segments.length; s++) {
        const seg = segments[s];
        if (ignoreId && seg.id === ignoreId) continue;
        if (seg.maxX !== undefined && (seg.maxX < rMinX || seg.minX > rMaxX || seg.maxY < rMinY || seg.minY > rMaxY)) {
          continue;
        }
        const hit = G.MATH.raySegment(ox, oy, dx, dy, limit, seg.x1, seg.y1, seg.x2, seg.y2);
        if (hit && (!bestHit || hit.dist < bestHit.dist)) {
          bestHit = hit;
        }
      }
    }
    return bestHit;
  }

  function spawnParticles(state, x, y, count, opts) {
    for (let i = 0; i < count; i++) {
      if (state.particles.length > 340) state.particles.shift();
      const ang = opts.baseAngle !== undefined
        ? opts.baseAngle + G.MATH.rand(-opts.spread, opts.spread)
        : Math.random() * Math.PI * 2;
      const spd = G.MATH.rand(opts.minSpeed || 20, opts.maxSpeed || 90);
      const life = G.MATH.rand(opts.minLife || 0.2, opts.maxLife || 0.6);
      const colors = opts.colors || ['#cbb58e'];
      state.particles.push({
        x: x + G.MATH.rand(-1.5, 1.5),
        y: y + G.MATH.rand(-1.5, 1.5),
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        drag: opts.drag !== undefined ? opts.drag : 4.5,
        size: G.MATH.rand(opts.minSize || 1.2, opts.maxSize || 2.8),
        grow: opts.grow || 0,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: opts.alpha !== undefined ? opts.alpha : 0.9,
        life: life,
        maxLife: life,
        kind: opts.kind || 'spark'
      });
    }
  }

  function addDecal(state, x, y, r, color, extra) {
    if (state.decals.length > 280) state.decals.shift();
    state.decals.push({
      x: x,
      y: y,
      r: r,
      color: color,
      kind: (extra && extra.kind) || 'mark',
      angle: (extra && extra.angle) || 0,
      stretch: (extra && extra.stretch) || 1
    });
  }

  function spawnBloodBurst(state, x, y, dirX, dirY, damage, isFatal) {
    if (!state.bloodDrops) state.bloodDrops = [];
    const P = getPal();
    const bloodCols = P.blood || ['#c9241c', '#991812', '#6e100c', '#450907'];
    const baseAngle = Math.atan2(dirY, dirX);
    const power = G.MATH.clamp((damage || 45) / 50, 0.65, 1.75);

    const exitCount = isFatal ? Math.round(24 * Math.min(1.4, power)) : Math.round(11 * power);
    for (let i = 0; i < exitCount; i++) {
      if (state.bloodDrops.length > 240) state.bloodDrops.shift();
      const spread = isFatal ? 0.56 : 0.42;
      const ang = baseAngle + (Math.random() + Math.random() - 1) * spread;
      const spd = G.MATH.rand(72, isFatal ? 245 : 180) * Math.min(1.35, power);
      state.bloodDrops.push({
        x: x + dirX * G.MATH.rand(2, 6),
        y: y + dirY * G.MATH.rand(2, 6),
        px: x,
        py: y,
        z: G.MATH.rand(7, 13),
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        vz: G.MATH.rand(26, isFatal ? 105 : 76),
        size: G.MATH.rand(1.2, isFatal ? 3.0 : 2.3),
        color: bloodCols[Math.floor(Math.random() * bloodCols.length)],
        life: G.MATH.rand(0.42, 0.92)
      });
    }

    const entryCount = isFatal ? 10 : Math.max(4, Math.round(5 * power));
    for (let i = 0; i < entryCount; i++) {
      if (state.bloodDrops.length > 240) state.bloodDrops.shift();
      const ang = baseAngle + Math.PI + G.MATH.rand(-1.25, 1.25);
      const spd = G.MATH.rand(24, 82);
      state.bloodDrops.push({
        x: x - dirX * 2,
        y: y - dirY * 2,
        px: x,
        py: y,
        z: G.MATH.rand(6, 11),
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        vz: G.MATH.rand(40, 82),
        size: G.MATH.rand(1.0, 1.9),
        color: bloodCols[Math.floor(Math.random() * bloodCols.length)],
        life: G.MATH.rand(0.32, 0.68)
      });
    }

    spawnParticles(state, x + dirX * 3, y + dirY * 3, isFatal ? 15 : 8, {
      baseAngle: baseAngle,
      spread: 0.65,
      minSpeed: 36,
      maxSpeed: isFatal ? 145 : 98,
      minLife: 0.14,
      maxLife: 0.34,
      minSize: 1.5,
      maxSize: 3.0,
      grow: 1.0,
      drag: 7.5,
      colors: [bloodCols[0], bloodCols[1], bloodCols[2]],
      alpha: 0.88,
      kind: 'blood_mist'
    });

    addDecal(state, x + dirX * 6, y + dirY * 6, isFatal ? 4.4 : 2.6 * Math.min(1.3, power), bloodCols[1], {
      kind: 'blood',
      angle: baseAngle,
      stretch: 1.8
    });
  }

  function spawnFlyingHat(state, x, y, dirX, dirY, hatColor, hatBand) {
    if (!state.flyingHats) state.flyingHats = [];
    if (state.flyingHats.length > 16) state.flyingHats.shift();
    const ang = Math.atan2(dirY, dirX) + G.MATH.rand(-0.45, 0.45);
    const spd = G.MATH.rand(55, 105);
    state.flyingHats.push({
      x: x,
      y: y,
      z: 12,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      vz: G.MATH.rand(75, 115),
      rot: Math.random() * Math.PI * 2,
      vrot: G.MATH.rand(-12, 12),
      hatColor: hatColor || '#1c1714',
      hatBand: hatBand || '#862a20',
      bounces: 0,
      settled: false,
      life: 24
    });
  }

  function spawnShell(state, x, y, ejectAngle, speedScale) {
    if (state.shells.length > 90) state.shells.shift();
    const ang = ejectAngle + G.MATH.rand(-0.38, 0.38);
    const spd = G.MATH.rand(42, 82) * (speedScale || 1);
    state.shells.push({
      x: x,
      y: y,
      z: 9,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      vz: G.MATH.rand(58, 92) * (speedScale || 1),
      rot: Math.random() * Math.PI * 2,
      vrot: G.MATH.rand(-18, 18),
      bounces: 0,
      settled: false,
      life: 32
    });
  }

  function findNearestCover(player, world) {
    let best = null;
    let bestDist = G.CFG.coverDetectDist;
    for (let i = 0; i < world.covers.length; i++) {
      const c = world.covers[i];
      const nearX = G.MATH.clamp(player.x, c.x, c.x + c.w);
      const nearY = G.MATH.clamp(player.y, c.y, c.y + c.h);
      const dx = player.x - nearX;
      const dy = player.y - nearY;
      const d = Math.hypot(dx, dy);
      if (d < bestDist && d > 0.01) {
        bestDist = d;
        best = {
          obj: c,
          nearX: nearX,
          nearY: nearY,
          nx: dx / d,
          ny: dy / d,
          dist: d
        };
      }
    }
    return best;
  }

  function enterCover(state, info, player) {
    const p = resolvePlayer(state, player);
    p.inCover = true;
    p.peeking = false;
    p.coverObj = info.obj;
    p.coverNormalX = info.nx;
    p.coverNormalY = info.ny;
    p.x = info.nearX + info.nx * (G.CFG.playerRadius + 1.5);
    p.y = info.nearY + info.ny * (G.CFG.playerRadius + 1.5);
    resolveCircleSolids(p, G.CFG.playerRadius + 0.5, state && state._worldRef ? state._worldRef : null, 3);
    p.vx = 0;
    p.vy = 0;
    // Запоминаем "сложенную" позицию в укрытии: к ней герой возвращается после выглядывания
    p.coverAnchorX = p.x;
    p.coverAnchorY = p.y;
    p.peekTargetX = p.x;
    p.peekTargetY = p.y;
    p.peekSide = 1;
    if (isLocalPlayer(state, p)) G.AUDIO.playCoverSnap();
    showToastFor(state, p, 'В УКРЫТИИ — ЗАЖМИ ПКМ, ЧТОБЫ ВЫГЛЯНУТЬ', 1.35);
  }

  function exitCover(state, player, world) {
    const p = resolvePlayer(state, player);
    if (!p || !p.inCover) return;
    p.inCover = false;
    p.peeking = false;
    p.coverObj = null;
    p.coverAnchorX = undefined;
    p.coverAnchorY = undefined;
    resolveCircleSolids(p, G.CFG.playerRadius + 0.5, world || (state && state._worldRef), 3);
  }

  function pickSpawnForPlayer(state, world, p) {
    const playersList = getPlayers(state);
    const idx = Math.max(0, playersList.indexOf(p));
    const lay = (world && world.layout) || G.WORLD_LAYOUT;
    if (state && state.mpMode === 'pvp' && playersList.length > 1) {
      const pvpPoints = (lay && lay.pvpPoints) || [
        { x: 215, y: 400 },
        { x: 1040, y: 415 },
        { x: 210, y: 745 },
        { x: 1550, y: 415 },
        { x: 2280, y: 345 },
        { x: 2950, y: 265 }
      ];
      let best = pvpPoints[idx % pvpPoints.length];
      let bestScore = -1;
      for (let i = 0; i < pvpPoints.length; i++) {
        const pt = pvpPoints[i];
        let minDist = Infinity;
        for (let j = 0; j < playersList.length; j++) {
          const op = playersList[j];
          if (op === p || op.dead) continue;
          minDist = Math.min(minDist, G.MATH.dist(pt.x, pt.y, op.x, op.y));
        }
        if (minDist > bestScore) {
          bestScore = minDist;
          best = pt;
        }
      }
      return best;
    }
    const baseSp = (lay && lay.playerSpawn) || { x: 215, y: 400 };
    return {
      x: baseSp.x + (idx % 3) * 24,
      y: baseSp.y + (idx > 0 ? ((idx % 2 === 1 ? -1 : 1) * 28) : 0)
    };
  }

  // Чистый респавн в салуне или на арене PvP (по таймеру или мгновенно по [R])
  function respawnPlayer(state, player, world) {
    const p = resolvePlayer(state, player);
    const spot = pickSpawnForPlayer(state, world, p);
    p.dead = false;
    p.hp = p.maxHp || 100;
    p.x = spot.x;
    p.y = spot.y;
    p.vx = 0;
    p.vy = 0;
    p.rolling = false;
    p.rollTimer = 0;
    p.inCover = false;
    p.peeking = false;
    p.coverObj = null;
    p.coverAnchorX = undefined;
    p.coverAnchorY = undefined;
    p.coverFrac = 0;
    p.peekFrac = 0;
    p.crouchFrac = 0;
    p.idleTimer = 0;
    p.smokingState = null;
    p.smokeAnimTime = 0;
    p.hurtTimer = 0;
    p.spread = 0.05;
    p.critical = false;
    p.bleeding = false;
    p.bleedDripTimer = 0;
    p.concussion = 0;
    p.indoorRingTimer = 0;
    p.bandaging = false;
    p.bandageTimer = 0;
    p.bandages = 2;
    p.drinking = false;
    p.drinkTimer = 0;
    p.stunTimer = 0;
    p.knockVx = 0;
    p.knockVy = 0;
    p.mountedHorse = false;
    if (isLocalPlayer(state, p)) {
      state.bloodTrail = state.bloodTrail || [];
      state.hatMenuOpen = false;
      if (G.AUDIO.setConcussion) G.AUDIO.setConcussion(0);
    }
    if (state.saloonProps && !state.saloonProps.bourbonInHand) {
      state.saloonProps.bourbonAvailable = true;
    }
    p.bloom = 0;
    p.regenTimer = 0;
    showToastFor(state, p, state.mpMode === 'pvp' ? 'ВОЗРОЖДЕНИЕ НА АРЕНЕ' : 'ВОЗРОЖДЕНИЕ В САЛУНЕ', 1.6);
  }

  function cancelDrinking(state, reason, player) {
    const p = resolvePlayer(state, player);
    if (!p || !p.drinking) return;
    p.drinking = false;
    p.drinkTimer = 0;
    if (state.saloonProps && state.saloonProps.bourbonInHand) {
      state.saloonProps.bourbonAvailable = true;
      state.saloonProps.bourbonInHand = false;
    }
    if (reason) showToastFor(state, p, reason, 1.2);
  }

  function completeDrinking(state, player) {
    const p = resolvePlayer(state, player);
    const P = getPal();
    const maxHp = p.maxHp || 100;
    p.drinking = false;
    p.drinkTimer = 0;
    if (state.saloonProps) {
      state.saloonProps.bourbonAvailable = false;
      state.saloonProps.bourbonInHand = false;
    }
    p.hp = maxHp;
    p.critical = false;
    p.bleeding = false;
    p.concussion = 0;
    p.indoorRingTimer = 0;
    p.bandaging = false;
    p.bandageTimer = 0;
    if (isLocalPlayer(state, p) && G.AUDIO.setConcussion) G.AUDIO.setConcussion(0);
    if (G.AUDIO.playDrink) G.AUDIO.playDrink();
    pushNetEvent(state, { kind: 'drink', x: p.x, y: p.y, playerId: p.id });
    spawnParticles(state, p.x + Math.cos(p.aimAngle) * 7, p.y + Math.sin(p.aimAngle) * 7, 10, {
      baseAngle: p.aimAngle, spread: 1.5, minSpeed: 28, maxSpeed: 88,
      minLife: 0.24, maxLife: 0.52, minSize: 1.3, maxSize: 2.3, drag: 5.5,
      colors: [P.brass[0], P.brass[1], P.woodWarm[0]], alpha: 0.9, kind: 'debris'
    });
    spawnFloatText(state, p.x, p.y - 12, `+${Math.round(maxHp)} HP`, P.brass[0], true);
    showToastFor(state, p, 'БУРБОН ПОЛНОСТЬЮ ВОССТАНОВИЛ СИЛЫ!', 1.4);
  }

  function cancelBandaging(state, reason, player) {
    const p = resolvePlayer(state, player);
    if (!p || !p.bandaging) return;
    p.bandaging = false;
    p.bandageTimer = 0;
    if (reason) showToastFor(state, p, reason, 1.2);
  }

  function completeBandaging(state, player) {
    const p = resolvePlayer(state, player);
    const P = getPal();
    p.bandaging = false;
    p.bandageTimer = 0;
    p.bandages = Math.max(0, (p.bandages || 0) - 1);
    p.bleeding = false;
    p.critical = false;
    p.concussion = 0;
    p.indoorRingTimer = 0;
    if (p.hp < 55) {
      p.hp = Math.min(55, p.hp + 25);
    }
    if (isLocalPlayer(state, p) && G.AUDIO.setConcussion) G.AUDIO.setConcussion(0);
    if (G.AUDIO.playBandage) G.AUDIO.playBandage();
    pushNetEvent(state, { kind: 'bandage', x: p.x, y: p.y, playerId: p.id });
    spawnFloatText(state, p.x, p.y - 12, 'ПЕРЕВЯЗАН', P.foliage[0], true);
    showToastFor(state, p, 'КРОВОТЕЧЕНИЕ ОСТАНОВЛЕНО', 1.3);
  }

  function tryUseBandage(state, player) {
    const p = resolvePlayer(state, player);
    if (!p || p.dead || p.rolling || p.drinking) return false;
    if (p.bandaging) return false;
    if ((p.bandages || 0) <= 0) {
      showToastFor(state, p, 'НЕТ БИНТОВ (АПТЕЧКА В САЛУНЕ)', 1.2);
      return false;
    }
    if (!p.bleeding && !p.critical && (p.concussion || 0) <= 0.08 && p.hp >= (p.maxHp || 100)) {
      showToastFor(state, p, 'ПЕРЕВЯЗКА НЕ ТРЕБУЕТСЯ', 0.9);
      return false;
    }
    const ws = getWState(state, p);
    if (ws.reloading) closeReload(state, p);
    interruptSmoking(state, p);
    p.bandaging = true;
    p.bandageTimer = 0;
    p.bandageDur = 2.5;
    if (G.AUDIO.playBandage) G.AUDIO.playBandage();
    showToastFor(state, p, 'ПЕРЕВЯЗКА... (НЕ ДВИГАЙСЯ БЫСТРО)', 1.2);
    return true;
  }

  function startRoll(state, world, player, inputOverride) {
    const p = resolvePlayer(state, player);
    interruptSmoking(state, p);
    if (p.drinking) cancelDrinking(state, 'БУРБОН ПОСТАВЛЕН НА СТОЛ', p);
    if (p.bandaging) cancelBandaging(state, 'ПЕРЕВЯЗКА СБИТА!', p);
    if (p.rolling || p.rollCooldown > 0) return false;

    const ws = getWState(state, p);
    if (ws.reloading) closeReload(state, p);
    ws.daPullTimer = 0;

    let dx = 0;
    let dy = 0;
    const keys = (inputOverride && inputOverride.keys) || (p.input && !isLocalPlayer(state, p) ? p.input.keys : state.input.keys) || {};
    if (keys.KeyW || keys.ArrowUp) dy -= 1;
    if (keys.KeyS || keys.ArrowDown) dy += 1;
    if (keys.KeyA || keys.ArrowLeft) dx -= 1;
    if (keys.KeyD || keys.ArrowRight) dx += 1;

    if (dx === 0 && dy === 0) {
      dx = Math.cos(p.aimAngle);
      dy = Math.sin(p.aimAngle);
    } else {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    }

    exitCover(state, p);
    p.rolling = true;
    p.rollTimer = G.CFG.rollDur;
    p.rollCooldown = G.CFG.rollCooldown;
    p.rollDx = dx;
    p.rollDy = dy;
    p.rollMidDust = false;

    G.AUDIO.playRoll();
    pushNetEvent(state, { kind: 'roll', x: p.x, y: p.y, playerId: p.id });
    const P = getPal();
    const isWood = world.getSurfaceAt(p.x, p.y) === 'wood';
    spawnParticles(state, p.x, p.y, 11, {
      baseAngle: Math.atan2(-dy, -dx),
      spread: 0.78,
      minSpeed: 18,
      maxSpeed: 58,
      minLife: 0.24,
      maxLife: 0.52,
      minSize: 1.8,
      maxSize: 3.8,
      grow: 2.5,
      colors: isWood ? [P.woodWarm[1], P.woodWarm[2]] : [P.dirt[0], P.dirt[1], P.dirt[2]],
      alpha: 0.55,
      kind: 'smoke'
    });
    return true;
  }

  function switchWeapon(state, idx, player) {
    if (idx < 0 || idx >= G.WEAPONS.length) return;
    const p = resolvePlayer(state, player);
    if (!p || p.drinking) return;
    interruptSmoking(state, p);
    if (p.weaponIdx === idx) return;

    const curWs = getWState(state, p);
    if (curWs.reloading) closeReload(state, p);
    curWs.daPullTimer = 0;

    p.weaponIdx = idx;
    p.recoilKickAnim = 0;
    p.aimVel *= 0.35;
    p.bloom = Math.min(p.bloom, 0.06);
    if (isLocalPlayer(state, p)) G.AUDIO.playCock('sa');
  }

  // ==================== ИММЕРСИВНАЯ ПЕРЕЗАРЯДКА БАРАБАНА / ОКНА ВИНЧЕСТЕРА ====================

  function openReload(state, world, player) {
    const p = resolvePlayer(state, player);
    interruptSmoking(state, p);
    if ((p.stunTimer || 0) > 0 || p.rolling || p.bandaging || p.drinking || (isLocalPlayer(state, p) && state.editor && state.editor.active)) return;
    const w = getWeapon(state, p);
    const ws = getWState(state, p);
    ensureChambers(w, ws);

    if (ws.reloading) {
      insertOneRound(state, world, undefined, p);
      return;
    }

    if (ws.ammo >= w.capacity && !ws.chamberSpent) {
      showToastFor(state, p, 'ПОЛНЫЙ БОЕЗАПАС', 0.85);
      return;
    }

    ws.daPullTimer = 0;
    ws.cockTimer = 0;
    ws.reloading = true;
    ws.insertAnim = 0;
    ws.reloadOpenFrac = 0;

    const isCylinder = w.uiShape === 'cylinder';
    if (isLocalPlayer(state, p)) G.AUDIO.playReloadOpen(isCylinder);

    if (isCylinder) {
      // Револьвер: откидываем барабан и вытряхиваем стреляные гильзы из конкретных камор
      const pos = getHandOrigin(p);
      const ejectedSlots = [];
      for (let i = 0; i < ws.chambers.length; i++) {
        if (ws.chambers[i] === 'spent') {
          ws.chambers[i] = 'empty';
          ejectedSlots.push(i);
          const dropAngle = p.aimAngle + Math.PI * 0.65 + G.MATH.rand(-0.5, 0.5);
          spawnShell(state, pos.x, pos.y, dropAngle, 0.65);
        }
      }
      syncChamberCounts(w, ws);
      if (w.action === 'sa') ws.cocked = false;

      if (isLocalPlayer(state, p)) {
        pushReloadEvent(state, {
          type: 'open_cylinder',
          weaponId: w.id,
          ejectedSlots: ejectedSlots
        });
      }
    } else if (isLocalPlayer(state, p)) {
      pushReloadEvent(state, {
        type: 'open_tube',
        weaponId: w.id
      });
    }
  }

  // Вставка одного патрона: если передан chamberIdx (клик по конкретной каморе), вставляем именно туда
  function insertOneRound(state, world, chamberIdx, player) {
    const p = resolvePlayer(state, player);
    const w = getWeapon(state, p);
    const ws = getWState(state, p);
    if (!ws.reloading) return false;
    if (ws.insertAnim > 0.055) return false;

    if (w.uiShape === 'cylinder') {
      ensureChambers(w, ws);
      let targetIdx = -1;

      if (typeof chamberIdx === 'number' && chamberIdx >= 0 && chamberIdx < ws.chambers.length) {
        if (ws.chambers[chamberIdx] === 'empty') {
          targetIdx = chamberIdx;
        } else {
          return false; // в этой каморе уже есть патрон
        }
      } else {
        // Клавиша R или кнопка: ищем ближайшую пустую камору по кругу
        for (let step = 0; step < ws.chambers.length; step++) {
          const idx = (ws.cylinderIdx + step) % ws.chambers.length;
          if (ws.chambers[idx] === 'empty') {
            targetIdx = idx;
            break;
          }
        }
      }

      if (targetIdx === -1) {
        closeReload(state, p);
        return false;
      }

      ws.chambers[targetIdx] = 'live';
      ws.cylinderIdx = (targetIdx + 1) % ws.chambers.length;
      syncChamberCounts(w, ws);
      ws.insertAnim = w.reloadOneTime;
      if (isLocalPlayer(state, p)) {
        G.AUDIO.playReloadInsert(true);
        pushReloadEvent(state, {
          type: 'insert_cylinder',
          weaponId: w.id,
          slotIdx: targetIdx
        });
      }

      if (ws.ammo >= w.capacity) {
        ws.autoClosePending = true;
      }
      return true;
    }

    // Винчестер: вставка в трубчатый магазин через боковое окно
    if (ws.ammo >= w.capacity) {
      closeReload(state, p);
      return false;
    }

    ws.ammo += 1;
    ws.insertAnim = w.reloadOneTime;
    if (isLocalPlayer(state, p)) {
      G.AUDIO.playReloadInsert(false);
      pushReloadEvent(state, {
        type: 'insert_tube',
        weaponId: w.id,
        ammo: ws.ammo
      });
    }

    if (ws.ammo >= w.capacity) {
      ws.autoClosePending = true;
    }
    return true;
  }

  function closeReload(state, player) {
    const p = resolvePlayer(state, player);
    const w = getWeapon(state, p);
    const ws = getWState(state, p);
    if (!ws.reloading) return;

    ws.reloading = false;
    ws.insertAnim = 0;
    ws.autoClosePending = false;
    ws.reloadOpenFrac = 0;

    const isCylinder = w.uiShape === 'cylinder';
    if (isLocalPlayer(state, p)) G.AUDIO.playReloadClose(isCylinder);

    if (isCylinder) {
      ensureChambers(w, ws);
      // Подводим первую живую камору под боёк при закрытии барабана
      for (let i = 0; i < ws.chambers.length; i++) {
        if (ws.chambers[i] === 'live') {
          ws.cylinderIdx = i;
          break;
        }
      }
    }

    if (isLocalPlayer(state, p)) {
      pushReloadEvent(state, {
        type: 'close',
        weaponId: w.id
      });
    }

    if (w.action === 'da') {
      ws.cocked = true;
    } else if (!ws.cocked && ws.ammo > 0) {
      const lbl = G.keyLabel(G.CFG.keys.cock);
      showToastFor(state, p, w.action === 'lever' ? `ДЁРНИ СКОБУ [${lbl}]` : `ВЗВЕДИ КУРОК [${lbl}]`, 1.0);
    }
  }

  function tryCock(state, world, player) {
    const p = resolvePlayer(state, player);
    interruptSmoking(state, p);
    if ((p.stunTimer || 0) > 0 || p.rolling) return;
    const w = getWeapon(state, p);
    const ws = getWState(state, p);

    if (ws.reloading) {
      closeReload(state, p);
    }

    if (w.action === 'da') {
      showToastFor(state, p, 'ДВОЙНОЕ ДЕЙСТВИЕ — ВЗВОД НЕ НУЖЕН', 0.9);
      return;
    }

    if (ws.cockTimer > 0) return;

    if (w.action === 'sa') {
      if (ws.cocked) return;
      if (ws.ammo <= 0) {
        if (isLocalPlayer(state, p)) G.AUDIO.playDryClick();
        pushNetEvent(state, { kind: 'dry', playerId: p.id });
        showToastFor(state, p, 'БАРАБАН ПУСТ — ЖМИ [R]', 1.0);
        return;
      }
      ws.cockDuration = w.cockTime;
      ws.cockTimer = w.cockTime;
      if (isLocalPlayer(state, p)) G.AUDIO.playCock('sa');
      pushNetEvent(state, { kind: 'cock', action: 'sa', playerId: p.id });
      return;
    }

    if (w.action === 'lever') {
      if (ws.cocked && !ws.chamberSpent) return;
      if (ws.ammo <= 0 && !ws.chamberSpent) {
        if (isLocalPlayer(state, p)) G.AUDIO.playDryClick();
        pushNetEvent(state, { kind: 'dry', playerId: p.id });
        showToastFor(state, p, 'МАГАЗИН ПУСТ — ЖМИ [R]', 1.0);
        return;
      }
      ws.cockDuration = w.cockTime;
      ws.cockTimer = w.cockTime;
      ws.leverEjected = false;
      if (isLocalPlayer(state, p)) G.AUDIO.playCock('lever');
      pushNetEvent(state, { kind: 'cock', action: 'lever', playerId: p.id });
    }
  }

  const _doorSegBuf = [];
  const _losQueryBuf = [];
  const _bulletQueryBuf = [];

  function getDoorSegments(world) {
    if (!world || !world.doors) {
      _doorSegBuf.length = 0;
      return _doorSegBuf;
    }
    const doors = world.doors;
    _doorSegBuf.length = doors.length;
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      const ang = d.baseAngle + d.angle;
      const x1 = d.hingeX;
      const y1 = d.hingeY;
      const x2 = x1 + Math.cos(ang) * d.len;
      const y2 = y1 + Math.sin(ang) * d.len;
      let seg = _doorSegBuf[i];
      if (!seg) {
        seg = {
          id: 'door_' + i,
          mat: 'wood',
          type: 'door',
          high: false,
          doorIdx: i,
          door: d,
          x1: x1,
          y1: y1,
          x2: x2,
          y2: y2,
          minX: 0,
          maxX: 0,
          minY: 0,
          maxY: 0
        };
        _doorSegBuf[i] = seg;
      } else {
        seg.door = d;
        seg.x1 = x1;
        seg.y1 = y1;
        seg.x2 = x2;
        seg.y2 = y2;
      }
      seg.minX = x1 < x2 ? x1 : x2;
      seg.maxX = x1 > x2 ? x1 : x2;
      seg.minY = y1 < y2 ? y1 : y2;
      seg.maxY = y1 > y2 ? y1 : y2;
    }
    return _doorSegBuf;
  }

  function rayExitRect(hx, hy, dx, dy, rect) {
    if (!rect) return { x: hx + dx * 6, y: hy + dy * 6 };
    const pad = 1.5;
    let txMax = Infinity;
    let tyMax = Infinity;
    if (dx > 1e-5) txMax = (rect.x + rect.w + pad - hx) / dx;
    else if (dx < -1e-5) txMax = (rect.x - pad - hx) / dx;
    if (dy > 1e-5) tyMax = (rect.y + rect.h + pad - hy) / dy;
    else if (dy < -1e-5) tyMax = (rect.y - pad - hy) / dy;
    const tOut = G.MATH.clamp(Math.min(txMax, tyMax), 3, 64);
    return { x: hx + dx * tOut, y: hy + dy * tOut };
  }

  function spawnIndoorGunSmoke(state, world, x, y, weaponId, angle) {
    if (!world || !world.getIndoorZoneAt) return;
    const zone = world.getIndoorZoneAt(x, y);
    if (!zone) return;
    if (!state.gunSmokeClouds) state.gunSmokeClouds = [];
    if (!state.smokeFlashes) state.smokeFlashes = [];

    const isWalker = weaponId === 'walker';
    const isWin = weaponId === 'winchester';
    const count = isWalker ? 3 : isWin ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const life = isWalker ? G.MATH.rand(6.2, 8.0) : isWin ? G.MATH.rand(5.2, 6.8) : G.MATH.rand(4.8, 6.0);
      const ang = angle + G.MATH.rand(-0.55, 0.55);
      const spd = G.MATH.rand(12, isWalker ? 36 : 26);
      state.gunSmokeClouds.push({
        x: x + Math.cos(ang) * (4 + i * 5),
        y: y + Math.sin(ang) * (4 + i * 5),
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        r: isWalker ? 14 : 11,
        maxR: isWalker ? G.MATH.rand(46, 62) : isWin ? G.MATH.rand(36, 48) : G.MATH.rand(30, 40),
        density: isWalker ? 0.92 : isWin ? 0.78 : 0.66,
        life: life,
        maxLife: life,
        zoneId: zone.id,
        bounds: { x: zone.x + 18, y: zone.y + 18, x2: zone.x + zone.w - 18, y2: zone.y + zone.h - 18 }
      });
    }
    if (state.gunSmokeClouds.length > 36) {
      state.gunSmokeClouds.splice(0, state.gunSmokeClouds.length - 36);
    }

    // Вспышка выстрела в помещении подсвечивает пространство и силуэты в дыму
    state.smokeFlashes.push({
      x: x,
      y: y,
      r: isWalker ? 74 : isWin ? 64 : 52,
      life: 0.14,
      maxLife: 0.14,
      zoneId: zone.id
    });
  }

  function updateGunSmokeClouds(state, world, dt) {
    if (state.gunSmokeClouds) {
      for (let i = state.gunSmokeClouds.length - 1; i >= 0; i--) {
        const c = state.gunSmokeClouds[i];
        c.life -= dt;
        if (c.life <= 0) {
          state.gunSmokeClouds.splice(i, 1);
          continue;
        }
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.vx *= Math.exp(-1.4 * dt);
        c.vy *= Math.exp(-1.4 * dt);
        if (c.bounds) {
          if (c.x < c.bounds.x) { c.x = c.bounds.x; c.vx = Math.abs(c.vx) * 0.3; }
          if (c.x > c.bounds.x2) { c.x = c.bounds.x2; c.vx = -Math.abs(c.vx) * 0.3; }
          if (c.y < c.bounds.y) { c.y = c.bounds.y; c.vy = Math.abs(c.vy) * 0.3; }
          if (c.y > c.bounds.y2) { c.y = c.bounds.y2; c.vy = -Math.abs(c.vy) * 0.3; }
        }
        const growRate = (c.maxR - c.r) * 0.65;
        c.r = Math.min(c.maxR, c.r + Math.max(2.5, growRate) * dt);
      }
    }
    if (state.smokeFlashes) {
      for (let i = state.smokeFlashes.length - 1; i >= 0; i--) {
        state.smokeFlashes[i].life -= dt;
        if (state.smokeFlashes[i].life <= 0) state.smokeFlashes.splice(i, 1);
      }
    }
  }

  function getSmokeOcclusionAlongRay(x1, y1, x2, y2, state) {
    const clouds = state && state.gunSmokeClouds;
    if (!clouds || !clouds.length) return 0;
    const vx = x2 - x1;
    const vy = y2 - y1;
    const len2 = vx * vx + vy * vy;
    if (len2 < 1) return 0;
    let occ = 0;
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      const lifeFrac = G.MATH.clamp(c.life / c.maxLife, 0, 1);
      if (lifeFrac <= 0.08) continue;
      const t = G.MATH.clamp(((c.x - x1) * vx + (c.y - y1) * vy) / len2, 0, 1);
      const px = x1 + vx * t;
      const py = y1 + vy * t;
      const d = Math.hypot(px - c.x, py - c.y);
      if (d < c.r) {
        const core = 1 - d / c.r;
        occ += c.density * Math.min(1, lifeFrac * 1.6) * (0.45 + 0.55 * core);
      }
    }
    return occ;
  }

  function hasHighWallBetween(x1, y1, x2, y2, world) {
    if (!world) return false;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len <= 8) return false;
    const ndx = dx / len;
    const ndy = dy / len;
    const rayLen = len - 6;
    const ex = x1 + ndx * rayLen;
    const ey = y1 + ndy * rayLen;
    const rMinX = x1 < ex ? x1 : ex;
    const rMaxX = x1 > ex ? x1 : ex;
    const rMinY = y1 < ey ? y1 : ey;
    const rMaxY = y1 > ey ? y1 : ey;
    const segs = world.queryWallSegments
      ? world.queryWallSegments(rMinX, rMinY, rMaxX, rMaxY, _losQueryBuf)
      : world.wallSegments;
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (!seg.high) continue;
      if (seg.maxX !== undefined && (seg.maxX < rMinX || seg.minX > rMaxX || seg.maxY < rMinY || seg.minY > rMaxY)) {
        continue;
      }
      if (G.MATH.raySegment(x1, y1, ndx, ndy, rayLen, seg.x1, seg.y1, seg.x2, seg.y2)) {
        return true;
      }
    }
    return false;
  }

  function notifyBanditsOfShot(state, world, shotX, shotY, echoHits, shooter) {
    if (!world || !world.targets) return;
    const sx = shooter ? shooter.x : shotX;
    const sy = shooter ? shooter.y : shotY;

    for (let i = 0; i < world.targets.length; i++) {
      const t = world.targets[i];
      if (t.kind !== 'bandit' || !t.alive) continue;
      if (t.aiState === 'flee' || t.aiState === 'no_ammo_retreat') {
        t.aimTimer = 0;
        t.telegraphFrac = 0;
        t.aimState = t.aiState;
        continue;
      }
      if (t.aiState === 'combat') continue;

      const dShot = G.MATH.dist(shotX, shotY, t.x, t.y);
      if (dShot > 620) continue;

      const blocked = hasHighWallBetween(shotX, shotY, t.x, t.y, world);
      if (!blocked || dShot < 120) {
        t.aiState = 'alert';
        t.alertTimer = 3.5;
        t.alertAngle = Math.atan2(sy - t.y, sx - t.x);
        t.lastKnownX = sx;
        t.lastKnownY = sy;
        t.distractedByEcho = false;
        continue;
      }

      // Стрелок скрыт высокой преградой: ищем слышимое ботом отражение эха (>= 45 px от стрелка)
      let bestEcho = null;
      let bestEx = 0;
      let bestEy = 0;
      let bestScore = Infinity;
      if (echoHits && echoHits.length > 0) {
        for (let hi = 0; hi < echoHits.length; hi++) {
          const h = echoHits[hi];
          if (G.MATH.dist(h.x, h.y, shotX, shotY) < 45) continue;
          const ex = h.x - h.dx * 14;
          const ey = h.y - h.dy * 14;
          const dBot = G.MATH.dist(t.x, t.y, ex, ey);
          if (dBot > 580) continue;
          if (hasHighWallBetween(t.x, t.y, ex, ey, world)) continue;
          const matBonus = h.mat === 'rock' ? 45 : (h.mat === 'wood' ? 12 : 0);
          const sc = dBot - matBonus;
          if (sc < bestScore) {
            bestScore = sc;
            bestEcho = h;
            bestEx = ex;
            bestEy = ey;
          }
        }
      }

      if (bestEcho) {
        bestEcho.distracted = true;
        if (state && state.debugRays && bestEcho.rayIdx !== undefined && state.debugRays[bestEcho.rayIdx]) {
          state.debugRays[bestEcho.rayIdx].echoDistracted = true;
        }
        t.aiState = 'search';
        t.searchTimer = 4.6 + Math.random() * 1.6;
        t.searchRole = 'hunt';
        t.lastKnownX = bestEx;
        t.lastKnownY = bestEy;
        t.alertAngle = Math.atan2(bestEy - t.y, bestEx - t.x);
        t.distractedByEcho = true;
      } else if (dShot < 360) {
        t.aiState = 'alert';
        t.alertTimer = 2.6;
        t.alertAngle = Math.atan2(sy - t.y, sx - t.x) + G.MATH.rand(-0.45, 0.45);
        t.distractedByEcho = false;
      }
    }
  }

  function executeShot(state, world, player) {
    const p = resolvePlayer(state, player);
    const w = getWeapon(state, p);
    const ws = getWState(state, p);

    if (w.uiShape === 'cylinder') {
      ensureChambers(w, ws);
      // Находим текущую или ближайшую живую камору и помечаем её стреляной
      let firedIdx = -1;
      for (let step = 0; step < ws.chambers.length; step++) {
        const idx = (ws.cylinderIdx + step) % ws.chambers.length;
        if (ws.chambers[idx] === 'live') {
          firedIdx = idx;
          break;
        }
      }
      if (firedIdx !== -1) {
        ws.chambers[firedIdx] = 'spent';
        ws.cylinderIdx = (firedIdx + 1) % ws.chambers.length;
      }
      syncChamberCounts(w, ws);
      if (w.action === 'sa') ws.cocked = false;
      else if (w.action === 'da') ws.daCooldownTimer = w.daCooldown;
    } else {
      ws.ammo = Math.max(0, ws.ammo - 1);
      if (w.action === 'lever') {
        ws.cocked = false;
        ws.chamberSpent = true;
        ws.leverEjected = false;
      }
    }

    const muzzle = getMuzzlePos(state, p);
    const tri = Math.random() + Math.random() - 1;
    const uni = Math.random() * 2 - 1;
    const randSpread = (tri * 0.62 + uni * 0.38) * p.spread;
    const shotAngle = p.aimAngle + randSpread;
    const dx = Math.cos(shotAngle);
    const dy = Math.sin(shotAngle);

    const originCoverId = (p.inCover && p.peeking && p.coverObj && !p.coverObj.high) ? p.coverObj.id : null;

    state.bullets.push({
      owner: 'player',
      ownerType: 'player',
      ownerId: p.id,
      x: muzzle.x,
      y: muzzle.y,
      px: muzzle.x,
      py: muzzle.y,
      startX: muzzle.x,
      startY: muzzle.y,
      dx: dx,
      dy: dy,
      speed: w.bulletSpeed,
      damage: w.damage,
      traveled: 0,
      falloffStart: w.falloffStart || 220,
      falloffEnd: w.falloffEnd || 460,
      falloffMinMult: w.falloffMinMult !== undefined ? w.falloffMinMult : 0.7,
      weaponId: w.id,
      maxPenetrations: w.penetration || 0,
      penetrations: 0,
      penetratedIds: [],
      ricochets: 0,
      ricocheted: false,
      canHitOwner: false,
      justRicochetedId: null,
      originCoverId: originCoverId,
      life: 1.2
    });

    spawnIndoorGunSmoke(state, world, muzzle.x, muzzle.y, w.id, shotAngle);
    if ((w.id === 'walker' || w.id === 'winchester') && world.getIndoorZoneAt && world.getIndoorZoneAt(muzzle.x, muzzle.y)) {
      p.indoorRingTimer = Math.max(p.indoorRingTimer || 0, w.id === 'walker' ? 1.0 : 0.7);
    }

    const recoilMult = G.CFG.phys.recoil;
    const dir = (Math.random() < 0.5 ? -1 : 1) * G.MATH.rand(0.75, 1.25);
    p.aimAngle = G.MATH.normAngle(p.aimAngle + dir * w.recoilKick * recoilMult * 0.42);
    p.aimVel += dir * w.recoilKick * recoilMult * 16.0;
    const maxSp = w.maxSpread || 0.30;
    p.bloom = Math.min(maxSp, p.bloom + w.bloomPerShot * recoilMult);
    p.recoilKickAnim = 1.0;
    p.flashTimer = 0.06;

    if (isLocalPlayer(state, p)) {
      state.camera.shakeMag = Math.max(state.camera.shakeMag, w.recoilPush * recoilMult);
      state.camera.x -= dx * w.recoilPush * 0.85;
      state.camera.y -= dy * w.recoilPush * 0.85;
    }

    spawnParticles(state, muzzle.x, muzzle.y, w.id === 'walker' ? 9 : 7, {
      baseAngle: shotAngle,
      spread: 0.45,
      minSpeed: 75,
      maxSpeed: 195,
      minLife: 0.06,
      maxLife: 0.14,
      minSize: 1.2,
      maxSize: 2.4,
      drag: 9,
      colors: ['#f5e3ab', '#e3c068', '#c96232'],
      kind: 'spark'
    });

    const smokeCount = w.id === 'walker' ? 14 : w.id === 'winchester' ? 9 : 6;
    spawnParticles(state, muzzle.x, muzzle.y, smokeCount, {
      baseAngle: shotAngle,
      spread: 0.60,
      minSpeed: 15,
      maxSpeed: w.id === 'walker' ? 72 : 52,
      minLife: 0.50,
      maxLife: w.id === 'walker' ? 1.35 : 0.88,
      minSize: 2.2,
      maxSize: w.id === 'walker' ? 5.2 : 4.0,
      grow: 4.5,
      drag: 2.4,
      colors: ['#cfc8b6', '#a8a293', '#7e7c73'],
      alpha: w.id === 'walker' ? 0.62 : 0.45,
      kind: 'smoke'
    });

    const containers = world.waterContainers || world.waterBarrels;
    if (containers) {
      for (let i = 0; i < containers.length; i++) {
        const b = containers[i];
        const bx = b.x + b.w * 0.5;
        const by = b.y + b.h * 0.5;
        const d = G.MATH.dist(muzzle.x, muzzle.y, bx, by);
        if (d < 95) {
          addWaterRipple(state, b.id, bx, by, b.w * 0.44, 0.55 * (1 - d / 95));
        }
      }
    }

    // Акустическая реакция бандитов на выстрел и отражения эха
    const echoRes = (G.AUDIO && G.AUDIO.computeAcousticEcho)
      ? G.AUDIO.computeAcousticEcho(muzzle.x, muzzle.y, world, state)
      : null;
    if (echoRes && isLocalPlayer(state, p)) {
      state.debugRays = echoRes.raysVis;
      state.echoDesc = echoRes.envLabel;
    }
    notifyBanditsOfShot(state, world, muzzle.x, muzzle.y, echoRes ? echoRes.hits : null, p);

    const inZoneShot = world.getIndoorZoneAt && world.getIndoorZoneAt(muzzle.x, muzzle.y);
    if (world.flushBirdFlocksNear) {
      world.flushBirdFlocksNear(muzzle.x, muzzle.y, inZoneShot ? 190 : 300, state);
    }
    if (world.scareCrowsNear) {
      world.scareCrowsNear(muzzle.x, muzzle.y, inZoneShot ? 210 : 320, state);
    }
    if (world.scareSheepNear) {
      world.scareSheepNear(muzzle.x, muzzle.y, inZoneShot ? 160 : 250, state);
    }
    if (world.igniteOilPuddlesNear) {
      world.igniteOilPuddlesNear(muzzle.x, muzzle.y, 125, state);
    }
    if (p.mountedHorse && world.horse && world.horse.riderId === p.id) {
      scareHorse(state, world, muzzle.x, muzzle.y, 16, true);
    } else {
      scareHorse(state, world, muzzle.x, muzzle.y, 22, false);
    }

    const listener = resolvePlayer(state);
    G.AUDIO.playShot(w, muzzle.x, muzzle.y, world, state, {
      skipHudUpdate: !isLocalPlayer(state, p),
      listenerX: listener ? listener.x : muzzle.x,
      listenerY: listener ? listener.y : muzzle.y,
      precomputedEcho: echoRes
    });
    pushNetEvent(state, { kind: 'shot', soundType: w.soundType || w.id, x: muzzle.x, y: muzzle.y, ang: shotAngle, weaponId: w.id, playerId: p.id });
  }

  function tryFire(state, world, player) {
    const p = resolvePlayer(state, player);
    if (!p || p.dead) return;
    interruptSmoking(state, p);
    const w = getWeapon(state, p);
    const ws = getWState(state, p);

    if ((p.stunTimer || 0) > 0 || p.rolling || p.bandaging || p.drinking || (isLocalPlayer(state, p) && state.editor && state.editor.active)) return;

    if (ws.reloading) {
      closeReload(state, p);
      return;
    }

    if (p.inCover && !p.peeking) {
      showToastFor(state, p, 'ЗАЖМИ ПКМ, ЧТОБЫ ВЫГЛЯНУТЬ', 1.0);
      return;
    }

    if (p.wallBlocked) {
      if (isLocalPlayer(state, p)) G.AUDIO.playDryClick();
      pushNetEvent(state, { kind: 'dry', playerId: p.id });
      showToastFor(state, p, 'УПОР В СТЕНУ — СТВОЛ ПОДНЯТ ВВЕРХ', 1.1);
      return;
    }

    if (ws.cockTimer > 0) return;

    if (w.action === 'da') {
      if (ws.daCooldownTimer > 0 || ws.daPullTimer > 0) return;
      if (ws.ammo <= 0) {
        if (isLocalPlayer(state, p)) G.AUDIO.playDryClick();
        pushNetEvent(state, { kind: 'dry', playerId: p.id });
        showToastFor(state, p, 'БАРАБАН ПУСТ — ЖМИ [R]', 1.0);
        return;
      }
      ws.daPullTimer = w.triggerPullTime;
      if (isLocalPlayer(state, p)) G.AUDIO.playTriggerTension();
      return;
    }

    if (!ws.cocked) {
      if (isLocalPlayer(state, p)) G.AUDIO.playDryClick();
      pushNetEvent(state, { kind: 'dry', playerId: p.id });
      const lbl = G.keyLabel(G.CFG.keys.cock);
      if (ws.ammo <= 0 && !ws.chamberSpent) {
        showToastFor(state, p, 'ПУСТО — ЖМИ [R] ДЛЯ ЗАРЯДКИ', 1.05);
      } else {
        showToastFor(state, p, w.action === 'lever' ? `ДЁРНИ СКОБУ [${lbl}]` : `ВЗВЕДИ КУРОК [${lbl}]`, 1.05);
      }
      return;
    }

    if (ws.ammo <= 0) {
      ws.cocked = false;
      if (isLocalPlayer(state, p)) G.AUDIO.playDryClick();
      pushNetEvent(state, { kind: 'dry', playerId: p.id });
      showToastFor(state, p, 'ПУСТО — ЖМИ [R]', 1.0);
      return;
    }

    executeShot(state, world, p);
  }

  function isInteractableAvailable(state, item, world) {
    if (!item) return false;
    if (item.requiresUnlock && world && world.isEntityActive && !world.isEntityActive(item, state)) {
      return false;
    }
    if (item.kind === 'bourbon') {
      return !!(state.saloonProps && state.saloonProps.bourbonAvailable);
    }
    return true;
  }

  function findNearestInteractable(state, world, player) {
    const p = resolvePlayer(state, player);
    if (!world || !state || !p || p.dead) return null;
    if (p.mountedHorse && world.horse && world.horse.state !== 'dead' && world.horse.riderId === p.id) {
      return { id: 'horse_1', kind: 'horse_dismount', x: world.horse.x, y: world.horse.y, label: 'СЛЕЗТЬ С ЛОШАДИ', r: 48 };
    }
    let best = null;
    let bestDist = Infinity;
    const list = world.interactables || [];
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      if (!isInteractableAvailable(state, it, world)) continue;
      const rad = it.r || 42;
      const d = G.MATH.dist(p.x, p.y, it.x, it.y);
      if (d <= rad && d < bestDist) {
        bestDist = d;
        best = it;
      }
    }
    const hr = world.horse;
    if (!p.mountedHorse && hr && hr.state !== 'dead' && hr.state !== 'bucking' && hr.state !== 'stampede' && !hr.riderId) {
      const dh = G.MATH.dist(p.x, p.y, hr.x, hr.y);
      if (dh <= 44 && dh < bestDist) {
        best = { id: hr.id || 'horse_1', kind: 'horse', x: hr.x, y: hr.y, label: 'СЕСТЬ НА ЛОШАДЬ', r: 44 };
      }
    }
    return best;
  }

  function mountHorse(state, world, player) {
    const p = resolvePlayer(state, player);
    const hr = world && world.horse;
    if (!p || p.dead || !hr || hr.state === 'dead') return false;
    if ((p.stunTimer || 0) > 0 || p.rolling || p.bandaging || p.drinking) return false;
    if (hr.riderId && hr.riderId !== p.id) {
      showToastFor(state, p, 'ЛОШАДЬ УЖЕ ЗАНЯТА', 1.0);
      return false;
    }
    if (hr.state === 'bucking' || hr.state === 'stampede') {
      showToastFor(state, p, 'ЛОШАДЬ ВЗБЕСИЛАСЬ!', 1.0);
      return false;
    }
    exitCover(state, p);
    interruptSmoking(state, p);
    p.mountedHorse = true;
    p.vx = 0;
    p.vy = 0;
    p.x = hr.x;
    p.y = hr.y;
    hr.tied = false;
    hr.riderId = p.id;
    hr.state = 'ridden';
    if (G.AUDIO && G.AUDIO.playHoofbeat) G.AUDIO.playHoofbeat(world.getSurfaceAt(hr.x, hr.y));
    showToastFor(state, p, 'ВЕРХОМ • [WASD] ГАЛОП • [E] СЛЕЗТЬ', 1.6);
    return true;
  }

  function dismountHorse(state, world, player, thrown, throwAng) {
    const p = resolvePlayer(state, player);
    const hr = world && world.horse;
    if (!p || !p.mountedHorse) return false;
    p.mountedHorse = false;
    const baseAng = throwAng !== undefined ? throwAng : ((hr ? hr.angle : 0) - Math.PI * 0.5);
    const distOff = thrown ? 44 : 18;
    if (hr) {
      p.x = G.MATH.clamp(hr.x + Math.cos(baseAng) * distOff, 34, world.width - 34);
      p.y = G.MATH.clamp(hr.y + Math.sin(baseAng) * distOff, 26, world.height - 26);
      if (hr.riderId === p.id) hr.riderId = null;
      if (hr.state === 'ridden') {
        hr.state = hr.tied ? 'tied' : 'idle';
        hr.vx = 0;
        hr.vy = 0;
        hr.speed = 0;
      }
    }
    resolveCircleSolids(p, G.CFG.playerRadius + 1, world, 3);
    if (thrown) {
      if (!isPlayerGod(state, p)) {
        p.stunTimer = Math.max(p.stunTimer || 0, 0.6);
      }
      p.vx = 0;
      p.vy = 0;
      spawnFloatText(state, p.x, p.y - 12, 'СБРОШЕН!', getPal().barnRed ? getPal().barnRed[0] : '#a83c2e', true);
    } else {
      showToastFor(state, p, 'СПЕШИЛСЯ', 0.9);
    }
    return true;
  }

  function scareHorse(state, world, sx, sy, amount, isRiderShot) {
    const hr = world && world.horse;
    if (!hr || hr.state === 'dead') return;
    const dist = G.MATH.dist(sx, sy, hr.x, hr.y);
    const maxRange = isRiderShot ? 60 : ((world.getIndoorZoneAt && world.getIndoorZoneAt(sx, sy)) ? 170 : 270);
    if (dist > maxRange) return;
    const falloff = isRiderShot ? 1.0 : G.MATH.clamp(1.15 - dist / (maxRange * 1.15), 0.35, 1.0);
    hr.calm = Math.max(0, (hr.calm !== undefined ? hr.calm : 100) - amount * falloff);
    hr.calmRegenDelay = 3.0;
    const P = getPal();

    if (hr.calm <= 45 && (hr._neighCd || 0) <= 0) {
      hr._neighCd = 1.6;
      if (G.AUDIO && G.AUDIO.playHorseNeigh) G.AUDIO.playHorseNeigh();
    }

    if (hr.calm <= 0) {
      if (hr.state === 'tied' || hr.state === 'idle' || hr.state === 'grazing') {
        hr.tied = false;
        hr.state = 'stampede';
        hr.stampedeTimer = 3.6;
        hr.stampedeAngle = Math.atan2(hr.y - sy, hr.x - sx);
        hr._neighCd = 2.0;
        if (G.AUDIO && G.AUDIO.playHorseNeigh) G.AUDIO.playHorseNeigh();
        if (state) spawnFloatText(state, hr.x, hr.y - 14, 'КОНЬ ПОНЁС!', (P.brass && P.brass[0]) || '#f2da91', true);
      } else if (hr.state === 'ridden') {
        hr.state = 'bucking';
        hr.buckTimer = 0.65;
        hr.buckThrowAngle = G.MATH.normAngle(hr.angle + Math.PI * 0.72);
        hr.vx = 0;
        hr.vy = 0;
        hr.speed = 0;
        hr._neighCd = 2.0;
        if (G.AUDIO && G.AUDIO.playHorseNeigh) G.AUDIO.playHorseNeigh();
        if (state) spawnFloatText(state, hr.x, hr.y - 16, 'КОНЬ ВЗБРЫКНУЛ!', (P.brass && P.brass[0]) || '#f2da91', true);
      }
    }
  }

  function tryInteract(state, world, player) {
    const p = resolvePlayer(state, player);
    if (p && (p.stunTimer || 0) > 0) return false;
    const item = (isLocalPlayer(state, p) ? (state.nearInteractable || findNearestInteractable(state, world, p)) : findNearestInteractable(state, world, p));
    if (!item || !p) return false;
    const P = getPal();

    if (item.kind === 'horse_dismount') {
      return dismountHorse(state, world, p, false);
    }
    if (item.kind === 'horse') {
      return mountHorse(state, world, p);
    }

    if (item.kind === 'bourbon') {
      if (p.dead || p.rolling || p.drinking || p.bandaging) return false;
      const maxHp = p.maxHp || 100;
      if (p.hp >= maxHp && !p.bleeding && !p.critical && (p.concussion || 0) <= 0.05) {
        showToastFor(state, p, 'ЗДОРОВЬЕ УЖЕ ПОЛНОЕ', 1.0);
        return false;
      }
      const ws = getWState(state, p);
      if (ws.reloading) closeReload(state, p);
      ws.daPullTimer = 0;
      interruptSmoking(state, p);
      p.drinking = true;
      p.drinkTimer = 0;
      p.drinkDur = 1.8;
      if (state.saloonProps) {
        state.saloonProps.bourbonAvailable = false;
        state.saloonProps.bourbonInHand = true;
      }
      if (G.AUDIO.playDrink) G.AUDIO.playDrink();
      showToastFor(state, p, 'ВЫПИВАЕТ БУРБОН...', 1.2);
      return true;
    }

    if (item.kind === 'medkit') {
      const maxB = p.maxBandages || 3;
      if ((p.bandages || 0) >= maxB) {
        showToastFor(state, p, `ЗАПАС БИНТОВ ПОЛНЫЙ (${maxB}/${maxB})`, 1.0);
        return false;
      }
      p.bandages = maxB;
      if (G.AUDIO.playBandage) G.AUDIO.playBandage();
      spawnFloatText(state, item.x, item.y - 10, `+БИНТЫ (${maxB}/${maxB})`, P.brass[0], true);
      showToastFor(state, p, `БИНТЫ ПОПОЛНЕНЫ (${maxB}/${maxB})`, 1.2);
      return true;
    }

    if (item.kind === 'hatrack') {
      if (isLocalPlayer(state, p)) {
        state.hatMenuOpen = !state.hatMenuOpen;
        if (state.hatMenuOpen && G.AUDIO.playHatEquip) G.AUDIO.playHatEquip();
      }
      return true;
    }

    if (item.kind === 'dartboard') {
      showToastFor(state, p, 'ДАРТС (СКОРО В МИНИ-ИГРАХ)', 1.5);
      return true;
    }

    if (item.kind === 'notice_board') {
      showToastFor(state, p, 'ДОСКА ОБЪЯВЛЕНИЙ', 1.4);
      return true;
    }

    return false;
  }

  function startWaveMode(state, world) {
    if (!state.waves) state.waves = { active: true, wave: 0, phase: 'idle', breakTimer: 0 };
    state.waves.active = true;
    state.waves.wave = 1;
    state.waves.phase = 'fighting';
    state.waves.breakTimer = 0;
    G.CFG.spawnBandits = true;
    if (world && world.spawnWave) world.spawnWave(1, getPlayers(state), state);
    if (G.AUDIO.playWaveHorn) G.AUDIO.playWaveHorn(true);
    showToast(state, 'ВОЛНА 1 НАЧАЛАСЬ', 1.8);
  }

  function stopWaveMode(state) {
    if (!state.waves) return;
    state.waves.active = false;
    state.waves.phase = 'idle';
    state.waves.breakTimer = 0;
    showToast(state, 'РЕЖИМ ВОЛН ОСТАНОВЛЕН', 1.2);
  }

  function updateWaves(state, world, dt) {
    const wv = state.waves;
    const playersList = getPlayers(state);
    if (!wv || !wv.active || !playersList.some((pl) => !pl.dead)) return;
    const alive = world.getAliveBanditsCount ? world.getAliveBanditsCount() : 0;

    if (wv.phase === 'fighting') {
      if (alive <= 0) {
        wv.phase = 'break';
        wv.breakTimer = 10.0;
        if (G.AUDIO.playWaveHorn) G.AUDIO.playWaveHorn(false);
        showToast(state, `ВОЛНА ${wv.wave} ПРОЙДЕНА`, 2.2);
      }
    } else if (wv.phase === 'break') {
      wv.breakTimer = Math.max(0, wv.breakTimer - dt);
      if (wv.breakTimer <= 0) {
        wv.wave += 1;
        wv.phase = 'fighting';
        if (world && world.spawnWave) world.spawnWave(wv.wave, playersList, state);
        if (G.AUDIO.playWaveHorn) G.AUDIO.playWaveHorn(true);
        showToast(state, `ВОЛНА ${wv.wave} НАЧАЛАСЬ`, 1.9);
        // Вероятная пыльная буря при смене волны (начиная со 2-й волны)
        if (wv.wave >= 2 && state.dustStorm && !state.dustStorm.active && Math.random() < 0.38) {
          triggerDustStorm(state, world, null, true);
          showToast(state, `ВОЛНА ${wv.wave} НАЧАЛАСЬ • ПЫЛЬНАЯ БУРЯ!`, 2.2);
        }
      }
    }
  }

  function resetTransientState(state, world) {
    if (!state) return;
    state.bullets = [];
    state.shells = [];
    state.decals = [];
    state.particles = [];
    state.bloodDrops = [];
    state.bloodTrail = [];
    state.flyingHats = [];
    state.gunSmokeClouds = [];
    state.smokeFlashes = [];
    state.waterRipples = [];
    state.floatTexts = [];
    state.reloadEvents = [];
    state.debugRays = [];
    if (state.netEvents) state.netEvents = [];
    state.fleeCooldown = 0;
    state.hatMenuOpen = false;
    state.nearInteractable = null;
    state.toast = { text: '', timer: 0 };
    if (state.waves) {
      state.waves.active = false;
      state.waves.wave = 0;
      state.waves.phase = 'idle';
      state.waves.breakTimer = 0;
      state.waves.totalSpawned = 0;
    }
    if (state.dustStorm) {
      state.dustStorm.active = false;
      state.dustStorm.intensity = 0;
      state.dustStorm.timer = 0;
      state.dustStorm.duration = 0;
      state.dustStorm.cooldown = 36;
      state.dustStorm.tumbleweeds = [];
    }
    const sp = (world && world.playerSpawn) || (world && world.layout && world.layout.playerSpawn) || { x: 215, y: 400 };
    const pls = getPlayers(state);
    for (let i = 0; i < pls.length; i++) {
      const pl = pls[i];
      if (!pl) continue;
      pl.x = sp.x;
      pl.y = sp.y;
      pl.vx = 0;
      pl.vy = 0;
      pl.knockVx = 0;
      pl.knockVy = 0;
      pl.hp = pl.maxHp || 100;
      pl.dead = false;
      pl.critical = false;
      pl.bleeding = false;
      pl.concussion = 0;
      pl.indoorRingTimer = 0;
      pl.stunTimer = 0;
      pl.snakeSlowTimer = 0;
      pl.fireDmgCd = 0;
      pl.rolling = false;
      pl.rollTimer = 0;
      pl.mountedHorse = false;
      pl.inCover = false;
      pl.peeking = false;
      pl.coverObj = null;
      pl.bandaging = false;
      pl.drinking = false;
      pl.smokingState = null;
      if (pl.weapons) {
        pl.weapons.forEach((ws) => {
          const def = getWeaponById(ws.id);
          ws.ammo = def.capacity;
          ws.reserve = def.defaultReserve;
          ws.reloading = false;
          ws.reloadTimer = 0;
          ws.reloadOpenFrac = 0;
          ws.cockTimer = 0;
          ws.cocked = true;
        });
      }
      if (world) resolveCircleSolids(pl, G.CFG.playerRadius + 1, world, 3);
    }
    state.camera.x = sp.x;
    state.camera.y = sp.y;
    state.camera.shakeX = 0;
    state.camera.shakeY = 0;
    state.camera.shakeMag = 0;
    if (state.editor) {
      state.editor.camX = sp.x;
      state.editor.camY = sp.y;
      state.editor.hoverSolidId = null;
      state.editor.hoverEntity = null;
    }
    if (G.AUDIO.setConcussion) G.AUDIO.setConcussion(0);
    if (G.AUDIO.updateWind) G.AUDIO.updateWind(0, false, state.time || 0);
  }

  function toggleEditorMode(state, world, forcedState) {
    if (!state.editor) {
      state.editor = {
        active: false, tool: 'place', tab: 'objects', selectedType: 'crate',
        rotated: false, gridStep: 4, brushSize: 1, selectedEntity: null,
        pendingTagId: '', pendingRequiresUnlock: '',
        hoverSolidId: null, hoverEntity: null, camX: state.camera.x, camY: state.camera.y
      };
    }
    if (!state.editor.tab) state.editor.tab = 'objects';
    if (!state.editor.gridStep || state.editor.gridStep === 8) state.editor.gridStep = 4;
    const next = forcedState !== undefined ? !!forcedState : !state.editor.active;
    state.editor.active = next;
    state.screen = next ? 'editor' : 'playing';
    state.input.lmb = false;
    state.input.rmb = false;
    state.hatMenuOpen = false;
    closeReload(state);
    if (world && world.rebuildStoryVisibility) world.rebuildStoryVisibility(state);
    if (next) {
      state.editor.camX = state.camera.x;
      state.editor.camY = state.camera.y;
      if (G.AUDIO.setConcussion) G.AUDIO.setConcussion(0);
      if (G.AUDIO.updateWind) G.AUDIO.updateWind(0, true, state.time);
      showToast(state, 'РЕДАКТОР УРОВНЯ: БОЙ НА ПАУЗЕ (WASD — КАМЕРА)', 1.8);
    } else {
      state.editor.hoverSolidId = null;
      state.editor.hoverEntity = null;
      state.editor.selectedEntity = null;
      showToast(state, 'БОЙ ВОЗОБНОВЛЁН', 1.2);
    }
  }

  function handleKeyDownForPlayer(state, world, player, code, inputOverride) {
    const p = resolvePlayer(state, player);
    if (!p) return;
    if (isLocalPlayer(state, p) && state.editor && state.editor.active) {
      const ed = state.editor;
      if (code === 'Escape') {
        toggleEditorMode(state, world, false);
        return;
      }
      if (code === 'KeyM') {
        ed.tool = ed.tool === 'move' ? 'place' : 'move';
        if (ed.tool !== 'move') ed.selectedEntity = null;
        showToast(state, ed.tool === 'move' ? 'ИНСТРУМЕНТ: ПЕРЕМЕЩЕНИЕ [M]' : 'ИНСТРУМЕНТ: РАЗМЕЩЕНИЕ', 0.9);
        return;
      }
      if (code === 'KeyQ' || code === 'KeyE' || code === 'KeyR') {
        if (ed.tool === 'move' && ed.selectedEntity && world && world.rotateEditorEntity) {
          if (world.rotateEditorEntity(ed.selectedEntity, state)) {
            if (G.NET && G.NET.broadcastMapSync) G.NET.broadcastMapSync(state, world);
            showToast(state, 'ОБЪЕКТ ПОВЁРНУТ', 0.8);
            return;
          }
        }
        ed.rotated = !ed.rotated;
        showToast(state, ed.rotated ? 'ПОВЕРНУТО (ВЕРТИКАЛЬНО)' : 'ПОВЕРНУТО (ГОРИЗОНТАЛЬНО)', 0.9);
        return;
      }
      if (code === 'Delete' || code === 'Backspace' || code === 'KeyX') {
        if (ed.tool === 'move' && ed.selectedEntity && world && world.removeEditorEntity) {
          if (world.removeEditorEntity(ed.selectedEntity, state)) {
            ed.selectedEntity = null;
            if (G.NET && G.NET.broadcastMapSync) G.NET.broadcastMapSync(state, world);
            showToast(state, 'ОБЪЕКТ УДАЛЁН', 0.8);
            return;
          }
        }
        ed.tool = ed.tool === 'erase' ? 'place' : 'erase';
        ed.selectedEntity = null;
        showToast(state, ed.tool === 'erase' ? 'ИНСТРУМЕНТ: УДАЛЕНИЕ' : 'ИНСТРУМЕНТ: РАЗМЕЩЕНИЕ', 0.9);
        return;
      }
      if (ed.tool === 'move' && ed.selectedEntity && world && world.moveEditorEntity &&
          (code === 'ArrowLeft' || code === 'ArrowRight' || code === 'ArrowUp' || code === 'ArrowDown')) {
        const hit = ed.selectedEntity;
        const step = (state.input && state.input.keys && (state.input.keys.AltLeft || state.input.keys.AltRight)) ? 1 : (ed.gridStep || 4);
        const dx = code === 'ArrowLeft' ? -step : (code === 'ArrowRight' ? step : 0);
        const dy = code === 'ArrowUp' ? -step : (code === 'ArrowDown' ? step : 0);
        const curX = (hit.kind === 'solid' || hit.kind === 'zone' || hit.kind === 'door_pair') ? hit.x : (hit.obj ? hit.obj.x : hit.x);
        const curY = (hit.kind === 'solid' || hit.kind === 'zone' || hit.kind === 'door_pair') ? hit.y : (hit.obj ? hit.obj.y : hit.y);
        if (world.moveEditorEntity(hit, curX + dx, curY + dy, state)) {
          if (hit.kind === 'solid' && world.rebuildGeometry) world.rebuildGeometry();
          if (G.NET && G.NET.broadcastMapSync) G.NET.broadcastMapSync(state, world);
        }
        return;
      }
      return;
    }

    interruptSmoking(state, p);
    if ((p.stunTimer || 0) > 0 && code !== 'KeyV') return;
    if (code === 'Digit1' || code === '__act:weapon_0') { switchWeapon(state, 0, p); return; }
    if (code === 'Digit2' || code === '__act:weapon_1') { switchWeapon(state, 1, p); return; }
    if (code === 'Digit3' || code === '__act:weapon_2') { switchWeapon(state, 2, p); return; }

    if (code === 'KeyR' || code === '__act:reload') {
      // Мгновенный респавн по [R], если игрок погиб
      if (p.dead) {
        respawnPlayer(state, p, world);
        return;
      }
      openReload(state, world, p);
      return;
    }
    if (code === 'Escape' || code === '__act:escape') {
      closeReload(state, p);
      if (isLocalPlayer(state, p)) state.hatMenuOpen = false;
      return;
    }
    if (code === 'KeyV' && isLocalPlayer(state, p)) {
      G.CFG.debugRays = !G.CFG.debugRays;
      showToast(state, G.CFG.debugRays ? 'ЛУЧИ ЭХА: ВКЛ' : 'ЛУЧИ ЭХА: ВЫКЛ', 0.9);
      return;
    }

    if (code === '__act:interact' || G.matchesKey('interact', code)) {
      if (tryInteract(state, world, p)) return;
    }

    if (code === '__act:bandage' || G.matchesKey('bandage', code) || code === 'KeyQ') {
      tryUseBandage(state, p);
      return;
    }

    if (code === '__act:cock' || G.matchesKey('cock', code)) {
      tryCock(state, world, p);
    }

    const isCoverKey = code === '__act:cover' || code === '__act:cover_roll' || G.matchesKey('cover', code);
    const isRollKey = code === '__act:roll' || code === '__act:cover_roll' || G.matchesKey('roll', code);
    if ((isCoverKey || isRollKey) && p.mountedHorse) return;
    const keys = (inputOverride && inputOverride.keys) || (p.input && !isLocalPlayer(state, p) ? p.input.keys : state.input.keys) || {};
    const movingInput = !!(keys.KeyW || keys.KeyS || keys.KeyA || keys.KeyD ||
      keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight);

    if (isCoverKey && isRollKey) {
      if (p.inCover) {
        if (movingInput) {
          startRoll(state, world, p, inputOverride);
        } else {
          exitCover(state, p);
        }
      } else if (p.nearCover && !movingInput) {
        enterCover(state, p.nearCover, p);
      } else {
        startRoll(state, world, p, inputOverride);
      }
    } else if (isCoverKey) {
      if (p.inCover) {
        exitCover(state, p);
      } else if (p.nearCover) {
        enterCover(state, p.nearCover, p);
      } else {
        showToastFor(state, p, 'НЕТ УКРЫТИЯ РЯДОМ', 0.85);
      }
    } else if (isRollKey) {
      startRoll(state, world, p, inputOverride);
    }
  }

  function handleKeyDown(state, world, code) {
    handleKeyDownForPlayer(state, world, resolvePlayer(state), code, state.input);
  }

  function calcBulletDamage(b, hitStepDist) {
    const totalDist = (b.traveled || 0) + hitStepDist;
    let mult = 1.0;
    if (totalDist > b.falloffStart) {
      const span = Math.max(1, b.falloffEnd - b.falloffStart);
      const t = G.MATH.clamp((totalDist - b.falloffStart) / span, 0, 1);
      mult = G.MATH.lerp(1.0, b.falloffMinMult, t);
    }
    return {
      dmg: Math.max(8, Math.round(b.damage * mult)),
      mult: mult,
      dist: totalDist
    };
  }

  function findBestBanditCover(t, p, world) {
    let best = null;
    let bestScore = Infinity;
    const toPX = p.x - t.x;
    const toPY = p.y - t.y;
    const dToP = Math.hypot(toPX, toPY) || 1;
    const dirPX = toPX / dToP;
    const dirPY = toPY / dToP;

    for (let i = 0; i < world.covers.length; i++) {
      const c = world.covers[i];
      if (c.type === 'cliff') continue;
      const cx = c.x + c.w * 0.5;
      const cy = c.y + c.h * 0.5;
      const dC = G.MATH.dist(t.x, t.y, cx, cy);
      if (dC > 125) continue;

      // Позиция за укрытием с противоположной от игрока стороны
      const awayX = cx - p.x;
      const awayY = cy - p.y;
      const awayLen = Math.hypot(awayX, awayY) || 1;
      const ndx = awayX / awayLen;
      const ndy = awayY / awayLen;

      // Находим точку чуть за краем прямоугольника укрытия
      const halfSpan = Math.max(c.w, c.h) * 0.5 + t.r + 4;
      const sx = G.MATH.clamp(cx + ndx * halfSpan, 40, world.width - 40);
      const sy = G.MATH.clamp(cy + ndy * halfSpan, 30, world.height - 30);

      // Проверяем, не занята ли точка препятствием
      let blocked = false;
      for (let j = 0; j < world.solids.length; j++) {
        const s = world.solids[j];
        if (s.walkThrough || s._storyHidden) continue;
        if (G.MATH.circleRectPush(sx, sy, t.r + 2, s).hit) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      const dotTowardPlayer = ((cx - t.x) * dirPX + (cy - t.y) * dirPY) / Math.max(1, dC);
      const score = dC - dotTowardPlayer * 28 - (c.high ? 12 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = { cover: c, sx: sx, sy: sy };
      }
    }
    return best;
  }

  function checkFriendlyInLine(shooterB, ang, maxRange, targets) {
    if (!targets) return false;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    for (let i = 0; i < targets.length; i++) {
      const other = targets[i];
      if (other.kind !== 'bandit' || !other.alive || other.id === shooterB.id) continue;
      const ox = other.x - shooterB.x;
      const oy = other.y - shooterB.y;
      const proj = ox * dx + oy * dy;
      if (proj <= 4 || proj >= maxRange) continue;
      const perp2 = ox * ox + oy * oy - proj * proj;
      const safeR = (other.r || 11) + 7;
      if (perp2 <= safeR * safeR) return true;
    }
    return false;
  }

  function stepBanditWeaponState(state, world, t, wDef, diff, dt, listener, hasLos, dist) {
    if (t.ammo === undefined) t.ammo = wDef.capacity || 6;
    if (t.maxAmmo === undefined) t.maxAmmo = wDef.capacity || 6;
    if (t.reserveAmmo === undefined) t.reserveAmmo = wDef.id === 'winchester' ? 16 : 18;
    if (t.cocked === undefined) t.cocked = true;

    if (t.flashTimer > 0) t.flashTimer = Math.max(0, t.flashTimer - dt);
    if (t.recoilKickAnim > 0) t.recoilKickAnim = Math.max(0, t.recoilKickAnim - dt * 6.5);
    if (t.daCooldownTimer > 0) t.daCooldownTimer = Math.max(0, t.daCooldownTimer - dt);
    if (t.shootCooldown > 0) t.shootCooldown = Math.max(0, t.shootCooldown - dt);
    if (t._ffCheckCd > 0) t._ffCheckCd = Math.max(0, t._ffCheckCd - dt);
    t.bloom = Math.max(0, (t.bloom || 0) - (wDef.bloomDecay || 0.13) * dt);
    t.reloadOpenFrac = G.MATH.lerp(t.reloadOpenFrac || 0, t.reloading ? 1 : 0, Math.min(1, dt * 12));

    const lx = listener ? listener.x : t.x;
    const ly = listener ? listener.y : t.y;
    const reactMult = diff.reactMult || 1.0;

    if (t.cockTimer > 0) {
      t.cockTimer = Math.max(0, t.cockTimer - dt);
      if (wDef.action === 'lever' && t.chamberSpent && !t.leverEjected && t.cockTimer <= (t.cockDuration || 0.36) * 0.50) {
        t.leverEjected = true;
        spawnShell(state, t.x, t.y, (t.angle || 0) + Math.PI * 0.45, 0.95);
      }
      if (t.cockTimer === 0) {
        t.chamberSpent = false;
        if (t.ammo > 0) t.cocked = true;
      }
    }

    if (t.reloading) {
      t.reloadTimer = (t.reloadTimer || 0) - dt;
      if (t.reloadTimer <= 0) {
        if (t.ammo < t.maxAmmo && t.reserveAmmo > 0) {
          t.ammo += 1;
          t.reserveAmmo -= 1;
          if (G.AUDIO && G.AUDIO.playBanditReloadClick) {
            G.AUDIO.playBanditReloadClick('insert', t.x, t.y, lx, ly);
          }
          if (t.ammo < t.maxAmmo && t.reserveAmmo > 0) {
            t.reloadTimer = (wDef.reloadOneTime || 0.22) * reactMult;
          }
        }
        if (t.ammo >= t.maxAmmo || t.reserveAmmo <= 0) {
          t.reloading = false;
          t.reloadTimer = 0;
          if (G.AUDIO && G.AUDIO.playBanditReloadClick) {
            G.AUDIO.playBanditReloadClick('close', t.x, t.y, lx, ly);
          }
          if (wDef.action === 'da') t.cocked = true;
        }
      } else if (hasLos && dist < 85 && t.ammo >= 2 && wDef.action === 'da') {
        t.reloading = false;
        t.reloadTimer = 0;
        t.cocked = true;
      }
    }

    if (!t.reloading && t.ammo <= 0 && t.reserveAmmo <= 0) {
      if (t.aiState !== 'no_ammo_retreat') {
        t.aiState = 'no_ammo_retreat';
        t.noAmmoFlee = true;
        t.retreatScroungeTimer = 4.5;
        t.fleeTimer = 0;
        t.inCover = false;
        t.peeking = false;
        t.aimTimer = 0;
        t.telegraphFrac = 0;
        t.aimState = 'no_ammo_retreat';
        if (!t.outOfAmmoAnnounced) {
          t.outOfAmmoAnnounced = true;
          const P = getPal();
          spawnFloatText(state, t.x, t.y - 14, 'ПУСТО!', (P.brass && P.brass[0]) || '#f2da91', true);
        }
      }
      return false;
    }

    const wantTacReload = !hasLos && t.aiState === 'combat' && t.ammo <= Math.floor(t.maxAmmo * 0.4) && dist > 130;
    if (!t.reloading && t.reserveAmmo > 0 && (t.ammo <= 0 || wantTacReload)) {
      t.reloading = true;
      t.cockTimer = 0;
      t.peeking = false;
      t.aimTimer = 0;
      t.telegraphFrac = 0;
      t.reloadTimer = (wDef.reloadOneTime || 0.22) * reactMult;
      if (G.AUDIO && G.AUDIO.playBanditReloadClick) {
        G.AUDIO.playBanditReloadClick('open', t.x, t.y, lx, ly);
      }
      if (wDef.uiShape === 'cylinder') {
        const spent = Math.max(0, t.maxAmmo - t.ammo);
        for (let sc = 0; sc < Math.min(3, spent); sc++) {
          spawnShell(state, t.x, t.y, (t.angle || 0) - Math.PI * 0.45, 0.75);
        }
      }
    }

    if (!t.reloading && t.ammo > 0 && (wDef.action === 'sa' || wDef.action === 'lever') && !t.cocked && t.cockTimer <= 0 && t.shootCooldown <= 0.15) {
      t.cockDuration = (wDef.cockTime || 0.22) * reactMult;
      t.cockTimer = t.cockDuration;
      t.leverEjected = false;
    }
    return true;
  }

  function isBanditOnPlayerScreen(t, p, state) {
    const pad = 6;
    if (p && isLocalPlayer(state, p) && state.viewRect && state.viewRect.w > 0 && state.viewRect.h > 0) {
      const vr = state.viewRect;
      return t.x >= vr.x + pad && t.x <= vr.x + vr.w - pad && t.y >= vr.y + pad && t.y <= vr.y + vr.h - pad;
    }
    if (!p) return false;
    const vw = (state.viewRect && state.viewRect.w > 0) ? state.viewRect.w : 480;
    const vh = (state.viewRect && state.viewRect.h > 0) ? state.viewRect.h : 270;
    const rx = p.x - vw * 0.5;
    const ry = p.y - vh * 0.5;
    return t.x >= rx + pad && t.x <= rx + vw - pad && t.y >= ry + pad && t.y <= ry + vh - pad;
  }

  function updateBanditCombat(state, world, dt) {
    if (G.CFG.spawnBandits === false) return;
    const alivePlayers = getPlayers(state).filter((pl) => pl && !pl.dead && (pl.hp === undefined || pl.hp > 0));
    if (alivePlayers.length === 0) return;
    const listener = resolvePlayer(state);
    const diff = getBotDiff();

    for (let i = 0; i < world.targets.length; i++) {
      const t = world.targets[i];
      if (t.kind !== 'bandit' || !t.alive) continue;
      const wDef = getWeaponById(t.weaponId || (t.gunType === 'rifle' ? 'winchester' : 'walker'));

      if ((t.stunTimer || 0) > 0) {
        t.aimTimer = 0;
        t.telegraphFrac = 0;
        t.aimState = 'stun';
        if (t.flashTimer > 0) t.flashTimer = Math.max(0, t.flashTimer - dt);
        if (t.recoilKickAnim > 0) t.recoilKickAnim = Math.max(0, t.recoilKickAnim - dt * 6.5);
        continue;
      }

      if (t.aiState === 'flee' || t.aiState === 'no_ammo_retreat') {
        t.aimTimer = 0;
        t.telegraphFrac = 0;
        t.aimState = t.aiState;
        if (t.flashTimer > 0) t.flashTimer = Math.max(0, t.flashTimer - dt);
        if (t.recoilKickAnim > 0) t.recoilKickAnim = Math.max(0, t.recoilKickAnim - dt * 6.5);
        continue;
      }

      // Выбираем ближайшего видимого (или просто ближайшего) живого игрока
      const baseSight = t.sightDist || (wDef.id === 'winchester' ? 480 : 420);
      const stormInt = (state.dustStorm && state.dustStorm.active) ? (state.dustStorm.intensity || 0) : 0;
      let targetP = alivePlayers[0];
      let targetDist = Infinity;
      let targetHasLos = false;
      let targetAngToP = 0;
      let bestScore = Infinity;

      for (let pi = 0; pi < alivePlayers.length; pi++) {
        const cand = alivePlayers[pi];
        const cdx = cand.x - t.x;
        const cdy = cand.y - t.y;
        const cdist = Math.hypot(cdx, cdy);
        const cCrouched = !!(cand.inCover && !cand.peeking && cand.coverObj && !cand.coverObj.high);
        let effSight = (t.aiState === 'combat') ? baseSight * 1.15 : (cCrouched ? baseSight * 0.58 : baseSight);
        if (stormInt > 0.05 && (!world.getIndoorZoneAt || !world.getIndoorZoneAt(t.x, t.y) || !world.getIndoorZoneAt(cand.x, cand.y))) {
          effSight *= (1.0 - 0.42 * stormInt);
        }
        const angToCand = Math.atan2(cdy, cdx);
        const fovDiff = Math.abs(G.MATH.angleDiff(t.angle || 0, angToCand));
        const inFov = (t.aiState === 'combat')
          ? (fovDiff <= Math.PI * 0.85 || cdist < 240)
          : (t.aiState === 'alert' || t.aiState === 'search')
            ? (fovDiff <= Math.PI * 0.65 || cdist < 130)
            : (fovDiff <= Math.PI * 0.45 || cdist < 72);

        let cLos = (cdist <= effSight && cdist > 8 && inFov);
        if (cLos && hasHighWallBetween(t.x, t.y, cand.x, cand.y, world)) {
          cLos = false;
        }
        if (cLos && getSmokeOcclusionAlongRay(t.x, t.y, cand.x, cand.y, state) >= 0.70) {
          cLos = false;
        }
        const score = (cLos ? 0 : 2500) + cdist;
        if (score < bestScore) {
          bestScore = score;
          targetP = cand;
          targetDist = cdist;
          targetHasLos = cLos;
          targetAngToP = angToCand;
        }
      }

      const p = targetP;
      const dx = p.x - t.x;
      const dy = p.y - t.y;
      const dist = targetDist;
      const angToP = targetAngToP;
      const hasLos = targetHasLos;

      if (!stepBanditWeaponState(state, world, t, wDef, diff, dt, listener, hasLos, dist)) {
        t.fleeTarget = world.pickFleePoint ? world.pickFleePoint(t, alivePlayers) : null;
        continue;
      }

      const wallHit = checkBarrelWallCollision(t, wDef, world);
      t.wallBlocked = !!wallHit;
      t.wallHitDist = wallHit ? wallHit.dist : ((wDef.wallCheckLen || 21) + 5);

      if (hasLos) {
        t.aiState = 'combat';
        t.lastKnownX = p.x;
        t.lastKnownY = p.y;
        t.distractedByEcho = false;

        // Тактическое позиционирование и укрытия в бою (учитывает сложность и перезарядку)
        const allowTacCover = t.reloading || (diff.tacticalCover || 0.78) >= 0.99 || (t.id % 100) / 100 < (diff.tacticalCover || 0.78);
        let movingToCover = false;
        if (!t.isDodging) {
          const covInfo = allowTacCover ? findBestBanditCover(t, p, world) : null;
          if (covInfo) {
            const dCov = G.MATH.dist(t.x, t.y, covInfo.sx, covInfo.sy);
            if (dCov > 10) {
              movingToCover = true;
              t.inCover = false;
              t.peeking = false;
              t.coverObj = covInfo.cover;
              const spd = t.reloading ? 64 : 54;
              t.x += ((covInfo.sx - t.x) / dCov) * spd * dt;
              t.y += ((covInfo.sy - t.y) / dCov) * spd * dt;
              t.walkPhase += dt * 4.8;
            } else {
              t.inCover = true;
              t.coverObj = covInfo.cover;
              if (t.reloading) {
                t.peeking = false;
              } else if (!covInfo.cover.high) {
                t.peeking = (t.shootCooldown <= 0.68 && t.ammo > 0);
              } else {
                t.peeking = (t.shootCooldown <= 0.72 && t.ammo > 0);
              }
            }
          } else {
            t.inCover = false;
            t.peeking = false;
            t.coverObj = null;
            const prefDist = wDef.id === 'winchester' ? 280 : (wDef.id === 'lightning' ? 125 : 180);
            if (t.reloading || dist < prefDist - 40) {
              t.x -= (dx / Math.max(1, dist)) * 34 * dt;
              t.y -= (dy / Math.max(1, dist)) * 34 * dt;
              t.walkPhase += dt * 3.4;
            } else if (dist > prefDist + 75) {
              t.x += (dx / Math.max(1, dist)) * 36 * dt;
              t.y += (dy / Math.max(1, dist)) * 36 * dt;
              t.walkPhase += dt * 3.5;
            }
          }
        }

        // Реакция на прицел игрока (учитывает diff.reactMult и dodgeSkill)
        const angPToB = Math.atan2(t.y - p.y, t.x - p.x);
        const underPlayerAim = !p.rolling && !p.wallBlocked && (!p.inCover || p.peeking)
          && dist < 390 && Math.abs(G.MATH.angleDiff(p.aimAngle, angPToB)) < 0.115;
        const reactGate = 0.34 * (diff.reactMult || 1.0);
        if (underPlayerAim && !t.isDodging && (t.dodgeCooldown || 0) <= 0) {
          t.aimReactTimer = (t.aimReactTimer || 0) + dt;
          if (t.aimReactTimer > reactGate) {
            t.aimReactTimer = 0;
            triggerBanditDodge(t, dx, dy, state, world);
          }
        } else {
          t.aimReactTimer = Math.max(0, (t.aimReactTimer || 0) - dt * 2.0);
        }

        // Прицеливание с пружинной физикой оружия + защита от Friendly Fire + запрет стрельбы из-за экрана
        const onScreen = isBanditOnPlayerScreen(t, p, state);
        if (!onScreen && !t.isDodging && !movingToCover && !t.reloading && !t.inCover && dist > 110) {
          t.x += (dx / Math.max(1, dist)) * 34 * dt;
          t.y += (dy / Math.max(1, dist)) * 34 * dt;
          t.walkPhase += dt * 3.4;
        }
        const canShootStance = (!t.inCover || t.peeking) && !t.isDodging && !t.reloading;
        if (canShootStance && dist <= (t.shootRange || 420)) {
          t.aimState = t.reloading ? 'reload' : 'aim';
          t.targetAngle = angToP;
          const armRate = (t.armWounded ? 0.58 : 1.0) / Math.max(0.7, diff.reactMult || 1.0);
          stepAimSpring(t, 'angle', angToP, wDef, dt, armRate);

          if (t.wallBlocked) {
            t.x -= Math.cos(t.angle) * 28 * dt;
            t.y -= Math.sin(t.angle) * 28 * dt;
          }

          if (!onScreen) {
            t.aimTimer = Math.max(0, (t.aimTimer || 0) - dt * 3.0);
            t.telegraphFrac = 0;
          } else {
            t.aimTimer = (t.aimTimer || 0) + dt * (t.armWounded ? 0.62 : 1.0);
            const telegTime = (t.telegraphTime || 0.55) * (diff.reactMult || 1.0);
            t.telegraphFrac = G.MATH.clamp(t.aimTimer / telegTime, 0, 1);

            // Проверка линии огня на своих (Friendly Fire avoidance — только в фазе готовности выстрела)
            let friendlyBlocking = false;
            let avoidFF = false;
            if (t.aimTimer >= telegTime * 0.5 && t.shootCooldown <= 0.25) {
              const ffRange = Math.min(dist, wDef.falloffEnd || 420);
              friendlyBlocking = checkFriendlyInLine(t, t.angle, ffRange, world.targets);
              if (friendlyBlocking) {
                if (diff.avoidFriendlyFire === true) {
                  avoidFF = true;
                } else if (typeof diff.avoidFriendlyFire === 'number' && diff.avoidFriendlyFire > 0) {
                  if ((t._ffCheckCd || 0) <= 0) {
                    t._ffCheckCd = 0.55;
                    t._ffDecision = Math.random() < diff.avoidFriendlyFire;
                  }
                  avoidFF = !!t._ffDecision;
                }
              }
            }
            if (avoidFF && !t.isDodging && !movingToCover) {
              const sideSign = (t.id % 2 === 0) ? 1 : -1;
              t.x += -Math.sin(t.angle) * sideSign * 44 * dt;
              t.y += Math.cos(t.angle) * sideSign * 44 * dt;
              t.walkPhase += dt * 3.8;
              t.aimTimer = Math.min(t.aimTimer, telegTime * 0.85);
            }

            const readyAction = (wDef.action === 'da' || t.cocked) && t.cockTimer <= 0 && t.daCooldownTimer <= 0;
            if (t.aimTimer >= telegTime && t.shootCooldown <= 0 && !t.wallBlocked && t.ammo > 0 && readyAction && !avoidFF) {
              t.aimTimer = 0;
              t.telegraphFrac = 0;
              t.ammo = Math.max(0, t.ammo - 1);
              if (wDef.action === 'sa') {
                t.cocked = false;
              } else if (wDef.action === 'lever') {
                t.cocked = false;
                t.chamberSpent = true;
                t.leverEjected = false;
              } else if (wDef.action === 'da') {
                t.daCooldownTimer = wDef.daCooldown || 0.40;
              }

              const baseCooldown = wDef.id === 'winchester' ? 1.60 : (wDef.id === 'lightning' ? 0.85 : 1.25);
              t.shootCooldown = baseCooldown * (diff.shootCooldownMult || 1.0);

              const acc = G.MATH.clamp(G.CFG.botAccuracy !== undefined ? G.CFG.botAccuracy : 0.55, 0, 1);
              const distFactor = 0.85 + G.MATH.clamp(dist / 480, 0, 1) * 0.55;
              const armPenalty = t.armWounded ? (t.armWoundLevel > 1 ? 2.60 : 2.25) : 1.0;
              const swingPen = Math.min(0.10, Math.abs(t.aimVel || 0) * 0.018);
              const dynSpread = ((wDef.baseSpread || 0.05) + (t.bloom || 0) + swingPen) * (diff.spreadMult || 1.0) * G.MATH.lerp(2.1, 0.65, acc) * distFactor * armPenalty;
              t.spread = G.MATH.clamp(dynSpread, 0.012, wDef.maxSpread || 0.34);

              const tri = Math.random() + Math.random() - 1;
              const bAngle = t.angle + tri * t.spread;
              const bdx = Math.cos(bAngle);
              const bdy = Math.sin(bAngle);
              const muzzleX = t.x + bdx * Math.min(18, (wDef.barrelLen || 16) * 0.72);
              const muzzleY = t.y + bdy * Math.min(18, (wDef.barrelLen || 16) * 0.72);

              const recMult = (G.CFG.phys && G.CFG.phys.recoil) || 1.0;
              const recDir = (Math.random() < 0.5 ? -1 : 1) * G.MATH.rand(0.75, 1.2);
              t.aimVel = (t.aimVel || 0) + recDir * (wDef.recoilKick || 0.24) * recMult * 12.0;
              t.bloom = Math.min(wDef.maxSpread || 0.30, (t.bloom || 0) + (wDef.bloomPerShot || 0.07));
              t.recoilKickAnim = 1.0;
              t.flashTimer = 0.06;

              G.AUDIO.playShot(
                { soundType: wDef.soundType || 'walker' },
                muzzleX,
                muzzleY,
                world,
                state,
                { isEnemy: true, skipHudUpdate: true, listenerX: listener ? listener.x : p.x, listenerY: listener ? listener.y : p.y }
              );
              pushNetEvent(state, { kind: 'shot', soundType: wDef.soundType || 'walker', x: muzzleX, y: muzzleY, ang: bAngle, isEnemy: true });

              const botDmg = wDef.id === 'winchester' ? 30 : (wDef.id === 'lightning' ? 15 : 22);
              state.bullets.push({
                owner: 'bandit',
                shooterId: t.id,
                x: muzzleX,
                y: muzzleY,
                px: muzzleX,
                py: muzzleY,
                startX: muzzleX,
                startY: muzzleY,
                dx: bdx,
                dy: bdy,
                speed: wDef.bulletSpeed || 860,
                damage: botDmg,
                traveled: 0,
                falloffStart: wDef.falloffStart || 200,
                falloffEnd: wDef.falloffEnd || 450,
                falloffMinMult: wDef.falloffMinMult !== undefined ? wDef.falloffMinMult : 0.7,
                weaponId: wDef.id,
                maxPenetrations: wDef.penetration || 0,
                penetrations: 0,
                penetratedIds: [],
                ricochets: 0,
                ricocheted: false,
                canHitOwner: false,
                justRicochetedId: null,
                originCoverId: (t.inCover && t.peeking && t.coverObj && !t.coverObj.high) ? t.coverObj.id : null,
                life: 1.2
              });

              spawnIndoorGunSmoke(state, world, muzzleX, muzzleY, wDef.id, bAngle);
              const inZoneB = world.getIndoorZoneAt && world.getIndoorZoneAt(muzzleX, muzzleY);
              if (world.flushBirdFlocksNear) {
                world.flushBirdFlocksNear(muzzleX, muzzleY, inZoneB ? 190 : 300, state);
              }
              if (world.scareCrowsNear) {
                world.scareCrowsNear(muzzleX, muzzleY, inZoneB ? 210 : 320, state);
              }
              if (world.scareSheepNear) {
                world.scareSheepNear(muzzleX, muzzleY, inZoneB ? 160 : 250, state);
              }
              if (world.igniteOilPuddlesNear) {
                world.igniteOilPuddlesNear(muzzleX, muzzleY, 125, state);
              }
              scareHorse(state, world, muzzleX, muzzleY, 20, false);
              spawnParticles(state, muzzleX, muzzleY, 6, {
                baseAngle: bAngle,
                spread: 0.45,
                minSpeed: 45,
                maxSpeed: 140,
                minLife: 0.08,
                maxLife: 0.22,
                minSize: 1.5,
                maxSize: 3.2,
                colors: ['#fff4c7', '#e3c068', '#f58a38'],
                kind: 'spark'
              });
              if (wDef.action !== 'lever') {
                // SA / DA оставляют стреляную гильзу до перезарядки (скоба Генри выбросит при взводе)
              }
            }
          }
        } else {
          t.aimTimer = Math.max(0, (t.aimTimer || 0) - dt * 2.5);
          t.telegraphFrac = 0;
          t.aimState = t.reloading ? 'reload' : ((t.inCover && !t.peeking) ? 'cover' : 'combat');
          if (t.inCover && !t.peeking) {
            stepAimSpring(t, 'angle', angToP, wDef, dt, 0.7);
          }
        }
      } else {
        if (t.aiState === 'combat') {
          t.aiState = 'search';
          t.searchTimer = 4.6 + Math.random() * 1.6;
          t.aimTimer = 0;
          t.telegraphFrac = 0;
          t.aimState = 'search';
          t.inCover = false;
          t.peeking = false;
        } else {
          t.aimTimer = Math.max(0, (t.aimTimer || 0) - dt * 2.0);
          t.telegraphFrac = 0;
          t.aimState = t.reloading ? 'reload' : (t.aiState || 'patrol');
        }
      }
    }
  }

  function isPenetrableType(type, solid, bullet) {
    if (type === 'door') return true;
    if (type === 'fence' || type === 'crate' || type === 'table' || type === 'hay') {
      return !!(solid && solid.breached);
    }
    if (type === 'water_barrel' || type === 'trough') {
      if (bullet && bullet.weaponId === 'winchester') return true;
      if (solid && ((solid.waterLevel || 0) <= 0.1 || (solid.holes && solid.holes.length >= 2))) {
        return true;
      }
      return false;
    }
    return false;
  }

  function updateBullets(state, world, dt) {
    const P = getPal();
    const doorSegs = getDoorSegments(world);

    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.life -= dt;
      if (b.life <= 0) {
        state.bullets.splice(i, 1);
        continue;
      }

      b.px = b.x;
      b.py = b.y;

      let remDist = b.speed * dt;
      let aliveBullet = true;
      let hops = 0;

      while (aliveBullet && hops < 3 && remDist > 0.05) {
        hops++;
        let bestDist = remDist;
        let hitWall = null;

        // Проверка сегментов стен/укрытий (через Spatial Grid + AABB) и подвижных дверей салуна
        const ex = b.x + b.dx * bestDist;
        const ey = b.y + b.dy * bestDist;
        const rMinX = b.x < ex ? b.x : ex;
        const rMaxX = b.x > ex ? b.x : ex;
        const rMinY = b.y < ey ? b.y : ey;
        const rMaxY = b.y > ey ? b.y : ey;
        const nearWalls = world.queryWallSegments
          ? world.queryWallSegments(rMinX, rMinY, rMaxX, rMaxY, _bulletQueryBuf)
          : world.wallSegments;

        const segLists = [nearWalls, doorSegs];
        for (let lIdx = 0; lIdx < segLists.length; lIdx++) {
          const segs = segLists[lIdx];
          for (let sIdx = 0; sIdx < segs.length; sIdx++) {
            const seg = segs[sIdx];
            if (seg.maxX !== undefined && (seg.maxX < rMinX || seg.minX > rMaxX || seg.maxY < rMinY || seg.minY > rMaxY)) {
              continue;
            }
            if (b.justRicochetedId && seg.id === b.justRicochetedId) continue;
            if (b.penetratedIds && b.penetratedIds.indexOf(seg.id) !== -1) continue;
            if (seg.solid && (seg.solid.passThroughBullets || seg.solid.lowCoverPassThrough)) continue;
            // Игнорируем собственное низкое укрытие в первые 42 px полёта (огонь поверх кромки)
            if (b.originCoverId && seg.id === b.originCoverId && !b.ricocheted && (b.traveled || 0) < 42) continue;
            const h = G.MATH.raySegment(b.x, b.y, b.dx, b.dy, bestDist, seg.x1, seg.y1, seg.x2, seg.y2);
            if (h) {
              bestDist = h.dist;
              h.seg = seg;
              hitWall = h;
            }
          }
        }

        // Проверка попадания в любого живого игрока (вражеские пули, рикошеты, или PvP / friendlyFire)
        let hitPlayerObj = null;
        const playersList = getPlayers(state);
        const ownerType = b.ownerType || b.owner;
        for (let pIdx = 0; pIdx < playersList.length; pIdx++) {
          const p = playersList[pIdx];
          if (!p || p.dead) continue;
          const canHitP = (ownerType === 'bandit') || b.canHitOwner ||
            (ownerType === 'player' && b.ownerId !== p.id && (state.mpMode === 'pvp' || state.friendlyFire));
          if (!canHitP) continue;
          const ox = p.x - b.x;
          const oy = p.y - b.y;
          const proj = ox * b.dx + oy * b.dy;
          if (proj >= 0 && proj <= bestDist) {
            const perp2 = ox * ox + oy * oy - proj * proj;
            const rad = G.CFG.playerRadius + 2;
            if (perp2 <= rad * rad && (!b.ricocheted || b.traveled > 4 || proj > 6)) {
              bestDist = proj;
              hitPlayerObj = p;
              hitWall = null;
            }
          }
        }

        // Проверка попадания в цели и бандитов (с локальным радиусом для попадания в руку)
        let hitTarget = null;
        let hitTargetPerp2 = 0;
        let hitTargetRad = 12;
        for (let tIdx = 0; tIdx < world.targets.length; tIdx++) {
          const t = world.targets[tIdx];
          if (!t.alive) continue;
          if (t.kind === 'bandit') {
            if (t.id === b.shooterId && !b.canHitOwner) continue;
          }
          const ox = t.x - b.x;
          const oy = t.y - b.y;
          const proj = ox * b.dx + oy * b.dy;
          if (proj < 0 || proj > bestDist) continue;
          const perp2 = ox * ox + oy * oy - proj * proj;
          const rad = t.r + 2;
          if (perp2 <= rad * rad) {
            bestDist = proj;
            hitTarget = t;
            hitTargetPerp2 = perp2;
            hitTargetRad = rad;
            hitPlayerObj = null;
            hitWall = null;
          } else if (t.kind === 'bandit' && ownerType !== 'bandit' && perp2 <= 32 * 32 && proj <= bestDist + 20) {
            triggerBanditDodge(t, b.dx, b.dy, state, world);
          }
        }

        // Проверка попадания в лошадь (если жива и не принадлежит стреляющему всаднику)
        let hitHorse = false;
        const hr = world.horse;
        if (hr && hr.state !== 'dead') {
          const sameRiderShot = (ownerType === 'player' && b.ownerId && b.ownerId === hr.riderId && !b.ricocheted && (b.traveled || 0) < 28);
          if (!sameRiderShot) {
            const hox = hr.x - b.x;
            const hoy = hr.y - b.y;
            const hproj = hox * b.dx + hoy * b.dy;
            if (hproj >= 0 && hproj <= bestDist) {
              const hperp2 = hox * hox + hoy * hoy - hproj * hproj;
              const hrad = (hr.r || 13) + 2;
              if (hperp2 <= hrad * hrad) {
                bestDist = hproj;
                hitHorse = true;
                hitTarget = null;
                hitPlayerObj = null;
                hitWall = null;
              }
            }
          }
        }

        // Проверка попадания в овец в загоне
        let hitSheep = null;
        if (world.sheep && world.sheep.length) {
          for (let sIdx = 0; sIdx < world.sheep.length; sIdx++) {
            const sh = world.sheep[sIdx];
            if (!sh || !sh.alive) continue;
            const sox = sh.x - b.x;
            const soy = sh.y - b.y;
            const sproj = sox * b.dx + soy * b.dy;
            if (sproj >= 0 && sproj <= bestDist) {
              const sperp2 = sox * sox + soy * soy - sproj * sproj;
              const srad = (sh.r || 8) + 1;
              if (sperp2 <= srad * srad) {
                bestDist = sproj;
                hitSheep = sh;
                hitHorse = false;
                hitTarget = null;
                hitPlayerObj = null;
                hitWall = null;
              }
            }
          }
        }

        // Проверка пролёта пули над не горящими масляными пятнами (поджигает масло!)
        if (world.oilPuddles && world.oilPuddles.length) {
          for (let opi = 0; opi < world.oilPuddles.length; opi++) {
            const pd = world.oilPuddles[opi];
            if (!pd || pd.burning || pd.wetExtinguished) continue;
            const pox = pd.x - b.x;
            const poy = pd.y - b.y;
            const pproj = pox * b.dx + poy * b.dy;
            const clampP = G.MATH.clamp(pproj, 0, bestDist);
            const dxP = pox - b.dx * clampP;
            const dyP = poy - b.dy * clampP;
            if (dxP * dxP + dyP * dyP <= pd.r * pd.r) {
              if (world.igniteOilPuddlesNear) world.igniteOilPuddlesNear(pd.x, pd.y, 4, state);
            }
          }
        }

        // Проверка попадания в масляные лампы
        let hitLamp = null;
        if (world.oilLamps && world.oilLamps.length) {
          for (let li = 0; li < world.oilLamps.length; li++) {
            const lm = world.oilLamps[li];
            if (!lm || !lm.alive) continue;
            const lox = lm.x - b.x;
            const loy = lm.y - b.y;
            const lproj = lox * b.dx + loy * b.dy;
            if (lproj >= 0 && lproj <= bestDist) {
              const lperp2 = lox * lox + loy * loy - lproj * lproj;
              const lrad = (lm.r || 6) + 2;
              if (lperp2 <= lrad * lrad) {
                bestDist = lproj;
                hitLamp = lm;
                hitSheep = null;
                hitHorse = false;
                hitTarget = null;
                hitPlayerObj = null;
                hitWall = null;
              }
            }
          }
        }

        // Проверка попадания в гремучих змей (hp: 15)
        let hitSnake = null;
        if (world.snakes && world.snakes.length) {
          for (let sni = 0; sni < world.snakes.length; sni++) {
            const sn = world.snakes[sni];
            if (!sn || !sn.alive) continue;
            const sox = sn.x - b.x;
            const soy = sn.y - b.y;
            const sproj = sox * b.dx + soy * b.dy;
            if (sproj >= 0 && sproj <= bestDist) {
              const sperp2 = sox * sox + soy * soy - sproj * sproj;
              const srad = (sn.r || 8) + 2;
              if (sperp2 <= srad * srad) {
                bestDist = sproj;
                hitSnake = sn;
                hitLamp = null;
                hitSheep = null;
                hitHorse = false;
                hitTarget = null;
                hitPlayerObj = null;
                hitWall = null;
              }
            }
          }
        }

        if (hitLamp) {
          const lx = b.x + b.dx * bestDist;
          const ly = b.y + b.dy * bestDist;
          if (world.breakOilLamp) world.breakOilLamp(hitLamp, lx, ly, state);
          if (b.ricocheted && world.igniteOilPuddlesNear) {
            world.igniteOilPuddlesNear(lx, ly, 38, state);
          }
          aliveBullet = false;
          break;
        }

        if (hitSnake) {
          const sx = b.x + b.dx * bestDist;
          const sy = b.y + b.dy * bestDist;
          const hitCalc = calcBulletDamage(b, bestDist);
          hitSnake.hp = Math.max(0, (hitSnake.hp || 15) - hitCalc.dmg);
          hitSnake.hitFlash = 0.16;
          G.AUDIO.playImpact('flesh');
          spawnBloodBurst(state, sx, sy, b.dx, b.dy, hitCalc.dmg, hitSnake.hp <= 0);
          if (hitSnake.hp <= 0) {
            hitSnake.alive = false;
            addDecal(state, hitSnake.x, hitSnake.y, 5, P.blood ? P.blood[2] : '#6e100c');
          }
          aliveBullet = false;
          break;
        }

        if (hitSheep) {
          const sx = b.x + b.dx * bestDist;
          const sy = b.y + b.dy * bestDist;
          const hitCalc = calcBulletDamage(b, bestDist);
          const dmg = hitCalc.dmg;
          hitSheep.hp = Math.max(0, (hitSheep.hp || 40) - dmg);
          hitSheep.hitFlash = 0.16;
          G.AUDIO.playImpact('flesh');
          pushNetEvent(state, { kind: 'impact', mat: 'flesh', x: sx, y: sy });
          spawnParticles(state, sx, sy, 8, {
            baseAngle: Math.atan2(b.dy, b.dx),
            spread: 1.2,
            minSpeed: 22,
            maxSpeed: 88,
            minLife: 0.25,
            maxLife: 0.55,
            minSize: 1.4,
            maxSize: 2.8,
            drag: 5.5,
            colors: [P.cloud ? P.cloud[0] : '#e8e3d5', P.cloud ? P.cloud[1] : '#cfc8b6', P.cloud ? P.cloud[2] : '#a8a293'],
            alpha: 0.92,
            kind: 'debris'
          });
          spawnBloodBurst(state, sx, sy, b.dx, b.dy, dmg, hitSheep.hp <= 0);
          if (hitSheep.hp <= 0) {
            hitSheep.alive = false;
            hitSheep.vx = 0;
            hitSheep.vy = 0;
            addDecal(state, hitSheep.x, hitSheep.y, 7, P.blood ? P.blood[2] : '#6e100c');
          } else {
            hitSheep.state = 'flee';
            hitSheep.stateTimer = 2.6;
            hitSheep.fleeAngle = Math.atan2(b.dy, b.dx) + G.MATH.rand(-0.5, 0.5);
            if (G.AUDIO && G.AUDIO.playSheepBleat) {
              const lp = resolvePlayer(state);
              G.AUDIO.playSheepBleat(hitSheep.x, hitSheep.y, lp ? lp.x : hitSheep.x, lp ? lp.y : hitSheep.y);
            }
          }
          aliveBullet = false;
          break;
        }

        if (hitHorse && hr) {
          const hx = b.x + b.dx * bestDist;
          const hy = b.y + b.dy * bestDist;
          const hitCalc = calcBulletDamage(b, bestDist);
          const dmg = hitCalc.dmg;
          hr.hp = Math.max(0, (hr.hp || 150) - dmg);
          hr.hitFlash = 0.14;
          G.AUDIO.playImpact('flesh');
          pushNetEvent(state, { kind: 'impact', mat: 'flesh', x: hx, y: hy });
          spawnBloodBurst(state, hx, hy, b.dx, b.dy, dmg, hr.hp <= 0);
          spawnFloatText(state, hr.x, hr.y - 12, `ЛОШАДЬ -${dmg}`, P.blood[0], false);
          scareHorse(state, world, hx, hy, 38, false);
          if (hr.hp <= 0) {
            hr.state = 'dead';
            hr.tied = false;
            hr.vx = 0;
            hr.vy = 0;
            hr.speed = 0;
            if (hr.riderId && state.players && state.players[hr.riderId]) {
              dismountHorse(state, world, state.players[hr.riderId], true, b.dy >= 0 ? -Math.PI * 0.5 : Math.PI * 0.5);
            }
            hr.riderId = null;
            spawnFloatText(state, hr.x, hr.y - 18, 'ЛОШАДЬ ПАЛА!', P.blood[0], true);
          }
          aliveBullet = false;
          break;
        }

        if (hitPlayerObj) {
          const p = hitPlayerObj;
          const bx0 = b.startX !== undefined ? b.startX : b.px;
          const by0 = b.startY !== undefined ? b.startY : b.py;
          const pcObj = p.coverObj;
          const pWaterEmpty = pcObj && (pcObj.type === 'water_barrel' || pcObj.type === 'trough') && (pcObj.waterLevel || 0) <= 0;
          const pAlreadyPierced = pcObj && b.penetratedIds && b.penetratedIds.indexOf(pcObj.id) !== -1;
          const covValid = pcObj && !pcObj.high && !pWaterEmpty && !pAlreadyPierced;
          const protectedByCover = p.inCover && !p.peeking && covValid && segmentCrossesRect(bx0, by0, p.x, p.y, pcObj);
          if (p.rolling) {
            // В перекате пуля пролетает мимо игрока
            b.x += b.dx * (bestDist + 2);
            b.y += b.dy * (bestDist + 2);
            b.traveled = (b.traveled || 0) + bestDist + 2;
            remDist -= (bestDist + 2);
            continue;
          }
          if (protectedByCover) {
            const canPierce = !!(pcObj.breached && (b.penetrations || 0) < (b.maxPenetrations || 0));
            const mat = p.coverObj.mat || 'wood';
            const ix = b.x + b.dx * bestDist;
            const iy = b.y + b.dy * bestDist;
            G.AUDIO.playImpact(mat === 'hay' ? 'wood' : mat);
            pushNetEvent(state, { kind: 'impact', mat: mat === 'hay' ? 'wood' : mat, x: ix, y: iy });
            spawnCoverImpact(state, ix, iy, mat, Math.atan2(-b.dy, -b.dx));
            if (world.damageSolid) world.damageSolid(p.coverObj, b.damage || 18, ix, iy, b.dx, b.dy, state, b.weaponId);
            if (mat === 'water' && (p.coverObj.waterLevel || 0) > 0) {
              addWaterRipple(state, p.coverObj.id, ix, iy, 9, 0.6);
            }
            if (!canPierce) {
              aliveBullet = false;
              break;
            }
            b.penetrations = (b.penetrations || 0) + 1;
            b.damage = Math.max(4, Math.round(b.damage * 0.60));
            if (!b.penetratedIds) b.penetratedIds = [];
            b.penetratedIds.push(pcObj.id);
          }

          if (isPlayerGod(state, p)) {
            p.hp = Math.max(p.hp || 100, p.maxHp || 100);
            p.critical = false;
            p.bleeding = false;
            p.stunTimer = 0;
            spawnParticles(state, p.x, p.y, 4, {
              baseAngle: Math.atan2(-b.dy, -b.dx),
              spread: 0.9,
              minSpeed: 30,
              maxSpeed: 80,
              minLife: 0.08,
              maxLife: 0.18,
              minSize: 1.2,
              maxSize: 2.0,
              colors: [P.brass ? P.brass[0] : '#f2da91', '#ffffff'],
              kind: 'spark'
            });
            aliveBullet = false;
            break;
          }

          const hitCalc = calcBulletDamage(b, bestDist);
          const dmg = hitCalc.dmg;
          p.hp = Math.max(0, (p.hp !== undefined ? p.hp : 100) - dmg);
          p.hurtTimer = 0.35;
          p.regenTimer = 0;
          if (p.bandaging) {
            cancelBandaging(state, 'ПЕРЕВЯЗКА СБИТА!', p);
          }
          if (p.hp > 0 && p.hp <= 25) {
            const wasCrit = p.critical;
            p.critical = true;
            p.bleeding = true;
            p.concussion = Math.max(p.concussion || 0, 0.90);
            if (!wasCrit) {
              showToastFor(state, p, 'КРИТИЧЕСКОЕ РАНЕНИЕ! [Q] — БИНТЫ', 2.0);
            }
          }
          if (p.hp <= 0 && ownerType === 'player' && b.ownerId && state.players && state.players[b.ownerId]) {
            const killer = state.players[b.ownerId];
            killer.kills = (killer.kills || 0) + 1;
            if (isLocalPlayer(state, killer)) triggerHitConfirm(state, true);
          } else if (ownerType === 'player' && b.ownerId && state.players && state.players[b.ownerId] && isLocalPlayer(state, state.players[b.ownerId])) {
            triggerHitConfirm(state, false);
          }
          G.AUDIO.playImpact('flesh');
          pushNetEvent(state, { kind: 'impact', mat: 'flesh', x: p.x, y: p.y });
          if (isLocalPlayer(state, p)) {
            state.camera.shakeMag = Math.max(state.camera.shakeMag, 4.5);
          }
          spawnBloodBurst(state, p.x, p.y, b.dx, b.dy, dmg, p.hp <= 0);
          spawnFloatText(state, p.x, p.y - 8, b.ricocheted ? `РИКОШЕТ! -${dmg}` : `-${dmg}`, b.ricocheted ? P.brass[0] : P.blood[0], true);
          aliveBullet = false;
          break;
        }

        if (hitTarget) {
          const hx = b.x + b.dx * bestDist;
          const hy = b.y + b.dy * bestDist;
          const attacker = (ownerType === 'player')
            ? ((b.ownerId && state.players && state.players[b.ownerId]) || resolvePlayer(state))
            : null;
          let shooterBandit = null;
          if (ownerType === 'bandit' && b.shooterId && world.targets) {
            for (let si = 0; si < world.targets.length; si++) {
              if (world.targets[si].id === b.shooterId) {
                shooterBandit = world.targets[si];
                break;
              }
            }
          }

          if (hitTarget.kind === 'bandit') {
            const bx0 = b.startX !== undefined ? b.startX : b.px;
            const by0 = b.startY !== undefined ? b.startY : b.py;
            const bcObj = hitTarget.coverObj;
            const bWaterEmpty = bcObj && (bcObj.type === 'water_barrel' || bcObj.type === 'trough') && (bcObj.waterLevel || 0) <= 0;
            const bAlreadyPierced = bcObj && b.penetratedIds && b.penetratedIds.indexOf(bcObj.id) !== -1;
            const bCovValid = bcObj && !bcObj.high && !bWaterEmpty && !bAlreadyPierced;
            const banditProtected = hitTarget.inCover && !hitTarget.peeking && bCovValid && segmentCrossesRect(bx0, by0, hitTarget.x, hitTarget.y, bcObj);
            if (banditProtected) {
              const canPierce = !!(bcObj.breached && (b.penetrations || 0) < (b.maxPenetrations || 0));
              const mat = hitTarget.coverObj.mat || 'wood';
              G.AUDIO.playImpact(mat === 'hay' ? 'wood' : mat);
              pushNetEvent(state, { kind: 'impact', mat: mat === 'hay' ? 'wood' : mat, x: hx, y: hy });
              spawnCoverImpact(state, hx, hy, mat, Math.atan2(-b.dy, -b.dx));
              if (world.damageSolid) world.damageSolid(hitTarget.coverObj, b.damage || 22, hx, hy, b.dx, b.dy, state, b.weaponId);
              if (mat === 'water' && (hitTarget.coverObj.waterLevel || 0) > 0) {
                addWaterRipple(state, hitTarget.coverObj.id, hx, hy, 9, 0.6);
              }
              if (!canPierce) {
                aliveBullet = false;
                break;
              }
              b.penetrations = (b.penetrations || 0) + 1;
              b.damage = Math.max(4, Math.round(b.damage * 0.60));
              if (!b.penetratedIds) b.penetratedIds = [];
              b.penetratedIds.push(bcObj.id);
            }

            hitTarget.hitFlash = 0.14;
            hitTarget.wobble = 1.0;

            if (hitTarget.aiState !== 'combat' && hitTarget.aiState !== 'flee' && hitTarget.aiState !== 'no_ammo_retreat') {
              const reactTarget = attacker || shooterBandit;
              if (reactTarget) {
                if (attacker) {
                  hitTarget.aiState = 'combat';
                  hitTarget.lastKnownX = attacker.x;
                  hitTarget.lastKnownY = attacker.y;
                } else {
                  hitTarget.aiState = 'alert';
                  hitTarget.alertTimer = 2.5;
                }
                hitTarget.angle = Math.atan2(reactTarget.y - hitTarget.y, reactTarget.x - hitTarget.x);
              }
            }

            const hitCalc = calcBulletDamage(b, bestDist);
            // Локальные попадания: центр (<= 0.58 * rad) = корпус 100%, край (> 0.58 * rad) = рука 60%
            const perpRatio = Math.sqrt(Math.max(0, hitTargetPerp2)) / Math.max(1, hitTargetRad);
            const isArmHit = perpRatio > 0.58;
            const dealt = isArmHit ? Math.max(5, Math.round(hitCalc.dmg * 0.60)) : hitCalc.dmg;

            hitTarget.hp -= dealt;
            hitTarget.hurtTimer = 0.28;
            if (isArmHit) {
              hitTarget.armWounded = true;
              hitTarget.armWoundLevel = Math.min(2, (hitTarget.armWoundLevel || 0) + 1);
            }
            const isFatal = hitTarget.hp <= 0;

            G.AUDIO.playImpact('flesh');
            pushNetEvent(state, { kind: 'impact', mat: 'flesh', x: hx, y: hy });
            if (attacker && isLocalPlayer(state, attacker)) triggerHitConfirm(state, isFatal);

            const knock = (isFatal ? 165 : 85) * G.MATH.clamp(dealt / 55, 0.5, 1.7);
            hitTarget.knockVx = (hitTarget.knockVx || 0) + b.dx * knock;
            hitTarget.knockVy = (hitTarget.knockVy || 0) + b.dy * knock;
            if (attacker && isLocalPlayer(state, attacker)) {
              state.camera.shakeMag = Math.max(state.camera.shakeMag, isFatal ? 3.5 : 1.5);
            }
            spawnBloodBurst(state, hx, hy, b.dx, b.dy, dealt, isFatal);

            if (isFatal) {
              const fTxt = b.ricocheted ? `РИКОШЕТ! -${dealt}` : (isArmHit ? `РУКА -${dealt}` : `-${dealt}`);
              spawnFloatText(state, hitTarget.x, hitTarget.y - 4, fTxt, b.ricocheted ? P.brass[0] : P.blood[0], true);
              hitTarget.alive = false;
              hitTarget.respawnTimer = 0;
              hitTarget.deathAnim = 0;
              hitTarget.bloodPool = 0;
              hitTarget.fallAngle = Math.atan2(b.dy, b.dx) + G.MATH.rand(-0.35, 0.35);
              spawnFlyingHat(state, hitTarget.x, hitTarget.y, b.dx, b.dy, hitTarget.hatColor, hitTarget.hatBand);
              if (attacker) attacker.kills = (attacker.kills || 0) + 1;
              if (attacker && isLocalPlayer(state, attacker) && G.addKill) {
                const unlockedHats = G.addKill(1);
                if (unlockedHats && unlockedHats.length > 0) {
                  const lastH = unlockedHats[unlockedHats.length - 1];
                  showToast(state, `НОВАЯ ШЛЯПА: ${lastH.name.toUpperCase()}`, 2.2);
                }
              }
            } else {
              const lbl = b.ricocheted ? `РИКОШЕТ! -${dealt}` : (isArmHit ? `РУКА -${dealt}` : `-${dealt}`);
              const col = b.ricocheted ? P.brass[0] : (isArmHit ? P.canyon[0] : (hitCalc.mult < 0.8 ? P.woodPale[0] : P.grass[0]));
              spawnFloatText(state, hitTarget.x, hitTarget.y - 2, lbl, col, !!b.ricocheted);

              if (hitTarget.aiState !== 'flee' && hitTarget.aiState !== 'no_ammo_retreat' && !hitTarget.fledOnce && !hitTarget.isReinforcement && (state.fleeCooldown || 0) <= 0) {
                let anyFleeing = false;
                for (let fIdx = 0; fIdx < world.targets.length; fIdx++) {
                  const ft = world.targets[fIdx];
                  if (ft.kind === 'bandit' && ft.alive && ft.aiState === 'flee' && !ft.noAmmoFlee) {
                    anyFleeing = true;
                    break;
                  }
                }
                const fleeChance = hitTarget.hp < hitTarget.maxHp * 0.35 ? 0.05 : 0;
                if (!anyFleeing && Math.random() < fleeChance) {
                  state.fleeCooldown = 65.0;
                  hitTarget.aiState = 'flee';
                  hitTarget.noAmmoFlee = false;
                  hitTarget.fledOnce = true;
                  hitTarget.fleeTimer = 5.5;
                  hitTarget.fleeTarget = world.pickFleePoint ? world.pickFleePoint(hitTarget, playersList) : null;
                  hitTarget.inCover = false;
                  hitTarget.peeking = false;
                  hitTarget.aimTimer = 0;
                  hitTarget.telegraphFrac = 0;
                  spawnFloatText(state, hitTarget.x, hitTarget.y - 16, 'ЗА ПОДМОГОЙ!', P.brass[0], false);
                }
              }
            }
          } else if (hitTarget.kind === 'bottle') {
            hitTarget.hitFlash = 0.14;
            hitTarget.wobble = 1.0;
            hitTarget.alive = false;
            hitTarget.respawnTimer = 8.0;
            G.AUDIO.playImpact('glass');
            pushNetEvent(state, { kind: 'impact', mat: 'glass', x: hx, y: hy });
            triggerHitConfirm(state, false);
            const bAng = Math.atan2(b.dy, b.dx);
            spawnParticles(state, hx, hy, 14, {
              baseAngle: bAng, spread: 1.35, minSpeed: 45, maxSpeed: 155,
              minLife: 0.22, maxLife: 0.50, minSize: 1.2, maxSize: 2.4, drag: 6.5,
              colors: [P.glass[0], P.glass[1], P.glass[2], P.glass[3]], alpha: 0.92, kind: 'debris'
            });
            spawnParticles(state, hx, hy, 8, {
              baseAngle: bAng, spread: 1.55, minSpeed: 20, maxSpeed: 70,
              minLife: 0.14, maxLife: 0.34, minSize: 1.0, maxSize: 1.8, drag: 8.0,
              colors: [P.cloud[0], P.glass[0]], alpha: 0.70, kind: 'debris'
            });
            addDecal(state, hitTarget.x, hitTarget.y, 5, 'rgba(77, 112, 117, 0.42)', { kind: 'glasspool' });
          } else {
            const hitCalc = calcBulletDamage(b, bestDist);
            hitTarget.hp -= hitCalc.dmg;
            G.AUDIO.playImpact('wood');
            spawnParticles(state, hx, hy, 9, {
              baseAngle: Math.atan2(b.dy, b.dx), spread: 0.8, minSpeed: 35, maxSpeed: 115,
              minLife: 0.22, maxLife: 0.48, minSize: 1.5, maxSize: 3.0,
              colors: [P.woodWarm[0], P.woodWarm[1], P.woodWarm[2]], kind: 'debris'
            });
            if (hitTarget.hp <= 0) {
              hitTarget.alive = false;
              hitTarget.respawnTimer = 6.5;
              addDecal(state, hitTarget.x, hitTarget.y, 6, 'rgba(65, 42, 24, 0.45)');
            }
          }

          aliveBullet = false;
          break;
        }

        if (hitWall) {
          const seg = hitWall.seg;
          const solid = seg.solid || null;
          const mat = seg.mat || 'wood';
          const reflAngle = Math.atan2(hitWall.ny, hitWall.nx);

          if (seg.door) {
            const d = seg.door;
            d.vel += (b.dx >= 0 ? -1 : 1) * (d.baseAngle > 0 ? 1 : -1) * 4.5;
          }

          // Реальный рикошет: от металла cosInc < 0.78, от камня/скалы cosInc < 0.62 (до 2 рикошетов)
          const cosInc = Math.abs(b.dx * hitWall.nx + b.dy * hitWall.ny);
          const ricCosLimit = mat === 'metal' ? 0.78 : (mat === 'rock' ? 0.62 : 0);
          if ((mat === 'rock' || mat === 'metal') && cosInc < ricCosLimit && (b.ricochets || 0) < 2) {
            const dot = b.dx * hitWall.nx + b.dy * hitWall.ny;
            b.dx -= 2 * dot * hitWall.nx;
            b.dy -= 2 * dot * hitWall.ny;
            const nlen = Math.hypot(b.dx, b.dy) || 1;
            b.dx /= nlen; b.dy /= nlen;
            b.x = hitWall.x + hitWall.nx * 1.8;
            b.y = hitWall.y + hitWall.ny * 1.8;
            b.damage = Math.max(4, Math.round(b.damage * 0.65));
            b.speed = Math.round(b.speed * 0.80);
            b.ricocheted = true;
            b.ricochets = (b.ricochets || 0) + 1;
            b.canHitOwner = true;
            b.justRicochetedId = seg.id;
            b.traveled = (b.traveled || 0) + bestDist;
            remDist -= bestDist;

            const ricLstW = resolvePlayer(state);
            if (G.AUDIO.playRicochet) G.AUDIO.playRicochet(hitWall.x, hitWall.y, ricLstW ? ricLstW.x : hitWall.x, ricLstW ? ricLstW.y : hitWall.y);
            pushNetEvent(state, { kind: 'ricochet', x: hitWall.x, y: hitWall.y });
            spawnParticles(state, hitWall.x, hitWall.y, mat === 'metal' ? 16 : 12, {
              baseAngle: Math.atan2(b.dy, b.dx), spread: 0.62, minSpeed: 90, maxSpeed: 230,
              minLife: 0.14, maxLife: 0.34, minSize: 1.3, maxSize: 2.5,
              colors: [P.brass[0], P.grass[0], '#ffffff'], kind: 'spark'
            });
            if (world.igniteOilPuddlesNear) {
              world.igniteOilPuddlesNear(hitWall.x, hitWall.y, 38, state);
            }
            continue;
          }

          if (mat === 'metal') {
            // Сноп искр при лобовом попадании в металл (способно поджечь масло рядом)
            spawnParticles(state, hitWall.x, hitWall.y, 12, {
              baseAngle: reflAngle, spread: 0.85, minSpeed: 75, maxSpeed: 185,
              minLife: 0.12, maxLife: 0.28, minSize: 1.2, maxSize: 2.3,
              colors: [P.brass[0], P.grass[0], '#ffffff'], kind: 'spark'
            });
          }
          if (world.igniteOilPuddlesNear) {
            world.igniteOilPuddlesNear(hitWall.x, hitWall.y, 38, state);
          }

          // Проверяем пробитие ДО обновления состояния бреши (чтобы 2-й выстрел Винчестера обнулил укрытие, а пробитие началось с 3-го)
          const penetrable = isPenetrableType(seg.type, solid, b);

          // Наносим повреждение укрытию / пробиваем бочку с водой или корыто
          if (solid && solid.destructible && world.damageSolid) {
            world.damageSolid(solid, b.damage || 22, hitWall.x, hitWall.y, b.dx, b.dy, state, b.weaponId);
          }

          // Пробитие дверей, пробитых укрытий (с 3-го выстрела) и ёмкостей с водой калибром .44
          if (penetrable && (b.penetrations || 0) < (b.maxPenetrations || 0)) {
            G.AUDIO.playImpact(seg.type === 'hay' ? 'wood' : mat);
            pushNetEvent(state, { kind: 'impact', mat: seg.type === 'hay' ? 'wood' : mat, x: hitWall.x, y: hitWall.y });
            const hasWater = mat === 'water' && solid && (solid.waterLevel === undefined || solid.waterLevel > 0);
            if (hasWater) {
              addWaterRipple(state, solid.id, hitWall.x, hitWall.y, 10, 0.7);
            }
            const debrisCols = seg.type === 'hay'
              ? [P.grass[0], P.grass[1], P.grass[2]]
              : (hasWater ? [P.water[0], P.water[1], P.woodWarm[1]] : [P.woodWarm[0], P.woodWarm[1], P.woodWarm[2]]);
            // Щепки / брызги на входе
            spawnParticles(state, hitWall.x, hitWall.y, hasWater ? 10 : 6, {
              baseAngle: reflAngle, spread: 0.85, minSpeed: 30, maxSpeed: 98,
              minLife: 0.16, maxLife: 0.38, minSize: 1.2, maxSize: 2.5,
              colors: debrisCols,
              kind: 'debris'
            });
            // Щепки / брызги на выходе
            const exitPt = seg.type === 'door'
              ? { x: hitWall.x + b.dx * 5, y: hitWall.y + b.dy * 5 }
              : rayExitRect(hitWall.x, hitWall.y, b.dx, b.dy, solid);
            spawnParticles(state, exitPt.x, exitPt.y, hasWater ? 12 : 8, {
              baseAngle: Math.atan2(b.dy, b.dx), spread: 0.72, minSpeed: 45, maxSpeed: 138,
              minLife: 0.18, maxLife: 0.44, minSize: 1.3, maxSize: 2.6,
              colors: debrisCols,
              kind: 'debris'
            });

            b.penetrations = (b.penetrations || 0) + 1;
            b.damage = Math.max(4, Math.round(b.damage * 0.60));
            if (!b.penetratedIds) b.penetratedIds = [];
            b.penetratedIds.push(seg.id);

            const jump = Math.hypot(exitPt.x - b.x, exitPt.y - b.y) + 1.2;
            b.x = exitPt.x + b.dx * 1.2;
            b.y = exitPt.y + b.dy * 1.2;
            b.traveled = (b.traveled || 0) + jump;
            remDist = Math.max(0, remDist - jump);
            continue;
          }

          // Остановка пули о препятствие
          G.AUDIO.playImpact(seg.type === 'hay' ? 'wood' : mat);
          pushNetEvent(state, { kind: 'impact', mat: seg.type === 'hay' ? 'wood' : mat, x: hitWall.x, y: hitWall.y });
          if (mat === 'water') {
            const hasWater = !solid || (solid.waterLevel === undefined || solid.waterLevel > 0);
            spawnParticles(state, hitWall.x, hitWall.y, hasWater ? 14 : 8, {
              baseAngle: reflAngle, spread: 1.25, minSpeed: 30, maxSpeed: 105,
              minLife: 0.25, maxLife: 0.55, minSize: 1.4, maxSize: 3.0,
              colors: hasWater ? [P.water[0], P.water[1], P.cloud[0]] : [P.woodWarm[0], P.woodWarm[1], P.woodWarm[2]],
              kind: 'debris'
            });
            if (hasWater) {
              addWaterRipple(state, seg.id, hitWall.x, hitWall.y, 13, 1.0);
              addWaterRipple(state, seg.id, hitWall.x, hitWall.y, 9, 0.7);
            }
          } else if (mat === 'rock') {
            spawnParticles(state, hitWall.x, hitWall.y, 10, {
              baseAngle: reflAngle, spread: 0.85, minSpeed: 45, maxSpeed: 145,
              minLife: 0.16, maxLife: 0.42, minSize: 1.2, maxSize: 2.6,
              colors: [P.grass[0], P.canyon[0], P.stone[1]], kind: 'spark'
            });
          } else {
            spawnParticles(state, hitWall.x, hitWall.y, 8, {
              baseAngle: reflAngle, spread: 0.85, minSpeed: 30, maxSpeed: 95,
              minLife: 0.18, maxLife: 0.40, minSize: 1.3, maxSize: 2.6,
              colors: seg.type === 'hay' ? [P.grass[0], P.grass[1], P.grass[2]] : [P.woodWarm[0], P.woodWarm[1], P.woodWarm[2]],
              kind: 'debris'
            });
          }
          addDecal(state, hitWall.x - b.dx * 1, hitWall.y - b.dy * 1, 2.0, 'rgba(28, 18, 12, 0.72)');
          aliveBullet = false;
          break;
        }

        // Свободный полёт на остаток шага
        b.x += b.dx * remDist;
        b.y += b.dy * remDist;
        b.traveled = (b.traveled || 0) + remDist;
        remDist = 0;
        b.justRicochetedId = null;
      }

      if (!aliveBullet || b.x < 0 || b.x > world.width || b.y < 0 || b.y > world.height) {
        state.bullets.splice(i, 1);
      }
    }
  }

  function updateBloodDrops(state, world, dt) {
    if (!state.bloodDrops) return;
    for (let i = state.bloodDrops.length - 1; i >= 0; i--) {
      const bd = state.bloodDrops[i];
      bd.life -= dt;
      if (bd.life <= 0) {
        state.bloodDrops.splice(i, 1);
        continue;
      }

      bd.px = bd.x;
      bd.py = bd.y;

      const nx = bd.x + bd.vx * dt;
      const ny = bd.y + bd.vy * dt;

      let hitSolid = false;
      for (let j = 0; j < world.solids.length; j++) {
        const s = world.solids[j];
        if (s.walkThrough || s._storyHidden) continue;
        if (nx >= s.x && nx <= s.x + s.w && ny >= s.y && ny <= s.y + s.h) {
          addDecal(state, bd.x, bd.y, bd.size * 0.95, bd.color, {
            kind: 'blood',
            angle: Math.atan2(bd.vy, bd.vx),
            stretch: 1.4
          });
          hitSolid = true;
          break;
        }
      }
      if (hitSolid) {
        state.bloodDrops.splice(i, 1);
        continue;
      }

      bd.x = nx;
      bd.y = ny;

      const airDrag = Math.exp(-2.8 * dt);
      bd.vx *= airDrag;
      bd.vy *= airDrag;
      bd.vz -= 370 * dt;
      bd.z += bd.vz * dt;

      if (bd.z <= 0) {
        const spd = Math.hypot(bd.vx, bd.vy);
        const ang = Math.atan2(bd.vy, bd.vx);
        const stretch = G.MATH.clamp(1 + spd / 95, 1.0, 2.8);
        addDecal(state, bd.x, bd.y, Math.max(1.2, bd.size * 0.85), bd.color, {
          kind: 'blood',
          angle: ang,
          stretch: stretch
        });
        if (spd > 65 && Math.random() < 0.55) {
          addDecal(
            state,
            bd.x + Math.cos(ang) * G.MATH.rand(2.5, 5.5),
            bd.y + Math.sin(ang) * G.MATH.rand(2.5, 5.5),
            Math.max(1.0, bd.size * 0.48),
            bd.color,
            { kind: 'blood', angle: ang, stretch: 1.2 }
          );
        }
        state.bloodDrops.splice(i, 1);
      }
    }
  }

  function updateFlyingHats(state, world, dt) {
    if (!state.flyingHats) return;
    for (let i = state.flyingHats.length - 1; i >= 0; i--) {
      const h = state.flyingHats[i];
      h.life -= dt;
      if (h.life <= 0) {
        state.flyingHats.splice(i, 1);
        continue;
      }
      if (h.settled) continue;

      const nx = h.x + h.vx * dt;
      const ny = h.y + h.vy * dt;
      let hit = false;
      for (let j = 0; j < world.solids.length; j++) {
        const s = world.solids[j];
        if (s.walkThrough || s._storyHidden) continue;
        if (nx > s.x - 4 && nx < s.x + s.w + 4 && ny > s.y - 4 && ny < s.y + s.h + 4) {
          h.vx = -h.vx * 0.4;
          h.vy = -h.vy * 0.4;
          hit = true;
          break;
        }
      }
      if (!hit) {
        h.x = nx;
        h.y = ny;
      }

      h.vz -= 260 * dt;
      h.z += h.vz * dt;
      h.rot += h.vrot * dt;

      if (h.z <= 0) {
        h.z = 0;
        if (Math.abs(h.vz) > 20 && h.bounces < 3) {
          h.vz = -h.vz * 0.42;
          h.vx *= 0.62;
          h.vy *= 0.62;
          h.vrot *= 0.55;
          h.bounces += 1;
        } else {
          h.vz = 0;
          h.vx *= 0.78;
          h.vy *= 0.78;
          h.vrot *= 0.65;
          if (Math.hypot(h.vx, h.vy) < 4) {
            h.vx = 0;
            h.vy = 0;
            h.vrot = 0;
            h.settled = true;
          }
        }
      }
    }
  }

  function updateShells(state, world, dt) {
    for (let i = state.shells.length - 1; i >= 0; i--) {
      const sh = state.shells[i];
      sh.life -= dt;
      if (sh.life <= 0) {
        state.shells.splice(i, 1);
        continue;
      }
      if (sh.settled) continue;

      const nx = sh.x + sh.vx * dt;
      const ny = sh.y + sh.vy * dt;

      let bouncedWall = false;
      for (let j = 0; j < world.solids.length; j++) {
        const s = world.solids[j];
        if (s.walkThrough || s._storyHidden) continue;
        if (nx > s.x - 2 && nx < s.x + s.w + 2 && ny > s.y - 2 && ny < s.y + s.h + 2) {
          const prevInsideX = sh.x > s.x - 2 && sh.x < s.x + s.w + 2;
          if (prevInsideX) sh.vy = -sh.vy * 0.55;
          else sh.vx = -sh.vx * 0.55;
          bouncedWall = true;
          break;
        }
      }
      if (!bouncedWall) {
        sh.x = nx;
        sh.y = ny;
      }

      sh.vz -= 290 * dt;
      sh.z += sh.vz * dt;
      sh.rot += sh.vrot * dt;

      if (sh.z <= 0) {
        sh.z = 0;
        const speed = Math.hypot(sh.vx, sh.vy, sh.vz);
        if (Math.abs(sh.vz) > 18 && sh.bounces < 4) {
          sh.vz = -sh.vz * 0.46;
          sh.vx *= 0.66;
          sh.vy *= 0.66;
          sh.vrot *= 0.6;
          sh.bounces += 1;
          G.AUDIO.playShellBounce(world.getSurfaceAt(sh.x, sh.y), speed / 120);
        } else {
          sh.vz = 0;
          sh.vx *= 0.82;
          sh.vy *= 0.82;
          sh.vrot *= 0.7;
          if (Math.hypot(sh.vx, sh.vy) < 4) {
            sh.vx = 0;
            sh.vy = 0;
            sh.vrot = 0;
            sh.settled = true;
          }
        }
      }
    }
  }

  function updateCriticalAndBleeding(state, world, dt) {
    const playersList = getPlayers(state);
    const localP = resolvePlayer(state);
    if (!state.bloodTrail) state.bloodTrail = [];

    // Срок жизни капель кровавого следа на земле
    for (let i = state.bloodTrail.length - 1; i >= 0; i--) {
      state.bloodTrail[i].life -= dt;
      if (state.bloodTrail[i].life <= 0) state.bloodTrail.splice(i, 1);
    }

    for (let pi = 0; pi < playersList.length; pi++) {
      const p = playersList[pi];
      if (!p) continue;
      if (isPlayerGod(state, p)) {
        p.hp = p.maxHp || 100;
        p.critical = false;
        p.bleeding = false;
        p.dead = false;
        p.stunTimer = 0;
      }
      if (p.dead) {
        p.concussion = 0;
        p.bandaging = false;
        if (isLocalPlayer(state, p) && G.AUDIO.setConcussion) G.AUDIO.setConcussion(0);
        continue;
      }

      if (p.hp > 0 && p.hp <= 25 && !p.critical) {
        p.critical = true;
        p.bleeding = true;
        p.concussion = Math.max(p.concussion || 0, 0.85);
      }

      if (p.bleeding) {
        p.hp = Math.max(0, p.hp - 1.15 * dt);
        p.bleedDripTimer = (p.bleedDripTimer || 0) - dt;
        if (p.bleedDripTimer <= 0) {
          p.bleedDripTimer = p.speed > 18 ? 0.36 : 0.65;
          state.bloodTrail.push({
            playerId: p.id,
            x: p.x + G.MATH.rand(-3, 3),
            y: p.y + G.MATH.rand(-2, 3),
            life: 14.0,
            maxLife: 14.0,
            r: 1.6 + Math.random() * 1.4
          });
          if (state.bloodTrail.length > 90) state.bloodTrail.shift();
        }
      }

      // Контузия и звон в ушах (при критическом ранении или стрельбе тяжёлым калибром в комнате)
      if (p.indoorRingTimer > 0) {
        p.indoorRingTimer = Math.max(0, p.indoorRingTimer - dt);
      }
      const baseCritConc = p.critical ? 0.78 : 0;
      const roomRing = p.indoorRingTimer > 0 ? Math.min(0.22, p.indoorRingTimer * 0.18) : 0;
      const targetConc = Math.max(baseCritConc, roomRing);
      const rate = targetConc > (p.concussion || 0) ? 6.0 : 1.6;
      p.concussion = G.MATH.lerp(p.concussion || 0, targetConc, Math.min(1, dt * rate));
      if (p === localP && G.AUDIO.setConcussion) G.AUDIO.setConcussion(p.concussion);
    }

    // Выслеживание ближайшего игрока по свежему кровавому следу бандитами в patrol / search / alert
    if (state.bloodTrail.length > 0 && world && world.targets) {
      for (let i = 0; i < world.targets.length; i++) {
        const t = world.targets[i];
        if (t.kind !== 'bandit' || !t.alive) continue;
        if (t.aiState !== 'patrol' && t.aiState !== 'search' && t.aiState !== 'alert') continue;
        let newestHit = null;
        let bestAge = -1;
        for (let bIdx = 0; bIdx < state.bloodTrail.length; bIdx++) {
          const tr = state.bloodTrail[bIdx];
          if (tr.life < 2.0) continue;
          const d = G.MATH.dist(t.x, t.y, tr.x, tr.y);
          if (d <= 145 && bIdx > bestAge) {
            bestAge = bIdx;
            newestHit = tr;
          }
        }
        if (newestHit) {
          const trailOwner = (newestHit.playerId && state.players && state.players[newestHit.playerId]) || localP;
          t.aiState = 'search';
          t.searchRole = 'hunt';
          t.searchTimer = Math.max(t.searchTimer || 0, 7.5);
          t.lastKnownX = (trailOwner && !trailOwner.dead) ? trailOwner.x : newestHit.x;
          t.lastKnownY = (trailOwner && !trailOwner.dead) ? trailOwner.y : newestHit.y;
        }
      }
    }
  }

  function spawnTumbleweed(world) {
    const startX = world ? G.MATH.clamp(G.MATH.rand(world.width * 0.35, world.width - 60), 400, world.width - 50) : 1400;
    let startY = world ? G.MATH.rand(105, world.height - 105) : 360;
    if (world && world.getIndoorZoneAt && world.getIndoorZoneAt(startX, startY)) {
      startY = 660;
    }
    return {
      x: startX,
      y: startY,
      r: 7 + Math.floor(Math.random() * 4),
      rot: Math.random() * Math.PI * 2,
      bouncePhase: Math.random() * Math.PI * 2,
      speedScale: G.MATH.rand(0.85, 1.25)
    };
  }

  function triggerDustStorm(state, world, forcedDuration, suppressToast) {
    if (!state.dustStorm) {
      state.dustStorm = { active: false, intensity: 0, timer: 0, duration: 0, cooldown: 38, tumbleweeds: [] };
    }
    const ds = state.dustStorm;
    ds.active = true;
    ds.timer = 0;
    ds.duration = forcedDuration || G.MATH.rand(25, 40);
    ds.intensity = Math.max(ds.intensity || 0, 0.05);
    if (!ds.tumbleweeds || ds.tumbleweeds.length < 7) {
      ds.tumbleweeds = [];
      for (let i = 0; i < 7; i++) ds.tumbleweeds.push(spawnTumbleweed(world));
    }
    if (!suppressToast) {
      showToast(state, 'НАДВИГАЕТСЯ ПЫЛЬНАЯ БУРЯ!', 1.8);
    }
  }

  function stopDustStorm(state) {
    if (!state || !state.dustStorm) return;
    state.dustStorm.active = false;
    state.dustStorm.intensity = 0;
    state.dustStorm.timer = 0;
    if (G.AUDIO.updateWind) G.AUDIO.updateWind(0, true, state.time);
  }

  function updateDustStorm(state, world, dt) {
    if (!state.dustStorm) return;
    const ds = state.dustStorm;
    if (!ds.active) {
      ds.intensity = Math.max(0, (ds.intensity || 0) - dt * 0.4);
      ds.cooldown = (ds.cooldown !== undefined ? ds.cooldown : 38) - dt;
      if (ds.cooldown <= 0) {
        ds.cooldown = G.MATH.rand(38, 60);
        if (Math.random() < 0.45) {
          triggerDustStorm(state, world);
        }
      }
      if (G.AUDIO.updateWind) {
        const lp = resolvePlayer(state);
        const out = !lp || !world.getIndoorZoneAt || !world.getIndoorZoneAt(lp.x, lp.y);
        G.AUDIO.updateWind(ds.intensity, out, state.time);
      }
      return;
    }

    ds.timer += dt;
    const dur = Math.max(8, ds.duration || 30);
    const fadeIn = Math.min(1, ds.timer / 3.5);
    const fadeOut = Math.min(1, Math.max(0, (dur - ds.timer) / 4.0));
    ds.intensity = Math.min(fadeIn, fadeOut);

    if (ds.timer >= dur) {
      ds.active = false;
      ds.intensity = 0;
      ds.cooldown = G.MATH.rand(40, 62);
      showToast(state, 'ПЫЛЬНАЯ БУРЯ УТИХЛА', 1.4);
    }

    // Движение и подпрыгивание перекати-поле только снаружи indoorZones
    const iv = ds.intensity || 0;
    if (ds.tumbleweeds && world) {
      const vx = -94 * (0.35 + 0.65 * iv);
      const vy = 32 * (0.35 + 0.65 * iv);
      for (let i = 0; i < ds.tumbleweeds.length; i++) {
        const tw = ds.tumbleweeds[i];
        tw.x += vx * tw.speedScale * dt;
        tw.y += vy * tw.speedScale * dt;
        tw.rot -= dt * (3.2 + 3.0 * iv) * tw.speedScale;
        tw.bouncePhase += dt * (5.2 + 2.5 * iv);

        // Обход / не попадают внутрь салуна и высоких стен
        if (world.getIndoorZoneAt && world.getIndoorZoneAt(tw.x, tw.y)) {
          tw.y = world.saloon.y + world.saloon.h + 18;
        }
        if (tw.x < -30 || tw.y > world.height + 20) {
          const respawned = spawnTumbleweed(world);
          const maxTwY = (world.layout && world.layout.streetBot) ? world.layout.streetBot + 50 : 660;
          tw.x = world.width - G.MATH.rand(20, 120);
          tw.y = G.MATH.rand(90, Math.min(world.height - 90, maxTwY));
          tw.speedScale = respawned.speedScale;
        }
      }
    }

    if (G.AUDIO.updateWind) {
      const lp = resolvePlayer(state);
      const out = !lp || !world.getIndoorZoneAt || !world.getIndoorZoneAt(lp.x, lp.y);
      G.AUDIO.updateWind(iv, out, state.time);
    }
  }

  function updateParticles(state, world, dt) {
    const stormInt = (state.dustStorm && state.dustStorm.active) ? (state.dustStorm.intensity || 0) : 0;
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      if (stormInt > 0.05 && pt.kind === 'smoke' && (!world || !world.getIndoorZoneAt || !world.getIndoorZoneAt(pt.x, pt.y))) {
        pt.vx -= 46 * stormInt * dt;
        pt.vy += 16 * stormInt * dt;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      const damp = Math.exp(-pt.drag * dt);
      pt.vx *= damp;
      pt.vy *= damp;
      pt.size += pt.grow * dt;
    }

    for (let i = state.debugRays.length - 1; i >= 0; i--) {
      state.debugRays[i].life -= dt;
      if (state.debugRays[i].life <= 0) {
        state.debugRays.splice(i, 1);
      }
    }

    if (state.waterRipples) {
      for (let i = state.waterRipples.length - 1; i >= 0; i--) {
        const rp = state.waterRipples[i];
        rp.life -= dt;
        rp.r += rp.speed * dt;
        if (rp.life <= 0 || rp.r > rp.maxR) {
          state.waterRipples.splice(i, 1);
        }
      }
    }

    if (state.floatTexts) {
      for (let i = state.floatTexts.length - 1; i >= 0; i--) {
        const ft = state.floatTexts[i];
        ft.life -= dt;
        ft.y += ft.vy * dt;
        ft.vy *= Math.exp(-3.5 * dt);
        if (ft.life <= 0) {
          state.floatTexts.splice(i, 1);
        }
      }
    }

    if (state.hitConfirm && state.hitConfirm.timer > 0) {
      state.hitConfirm.timer = Math.max(0, state.hitConfirm.timer - dt);
    }
  }

  function updateHorse(state, world, dt) {
    const hr = world && world.horse;
    if (!hr) return;
    const P = getPal();
    if (hr.hitFlash > 0) hr.hitFlash = Math.max(0, hr.hitFlash - dt);
    if (hr._neighCd > 0) hr._neighCd = Math.max(0, hr._neighCd - dt);
    if (hr.swerveTimer > 0) hr.swerveTimer = Math.max(0, hr.swerveTimer - dt);
    if (hr.swerveCd > 0) hr.swerveCd = Math.max(0, hr.swerveCd - dt);

    // Наезд галопирующей лошади разбивает масляные лампы
    if ((hr.speed || 0) > 120 && world.oilLamps && world.oilLamps.length) {
      for (let li = 0; li < world.oilLamps.length; li++) {
        const lm = world.oilLamps[li];
        if (lm && lm.alive && G.MATH.dist(hr.x, hr.y, lm.x, lm.y) <= (hr.r || 15) + (lm.r || 6)) {
          if (world.breakOilLamp) world.breakOilLamp(lm, lm.x, lm.y, state);
        }
      }
    }
    if (hr.trampleCooldowns) {
      const tKeys = Object.keys(hr.trampleCooldowns);
      for (let i = 0; i < tKeys.length; i++) {
        const k = tKeys[i];
        hr.trampleCooldowns[k] -= dt;
        if (hr.trampleCooldowns[k] <= 0) delete hr.trampleCooldowns[k];
      }
    }

    const rider = (hr.riderId && state.players && state.players[hr.riderId]) || null;
    if (hr.state === 'dead') {
      if (rider && rider.mountedHorse) dismountHorse(state, world, rider, false);
      hr.riderId = null;
      return;
    }

    if (hr.calmRegenDelay > 0) {
      hr.calmRegenDelay = Math.max(0, hr.calmRegenDelay - dt);
    } else if (hr.calm < (hr.maxCalm || 100)) {
      hr.calm = Math.min(hr.maxCalm || 100, hr.calm + 10 * dt);
    }

    if (hr.state === 'bucking') {
      hr.buckTimer = Math.max(0, (hr.buckTimer || 0) - dt);
      hr.vx = 0;
      hr.vy = 0;
      hr.speed = 0;
      hr.gallopPhase = (hr.gallopPhase || 0) + dt * 16;
      if (Math.random() < 0.45) {
        spawnParticles(state, hr.x, hr.y, 1, {
          baseAngle: Math.random() * Math.PI * 2, spread: 1, minSpeed: 16, maxSpeed: 42,
          minLife: 0.2, maxLife: 0.4, minSize: 1.5, maxSize: 2.8, drag: 4,
          colors: [P.dirt[0], P.dirt[1]], alpha: 0.5, kind: 'smoke'
        });
      }
      if (hr.buckTimer <= 0) {
        if (rider && rider.mountedHorse) {
          dismountHorse(state, world, rider, true, hr.buckThrowAngle);
        }
        hr.riderId = null;
        hr.state = 'stampede';
        hr.stampedeTimer = 3.2;
        hr.stampedeAngle = G.MATH.normAngle((hr.angle || 0) + G.MATH.rand(-0.35, 0.35));
      }
      return;
    }

    if (hr.state === 'stampede') {
      hr.stampedeTimer = Math.max(0, (hr.stampedeTimer || 0) - dt);
      const stSpd = 220;
      const sx = Math.cos(hr.stampedeAngle || 0) * stSpd;
      const sy = Math.sin(hr.stampedeAngle || 0) * stSpd;
      hr.vx = G.MATH.lerp(hr.vx || 0, sx, Math.min(1, dt * 8));
      hr.vy = G.MATH.lerp(hr.vy || 0, sy, Math.min(1, dt * 8));
      const nx = hr.vx * dt;
      const ny = hr.vy * dt;
      moveCircleWithSolids(hr, nx, ny, hr.r || 15, world, 48, world.width - 48, 36, world.height - 36);

      let bounced = false;
      if (hr.x <= 49) { hr.stampedeAngle = G.MATH.rand(-0.8, 0.8); bounced = true; }
      else if (hr.x >= world.width - 49) { hr.stampedeAngle = Math.PI + G.MATH.rand(-0.8, 0.8); bounced = true; }
      if (hr.y <= 37) { hr.stampedeAngle = Math.PI * 0.5 + G.MATH.rand(-0.6, 0.6); bounced = true; }
      else if (hr.y >= world.height - 37) { hr.stampedeAngle = -Math.PI * 0.5 + G.MATH.rand(-0.6, 0.6); bounced = true; }

      for (let i = 0; i < world.solids.length; i++) {
        const hs = world.solids[i];
        if (hs.walkThrough || hs._storyHidden) continue;
        const res = G.MATH.circleRectPush(hr.x, hr.y, hr.r || 15, hs);
        if (res.hit) {
          hr.x = res.x;
          hr.y = res.y;
          if (!bounced) {
            hr.stampedeAngle = G.MATH.normAngle(Math.atan2(res.ny, res.nx) + G.MATH.rand(-0.45, 0.45));
            bounced = true;
          }
        }
      }
      hr.speed = Math.hypot(hr.vx, hr.vy);
      if (hr.speed > 18) {
        const moveAng = Math.atan2(hr.vy, hr.vx);
        hr.angle = G.MATH.normAngle((hr.angle || 0) + G.MATH.angleDiff(hr.angle || 0, moveAng) * Math.min(1, dt * 10));
      }
      if (hr.stampedeTimer <= 0) {
        hr.state = 'idle';
        hr.vx = 0;
        hr.vy = 0;
        hr.speed = 0;
        hr.calm = Math.max(hr.calm, 45);
      }
    } else if (hr.state !== 'ridden') {
      hr.vx = 0;
      hr.vy = 0;
      hr.speed = 0;
      hr.grazeTimer = (hr.grazeTimer || 0) - dt;
      if (hr.grazeTimer <= 0) {
        if (hr.state === 'grazing') {
          hr.state = hr.tied ? 'tied' : 'idle';
          hr.grazeTimer = G.MATH.rand(2.5, 5.0);
        } else {
          hr.state = 'grazing';
          hr.grazeTimer = G.MATH.rand(1.8, 3.2);
        }
      }
      if (hr.state === 'grazing') {
        hr.grazePhase = (hr.grazePhase || 0) + dt * 4.5;
      }
    }

    // Цокот копыт, пыль, вспугивание птиц и растаптывание на высокой скорости
    const curSpd = hr.speed || 0;
    if ((hr.state === 'ridden' || hr.state === 'stampede') && curSpd > 90) {
      hr.gallopPhase = (hr.gallopPhase || 0) + dt * (curSpd * 0.085);
      hr.stepTimer = (hr.stepTimer || 0) - dt;
      if (hr.stepTimer <= 0) {
        hr.stepTimer = G.MATH.clamp(0.42 - curSpd * 0.001, 0.19, 0.36);
        const surf = world.getSurfaceAt(hr.x, hr.y);
        const localP = resolvePlayer(state);
        if (!localP || G.MATH.dist(hr.x, hr.y, localP.x, localP.y) < 520) {
          if (G.AUDIO && G.AUDIO.playHoofbeat) G.AUDIO.playHoofbeat(surf);
        }
        spawnParticles(state, hr.x, hr.y, 3, {
          baseAngle: Math.atan2(-hr.vy, -hr.vx), spread: 0.7, minSpeed: 12, maxSpeed: 34,
          minLife: 0.18, maxLife: 0.38, minSize: 1.6, maxSize: 3.0, grow: 1.8, drag: 3.5,
          colors: surf === 'water' ? [P.water[0], P.water[1]] : [P.dirt[0], P.dirt[1]], alpha: 0.45, kind: 'smoke'
        });
        if (curSpd > 140) {
          if (world.flushBirdFlocksNear) world.flushBirdFlocksNear(hr.x, hr.y, 210, state);
          if (world.scareSheepNear) world.scareSheepNear(hr.x, hr.y, 175, state);
        }
      }

      if (curSpd > 155) {
        const vxNorm = hr.vx / curSpd;
        const vyNorm = hr.vy / curSpd;
        for (let ti = 0; ti < world.targets.length; ti++) {
          const t = world.targets[ti];
          if (t.kind !== 'bandit' || !t.alive || (hr.trampleCooldowns && hr.trampleCooldowns[t.id])) continue;
          if (G.MATH.dist(hr.x, hr.y, t.x, t.y) <= (hr.r || 13) + (t.r || 11)) {
            hr.trampleCooldowns[t.id] = 0.85;
            t.hp -= 35;
            t.hurtTimer = 0.35;
            t.hitFlash = 0.16;
            t.wobble = 1.0;
            t.stunTimer = Math.max(t.stunTimer || 0, 1.5);
            t.aimTimer = 0;
            t.telegraphFrac = 0;
            t.reloading = false;
            t.cockTimer = 0;
            t.inCover = false;
            t.peeking = false;
            t.knockVx = (t.knockVx || 0) + vxNorm * 195;
            t.knockVy = (t.knockVy || 0) + vyNorm * 195;
            if (!t.hatless) {
              t.hatless = true;
              spawnFlyingHat(state, t.x, t.y, vxNorm, vyNorm, t.hatColor, t.hatBand);
            }
            if (G.AUDIO && G.AUDIO.playImpact) G.AUDIO.playImpact('flesh');
            spawnBloodBurst(state, t.x, t.y, vxNorm, vyNorm, 35, t.hp <= 0);
            spawnFloatText(state, t.x, t.y - 12, t.hp <= 0 ? 'ЗАТОПТАН!' : 'ОГЛУШЁН -35', P.blood[0], true);
            if (t.hp <= 0) {
              t.alive = false;
              t.deathAnim = 0;
              t.bloodPool = 0;
              t.fallAngle = Math.atan2(vyNorm, vxNorm);
              if (rider) {
                rider.kills = (rider.kills || 0) + 1;
                if (isLocalPlayer(state, rider)) {
                  triggerHitConfirm(state, true);
                  if (G.addKill) G.addKill(1);
                }
              }
            }
          }
        }

        if (state && state.mpMode === 'pvp') {
          const playersList = getPlayers(state);
          for (let pi = 0; pi < playersList.length; pi++) {
            const op = playersList[pi];
            if (!op || op.dead || op.mountedHorse || op.rolling || op.id === hr.riderId) continue;
            if (isPlayerGod(state, op)) continue;
            if (hr.trampleCooldowns && hr.trampleCooldowns[op.id]) continue;
            if (G.MATH.dist(hr.x, hr.y, op.x, op.y) <= (hr.r || 13) + G.CFG.playerRadius + 2) {
              hr.trampleCooldowns[op.id] = 0.85;
              op.hp = Math.max(0, (op.hp || 100) - 35);
              op.hurtTimer = 0.35;
              op.stunTimer = Math.max(op.stunTimer || 0, 1.5);
              op.knockVx = (op.knockVx || 0) + vxNorm * 185;
              op.knockVy = (op.knockVy || 0) + vyNorm * 185;
              if (G.AUDIO && G.AUDIO.playImpact) G.AUDIO.playImpact('flesh');
              spawnBloodBurst(state, op.x, op.y, vxNorm, vyNorm, 35, op.hp <= 0);
              spawnFloatText(state, op.x, op.y - 12, 'ОГЛУШЁН -35', P.blood[0], true);
              if (op.hp <= 0 && rider) {
                rider.kills = (rider.kills || 0) + 1;
              }
            }
          }
        }
      }
    }
  }

  function updateSinglePlayer(state, world, p, input, dt) {
    if (!p) return null;
    const P = getPal();
    const w = getWeapon(state, p);
    const ws = getWState(state, p);
    const inp = input || { keys: {}, worldMouseX: p.x + 60, worldMouseY: p.y, lmb: false, rmb: false };
    const keys = inp.keys || {};
    const isLocal = isLocalPlayer(state, p);

    ensureChambers(w, ws);

    if (p.flashTimer > 0) p.flashTimer = Math.max(0, p.flashTimer - dt);
    if (p.recoilKickAnim > 0) p.recoilKickAnim = Math.max(0, p.recoilKickAnim - dt * 6.5);
    if (p.rollCooldown > 0) p.rollCooldown = Math.max(0, p.rollCooldown - dt);
    if (p.hurtTimer > 0) p.hurtTimer = Math.max(0, p.hurtTimer - dt);
    if (p.doorHitCd > 0) p.doorHitCd = Math.max(0, p.doorHitCd - dt);
    if (p.stunTimer > 0) p.stunTimer = Math.max(0, p.stunTimer - dt);
    if (p.snakeSlowTimer > 0) p.snakeSlowTimer = Math.max(0, p.snakeSlowTimer - dt);

    if (Math.hypot(p.knockVx || 0, p.knockVy || 0) > 1) {
      moveCircleWithSolids(p, (p.knockVx || 0) * dt, (p.knockVy || 0) * dt, G.CFG.playerRadius, world, 30, world.width - 30, 20, world.height - 20);
      const kd = Math.exp(-10 * dt);
      p.knockVx *= kd;
      p.knockVy *= kd;
    }

    if (isPlayerGod(state, p)) {
      p.hp = Math.max(p.hp || 100, p.maxHp || 100);
      p.critical = false;
      p.bleeding = false;
      p.dead = false;
      p.stunTimer = 0;
    }

    if (p.hp <= 0 && !p.dead) {
      p.dead = true;
      p.deaths = (p.deaths || 0) + 1;
      p.respawnTimer = 2.0;
      if (p.mountedHorse) dismountHorse(state, world, p, false);
      showToastFor(state, p, 'ВЫ ПОГИБЛИ... [R] — ВОЗРОДИТЬСЯ', 2.2);
    }
    if (p.dead) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) {
        respawnPlayer(state, p, world);
      }
    }

    // Плавное раскрытие барабана при перезарядке (0..1)
    ws.reloadOpenFrac = G.MATH.lerp(ws.reloadOpenFrac || 0, ws.reloading ? 1 : 0, Math.min(1, dt * 14));

    // Таймер перевязки бинтами (2.5с)
    if (p.bandaging && !p.dead) {
      p.bandageTimer = (p.bandageTimer || 0) + dt;
      if (p.bandageTimer >= (p.bandageDur || 2.5)) {
        completeBandaging(state, p);
      }
    }

    // Таймер распития бурбона (1.8с)
    if (p.drinking && !p.dead) {
      p.drinkTimer = (p.drinkTimer || 0) + dt;
      if (p.drinkTimer >= (p.drinkDur || 1.8)) {
        completeDrinking(state, p);
      }
    }

    // 1. Таймеры механизмов оружия
    if (ws.cockTimer > 0) {
      ws.cockTimer = Math.max(0, ws.cockTimer - dt);
      if (w.action === 'lever' && ws.chamberSpent && !ws.leverEjected && ws.cockTimer <= ws.cockDuration * 0.50) {
        ws.leverEjected = true;
        const hand = getHandOrigin(p);
        spawnShell(state, hand.x, hand.y, p.aimAngle + Math.PI * 0.45, 1.05);
      }
      if (ws.cockTimer === 0) {
        ws.chamberSpent = false;
        if (ws.ammo > 0) ws.cocked = true;
      }
    }

    if (ws.daCooldownTimer > 0) {
      ws.daCooldownTimer = Math.max(0, ws.daCooldownTimer - dt);
    }

    if (ws.daPullTimer > 0) {
      ws.daPullTimer = Math.max(0, ws.daPullTimer - dt);
      p.aimVel += Math.sin(state.time * 47) * (w.triggerTug || 0.048) * 52 * dt;
      if (ws.daPullTimer === 0) {
        if (!p.wallBlocked && !p.rolling && (!p.inCover || p.peeking) && ws.ammo > 0) {
          executeShot(state, world, p);
        }
      }
    }

    if (ws.insertAnim > 0) {
      ws.insertAnim = Math.max(0, ws.insertAnim - dt);
      if (ws.insertAnim === 0 && ws.autoClosePending) {
        closeReload(state, p);
      }
    }

    // Удалённый клиент: обработка нажатия ЛКМ по фронту
    if (!isLocal && inp.lmb && !p._prevLmb) {
      tryFire(state, world, p);
    }
    p._prevLmb = !!inp.lmb;

    // 2. Движение, верховая езда, перекат и система укрытий
    let moveX = 0;
    let moveY = 0;
    if (!p.dead && (p.stunTimer || 0) <= 0) {
      if (keys.KeyW || keys.ArrowUp) moveY -= 1;
      if (keys.KeyS || keys.ArrowDown) moveY += 1;
      if (keys.KeyA || keys.ArrowLeft) moveX -= 1;
      if (keys.KeyD || keys.ArrowRight) moveX += 1;
    }

    const activeHorse = (p.mountedHorse && world.horse && world.horse.state !== 'dead' && world.horse.riderId === p.id) ? world.horse : null;
    if (p.mountedHorse && !activeHorse) p.mountedHorse = false;

    if (activeHorse && !p.dead) {
      p.rolling = false;
      p.inCover = false;
      p.peeking = false;
      p.coverObj = null;
      if (activeHorse.state === 'bucking') {
        p.vx = 0;
        p.vy = 0;
        p.x = activeHorse.x;
        p.y = activeHorse.y;
      } else {
        if (moveX !== 0 || moveY !== 0) {
          const mLen = Math.hypot(moveX, moveY);
          moveX /= mLen;
          moveY /= mLen;
        }
        const mountMaxSpd = p.bandaging ? 80 : (p.drinking ? 90 : 210);
        if ((activeHorse.swerveTimer || 0) > 0) {
          // Увод курса лошади от змеи без паники и сброса всадника
          const swAng = activeHorse.swerveAngle !== undefined ? activeHorse.swerveAngle : (activeHorse.angle || 0);
          activeHorse.vx = G.MATH.lerp(activeHorse.vx || 0, Math.cos(swAng) * Math.max(135, activeHorse.speed || 0), Math.min(1, dt * 12));
          activeHorse.vy = G.MATH.lerp(activeHorse.vy || 0, Math.sin(swAng) * Math.max(135, activeHorse.speed || 0), Math.min(1, dt * 12));
        } else {
          activeHorse.vx = G.MATH.lerp(activeHorse.vx || 0, moveX * mountMaxSpd, Math.min(1, dt * 8.5));
          activeHorse.vy = G.MATH.lerp(activeHorse.vy || 0, moveY * mountMaxSpd, Math.min(1, dt * 8.5));
        }
        moveCircleWithSolids(activeHorse, activeHorse.vx * dt, activeHorse.vy * dt, activeHorse.r || 15, world, 38, world.width - 38, 28, world.height - 28);
        activeHorse.speed = Math.hypot(activeHorse.vx, activeHorse.vy);
        if (activeHorse.speed > 20) {
          const wantHAng = Math.atan2(activeHorse.vy, activeHorse.vx);
          activeHorse.angle = G.MATH.normAngle((activeHorse.angle || 0) + G.MATH.angleDiff(activeHorse.angle || 0, wantHAng) * Math.min(1, dt * 10));
        }
        p.x = activeHorse.x;
        p.y = activeHorse.y;
        p.vx = activeHorse.vx;
        p.vy = activeHorse.vy;
      }
    } else if (p.rolling) {
      p.rollTimer -= dt;
      p.vx = p.rollDx * G.CFG.rollSpeed;
      p.vy = p.rollDy * G.CFG.rollSpeed;
      moveCircleWithSolids(p, p.vx * dt, p.vy * dt, G.CFG.playerRadius, world, 30, world.width - 30, 20, world.height - 20);

      const rProg = 1 - p.rollTimer / G.CFG.rollDur;
      if (!p.rollMidDust && rProg >= 0.45) {
        p.rollMidDust = true;
        const surfMid = world.getSurfaceAt(p.x, p.y);
        spawnParticles(state, p.x, p.y, 7, {
          baseAngle: Math.atan2(-p.rollDy, -p.rollDx),
          spread: 1.0,
          minSpeed: 12,
          maxSpeed: 38,
          minLife: 0.22,
          maxLife: 0.46,
          minSize: 1.6,
          maxSize: 3.2,
          grow: 2.2,
          colors: surfMid === 'water'
            ? [P.water[0], P.water[1], '#e8e3d5']
            : surfMid === 'wood'
              ? [P.woodWarm[1], P.woodWarm[2]]
              : [P.dirt[0], P.dirt[1], P.dirt[2]],
          alpha: surfMid === 'water' ? 0.72 : 0.46,
          kind: surfMid === 'water' ? 'debris' : 'smoke'
        });
      }

      if (p.rollTimer <= 0) {
        p.rolling = false;
        const maxSp = w.maxSpread || 0.30;
        p.bloom = Math.min(maxSp, p.bloom + G.CFG.rollEndSpread);
        const surfEnd = world.getSurfaceAt(p.x, p.y);
        spawnParticles(state, p.x, p.y, 5, {
          baseAngle: Math.atan2(-p.rollDy, -p.rollDx),
          spread: 1.2,
          minSpeed: 10,
          maxSpeed: 28,
          minLife: 0.18,
          maxLife: 0.36,
          minSize: 1.4,
          maxSize: 2.6,
          grow: 1.8,
          colors: surfEnd === 'water'
            ? [P.water[0], P.water[1]]
            : surfEnd === 'wood'
              ? [P.woodWarm[1], P.woodWarm[2]]
              : [P.dirt[0], P.dirt[1]],
          alpha: 0.42,
          kind: surfEnd === 'water' ? 'debris' : 'smoke'
        });
      }
    } else if (p.inCover && !p.dead) {
      p.vx = 0;
      p.vy = 0;
      p.peeking = !!(inp.rmb && !ws.reloading);

      if (p.coverAnchorX === undefined || p.coverAnchorY === undefined) {
        p.coverAnchorX = p.x;
        p.coverAnchorY = p.y;
      }

      if (p.coverObj) {
        const c = p.coverObj;
        const aimX = Math.cos(p.targetAngle);
        const aimY = Math.sin(p.targetAngle);
        const tx = -p.coverNormalY;
        const ty = p.coverNormalX;
        const side = (tx * aimX + ty * aimY) >= 0 ? 1 : -1;
        p.peekSide = side;

        if (!c.high) {
          p.peekDirX = aimX * 0.55 - p.coverNormalX * 0.45;
          p.peekDirY = aimY * 0.55 - p.coverNormalY * 0.45;
        } else {
          p.peekDirX = tx * side;
          p.peekDirY = ty * side;
        }
        const len = Math.hypot(p.peekDirX, p.peekDirY) || 1;
        p.peekDirX /= len;
        p.peekDirY /= len;

        const edge = G.CFG.playerRadius + 4;
        const lateral = Math.min(16, Math.max(6, Math.min(c.w, c.h) * 0.5));
        if (!c.high) {
          p.peekTargetX = p.coverAnchorX + p.coverNormalX * 2.5;
          p.peekTargetY = p.coverAnchorY + p.coverNormalY * 2.5;
        } else if (Math.abs(p.coverNormalX) >= Math.abs(p.coverNormalY)) {
          p.peekTargetX = (p.coverNormalX > 0 ? c.x + c.w : c.x) + p.coverNormalX * edge;
          p.peekTargetY = G.MATH.clamp(
            p.coverAnchorY + ty * side * lateral,
            c.y + 5, c.y + c.h - 5
          );
        } else {
          p.peekTargetY = (p.coverNormalY > 0 ? c.y + c.h : c.y) + p.coverNormalY * edge;
          p.peekTargetX = G.MATH.clamp(
            p.coverAnchorX + tx * side * lateral,
            c.x + 5, c.x + c.w - 5
          );
        }

        const goalX = p.peeking ? p.peekTargetX : p.coverAnchorX;
        const goalY = p.peeking ? p.peekTargetY : p.coverAnchorY;
        const rate = p.peeking ? 10 : 7;
        p.x = G.MATH.lerp(p.x, goalX, Math.min(1, dt * rate));
        p.y = G.MATH.lerp(p.y, goalY, Math.min(1, dt * rate));
      }

      if (moveX !== 0 || moveY !== 0) {
        const perp = moveX * p.coverNormalX + moveY * p.coverNormalY;
        const tx2 = -p.coverNormalY;
        const ty2 = p.coverNormalX;
        const along = moveX * tx2 + moveY * ty2;
        if (perp > 0.55) {
          exitCover(state, p, world);
        } else if (Math.abs(along) > 0.05 && p.coverObj) {
          const c = p.coverObj;
          const slide = along * G.CFG.focusSpeed * dt * 0.9;
          if (Math.abs(tx2) > 0.5) {
            p.coverAnchorX = G.MATH.clamp(p.coverAnchorX + tx2 * slide, c.x + 6, c.x + c.w - 6);
          } else {
            p.coverAnchorY = G.MATH.clamp(p.coverAnchorY + ty2 * slide, c.y + 6, c.y + c.h - 6);
          }
        }
      }
    } else if (!p.dead) {
      const focus = inp.rmb && !ws.reloading && !p.bandaging && !p.drinking;
      let maxSpd = G.CFG.walkSpeed;
      if (p.bandaging) maxSpd = 28;
      else if (p.drinking) maxSpd = 32;
      else if (ws.reloading) maxSpd = G.CFG.reloadSpeed;
      else if (focus) maxSpd = G.CFG.focusSpeed;
      if ((p.snakeSlowTimer || 0) > 0) maxSpd *= 0.55;

      if (moveX !== 0 || moveY !== 0) {
        const len = Math.hypot(moveX, moveY);
        moveX /= len;
        moveY /= len;
      }

      p.vx = G.MATH.lerp(p.vx, moveX * maxSpd, Math.min(1, dt * 14));
      p.vy = G.MATH.lerp(p.vy, moveY * maxSpd, Math.min(1, dt * 14));
      moveCircleWithSolids(p, p.vx * dt, p.vy * dt, G.CFG.playerRadius, world, 30, world.width - 30, 20, world.height - 20);
    }

    const targetPeek = (p.inCover && p.peeking) ? 1 : 0;
    p.peekFrac = G.MATH.lerp(p.peekFrac || 0, targetPeek, Math.min(1, dt * 15));

    const targetCover = p.inCover ? 1 : 0;
    p.coverFrac = G.MATH.lerp(p.coverFrac || 0, targetCover, Math.min(1, dt * 12));
    const targetCrouch = (p.inCover && !p.peeking && p.coverObj && !p.coverObj.high) ? 1 : 0;
    p.crouchFrac = G.MATH.lerp(p.crouchFrac || 0, targetCrouch, Math.min(1, dt * 13));

    p.x = G.MATH.clamp(p.x, 30, world.width - 30);
    p.y = G.MATH.clamp(p.y, 20, world.height - 20);
    resolveCircleSolids(p, G.CFG.playerRadius, world, 2);

    // Ожог при наступлении на активный костёр (лёгкий урон огнём)
    if ((p.fireTickCd || 0) > 0) p.fireTickCd = Math.max(0, p.fireTickCd - dt);
    if (!p.dead && !p.rolling && !p.mountedHorse && world && world.solids && !isPlayerGod(state, p)) {
      const wet = world.isPointWet && world.isPointWet(p.x, p.y);
      if (!wet) {
        for (let ci = 0; ci < world.solids.length; ci++) {
          const cf = world.solids[ci];
          if (cf.type !== 'campfire' || cf._storyHidden) continue;
          const cx = cf.x + cf.w * 0.5;
          const cy = cf.y + cf.h * 0.5;
          if (G.MATH.dist(p.x, p.y, cx, cy) <= 13) {
            if ((p.fireTickCd || 0) <= 0) {
              p.fireTickCd = 0.45;
              p.hp = Math.max(0, (p.hp || 100) - 6);
              p.hurtTimer = Math.max(p.hurtTimer || 0, 0.28);
              spawnFloatText(state, p.x, p.y - 12, '-6 ОГОНЬ', P.barnRed ? P.barnRed[0] : '#c9241c', false);
              spawnParticles(state, p.x, p.y, 4, {
                baseAngle: -Math.PI * 0.5, spread: 1.4, minSpeed: 18, maxSpeed: 42,
                minLife: 0.2, maxLife: 0.42, minSize: 1.2, maxSize: 2.2, drag: 3.5,
                colors: ['#f2da91', '#c9241c'], alpha: 0.85, kind: 'spark'
              });
              if (G.AUDIO.playImpact) G.AUDIO.playImpact('flesh');
              if (p.hp <= 0) {
                p.hp = 0;
                p.dead = true;
                p.bleeding = false;
                p.critical = false;
                if (state.mpMode === 'pvp') p.deaths = (p.deaths || 0) + 1;
              }
            }
            break;
          }
        }
      }
    }

    p.speed = Math.hypot(p.vx, p.vy);

    if (!p.rolling && !p.inCover && p.speed > 10) {
      p.walkPhase = (p.walkPhase || 0) + dt * (p.speed * 0.115);
    }

    const pZone = world.getZoneAt(p.x, p.y);

    if (!p.rolling && !p.inCover && p.speed > 26 && !p.dead) {
      p.stepTimer = (p.stepTimer || 0) - dt;
      if (p.stepTimer <= 0) {
        p.stepTimer = inp.rmb ? 0.44 : 0.30;
        p.stepSide = -(p.stepSide || 1);
        const surf = world.getSurfaceAt(p.x, p.y);
        if (isLocal) G.AUDIO.playStep(surf);

        if (surf === 'water') {
          spawnParticles(state, p.x, p.y, 5, {
            baseAngle: Math.atan2(-p.vy, -p.vx),
            spread: 1.4,
            minSpeed: 14,
            maxSpeed: 38,
            minLife: 0.18,
            maxLife: 0.36,
            minSize: 1.2,
            maxSize: 2.2,
            drag: 5.5,
            colors: [P.water[0], P.water[1], '#e8e3d5'],
            alpha: 0.72,
            kind: 'debris'
          });
        } else if (surf === 'dirt') {
          const perpX = -Math.sin(p.aimAngle) * 3.5 * p.stepSide;
          const perpY = Math.cos(p.aimAngle) * 3.5 * p.stepSide;
          spawnParticles(state, p.x + perpX, p.y + perpY, 3, {
            baseAngle: Math.atan2(-p.vy, -p.vx),
            spread: 0.9,
            minSpeed: 6,
            maxSpeed: 20,
            minLife: 0.22,
            maxLife: 0.45,
            minSize: 1.4,
            maxSize: 2.8,
            grow: 1.8,
            drag: 3.5,
            colors: pZone.id === 'canyon' ? [P.canyon[0], P.canyon[1]] : [P.dirt[0], P.dirt[1]],
            alpha: 0.42,
            kind: 'smoke'
          });
        }

        const containers = world.waterContainers || world.waterBarrels;
        if (containers) {
          for (let i = 0; i < containers.length; i++) {
            const b = containers[i];
            const bx = b.x + b.w * 0.5;
            const by = b.y + b.h * 0.5;
            if (G.MATH.dist(p.x, p.y, bx, by) < 42) {
              addWaterRipple(state, b.id, bx + G.MATH.rand(-3, 3), by + G.MATH.rand(-3, 3), 9, 0.28);
            }
          }
        }
      }
    } else {
      p.stepTimer = 0.08;
    }

    p.nearCover = p.inCover ? null : findNearestCover(p, world);

    // 3. Физика двойного прицела
    const renderPos = getRenderPos(p);
    const aimTargetX = inp.worldMouseX !== undefined ? inp.worldMouseX : (p.x + Math.cos(p.aimAngle || 0) * 80);
    const aimTargetY = inp.worldMouseY !== undefined ? inp.worldMouseY : (p.y + Math.sin(p.aimAngle || 0) * 80);
    const rawTarget = Math.atan2(aimTargetY - renderPos.y, aimTargetX - renderPos.x);

    // Анимация простоя >= 5 секунд: прикуривание и подробный цикл курения
    const playerBusy = p.dead || p.rolling || p.bandaging || p.drinking || p.speed >= 4 || moveX !== 0 || moveY !== 0 ||
      inp.rmb || inp.lmb || ws.reloading || ws.cockTimer > 0 || ws.daPullTimer > 0;
    if (playerBusy) {
      interruptSmoking(state, p);
    } else {
      p.idleTimer = (p.idleTimer || 0) + dt;
      if (p.idleTimer >= 5.0) {
        if (!p.smokingState) {
          p.smokingState = 'lighting';
          p.smokeAnimTime = 0;
          p.smokePuffTimer = 0.55;
          p.smokeExhaleTimer = 0;
        } else {
          p.smokeAnimTime = (p.smokeAnimTime || 0) + dt;
          if (p.smokingState === 'lighting') {
            if (p.smokeAnimTime >= 0.48 && p.smokePuffTimer > 0 && p.smokePuffTimer < 100) {
              p.smokePuffTimer -= dt;
              if (p.smokePuffTimer <= 0) {
                const lipX = renderPos.x + Math.cos(p.aimAngle) * 7.5;
                const lipY = renderPos.y + Math.sin(p.aimAngle) * 7.5;
                spawnParticles(state, lipX, lipY, 3, {
                  baseAngle: -0.3, spread: 0.45, minSpeed: 10, maxSpeed: 22,
                  minLife: 0.65, maxLife: 1.25, minSize: 1.5, maxSize: 2.8, grow: 2.2, drag: 1.8,
                  colors: ['#e8e3d5', '#cfc8b6', '#9c998e'], alpha: 0.50, kind: 'smoke'
                });
                p.smokePuffTimer = 999;
              }
            }
            if (p.smokeAnimTime >= 1.5) {
              p.smokingState = 'smoking';
              p.smokeAnimTime = 1.25;
              p.smokePuffTimer = 0.25;
              p.smokeExhaleTimer = 0;
              const lipX = renderPos.x + Math.cos(p.aimAngle) * 8;
              const lipY = renderPos.y + Math.sin(p.aimAngle) * 8;
              spawnParticles(state, lipX, lipY, 1, {
                baseAngle: p.aimAngle + 0.9, spread: 0.3, minSpeed: 22, maxSpeed: 36,
                minLife: 0.35, maxLife: 0.55, minSize: 1.2, maxSize: 1.4, drag: 5.5,
                colors: ['#8f633e'], alpha: 0.85, kind: 'debris'
              });
            }
          } else if (p.smokingState === 'smoking') {
            const cyc = p.smokeAnimTime % 4.2;
            const ca = Math.cos(p.aimAngle);
            const sa = Math.sin(p.aimAngle);

            if (cyc < 1.3 || cyc > 3.35) {
              p.smokePuffTimer = (p.smokePuffTimer || 0) - dt;
              if (p.smokePuffTimer <= 0) {
                p.smokePuffTimer = 0.36;
                const hx = renderPos.x + ca * 8.8 - sa * (-14.0);
                const hy = renderPos.y + sa * 8.8 + ca * (-14.0);
                spawnParticles(state, hx, hy, 1, {
                  baseAngle: -0.25, spread: 0.3, minSpeed: 8, maxSpeed: 15,
                  minLife: 0.65, maxLife: 1.15, minSize: 1.2, maxSize: 2.2, grow: 1.8, drag: 1.8,
                  colors: ['#cfc8b6', '#a8a293'], alpha: 0.38, kind: 'smoke'
                });
              }
            }

            if (cyc >= 2.95 && cyc <= 3.60) {
              p.smokeExhaleTimer = (p.smokeExhaleTimer || 0) - dt;
              if (p.smokeExhaleTimer <= 0) {
                p.smokeExhaleTimer = 0.13;
                const mouthX = renderPos.x + ca * 7.2;
                const mouthY = renderPos.y + sa * 7.2;
                spawnParticles(state, mouthX, mouthY, 2, {
                  baseAngle: p.aimAngle, spread: 0.32, minSpeed: 16, maxSpeed: 28,
                  minLife: 0.85, maxLife: 1.55, minSize: 1.8, maxSize: 3.2, grow: 2.6, drag: 2.1,
                  colors: ['#e8e3d5', '#cfc8b6', '#9c998e'], alpha: 0.52, kind: 'smoke'
                });
              }
            } else {
              p.smokeExhaleTimer = 0;
            }
          }
        }
      }
    }

    p.breathPhase += dt * (p.speed > 20 ? 3.2 : 1.7);
    const breathAmp = (inp.rmb ? 0.004 : 0.012) * (p.inCover && p.peeking ? 0.55 : 1.0);
    const breathOff = Math.sin(p.breathPhase) * breathAmp + Math.sin(p.breathPhase * 2) * breathAmp * 0.4;
    p.targetAngle = G.MATH.normAngle(rawTarget + breathOff);
    stepAimSpring(p, 'aimAngle', p.targetAngle, w, dt, 1.0);

    // 4. Динамический разброс
    p.bloom = Math.max(0, p.bloom - w.bloomDecay * dt);
    const moveRatio = G.MATH.clamp(p.speed / G.CFG.walkSpeed, 0, 1.35);
    const focusFactor = (inp.rmb && !ws.reloading) ? w.focusMult : 1.0;
    const coverBonus = (p.inCover && p.peeking) ? 0.72 : 1.0;
    const swingPenalty = Math.min(0.14, Math.abs(p.aimVel) * 0.024);
    const maxSp = w.maxSpread || 0.30;
    const stormActive = state.dustStorm && state.dustStorm.active ? (state.dustStorm.intensity || 0) : 0;
    const outdoors = !world.getIndoorZoneAt || !world.getIndoorZoneAt(p.x, p.y);
    const stormSpreadPenalty = (stormActive > 0.05 && outdoors) ? (0.032 * stormActive) : 0;

    const rawSpread = (w.baseSpread + moveRatio * w.moveSpread) * focusFactor * coverBonus + p.bloom + swingPenalty + stormSpreadPenalty;
    const targetSpread = G.MATH.clamp(rawSpread, 0.004, maxSp);
    const spreadRate = targetSpread > p.spread ? 16 : 9;
    p.spread = G.MATH.lerp(p.spread, targetSpread, Math.min(1, dt * spreadRate));

    // 5. Упор ствола в стены
    const wallHit = checkBarrelWallCollision(p, w, world);
    p.wallBlocked = !!wallHit;
    p.wallHitDist = wallHit ? wallHit.dist : (w.wallCheckLen + 5);
    p.wallHitX = wallHit ? wallHit.x : null;
    p.wallHitY = wallHit ? wallHit.y : null;

    const wantRaise = p.wallBlocked || (p.inCover && !p.peeking);
    const raiseRate = wantRaise ? 18 : 12;
    p.wallRaiseFrac = G.MATH.lerp(p.wallRaiseFrac || 0, wantRaise ? 1 : 0, Math.min(1, dt * raiseRate));

    p.nearInteractable = findNearestInteractable(state, world, p);
    if (isLocal) {
      state.zone = pZone.id;
      state.zoneLabel = pZone.label;
      state.nearInteractable = p.nearInteractable;
      if (state.hatMenuOpen && (!state.nearInteractable || state.nearInteractable.kind !== 'hatrack')) {
        const rack = world.interactables && world.interactables.find((it) => it.kind === 'hatrack');
        if (!rack || G.MATH.dist(p.x, p.y, rack.x, rack.y) > 74) {
          state.hatMenuOpen = false;
        }
      }
    }

    return renderPos;
  }

  function spawnClientShotFx(state, world, x, y, weaponId, angle, isLocal) {
    if (!state) return;
    const P = getPal();
    const wId = weaponId || 'walker';
    spawnIndoorGunSmoke(state, world, x, y, wId, angle || 0);
    spawnParticles(state, x, y, wId === 'walker' ? 7 : 4, {
      baseAngle: angle || 0,
      spread: 0.45,
      minSpeed: 28,
      maxSpeed: 88,
      minLife: 0.14,
      maxLife: 0.34,
      minSize: 1.5,
      maxSize: 3.0,
      colors: [P.cloud[0], P.cloud[1], P.brass[0]],
      alpha: 0.65,
      kind: 'smoke'
    });
    if (isLocal && state.camera) {
      state.camera.shakeMag = Math.max(state.camera.shakeMag || 0, wId === 'winchester' ? 3.5 : wId === 'walker' ? 4.2 : 2.1);
    }
  }

  function spawnClientImpactFx(state, mat, x, y) {
    if (!state) return;
    const P = getPal();
    let cols = [P.woodWarm[0], P.woodWarm[1], P.woodWarm[2]];
    let kind = 'debris';
    if (mat === 'flesh') {
      cols = P.blood ? [P.blood[0], P.blood[1], P.blood[2]] : ['#c9241c', '#991812'];
      kind = 'blood';
    } else if (mat === 'glass') {
      cols = [P.glass[0], P.glass[1], P.glass[2]];
    } else if (mat === 'metal' || mat === 'rock' || mat === 'stone') {
      cols = [P.brass[0], P.grass[0], '#ffffff'];
      kind = 'spark';
    } else if (mat === 'water') {
      cols = [P.water[0], P.water[1], P.cloud[0]];
    }
    spawnParticles(state, x, y, 7, {
      baseAngle: 0,
      spread: Math.PI * 2,
      minSpeed: 24,
      maxSpeed: 95,
      minLife: 0.14,
      maxLife: 0.34,
      minSize: 1.2,
      maxSize: 2.3,
      colors: cols,
      kind: kind
    });
  }

  function stepClientVisuals(state, world, dt) {
    dt = Math.min(dt, 0.033);
    state.time += dt;
    if (G.syncPlayersCache) G.syncPlayersCache(state);
    if (!state.waterRipples) state.waterRipples = [];
    if (!state.bloodDrops) state.bloodDrops = [];
    if (!state.flyingHats) state.flyingHats = [];
    if (!state.floatTexts) state.floatTexts = [];
    if (!state.reloadEvents) state.reloadEvents = [];

    if (state.toast && state.toast.timer > 0) {
      state.toast.timer = Math.max(0, state.toast.timer - dt);
    }

    const playersList = getPlayers(state);
    for (let i = 0; i < playersList.length; i++) {
      const pl = playersList[i];
      if (!pl) continue;
      if (pl.flashTimer > 0) pl.flashTimer = Math.max(0, pl.flashTimer - dt);
      if (pl.recoilKickAnim > 0) pl.recoilKickAnim = Math.max(0, pl.recoilKickAnim - dt * 6.5);
    }

    const localP = resolvePlayer(state);
    if (localP) {
      const w = getWeapon(state, localP);
      const ws = getWState(state, localP);
      if (w && ws) {
        ensureChambers(w, ws);
        ws.reloadOpenFrac = G.MATH.lerp(ws.reloadOpenFrac || 0, ws.reloading ? 1 : 0, Math.min(1, dt * 14));
      }

      if (world && world.getZoneAt) {
        const zn = world.getZoneAt(localP.x, localP.y);
        state.zone = zn.id;
        state.zoneLabel = zn.label;
        state.echoDesc = zn.id === 'saloon'
          ? 'ЗАКРЫТОЕ ПОМЕЩЕНИЕ'
          : (zn.id === 'canyon' ? 'СКАЛЬНОЕ ЭХО КАНЬОНА' : 'ОТКРЫТОЕ ЭХО УЛИЦЫ');
      } else if (world && world.getIndoorZoneAt) {
        const iz = world.getIndoorZoneAt(localP.x, localP.y);
        const cStartX = (world.layout && world.layout.canyonStartX) || 1400;
        if (iz) {
          state.zone = iz.id;
          state.zoneLabel = 'САЛУН';
          state.echoDesc = 'ЗАКРЫТОЕ ПОМЕЩЕНИЕ';
        } else if (localP.x < cStartX) {
          state.zone = 'street';
          state.zoneLabel = 'ГЛАВНАЯ УЛИЦА';
          state.echoDesc = 'ОТКРЫТОЕ ЭХО УЛИЦЫ';
        } else {
          state.zone = 'canyon';
          state.zoneLabel = 'КАНЬОН';
          state.echoDesc = 'СКАЛЬНОЕ ЭХО КАНЬОНА';
        }
      }

      if (G.AUDIO.setConcussion) {
        G.AUDIO.setConcussion(localP.concussion || 0);
      }
      localP.nearInteractable = findNearestInteractable(state, world, localP);
      state.nearInteractable = localP.nearInteractable;
      const lpRender = getRenderPos(localP);
      const lookAhead = (state.input && state.input.rmb) ? 42 : 24;
      const camTargetX = lpRender.x + Math.cos(localP.aimAngle || 0) * lookAhead;
      const camTargetY = lpRender.y + Math.sin(localP.aimAngle || 0) * lookAhead;
      state.camera.x = G.MATH.lerp(state.camera.x, camTargetX, Math.min(1, dt * 8.5));
      state.camera.y = G.MATH.lerp(state.camera.y, camTargetY, Math.min(1, dt * 8.5));
      if (state.camera.shakeMag > 0.05) {
        state.camera.shakeX = G.MATH.rand(-1, 1) * state.camera.shakeMag;
        state.camera.shakeY = G.MATH.rand(-1, 1) * state.camera.shakeMag;
        state.camera.shakeMag *= Math.exp(-16 * dt);
      } else {
        state.camera.shakeX = 0;
        state.camera.shakeY = 0;
        state.camera.shakeMag = 0;
      }
    }

    updateBloodDrops(state, world, dt);
    updateFlyingHats(state, world, dt);
    updateShells(state, world, dt);
    updateParticles(state, world, dt);
    updateGunSmokeClouds(state, world, dt);
    if (world && world.updateBirds) world.updateBirds(dt);

    // Ветер и перекати-поле бури на клиенте по синхронизированной интенсивности
    const ds = state.dustStorm;
    if (ds && ds.active && ds.intensity > 0.01) {
      if (!ds.tumbleweeds || !ds.tumbleweeds.length) {
        ds.tumbleweeds = [];
        for (let i = 0; i < 6; i++) ds.tumbleweeds.push(spawnTumbleweed(world));
      }
      const iv = ds.intensity || 0;
      const vx = -94 * (0.35 + 0.65 * iv);
      const vy = 32 * (0.35 + 0.65 * iv);
      for (let i = 0; i < ds.tumbleweeds.length; i++) {
        const tw = ds.tumbleweeds[i];
        tw.x += vx * tw.speedScale * dt;
        tw.y += vy * tw.speedScale * dt;
        tw.rot -= dt * (3.2 + 3.0 * iv) * tw.speedScale;
        tw.bouncePhase += dt * (5.2 + 2.5 * iv);
        if (world && world.getIndoorZoneAt && world.getIndoorZoneAt(tw.x, tw.y)) {
          tw.y = world.saloon.y + world.saloon.h + 18;
        }
        if (world && (tw.x < -30 || tw.y > world.height + 20)) {
          const maxTwY = (world.layout && world.layout.streetBot) ? world.layout.streetBot + 50 : 660;
          tw.x = world.width - G.MATH.rand(20, 120);
          tw.y = G.MATH.rand(90, Math.min(world.height - 90, maxTwY));
        }
      }
      if (G.AUDIO.updateWind) {
        const out = !localP || !world || !world.getIndoorZoneAt || !world.getIndoorZoneAt(localP.x, localP.y);
        G.AUDIO.updateWind(iv, out, state.time);
      }
    } else if (G.AUDIO.updateWind) {
      G.AUDIO.updateWind(0, true, state.time);
    }
  }

  G.SIM = {
    resolvePlayer,
    getPlayers,
    getWeapon,
    getWState,
    ensureChambers,
    getRenderPos,
    getHandOrigin,
    getMuzzlePos,
    addWaterRipple,
    spawnBloodBurst,
    spawnClientShotFx,
    spawnClientImpactFx,
    stepClientVisuals,
    showToast,
    switchWeapon,
    openReload,
    insertOneRound,
    closeReload,
    tryCock,
    tryFire,
    tryInteract,
    tryUseBandage,
    pickSpawnForPlayer,
    respawnPlayer,
    triggerDustStorm,
    stopDustStorm,
    toggleEditorMode,
    findNearestInteractable,
    startWaveMode,
    stopWaveMode,
    handleKeyDownForPlayer,
    handleKeyDown,
    notifyBanditsOfShot,
    scareHorse,
    mountHorse,
    dismountHorse,
    resetTransientState,
    updateSinglePlayer,

    update(state, world, dt) {
      dt = Math.min(dt, 0.033);
      state.time += dt;
      state._worldRef = world;
      if (G.syncPlayersCache) G.syncPlayersCache(state);
      if (!state.waterRipples) state.waterRipples = [];
      if (!state.bloodDrops) state.bloodDrops = [];
      if (!state.flyingHats) state.flyingHats = [];
      if (!state.floatTexts) state.floatTexts = [];
      if (!state.reloadEvents) state.reloadEvents = [];

      const playersList = getPlayers(state);
      const localP = resolvePlayer(state);
      const input = state.input;

      if (state.toast.timer > 0) {
        state.toast.timer = Math.max(0, state.toast.timer - dt);
      }

      // Главное меню: живая панорама салуна и улицы, бой и ИИ на паузе
      if (state.screen === 'menu') {
        const spanW = world && world.width ? world.width : 1400;
        const spanH = world && world.height ? world.height : 840;
        const baseX = spanW >= 1800 ? 680 : spanW * 0.5;
        const ampX = Math.min(380, Math.max(40, spanW * 0.24));
        const baseY = spanH >= 900 ? 405 : spanH * 0.5;
        const ampY = Math.min(65, Math.max(18, spanH * 0.08));
        state.camera.x = G.MATH.clamp(baseX + Math.sin(state.time * 0.14) * ampX, 180, Math.max(200, spanW - 180));
        state.camera.y = G.MATH.clamp(baseY + Math.sin(state.time * 0.21 + 0.6) * ampY, 120, Math.max(140, spanH - 120));
        state.camera.shakeX = 0;
        state.camera.shakeY = 0;
        state.camera.shakeMag = 0;
        if (G.AUDIO.setConcussion) G.AUDIO.setConcussion(0);
        if (G.AUDIO.updateWind) G.AUDIO.updateWind(0, false, state.time);
        return;
      }

      // Пауза в одиночном режиме замораживает симуляцию и приглушает ветер/звон
      if (state.screen === 'paused') {
        if (G.AUDIO.setConcussion) G.AUDIO.setConcussion(0);
        if (G.AUDIO.updateWind) G.AUDIO.updateWind(0, true, state.time);
        if (state.netRole !== 'host' && state.netRole !== 'client') {
          return;
        }
      }
      if (state.fleeCooldown > 0) {
        state.fleeCooldown = Math.max(0, state.fleeCooldown - dt);
      }

      // Режим редактора уровня: в оффлайне ставит бой на паузу, в сетевом хосте двигает только камеру редактора
      const edActive = !!(state.editor && state.editor.active);
      if (edActive) {
        const keys = input.keys || {};
        const edBlockArrows = state.editor.tool === 'move' && !!state.editor.selectedEntity;
        let mx = 0;
        let my = 0;
        if (keys.KeyW || (!edBlockArrows && keys.ArrowUp)) my -= 1;
        if (keys.KeyS || (!edBlockArrows && keys.ArrowDown)) my += 1;
        if (keys.KeyA || (!edBlockArrows && keys.ArrowLeft)) mx -= 1;
        if (keys.KeyD || (!edBlockArrows && keys.ArrowRight)) mx += 1;
        if (mx !== 0 || my !== 0) {
          const len = Math.hypot(mx, my);
          mx /= len; my /= len;
        }
        const edSpd = 340;
        state.editor.camX = G.MATH.clamp((state.editor.camX !== undefined ? state.editor.camX : state.camera.x) + mx * edSpd * dt, 40, world.width - 40);
        state.editor.camY = G.MATH.clamp((state.editor.camY !== undefined ? state.editor.camY : state.camera.y) + my * edSpd * dt, 40, world.height - 40);
        state.camera.x = state.editor.camX;
        state.camera.y = state.editor.camY;
        state.camera.shakeX = 0;
        state.camera.shakeY = 0;
        state.camera.shakeMag = 0;
        if (state.netRole !== 'host') return;
      }

      // 1. Обновляем каждого игрока (локального и всех сетевых участников)
      const localPaused = edActive || state.screen === 'paused';
      let localRenderPos = localP ? getRenderPos(localP) : { x: 150, y: 360 };
      for (let i = 0; i < playersList.length; i++) {
        const pl = playersList[i];
        const isLoc = pl === localP;
        const pInput = (isLoc && !localPaused) ? input : (pl.input || { keys: {}, worldMouseX: pl.x + 60, worldMouseY: pl.y, lmb: false, rmb: false });
        if (isLoc && localPaused) {
          // Когда хост в редакторе или на паузе, его боец стоит спокойно без приёма локального ввода
          const rp = updateSinglePlayer(state, world, pl, { keys: {}, worldMouseX: pl.x + 60, worldMouseY: pl.y, lmb: false, rmb: false }, dt);
          if (rp) localRenderPos = rp;
        } else {
          const rp = updateSinglePlayer(state, world, pl, pInput, dt);
          if (isLoc && rp) localRenderPos = rp;
        }
      }

      // Мягкое взаимное выталкивание живых игроков
      if (playersList.length > 1) {
        const minSep = G.CFG.playerRadius * 2;
        for (let i = 0; i < playersList.length; i++) {
          const a = playersList[i];
          if (!a || a.dead) continue;
          for (let j = i + 1; j < playersList.length; j++) {
            const b = playersList[j];
            if (!b || b.dead) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.hypot(dx, dy);
            if (d < minSep) {
              const nx = d > 1e-4 ? dx / d : 1;
              const ny = d > 1e-4 ? dy / d : 0;
              const push = (minSep - d) * 0.5;
              a.x -= nx * push;
              a.y -= ny * push;
              b.x += nx * push;
              b.y += ny * push;
            }
          }
        }
      }

      // 2. Обновление мира, дверей, лошади, ботов, баллистики и частиц
      world.updateDoors(dt, playersList, state);
      updateHorse(state, world, dt);
      world.updateTargets(dt, playersList, state);
      updateWaves(state, world, dt);
      updateCriticalAndBleeding(state, world, dt);
      updateDustStorm(state, world, dt);
      updateBanditCombat(state, world, dt);
      updateBullets(state, world, dt);
      updateBloodDrops(state, world, dt);
      updateFlyingHats(state, world, dt);
      updateShells(state, world, dt);
      updateParticles(state, world, dt);
      updateGunSmokeClouds(state, world, dt);

      // Редкий лёгкий дымок над активными кострами (отсекается при выключении через requiresUnlock)
      if (world && world.solids) {
        for (let ci = 0; ci < world.solids.length; ci++) {
          const cf = world.solids[ci];
          if (cf.type !== 'campfire' || cf._storyHidden) continue;
          cf._smokeTimer = (cf._smokeTimer || 0) - dt;
          if (cf._smokeTimer <= 0) {
            cf._smokeTimer = 0.42;
            if (!state.viewRect || (cf.x + cf.w >= state.viewRect.x - 40 && cf.x <= state.viewRect.x + state.viewRect.w + 40 && cf.y + cf.h >= state.viewRect.y - 40 && cf.y <= state.viewRect.y + state.viewRect.h + 40)) {
              spawnParticles(state, cf.x + cf.w * 0.5 + G.MATH.rand(-2, 2), cf.y + cf.h * 0.42, 1, {
                baseAngle: -Math.PI * 0.5, spread: 0.45, minSpeed: 10, maxSpeed: 20,
                minLife: 0.55, maxLife: 1.05, minSize: 1.5, maxSize: 2.6, grow: 2.2, drag: 1.4,
                colors: ['#cfc8b6', '#a8a293'], alpha: 0.34, kind: 'smoke'
              });
            }
          }
        }
      }

      // 3. Камера (следит за локальным игроком, если редактор не активен)
      if (!edActive && localP) {
        const lookAhead = input.rmb ? 42 : 24;
        const camTargetX = localRenderPos.x + Math.cos(localP.aimAngle) * lookAhead;
        const camTargetY = localRenderPos.y + Math.sin(localP.aimAngle) * lookAhead;
        state.camera.x = G.MATH.lerp(state.camera.x, camTargetX, Math.min(1, dt * 7.5));
        state.camera.y = G.MATH.lerp(state.camera.y, camTargetY, Math.min(1, dt * 7.5));

        if (state.camera.shakeMag > 0.05) {
          state.camera.shakeX = G.MATH.rand(-1, 1) * state.camera.shakeMag;
          state.camera.shakeY = G.MATH.rand(-1, 1) * state.camera.shakeMag;
          state.camera.shakeMag *= Math.exp(-16 * dt);
        } else {
          state.camera.shakeX = 0;
          state.camera.shakeY = 0;
          state.camera.shakeMag = 0;
        }
      }
    }
  };
})();
