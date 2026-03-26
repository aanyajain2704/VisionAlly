/* ═══════════════════════════════════════════
   VisionAlly – audio.js
   Complete Audio Interaction System
   Uses: Web Speech API (TTS + SpeechRecognition)
═══════════════════════════════════════════ */

'use strict';

/* ════════════════════════════════════════
   STATE
════════════════════════════════════════ */
let audioEnabled = false; // master audio toggle

// Object detection tracking – avoid repeating same objects
let lastSpokenObjects = new Set();   // set of labels spoken last cycle
let objectSilenceTimer = null;        // timer to reset spoken set after silence
let previousDetectionLabels = "";
const SPEAK_COOLDOWN_MS = 2000;

// SpeechSynthesis reference
const synth = window.speechSynthesis;

/* ════════════════════════════════════════
   PUBLIC API  (called by script.js)
════════════════════════════════════════ */

/** Initialise everything. Call once on DOMContentLoaded. */
function audioInit() {
  _injectAudioToggle();

  const overlay = document.getElementById('audio-start-overlay');
  if (overlay) {
    overlay.addEventListener('click', () => {
      overlay.remove();
      audioEnabled = true;

      const speech = new SpeechSynthesisUtterance(
        "Welcome to Vision Ally, your smart everyday assistant. " +
        "Say custom model for custom model detection, " +
        "or say start navigation mode for navigation detection."
      );
      speech.rate = 0.95;
      speech.pitch = 1;

      // Boot the mic AFTER the welcome speech finishes so they don't clash
      speech.onend = () => {
        if (typeof VoiceCommander !== 'undefined') VoiceCommander.boot();
      };

      synth.cancel();
      synth.speak(speech);
    });
  }
}

/**
 * Trigger TTS.
 * @param {string} text
 */
function speak(text) {
  if (!audioEnabled) return;

  const speech = new SpeechSynthesisUtterance(text);
  speech.rate = 0.95;
  speech.pitch = 1;

  synth.cancel();
  synth.speak(speech);
}

/**
 * Called from the detection loop with the current array of predictions.
 * Announces only objects that weren't spoken in the previous cycle.
 * @param {Array} predictions  COCO-SSD prediction objects [{class, score, bbox}]
 */
function speakDetectedObjects(predictions) {
  if (!audioEnabled) return;

  const currentLabels = predictions && predictions.length > 0
    ? predictions.map(p => p.class).sort().join(",")
    : "";

  const now = Date.now();
  const hasChanged = currentLabels !== previousDetectionLabels;
  const cooldownPassed = now - (typeof lastSpokenTime !== 'undefined' ? lastSpokenTime : 0) > SPEAK_COOLDOWN_MS;

  console.log("Current:", currentLabels);
  console.log("Previous:", previousDetectionLabels);

  if (hasChanged && cooldownPassed) {
    if (currentLabels === "") {
      previousDetectionLabels = "";
    } else {
      speechSynthesis.cancel();
      const labels = currentLabels.split(",");
      const phrase = labels.map(l => _capitalize(l) + " detected").join(". ");
      speak(phrase);
      if (typeof lastSpokenTime !== 'undefined') {
        lastSpokenTime = now;
      }
      previousDetectionLabels = currentLabels;
      console.log("New detection change:", labels);
    }
  } else {
    previousDetectionLabels = currentLabels;
  }

  clearTimeout(objectSilenceTimer);
  if (currentLabels !== "") {
    objectSilenceTimer = setTimeout(() => {
      previousDetectionLabels = "";
      console.log("Scene silence reset");
    }, 4000);
  }
}



/* ════════════════════════════════════════
   PRIVATE – AUDIO TOGGLE BUTTON
════════════════════════════════════════ */
function _injectAudioToggle() {
  // Insert the toggle into the existing .nav-actions div (right of Settings)
  const navActions = document.querySelector('.nav-actions');
  if (!navActions) return;

  const btn = document.createElement('button');
  btn.id = 'btn-audio-toggle';
  btn.className = 'btn-audio-toggle';
  btn.setAttribute('aria-label', 'Toggle audio');
  btn.setAttribute('title', 'Toggle Audio ON / OFF');
  btn.innerHTML = _toggleHTML(true);

  btn.addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    _updateToggleButton();
    if (audioEnabled) {
      speak('Audio enabled', { priority: true });
    } else {
      synth.cancel();
      speechQueue = [];
    }
  });

  // Insert BEFORE the hamburger (last child)
  navActions.insertBefore(btn, navActions.lastElementChild);
}

function _updateToggleButton() {
  const btn = document.getElementById('btn-audio-toggle');
  if (!btn) return;
  btn.innerHTML = _toggleHTML(audioEnabled);
  btn.classList.toggle('audio-off', !audioEnabled);
}

function _toggleHTML(on) {
  return on
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg><span>Audio ON</span>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg><span>Audio OFF</span>`;
}

/* ════════════════════════════════════════
   UTILITY
════════════════════════════════════════ */
function _capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}