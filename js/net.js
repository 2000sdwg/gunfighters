(function () {
  const G = (window.G = window.G || {});

  const PEER_PREFIX = 'polud-';
  const STUN_CFG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };
  const SNAP_INTERVAL = 0.05; // 20 Hz авторитативные снапшоты хоста
  const INPUT_INTERVAL = 0.036; // ~28 Hz отправка ввода клиента
  const PING_INTERVAL = 1.5;
  const INTERP_DELAY = 0.055; // ~55 мс буфер интерполяции на клиенте
  const MAX_PEERS = 6;

  // Палитра отличимых ковбойских плащей/бандан для сетевых игроков (из оттенков G.PAL)
  const COWBOY_PALETTES = [
    { coatColor: '#42120f', coatTrim: '#862a20', bandanaColor: '#c89e45' },
    { coatColor: '#24383c', coatTrim: '#4d7075', bandanaColor: '#cbb58e' },
    { coatColor: '#5b3623', coatTrim: '#996544', bandanaColor: '#c9241c' },
    { coatColor: '#38472b', coatTrim: '#6d824d', bandanaColor: '#a83c2e' },
    { coatColor: '#78561d', coatTrim: '#c89e45', bandanaColor: '#232d38' },
    { coatColor: '#3c3935', coatTrim: '#706c64', bandanaColor: '#7ba4ad' }
  ];

  const B64_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  function r1(v) { return Math.round((v || 0) * 10) / 10; }
  function r2(v) { return Math.round((v || 0) * 100) / 100; }
  function r3(v) { return Math.round((v || 0) * 1000) / 1000; }

  function lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  function encodeB64Json(obj) {
    const raw = encodeURIComponent(JSON.stringify(obj));
    const bytes = [];
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === '%') {
        bytes.push(parseInt(raw.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        bytes.push(raw.charCodeAt(i));
      }
    }
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const b0 = bytes[i];
      const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
      const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
      const n = (b0 << 16) | (b1 << 8) | b2;
      out += B64_ALPHA[(n >> 18) & 63];
      out += B64_ALPHA[(n >> 12) & 63];
      out += i + 1 < bytes.length ? B64_ALPHA[(n >> 6) & 63] : '=';
      out += i + 2 < bytes.length ? B64_ALPHA[n & 63] : '=';
    }
    return out;
  }

  function decodeB64Json(str) {
    const clean = String(str || '').replace(/\s+/g, '');
    if (!clean) throw new Error('ПУСТОЙ КОД');
    const bytes = [];
    for (let i = 0; i < clean.length; i += 4) {
      const c0 = B64_ALPHA.indexOf(clean[i]);
      const c1 = B64_ALPHA.indexOf(clean[i + 1]);
      const c2 = clean[i + 2] === '=' ? -1 : B64_ALPHA.indexOf(clean[i + 2]);
      const c3 = clean[i + 3] === '=' ? -1 : B64_ALPHA.indexOf(clean[i + 3]);
      if (c0 < 0 || c1 < 0) throw new Error('НЕКОРРЕКТНЫЙ BASE64');
      bytes.push((c0 << 2) | (c1 >> 4));
      if (c2 >= 0) bytes.push(((c1 & 15) << 4) | (c2 >> 2));
      if (c3 >= 0) bytes.push(((c2 & 3) << 6) | c3);
    }
    let pct = '';
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if ((b >= 48 && b <= 57) || (b >= 65 && b <= 90) || (b >= 97 && b <= 122) || b === 45 || b === 95 || b === 46 || b === 33 || b === 126 || b === 42 || b === 39 || b === 40 || b === 41) {
        pct += String.fromCharCode(b);
      } else {
        pct += '%' + ('0' + b.toString(16)).slice(-2);
      }
    }
    return JSON.parse(decodeURIComponent(pct));
  }

  function genRoomCode() {
    return 'WEST-' + Math.floor(1000 + Math.random() * 9000);
  }

  function normalizeRoomCode(raw) {
    const s = String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!s) return '';
    if (/^\d{4}$/.test(s)) return 'WEST-' + s;
    if (s.startsWith('WEST') && !s.startsWith('WEST-')) return 'WEST-' + s.slice(4);
    return s;
  }

  function safeParse(raw) {
    if (raw && typeof raw === 'object') return raw;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  function safeSend(sendFn, msg) {
    if (!sendFn) return;
    try {
      sendFn(msg);
    } catch (_) {}
  }

  const session = {
    role: 'offline', // 'offline' | 'host' | 'client'
    transport: 'none', // 'none' | 'peerjs' | 'manual' | 'loopback'
    roomCode: '',
    statusText: 'ОФФЛАЙН (ОДИНОЧНАЯ ИГРА)',
    errorText: '',
    peerJs: null,
    peers: {}, // peerId -> { id, playerId, name, hatId, sendFn, closeFn, rttMs }
    manualPendingPc: null,
    manualPendingDc: null,
    manualCode: '',
    clientHostPeer: null,
    clientClock: 0,
    snaps: [],
    snapSeq: 0,
    snapAccum: 0,
    inputAccum: 0,
    pingAccum: 0,
    inputSeq: 0,
    lastInputSig: '',
    playerSeq: 1,
    paletteSeq: 0,
    clientRttMs: 0,
    localPingTs: 0,
    stateRef: null,
    worldRef: null
  };

  function resetTransportOnly(state) {
    Object.keys(session.peers).forEach((k) => {
      const entry = session.peers[k];
      if (entry && entry.closeFn) {
        try { entry.closeFn(); } catch (_) {}
      }
    });
    session.peers = {};

    if (session.clientHostPeer && session.clientHostPeer.closeFn) {
      try { session.clientHostPeer.closeFn(); } catch (_) {}
    }
    session.clientHostPeer = null;

    if (session.manualPendingDc) {
      try { session.manualPendingDc.close(); } catch (_) {}
      session.manualPendingDc = null;
    }
    if (session.manualPendingPc) {
      try { session.manualPendingPc.close(); } catch (_) {}
      session.manualPendingPc = null;
    }
    if (session.peerJs) {
      try { session.peerJs.destroy(); } catch (_) {}
      session.peerJs = null;
    }

    session.snaps = [];
    session.snapAccum = 0;
    session.inputAccum = 0;
    session.pingAccum = 0;
    session.snapSeq = 0;
    session.inputSeq = 0;
    session.lastInputSig = '';
    session.clientClock = 0;
    session.clientRttMs = 0;
    if (state) state.netEvents = [];
  }

  function disconnect(state, world, silent) {
    const st = state || session.stateRef;
    resetTransportOnly(st);
    session.role = 'offline';
    session.transport = 'none';
    session.roomCode = '';
    session.manualCode = '';
    session.errorText = '';
    session.statusText = 'ОФФЛАЙН (ОДИНОЧНАЯ ИГРА)';

    if (st) {
      st.netRole = 'offline';
      st.mpMode = 'coop';
      st.friendlyFire = false;
      const keep = (st.players && st.players[st.localPlayerId]) || st.player || G.createPlayerState('local', 150, 360, { isLocal: true });
      keep.id = 'local';
      keep.isLocal = true;
      keep.name = (G.CFG.playerName || keep.name || 'СТРЕЛОК').slice(0, 18);
      keep.hatId = G.CFG.selectedHat || keep.hatId || 'classic';
      keep.coatColor = null;
      keep.coatTrim = null;
      keep.bandanaColor = null;
      st.localPlayerId = 'local';
      st.players = { local: keep };
      if (!silent && G.SIM && G.SIM.showToast) {
        G.SIM.showToast(st, 'ОТКЛЮЧЕНО ОТ СЕТИ', 1.2);
      }
    }
  }

  // ==================== СЕРИАЛИЗАЦИЯ СНАПШОТА ХОСТА (20 HZ) ====================

  function packWeapons(p) {
    const out = [];
    const list = p.weapons || [];
    for (let i = 0; i < list.length; i++) {
      const ws = list[i];
      out.push({
        a: ws.ammo || 0,
        s: ws.spent || 0,
        ck: ws.cocked ? 1 : 0,
        rl: ws.reloading ? 1 : 0,
        ct: r2(ws.cockTimer || 0),
        cs: ws.chamberSpent ? 1 : 0,
        ch: Array.isArray(ws.chambers) ? ws.chambers.slice() : null,
        ci: ws.cylinderIdx || 0,
        ia: r2(ws.insertAnim || 0),
        da: r2(ws.daPullTimer || 0),
        dac: r2(ws.daCooldownTimer || 0)
      });
    }
    return out;
  }

  function applyWeapons(p, packed) {
    if (!Array.isArray(packed)) return;
    if (!p.weapons || p.weapons.length !== packed.length) {
      p.weapons = G.WEAPONS.map(G.createWeaponState);
    }
    for (let i = 0; i < packed.length; i++) {
      const src = packed[i];
      const dst = p.weapons[i];
      if (!src || !dst) continue;
      dst.ammo = src.a;
      dst.spent = src.s;
      dst.cocked = !!src.ck;
      dst.reloading = !!src.rl;
      dst.cockTimer = src.ct || 0;
      dst.chamberSpent = !!src.cs;
      if (Array.isArray(src.ch)) dst.chambers = src.ch.slice();
      dst.cylinderIdx = src.ci || 0;
      dst.insertAnim = src.ia || 0;
      dst.daPullTimer = src.da || 0;
      dst.daCooldownTimer = src.dac || 0;
    }
  }

  function getPeerRttForPlayer(playerId) {
    const keys = Object.keys(session.peers);
    for (let i = 0; i < keys.length; i++) {
      const pr = session.peers[keys[i]];
      if (pr && pr.playerId === playerId) return pr.rttMs || 0;
    }
    return 0;
  }

  function buildSnapshot(state, world) {
    const playersList = G.getPlayersList ? G.getPlayersList(state) : (state.player ? [state.player] : []);
    const plArr = [];
    for (let i = 0; i < playersList.length; i++) {
      const p = playersList[i];
      if (!p) continue;
      plArr.push({
        id: p.id,
        name: p.name || 'СТРЕЛОК',
        hatId: p.hatId || 'classic',
        cc: p.coatColor || null,
        ct: p.coatTrim || null,
        bc: p.bandanaColor || null,
        rtt: p.id === state.localPlayerId ? 0 : getPeerRttForPlayer(p.id),
        x: r1(p.x),
        y: r1(p.y),
        vx: r1(p.vx),
        vy: r1(p.vy),
        aa: r3(p.aimAngle),
        spd: r1(p.speed),
        wp: r2(p.walkPhase),
        hp: r1(p.hp),
        mhp: p.maxHp || 100,
        dead: p.dead ? 1 : 0,
        rt: r1(p.respawnTimer || 0),
        ht: r2(p.hurtTimer || 0),
        roll: p.rolling ? 1 : 0,
        rdx: r2(p.rollDx || 0),
        rdy: r2(p.rollDy || 0),
        cov: p.inCover ? 1 : 0,
        pk: p.peeking ? 1 : 0,
        pf: r2(p.peekFrac || 0),
        cf: r2(p.coverFrac || 0),
        crf: r2(p.crouchFrac || 0),
        cnx: r2(p.coverNormalX || 0),
        cny: r2(p.coverNormalY || 0),
        wb: p.wallBlocked ? 1 : 0,
        wrf: r2(p.wallRaiseFrac || 0),
        bnd: p.bandages !== undefined ? p.bandages : 2,
        bdg: p.bandaging ? 1 : 0,
        bdt: r2(p.bandageTimer || 0),
        drk: p.drinking ? 1 : 0,
        drt: r2(p.drinkTimer || 0),
        crit: p.critical ? 1 : 0,
        bld: p.bleeding ? 1 : 0,
        con: r2(p.concussion || 0),
        smk: p.smokingState ? { phase: p.smokingState.phase, timer: r2(p.smokingState.timer) } : null,
        kl: p.kills || 0,
        dt: p.deaths || 0,
        wi: p.weaponIdx || 0,
        w: packWeapons(p)
      });
    }

    const targets = world && world.targets ? world.targets : [];
    const enArr = [];
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (!t) continue;
      if (t.kind === 'bandit') {
        enArr.push({
          id: t.id,
          k: 1,
          name: t.name || 'БАНДИТ',
          x: r1(t.x),
          y: r1(t.y),
          hp: r1(t.hp),
          mhp: t.maxHp || 80,
          al: t.alive ? 1 : 0,
          a: r3(t.angle || 0),
          wp: r2(t.walkPhase || 0),
          hf: r2(t.hitFlash || 0),
          ht: r2(t.hurtTimer || 0),
          wb: r2(t.wobble || 0),
          da: r2(t.deathAnim || 0),
          fa: r2(t.fallAngle || 0),
          bp: r2(t.bloodPool || 0),
          inCov: t.inCover ? 1 : 0,
          pk: t.peeking ? 1 : 0,
          crf: r2(t.crouchFrac || 0),
          dg: t.isDodging ? 1 : 0,
          wrf: r2(t.wallRaiseFrac || 0),
          fl: t.fleeTimer > 0 ? 1 : 0,
          tgh: t.tough ? 1 : 0,
          htl: t.hatless ? 1 : 0,
          hc: t.hatColor,
          hb: t.hatBand,
          cc: t.coatColor,
          ct: t.coatTrim,
          bn: t.bandana,
          gt: t.gunType || 'revolver',
          ai: t.aiState || 'patrol'
        });
      } else {
        enArr.push({
          id: t.id,
          k: 0,
          al: t.alive ? 1 : 0,
          hf: r2(t.hitFlash || 0),
          wb: r2(t.wobble || 0)
        });
      }
    }

    const solidsDmg = [];
    const solids = world && world.solids ? world.solids : [];
    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      if (!s || !s.destructible) continue;
      const hasDmg = (s.breachHp !== undefined && s.breachHp < (s.maxBreachHp || 180)) ||
        s.breached ||
        (s.waterLevel !== undefined && s.waterLevel < 1) ||
        (s.holes && s.holes.length > 0) ||
        (s.hitFlash && s.hitFlash > 0);
      if (!hasDmg) continue;
      solidsDmg.push({
        id: s.id,
        bhp: r1(s.breachHp !== undefined ? s.breachHp : 180),
        br: s.breached ? 1 : 0,
        wl: s.waterLevel !== undefined ? r3(s.waterLevel) : 1,
        wa: s.waterActive ? 1 : 0,
        hf: r2(s.hitFlash || 0),
        hl: Array.isArray(s.holes) ? s.holes.map((h) => ({ nx: r2(h.nx), ny: r2(h.ny), t: h.t })) : []
      });
    }

    const puddles = (world && world.puddles ? world.puddles : []).map((pd) => ({
      id: pd.id,
      cid: pd.containerId || pd.barrelId,
      x: r1(pd.x),
      y: r1(pd.y),
      r: r1(pd.r),
      mr: r1(pd.maxR || 30),
      a: r2(pd.alpha !== undefined ? pd.alpha : 1)
    }));

    const doors = (world && world.doors ? world.doors : []).map((d) => ({
      a: r3(d.angle || 0),
      v: r2(d.vel || 0)
    }));

    const bullets = (state.bullets || []).map((b) => ({
      x: r1(b.x),
      y: r1(b.y),
      px: r1(b.px !== undefined ? b.px : b.x),
      py: r1(b.py !== undefined ? b.py : b.y),
      dx: r3(b.dx),
      dy: r3(b.dy),
      spd: Math.round(b.speed || 700),
      wi: b.weaponId || 'walker'
    }));

    const wv = state.waves || {};
    const ds = state.dustStorm || {};
    const events = state.netEvents ? state.netEvents.splice(0, state.netEvents.length) : [];

    return {
      t: 'snap',
      seq: ++session.snapSeq,
      st: r3(state.time),
      sCnt: solids.length,
      mp: { m: state.mpMode || 'coop', ff: !!state.friendlyFire },
      wv: { a: !!wv.active, w: wv.wave || 0, p: wv.phase || 'idle', bt: r1(wv.breakTimer || 0) },
      ds: { a: !!ds.active, i: r2(ds.intensity || 0), d: r1(ds.duration || 0), tm: r1(ds.timer || 0) },
      sb: !!(state.saloonProps && state.saloonProps.bourbonAvailable),
      pl: plArr,
      en: enArr,
      sd: solidsDmg,
      pd: puddles,
      dr: doors,
      bl: bullets,
      ev: events
    };
  }

  // ==================== ОБРАБОТКА ВХОДЯЩИХ СООБЩЕНИЙ ====================

  function spawnRemotePlayer(state, world, entry, name, hatId) {
    if (!state) return null;
    if (entry.playerId && state.players[entry.playerId]) {
      return state.players[entry.playerId];
    }
    const pid = 'p_' + (session.playerSeq++);
    const pal = COWBOY_PALETTES[(session.paletteSeq++) % COWBOY_PALETTES.length];
    const pl = G.createPlayerState(pid, 175, 360, {
      isLocal: false,
      name: name || ('КОВБОЙ ' + pid.slice(2)),
      hatId: hatId || 'classic',
      coatColor: pal.coatColor,
      coatTrim: pal.coatTrim,
      bandanaColor: pal.bandanaColor
    });
    state.players[pid] = pl;
    if (G.SIM && G.SIM.pickSpawnForPlayer) {
      const sp = G.SIM.pickSpawnForPlayer(state, world, pl);
      if (sp) {
        pl.x = sp.x;
        pl.y = sp.y;
      }
    }
    entry.playerId = pid;
    entry.name = pl.name;
    entry.hatId = pl.hatId;
    if (G.SIM && G.SIM.showToast) {
      G.SIM.showToast(state, `${pl.name} ПОДКЛЮЧИЛСЯ`, 1.6);
    }
    return pl;
  }

  function sendWelcomeToEntry(state, world, entry) {
    safeSend(entry.sendFn, {
      t: 'welcome',
      yourId: entry.playerId,
      roomCode: session.roomCode || '',
      mpMode: state.mpMode || 'coop',
      friendlyFire: !!state.friendlyFire,
      solids: world && world.exportSolidsList ? world.exportSolidsList() : []
    });
    safeSend(entry.sendFn, buildSnapshot(state, world));
  }

  function handleHostIncomingMessage(state, world, entry, msg) {
    if (!msg || !state || session.role !== 'host') return;
    if (msg.t === 'hello') {
      entry.name = String(msg.name || 'КОВБОЙ').slice(0, 18);
      entry.hatId = msg.hatId || 'classic';
      spawnRemotePlayer(state, world, entry, entry.name, entry.hatId);
      sendWelcomeToEntry(state, world, entry);
      return;
    }
    if (msg.t === 'ping') {
      safeSend(entry.sendFn, { t: 'pong', ts: msg.ts });
      return;
    }
    if (msg.t === 'pong') {
      if (msg.ts) {
        entry.rttMs = Math.max(0, Math.round(Date.now() - msg.ts));
      }
      return;
    }

    const pl = entry.playerId && state.players ? state.players[entry.playerId] : null;
    if (!pl) return;

    if (msg.t === 'input') {
      if (!pl.input) pl.input = { keys: {}, worldMouseX: pl.x + 60, worldMouseY: pl.y, lmb: false, rmb: false };
      pl.input.keys = msg.keys || {};
      if (typeof msg.mx === 'number' && !isNaN(msg.mx)) pl.input.worldMouseX = msg.mx;
      if (typeof msg.my === 'number' && !isNaN(msg.my)) pl.input.worldMouseY = msg.my;
      pl.input.lmb = !!msg.lmb;
      pl.input.rmb = !!msg.rmb;
      return;
    }

    if (msg.t === 'cmd') {
      if (typeof msg.mx === 'number' && !isNaN(msg.mx)) pl.input.worldMouseX = msg.mx;
      if (typeof msg.my === 'number' && !isNaN(msg.my)) pl.input.worldMouseY = msg.my;

      if (msg.cmd === 'fire') {
        if (G.SIM && G.SIM.tryFire) G.SIM.tryFire(state, world, pl);
      } else if (msg.cmd === 'action' || msg.cmd === 'keydown') {
        if (G.SIM && G.SIM.handleKeyDownForPlayer) {
          G.SIM.handleKeyDownForPlayer(state, world, pl, msg.code, pl.input);
        }
      } else if (msg.cmd === 'switch_weapon') {
        if (G.SIM && G.SIM.switchWeapon) G.SIM.switchWeapon(state, msg.idx, pl);
      } else if (msg.cmd === 'insert_round') {
        if (G.SIM && G.SIM.insertOneRound) G.SIM.insertOneRound(state, world, msg.chamberIdx, pl);
      } else if (msg.cmd === 'close_reload') {
        if (G.SIM && G.SIM.closeReload) G.SIM.closeReload(state, pl);
      } else if (msg.cmd === 'bandage') {
        if (G.SIM && G.SIM.tryUseBandage) G.SIM.tryUseBandage(state, pl);
      } else if (msg.cmd === 'select_hat') {
        pl.hatId = msg.hatId || 'classic';
        entry.hatId = pl.hatId;
      } else if (msg.cmd === 'profile') {
        if (msg.name) {
          pl.name = String(msg.name).slice(0, 18);
          entry.name = pl.name;
        }
        if (msg.hatId) {
          pl.hatId = msg.hatId;
          entry.hatId = pl.hatId;
        }
      }
    }
  }

  function makeFallbackBanditFromSnap(es) {
    return {
      id: es.id,
      x: es.x,
      y: es.y,
      kind: 'bandit',
      mat: 'flesh',
      r: 11,
      hp: es.hp,
      maxHp: es.mhp || 80,
      alive: !!es.al,
      angle: es.a || 0,
      walkPhase: es.wp || 0,
      hitFlash: es.hf || 0,
      hurtTimer: es.ht || 0,
      wobble: es.wb || 0,
      deathAnim: es.da || 0,
      fallAngle: es.fa || 0,
      bloodPool: es.bp || 0,
      inCover: !!es.inCov,
      peeking: !!es.pk,
      crouchFrac: es.crf || 0,
      isDodging: !!es.dg,
      wallRaiseFrac: es.wrf || 0,
      fleeTimer: es.fl ? 1 : 0,
      tough: !!es.tgh,
      hatless: !!es.htl,
      hatColor: es.hc || '#1c1714',
      hatBand: es.hb || '#7d2820',
      coatColor: es.cc || '#262423',
      coatTrim: es.ct || '#3d3733',
      bandana: es.bn || '#8a2b22',
      gunType: es.gt || 'revolver',
      name: es.name || 'БАНДИТ',
      _netPrevX: es.x, _netPrevY: es.y, _netPrevA: es.a || 0,
      _netNextX: es.x, _netNextY: es.y, _netNextA: es.a || 0
    };
  }

  function replayNetEvents(state, world, events) {
    if (!Array.isArray(events) || !events.length) return;
    const lp = G.SIM && G.SIM.resolvePlayer ? G.SIM.resolvePlayer(state) : state.player;
    const lx = lp ? lp.x : 150;
    const ly = lp ? lp.y : 360;

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (!ev || !ev.kind) continue;
      if (ev.kind === 'shot') {
        const isLoc = !!(lp && ev.playerId === lp.id);
        const shooter = ev.playerId && state.players ? state.players[ev.playerId] : null;
        if (shooter) {
          shooter.flashTimer = 0.08;
          shooter.recoilKickAnim = 1.0;
        }
        if (G.AUDIO && G.AUDIO.playShot) {
          G.AUDIO.playShot(ev.soundType || ev.weaponId || 'walker', ev.x, ev.y, world, state, {
            isEnemy: !!ev.isEnemy || !isLoc,
            listenerX: lx,
            listenerY: ly,
            skipHudUpdate: !isLoc
          });
        }
        if (G.SIM && G.SIM.spawnClientShotFx) {
          G.SIM.spawnClientShotFx(state, world, ev.x, ev.y, ev.weaponId || ev.soundType, ev.ang, isLoc);
        }
      } else if (ev.kind === 'impact') {
        if (G.AUDIO && G.AUDIO.playImpact) G.AUDIO.playImpact(ev.mat || 'wood');
        if (G.SIM && G.SIM.spawnClientImpactFx) G.SIM.spawnClientImpactFx(state, ev.mat, ev.x, ev.y);
      } else if (ev.kind === 'ricochet') {
        if (G.AUDIO && G.AUDIO.playRicochet) G.AUDIO.playRicochet(ev.x, ev.y, lx, ly);
        if (G.SIM && G.SIM.spawnClientImpactFx) G.SIM.spawnClientImpactFx(state, 'metal', ev.x, ev.y);
      } else if (ev.kind === 'drink') {
        if (G.AUDIO && G.AUDIO.playDrink) G.AUDIO.playDrink();
      } else if (ev.kind === 'bandage') {
        if (G.AUDIO && G.AUDIO.playBandage) G.AUDIO.playBandage();
      } else if (ev.kind === 'roll') {
        if (G.AUDIO && G.AUDIO.playRoll) G.AUDIO.playRoll();
      } else if (ev.kind === 'dry') {
        if (lp && ev.playerId === lp.id && G.AUDIO && G.AUDIO.playDryClick) G.AUDIO.playDryClick();
      } else if (ev.kind === 'cock') {
        if (lp && ev.playerId === lp.id && G.AUDIO && G.AUDIO.playCock) G.AUDIO.playCock(ev.action || 'sa');
      }
    }
  }

  function applySnapshotDiscrete(state, world, snap) {
    if (!snap || !state) return;

    if (snap.mp) {
      state.mpMode = snap.mp.m || 'coop';
      state.friendlyFire = !!snap.mp.ff;
    }

    if (snap.wv) {
      if (!state.waves) state.waves = {};
      state.waves.active = !!snap.wv.a;
      state.waves.wave = snap.wv.w || 0;
      state.waves.phase = snap.wv.p || 'idle';
      state.waves.breakTimer = snap.wv.bt || 0;
    }

    if (snap.ds) {
      if (!state.dustStorm) state.dustStorm = { active: false, intensity: 0, timer: 0, duration: 0, tumbleweeds: [] };
      state.dustStorm.active = !!snap.ds.a;
      state.dustStorm.intensity = snap.ds.i || 0;
      state.dustStorm.duration = snap.ds.d || 0;
      state.dustStorm.timer = snap.ds.tm || 0;
    }

    if (state.saloonProps) {
      state.saloonProps.bourbonAvailable = !!snap.sb;
    }

    // 1. Синхронизация игроков (добавление/удаление + дискретные флаги, позиции интерполируются)
    if (Array.isArray(snap.pl)) {
      const seenIds = {};
      for (let i = 0; i < snap.pl.length; i++) {
        const ps = snap.pl[i];
        seenIds[ps.id] = true;
        let pl = state.players[ps.id];
        if (!pl) {
          pl = G.createPlayerState(ps.id, ps.x, ps.y, {
            isLocal: ps.id === state.localPlayerId,
            name: ps.name,
            hatId: ps.hatId,
            coatColor: ps.cc,
            coatTrim: ps.ct,
            bandanaColor: ps.bc
          });
          pl._netPrevX = ps.x;
          pl._netPrevY = ps.y;
          pl._netPrevA = ps.aa;
          state.players[ps.id] = pl;
        }
        pl.name = ps.name || pl.name;
        pl.hatId = ps.hatId || pl.hatId;
        pl.coatColor = ps.cc || null;
        pl.coatTrim = ps.ct || null;
        pl.bandanaColor = ps.bc || null;
        pl.netRttMs = ps.rtt || 0;

        // Предыдущая цель интерполяции -> старт новой
        const jumpDist = Math.hypot((ps.x - (pl._netNextX !== undefined ? pl._netNextX : pl.x)), (ps.y - (pl._netNextY !== undefined ? pl._netNextY : pl.y)));
        if (jumpDist > 120) {
          // Мгновенный телепорт при респавне
          pl.x = ps.x;
          pl.y = ps.y;
          pl._netPrevX = ps.x;
          pl._netPrevY = ps.y;
        } else {
          pl._netPrevX = pl.x;
          pl._netPrevY = pl.y;
        }
        pl._netPrevA = pl.aimAngle || 0;
        pl._netNextX = ps.x;
        pl._netNextY = ps.y;
        pl._netNextA = ps.aa;
        pl.vx = ps.vx || 0;
        pl.vy = ps.vy || 0;
        pl.speed = ps.spd || 0;
        pl.walkPhase = ps.wp || 0;
        pl.hp = ps.hp;
        pl.maxHp = ps.mhp || 100;
        pl.dead = !!ps.dead;
        pl.respawnTimer = ps.rt || 0;
        pl.hurtTimer = ps.ht || 0;
        pl.rolling = !!ps.roll;
        pl.rollDx = ps.rdx || 0;
        pl.rollDy = ps.rdy || 0;
        pl.inCover = !!ps.cov;
        pl.peeking = !!ps.pk;
        pl.peekFrac = ps.pf || 0;
        pl.coverFrac = ps.cf || 0;
        pl.crouchFrac = ps.crf || 0;
        pl.coverNormalX = ps.cnx || 0;
        pl.coverNormalY = ps.cny || 0;
        pl.wallBlocked = !!ps.wb;
        pl.wallRaiseFrac = ps.wrf || 0;
        pl.bandages = ps.bnd;
        pl.bandaging = !!ps.bdg;
        pl.bandageTimer = ps.bdt || 0;
        pl.drinking = !!ps.drk;
        pl.drinkTimer = ps.drt || 0;
        pl.critical = !!ps.crit;
        pl.bleeding = !!ps.bld;
        pl.concussion = ps.con || 0;
        pl.smokingState = ps.smk || null;
        pl.kills = ps.kl || 0;
        pl.deaths = ps.dt || 0;
        pl.weaponIdx = ps.wi || 0;
        applyWeapons(pl, ps.w);
      }

      Object.keys(state.players).forEach((pid) => {
        if (!seenIds[pid] && pid !== state.localPlayerId) {
          delete state.players[pid];
        }
      });
    }

    // 2. Синхронизация целей и бандитов
    if (world && Array.isArray(snap.en)) {
      const targetMap = {};
      for (let i = 0; i < world.targets.length; i++) {
        targetMap[world.targets[i].id] = world.targets[i];
      }
      const nextTargets = [];
      for (let i = 0; i < snap.en.length; i++) {
        const es = snap.en[i];
        let t = targetMap[es.id];
        if (es.k === 1) {
          if (!t) {
            t = makeFallbackBanditFromSnap(es);
          } else {
            const jDist = Math.hypot(es.x - t.x, es.y - t.y);
            t._netPrevX = jDist > 120 ? es.x : t.x;
            t._netPrevY = jDist > 120 ? es.y : t.y;
            t._netPrevA = t.angle || 0;
            if (jDist > 120) {
              t.x = es.x;
              t.y = es.y;
            }
          }
          t._netNextX = es.x;
          t._netNextY = es.y;
          t._netNextA = es.a || 0;
          t.name = es.name || t.name;
          t.hp = es.hp;
          t.maxHp = es.mhp || t.maxHp;
          t.alive = !!es.al;
          t.walkPhase = es.wp || 0;
          t.hitFlash = es.hf || 0;
          t.hurtTimer = es.ht || 0;
          t.wobble = es.wb || 0;
          t.deathAnim = es.da || 0;
          t.fallAngle = es.fa || 0;
          t.bloodPool = es.bp || 0;
          t.inCover = !!es.inCov;
          t.peeking = !!es.pk;
          t.crouchFrac = es.crf || 0;
          t.isDodging = !!es.dg;
          t.wallRaiseFrac = es.wrf || 0;
          t.fleeTimer = es.fl ? 1 : 0;
          t.tough = !!es.tgh;
          t.hatless = !!es.htl;
          t.hatColor = es.hc || t.hatColor;
          t.hatBand = es.hb || t.hatBand;
          t.coatColor = es.cc || t.coatColor;
          t.coatTrim = es.ct || t.coatTrim;
          t.bandana = es.bn || t.bandana;
          t.gunType = es.gt || t.gunType;
          t.aiState = es.ai || t.aiState;
          nextTargets.push(t);
        } else if (t) {
          t.alive = !!es.al;
          t.hitFlash = es.hf || 0;
          t.wobble = es.wb || 0;
          nextTargets.push(t);
        }
      }
      world.targets = nextTargets;
    }

    // 3. Состояние износа укрытий и воды в бочках/корытах
    if (world && Array.isArray(snap.sd)) {
      const dmgById = {};
      for (let i = 0; i < snap.sd.length; i++) dmgById[snap.sd[i].id] = snap.sd[i];
      for (let i = 0; i < world.solids.length; i++) {
        const s = world.solids[i];
        if (!s || !s.destructible) continue;
        const d = dmgById[s.id];
        if (d) {
          s.breachHp = d.bhp;
          s.breached = !!d.br;
          s.waterLevel = d.wl;
          s.waterActive = !!d.wa;
          s.hitFlash = d.hf || 0;
          s.holes = Array.isArray(d.hl) ? d.hl.slice() : [];
        }
      }
    }

    // 4. Лужи воды
    if (world && Array.isArray(snap.pd)) {
      world.puddles = snap.pd.map((p) => ({
        id: p.id,
        containerId: p.cid,
        barrelId: p.cid,
        x: p.x,
        y: p.y,
        r: p.r,
        maxR: p.mr || 30,
        alpha: p.a !== undefined ? p.a : 1,
        wet: true,
        extinguishesFire: true
      }));
    }

    // 5. Двери салуна (целевой угол для интерполяции)
    if (world && Array.isArray(snap.dr)) {
      for (let i = 0; i < world.doors.length && i < snap.dr.length; i++) {
        const d = world.doors[i];
        d._netPrevA = d.angle || 0;
        d._netNextA = snap.dr[i].a || 0;
        d.vel = snap.dr[i].v || 0;
      }
    }

    // 6. Летящие пули
    if (Array.isArray(snap.bl)) {
      state.bullets = snap.bl.map((b) => ({
        x: b.x,
        y: b.y,
        px: b.px,
        py: b.py,
        dx: b.dx,
        dy: b.dy,
        speed: b.spd || 700,
        weaponId: b.wi || 'walker'
      }));
    }

    // 7. Дискретные события (выстрелы, попадания, глотки, бинты, рикошеты)
    replayNetEvents(state, world, snap.ev);
  }

  function handleClientIncomingMessage(state, world, msg) {
    if (!msg || !state || session.role !== 'client') return;
    if (msg.t === 'welcome') {
      const oldLocal = state.players && state.players[state.localPlayerId];
      const keepName = (G.CFG.playerName || (oldLocal && oldLocal.name) || 'СТРЕЛОК').slice(0, 18);
      const keepHat = G.CFG.selectedHat || (oldLocal && oldLocal.hatId) || 'classic';

      state.localPlayerId = msg.yourId;
      state.mpMode = msg.mpMode || 'coop';
      state.friendlyFire = !!msg.friendlyFire;
      if (state.editor && state.editor.active && G.SIM && G.SIM.toggleEditorMode) {
        G.SIM.toggleEditorMode(state, world, false);
      }

      const lp = G.createPlayerState(msg.yourId, 160, 360, {
        isLocal: true,
        name: keepName,
        hatId: keepHat
      });
      state.players = { [msg.yourId]: lp };

      if (world && world.applyNetworkSolids && Array.isArray(msg.solids)) {
        world.applyNetworkSolids(msg.solids, state);
      }

      session.roomCode = msg.roomCode || session.roomCode;
      session.statusText = `ПОДКЛЮЧЕНО К ${session.roomCode || 'ХОСТУ'} (${state.mpMode.toUpperCase()})`;
      session.snaps = [];
      if (G.SIM && G.SIM.showToast) {
        G.SIM.showToast(state, `ПОДКЛЮЧЕНО (${state.mpMode === 'pvp' ? 'ДУЭЛЬ PvP' : 'КООПЕРАТИВ'})`, 1.8);
      }
      return;
    }

    if (msg.t === 'map_sync') {
      if (world && world.applyNetworkSolids && Array.isArray(msg.solids)) {
        world.applyNetworkSolids(msg.solids, state);
        if (G.SIM && G.SIM.showToast) G.SIM.showToast(state, 'ХОСТ ОБНОВИЛ КАРТУ', 1.3);
      }
      return;
    }

    if (msg.t === 'room_cfg') {
      state.mpMode = msg.mpMode || state.mpMode;
      state.friendlyFire = !!msg.friendlyFire;
      if (G.SIM && G.SIM.showToast) {
        G.SIM.showToast(state, `РЕЖИМ: ${state.mpMode === 'pvp' ? 'PvP ДУЭЛЬ' : 'КООП'}`, 1.4);
      }
      return;
    }

    if (msg.t === 'pong' && msg.ts) {
      session.clientRttMs = Math.max(0, Math.round(Date.now() - msg.ts));
      return;
    }

    if (msg.t === 'ping') {
      if (session.clientHostPeer && session.clientHostPeer.sendFn) {
        safeSend(session.clientHostPeer.sendFn, { t: 'pong', ts: msg.ts });
      }
      return;
    }

    if (msg.t === 'snap') {
      if (typeof msg.seq === 'number' && session.snaps.length) {
        const last = session.snaps[session.snaps.length - 1].snap;
        if (last && msg.seq <= last.seq) return;
      }
      session.snaps.push({ arrT: session.clientClock, snap: msg });
      if (session.snaps.length > 4) session.snaps.shift();
      applySnapshotDiscrete(state, world, msg);
    }
  }

  // ==================== ШАГ СЕТИ (ВЫЗЫВАЕТСЯ ИЗ RENDER LOOP) ====================

  function interpolateClientEntities(state, world, dt) {
    const snaps = session.snaps;
    let alpha = 1.0;
    if (snaps.length >= 1) {
      const latest = snaps[snaps.length - 1];
      const elapsed = session.clientClock - latest.arrT;
      alpha = G.MATH ? G.MATH.clamp(elapsed / SNAP_INTERVAL, 0, 1.25) : Math.min(1, elapsed / SNAP_INTERVAL);
    }

    const playersList = G.getPlayersList ? G.getPlayersList(state) : [];
    const localP = G.SIM && G.SIM.resolvePlayer ? G.SIM.resolvePlayer(state) : state.player;
    for (let i = 0; i < playersList.length; i++) {
      const p = playersList[i];
      if (!p) continue;
      if (p._netNextX !== undefined && p._netPrevX !== undefined) {
        const t = Math.min(1, alpha);
        p.x = p._netPrevX + (p._netNextX - p._netPrevX) * t;
        p.y = p._netPrevY + (p._netNextY - p._netPrevY) * t;
        // Для локального игрока держим плавный мгновенный прицел на клиентскую мышь, если не мёртв
        if (p === localP && !p.dead && !p.rolling && !p.bandaging && !p.drinking && (!p.inCover || p.peeking) && state.input) {
          p.aimAngle = Math.atan2(state.input.worldMouseY - p.y, state.input.worldMouseX - p.x);
        } else if (p._netNextA !== undefined && p._netPrevA !== undefined) {
          p.aimAngle = lerpAngle(p._netPrevA, p._netNextA, t);
        }
      }
    }

    if (world && world.targets) {
      const t = Math.min(1, alpha);
      for (let i = 0; i < world.targets.length; i++) {
        const en = world.targets[i];
        if (!en || en.kind !== 'bandit') continue;
        if (en._netNextX !== undefined && en._netPrevX !== undefined) {
          en.x = en._netPrevX + (en._netNextX - en._netPrevX) * t;
          en.y = en._netPrevY + (en._netNextY - en._netPrevY) * t;
          if (en._netNextA !== undefined && en._netPrevA !== undefined) {
            en.angle = lerpAngle(en._netPrevA, en._netNextA, t);
          }
        }
      }
    }

    if (world && world.doors) {
      const t = Math.min(1, alpha);
      for (let i = 0; i < world.doors.length; i++) {
        const d = world.doors[i];
        if (d._netNextA !== undefined && d._netPrevA !== undefined) {
          d.angle = d._netPrevA + (d._netNextA - d._netPrevA) * t;
        }
      }
    }

    // Экстраполяция трассеров пуль на 60 FPS между снапшотами
    if (state.bullets && dt > 0) {
      for (let i = 0; i < state.bullets.length; i++) {
        const b = state.bullets[i];
        b.px = b.x;
        b.py = b.y;
        b.x += (b.dx || 0) * (b.speed || 700) * dt;
        b.y += (b.dy || 0) * (b.speed || 700) * dt;
      }
    }
  }

  function sendClientInputIfNeeded(state, force) {
    if (session.role !== 'client' || !session.clientHostPeer || !session.clientHostPeer.sendFn) return;
    const inp = state.input || { keys: {}, worldMouseX: 150, worldMouseY: 360, lmb: false, rmb: false };
    const compactKeys = {};
    if (inp.keys) {
      Object.keys(inp.keys).forEach((k) => {
        if (inp.keys[k]) compactKeys[k] = 1;
      });
    }
    const sig = JSON.stringify([compactKeys, Math.round(inp.worldMouseX), Math.round(inp.worldMouseY), !!inp.lmb, !!inp.rmb]);
    if (!force && sig === session.lastInputSig && session.inputAccum < INPUT_INTERVAL) return;
    if (force || session.inputAccum >= INPUT_INTERVAL) {
      session.inputAccum = 0;
      session.lastInputSig = sig;
      safeSend(session.clientHostPeer.sendFn, {
        t: 'input',
        seq: ++session.inputSeq,
        keys: compactKeys,
        mx: Math.round(inp.worldMouseX),
        my: Math.round(inp.worldMouseY),
        lmb: !!inp.lmb,
        rmb: !!inp.rmb
      });
    }
  }

  function broadcastAllPeers(msg) {
    const keys = Object.keys(session.peers);
    for (let i = 0; i < keys.length; i++) {
      const pr = session.peers[keys[i]];
      if (pr && pr.sendFn) safeSend(pr.sendFn, msg);
    }
  }

  function stepHost(state, world, dt) {
    if (G.SIM && G.SIM.update) {
      G.SIM.update(state, world, dt);
    }
    session.snapAccum += dt;
    if (session.snapAccum >= SNAP_INTERVAL) {
      session.snapAccum %= SNAP_INTERVAL;
      const peerKeys = Object.keys(session.peers);
      if (peerKeys.length > 0) {
        const snap = buildSnapshot(state, world);
        broadcastAllPeers(snap);
      } else if (state.netEvents && state.netEvents.length) {
        state.netEvents.length = 0;
      }
    }
    session.pingAccum += dt;
    if (session.pingAccum >= PING_INTERVAL) {
      session.pingAccum = 0;
      broadcastAllPeers({ t: 'ping', ts: Date.now() });
    }
  }

  function stepClient(state, world, dt) {
    session.clientClock += dt;
    session.inputAccum += dt;
    sendClientInputIfNeeded(state, false);

    interpolateClientEntities(state, world, dt);
    if (G.SIM && G.SIM.stepClientVisuals) {
      G.SIM.stepClientVisuals(state, world, dt);
    }

    session.pingAccum += dt;
    if (session.pingAccum >= PING_INTERVAL && session.clientHostPeer && session.clientHostPeer.sendFn) {
      session.pingAccum = 0;
      safeSend(session.clientHostPeer.sendFn, { t: 'ping', ts: Date.now() });
    }
  }

  function step(state, world, dt) {
    session.stateRef = state;
    session.worldRef = world;
    if (!state || state.netRole === 'offline' || session.role === 'offline') {
      if (G.SIM && G.SIM.update) G.SIM.update(state, world, dt);
      return;
    }
    if (session.role === 'host') {
      stepHost(state, world, dt);
      return;
    }
    if (session.role === 'client') {
      stepClient(state, world, dt);
    }
  }

  // ==================== ПОДКЛЮЧЕНИЕ: PEERJS И РУЧНОЙ P2P (SDP BASE64) ====================

  function attachHostPeerEntry(state, world, peerKey, sendFn, closeFn, meta) {
    const entry = {
      id: peerKey,
      playerId: null,
      name: (meta && meta.name) || 'КОВБОЙ',
      hatId: (meta && meta.hatId) || 'classic',
      sendFn,
      closeFn,
      rttMs: 0
    };
    session.peers[peerKey] = entry;
    return entry;
  }

  function detachHostPeerEntry(state, peerKey) {
    const entry = session.peers[peerKey];
    if (!entry) return;
    if (entry.playerId && state && state.players && state.players[entry.playerId]) {
      const pname = state.players[entry.playerId].name || entry.name || 'ИГРОК';
      delete state.players[entry.playerId];
      if (G.SIM && G.SIM.showToast) G.SIM.showToast(state, `${pname} ВЫШЕЛ`, 1.4);
    }
    delete session.peers[peerKey];
  }

  function hostRoom(state, world, opts) {
    opts = opts || {};
    session.stateRef = state;
    session.worldRef = world;
    disconnect(state, world, true);

    const code = normalizeRoomCode(opts.roomCode) || genRoomCode();
    session.role = 'host';
    session.roomCode = code;
    state.netRole = 'host';
    state.mpMode = opts.mpMode === 'pvp' ? 'pvp' : 'coop';
    state.friendlyFire = !!opts.friendlyFire;

    const lp = G.SIM && G.SIM.resolvePlayer ? G.SIM.resolvePlayer(state) : state.player;
    if (lp) {
      lp.name = (G.CFG.playerName || lp.name || 'СТРЕЛОК').slice(0, 18);
      lp.hatId = G.CFG.selectedHat || lp.hatId || 'classic';
    }

    if (opts.manualOnly || typeof window === 'undefined' || typeof window.Peer !== 'function') {
      session.transport = 'manual';
      session.statusText = 'ХОСТ ГОТОВ (РУЧНОЙ P2P БЕЗ PEERJS)';
      return Promise.resolve({ ok: true, mode: 'manual', roomCode: code });
    }

    session.transport = 'peerjs';
    session.statusText = `ЗАПУСК КОМНАТЫ ${code}...`;

    return new Promise((resolve) => {
      let settled = false;
      try {
        const peerId = PEER_PREFIX + code.toLowerCase();
        const peer = new window.Peer(peerId, { config: STUN_CFG, debug: 0 });
        session.peerJs = peer;

        peer.on('open', () => {
          session.statusText = `ХОСТ: ${code} (ОЖИДАНИЕ ИГРОКОВ)`;
          if (!settled) {
            settled = true;
            resolve({ ok: true, mode: 'peerjs', roomCode: code });
          }
        });

        peer.on('connection', (conn) => {
          if (Object.keys(session.peers).length >= MAX_PEERS) {
            try { conn.close(); } catch (_) {}
            return;
          }
          const pKey = 'pj_' + conn.peer + '_' + Date.now();
          const entry = attachHostPeerEntry(
            state,
            world,
            pKey,
            (data) => { if (conn.open) conn.send(data); },
            () => { try { conn.close(); } catch (_) {} }
          );
          conn.on('data', (raw) => handleHostIncomingMessage(state, world, entry, safeParse(raw)));
          conn.on('close', () => detachHostPeerEntry(state, pKey));
          conn.on('error', () => detachHostPeerEntry(state, pKey));
        });

        peer.on('error', (err) => {
          const msg = (err && (err.type || err.message)) || 'ОШИБКА СЕТИ';
          session.errorText = String(msg);
          if (!settled) {
            settled = true;
            session.transport = 'manual';
            session.statusText = `PEERJS НЕДОСТУПЕН (${msg}) — ДОСТУПЕН РУЧНОЙ P2P`;
            resolve({ ok: false, mode: 'manual', error: session.errorText, roomCode: code });
          } else {
            session.statusText = `ХОСТ ${code} • ОШИБКА: ${msg}`;
          }
        });
      } catch (ex) {
        session.transport = 'manual';
        session.errorText = ex.message || 'PEERJS_INIT_ERR';
        session.statusText = 'PEERJS НЕДОСТУПЕН — ИСПОЛЬЗУЙТЕ РУЧНОЙ P2P';
        resolve({ ok: false, mode: 'manual', error: session.errorText, roomCode: code });
      }
    });
  }

  function joinRoom(state, world, rawCode) {
    session.stateRef = state;
    session.worldRef = world;
    const code = normalizeRoomCode(rawCode);
    if (!code) {
      session.errorText = 'ВВЕДИ КОД КОМНАТЫ';
      session.statusText = 'ОШИБКА: ВВЕДИ КОД КОМНАТЫ';
      return Promise.resolve({ ok: false, error: session.errorText });
    }

    disconnect(state, world, true);
    if (state.editor && state.editor.active && G.SIM && G.SIM.toggleEditorMode) {
      G.SIM.toggleEditorMode(state, world, false);
    }

    if (typeof window === 'undefined' || typeof window.Peer !== 'function') {
      session.errorText = 'PEERJS НЕ ЗАГРУЖЕН';
      session.statusText = 'PEERJS НЕ ЗАГРУЖЕН — ИСПОЛЬЗУЙ РУЧНОЙ P2P КОД';
      return Promise.resolve({ ok: false, error: session.errorText });
    }

    session.role = 'client';
    session.transport = 'peerjs';
    session.roomCode = code;
    session.statusText = `ПОДКЛЮЧЕНИЕ К ${code}...`;
    state.netRole = 'client';

    return new Promise((resolve) => {
      let settled = false;
      try {
        const peer = new window.Peer(undefined, { config: STUN_CFG, debug: 0 });
        session.peerJs = peer;

        peer.on('open', () => {
          const targetId = PEER_PREFIX + code.toLowerCase();
          const conn = peer.connect(targetId, { reliable: true });
          session.clientHostPeer = {
            sendFn: (data) => { if (conn.open) conn.send(data); },
            closeFn: () => { try { conn.close(); } catch (_) {} }
          };

          conn.on('open', () => {
            safeSend(session.clientHostPeer.sendFn, {
              t: 'hello',
              name: (G.CFG.playerName || 'СТРЕЛОК').slice(0, 18),
              hatId: G.CFG.selectedHat || 'classic'
            });
            if (!settled) {
              settled = true;
              resolve({ ok: true, roomCode: code });
            }
          });

          conn.on('data', (raw) => handleClientIncomingMessage(state, world, safeParse(raw)));
          conn.on('close', () => {
            if (session.role === 'client') {
              disconnect(state, world, true);
              session.statusText = 'СОЕДИНЕНИЕ С ХОСТОМ ПОТЕРЯНО';
              if (G.SIM && G.SIM.showToast) G.SIM.showToast(state, 'ХОСТ ЗАКРЫЛ КОМНАТУ', 1.8);
            }
          });
          conn.on('error', (err) => {
            session.errorText = String((err && err.message) || 'CONN_ERROR');
            if (!settled) {
              settled = true;
              disconnect(state, world, true);
              session.statusText = `НЕ УДАЛОСЬ ПОДКЛЮЧИТЬСЯ К ${code}`;
              resolve({ ok: false, error: session.errorText });
            }
          });
        });

        peer.on('error', (err) => {
          const msg = String((err && (err.type || err.message)) || 'PEER_ERR');
          if (!settled) {
            settled = true;
            disconnect(state, world, true);
            session.errorText = msg;
            session.statusText = `ОШИБКА ПОДКЛЮЧЕНИЯ: ${msg}`;
            resolve({ ok: false, error: msg });
          }
        });
      } catch (ex) {
        disconnect(state, world, true);
        session.errorText = ex.message || 'ERR';
        session.statusText = 'ОШИБКА PEERJS';
        resolve({ ok: false, error: session.errorText });
      }
    });
  }

  function waitForIceGathering(pc, timeoutMs) {
    if (!pc || pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(tmr);
        resolve();
      };
      const tmr = setTimeout(finish, timeoutMs || 1500);
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') finish();
      };
    });
  }

  function wireHostManualDataChannel(state, world, pc, dc) {
    const pKey = 'man_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    dc.onopen = () => {
      const entry = attachHostPeerEntry(
        state,
        world,
        pKey,
        (data) => { if (dc.readyState === 'open') dc.send(JSON.stringify(data)); },
        () => {
          try { dc.close(); } catch (_) {}
          try { pc.close(); } catch (_) {}
        }
      );
      if (session.manualPendingPc === pc) {
        session.manualPendingPc = null;
        session.manualPendingDc = null;
      }
      session.statusText = 'P2P ИГРОК ПОДКЛЮЧЁН (РУЧНОЙ WEBRTC)';
      entry._dcBound = true;
      dc.onmessage = (e) => handleHostIncomingMessage(state, world, entry, safeParse(e.data));
      dc.onclose = () => detachHostPeerEntry(state, pKey);
    };
    dc.onerror = () => detachHostPeerEntry(state, pKey);
  }

  function createManualOffer(state, world, opts) {
    opts = opts || {};
    session.stateRef = state;
    session.worldRef = world;
    if (typeof RTCPeerConnection === 'undefined') {
      return Promise.reject(new Error('WebRTC RTCPeerConnection не поддерживается'));
    }
    if (session.role === 'client') disconnect(state, world, true);
    if (session.role !== 'host') {
      session.role = 'host';
      session.transport = 'manual';
      state.netRole = 'host';
      state.mpMode = opts.mpMode === 'pvp' ? 'pvp' : 'coop';
      state.friendlyFire = !!opts.friendlyFire;
    }

    if (session.manualPendingDc) try { session.manualPendingDc.close(); } catch (_) {}
    if (session.manualPendingPc) try { session.manualPendingPc.close(); } catch (_) {}

    const pc = new RTCPeerConnection(STUN_CFG);
    const dc = pc.createDataChannel('gunfighters-p2p', { ordered: true });
    session.manualPendingPc = pc;
    session.manualPendingDc = dc;
    wireHostManualDataChannel(state, world, pc, dc);

    session.statusText = 'СБОР P2P OFFER...';
    return pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => waitForIceGathering(pc, 1500))
      .then(() => {
        const code = encodeB64Json({
          kind: 'offer',
          sdp: pc.localDescription.sdp,
          hostName: G.CFG.playerName || 'СТРЕЛОК',
          mpMode: state.mpMode || 'coop',
          friendlyFire: !!state.friendlyFire
        });
        session.manualCode = code;
        session.statusText = 'OFFER ГОТОВ — ПЕРЕДАЙ ИГРОКУ И ЖДИ ANSWER';
        return { ok: true, code };
      });
  }

  function acceptManualOffer(state, world, offerB64) {
    session.stateRef = state;
    session.worldRef = world;
    if (typeof RTCPeerConnection === 'undefined') {
      return Promise.reject(new Error('WebRTC RTCPeerConnection не поддерживается'));
    }
    const payload = decodeB64Json(offerB64);
    if (!payload || payload.kind !== 'offer' || !payload.sdp) {
      return Promise.reject(new Error('ЭТО НЕ P2P OFFER'));
    }

    disconnect(state, world, true);
    if (state.editor && state.editor.active && G.SIM && G.SIM.toggleEditorMode) {
      G.SIM.toggleEditorMode(state, world, false);
    }

    session.role = 'client';
    session.transport = 'manual';
    session.roomCode = 'MANUAL-P2P';
    state.netRole = 'client';

    const pc = new RTCPeerConnection(STUN_CFG);
    session.manualPendingPc = pc;
    pc.ondatachannel = (ev) => {
      const dc = ev.channel;
      session.manualPendingDc = dc;
      session.clientHostPeer = {
        sendFn: (data) => { if (dc.readyState === 'open') dc.send(JSON.stringify(data)); },
        closeFn: () => {
          try { dc.close(); } catch (_) {}
          try { pc.close(); } catch (_) {}
        }
      };
      dc.onopen = () => {
        safeSend(session.clientHostPeer.sendFn, {
          t: 'hello',
          name: (G.CFG.playerName || 'СТРЕЛОК').slice(0, 18),
          hatId: G.CFG.selectedHat || 'classic'
        });
      };
      dc.onmessage = (e) => handleClientIncomingMessage(state, world, safeParse(e.data));
      dc.onclose = () => {
        if (session.role === 'client') {
          disconnect(state, world, true);
          session.statusText = 'P2P КАНАЛ ЗАКРЫТ';
        }
      };
    };

    session.statusText = 'ГЕНЕРАЦИЯ P2P ANSWER...';
    return pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp })
      .then(() => pc.createAnswer())
      .then((ans) => pc.setLocalDescription(ans))
      .then(() => waitForIceGathering(pc, 1500))
      .then(() => {
        const code = encodeB64Json({
          kind: 'answer',
          sdp: pc.localDescription.sdp,
          name: G.CFG.playerName || 'СТРЕЛОК'
        });
        session.manualCode = code;
        session.statusText = 'ANSWER ГОТОВ — ВЕРНИ ЕГО ХОСТУ';
        return { ok: true, code };
      });
  }

  function applyManualAnswer(answerB64) {
    if (session.role !== 'host' || !session.manualPendingPc) {
      return Promise.reject(new Error('СНАЧАЛА СОЗДАЙ OFFER'));
    }
    const payload = decodeB64Json(answerB64);
    if (!payload || payload.kind !== 'answer' || !payload.sdp) {
      return Promise.reject(new Error('ЭТО НЕ P2P ANSWER'));
    }
    session.statusText = 'ПРИМЕНЕНИЕ ANSWER И УСТАНОВКА P2P...';
    return session.manualPendingPc.setRemoteDescription({ type: 'answer', sdp: payload.sdp })
      .then(() => ({ ok: true }));
  }

  // ==================== КОМАНДЫ, РЕДАКТОР И НАСТРОЙКИ КОМНАТЫ ====================

  function sendClientCommand(cmd, data) {
    if (session.role !== 'client' || !session.clientHostPeer || !session.clientHostPeer.sendFn) return false;
    const msg = Object.assign({ t: 'cmd', cmd }, data || {});
    const st = session.stateRef;
    if (st && st.input) {
      msg.mx = Math.round(st.input.worldMouseX);
      msg.my = Math.round(st.input.worldMouseY);
    }
    safeSend(session.clientHostPeer.sendFn, msg);
    return true;
  }

  function broadcastMapSync(state, world) {
    if (!state || state.netRole !== 'host' || session.role !== 'host' || !world || !world.exportSolidsList) return;
    broadcastAllPeers({
      t: 'map_sync',
      solids: world.exportSolidsList()
    });
  }

  function setRoomSettings(state, opts) {
    if (!state || !opts) return;
    if (state.netRole === 'client') return;
    if (opts.mpMode !== undefined) {
      state.mpMode = opts.mpMode === 'pvp' ? 'pvp' : 'coop';
    }
    if (opts.friendlyFire !== undefined) {
      state.friendlyFire = !!opts.friendlyFire;
    }
    if (session.role === 'host') {
      broadcastAllPeers({
        t: 'room_cfg',
        mpMode: state.mpMode,
        friendlyFire: !!state.friendlyFire
      });
    }
  }

  function updateLocalProfile(state, name, hatId) {
    if (name !== undefined) {
      G.CFG.playerName = String(name || 'СТРЕЛОК').slice(0, 18);
      if (G.saveSettings) G.saveSettings();
    }
    if (state && state.player) {
      if (name !== undefined) state.player.name = G.CFG.playerName;
      if (hatId !== undefined) state.player.hatId = hatId;
    }
    if (session.role === 'client') {
      sendClientCommand('profile', {
        name: name !== undefined ? G.CFG.playerName : undefined,
        hatId: hatId
      });
    }
  }

  function getStatusInfo(state) {
    const st = state || session.stateRef;
    const roster = [];
    if (st && st.players) {
      const list = Object.values(st.players);
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (!p) continue;
        const isLoc = p.id === st.localPlayerId;
        const rtt = session.role === 'client' ? (isLoc ? session.clientRttMs : (p.netRttMs || 0)) : (isLoc ? 0 : getPeerRttForPlayer(p.id));
        roster.push({
          id: p.id,
          name: p.name || 'СТРЕЛОК',
          isLocal: isLoc,
          rttMs: rtt,
          kills: p.kills || 0,
          deaths: p.deaths || 0
        });
      }
    }
    return {
      role: st ? st.netRole : session.role,
      transport: session.transport,
      roomCode: session.roomCode,
      statusText: session.statusText,
      errorText: session.errorText,
      manualCode: session.manualCode,
      mpMode: st ? st.mpMode : 'coop',
      friendlyFire: !!(st && st.friendlyFire),
      peerCount: Object.keys(session.peers).length,
      roster
    };
  }

  // Тестовый хук (без WebRTC-демона): локальная loopback-пара для unit/интеграционных проверок
  function _attachLoopbackPair(hostState, hostWorld, clientState, clientWorld, meta) {
    session.role = 'offline';
    const hostPeerKey = 'lb_1';
    const hostStateRef = hostState;
    const hostWorldRef = hostWorld;
    const clientStateRef = clientState;
    const clientWorldRef = clientWorld;

    return {
      connect() {
        hostStateRef.netRole = 'host';
        clientStateRef.netRole = 'client';
        const clientId = 'p_' + Date.now();
        const entry = {
          id: hostPeerKey,
          playerId: null,
          name: (meta && meta.name) || 'КЛИЕНТ',
          hatId: (meta && meta.hatId) || 'classic',
          sendFn: (msg) => {
            const copy = JSON.parse(JSON.stringify(msg));
            G.NET._injectClientMessage(clientStateRef, clientWorldRef, copy);
          },
          closeFn: () => {},
          rttMs: 12
        };
        spawnRemotePlayer(hostStateRef, hostWorldRef, entry, entry.name, entry.hatId);
        return { entry, clientId };
      }
    };
  }

  G.NET = {
    encodeB64Json,
    decodeB64Json,
    normalizeRoomCode,
    hostRoom,
    joinRoom,
    createManualOffer,
    acceptManualOffer,
    applyManualAnswer,
    disconnect,
    step,
    sendClientCommand,
    sendClientInputIfNeeded,
    broadcastMapSync,
    setRoomSettings,
    updateLocalProfile,
    getStatusInfo,
    buildSnapshot,
    applySnapshotDiscrete,

    // Вспомогательные точки входа для тестов и обратной связи
    _attachHostPeer(state, world, peerKey, sendFn, closeFn, meta) {
      session.role = 'host';
      session.stateRef = state;
      session.worldRef = world;
      state.netRole = 'host';
      return attachHostPeerEntry(state, world, peerKey, sendFn, closeFn, meta);
    },
    _deliverHostMessage(state, world, entry, msg) {
      session.role = 'host';
      session.stateRef = state;
      session.worldRef = world;
      handleHostIncomingMessage(state, world, entry, msg);
    },
    _detachHostPeer: detachHostPeerEntry,
    _attachClientPeer(state, world, sendFn, closeFn) {
      session.role = 'client';
      session.stateRef = state;
      session.worldRef = world;
      state.netRole = 'client';
      session.clientHostPeer = { sendFn, closeFn };
    },
    _injectClientMessage(state, world, msg) {
      session.role = 'client';
      session.stateRef = state;
      session.worldRef = world;
      state.netRole = 'client';
      handleClientIncomingMessage(state, world, msg);
    },
    _stepClientOnly(state, world, dt) {
      session.role = 'client';
      session.stateRef = state;
      session.worldRef = world;
      state.netRole = 'client';
      stepClient(state, world, dt);
    },
    _stepHostOnly(state, world, dt) {
      session.role = 'host';
      session.stateRef = state;
      session.worldRef = world;
      state.netRole = 'host';
      stepHost(state, world, dt);
    },
    _attachLoopbackPair
  };
})();
