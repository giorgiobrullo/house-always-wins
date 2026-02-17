<script lang="ts">
	import { onDestroy } from 'svelte';
	import { inview } from '$lib/utils/intersection';
	import { update as updateStats } from '$lib/stores/simStats.svelte';
	import { crashPoint, simulateCrashSession } from '$lib/utils/random';
	import { money } from '$lib/utils/format';
	import { play } from '$lib/utils/audio';
	import { countTo } from '$lib/utils/effects';
	import IconRefresh from '@tabler/icons-svelte/icons/refresh';
	import IconPlayerPlay from '@tabler/icons-svelte/icons/player-play';
	import IconFastForward from '@tabler/icons-svelte/icons/player-track-next';

	const BET = 5;
	const START = 100;

	// --- Strategy table (static, pre-computed math) ---
	const STRATEGIES = [
		{ label: 'Safe',       target: 1.1,  name: '1.1×' },
		{ label: 'Low',        target: 1.5,  name: '1.5×' },
		{ label: 'Medium',     target: 2.0,  name: '2.0×' },
		{ label: 'High',       target: 5.0,  name: '5.0×' },
		{ label: 'Moon',       target: 20.0, name: '20×' },
	].map(s => {
		const winProb = Math.min(0.96 / s.target, 1);
		const ev = winProb * (s.target - 1) - (1 - winProb); // per $1 bet
		return { ...s, winProb, ev };
	});

	// --- Strategy comparison sim ---
	type StratResult = { target: number; name: string; avgFinal: number; busts: number; wins: number };
	let stratResults: StratResult[] | null = $state(null);

	function runStrategyComparison() {
		play('click');
		const SESSIONS = 1000;
		const ROUNDS = 500;
		stratResults = STRATEGIES.map(s => {
			let totalFinal = 0, busts = 0, wins = 0;
			for (let i = 0; i < SESSIONS; i++) {
				const balances = simulateCrashSession(START, BET, s.target, ROUNDS);
				const final_ = balances.length > 0 ? balances[balances.length - 1] : START;
				totalFinal += final_;
				if (final_ < BET) busts++;
				if (final_ > START) wins++;
			}
			return { target: s.target, name: s.name, avgFinal: totalFinal / SESSIONS, busts, wins };
		});
	}

	// --- Interactive sim state ---
	let cashoutTarget = $state(2.0);
	let balance = $state(START);
	let history: number[] = $state([START]);
	let running = $state(false);
	let crashed = $state(false);
	let cashedOut = $state(false);
	let currentMultiplier = $state(1.0);
	let crashMultiplier = $state(0);
	let totalRounds = $state(0);
	let curvePoints: { x: number; y: number }[] = $state([]);
	let recentCrashes: { value: number; won: boolean }[] = $state([]);

	// Lifetime
	let lifetimeSessions = $state(0);
	let lifetimeRounds = $state(0);
	let lifetimeWagered = $state(0);
	let lifetimeNet = $state(0);
	let lifetimeSessionsUp = $state(0);
	let lifetimeCashouts = $state(0);
	let lifetimeBestCashout = $state(0);

	// Visual effects state
	let shaking = $state(false);
	let animating = $state(false);
	let animatedBalance = $state(START);

	function triggerShake() {
		shaking = true;
		setTimeout(() => { shaking = false; }, 500);
	}

	let animInterval: ReturnType<typeof setInterval> | null = null;
	let riserTicks = 0;
	const RISER_EVERY = 17; // ~500ms at 30ms tick

	onDestroy(() => {
		if (animInterval) clearInterval(animInterval);
	});

	function startRound() {
		if (running || balance < BET) return;
		running = true;
		crashed = false;
		cashedOut = false;
		currentMultiplier = 1.0;
		curvePoints = [{ x: 0, y: 1.0 }];
		riserTicks = 0;
		play('chipDown');

		const target = crashPoint();
		crashMultiplier = target;

		let elapsed = 0;
		const TICK = 30;
		const SPEED = 0.03;

		animInterval = setInterval(() => {
			elapsed++;
			riserTicks++;
			if (riserTicks % RISER_EVERY === 0) play('riser');
			currentMultiplier = 1 + (elapsed * SPEED) * (1 + elapsed * 0.002);
			currentMultiplier = Math.floor(currentMultiplier * 100) / 100;
			curvePoints = [...curvePoints, { x: elapsed, y: currentMultiplier }];

			if (currentMultiplier >= target) {
				currentMultiplier = target;
				crashed = true;
				running = false;
				balance -= BET;
				balance = Math.round(balance * 100) / 100;
				totalRounds++;
				lifetimeRounds++;
				lifetimeWagered += BET;
				history = [...history, balance];
				recentCrashes = [{ value: target, won: false }, ...recentCrashes.slice(0, 19)];
				if (balance < BET) { play('bust'); triggerShake(); } else play('crash');
				if (animInterval) clearInterval(animInterval);
				animInterval = null;
			}
		}, TICK);
	}

	function cashOut() {
		if (!running || crashed || cashedOut) return;
		cashedOut = true;
		running = false;
		lifetimeCashouts++;
		if (currentMultiplier > lifetimeBestCashout) lifetimeBestCashout = currentMultiplier;
		play('cashout');
		const winnings = BET * (currentMultiplier - 1);
		balance += winnings;
		balance = Math.round(balance * 100) / 100;
		totalRounds++;
		lifetimeRounds++;
		lifetimeWagered += BET;
		history = [...history, balance];
		recentCrashes = [{ value: crashMultiplier, won: true }, ...recentCrashes.slice(0, 19)];
		if (animInterval) clearInterval(animInterval);
		animInterval = null;
	}

	function autoPlay() {
		if (running || balance < BET) return;
		running = true;
		crashed = false;
		cashedOut = false;
		currentMultiplier = 1.0;
		curvePoints = [{ x: 0, y: 1.0 }];
		riserTicks = 0;
		play('chipDown');

		const target = crashPoint();
		crashMultiplier = target;

		let elapsed = 0;
		const TICK = 30;
		const SPEED = 0.03;

		animInterval = setInterval(() => {
			elapsed++;
			riserTicks++;
			if (riserTicks % RISER_EVERY === 0) play('riser');
			currentMultiplier = 1 + (elapsed * SPEED) * (1 + elapsed * 0.002);
			currentMultiplier = Math.floor(currentMultiplier * 100) / 100;
			curvePoints = [...curvePoints, { x: elapsed, y: currentMultiplier }];

			// Auto-cashout: hit the target before crash
			if (!crashed && currentMultiplier >= cashoutTarget && cashoutTarget <= target) {
				currentMultiplier = cashoutTarget;
				cashedOut = true;
				running = false;
				play('cashout');
				const winnings = BET * (cashoutTarget - 1);
				balance += winnings;
				balance = Math.round(balance * 100) / 100;
				totalRounds++;
				lifetimeRounds++;
				lifetimeWagered += BET;
				lifetimeCashouts++;
				if (cashoutTarget > lifetimeBestCashout) lifetimeBestCashout = cashoutTarget;
				history = [...history, balance];
				recentCrashes = [{ value: target, won: true }, ...recentCrashes.slice(0, 19)];
				if (animInterval) clearInterval(animInterval);
				animInterval = null;
				return;
			}

			// Crashed before reaching cashout
			if (currentMultiplier >= target) {
				currentMultiplier = target;
				crashed = true;
				running = false;
				balance -= BET;
				balance = Math.round(balance * 100) / 100;
				totalRounds++;
				lifetimeRounds++;
				lifetimeWagered += BET;
				history = [...history, balance];
				recentCrashes = [{ value: target, won: false }, ...recentCrashes.slice(0, 19)];
				if (balance < BET) { play('bust'); triggerShake(); } else play('crash');
				if (animInterval) clearInterval(animInterval);
				animInterval = null;
			}
		}, TICK);
	}

	function runN(n: number) {
		if (running) return;
		running = true;
		play('chipDown');
		let i = 0;
		const interval = setInterval(() => {
			if (i >= n || balance < BET) {
				clearInterval(interval);
				running = false;
				return;
			}
			const crash = crashPoint();
			if (crash >= cashoutTarget) {
				balance += BET * (cashoutTarget - 1);
				lifetimeCashouts++;
				if (cashoutTarget > lifetimeBestCashout) lifetimeBestCashout = cashoutTarget;
			} else {
				balance -= BET;
			}
			balance = Math.round(balance * 100) / 100;
			totalRounds++;
			lifetimeRounds++;
			lifetimeWagered += BET;
			history = [...history, balance];
			recentCrashes = [{ value: crash, won: crash >= cashoutTarget }, ...recentCrashes.slice(0, 19)];
			i++;
		}, 20);
	}

	function instantN(n: number) {
		if (running) return;
		play('chipDown');
		const oldBalance = balance;
		const balances = simulateCrashSession(balance, BET, cashoutTarget, n);
		let instantCashouts = 0;
		for (let i = 0; i < balances.length; i++) {
			totalRounds++;
			lifetimeRounds++;
			lifetimeWagered += BET;
			const prevBal = i === 0 ? oldBalance : balances[i - 1];
			if (balances[i] > prevBal) {
				instantCashouts++;
			}
		}
		lifetimeCashouts += instantCashouts;
		if (cashoutTarget > lifetimeBestCashout && instantCashouts > 0) lifetimeBestCashout = cashoutTarget;
		if (balances.length > 0) {
			balance = balances[balances.length - 1];
		}
		history = [...history, ...balances];
		curvePoints = [];
		crashed = false;
		cashedOut = false;
		// Animate balance count-up
		animating = true;
		animatedBalance = oldBalance;
		countTo(oldBalance, balance, 600, (v) => { animatedBalance = v; }, () => { animating = false; });
		if (balance < BET) triggerShake();
	}

	function newSession() {
		play('click');
		const sessionNet = balance - START;
		lifetimeNet += sessionNet;
		lifetimeSessions++;
		if (sessionNet > 0) lifetimeSessionsUp++;

		balance = START;
		history = [START];
		totalRounds = 0;
		running = false;
		crashed = false;
		cashedOut = false;
		currentMultiplier = 1.0;
		curvePoints = [];
		recentCrashes = [];
	}

	function resetAll() {
		play('click');
		balance = START;
		history = [START];
		totalRounds = 0;
		running = false;
		crashed = false;
		cashedOut = false;
		currentMultiplier = 1.0;
		curvePoints = [];
		recentCrashes = [];
		lifetimeSessions = 0;
		lifetimeRounds = 0;
		lifetimeWagered = 0;
		lifetimeNet = 0;
		lifetimeSessionsUp = 0;
		lifetimeCashouts = 0;
		lifetimeBestCashout = 0;
		if (animInterval) clearInterval(animInterval);
		animInterval = null;
	}

	let pl = $derived(balance - START);
	let isUp = $derived(pl > 0);
	let isBroke = $derived(balance < BET);

	let winProb = $derived(Math.min(0.96 / cashoutTarget, 1));
	let evPerBet = $derived(BET * (winProb * (cashoutTarget - 1) - (1 - winProb)));

	let commentary = $derived.by(() => {
		if (isBroke) return "Bust. " + cashoutTarget.toFixed(1) + "x didn't save you. Neither would any other target.";
		if (totalRounds < 5) return null;
		if (isUp) {
			if (pl > 30) return "Up " + money(pl) + " at " + cashoutTarget.toFixed(1) + "x. Switch to 1.1x? Same EV. Switch to 10x? Same EV.";
			return "Ahead at " + cashoutTarget.toFixed(1) + "x. The payout adjusts to offset the probability. The margin doesn't.";
		}
		if (pl === 0) return "Flat. Change your target. The EV doesn't move.";
		if (pl > -20) return "Drifting negative. The 4% is in the crash distribution, not your timing.";
		if (pl > -50) return money(Math.abs(pl)) + " behind at " + cashoutTarget.toFixed(1) + "x. Pick any other target. Run it. Same trajectory.";
		return "Down " + money(Math.abs(pl)) + " after " + totalRounds + " rounds. No cashout target changes the 4%.";
	});

	// Crash curve SVG
	let curvePath = $derived.by(() => {
		if (curvePoints.length < 2) return '';
		const maxX = curvePoints[curvePoints.length - 1].x || 1;
		const maxY = Math.max(2, ...curvePoints.map(p => p.y)) * 1.1;
		return curvePoints
			.map((p, i) => {
				const x = (p.x / maxX) * 100;
				const y = 100 - ((p.y - 1) / (maxY - 1)) * 90;
				return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	});

	// Balance history chart
	let chartPath = $derived.by(() => {
		if (history.length < 2) return '';
		const max = Math.max(START + 30, ...history);
		const min = Math.min(0, ...history);
		const range = max - min || 1;
		const step = Math.max(1, Math.floor(history.length / 800));
		const pts: string[] = [];
		for (let i = 0; i < history.length; i += step) {
			const x = (i / (history.length - 1)) * 100;
			const y = 100 - ((history[i] - min) / range) * 100;
			pts.push(`${pts.length === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
		}
		if (history.length > 1) {
			const x = 100;
			const y = 100 - ((history[history.length - 1] - min) / range) * 100;
			pts.push(`L${x.toFixed(1)},${y.toFixed(1)}`);
		}
		return pts.join(' ');
	});

	let startLineY = $derived.by(() => {
		if (history.length < 2) return 50;
		const max = Math.max(START + 30, ...history);
		const min = Math.min(0, ...history);
		const range = max - min || 1;
		return 100 - ((START - min) / range) * 100;
	});

	let evPath = $derived.by(() => {
		if (history.length < 2) return '';
		const max = Math.max(START + 30, ...history);
		const min = Math.min(0, ...history);
		const range = max - min || 1;
		const lossPerRound = Math.abs(evPerBet);
		const totalPts = history.length - 1;
		const toY = (bal: number) => 100 - ((bal - min) / range) * 100;

		const zeroRound = START / lossPerRound;
		if (totalPts <= zeroRound) {
			const endBal = START - lossPerRound * totalPts;
			return `M0,${toY(START)} L100,${toY(endBal)}`;
		} else {
			const zeroX = (zeroRound / totalPts) * 100;
			const zeroY = toY(0);
			return `M0,${toY(START)} L${zeroX},${zeroY} L100,${zeroY}`;
		}
	});

	$effect(() => {
		if (lifetimeRounds === 0 && totalRounds === 0) return;
		updateStats('crash', {
			wagered: lifetimeWagered,
			net: lifetimeNet + pl,
			rounds: lifetimeRounds,
		});
	});
</script>

<section class="px-5 py-16 md:px-10 md:py-24">
	<div class="max-w-4xl">
		<div use:inview class="fade-up">
			<h2 class="font-headline text-4xl md:text-6xl mb-2">CRASH</h2>
			<p class="text-muted text-sm uppercase tracking-widest mb-8">
				Every cashout strategy loses. Pick one and watch.
			</p>
		</div>

		<div use:inview class="fade-up max-w-2xl mb-8">
			<p class="text-base md:text-lg leading-relaxed mb-4">
				A multiplier starts at <strong class="font-mono">1.00×</strong> and climbs until
				it crashes at a random point. Cash out before the crash and you win your bet times
				the multiplier. Miss it and you lose. The crash point is drawn from a distribution
				that skims <strong class="font-mono text-loss">4%</strong> off every round.
				About 4% of rounds crash instantly at 1.00×, and when they do no one can cash out.
			</p>
			<p class="text-base md:text-lg leading-relaxed">
				Players convince themselves the edge is in the strategy: cash out early for safe
				small wins, or wait for big multipliers. At 1.5× you win often but win small,
				and at 10× you win big but rarely. The expected loss per dollar
				is <strong class="font-mono text-loss">~4%</strong> regardless.
			</p>
		</div>

		<!-- Strategy math table (static) -->
		<div use:inview class="fade-up sim-box mb-6">
			<div class="text-xs uppercase tracking-widest text-muted mb-5">
				Five strategies, same edge / $5 bet
			</div>

			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border text-left">
							<th class="pb-2 pr-4 text-xs uppercase tracking-wide text-muted font-normal">Strategy</th>
							<th class="pb-2 pr-4 text-xs uppercase tracking-wide text-muted font-normal">Target</th>
							<th class="pb-2 pr-4 text-xs uppercase tracking-wide text-muted font-normal">Win rate</th>
							<th class="pb-2 pr-4 text-xs uppercase tracking-wide text-muted font-normal">Win payout</th>
							<th class="pb-2 text-xs uppercase tracking-wide text-muted font-normal">EV / bet</th>
						</tr>
					</thead>
					<tbody>
						{#each STRATEGIES as s}
							<tr class="border-b border-border/50">
								<td class="py-2 pr-4 text-muted">{s.label}</td>
								<td class="py-2 pr-4 font-mono font-bold">{s.name}</td>
								<td class="py-2 pr-4 font-mono">{(s.winProb * 100).toFixed(1)}%</td>
								<td class="py-2 pr-4 font-mono">+{money(BET * (s.target - 1))}</td>
								<td class="py-2 font-mono font-bold text-loss">{money(BET * s.ev)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<p class="text-sm text-muted mt-4">
				The last column doesn't change. The payout adjusts to offset the probability.
				The margin doesn't.
			</p>
		</div>

		<!-- Strategy comparison sim -->
		<div use:inview class="fade-up sim-box mb-6">
			{#if !stratResults}
				<div class="text-xs uppercase tracking-widest text-muted mb-3">
					Theory vs. reality
				</div>
				<p class="text-sm mb-4 max-w-lg">
					Run 1,000 players on each strategy. $100 start, $5 bets, 500 rounds.
					All five strategies. Same house edge.
				</p>
				<button onclick={runStrategyComparison} class="strat-btn-primary">
					RUN ALL FIVE
				</button>
			{:else}
				<div class="text-xs uppercase tracking-widest text-muted mb-5">
					1,000 players × 5 strategies / $100 start / 500 rounds
				</div>

				<div class="space-y-3 mb-5">
					{#each stratResults as s}
						{@const loss = START - s.avgFinal}
						{@const barWidth = Math.max(3, (loss / START) * 100)}
						<div class="flex items-center gap-3">
							<div class="w-10 shrink-0 font-mono text-xs font-bold">{s.name}</div>
							<div class="flex-1 relative h-5">
								<div
									class="h-full bg-loss"
									style="width: {barWidth}%; opacity: 0.4"
								></div>
							</div>
							<div class="w-16 shrink-0 text-right font-mono text-sm font-bold text-loss">
								{money(s.avgFinal)}
							</div>
							<div class="w-20 shrink-0 text-right font-mono text-xs text-muted">
								{s.busts} broke
							</div>
						</div>
					{/each}
				</div>

				<p class="text-sm text-muted mb-4">
					Average final balance out of $100, across 1,000 players each.
					The house edge is 4% per round regardless of cashout target. Low multipliers
					grind down slowly: fewer go broke, but survivors have almost nothing left.
					High multipliers kill faster: more go broke, but rare big wins inflate
					the average. Different risk profiles, same negative edge.
				</p>

				<button onclick={runStrategyComparison} class="strat-btn">
					RUN AGAIN
				</button>
			{/if}
		</div>

		<!-- Interactive sim -->
		<div use:inview class="fade-up crash-box" class:shake={shaking} class:flash-red={shaking}>
			<div class="flex items-center justify-between mb-5">
				<div class="text-xs uppercase tracking-widest text-[#8aa]">Pick a strategy. Play it out.</div>
				<div class="flex items-center gap-2">
					<button onclick={newSession} class="text-xs text-[#8aa] hover:text-[#4aeab0] transition-colors underline">New session</button>
					<button onclick={resetAll} class="text-[#8aa] hover:text-[#4aeab0] transition-colors" aria-label="Reset all">
						<IconRefresh size={16} />
					</button>
				</div>
			</div>

			<!-- Cashout target -->
			<div class="flex items-center gap-3 mb-5">
				<label class="text-xs text-[#8aa] uppercase tracking-wide">Cashout</label>
				<div class="flex items-center gap-1">
					{#each [1.1, 1.5, 2.0, 3.0, 5.0, 10.0] as target}
						<button
							onclick={() => { if (!running) { play('click'); cashoutTarget = target; } }}
							class="crash-target-btn"
							class:active={cashoutTarget === target}
							disabled={running}
						>
							{target}×
						</button>
					{/each}
				</div>
			</div>

			<!-- Crash curve -->
			{#if curvePoints.length > 1 || crashed || cashedOut}
				<div class="w-full h-32 md:h-40 border border-[#1a3a3a] mb-3 bg-[#0a1a1a] relative overflow-hidden">
					<div class="absolute inset-0 flex items-center justify-center">
						<div class="font-mono text-4xl md:text-5xl font-bold transition-colors"
							class:text-[#ff4444]={crashed}
							class:text-[#4aeab0]={cashedOut}
							class:text-[#ddd]={!crashed && !cashedOut && running}>
							{#if crashed}
								CRASHED
							{:else if cashedOut}
								{currentMultiplier.toFixed(2)}×
							{:else if running}
								{currentMultiplier.toFixed(2)}×
							{/if}
						</div>
					</div>
					{#if curvePath}
						<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="w-full h-full relative z-0">
							<path d={curvePath} fill="none"
								stroke={crashed ? '#ff4444' : '#4aeab0'}
								stroke-width="2" vector-effect="non-scaling-stroke"
								stroke-opacity={crashed ? 0.5 : 0.8} />
						</svg>
					{/if}
				</div>
			{/if}

			<!-- Recent crashes -->
			{#if recentCrashes.length > 0}
				<div class="flex flex-wrap gap-1.5 mb-5">
					{#each recentCrashes.slice(0, 12) as c, i}
						<span class="font-mono text-xs px-1.5 py-0.5 rounded"
							class:crash-loss={!c.won}
							class:crash-win={c.won}
							style:opacity={1 - i * 0.05}>
							{c.value.toFixed(2)}×
						</span>
					{/each}
				</div>
			{/if}

			<!-- Stats -->
			<div class="flex flex-wrap items-center gap-6 mb-5">
				<div>
					<div class="text-xs text-[#8aa] uppercase tracking-wide">Balance</div>
					<div class="font-mono text-2xl font-bold"
						class:text-[#4aeab0]={isUp}
						class:text-[#ff6666]={!isUp && totalRounds > 0}>
						{money(animating ? animatedBalance : balance)}
					</div>
				</div>
				<div>
					<div class="text-xs text-[#8aa] uppercase tracking-wide">Rounds</div>
					<div class="font-mono text-2xl font-bold text-[#ddd]">{totalRounds}</div>
				</div>
				<div>
					<div class="text-xs text-[#8aa] uppercase tracking-wide">P/L</div>
					<div class="font-mono text-2xl font-bold"
						class:text-[#ff6666]={pl < 0}
						class:text-[#4aeab0]={pl > 0}
						class:text-[#ddd]={pl === 0}>
						{pl >= 0 ? '+' : ''}{money(pl)}
					</div>
				</div>
				<div>
					<div class="text-xs text-[#8aa] uppercase tracking-wide">Target</div>
					<div class="font-mono text-2xl font-bold text-[#4aeab0]">
						{cashoutTarget.toFixed(2)}×
					</div>
				</div>
			</div>

			<!-- Controls -->
			<div class="flex flex-wrap gap-2 mb-5">
				{#if !running}
					<button onclick={startRound} disabled={isBroke}
						class="crash-btn-primary" title="Start round">
						<IconPlayerPlay size={16} />
						<span>PLAY</span>
					</button>
				{/if}
				{#if running && !crashed && !cashedOut}
					<button onclick={cashOut}
						class="crash-btn-cashout">
						CASH OUT @ {currentMultiplier.toFixed(2)}×
					</button>
				{/if}
				<button onclick={autoPlay} disabled={running || isBroke}
					class="crash-btn" title="Instant round at target">
					AUTO
				</button>
				<button onclick={() => runN(50)} disabled={running || isBroke}
					class="crash-btn">
					50
				</button>
				<button onclick={() => runN(200)} disabled={running || isBroke}
					class="crash-btn">
					200
				</button>
				<button onclick={() => instantN(1000)} disabled={running || isBroke}
					class="crash-btn" title="Instant 1,000 rounds">
					<IconFastForward size={14} />
					<span>1K</span>
				</button>
				<button onclick={() => instantN(10000)} disabled={running || isBroke}
					class="crash-btn" title="Instant 10,000 rounds">
					<IconFastForward size={14} />
					<span>10K</span>
				</button>
			</div>

			<!-- Commentary -->
			{#if commentary}
				<div class="text-sm mb-5 py-2 border-l-2 pl-3 transition-all duration-300"
					class:border-[#ff6666]={!isUp || isBroke}
					class:text-[#ff6666]={!isUp || isBroke}
					class:border-[#4aeab0]={isUp && !isBroke}
					class:text-[#4aeab0]={isUp && !isBroke}
				>
					{commentary}
				</div>
			{/if}

			<!-- Balance chart -->
			{#if history.length > 2}
				<div class="w-full h-36 md:h-48 border border-[#1a3a3a] mb-1 bg-[#0a1a1a]">
					<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="w-full h-full">
						<line x1="0" y1={startLineY} x2="100" y2={startLineY}
							stroke="#1a3a3a" stroke-width="0.5" stroke-dasharray="2,2" />
						<path d={evPath} fill="none" stroke="#4a8a7a" stroke-width="0.5"
							stroke-dasharray="1.5,1.5" vector-effect="non-scaling-stroke" />
						<path d={chartPath} fill="none"
							stroke={pl < 0 ? '#ff6666' : '#4aeab0'}
							stroke-width="1.2" vector-effect="non-scaling-stroke" />
					</svg>
				</div>
				<div class="flex justify-between text-xs text-[#8aa] mb-5">
					<span>Round 1</span>
					<span class="font-mono opacity-60">dashed = expected value</span>
					<span>Round {history.length - 1}</span>
				</div>
			{/if}

			<!-- Lifetime -->
			{#if lifetimeSessions > 0}
				<div class="border-t border-[#1a3a3a] pt-4 mt-2">
					<div class="text-xs uppercase tracking-widest text-[#8aa] mb-3">Lifetime (across {lifetimeSessions} session{lifetimeSessions === 1 ? '' : 's'})</div>
					<div class="flex flex-wrap gap-6 text-sm text-[#bcc]">
						<div>
							<span class="text-[#8aa]">Rounds:</span>
							<span class="font-mono font-bold ml-1">{lifetimeRounds}</span>
						</div>
						<div>
							<span class="text-[#8aa]">Best cashout:</span>
							<span class="font-mono font-bold ml-1">{lifetimeBestCashout > 0 ? lifetimeBestCashout.toFixed(2) + '×' : '—'}</span>
						</div>
						<div>
							<span class="text-[#8aa]">Net:</span>
							<span class="font-mono font-bold ml-1"
								class:text-[#ff6666]={lifetimeNet < 0}
								class:text-[#4aeab0]={lifetimeNet > 0}>
								{lifetimeNet >= 0 ? '+' : ''}{money(lifetimeNet)}
							</span>
						</div>
						<div>
							<span class="text-[#8aa]">Win rate:</span>
							<span class="font-mono font-bold ml-1">{lifetimeRounds > 0 ? (lifetimeCashouts / lifetimeRounds * 100).toFixed(1) + '%' : '—'}</span>
						</div>
					</div>
				</div>
			{/if}

			{#if isBroke}
				<div class="mt-5 text-[#ff4444] font-headline text-xl">
					YOU'RE BROKE. STRATEGY DIDN'T HELP.
				</div>
			{/if}
		</div>

		<!-- Closing line -->
		<div use:inview class="fade-up mt-10 pl-6 border-l-3 border-loss">
			<p class="font-headline text-xl md:text-2xl leading-tight">
				THERE IS NO OPTIMAL CASHOUT.<br/>
				THE HOUSE EDGE IS IN THE CRASH POINT, NOT YOUR TIMING.
			</p>
		</div>
	</div>
</section>

<hr class="divider" />

<style>
	.fade-up {
		opacity: 0;
		transform: translateY(20px);
		transition: opacity 0.6s ease, transform 0.6s ease;
	}
	:global(.in-view).fade-up, .fade-up:global(.in-view) {
		opacity: 1;
		transform: translateY(0);
	}

	/* Strategy comparison buttons (cream/light theme, matching sim-box) */
	.strat-btn, .strat-btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.5rem 1.25rem;
		font-family: var(--font-headline);
		font-size: 0.875rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		transition: all 150ms;
		line-height: 0.95;
	}
	.strat-btn {
		border: 1px solid var(--color-border);
		color: var(--color-ink);
		background: transparent;
	}
	.strat-btn:hover:not(:disabled) {
		background: var(--color-ink);
		color: var(--color-cream);
	}
	.strat-btn-primary {
		background: var(--color-ink);
		color: var(--color-cream);
		border: 1px solid var(--color-ink);
	}
	.strat-btn-primary:hover:not(:disabled) {
		background: #333;
	}

	/* Dark terminal / crypto theme for interactive sim */
	.crash-box {
		background: #0d1f1f;
		border: 1px solid #1a3a3a;
		padding: 1.25rem;
		color: #ddd;
	}
	@media (min-width: 768px) {
		.crash-box { padding: 1.75rem; }
	}

	.crash-btn, .crash-btn-primary, .crash-btn-cashout {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.5rem 1.25rem;
		font-family: var(--font-headline);
		font-size: 0.875rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		transition: all 150ms;
		line-height: 0.95;
		border-radius: 999px;
	}
	.crash-btn {
		border: 1px solid #2a5a5a;
		color: #8aa;
		background: transparent;
	}
	.crash-btn:hover:not(:disabled) {
		background: #1a3a3a;
		border-color: #4aeab0;
		color: #4aeab0;
	}
	.crash-btn-primary {
		background: linear-gradient(135deg, #4aeab0, #2ab880);
		color: #0a1a1a;
		border: none;
		font-weight: 600;
	}
	.crash-btn-primary:hover:not(:disabled) {
		background: linear-gradient(135deg, #5ff5c0, #35c890);
	}
	.crash-btn-cashout {
		background: linear-gradient(135deg, #4aeab0, #2ab880);
		color: #0a1a1a;
		border: none;
		font-weight: 600;
		animation: pulse-glow 0.6s ease-in-out infinite alternate;
	}
	.crash-btn:disabled, .crash-btn-primary:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.crash-target-btn {
		padding: 0.25rem 0.6rem;
		font-family: monospace;
		font-size: 0.75rem;
		border: 1px solid #2a5a5a;
		color: #8aa;
		background: transparent;
		border-radius: 4px;
		transition: all 150ms;
	}
	.crash-target-btn:hover:not(:disabled) {
		border-color: #4aeab0;
		color: #4aeab0;
	}
	.crash-target-btn.active {
		background: #4aeab0;
		color: #0a1a1a;
		border-color: #4aeab0;
		font-weight: 700;
	}
	.crash-target-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.crash-loss {
		background: rgba(255, 68, 68, 0.2);
		color: #ff6666;
	}
	.crash-win {
		background: rgba(74, 234, 176, 0.15);
		color: #4aeab0;
	}

	@keyframes pulse-glow {
		from { box-shadow: 0 0 4px #4aeab066; }
		to { box-shadow: 0 0 16px #4aeab066; }
	}
</style>
