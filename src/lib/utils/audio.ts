// ── Web Audio Synthesis Engine ───────────────────────────────────────
// All sounds are generated programmatically. Zero audio files, zero bundle cost.
// Lazy AudioContext creation satisfies browser autoplay policies.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let _volume = 0.5;
let _muted = false;
let _noiseCache: AudioBuffer | null = null;

function getCtx(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	if (!ctx) {
		ctx = new AudioContext();
		masterGain = ctx.createGain();
		masterGain.gain.value = _muted ? 0 : _volume;
		masterGain.connect(ctx.destination);
	}
	if (ctx.state === 'suspended') ctx.resume();
	return ctx;
}

function getMaster(): GainNode | null {
	return masterGain;
}

function noiseBuffer(c: AudioContext, duration: number): AudioBuffer {
	if (_noiseCache && _noiseCache.duration >= duration) return _noiseCache;
	const sr = c.sampleRate;
	const len = Math.floor(sr * Math.max(duration, 0.5));
	const buf = c.createBuffer(1, len, sr);
	const d = buf.getChannelData(0);
	for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
	_noiseCache = buf;
	return buf;
}

// ── Volume / Mute API ───────────────────────────────────────────────

export function setVolume(v: number): void {
	_volume = Math.max(0, Math.min(1, v));
	if (masterGain && !_muted) masterGain.gain.value = _volume;
	try { localStorage.setItem('haw_vol', String(_volume)); } catch {}
}

export function setMuted(m: boolean): void {
	_muted = m;
	if (masterGain) masterGain.gain.value = _muted ? 0 : _volume;
	try { localStorage.setItem('haw_mute', m ? '1' : '0'); } catch {}
}

export function toggleMute(): boolean {
	setMuted(!_muted);
	return _muted;
}

export function getMuted(): boolean { return _muted; }
export function getVolume(): number { return _volume; }

// ── Individual Sounds ───────────────────────────────────────────────

function soundClick() {
	const c = getCtx(), m = getMaster(); if (!c || !m) return;
	const osc = c.createOscillator();
	const g = c.createGain();
	osc.type = 'sine'; osc.frequency.value = 1200;
	g.gain.setValueAtTime(0.12, c.currentTime);
	g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.015);
	osc.connect(g); g.connect(m);
	osc.start(c.currentTime); osc.stop(c.currentTime + 0.02);
}

function soundChipDown() {
	const c = getCtx(), m = getMaster(); if (!c || !m) return;
	const noise = c.createBufferSource();
	noise.buffer = noiseBuffer(c, 0.12);
	const filter = c.createBiquadFilter();
	filter.type = 'lowpass'; filter.frequency.value = 300; filter.Q.value = 3;
	const g = c.createGain();
	g.gain.setValueAtTime(0.35, c.currentTime);
	g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
	noise.connect(filter); filter.connect(g); g.connect(m);
	noise.start(c.currentTime); noise.stop(c.currentTime + 0.12);
}

function soundWin() {
	const c = getCtx(), m = getMaster(); if (!c || !m) return;
	const freqs = [523.25, 783.99]; // C5, G5
	freqs.forEach((freq, i) => {
		const osc = c.createOscillator();
		const g = c.createGain();
		osc.type = 'triangle'; osc.frequency.value = freq;
		const t = c.currentTime + i * 0.12;
		g.gain.setValueAtTime(0, t);
		g.gain.linearRampToValueAtTime(0.18, t + 0.01);
		g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
		osc.connect(g); g.connect(m);
		osc.start(t); osc.stop(t + 0.22);
	});
}

function soundLoss() {
	const c = getCtx(), m = getMaster(); if (!c || !m) return;
	const osc = c.createOscillator();
	const g = c.createGain();
	osc.type = 'sine';
	osc.frequency.setValueAtTime(120, c.currentTime);
	osc.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.15);
	g.gain.setValueAtTime(0.2, c.currentTime);
	g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
	osc.connect(g); g.connect(m);
	osc.start(c.currentTime); osc.stop(c.currentTime + 0.22);
}

function soundBust() {
	const c = getCtx(), m = getMaster(); if (!c || !m) return;
	// Low sine thump
	const osc = c.createOscillator();
	const og = c.createGain();
	osc.type = 'sine';
	osc.frequency.setValueAtTime(90, c.currentTime);
	osc.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.25);
	og.gain.setValueAtTime(0.35, c.currentTime);
	og.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
	osc.connect(og); og.connect(m);
	osc.start(c.currentTime); osc.stop(c.currentTime + 0.35);
	// Noise impact on top
	const noise = c.createBufferSource();
	noise.buffer = noiseBuffer(c, 0.05);
	const nf = c.createBiquadFilter();
	nf.type = 'lowpass'; nf.frequency.value = 500;
	const ng = c.createGain();
	ng.gain.setValueAtTime(0.3, c.currentTime);
	ng.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);
	noise.connect(nf); nf.connect(ng); ng.connect(m);
	noise.start(c.currentTime); noise.stop(c.currentTime + 0.06);
}

// ── Roulette ────────────────────────────────────────────────────────

function soundBallSpin() {
	const c = getCtx(), m = getMaster(); if (!c || !m) return;
	const noise = c.createBufferSource();
	noise.buffer = noiseBuffer(c, 0.25);
	const filter = c.createBiquadFilter();
	filter.type = 'bandpass'; filter.frequency.value = 2000; filter.Q.value = 2;
	const g = c.createGain();
	g.gain.setValueAtTime(0.001, c.currentTime);
	g.gain.linearRampToValueAtTime(0.18, c.currentTime + 0.04);
	g.gain.setValueAtTime(0.18, c.currentTime + 0.14);
	g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.22);
	noise.connect(filter); filter.connect(g); g.connect(m);
	noise.start(c.currentTime); noise.stop(c.currentTime + 0.25);
}

function soundBallLand() {
	const c = getCtx(), m = getMaster(); if (!c || !m) return;
	// Impact click
	const noise = c.createBufferSource();
	noise.buffer = noiseBuffer(c, 0.03);
	const ng = c.createGain();
	ng.gain.setValueAtTime(0.3, c.currentTime);
	ng.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.025);
	noise.connect(ng); ng.connect(m);
	noise.start(c.currentTime); noise.stop(c.currentTime + 0.03);
	// Short ring
	const osc = c.createOscillator();
	const og = c.createGain();
	osc.type = 'sine'; osc.frequency.value = 880;
	og.gain.setValueAtTime(0.08, c.currentTime + 0.01);
	og.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
	osc.connect(og); og.connect(m);
	osc.start(c.currentTime + 0.01); osc.stop(c.currentTime + 0.15);
}

// ── Blackjack ───────────────────────────────────────────────────────

function soundCardDeal() {
	const c = getCtx(), m = getMaster(); if (!c || !m) return;
	const noise = c.createBufferSource();
	noise.buffer = noiseBuffer(c, 0.09);
	const filter = c.createBiquadFilter();
	filter.type = 'highpass'; filter.frequency.value = 2500;
	const g = c.createGain();
	g.gain.setValueAtTime(0.22, c.currentTime);
	g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.07);
	noise.connect(filter); filter.connect(g); g.connect(m);
	noise.start(c.currentTime); noise.stop(c.currentTime + 0.09);
}

function soundCardFlip() {
	const c = getCtx(), m = getMaster(); if (!c || !m) return;
	const noise = c.createBufferSource();
	noise.buffer = noiseBuffer(c, 0.07);
	const filter = c.createBiquadFilter();
	filter.type = 'highpass'; filter.frequency.value = 3200;
	const g = c.createGain();
	g.gain.setValueAtTime(0.18, c.currentTime);
	g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);
	noise.connect(filter); filter.connect(g); g.connect(m);
	noise.start(c.currentTime); noise.stop(c.currentTime + 0.07);
}

function soundBlackjack() {
	const c = getCtx(), m = getMaster(); if (!c || !m) return;
	const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
	freqs.forEach((freq, i) => {
		const osc = c.createOscillator();
		const g = c.createGain();
		osc.type = 'triangle'; osc.frequency.value = freq;
		const t = c.currentTime + i * 0.1;
		g.gain.setValueAtTime(0, t);
		g.gain.linearRampToValueAtTime(0.2, t + 0.01);
		g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
		osc.connect(g); g.connect(m);
		osc.start(t); osc.stop(t + 0.25);
	});
}

function soundQuizCorrect() {
	const c = getCtx(), m = getMaster(); if (!c || !m) return;
	const osc = c.createOscillator();
	const g = c.createGain();
	osc.type = 'sine'; osc.frequency.value = 1046.5; // C6
	g.gain.setValueAtTime(0.15, c.currentTime);
	g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
	osc.connect(g); g.connect(m);
	osc.start(c.currentTime); osc.stop(c.currentTime + 0.22);
}

function soundQuizWrong() {
	const c = getCtx(), m = getMaster(); if (!c || !m) return;
	const osc = c.createOscillator();
	const g = c.createGain();
	osc.type = 'square'; osc.frequency.value = 120;
	g.gain.setValueAtTime(0.1, c.currentTime);
	g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
	osc.connect(g); g.connect(m);
	osc.start(c.currentTime); osc.stop(c.currentTime + 0.12);
}

// ── Slots ───────────────────────────────────────────────────────────

function soundReelSpin() {
	const c = getCtx(), m = getMaster(); if (!c || !m) return;
	const noise = c.createBufferSource();
	noise.buffer = noiseBuffer(c, 0.2);
	const filter = c.createBiquadFilter();
	filter.type = 'bandpass'; filter.frequency.value = 800; filter.Q.value = 1.5;
	const g = c.createGain();
	g.gain.setValueAtTime(0.14, c.currentTime);
	g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
	noise.connect(filter); filter.connect(g); g.connect(m);
	noise.start(c.currentTime); noise.stop(c.currentTime + 0.2);
}

function soundReelStop() {
	const c = getCtx(), m = getMaster(); if (!c || !m) return;
	// Clunk
	const noise = c.createBufferSource();
	noise.buffer = noiseBuffer(c, 0.04);
	const nf = c.createBiquadFilter();
	nf.type = 'lowpass'; nf.frequency.value = 600; nf.Q.value = 5;
	const ng = c.createGain();
	ng.gain.setValueAtTime(0.28, c.currentTime);
	ng.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.04);
	noise.connect(nf); nf.connect(ng); ng.connect(m);
	noise.start(c.currentTime); noise.stop(c.currentTime + 0.05);
	// Body resonance
	const osc = c.createOscillator();
	const og = c.createGain();
	osc.type = 'sine'; osc.frequency.value = 200;
	og.gain.setValueAtTime(0.1, c.currentTime);
	og.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.06);
	osc.connect(og); og.connect(m);
	osc.start(c.currentTime); osc.stop(c.currentTime + 0.08);
}

function soundSlotWin() {
	const c = getCtx(), m = getMaster(); if (!c || !m) return;
	[880, 1108, 1320].forEach((freq, i) => {
		const osc = c.createOscillator();
		const g = c.createGain();
		osc.type = 'sine'; osc.frequency.value = freq;
		const t = c.currentTime + i * 0.06;
		g.gain.setValueAtTime(0.16, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
		osc.connect(g); g.connect(m);
		osc.start(t); osc.stop(t + 0.18);
	});
}

// ── Scratch Tickets ─────────────────────────────────────────────────

function soundScratch() {
	const c = getCtx(), m = getMaster(); if (!c || !m) return;
	const noise = c.createBufferSource();
	noise.buffer = noiseBuffer(c, 0.18);
	const filter = c.createBiquadFilter();
	filter.type = 'bandpass'; filter.frequency.value = 3000; filter.Q.value = 0.8;
	const g = c.createGain();
	g.gain.setValueAtTime(0.001, c.currentTime);
	g.gain.linearRampToValueAtTime(0.2, c.currentTime + 0.03);
	g.gain.setValueAtTime(0.2, c.currentTime + 0.10);
	g.gain.linearRampToValueAtTime(0.001, c.currentTime + 0.16);
	noise.connect(filter); filter.connect(g); g.connect(m);
	noise.start(c.currentTime); noise.stop(c.currentTime + 0.18);
}

function soundReveal() {
	const c = getCtx(), m = getMaster(); if (!c || !m) return;
	const osc = c.createOscillator();
	const g = c.createGain();
	osc.type = 'sine'; osc.frequency.value = 1318.5; // E6
	g.gain.setValueAtTime(0.16, c.currentTime);
	g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
	osc.connect(g); g.connect(m);
	osc.start(c.currentTime); osc.stop(c.currentTime + 0.3);
}

// ── Crash ───────────────────────────────────────────────────────────

function soundRiser() {
	const c = getCtx(), m = getMaster(); if (!c || !m) return;
	const osc = c.createOscillator();
	const g = c.createGain();
	osc.type = 'sine';
	osc.frequency.setValueAtTime(220, c.currentTime);
	osc.frequency.exponentialRampToValueAtTime(440, c.currentTime + 0.25);
	g.gain.setValueAtTime(0.06, c.currentTime);
	g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.28);
	osc.connect(g); g.connect(m);
	osc.start(c.currentTime); osc.stop(c.currentTime + 0.3);
}

function soundCrash() {
	const c = getCtx(), m = getMaster(); if (!c || !m) return;
	// Noise burst
	const noise = c.createBufferSource();
	noise.buffer = noiseBuffer(c, 0.1);
	const ng = c.createGain();
	ng.gain.setValueAtTime(0.4, c.currentTime);
	ng.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
	noise.connect(ng); ng.connect(m);
	noise.start(c.currentTime); noise.stop(c.currentTime + 0.1);
	// Low thump
	const osc = c.createOscillator();
	const og = c.createGain();
	osc.type = 'sine';
	osc.frequency.setValueAtTime(80, c.currentTime);
	osc.frequency.exponentialRampToValueAtTime(30, c.currentTime + 0.3);
	og.gain.setValueAtTime(0.35, c.currentTime);
	og.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.35);
	osc.connect(og); og.connect(m);
	osc.start(c.currentTime); osc.stop(c.currentTime + 0.4);
}

function soundCashout() {
	const c = getCtx(), m = getMaster(); if (!c || !m) return;
	// High ping
	const osc1 = c.createOscillator();
	const g1 = c.createGain();
	osc1.type = 'sine'; osc1.frequency.value = 1046.5;
	g1.gain.setValueAtTime(0.16, c.currentTime);
	g1.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
	osc1.connect(g1); g1.connect(m);
	osc1.start(c.currentTime); osc1.stop(c.currentTime + 0.25);
	// Lower follow-up
	const osc2 = c.createOscillator();
	const g2 = c.createGain();
	osc2.type = 'sine'; osc2.frequency.value = 784;
	g2.gain.setValueAtTime(0, c.currentTime + 0.08);
	g2.gain.linearRampToValueAtTime(0.12, c.currentTime + 0.1);
	g2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
	osc2.connect(g2); g2.connect(m);
	osc2.start(c.currentTime + 0.08); osc2.stop(c.currentTime + 0.35);
}

// ── Lottery ─────────────────────────────────────────────────────────

function soundTick() {
	const c = getCtx(), m = getMaster(); if (!c || !m) return;
	const osc = c.createOscillator();
	const g = c.createGain();
	osc.type = 'sine'; osc.frequency.value = 600;
	g.gain.setValueAtTime(0.06, c.currentTime);
	g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.018);
	osc.connect(g); g.connect(m);
	osc.start(c.currentTime); osc.stop(c.currentTime + 0.025);
}

function soundJackpot() {
	const c = getCtx(), m = getMaster(); if (!c || !m) return;
	const freqs = [261.63, 329.63, 392, 523.25, 659.25, 783.99]; // C major arpeggio
	freqs.forEach((freq, i) => {
		const osc = c.createOscillator();
		const g = c.createGain();
		osc.type = 'triangle'; osc.frequency.value = freq;
		const t = c.currentTime + i * 0.07;
		g.gain.setValueAtTime(0, t);
		g.gain.linearRampToValueAtTime(0.18, t + 0.01);
		g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
		osc.connect(g); g.connect(m);
		osc.start(t); osc.stop(t + 0.35);
	});
}

// ── Dispatcher ──────────────────────────────────────────────────────

export type SoundName =
	| 'click' | 'chipDown' | 'win' | 'loss' | 'bust'
	| 'ballSpin' | 'ballLand'
	| 'cardDeal' | 'cardFlip' | 'blackjack' | 'quizCorrect' | 'quizWrong'
	| 'reelSpin' | 'reelStop' | 'slotWin'
	| 'scratch' | 'reveal'
	| 'riser' | 'crash' | 'cashout'
	| 'tick' | 'jackpot';

const SOUNDS: Record<SoundName, () => void> = {
	click: soundClick,
	chipDown: soundChipDown,
	win: soundWin,
	loss: soundLoss,
	bust: soundBust,
	ballSpin: soundBallSpin,
	ballLand: soundBallLand,
	cardDeal: soundCardDeal,
	cardFlip: soundCardFlip,
	blackjack: soundBlackjack,
	quizCorrect: soundQuizCorrect,
	quizWrong: soundQuizWrong,
	reelSpin: soundReelSpin,
	reelStop: soundReelStop,
	slotWin: soundSlotWin,
	scratch: soundScratch,
	reveal: soundReveal,
	riser: soundRiser,
	crash: soundCrash,
	cashout: soundCashout,
	tick: soundTick,
	jackpot: soundJackpot,
};

// ── Haptic Feedback ─────────────────────────────────────────────────
// Vibration patterns paired with sounds. Only fires on devices that support it.
// Pattern values are milliseconds: single number = one pulse, array = vibrate/pause/vibrate...

const HAPTICS: Partial<Record<SoundName, number | number[]>> = {
	click: 3,
	chipDown: 10,
	win: 15,
	loss: 20,
	bust: [30, 40, 50],
	ballLand: 8,
	cardDeal: 5,
	blackjack: [10, 30, 10, 30, 15],
	quizCorrect: 8,
	quizWrong: [15, 20, 15],
	reelStop: 12,
	slotWin: [8, 20, 8, 20, 12],
	scratch: 6,
	reveal: 10,
	crash: [40, 20, 60],
	cashout: [8, 30, 12],
	jackpot: [10, 20, 10, 20, 10, 20, 15],
};

function vibrate(pattern: number | number[]) {
	try {
		if (typeof navigator !== 'undefined' && navigator.vibrate) {
			// Skip haptics when user prefers reduced motion
			if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
			navigator.vibrate(pattern);
		}
	} catch {}
}

export function play(name: SoundName): void {
	if (_muted) return;
	try {
		SOUNDS[name]();
	} catch {
		// Audio errors must never break the app
	}
	const h = HAPTICS[name];
	if (h) vibrate(h);
}

// ── Init from localStorage ──────────────────────────────────────────

if (typeof localStorage !== 'undefined') {
	try {
		const v = localStorage.getItem('haw_vol');
		if (v !== null) _volume = parseFloat(v);
		const m = localStorage.getItem('haw_mute');
		if (m !== null) _muted = m === '1';
	} catch {}
}
