/* ═══════════════════════════════════════════
   VisionAlly – script.js
   UI + Real-time COCO-SSD Object Detection
═══════════════════════════════════════════ */

/* ════════════════════════════════════════
   VOICE COMMANDER — Always-On Singleton
   Keeps microphone alive for the entire
   session. Starts after the first user
   gesture and never stops again.
════════════════════════════════════════ */
const VoiceCommander = (() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  let _rec = null;          // SpeechRecognition instance
  let _running = false;     // is mic currently active?
  let _started = false;     // has first-start happened?
  let _lastCmd = '';        // debounce: last command text
  let _lastCmdTime = 0;     // debounce: timestamp

  /** Create and wire up the recognition object (idempotent). */
  function _init() {
    if (!SpeechRecognition) {
      console.warn('VoiceCommander: SpeechRecognition not supported.');
      return false;
    }

    _rec = new SpeechRecognition();
    _rec.lang = 'en-US';
    _rec.continuous = true;       // never stop on its own
    _rec.interimResults = false;  // only final transcripts

    _rec.onstart = () => {
      _running = true;
      console.log('🎤 VoiceCommander: mic active');
    };

    _rec.onresult = (event) => {
      // Grab only fresh results from this event batch
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (!event.results[i].isFinal) continue;
        const text = event.results[i][0].transcript.toLowerCase().trim();
        _handleCommand(text);
      }
    };

    _rec.onerror = (e) => {
      // 'no-speech' is normal — suppress it silently
      if (e.error !== 'no-speech') {
        console.warn('VoiceCommander error:', e.error);
      }
      _running = false;
      _scheduleRestart();
    };

    _rec.onend = () => {
      _running = false;
      // Always restart silently unless deliberately stopped
      _scheduleRestart();
    };

    return true;
  }

  /** Debounced command dispatcher. */
  function _handleCommand(text) {
    if (!text) return;

    const now = Date.now();
    // Ignore exact duplicate command within 2 s
    if (text === _lastCmd && now - _lastCmdTime < 2000) return;
    _lastCmd = text;
    _lastCmdTime = now;

    console.log('🗣️ VoiceCommander heard:', text);

    // ── STOP — checked first so it never falls into "start" ──
    // Only fires when "stop" is the first word or the entire utterance,
    // preventing accidental triggers from ambient speech.
    const isStop = /^stop(\s|$)/.test(text);

    if (isStop) {
      if (typeof speak === 'function') speak('Stopping detection');
      setTimeout(() => {
        closeDetectionModal();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Tear down and re-create _rec so the mic restarts cleanly
        _running = false;
        if (_rec) { try { _rec.abort(); } catch (_) { } _rec = null; }
        _scheduleRestart(1200);
      }, 800);


    } else if (
      text.includes('custom model') ||
      text.includes('custom detection')
    ) {
      startCustomDetection();

    } else if (
      text.includes('start navigation') ||
      text.includes('navigation mode') ||
      text.includes('navigate')
    ) {
      startNavigationMode();
    } else if (text.includes('save contact') || text.includes('add contact')) {
      // Mocking input for demo purposes
      const name = prompt("Enter contact name:");
      const phone = prompt("Enter contact phone:");
      if (name && phone) saveEmergencyContact(name, phone);
    } else if (text.includes('emergency') || text.includes('help me') || text.includes('send alert') || text.includes('help')) {
      triggerEmergencyFrontend();
    }
  }

  /** Re-launch mic after a short pause (silent). */
  function _scheduleRestart(delay = 800) {
    if (_started) {
      setTimeout(_start, delay);
    }
  }

  /** Start recognition — safe to call multiple times. */
  function _start() {
    if (_running) return;
    if (!_rec && !_init()) return;
    // Wait for any active TTS to finish before opening the mic
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      setTimeout(_start, 500);
      return;
    }
    try {
      _rec.start();
    } catch (_e) {
      // Already started or other benign error — ignore
    }
  }

  // ── Public API ──────────────────────────────────────
  return {
    /**
     * Boot the voice commander. Safe to call multiple times;
     * only the first call actually starts the mic.
     */
    boot() {
      if (_started) return;
      _started = true;
      _init();
      _start();
    },
  };
})();

/** Activate VoiceCommander on the very first user interaction.
 *  If the audio-start-overlay is present, audio.js will call
 *  VoiceCommander.boot() after the welcome speech ends.
 *  This block only fires as a fallback when there is no overlay
 *  (e.g. returning visitors who already dismissed it).
 */
(function attachVoiceBootstrap() {
  const GESTURE_EVENTS = ['click', 'keydown', 'touchstart'];

  function onFirstGesture() {
    // If the overlay still exists, audio.js owns the boot — do nothing here.
    if (document.getElementById('audio-start-overlay')) return;
    VoiceCommander.boot();
    GESTURE_EVENTS.forEach(ev => document.removeEventListener(ev, onFirstGesture, true));
  }

  GESTURE_EVENTS.forEach(ev => document.addEventListener(ev, onFirstGesture, true));
})();
'use strict';

/* ── DOM Ready ── */
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initHamburger();
  initScrollSpy();
  initScrollAnimations();
  initButtonHandlers();
  initSettingsButton();
  initDetectionModal();
  // Audio system – must come last so DOM is fully ready
  if (typeof audioInit === 'function') audioInit();
});

/* ════════════════════════════════════════
   1. NAVBAR — scroll shadow & shrink
════════════════════════════════════════ */
function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  const onScroll = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ════════════════════════════════════════
   2. HAMBURGER — mobile nav toggle
════════════════════════════════════════ */
function initHamburger() {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('nav-links');
  if (!hamburger || !navLinks) return;

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinks.classList.toggle('open');
  });

  navLinks.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      navLinks.classList.remove('open');
    });
  });

  document.addEventListener('click', (e) => {
    if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
      hamburger.classList.remove('open');
      navLinks.classList.remove('open');
    }
  });
}

/* ════════════════════════════════════════
   3. SCROLL SPY — active nav link
════════════════════════════════════════ */
function initScrollSpy() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { threshold: 0.4 });

  sections.forEach(section => observer.observe(section));
}

/* ════════════════════════════════════════
   4. SCROLL ANIMATIONS — fade-in on scroll
════════════════════════════════════════ */
function initScrollAnimations() {
  const animatedEls = document.querySelectorAll('[data-animate]');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.features-grid, .steps-grid, .demo-grid').forEach(grid => {
    grid.querySelectorAll('[data-animate]').forEach((el, i) => {
      if (!el.style.getPropertyValue('--delay')) {
        el.style.setProperty('--delay', `${i * 100}ms`);
      }
    });
  });

  animatedEls.forEach(el => observer.observe(el));
}

/* ════════════════════════════════════════
   5. BUTTON HANDLERS — CTA clicks
════════════════════════════════════════ */
function showLoader() {
  const loader = document.getElementById("loading-overlay");
  if (loader) {
    loader.style.display = "flex";
    loader.style.opacity = "1";
    loader.style.pointerEvents = "all";
  }
}

function hideLoader() {
  const loader = document.getElementById("loading-overlay");
  if (loader) {
    loader.style.display = "none";
    loader.style.opacity = "0";
    loader.style.pointerEvents = "none";
  }
}

function startCamera() {
  if (cameraStarted) return Promise.resolve();
  cameraStarted = true;

  return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } })
    .then(stream => {
      videoStream = stream;
      const video = document.getElementById('det-video');
      if (video) {
        video.srcObject = stream;
        video.play();
      }
    })
    .catch(err => console.error(err));
}

let detectionMode = 'coco'; // 'coco' | 'custom' | 'navigation'



async function startCustomDetection() {
  console.log("Starting custom detection");
  detectionMode = 'custom';
  isDetecting = true;

  if (typeof speak === 'function') speak('Custom detection started');
  openDetectionModal();
  showLoader();

  await startCamera();

  const video = document.getElementById('det-video');
  if (!video) return;

  await new Promise((resolve) => {
    if (video.readyState >= 2) {
      console.log("Camera ready");
      resolve();
    } else {
      video.onloadeddata = () => {
        console.log("Camera ready");
        resolve();
      };
    }
  });

  await loadTMModel();
  console.log("Model loaded");

  // Ensure other loops are stopped
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

  // Visibility fixes
  video.style.opacity = "1";
  video.style.zIndex = "1";

  hideLoader(); // VERY IMPORTANT
  predictTM();
}

/* ════════════════════════════════════════
   NAVIGATION MODE — Obstacle Avoidance
════════════════════════════════════════ */

// Classes considered obstacles in navigation mode
const NAV_OBSTACLE_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'bus', 'truck',
  'chair', 'couch', 'dining table', 'dog', 'cat',
  'backpack', 'suitcase', 'bottle', 'bench'
];

let navRafId = null;          // rAF id for navigation loop
let lastNavWarnTime = 0;      // TTS cooldown tracker
let lastNavDirection = '';    // last spoken direction

// ── Navigation Verbosity Control ──
const NAV_COOLDOWN_FAR = 5000;        // 5s for far objects
const NAV_COOLDOWN_CLOSE = 3000;      // 3s for close objects
const NAV_COOLDOWN_URGENT = 1500;     // 1.5s for very close
const NAV_COOLDOWN_CLEAR = 10000;     // 10s periodic reassurance when clear
const NAV_AREA_URGENT = 0.15;         // >15% of frame = urgent
const NAV_POSITION_THRESHOLD = 0.12;  // 12% lateral move = significant
let lastNavCenterX = 0;               // last announced obstacle center-x (normalized)
let lastNavUrgency = 0;               // 0=clear, 1=far, 2=close, 3=urgent

async function startNavigationMode() {
  console.log('Starting navigation mode');
  detectionMode = 'navigation';
  isDetecting = true;

  if (typeof speak === 'function') speak('Navigation mode started. I will warn you of nearby obstacles.');
  openDetectionModal();
  showLoader();

  await startCamera();

  const video = document.getElementById('det-video');
  if (!video) return;

  await new Promise((resolve) => {
    if (video.readyState >= 2) resolve();
    else video.onloadeddata = () => resolve();
  });

  // Load COCO-SSD (shared with normal detection)
  if (!cocossdModel) {
    const countEl = document.getElementById('det-count');
    if (countEl) countEl.textContent = 'Loading AI model…';
    cocossdModel = await cocoSsd.load({ base: 'mobilenet_v2' });
  }

  // Show the navigation warning banner
  const banner = document.getElementById('nav-warning-banner');
  if (banner) banner.removeAttribute('hidden');

  // Stop any other running loops
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (tmRafId) { cancelAnimationFrame(tmRafId); tmRafId = null; }

  hideLoader();
  navigationLoop(video);
}

/**
 * Generate concise navigation message based on urgency
 * @param {string} objClass - Object class name
 * @param {string} direction - 'left', 'right', or 'center'
 * @param {number} urgency - 1=far, 2=close, 3=urgent
 * @returns {string} Terse voice message (empty string suppresses announcement)
 */
function getNavMessage(objClass, direction, urgency) {
  if (urgency === 3) {
    if (direction === 'center') {
      return `Stop! ${objClass} ahead`;
    }
    return `${objClass} ${direction}, move ${direction === 'left' ? 'right' : 'left'}`;
  }
  if (urgency === 2) {
    if (direction === 'center') {
      return `${objClass} ahead`;
    }
    return `${objClass} on ${direction}`;
  }
  // Far objects (urgency 1): suppress frequent announcements
  return '';
}

function navigationLoop(video) {
  const canvas = document.getElementById('det-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const countEl = document.getElementById('det-count');
  const dirBadge = document.getElementById('nav-direction-badge');
  const alertEl = document.getElementById('nav-obstacle-alert');

  let lastNavDetectTime = 0;

  async function loop(timestamp) {
    if (!isDetecting || detectionMode !== 'navigation') {
      if (navRafId) cancelAnimationFrame(navRafId);
      navRafId = null;
      return;
    }
    navRafId = requestAnimationFrame(loop);

    if (timestamp - lastNavDetectTime < 400) return; // 400 ms throttle
    lastNavDetectTime = timestamp;

    if (!video || video.readyState < 2) return;

    let predictions = [];
    try {
      predictions = await cocossdModel.detect(video);
    } catch (_) { return; }

    // Filter to obstacle classes only
    const obstacles = predictions.filter(p =>
      NAV_OBSTACLE_CLASSES.includes(p.class)
    );

    // Clear + redraw canvas
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawNavPredictions(ctx, obstacles, video, canvas);
    }

    if (obstacles.length === 0) {
      if (countEl) countEl.textContent = 'Path clear';
      if (dirBadge) { dirBadge.textContent = '⬆️ Clear'; dirBadge.className = 'nav-direction-badge nav-clear'; }
      if (alertEl) alertEl.textContent = 'No obstacles detected';

      // Announce "path clear" periodically for reassurance or on transition
      const now = Date.now();
      const needsClearMsg = (lastNavUrgency > 0) || (now - lastNavWarnTime > NAV_COOLDOWN_CLEAR);
      
      if (needsClearMsg) {
        if (typeof speak === 'function') speak('No obstacle ahead, you can move');
        lastNavWarnTime = now;
      }
      lastNavUrgency = 0; // Reset urgency when path is clear
      lastNavCenterX = 0;
      return;
    }

    // Find closest obstacle (largest bounding-box area = closest)
    const closest = obstacles.reduce((best, p) => {
      const area = p.bbox[2] * p.bbox[3];
      const bestArea = best.bbox[2] * best.bbox[3];
      return area > bestArea ? p : best;
    });

    // Determine direction relative to frame width
    const frameW = video.videoWidth || 640;
    const cx = closest.bbox[0] + closest.bbox[2] / 2; // obstacle center-x
    const ratio = cx / frameW;
    let direction, emoji, avoidTip;
    if (ratio < 0.35) {
      direction = 'left'; emoji = '⬅️ Left'; avoidTip = 'Move right to avoid';
    } else if (ratio > 0.65) {
      direction = 'right'; emoji = '➡️ Right'; avoidTip = 'Move left to avoid';
    } else {
      direction = 'center'; emoji = '⚠️ Center'; avoidTip = 'Stop — obstacle ahead!';
    }

    // Proximity level based on how much of the frame the obstacle occupies
    const areaRatio = (closest.bbox[2] * closest.bbox[3]) / (frameW * (video.videoHeight || 480));

    // Determine urgency level: 1=far, 2=close, 3=urgent
    let urgency = 1;
    if (areaRatio > NAV_AREA_URGENT) {
      urgency = 3; // urgent (>15% of frame)
    } else if (areaRatio > 0.08) {
      urgency = 2; // close (>8% of frame)
    }
    const isClose = urgency >= 2;

    // Update count label
    if (countEl) countEl.textContent = `${obstacles.length} obstacle${obstacles.length > 1 ? 's' : ''} detected`;

    // Update direction badge
    if (dirBadge) {
      dirBadge.textContent = emoji;
      dirBadge.className = `nav-direction-badge nav-${direction}${isClose ? ' nav-urgent' : ''}`;
    }

    // Update alert text
    if (alertEl) {
      alertEl.textContent = `${capitalize(closest.class)} on ${direction}${isClose ? ' — VERY CLOSE!' : '  '}  ${avoidTip}`;
      alertEl.className = `nav-obstacle-alert${isClose ? ' nav-alert-urgent' : ''}`;
    }

    // Smarter voice warning with position tracking and tiered cooldowns
    const now = Date.now();
    const currentCenterX = cx / frameW; // Normalized center position

    // Check if position changed significantly
    const positionDelta = Math.abs(currentCenterX - lastNavCenterX);
    const urgencyIncreased = urgency > lastNavUrgency;
    const hasSignificantChange = positionDelta > NAV_POSITION_THRESHOLD || urgencyIncreased;

    // Determine cooldown based on urgency
    let cooldown;
    if (urgency === 3) {
      cooldown = NAV_COOLDOWN_URGENT;  // 1.5s
    } else if (urgency === 2) {
      cooldown = NAV_COOLDOWN_CLOSE;   // 3s
    } else {
      cooldown = NAV_COOLDOWN_FAR;     // 5s
    }

    const cooldownPassed = now - lastNavWarnTime > cooldown;

    // Speak only if: cooldown passed AND (significant change OR urgency increased)
    if ((cooldownPassed && hasSignificantChange) || urgencyIncreased) {
      const msg = getNavMessage(closest.class, direction, urgency);
      if (msg) { // Only speak if message is non-empty
        if (typeof speak === 'function') speak(msg);
        lastNavWarnTime = now;
        lastNavCenterX = currentCenterX;
        lastNavUrgency = urgency;
        lastNavDirection = `${direction}-${closest.class}`;
      }
    }
  }

  navRafId = requestAnimationFrame(loop);
}

/* Draw coloured bounding boxes for navigation obstacles */
function drawNavPredictions(ctx, obstacles, video, canvas) {
  const scaleX = canvas.width / (video.videoWidth || 640);
  const scaleY = canvas.height / (video.videoHeight || 480);

  obstacles.forEach(pred => {
    const [x, y, w, h] = pred.bbox;
    const label = pred.class;
    const conf = Math.round(pred.score * 100);
    const areaRatio = (w * h) / ((video.videoWidth || 640) * (video.videoHeight || 480));
    const isClose = areaRatio > 0.08;
    const color = isClose ? '#ef4444' : '#f59e0b'; // red = close, amber = far

    const cx = x * scaleX, cy = y * scaleY, cw = w * scaleX, ch = h * scaleY;

    ctx.strokeStyle = color;
    ctx.lineWidth = isClose ? 3.5 : 2.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = isClose ? 14 : 8;
    roundRect(ctx, cx, cy, cw, ch, 6);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const labelText = `${isClose ? '⚠ ' : ''}${capitalize(label)} ${conf}%`;
    ctx.font = `bold 13px Inter, sans-serif`;
    const textW = ctx.measureText(labelText).width;
    const padX = 8, padY = 5, labelH = 22;
    const lx = cx;
    const ly = cy > labelH + 4 ? cy - labelH - 4 : cy + 4;
    ctx.fillStyle = color;
    roundRect(ctx, lx, ly, textW + padX * 2, labelH, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 0;
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, lx + padX, ly + labelH / 2);
  });
}


function initButtonHandlers() {


  // "Custom Model Detection" buttons
  const customBtns = [
    document.getElementById('btn-start-custom'),
    document.getElementById('btn-start-custom-final'),
  ];
  customBtns.forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      await startCustomDetection();
    });
  });

  // "Navigation Mode" buttons
  const navBtns = [
    document.getElementById('btn-start-navigation'),
    document.getElementById('btn-start-navigation-final'),
  ];
  navBtns.forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      await startNavigationMode();
    });
  });



  // "Add Contact" button logic
  const btnAddContact = document.getElementById('btn-add-contact');
  const contactModal = document.getElementById('contact-modal');
  const btnCancelContact = document.getElementById('btn-cancel-contact');
  const btnSaveContact = document.getElementById('btn-save-contact');
  const inputName = document.getElementById('contact-name-input');
  const inputPhone = document.getElementById('contact-phone-input');

  if (btnAddContact) {
    btnAddContact.addEventListener('click', (e) => {
      e.preventDefault();
      if (contactModal) contactModal.removeAttribute('hidden');
    });
  }

  if (btnCancelContact) {
    btnCancelContact.addEventListener('click', () => {
      if (contactModal) contactModal.setAttribute('hidden', '');
      if (inputName) inputName.value = '';
      if (inputPhone) inputPhone.value = '';
    });
  }

  if (btnSaveContact) {
    btnSaveContact.addEventListener('click', () => {
      const name = inputName ? inputName.value.trim() : '';
      const phone = inputPhone ? inputPhone.value.trim() : '';
      if (name && phone) {
        saveEmergencyContact(name, phone);
        if (contactModal) contactModal.setAttribute('hidden', '');
        if (inputName) inputName.value = '';
        if (inputPhone) inputPhone.value = '';
      } else {
        showToast("Please enter both name and phone.");
      }
    });
  }
}

/* ════════════════════════════════════════
   6. SETTINGS — placeholder toast
════════════════════════════════════════ */
function initSettingsButton() {
  const btn = document.getElementById('btn-settings');
  if (!btn) return;
  btn.addEventListener('click', () => {
    showToast('Settings panel coming soon! ⚙️');
  });
}

/* ════════════════════════════════════════
   7. DETECTION MODAL — COCO-SSD + Camera
════════════════════════════════════════ */

// ── State ──
const URL = "https://teachablemachine.withgoogle.com/models/mwKJPazLO/";
let tmModel, maxPredictions;
let cocossdModel = null;   // loaded TF model
let videoStream = null;   // MediaStream
let rafId = null;   // requestAnimationFrame ID
let tmRafId = null;   // TM loop requestAnimationFrame ID
let lastDetectTime = 0;      // throttle timestamp
let cameraStarted = false;  // prevents multiple requests
const DETECT_INTERVAL = 300; // ms between inference calls (reduced for stability)
let lastSpoken = "";

// ── Custom Detection Verbosity Control ──
const CUSTOM_COOLDOWN_SAME = 8000;    // 8s for same object
const CUSTOM_COOLDOWN_NEW = 2000;     // 2s for new object
const STABLE_FRAMES_REQUIRED = 4;     // Require 4 stable frames

// Strict Control Flags
let isDetecting = false;
let stableCount = 0;
let lastDetected = "";
let lastSpokenTime = 0;
let lastAnnouncedClass = "";          // Class of last announced detection
let lastAnnouncedTime = 0;            // Timestamp of last announcement

async function loadTMModel() {
  if (typeof tmImage === "undefined") {
    console.error("tmImage not loaded");
    return;
  }
  const modelURL = URL + "model.json";
  const metadataURL = URL + "metadata.json";

  try {
    tmModel = await tmImage.load(modelURL, metadataURL);
    maxPredictions = tmModel.getTotalClasses();
    console.log("Model loaded successfully");
  } catch (error) {
    console.error("Model failed to load", error);
  }
}

async function predictTM() {
  if (!isDetecting || !tmModel) {
    if (tmRafId) cancelAnimationFrame(tmRafId);
    return;
  }

  const video = document.getElementById('det-video');
  if (!video || video.readyState < 2) {
    tmRafId = requestAnimationFrame(predictTM);
    return;
  }

  // Throttling for stability (250ms - 300ms)
  const now = Date.now();
  if (now - lastDetectTime < DETECT_INTERVAL) {
    tmRafId = requestAnimationFrame(predictTM);
    return;
  }
  lastDetectTime = now;

  try {
    const prediction = await tmModel.predict(video);

    // Find best prediction
    const sorted = [...prediction].sort((a, b) => b.probability - a.probability);
    const best = sorted[0];

    const resultsStrip = document.getElementById('det-results');
    const countEl = document.getElementById('det-count');

    const isBackground = best.className.toLowerCase().includes("background") ||
      best.className.toLowerCase().includes("none") ||
      best.className.toLowerCase().includes("neutral");

    // Reverting to single-chip UI as requested
    if (best.probability > 0.90 && !isBackground) {
      const objectName = best.className;
      const confidence = Math.round(best.probability * 100);

      // Update header count
      if (countEl) countEl.textContent = objectName;

      // Update results strip with ONLY the top prediction
      if (resultsStrip) {
        resultsStrip.innerHTML = `
          <span class="det-chip" style="background: var(--primary);">
            ${capitalize(objectName)} ${confidence}%
          </span>
        `;
      }

      // Stable detection anti-flicker (4 frames)
      if (best.className === lastDetected) {
        stableCount++;
      } else {
        stableCount = 0;
        lastDetected = best.className;
      }

      // Smarter voice announcement with class-aware cooldowns
      if (stableCount >= STABLE_FRAMES_REQUIRED - 1) {
        const isSameAsLastAnnounced = (objectName === lastAnnouncedClass);
        const cooldown = isSameAsLastAnnounced
          ? CUSTOM_COOLDOWN_SAME   // 8s for same object
          : CUSTOM_COOLDOWN_NEW;   // 2s for new object

        if (now - lastAnnouncedTime > cooldown) {
          if (typeof speak === 'function') speak(objectName + " detected");
          lastAnnouncedTime = now;
          lastAnnouncedClass = objectName;
          lastSpokenTime = now;
        }
      }

    } else {
      // No confident detection — clear UI
      stableCount = 0;
      if (countEl) countEl.textContent = "Scanning...";
      if (resultsStrip) {
        resultsStrip.innerHTML = '<span class="det-hint">Scanning...</span>';
      }
    }
  } catch (error) {
    console.error("TM Prediction failure:", error);
  }

  if (isDetecting) {
    tmRafId = requestAnimationFrame(predictTM);
  }
}

// ── Colour palette for labels ──
const LABEL_COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#14b8a6',
];
const colorMap = {};
function getColor(label) {
  if (!colorMap[label]) {
    const idx = Object.keys(colorMap).length % LABEL_COLORS.length;
    colorMap[label] = LABEL_COLORS[idx];
  }
  return colorMap[label];
}

function initDetectionModal() {
  const closeBtn = document.getElementById('det-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeDetectionModal);
  }

  // Close on backdrop click
  const modal = document.getElementById('detection-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeDetectionModal();
    });
  }

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDetectionModal();
  });
}

async function openDetectionModal() {
  const modal = document.getElementById('detection-modal');
  const countEl = document.getElementById('det-count');
  const video = document.getElementById('det-video');
  const canvas = document.getElementById('det-canvas');

  if (!modal) return;

  // Show modal
  modal.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';

  // Reset UI
  showLoader();
  countEl.textContent = 'Starting camera…';
  setResultsHint('Requesting camera access…');

  // The camera was already initialized via startCamera() on button click.
  // Wait briefly to ensure video stream attaches metadata if it just started.
  if (video && video.srcObject && video.readyState >= 1) {
    video.play().catch(e => console.error(e));
  } else if (video) {
    video.onloadedmetadata = () => video.play().catch(e => console.error(e));
  }

  // ── Step 2: Load models UI (Actual loading in start functions) ──
  countEl.textContent = 'Preparing AI…';
  setResultsHint(detectionMode === 'navigation' ? 'Loading Navigation Mode…' : 'Loading Custom Model…');

  // ── Step 3: Size canvas to match video ──
  resizeCanvas(video, canvas);
  window.addEventListener('resize', () => resizeCanvas(video, canvas));

  // Note: loader hiding is now handled in startCustomDetection once model resolves
}

function stopCamera() {
  closeDetectionModal();
}

function closeDetectionModal() {
  const modal = document.getElementById('detection-modal');
  if (!modal) return;

  // Stop Detection Global Flag
  isDetecting = false;

  // Stop RAF loop
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (tmRafId) { cancelAnimationFrame(tmRafId); tmRafId = null; }

  // Stop nav loop
  if (navRafId) { cancelAnimationFrame(navRafId); navRafId = null; }

  // Cancel ANY active speech
  if (window.speechSynthesis) {
    speechSynthesis.cancel();
  }

  // Reset counters/state
  stableCount = 0;
  lastDetected = "";
  previousDetectionLabels = "";
  lastSpokenTime = 0;
  lastSpoken = "";
  lastAnnouncedClass = "";   // Reset custom detection tracking
  lastAnnouncedTime = 0;

  // Stop camera
  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
    videoStream = null;
  }

  // Reset video
  const video = document.getElementById('det-video');
  if (video) { video.srcObject = null; }

  // Clear canvas
  const canvas = document.getElementById('det-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Reset nav state
  lastNavWarnTime = 0;
  lastNavDirection = '';
  lastNavCenterX = 0;        // Reset position tracking
  lastNavUrgency = 0;        // Reset urgency tracking
  const banner = document.getElementById('nav-warning-banner');
  if (banner) banner.setAttribute('hidden', '');
  const alertEl = document.getElementById('nav-obstacle-alert');
  if (alertEl) alertEl.className = 'nav-obstacle-alert';
  const dirBadge = document.getElementById('nav-direction-badge');
  if (dirBadge) { dirBadge.className = 'nav-direction-badge'; dirBadge.textContent = '⬆️ Scanning…'; }

  cameraStarted = false;

  // Hide modal
  modal.setAttribute('hidden', '');
  document.body.style.overflow = '';

  // Reset results
  setResultsHint('Point your camera at everyday objects');
  const countEl = document.getElementById('det-count');
  if (countEl) countEl.textContent = 'Loading model…';

  // Reset loading state
  const loading = document.getElementById('det-loading');
  if (loading) loading.classList.remove('hidden');
}

/* ── Detection loop ── */


/* ── Draw bounding boxes + labels ── */
function drawPredictions(ctx, predictions, video, canvas) {
  // Scale factors: canvas might differ from video's natural size
  const scaleX = canvas.width / video.videoWidth;
  const scaleY = canvas.height / video.videoHeight;

  predictions.forEach(pred => {
    const [x, y, w, h] = pred.bbox;
    const label = pred.class;
    const conf = Math.round(pred.score * 100);
    const color = getColor(label);

    const cx = x * scaleX;
    const cy = y * scaleY;
    const cw = w * scaleX;
    const ch = h * scaleY;

    // Box
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    roundRect(ctx, cx, cy, cw, ch, 6);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Label background
    const labelText = `${capitalize(label)} – ${conf}%`;
    ctx.font = 'bold 13px Inter, sans-serif';
    const textW = ctx.measureText(labelText).width;
    const padX = 8, padY = 5, labelH = 22;
    const lx = cx;
    const ly = cy > labelH + 4 ? cy - labelH - 4 : cy + 4;

    ctx.fillStyle = color;
    roundRect(ctx, lx, ly, textW + padX * 2, labelH, 4);
    ctx.fill();

    // Label text
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 0;
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, lx + padX, ly + labelH / 2);
  });
}

/* ── Canvas helper: rounded rectangle ── */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ── Result chips in the bottom strip ── */
function updateResultChips(predictions) {
  const strip = document.getElementById('det-results');
  if (!strip) return;
  strip.innerHTML = '';

  if (predictions.length === 0) {
    setResultsHint('No objects detected yet — keep scanning');
    return;
  }

  predictions.forEach(pred => {
    const color = getColor(pred.class);
    const conf = Math.round(pred.score * 100);
    const chip = document.createElement('span');
    chip.className = 'det-chip';
    chip.style.background = color;
    chip.textContent = `${capitalize(pred.class)} ${conf}%`;
    strip.appendChild(chip);
  });
}

/* ── Resize canvas to match displayed video size ── */
function resizeCanvas(video, canvas) {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  canvas.width = vw;
  canvas.height = vh;
}

/* ── Set results hint text ── */
function setResultsHint(text) {
  const strip = document.getElementById('det-results');
  if (!strip) return;
  strip.innerHTML = `<span class="det-hint">${text}</span>`;
}

/* ════════════════════════════════════════
   HELPERS
════════════════════════════════════════ */
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const navH = document.getElementById('navbar')?.offsetHeight || 80;
  const top = el.getBoundingClientRect().top + window.scrollY - navH;
  window.scrollTo({ top, behavior: 'smooth' });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

let toastTimer = null;
function showToast(message) {
  const existing = document.getElementById('va-toast');
  if (existing) existing.remove();
  clearTimeout(toastTimer);

  const toast = document.createElement('div');
  toast.id = 'va-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '28px',
    left: '50%',
    transform: 'translateX(-50%) translateY(20px)',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    padding: '14px 28px',
    borderRadius: '100px',
    fontSize: '0.9rem',
    fontFamily: "'Inter', sans-serif",
    fontWeight: '600',
    boxShadow: '0 8px 30px rgba(99,102,241,0.4)',
    zIndex: '9999',
    opacity: '0',
    transition: 'opacity 0.3s ease, transform 0.3s ease',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  });

  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });
  });

  toastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
    setTimeout(() => toast.remove(), 350);
  }, 3000);
}

/* ════════════════════════════════════════
   8. BACKEND INTEGRATION
════════════════════════════════════════ */
const BACKEND_URL = 'http://localhost:5001';

async function testBackend() {
  try {
    const response = await fetch(`${BACKEND_URL}/test`);
    const data = await response.json();
    console.log('✅ Backend Connection:', data.message);
  } catch (error) {
    console.error('❌ Backend Connection Failed:', error);
  }
}

async function saveEmergencyContact(name, phone) {
  try {
    const response = await fetch(`${BACKEND_URL}/save-contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone })
    });
    const data = await response.json();
    if (response.ok) {
      showToast(`Contact saved: ${name}`);
      if (typeof speak === 'function') speak(`Emergency contact ${name} has been saved.`);
    } else {
      showToast(`Error: ${data.error}`);
    }
  } catch (error) {
    console.error('Failed to save contact:', error);
    showToast('Failed to connect to backend');
  }
}

async function triggerEmergencyFrontend() {
  // Cancel previous speech
  if (window.speechSynthesis) window.speechSynthesis.cancel();

  // STEP 1: UI & Voice initial feedback
  if (typeof speak === 'function') speak('Emergency alert activated. Starting emergency process.');
  showToast('Starting emergency process...');
  console.log('Emergency triggered');

  // STEP 2: Fetch contacts
  let contacts = [];
  try {
    const response = await fetch(`${BACKEND_URL}/contacts`);
    contacts = await response.json();
    console.log('Contacts fetched:', contacts);
  } catch (err) {
    if (typeof speak === 'function') speak('Failed to fetch contacts');
    showToast('Failed to fetch contacts');
    console.error('Failed to fetch contacts:', err);
    return;
  }

  if (!contacts || contacts.length === 0) {
    if (typeof speak === 'function') speak('No emergency contacts found. Please save a contact first.');
    showToast('No emergency contacts found');
    return;
  }

  // STEP 3: Get location
  showToast('Getting location...');
  if (!navigator.geolocation) {
    if (typeof speak === 'function') speak('Geolocation is not supported by your browser');
    showToast('Location error');
    console.error('Geolocation is not supported by your browser');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      console.log('Location received:', lat, lng);
      
      // STEP 4 & 5: Formatting message and opening Native SMS app
      const mapLink = `https://maps.google.com/?q=${lat},${lng}`;
      const msg = `🚨 EMERGENCY ALERT!\nI need help.\n\nMy location:\n${mapLink}`;
      
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      const separator = isIOS ? '&' : '?';

      contacts.forEach(contact => {
        const smsUrl = `sms:${contact.phone}${separator}body=${encodeURIComponent(msg)}`;
        window.open(smsUrl, '_self');
      });

      // STEP 6: Final feedback
      showToast('Emergency messages ready');
      if (typeof speak === 'function') speak('SMS App opened. Please send the message.');
      
    },
    (error) => {
      console.error('Location error:', error);
      if (typeof speak === 'function') speak('Location access required');
      showToast('Location error');
    }
  );
}

// Automatically test connection on load
testBackend();
