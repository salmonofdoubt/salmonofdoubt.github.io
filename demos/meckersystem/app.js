(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n));
  const lerp = (a, b, t) => a + (b - a) * t;

  const ui = {
    severity: $('severity'), sensitivity: $('sensitivity'), responseThreshold: $('responseThreshold'),
    calmStrength: $('calmStrength'), delay: $('delay'), severityOut: $('severityOut'),
    sensitivityOut: $('sensitivityOut'), responseThresholdOut: $('responseThresholdOut'),
    calmStrengthOut: $('calmStrengthOut'), delayOut: $('delayOut'), eventButton: $('eventButton'),
    heroEvent: $('heroEvent'), pauseButton: $('pauseButton'), resetButton: $('resetButton'), chaosButton: $('chaosButton'),
    runDot: $('runDot'), stateLabel: $('stateLabel'), stateNote: $('stateNote'), meckerMeter: $('meckerMeter'),
    calmMeter: $('calmMeter'), meckerValue: $('meckerValue'), calmValue: $('calmValue'), meckerSpeech: $('meckerSpeech'),
    calmSpeech: $('calmSpeech'), meckerCard: $('meckerCard'), calmCard: $('calmCard'), meckerTrack: $('meckerTrack'),
    calmTrack: $('calmTrack'), feedbackValue: $('feedbackValue'), eventFlash: $('eventFlash'), metricMecker: $('metricMecker'),
    metricCalm: $('metricCalm'), metricAnnoyance: $('metricAnnoyance'), metricFeedback: $('metricFeedback'), chart: $('chart')
  };

  const state = {
    running: true,
    mecker: 0,
    calmLoad: 0,
    stimulus: 0,
    frustration: 0,
    calmReceived: 0,
    meckerEmission: 0,
    calmEmission: 0,
    lastEmissionPacket: 0,
    lastCalmPacket: 0,
    history: [],
    delayedMecker: [],
    delayedCalm: [],
    lastTime: performance.now(),
    sampleClock: 0,
    recentSlope: 0,
    oscillationScore: 0,
    lastDeltaSign: 0,
    signChanges: 0
  };

  function params() {
    return {
      severity: Number(ui.severity.value),
      sensitivity: Number(ui.sensitivity.value) / 100,
      responseThreshold: Number(ui.responseThreshold.value),
      calmStrength: Number(ui.calmStrength.value) / 100,
      delayMs: Number(ui.delay.value) * 100
    };
  }

  function updateOutputs() {
    ui.severityOut.value = ui.severity.value;
    ui.sensitivityOut.value = ui.sensitivity.value;
    ui.responseThresholdOut.value = ui.responseThreshold.value;
    ui.calmStrengthOut.value = ui.calmStrength.value;
    ui.delayOut.value = `${(Number(ui.delay.value) / 10).toFixed(1)} s`;
  }

  function enqueue(queue, value, delayMs, now) {
    if (value <= 0.01) return;
    queue.push({ value, at: now + delayMs });
  }

  function dequeue(queue, now) {
    let total = 0;
    while (queue.length && queue[0].at <= now) total += queue.shift().value;
    return total;
  }

  function emitPacket(kind, strength) {
    if (strength < 3) return;
    const now = performance.now();
    const p = params();
    const key = kind === 'mecker' ? 'lastEmissionPacket' : 'lastCalmPacket';
    const minGap = Math.max(170, 680 - strength * 4);
    if (now - state[key] < minGap) return;
    state[key] = now;

    const packet = document.createElement('i');
    packet.className = `energy-packet ${kind}`;
    packet.style.setProperty('--travel', `${Math.max(.45, p.delayMs / 1000 + .35)}s`);
    const track = kind === 'mecker' ? ui.meckerTrack : ui.calmTrack;
    track.appendChild(packet);
    packet.addEventListener('animationend', () => packet.remove(), { once: true });
  }

  function triggerEvent() {
    const p = params();
    state.stimulus = clamp(state.stimulus + p.severity * .92, 0, 120);
    state.frustration = clamp(state.frustration + p.severity * .08, 0, 80);
    ui.eventFlash.textContent = `MeckereiWürdiges Ereignis · Stärke ${p.severity}`;
    ui.eventFlash.classList.remove('bang');
    void ui.eventFlash.offsetWidth;
    ui.eventFlash.classList.add('bang');
  }

  function reset() {
    Object.assign(state, {
      mecker: 0,
      calmLoad: 0,
      stimulus: 0,
      frustration: 0,
      calmReceived: 0,
      meckerEmission: 0,
      calmEmission: 0,
      delayedMecker: [],
      delayedCalm: [],
      history: [],
      sampleClock: 0,
      recentSlope: 0,
      oscillationScore: 0,
      lastDeltaSign: 0,
      signChanges: 0
    });
    ui.meckerTrack.replaceChildren();
    ui.calmTrack.replaceChildren();
    ui.eventFlash.textContent = 'System zurückgesetzt.';
    render();
    drawChart();
  }

  function randomise() {
    const set = (el, min, max) => { el.value = String(Math.round(min + Math.random() * (max - min))); };
    set(ui.severity, 35, 100);
    set(ui.sensitivity, 25, 95);
    set(ui.responseThreshold, 10, 75);
    set(ui.calmStrength, 15, 95);
    set(ui.delay, 0, 40);
    updateOutputs();
    reset();
    triggerEvent();
  }

  function simulate(dt, now) {
    const p = params();
    const previousMecker = state.mecker;

    const delayedMecker = dequeue(state.delayedMecker, now);
    const delayedCalm = dequeue(state.delayedCalm, now);

    state.calmReceived = lerp(state.calmReceived, delayedCalm, Math.min(1, dt * 4.2));

    const stimulusDrive = state.stimulus * p.sensitivity * .23;
    const noReassurance = Math.max(0, state.meckerEmission - state.calmReceived);
    const frustrationDrive = noReassurance * .035 + state.frustration * .025;
    const calming = state.calmReceived * (.14 + p.calmStrength * .28);
    const naturalDecay = .72 + state.mecker * .018;

    state.mecker = clamp(state.mecker + (stimulusDrive + frustrationDrive - calming - naturalDecay) * dt);
    state.stimulus = Math.max(0, state.stimulus - (3.4 + state.stimulus * .055) * dt);
    state.frustration = clamp(state.frustration + (noReassurance * .015 - state.calmReceived * .022 - .35) * dt, 0, 100);

    const speakThreshold = 16;
    state.meckerEmission = clamp((state.mecker - speakThreshold) * 1.35, 0, 100);
    if (state.meckerEmission > 0.1) enqueue(state.delayedMecker, state.meckerEmission * dt * 5.5, p.delayMs, now);

    const loadTarget = clamp(delayedMecker * 2.1, 0, 100);
    const loadResponse = loadTarget > state.calmLoad ? 2.8 : 1.15;
    state.calmLoad = clamp(state.calmLoad + (loadTarget - state.calmLoad) * Math.min(1, dt * loadResponse) - .22 * dt);

    const aboveThreshold = Math.max(0, state.calmLoad - p.responseThreshold);
    const saturation = 1 - Math.max(0, state.calmLoad - 82) / 120;
    state.calmEmission = clamp(aboveThreshold * 1.45 * p.calmStrength * saturation, 0, 100);
    if (state.calmEmission > 0.1) enqueue(state.delayedCalm, state.calmEmission * dt * 6.4, p.delayMs, now);

    emitPacket('mecker', state.meckerEmission);
    emitPacket('calm', state.calmEmission);

    const delta = state.mecker - previousMecker;
    const sign = Math.abs(delta) < .01 ? 0 : Math.sign(delta);
    if (sign && state.lastDeltaSign && sign !== state.lastDeltaSign) state.signChanges = Math.min(20, state.signChanges + 1);
    else state.signChanges = Math.max(0, state.signChanges - dt * .28);
    if (sign) state.lastDeltaSign = sign;
    state.recentSlope = lerp(state.recentSlope, delta / Math.max(dt, .001), Math.min(1, dt * 1.6));
    state.oscillationScore = lerp(state.oscillationScore, state.signChanges * Math.min(1, (state.mecker + state.calmLoad) / 65), Math.min(1, dt));

    state.sampleClock += dt;
    if (state.sampleClock >= .18) {
      state.sampleClock = 0;
      state.history.push({ m: state.mecker, n: state.calmLoad, a: getAnnoyance() });
      if (state.history.length > 220) state.history.shift();
    }
  }

  function getAnnoyance() {
    const mismatch = Math.abs(state.meckerEmission - state.calmEmission) * .22;
    return clamp(state.mecker * .52 + state.calmLoad * .27 + state.frustration * .24 + mismatch);
  }

  function classify() {
    const annoyance = getAnnoyance();
    if (state.mecker < 7 && state.calmLoad < 9 && state.stimulus < 5) {
      return ['Ruhe', 'Beide Systeme sind unter ihren Reaktionsschwellen.'];
    }
    if (state.oscillationScore > 4.3 && state.mecker > 15) {
      return ['Oszillation', 'Verzögerte Gegenkopplung lässt das System hin und her schwingen.'];
    }
    if (state.mecker > 76 && state.recentSlope > 1.3) {
      return ['Eskalation', 'Meckerpegel und Frustration wachsen schneller als die Beruhigung wirkt.'];
    }
    if (state.calmEmission > state.meckerEmission * 1.18 && state.mecker > 12) {
      return ['Beruhigung', 'Die Gegenkopplung ist momentan stärker als die ausgestrahlte MeckerEnergie.'];
    }
    if (annoyance > 55) {
      return ['Dauergemecker', 'Das System bleibt aktiv, ohne sich bisher auf einen ruhigen Zustand einzupendeln.'];
    }
    return ['Regelkreis aktiv', 'Beide Systeme reagieren aufeinander; der weitere Verlauf ist noch offen.'];
  }

  function meckerText() {
    if (state.mecker < 16) return '…';
    if (state.mecker < 34) return '„Muss das sein?“';
    if (state.mecker < 58) return '„Also wirklich jetzt.“';
    if (state.mecker < 78) return '„Das kann doch wohl nicht wahr sein!“';
    return '„ICH SAG JA NUR!“';
  }

  function calmText() {
    if (state.calmLoad < params().responseThreshold) return '„Nicht so schlimm.“';
    if (state.calmEmission < 16) return '„Hm. Na ja.“';
    if (state.calmEmission < 42) return '„Na wird schon.“';
    if (state.calmEmission < 70) return '„Wirklich. Wird schon.“';
    return '„NA. WIRD. SCHON.“';
  }

  function render() {
    const [label, note] = classify();
    const annoyance = getAnnoyance();
    const netFeedback = (state.calmEmission - state.meckerEmission) / 100;

    ui.stateLabel.textContent = label;
    ui.stateNote.textContent = note;
    ui.meckerValue.textContent = Math.round(state.mecker);
    ui.calmValue.textContent = Math.round(state.calmLoad);
    ui.meckerMeter.style.width = `${state.mecker}%`;
    ui.calmMeter.style.width = `${state.calmLoad}%`;
    ui.meckerSpeech.textContent = meckerText();
    ui.calmSpeech.textContent = calmText();
    ui.meckerCard.classList.toggle('active', state.meckerEmission > 5);
    ui.calmCard.classList.toggle('active', state.calmEmission > 5);
    ui.feedbackValue.textContent = netFeedback.toFixed(2);
    ui.metricMecker.textContent = Math.round(state.mecker);
    ui.metricCalm.textContent = Math.round(state.calmLoad);
    ui.metricAnnoyance.textContent = Math.round(annoyance);
    ui.metricFeedback.textContent = `${netFeedback >= 0 ? '+' : ''}${netFeedback.toFixed(2)}`;
  }

  function drawChart() {
    const canvas = ui.chart;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const styles = getComputedStyle(document.documentElement);
    const muted = styles.getPropertyValue('--muted-2').trim();
    const mecker = styles.getPropertyValue('--mecker').trim();
    const calm = styles.getPropertyValue('--calm').trim();
    const signal = styles.getPropertyValue('--signal').trim();
    const pad = { l: 31, r: 10, t: 10, b: 22 };
    const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.fillStyle = muted;
    ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'right';
    [0,25,50,75,100].forEach(v => {
      const y = pad.t + ph - (v / 100) * ph;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.fillText(String(v), pad.l - 7, y + 3);
    });

    const data = state.history;
    if (data.length < 2) return;
    const line = (key, color) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      data.forEach((d, i) => {
        const x = pad.l + (i / Math.max(1, data.length - 1)) * pw;
        const y = pad.t + ph - (d[key] / 100) * ph;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };
    line('m', mecker); line('n', calm); line('a', signal);
  }

  function frame(now) {
    const elapsed = Math.min(.05, (now - state.lastTime) / 1000);
    state.lastTime = now;
    if (state.running) simulate(elapsed, now);
    render();
    drawChart();
    requestAnimationFrame(frame);
  }

  [ui.severity, ui.sensitivity, ui.responseThreshold, ui.calmStrength, ui.delay].forEach(el => {
    el.addEventListener('input', updateOutputs);
  });
  ui.eventButton.addEventListener('click', triggerEvent);
  ui.heroEvent.addEventListener('click', () => { triggerEvent(); $('lab').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  ui.resetButton.addEventListener('click', reset);
  ui.chaosButton.addEventListener('click', randomise);
  ui.pauseButton.addEventListener('click', () => {
    state.running = !state.running;
    ui.pauseButton.textContent = state.running ? 'Pause' : 'Weiter';
    ui.runDot.classList.toggle('paused', !state.running);
  });
  window.addEventListener('resize', drawChart);

  updateOutputs();
  reset();
  requestAnimationFrame((now) => { state.lastTime = now; requestAnimationFrame(frame); });
})();
