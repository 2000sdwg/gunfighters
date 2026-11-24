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

  function getWeapon(state) {
    return G.WEAPONS[state.player.weaponIdx];
  }

  function getWState(state) {
    return state.player.weapons[state.player.weaponIdx];
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

  function getMuzzlePos(state) {
    const p = state.player;
    const w = getWeapon(state);
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

  function checkBarrelWallCollision(player, weapon, world) {
    const pos = getRenderPos(player);
    const a = player.aimAngle;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const rx = -dy;
    const ry = dx;

    const maxCheck = weapon.wallCheckLen + 5;
    const origins = [
      { x: pos.x + rx * 4.2, y: pos.y + ry * 4.2, len: maxCheck },
      { x: pos.x + rx * 1.2, y: pos.y + ry * 1.2, len: maxCheck - 1 }
    ];

    let bestHit = null;
    for (let i = 0; i < origins.length; i++) {
      const o = origins[i];
      const hit = G.MATH.raycastSegments(o.x, o.y, dx, dy, o.len, world.barrelSegments);
      if (hit && (!bestHit || hit.dist < bestHit.dist)) {
        bestHit = hit;
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

  function enterCover(state, info) {
    const p = state.player;
    p.inCover = true;
    p.peeking = false;
    p.coverObj = info.obj;
    p.coverNormalX = info.nx;
    p.coverNormalY = info.ny;
    p.x = info.nearX + info.nx * (G.CFG.playerRadius + 1.5);
    p.y = info.nearY + info.ny * (G.CFG.playerRadius + 1.5);
    p.vx = 0;
    p.vy = 0;
    G.AUDIO.playCoverSnap();
    showToast(state, 'В УКРЫТИИ — ЗАЖМИ ПКМ, ЧТОБЫ ВЫГЛЯНУТЬ', 1.35);
  }

  function exitCover(state) {
    const p = state.player;
    if (!p.inCover) return;
    p.inCover = false;
    p.peeking = false;
    p.coverObj = null;
  }

  function startRoll(state, world) {
    const p = state.player;
    if (p.rolling || p.rollCooldown > 0) return false;

    const ws = getWState(state);
    if (ws.reloading) closeReload(state);
    ws.daPullTimer = 0;

    let dx = 0;
    let dy = 0;
    const keys = state.input.keys;
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

    exitCover(state);
    p.rolling = true;
    p.rollTimer = G.CFG.rollDur;
    p.rollCooldown = G.CFG.rollCooldown;
    p.rollDx = dx;
    p.rollDy = dy;

    G.AUDIO.playRoll();
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

  function switchWeapon(state, idx) {
    if (idx < 0 || idx >= G.WEAPONS.length) return;
    const p = state.player;
    if (p.weaponIdx === idx) return;

    const curWs = getWState(state);
    if (curWs.reloading) closeReload(state);
    curWs.daPullTimer = 0;

    p.weaponIdx = idx;
    p.recoilKickAnim = 0;
    p.aimVel *= 0.35;
    p.bloom = Math.min(p.bloom, 0.06);
    G.AUDIO.playCock('sa');
  }

  // ==================== ИММЕРСИВНАЯ ПЕРЕЗАРЯДКА БАРАБАНА / ОКНА ВИНЧЕСТЕРА ====================

  function openReload(state, world) {
    const p = state.player;
    if (p.rolling) return;
    const w = getWeapon(state);
    const ws = getWState(state);
    ensureChambers(w, ws);

    if (ws.reloading) {
      insertOneRound(state, world);
      return;
    }

    if (ws.ammo >= w.capacity && !ws.chamberSpent) {
      showToast(state, 'ПОЛНЫЙ БОЕЗАПАС', 0.85);
      return;
    }

    ws.daPullTimer = 0;
    ws.cockTimer = 0;
    ws.reloading = true;
    ws.insertAnim = 0;
    ws.reloadOpenFrac = 0;

    const isCylinder = w.uiShape === 'cylinder';
    G.AUDIO.playReloadOpen(isCylinder);

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

      pushReloadEvent(state, {
        type: 'open_cylinder',
        weaponId: w.id,
        ejectedSlots: ejectedSlots
      });
    } else {
      pushReloadEvent(state, {
        type: 'open_tube',
        weaponId: w.id
      });
    }
  }

  // Вставка одного патрона: если передан chamberIdx (клик по конкретной каморе), вставляем именно туда
  function insertOneRound(state, world, chamberIdx) {
    const w = getWeapon(state);
    const ws = getWState(state);
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
        closeReload(state);
        return false;
      }

      ws.chambers[targetIdx] = 'live';
      ws.cylinderIdx = (targetIdx + 1) % ws.chambers.length;
      syncChamberCounts(w, ws);
      ws.insertAnim = w.reloadOneTime;
      G.AUDIO.playReloadInsert(true);

      pushReloadEvent(state, {
        type: 'insert_cylinder',
        weaponId: w.id,
        slotIdx: targetIdx
      });

      if (ws.ammo >= w.capacity) {
        ws.autoClosePending = true;
      }
      return true;
    }

    // Винчестер: вставка в трубчатый магазин через боковое окно
    if (ws.ammo >= w.capacity) {
      closeReload(state);
      return false;
    }

    ws.ammo += 1;
    ws.insertAnim = w.reloadOneTime;
    G.AUDIO.playReloadInsert(false);

    pushReloadEvent(state, {
      type: 'insert_tube',
      weaponId: w.id,
      ammo: ws.ammo
    });

    if (ws.ammo >= w.capacity) {
      ws.autoClosePending = true;
    }
    return true;
  }

  function closeReload(state) {
    const w = getWeapon(state);
    const ws = getWState(state);
    if (!ws.reloading) return;

    ws.reloading = false;
    ws.insertAnim = 0;
    ws.autoClosePending = false;
    ws.reloadOpenFrac = 0;

    const isCylinder = w.uiShape === 'cylinder';
    G.AUDIO.playReloadClose(isCylinder);

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

    pushReloadEvent(state, {
      type: 'close',
      weaponId: w.id
    });

    if (w.action === 'da') {
      ws.cocked = true;
    } else if (!ws.cocked && ws.ammo > 0) {
      const lbl = G.keyLabel(G.CFG.keys.cock);
      showToast(state, w.action === 'lever' ? `ДЁРНИ СКОБУ [${lbl}]` : `ВЗВЕДИ КУРОК [${lbl}]`, 1.0);
    }
  }

  function tryCock(state, world) {
    const p = state.player;
    if (p.rolling) return;
    const w = getWeapon(state);
    const ws = getWState(state);

    if (ws.reloading) {
      closeReload(state);
    }

    if (w.action === 'da') {
      showToast(state, 'ДВОЙНОЕ ДЕЙСТВИЕ — ВЗВОД НЕ НУЖЕН', 0.9);
      return;
    }

    if (ws.cockTimer > 0) return;

    if (w.action === 'sa') {
      if (ws.cocked) return;
      if (ws.ammo <= 0) {
        G.AUDIO.playDryClick();
        showToast(state, 'БАРАБАН ПУСТ — ЖМИ [R]', 1.0);
        return;
      }
      ws.cockDuration = w.cockTime;
      ws.cockTimer = w.cockTime;
      G.AUDIO.playCock('sa');
      return;
    }

    if (w.action === 'lever') {
      if (ws.cocked && !ws.chamberSpent) return;
      if (ws.ammo <= 0 && !ws.chamberSpent) {
        G.AUDIO.playDryClick();
        showToast(state, 'МАГАЗИН ПУСТ — ЖМИ [R]', 1.0);
        return;
      }
      ws.cockDuration = w.cockTime;
      ws.cockTimer = w.cockTime;
      ws.leverEjected = false;
      G.AUDIO.playCock('lever');
    }
  }

  function executeShot(state, world) {
    const p = state.player;
    const w = getWeapon(state);
    const ws = getWState(state);

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

    const muzzle = getMuzzlePos(state);
    const tri = Math.random() + Math.random() - 1;
    const uni = Math.random() * 2 - 1;
    const randSpread = (tri * 0.62 + uni * 0.38) * p.spread;
    const shotAngle = p.aimAngle + randSpread;
    const dx = Math.cos(shotAngle);
    const dy = Math.sin(shotAngle);

    const ignoreId = (p.inCover && p.coverObj && !p.coverObj.high) ? p.coverObj.id : null;

    state.bullets.push({
      x: muzzle.x,
      y: muzzle.y,
      px: muzzle.x,
      py: muzzle.y,
      dx: dx,
      dy: dy,
      speed: w.bulletSpeed,
      damage: w.damage,
      traveled: 0,
      falloffStart: w.falloffStart || 220,
      falloffEnd: w.falloffEnd || 460,
      falloffMinMult: w.falloffMinMult !== undefined ? w.falloffMinMult : 0.7,
      weaponId: w.id,
      life: 1.2,
      ignoreId: ignoreId
    });

    const recoilMult = G.CFG.phys.recoil;
    const dir = (Math.random() < 0.5 ? -1 : 1) * G.MATH.rand(0.75, 1.25);
    p.aimAngle = G.MATH.normAngle(p.aimAngle + dir * w.recoilKick * recoilMult * 0.42);
    p.aimVel += dir * w.recoilKick * recoilMult * 16.0;
    const maxSp = w.maxSpread || 0.30;
    p.bloom = Math.min(maxSp, p.bloom + w.bloomPerShot * recoilMult);
    p.recoilKickAnim = 1.0;
    p.flashTimer = 0.06;

    state.camera.shakeMag = Math.max(state.camera.shakeMag, w.recoilPush * recoilMult);
    state.camera.x -= dx * w.recoilPush * 0.85;
    state.camera.y -= dy * w.recoilPush * 0.85;

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

    if (world.waterBarrels) {
      for (let i = 0; i < world.waterBarrels.length; i++) {
        const b = world.waterBarrels[i];
        const bx = b.x + b.w * 0.5;
        const by = b.y + b.h * 0.5;
        const d = G.MATH.dist(muzzle.x, muzzle.y, bx, by);
        if (d < 95) {
          addWaterRipple(state, b.id, bx, by, b.w * 0.44, 0.55 * (1 - d / 95));
        }
      }
    }

    G.AUDIO.playShot(w, muzzle.x, muzzle.y, world, state);
  }

  function tryFire(state, world) {
    const p = state.player;
    const w = getWeapon(state);
    const ws = getWState(state);

    if (p.rolling) return;

    if (ws.reloading) {
      closeReload(state);
      return;
    }

    if (p.inCover && !p.peeking) {
      showToast(state, 'ЗАЖМИ ПКМ, ЧТОБЫ ВЫГЛЯНУТЬ', 1.0);
      return;
    }

    if (p.wallBlocked) {
      G.AUDIO.playDryClick();
      showToast(state, 'УПОР В СТЕНУ — СТВОЛ ПОДНЯТ ВВЕРХ', 1.1);
      return;
    }

    if (ws.cockTimer > 0) return;

    if (w.action === 'da') {
      if (ws.daCooldownTimer > 0 || ws.daPullTimer > 0) return;
      if (ws.ammo <= 0) {
        G.AUDIO.playDryClick();
        showToast(state, 'БАРАБАН ПУСТ — ЖМИ [R]', 1.0);
        return;
      }
      ws.daPullTimer = w.triggerPullTime;
      G.AUDIO.playTriggerTension();
      return;
    }

    if (!ws.cocked) {
      G.AUDIO.playDryClick();
      const lbl = G.keyLabel(G.CFG.keys.cock);
      if (ws.ammo <= 0 && !ws.chamberSpent) {
        showToast(state, 'ПУСТО — ЖМИ [R] ДЛЯ ЗАРЯДКИ', 1.05);
      } else {
        showToast(state, w.action === 'lever' ? `ДЁРНИ СКОБУ [${lbl}]` : `ВЗВЕДИ КУРОК [${lbl}]`, 1.05);
      }
      return;
    }

    if (ws.ammo <= 0) {
      ws.cocked = false;
      G.AUDIO.playDryClick();
      showToast(state, 'ПУСТО — ЖМИ [R]', 1.0);
      return;
    }

    executeShot(state, world);
  }

  function handleKeyDown(state, world, code) {
    if (code === 'Digit1') { switchWeapon(state, 0); return; }
    if (code === 'Digit2') { switchWeapon(state, 1); return; }
    if (code === 'Digit3') { switchWeapon(state, 2); return; }

    if (code === 'KeyR') {
      openReload(state, world);
      return;
    }
    if (code === 'Escape') {
      closeReload(state);
      return;
    }
    if (code === 'KeyV') {
      G.CFG.debugRays = !G.CFG.debugRays;
      showToast(state, G.CFG.debugRays ? 'ЛУЧИ ЭХА: ВКЛ' : 'ЛУЧИ ЭХА: ВЫКЛ', 0.9);
      return;
    }

    if (G.matchesKey('cock', code)) {
      tryCock(state, world);
    }

    const isCoverKey = G.matchesKey('cover', code);
    const isRollKey = G.matchesKey('roll', code);
    const p = state.player;
    const keys = state.input.keys;
    const movingInput = !!(keys.KeyW || keys.KeyS || keys.KeyA || keys.KeyD ||
      keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight);

    if (isCoverKey && isRollKey) {
      if (p.inCover) {
        if (movingInput) {
          startRoll(state, world);
        } else {
          exitCover(state);
        }
      } else if (p.nearCover && !movingInput) {
        enterCover(state, p.nearCover);
      } else {
        startRoll(state, world);
      }
    } else if (isCoverKey) {
      if (p.inCover) {
        exitCover(state);
      } else if (p.nearCover) {
        enterCover(state, p.nearCover);
      } else {
        showToast(state, 'НЕТ УКРЫТИЯ РЯДОМ', 0.85);
      }
    } else if (isRollKey) {
      startRoll(state, world);
    }
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

  function updateBullets(state, world, dt) {
    const P = getPal();

    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.life -= dt;
      if (b.life <= 0) {
        state.bullets.splice(i, 1);
        continue;
      }

      const stepDist = b.speed * dt;
      b.px = b.x;
      b.py = b.y;

      let bestDist = stepDist;
      let hitWall = null;

      for (let sIdx = 0; sIdx < world.wallSegments.length; sIdx++) {
        const seg = world.wallSegments[sIdx];
        if (b.ignoreId && seg.id === b.ignoreId) continue;
        const h = G.MATH.raySegment(b.x, b.y, b.dx, b.dy, bestDist, seg.x1, seg.y1, seg.x2, seg.y2);
        if (h) {
          bestDist = h.dist;
          hitWall = { ...h, seg: seg };
        }
      }

      let hitTarget = null;
      for (let tIdx = 0; tIdx < world.targets.length; tIdx++) {
        const t = world.targets[tIdx];
        if (!t.alive) continue;
        const ox = t.x - b.x;
        const oy = t.y - b.y;
        const proj = ox * b.dx + oy * b.dy;
        if (proj < 0 || proj > bestDist) continue;
        const perp2 = ox * ox + oy * oy - proj * proj;
        const rad = t.r + 2;
        if (perp2 <= rad * rad) {
          bestDist = proj;
          hitTarget = t;
          hitWall = null;
        }
      }

      if (hitTarget) {
        const hx = b.x + b.dx * bestDist;
        const hy = b.y + b.dy * bestDist;
        hitTarget.hitFlash = 0.14;
        hitTarget.wobble = 1.0;

        if (hitTarget.kind === 'bandit') {
          const hitCalc = calcBulletDamage(b, bestDist);
          const dealt = hitCalc.dmg;
          hitTarget.hp -= dealt;
          hitTarget.hurtTimer = 0.28;
          const isFatal = hitTarget.hp <= 0;

          G.AUDIO.playImpact('flesh');
          triggerHitConfirm(state, isFatal);

          const knock = (isFatal ? 165 : 85) * G.MATH.clamp(dealt / 55, 0.5, 1.7);
          hitTarget.knockVx = (hitTarget.knockVx || 0) + b.dx * knock;
          hitTarget.knockVy = (hitTarget.knockVy || 0) + b.dy * knock;

          state.camera.shakeMag = Math.max(state.camera.shakeMag, isFatal ? 3.5 : 1.5);

          spawnBloodBurst(state, hx, hy, b.dx, b.dy, dealt, isFatal);

          if (isFatal) {
            spawnFloatText(state, hitTarget.x, hitTarget.y - 4, `-${dealt}`, '#e85a4a', true);
          } else {
            const col = hitCalc.mult < 0.8 ? '#b8ab93' : '#e3c068';
            spawnFloatText(state, hitTarget.x, hitTarget.y - 2, `-${dealt}`, col, false);
          }

          if (isFatal) {
            hitTarget.alive = false;
            hitTarget.respawnTimer = 8.5;
            hitTarget.deathAnim = 0;
            hitTarget.bloodPool = 0;
            hitTarget.fallAngle = Math.atan2(b.dy, b.dx) + G.MATH.rand(-0.35, 0.35);
            spawnFlyingHat(state, hitTarget.x, hitTarget.y, b.dx, b.dy, hitTarget.hatColor, hitTarget.hatBand);
          }
        } else if (hitTarget.kind === 'bottle') {
          hitTarget.alive = false;
          hitTarget.respawnTimer = 8.0;
          G.AUDIO.playImpact('glass');
          triggerHitConfirm(state, false);
          spawnParticles(state, hx, hy, 12, {
            baseAngle: Math.atan2(b.dy, b.dx),
            spread: 1.2,
            minSpeed: 35,
            maxSpeed: 120,
            minLife: 0.25,
            maxLife: 0.55,
            minSize: 1.2,
            maxSize: 2.6,
            colors: ['#6d824d', '#8ea164', '#c89e45'],
            kind: 'debris'
          });
          addDecal(state, hitTarget.x, hitTarget.y, 4, 'rgba(109, 130, 77, 0.45)', { kind: 'glass' });
        } else if (hitTarget.kind === 'steel') {
          G.AUDIO.playImpact('metal');
          triggerHitConfirm(state, false);
          spawnParticles(state, hx, hy, 11, {
            baseAngle: Math.atan2(-b.dy, -b.dx),
            spread: 0.95,
            minSpeed: 65,
            maxSpeed: 175,
            minLife: 0.12,
            maxLife: 0.28,
            minSize: 1.2,
            maxSize: 2.2,
            colors: ['#f5e3ab', '#e3c068', '#ffffff'],
            kind: 'spark'
          });
        } else {
          const hitCalc = calcBulletDamage(b, bestDist);
          hitTarget.hp -= hitCalc.dmg;
          G.AUDIO.playImpact('wood');
          spawnParticles(state, hx, hy, 9, {
            baseAngle: Math.atan2(b.dy, b.dx),
            spread: 0.8,
            minSpeed: 35,
            maxSpeed: 115,
            minLife: 0.22,
            maxLife: 0.48,
            minSize: 1.5,
            maxSize: 3.0,
            colors: [P.woodWarm[0], P.woodWarm[1], P.woodWarm[2]],
            kind: 'debris'
          });
          if (hitTarget.hp <= 0) {
            hitTarget.alive = false;
            hitTarget.respawnTimer = 6.5;
            addDecal(state, hitTarget.x, hitTarget.y, 6, 'rgba(65, 42, 24, 0.45)');
          }
        }

        state.bullets.splice(i, 1);
        continue;
      }

      if (hitWall) {
        const mat = hitWall.seg.mat || 'wood';
        G.AUDIO.playImpact(mat);
        const reflAngle = Math.atan2(hitWall.ny, hitWall.nx);
        if (mat === 'water') {
          spawnParticles(state, hitWall.x, hitWall.y, 14, {
            baseAngle: reflAngle,
            spread: 1.25,
            minSpeed: 30,
            maxSpeed: 105,
            minLife: 0.25,
            maxLife: 0.55,
            minSize: 1.4,
            maxSize: 3.0,
            colors: [P.water[0], P.water[1], '#e8e3d5'],
            kind: 'debris'
          });
          addWaterRipple(state, hitWall.seg.id, hitWall.x, hitWall.y, 13, 1.0);
          addWaterRipple(state, hitWall.seg.id, hitWall.x, hitWall.y, 9, 0.7);
        } else if (mat === 'rock') {
          spawnParticles(state, hitWall.x, hitWall.y, 10, {
            baseAngle: reflAngle,
            spread: 0.85,
            minSpeed: 45,
            maxSpeed: 145,
            minLife: 0.16,
            maxLife: 0.42,
            minSize: 1.2,
            maxSize: 2.6,
            colors: ['#e3c068', P.canyon[0], P.stone[1]],
            kind: 'spark'
          });
        } else {
          spawnParticles(state, hitWall.x, hitWall.y, 8, {
            baseAngle: reflAngle,
            spread: 0.85,
            minSpeed: 30,
            maxSpeed: 95,
            minLife: 0.18,
            maxLife: 0.40,
            minSize: 1.3,
            maxSize: 2.6,
            colors: [P.woodWarm[0], P.woodWarm[1], P.woodWarm[2]],
            kind: 'debris'
          });
        }
        addDecal(state, hitWall.x - b.dx * 1, hitWall.y - b.dy * 1, 2.0, 'rgba(28, 18, 12, 0.72)');
        state.bullets.splice(i, 1);
        continue;
      }

      b.x += b.dx * stepDist;
      b.y += b.dy * stepDist;
      b.traveled = (b.traveled || 0) + stepDist;

      if (b.x < 0 || b.x > world.width || b.y < 0 || b.y > world.height) {
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

  function updateParticles(state, dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        state.particles.splice(i, 1);
        continue;
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

  G.SIM = {
    getWeapon,
    getWState,
    ensureChambers,
    getRenderPos,
    getHandOrigin,
    getMuzzlePos,
    addWaterRipple,
    spawnBloodBurst,
    showToast,
    switchWeapon,
    openReload,
    insertOneRound,
    closeReload,
    tryCock,
    tryFire,
    handleKeyDown,

    update(state, world, dt) {
      dt = Math.min(dt, 0.033);
      state.time += dt;
      if (!state.waterRipples) state.waterRipples = [];
      if (!state.bloodDrops) state.bloodDrops = [];
      if (!state.flyingHats) state.flyingHats = [];
      if (!state.floatTexts) state.floatTexts = [];
      if (!state.reloadEvents) state.reloadEvents = [];

      const P = getPal();
      const p = state.player;
      const w = getWeapon(state);
      const ws = getWState(state);
      const input = state.input;

      ensureChambers(w, ws);

      if (state.toast.timer > 0) {
        state.toast.timer = Math.max(0, state.toast.timer - dt);
      }
      if (p.flashTimer > 0) p.flashTimer = Math.max(0, p.flashTimer - dt);
      if (p.recoilKickAnim > 0) p.recoilKickAnim = Math.max(0, p.recoilKickAnim - dt * 6.5);
      if (p.rollCooldown > 0) p.rollCooldown = Math.max(0, p.rollCooldown - dt);

      // Плавное раскрытие барабана при перезарядке (0..1)
      ws.reloadOpenFrac = G.MATH.lerp(ws.reloadOpenFrac || 0, ws.reloading ? 1 : 0, Math.min(1, dt * 14));

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
            executeShot(state, world);
          }
        }
      }

      if (ws.insertAnim > 0) {
        ws.insertAnim = Math.max(0, ws.insertAnim - dt);
        if (ws.insertAnim === 0 && ws.autoClosePending) {
          closeReload(state);
        }
      }

      // 2. Движение, перекат и система укрытий
      let moveX = 0;
      let moveY = 0;
      if (input.keys.KeyW || input.keys.ArrowUp) moveY -= 1;
      if (input.keys.KeyS || input.keys.ArrowDown) moveY += 1;
      if (input.keys.KeyA || input.keys.ArrowLeft) moveX -= 1;
      if (input.keys.KeyD || input.keys.ArrowRight) moveX += 1;

      if (p.rolling) {
        p.rollTimer -= dt;
        p.vx = p.rollDx * G.CFG.rollSpeed;
        p.vy = p.rollDy * G.CFG.rollSpeed;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.rollTimer <= 0) {
          p.rolling = false;
          const maxSp = w.maxSpread || 0.30;
          p.bloom = Math.min(maxSp, p.bloom + G.CFG.rollEndSpread);
        }
      } else if (p.inCover) {
        p.vx = 0;
        p.vy = 0;
        p.peeking = !!(input.rmb && !ws.reloading);

        if (p.coverObj) {
          const aimX = Math.cos(p.targetAngle);
          const aimY = Math.sin(p.targetAngle);
          if (!p.coverObj.high) {
            p.peekDirX = aimX * 0.55 - p.coverNormalX * 0.45;
            p.peekDirY = aimY * 0.55 - p.coverNormalY * 0.45;
          } else {
            const tx = -p.coverNormalY;
            const ty = p.coverNormalX;
            const side = (tx * aimX + ty * aimY) >= 0 ? 1 : -1;
            p.peekDirX = tx * side;
            p.peekDirY = ty * side;
          }
          const len = Math.hypot(p.peekDirX, p.peekDirY) || 1;
          p.peekDirX /= len;
          p.peekDirY /= len;
        }

        if (moveX !== 0 || moveY !== 0) {
          exitCover(state);
        }
      } else {
        const focus = input.rmb && !ws.reloading;
        let maxSpd = G.CFG.walkSpeed;
        if (ws.reloading) maxSpd = G.CFG.reloadSpeed;
        else if (focus) maxSpd = G.CFG.focusSpeed;

        if (moveX !== 0 || moveY !== 0) {
          const len = Math.hypot(moveX, moveY);
          moveX /= len;
          moveY /= len;
        }

        p.vx = G.MATH.lerp(p.vx, moveX * maxSpd, Math.min(1, dt * 14));
        p.vy = G.MATH.lerp(p.vy, moveY * maxSpd, Math.min(1, dt * 14));
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      const targetPeek = (p.inCover && p.peeking) ? 1 : 0;
      p.peekFrac = G.MATH.lerp(p.peekFrac || 0, targetPeek, Math.min(1, dt * 15));

      p.x = G.MATH.clamp(p.x, 30, world.width - 30);
      p.y = G.MATH.clamp(p.y, 20, world.height - 20);
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < world.solids.length; i++) {
          const res = G.MATH.circleRectPush(p.x, p.y, G.CFG.playerRadius, world.solids[i]);
          if (res.hit) {
            p.x = res.x;
            p.y = res.y;
          }
        }
      }

      p.speed = Math.hypot(p.vx, p.vy);

      if (!p.rolling && !p.inCover && p.speed > 10) {
        p.walkPhase = (p.walkPhase || 0) + dt * (p.speed * 0.115);
      }

      if (!p.rolling && !p.inCover && p.speed > 26) {
        p.stepTimer = (p.stepTimer || 0) - dt;
        if (p.stepTimer <= 0) {
          p.stepTimer = input.rmb ? 0.44 : 0.30;
          p.stepSide = -(p.stepSide || 1);
          const surf = world.getSurfaceAt(p.x, p.y);
          G.AUDIO.playStep(surf);

          if (surf === 'dirt') {
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
              colors: state.zone === 'canyon' ? [P.canyon[0], P.canyon[1]] : [P.dirt[0], P.dirt[1]],
              alpha: 0.42,
              kind: 'smoke'
            });
          }

          if (world.waterBarrels) {
            for (let i = 0; i < world.waterBarrels.length; i++) {
              const b = world.waterBarrels[i];
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
      const rawTarget = Math.atan2(input.worldMouseY - renderPos.y, input.worldMouseX - renderPos.x);

      p.breathPhase += dt * (p.speed > 20 ? 3.2 : 1.7);
      const breathAmp = (input.rmb ? 0.004 : 0.012) * (p.inCover && p.peeking ? 0.55 : 1.0);
      const breathOff = Math.sin(p.breathPhase) * breathAmp + Math.sin(p.breathPhase * 2) * breathAmp * 0.4;
      p.targetAngle = G.MATH.normAngle(rawTarget + breathOff);

      const inertia = G.CFG.phys.inertia;
      const springMul = G.CFG.phys.spring;
      const effK = (w.springK / (w.weight * inertia)) * springMul;
      const effDamp = (w.damping / Math.sqrt(w.weight * inertia)) / Math.sqrt(springMul);

      const subDt = dt * 0.5;
      for (let s = 0; s < 2; s++) {
        const diff = G.MATH.angleDiff(p.aimAngle, p.targetAngle);
        const acc = diff * effK - p.aimVel * effDamp;
        p.aimVel += acc * subDt;
        p.aimAngle = G.MATH.normAngle(p.aimAngle + p.aimVel * subDt);
      }

      // 4. Динамический разброс
      p.bloom = Math.max(0, p.bloom - w.bloomDecay * dt);
      const moveRatio = G.MATH.clamp(p.speed / G.CFG.walkSpeed, 0, 1.35);
      const focusFactor = (input.rmb && !ws.reloading) ? w.focusMult : 1.0;
      const coverBonus = (p.inCover && p.peeking) ? 0.72 : 1.0;
      const swingPenalty = Math.min(0.14, Math.abs(p.aimVel) * 0.024);
      const maxSp = w.maxSpread || 0.30;

      const rawSpread = (w.baseSpread + moveRatio * w.moveSpread) * focusFactor * coverBonus + p.bloom + swingPenalty;
      const targetSpread = G.MATH.clamp(rawSpread, 0.004, maxSp);
      const spreadRate = targetSpread > p.spread ? 16 : 9;
      p.spread = G.MATH.lerp(p.spread, targetSpread, Math.min(1, dt * spreadRate));

      // 5. Проверка упора ствола в высокие стены
      const wallHit = checkBarrelWallCollision(p, w, world);
      p.wallBlocked = !!wallHit;
      p.wallHitDist = wallHit ? wallHit.dist : (w.wallCheckLen + 5);
      p.wallHitX = wallHit ? wallHit.x : null;
      p.wallHitY = wallHit ? wallHit.y : null;

      const raiseRate = p.wallBlocked ? 18 : 12;
      p.wallRaiseFrac = G.MATH.lerp(p.wallRaiseFrac || 0, p.wallBlocked ? 1 : 0, Math.min(1, dt * raiseRate));

      // 6. Зона карты и обновление мира
      const z = world.getZoneAt(p.x, p.y);
      state.zone = z.id;
      state.zoneLabel = z.label;

      world.updateDoors(dt, p);
      world.updateTargets(dt, p);
      updateBullets(state, world, dt);
      updateBloodDrops(state, world, dt);
      updateFlyingHats(state, world, dt);
      updateShells(state, world, dt);
      updateParticles(state, dt);

      // 7. Камера
      const lookAhead = input.rmb ? 42 : 24;
      const camTargetX = renderPos.x + Math.cos(p.aimAngle) * lookAhead;
      const camTargetY = renderPos.y + Math.sin(p.aimAngle) * lookAhead;
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
  };
})();
