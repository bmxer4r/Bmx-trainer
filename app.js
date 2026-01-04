const TIMES = { warmup: 300, sprint: 10, rest: 50, cooldown: 300, totalSets: 10 };
let state = { phase: 'IDLE', timeLeft: TIMES.warmup, currentSet: 0, isRunning: false, timer: null, audio: null };

const el = {
    theme: document.documentElement,
    timer: document.getElementById('timer-display'),
    phase: document.getElementById('phase-label'),
    progress: document.getElementById('progress-fill'),
    sets: document.getElementById('interval-count'),
    next: document.getElementById('next-label'),
    card: document.getElementById('main-card'),
    startBtn: document.getElementById('start-btn'),
    controls: document.getElementById('active-controls'),
    status: document.getElementById('status-dot'),
    modal: document.getElementById('reset-modal')
};

function initAudio() {
    if (!state.audio) state.audio = new (window.AudioContext || window.webkitAudioContext)();
    if (state.audio.state === 'suspended') state.audio.resume();
}

function playBeep(freq, dur) {
    if (!state.audio) return;
    const osc = state.audio.createOscillator();
    const gain = state.audio.createGain();
    osc.frequency.setValueAtTime(freq, state.audio.currentTime);
    gain.gain.setValueAtTime(0.1, state.audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, state.audio.currentTime + dur);
    osc.connect(gain); gain.connect(state.audio.destination);
    osc.start(); osc.stop(state.audio.currentTime + dur);
}

function notify(title, body) {
    if (Notification.permission === 'granted' && document.hidden) {
        new Notification(title, { body });
    }
    if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
}

function updateUI() {
    const m = Math.floor(state.timeLeft / 60);
    const s = state.timeLeft % 60;
    el.timer.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    
    let accent = '#fbbf24', total = TIMES.warmup;
    el.card.classList.remove('sprint-pulse');
    
    if (state.phase === 'SPRINT') {
        accent = '#ef4444'; total = TIMES.sprint; el.phase.textContent = 'SPRINT!'; el.next.textContent = 'Full Gas';
        if (state.isRunning) el.card.classList.add('sprint-pulse');
    } else if (state.phase === 'REST') {
        accent = '#22c55e'; total = TIMES.rest; el.phase.textContent = 'REST'; el.next.textContent = state.currentSet < TIMES.totalSets ? `Next: Set ${state.currentSet + 1}` : 'Cooldown';
    } else if (state.phase === 'COOLDOWN') {
        accent = '#3b82f6'; total = TIMES.cooldown; el.phase.textContent = 'COOLDOWN'; el.next.textContent = 'Done';
    } else {
        el.phase.textContent = state.isRunning ? 'Warmup' : (state.phase === 'IDLE' ? 'Ready' : 'Paused');
    }

    el.phase.style.color = accent;
    el.status.style.backgroundColor = accent;
    el.status.style.boxShadow = `0 0 10px ${accent}`;
    el.progress.style.backgroundColor = accent;
    el.progress.style.width = `${(state.timeLeft / total) * 100}%`;
    el.sets.textContent = `${state.currentSet}/${TIMES.totalSets}`;
}

function transition() {
    playBeep(880, 0.6);
    if (state.phase === 'WARMUP' || state.phase === 'IDLE') {
        state.phase = 'SPRINT'; state.currentSet = 1; state.timeLeft = TIMES.sprint;
        notify("SPRINT!", "Go!");
    } else if (state.phase === 'SPRINT') {
        state.phase = 'REST'; state.timeLeft = TIMES.rest;
        notify("REST", "Recover");
    } else if (state.phase === 'REST') {
        if (state.currentSet < TIMES.totalSets) {
            state.phase = 'SPRINT'; state.currentSet++; state.timeLeft = TIMES.sprint;
            notify(`SPRINT ${state.currentSet}`, "Power!");
        } else {
            state.phase = 'COOLDOWN'; state.timeLeft = TIMES.cooldown;
            notify("COOLDOWN", "Easy now");
        }
    } else {
        reset(true);
    }
}

function start() {
    initAudio();
    if (state.phase === 'IDLE') { state.phase = 'WARMUP'; state.timeLeft = TIMES.warmup; }
    state.isRunning = true;
    state.timer = setInterval(() => {
        if (state.timeLeft > 0) {
            if (state.timeLeft <= 3) playBeep(440, 0.1);
            state.timeLeft--;
        } else transition();
        updateUI();
    }, 1000);
    el.startBtn.classList.add('hidden'); el.controls.classList.remove('hidden');
    updateUI();
}

function pause() {
    clearInterval(state.timer); state.isRunning = false;
    el.startBtn.textContent = 'Resume'; el.startBtn.classList.remove('hidden'); el.controls.classList.add('hidden');
    updateUI();
}

function reset(done = false) {
    clearInterval(state.timer); state.isRunning = false; state.phase = 'IDLE'; state.timeLeft = TIMES.warmup; state.currentSet = 0;
    el.startBtn.textContent = done ? 'Restart Session' : 'Start Session';
    el.startBtn.classList.remove('hidden'); el.controls.classList.add('hidden');
    updateUI();
}

el.startBtn.onclick = start;
document.getElementById('pause-btn').onclick = pause;
document.getElementById('reset-btn').onclick = () => el.modal.classList.remove('hidden');
document.getElementById('confirm-reset').onclick = () => { el.modal.classList.add('hidden'); reset(); };
document.getElementById('theme-toggle').onclick = () => {
    const isDark = el.theme.getAttribute('data-theme') === 'dark';
    el.theme.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('sun').classList.toggle('hidden', isDark);
    document.getElementById('moon').classList.toggle('hidden', !isDark);
};
document.getElementById('notify-test').onclick = () => {
    Notification.requestPermission().then(p => { if(p === 'granted') notify("Test", "Vibration Active"); });
};
updateUI();

