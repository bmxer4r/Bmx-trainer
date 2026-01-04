// Configuration
const CONFIG = {
    warmup: 300,
    sprint: 10,
    rest: 50,
    cooldown: 300,
    sets: 10
};

// State Management
let state = {
    phase: 'IDLE', // IDLE, WARMUP, SPRINT, REST, COOLDOWN
    timeLeft: CONFIG.warmup,
    currentSet: 0,
    isRunning: false,
    intervalId: null,
    audioContext: null
};

// DOM Elements
const els = {
    html: document.documentElement,
    timerCard: document.getElementById('timer-card'),
    phaseLabel: document.getElementById('phase-label'),
    mins: document.getElementById('minutes'),
    secs: document.getElementById('seconds'),
    progress: document.getElementById('progress-bar'),
    setCounter: document.getElementById('set-counter'),
    nextUp: document.getElementById('next-up-text'),
    mainBtn: document.getElementById('main-btn'),
    secondaryControls: document.getElementById('secondary-controls'),
    pauseBtn: document.getElementById('pause-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    modal: document.getElementById('modal-overlay'),
    statusDot: document.getElementById('status-dot')
};

// --- Audio & Notifications (The "Watch Integration" Part) ---

function initAudio() {
    if (!state.audioContext) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        state.audioContext = new AudioContext();
    }
    if (state.audioContext.state === 'suspended') {
        state.audioContext.resume();
    }
}

function playBeep(freq, duration, type = 'sine') {
    if (!state.audioContext) return;
    const osc = state.audioContext.createOscillator();
    const gain = state.audioContext.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, state.audioContext.currentTime);
    
    gain.gain.setValueAtTime(0.1, state.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, state.audioContext.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(state.audioContext.destination);
    osc.start();
    osc.stop(state.audioContext.currentTime + duration);
}

// Request permissions for watch vibration support
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }
}

function sendNotification(title, body) {
    // 1. Phone Vibration
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    
    // 2. Watch Notification (Bridge via System Notifications)
    if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState === 'hidden') {
        // Only fire if app is in background (phone in pocket) to avoid double buzz
        new Notification(title, { 
            body: body,
            icon: 'icon.png', // Fallback
            tag: 'bmx-timer' // Prevents stacking
        });
    }
}

// --- Logic ---

function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    els.mins.textContent = m.toString().padStart(2, '0');
    els.secs.textContent = s.toString().padStart(2, '0');
}

function updateThemeColor(colorVar) {
    // Updates the CSS variable for the active color
    const color = getComputedStyle(els.html).getPropertyValue(colorVar).trim();
    els.html.style.setProperty('--active-color', color);
}

function updateUI() {
    formatTime(state.timeLeft);
    
    // Set colors and text based on phase
    switch(state.phase) {
        case 'IDLE':
        case 'WARMUP':
            updateThemeColor('--c-amber');
            els.phaseLabel.textContent = 'WARMUP';
            els.setCounter.textContent = `0/${CONFIG.sets}`;
            els.nextUp.textContent = "Upcoming: 10x Sprints";
            els.html.classList.remove('sprint-active');
            els.timerCard.classList.remove('sprint-pulse');
            break;
        case 'SPRINT':
            updateThemeColor('--c-red');
            els.phaseLabel.textContent = 'FULL GAS';
            els.setCounter.textContent = `${state.currentSet}/${CONFIG.sets}`;
            els.nextUp.textContent = "Push Hard!";
            els.html.classList.add('sprint-active');
            els.timerCard.classList.add('sprint-pulse');
            break;
        case 'REST':
            updateThemeColor('--c-green');
            els.phaseLabel.textContent = 'RECOVER';
            els.setCounter.textContent = `${state.currentSet}/${CONFIG.sets}`;
            els.nextUp.textContent = state.currentSet < CONFIG.sets ? `Next: Sprint ${state.currentSet + 1}` : "Next: Cooldown";
            els.html.classList.remove('sprint-active');
            els.timerCard.classList.remove('sprint-pulse');
            break;
        case 'COOLDOWN':
            updateThemeColor('--c-blue');
            els.phaseLabel.textContent = 'COOLDOWN';
            els.setCounter.textContent = "FINISH";
            els.nextUp.textContent = "Easy Spin";
            els.html.classList.remove('sprint-active');
            els.timerCard.classList.remove('sprint-pulse');
            break;
    }

    // Progress Bar
    let maxTime = CONFIG.warmup;
    if (state.phase === 'SPRINT') maxTime = CONFIG.sprint;
    if (state.phase === 'REST') maxTime = CONFIG.rest;
    if (state.phase === 'COOLDOWN') maxTime = CONFIG.cooldown;
    
    const percentage = (state.timeLeft / maxTime) * 100;
    els.progress.style.width = `${percentage}%`;
}

function tick() {
    if (state.timeLeft > 0) {
        // Countdown Beeps (3, 2, 1)
        if (state.timeLeft <= 3) playBeep(440, 0.1);
        state.timeLeft--;
    } else {
        // Phase Transition
        handleTransition();
    }
    updateUI();
}

function handleTransition() {
    playBeep(880, 0.6, 'square'); // Loud transition beep
    
    if (state.phase === 'WARMUP') {
        state.phase = 'SPRINT';
        state.currentSet = 1;
        state.timeLeft = CONFIG.sprint;
        sendNotification("SPRINT!", "Go Go Go!");
    } else if (state.phase === 'SPRINT') {
        state.phase = 'REST';
        state.timeLeft = CONFIG.rest;
        sendNotification("REST", "Recover now.");
    } else if (state.phase === 'REST') {
        if (state.currentSet < CONFIG.sets) {
            state.phase = 'SPRINT';
            state.currentSet++;
            state.timeLeft = CONFIG.sprint;
            sendNotification(`SPRINT ${state.currentSet}`, "Full Power!");
        } else {
            state.phase = 'COOLDOWN';
            state.timeLeft = CONFIG.cooldown;
            sendNotification("COOLDOWN", "Good job. Spin it out.");
        }
    } else if (state.phase === 'COOLDOWN') {
        completeSession();
    }
}

function startTimer() {
    initAudio();
    requestNotificationPermission();
    
    // Wake Lock
    if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').catch(console.error);
    }

    if (state.phase === 'IDLE') {
        state.phase = 'WARMUP';
        state.timeLeft = CONFIG.warmup;
    }
    
    state.isRunning = true;
    state.intervalId = setInterval(tick, 1000);
    
    els.mainBtn.classList.add('hidden');
    els.secondaryControls.classList.remove('hidden');
    updateUI();
}

function pauseTimer() {
    clearInterval(state.intervalId);
    state.isRunning = false;
    els.mainBtn.textContent = "RESUME SESSION";
    els.mainBtn.classList.remove('hidden');
    els.secondaryControls.classList.add('hidden');
    els.phaseLabel.textContent = "PAUSED";
}

function completeSession() {
    clearInterval(state.intervalId);
    state.phase = 'IDLE';
    state.currentSet = 0;
    state.timeLeft = CONFIG.warmup;
    state.isRunning = false;
    
    els.mainBtn.textContent = "START NEW SESSION";
    els.mainBtn.classList.remove('hidden');
    els.secondaryControls.classList.add('hidden');
    
    sendNotification("DONE", "Session Complete.");
    updateUI();
}

// --- Event Listeners ---

els.mainBtn.addEventListener('click', startTimer);
els.pauseBtn.addEventListener('click', pauseTimer);

els.themeToggle.addEventListener('click', () => {
    const current = els.html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    els.html.setAttribute('data-theme', next);
});

// Reset Modal Logic
document.getElementById('reset-btn').addEventListener('click', () => els.modal.classList.remove('hidden'));
document.getElementById('cancel-reset').addEventListener('click', () => els.modal.classList.add('hidden'));
document.getElementById('confirm-reset').addEventListener('click', () => {
    els.modal.classList.add('hidden');
    completeSession();
    els.mainBtn.textContent = "START SESSION"; // Reset text
});

// Init
updateUI();

