(() => {
  'use strict';

  const hero = document.querySelector('.particle-hero');
  if (!hero) return;
  const canvas = hero.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return; // The real heading remains visible without canvas support.
  const title = hero.querySelector('h1');
  const soundButton = hero.querySelector('.particle-hero__sound');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = window.matchMedia('(pointer: coarse)');
  const pointer = { x: 0, y: 0, active: false };
  const palette = ['#829e9d', '#a9bebd', '#607f81', '#ced9d7'];
  let particles = [];
  let dust = [];
  let width = 0;
  let height = 0;
  let titleBounds;
  let frame = 0;
  let lastTime = 0;
  let elapsed = 0;
  let visible = true;
  let audio;
  let master;
  let reverb;
  let soundEnabled = false;
  let lastNote = -Infinity;
  let noteIndex = 0;
  // A sparse, original pentatonic phrase, with no looping backing track.
  const melody = [74, 78, 81, 85, 83, 78, 76, 81, 78, 74, 73, 76];

  function resize() {
    const box = hero.getBoundingClientRect();
    width = hero.clientWidth;
    height = hero.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const mask = document.createElement('canvas');
    mask.width = width;
    mask.height = height;
    const ink = mask.getContext('2d', { willReadFrequently: true });
    ink.textAlign = 'center';
    titleBounds = { left: width, right: 0, top: height, bottom: 0 };
    // Follow the actual line layout, including the two-line mobile heading.
    title.querySelectorAll('.particle-hero__title-line').forEach(line => {
      const lineBox = line.getBoundingClientRect();
      const style = getComputedStyle(line);
      ink.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      if ('letterSpacing' in ink) ink.letterSpacing = style.letterSpacing;
      const metrics = ink.measureText(line.textContent.trim());
      const fontMetrics = ink.measureText('Mg');
      const ascent = fontMetrics.fontBoundingBoxAscent ?? fontMetrics.actualBoundingBoxAscent;
      const descent = fontMetrics.fontBoundingBoxDescent ?? fontMetrics.actualBoundingBoxDescent;
      const centerX = lineBox.left - box.left - hero.clientLeft + lineBox.width / 2;
      const centerY = lineBox.top - box.top - hero.clientTop + lineBox.height / 2;
      const baseline = centerY + (ascent - descent) / 2;
      ink.fillText(line.textContent.trim(), centerX, baseline);
      titleBounds.left = Math.min(titleBounds.left, centerX - metrics.width / 2);
      titleBounds.right = Math.max(titleBounds.right, centerX + metrics.width / 2);
      titleBounds.top = Math.min(titleBounds.top, baseline - metrics.actualBoundingBoxAscent);
      titleBounds.bottom = Math.max(titleBounds.bottom, baseline + metrics.actualBoundingBoxDescent);
    });
    const pixels = ink.getImageData(0, 0, width, height).data;
    const step = width < 450 ? 1.8 : 2.1;
    particles = [];
    for (let y = Math.max(0, Math.floor(titleBounds.top)); y < Math.min(height, titleBounds.bottom + 1); y += step) {
      for (let x = Math.max(0, Math.floor(titleBounds.left)); x < Math.min(width, titleBounds.right + 1); x += step) {
        if (pixels[(Math.floor(y) * width + Math.floor(x)) * 4 + 3] < 100) continue;
        const spread = reducedMotion.matches ? 0 : 18;
        particles.push({
          homeX: x, homeY: y,
          x: x + (Math.random() - 0.5) * spread,
          y: y + (Math.random() - 0.5) * spread,
          vx: 0, vy: 0,
          radius: 0.6 + Math.random() * 0.48,
          phase: Math.random() * Math.PI * 2,
          color: palette[Math.floor(Math.random() * palette.length)]
        });
      }
    }
    dust = Array.from({ length: Math.min(65, Math.floor(width / 12)) }, () => ({
      x: Math.random() * width, y: Math.random() * height,
      radius: 0.5 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 0.6
    }));
    if (particles.length) hero.classList.add('is-ready');
    draw(0);
    updateActivity();
  }

  function draw(delta) {
    ctx.clearRect(0, 0, width, height);
    const time = reducedMotion.matches ? 0 : elapsed;
    dust.forEach(star => {
      const x = star.x + Math.sin(time * 0.16 * star.speed + star.phase) * 11;
      const y = star.y + Math.cos(time * 0.12 * star.speed + star.phase) * 9;
      ctx.globalAlpha = 0.18 + (1 + Math.sin(time * 0.5 + star.phase)) * 0.10;
      ctx.fillStyle = '#a9bebd';
      ctx.beginPath();
      ctx.arc(x, y, star.radius, 0, Math.PI * 2);
      ctx.fill();
      if (star.radius > 1.4) {
        ctx.strokeStyle = '#a9bebd';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y);
        ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 3);
        ctx.stroke();
      }
    });

    const step = delta * 60;
    const radius = coarsePointer.matches ? 48 : 65;
    particles.forEach(p => {
      if (step && !reducedMotion.matches) {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (pointer.active && distance < radius) {
          const force = (1 - distance / radius) * 1.1;
          p.vx += (distance > 0.1 ? dx / distance : Math.cos(p.phase)) * force * step;
          p.vy += (distance > 0.1 ? dy / distance : Math.sin(p.phase)) * force * step;
        }
        const drift = Math.sin(time * 0.65 + p.phase) * 0.35;
        p.vx += (p.homeX + drift - p.x) * 0.016 * step;
        p.vy += (p.homeY + drift - p.y) * 0.016 * step;
        p.vx *= Math.pow(0.86, step);
        p.vy *= Math.pow(0.86, step);
        p.x += p.vx * step;
        p.y += p.vy * step;
      }
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.72 + Math.sin(time * 0.6 + p.phase) * 0.12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function animate(now) {
    frame = 0;
    const delta = lastTime ? Math.min((now - lastTime) / 1000, 1 / 30) : 1 / 60;
    lastTime = now;
    elapsed += delta;
    draw(delta);
    frame = requestAnimationFrame(animate);
  }

  function updateActivity() {
    const active = visible && !document.hidden;
    const moving = active && !reducedMotion.matches;
    hero.classList.toggle('is-animated', moving);
    if (moving && !frame) {
      lastTime = 0;
      frame = requestAnimationFrame(animate);
    } else if (!moving) {
      cancelAnimationFrame(frame);
      frame = 0;
      pointer.active = false;
    }
    if (!active && audio?.state === 'running') audio.suspend().catch(() => {});
  }

  function createAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audio = new AudioContext();
    master = audio.createGain();
    master.gain.value = 0;
    master.connect(audio.destination);
    reverb = audio.createConvolver();
    const impulse = audio.createBuffer(2, audio.sampleRate * 2, audio.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
      }
    }
    reverb.buffer = impulse;
    const wet = audio.createGain();
    wet.gain.value = 0.22;
    reverb.connect(wet);
    wet.connect(master);
  }

  function playNote() {
    if (!soundEnabled || !visible || document.hidden || !audio) return;
    if (audio.state !== 'running') {
      audio.resume().catch(() => {});
      return;
    }
    const now = audio.currentTime;
    if (now - lastNote < 0.48) return;
    lastNote = now;
    const frequency = 440 * Math.pow(2, (melody[noteIndex++ % melody.length] - 69) / 12);
    // Soft attack, a quiet bell overtone, and a long natural release.
    [1, 2.001, 3].forEach((ratio, i) => {
      const oscillator = audio.createOscillator();
      const envelope = audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency * ratio;
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime([0.11, 0.018, 0.004][i], now + 0.035);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + 2.5 - i * 0.4);
      oscillator.connect(envelope);
      envelope.connect(master);
      envelope.connect(reverb);
      oscillator.start(now);
      oscillator.stop(now + 2.6);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    });
  }

  function updatePointer(event) {
    if (event.target.closest('button')) { pointer.active = false; return; }
    const box = hero.getBoundingClientRect();
    pointer.x = event.clientX - box.left - hero.clientLeft;
    pointer.y = event.clientY - box.top - hero.clientTop;
    pointer.active = !reducedMotion.matches;
    // A brief tap can end between frames; give it a small lasting impulse.
    if (event.pointerType === 'touch' && event.type === 'pointerdown' && pointer.active) {
      particles.forEach(p => {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 48) {
          const force = (1 - distance / 48) * 3;
          p.vx += Math.cos(Math.atan2(dy, dx)) * force;
          p.vy += Math.sin(Math.atan2(dy, dx)) * force;
        }
      });
    }
    if (pointer.x >= titleBounds.left - 8 && pointer.x <= titleBounds.right + 8 &&
        pointer.y >= titleBounds.top - 12 && pointer.y <= titleBounds.bottom + 12) playNote();
  }

  hero.addEventListener('pointermove', updatePointer, { passive: true });
  hero.addEventListener('pointerdown', updatePointer, { passive: true });
  ['pointerleave', 'pointercancel', 'pointerup'].forEach(event => {
    hero.addEventListener(event, () => { pointer.active = false; });
  });
  window.addEventListener('blur', () => { pointer.active = false; });

  if (window.AudioContext || window.webkitAudioContext) {
    soundButton.hidden = false;
    soundButton.addEventListener('click', async () => {
      soundButton.disabled = true;
      try {
        if (!audio) createAudio();
        await audio.resume();
        soundEnabled = !soundEnabled;
        master.gain.setTargetAtTime(soundEnabled ? 0.22 : 0, audio.currentTime, 0.12);
        soundButton.setAttribute('aria-pressed', String(soundEnabled));
        soundButton.setAttribute('aria-label', soundEnabled ? 'Mute gentle music-box sounds' : 'Enable gentle music-box sounds');
        soundButton.querySelector('span').textContent = soundEnabled ? 'Sound on' : 'Sound off';
        if (soundEnabled) playNote();
      } catch (error) {
        soundEnabled = false;
        if (master) master.gain.value = 0;
        soundButton.setAttribute('aria-pressed', 'false');
        soundButton.setAttribute('aria-label', 'Sound unavailable');
        soundButton.querySelector('span').textContent = 'Sound unavailable';
      } finally {
        soundButton.disabled = false;
      }
    });
  }

  reducedMotion.addEventListener('change', resize);
  document.addEventListener('visibilitychange', updateActivity);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      updateActivity();
    }).observe(hero);
  }
  resize();
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(hero);
  else window.addEventListener('resize', resize);
  document.fonts?.ready.then(resize);
})();
