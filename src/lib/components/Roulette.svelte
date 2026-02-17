<script lang="ts">
	import { inview } from '$lib/utils/intersection';
	import { update as updateStats } from '$lib/stores/simStats.svelte';
	import { spinRoulette, isRed, simulateRouletteSession } from '$lib/utils/random';
	import { money } from '$lib/utils/format';
	import { play } from '$lib/utils/audio';
	import { countTo } from '$lib/utils/effects';
	import IconRefresh from '@tabler/icons-svelte/icons/refresh';
	import IconPlayerPlay from '@tabler/icons-svelte/icons/player-play';
	import IconFastForward from '@tabler/icons-svelte/icons/player-track-next';

	const BET = 5;
	const START = 100;

	let balance = $state(START);
	let history: number[] = $state([START]);
	let spinning = $state(false);
	let lastResult: { number: number; color: string } | null = $state(null);
	let totalSpins = $state(0);

	// Visual effects state
	let shaking = $state(false);
	let animating = $state(false);
	let animatedBalance = $state(START);
	let singleSpin = $state(false);

	function triggerShake() {
		shaking = true;
		setTimeout(() => { shaking = false; }, 500);
	}

	// Lifetime stats (persist across resets)
	let lifetimeSessions = $state(0);
	let lifetimeSpins = $state(0);
	let lifetimeWagered = $state(0);
	let lifetimeNet = $state(0);
	let lifetimeSessionsUp = $state(0);

	// Multi-session results
	let multiResult: { wins: number; losses: number; busts: number; avgFinal: number } | null = $state(null);
	let sessionHistories: number[][] = $state([]);

	// 100 ghost players running the same game alongside you
	const GHOST_COUNT = 100;
	let ghostBalances: number[] = $state(Array.from({ length: GHOST_COUNT }, () => START));
	let ghostsBust = $derived(ghostBalances.filter(b => b < BET).length);
	let sortedAllPlayers = $derived(
		[...ghostBalances.map(b => ({ b, you: false })), { b: balance, you: true }]
			.sort((a, b) => b.b - a.b)
			.map(p => ({ alive: p.b >= BET, you: p.you }))
	);

	function ghostSpin() {
		for (let g = 0; g < GHOST_COUNT; g++) {
			if (ghostBalances[g] < BET) continue;
			const result = spinRoulette(true);
			if (isRed(result)) ghostBalances[g] += BET;
			else ghostBalances[g] -= BET;
		}
		ghostBalances = [...ghostBalances];
	}

	function ghostBulk(n: number) {
		for (let g = 0; g < GHOST_COUNT; g++) {
			for (let i = 0; i < n; i++) {
				if (ghostBalances[g] < BET) break;
				const result = spinRoulette(true);
				if (isRed(result)) ghostBalances[g] += BET;
				else ghostBalances[g] -= BET;
			}
		}
		ghostBalances = [...ghostBalances];
	}

	function resetGhosts() {
		ghostBalances = Array.from({ length: GHOST_COUNT }, () => START);
	}

	function doSpin() {
		const result = spinRoulette(true);
		const red = isRed(result);
		const color = result === 0 || result === 37 ? 'green' : red ? 'red' : 'black';
		if (red) { balance += BET; play('win'); }
		else { balance -= BET; if (balance < BET) { play('bust'); triggerShake(); } else play('loss'); }
		lastResult = { number: result === 37 ? -1 : result, color };
		totalSpins++;
		lifetimeSpins++;
		lifetimeWagered += BET;
		history = [...history, balance];
		ghostSpin();
	}

	function spin() {
		if (spinning || balance < BET) return;
		spinning = true;
		singleSpin = true;
		play('ballSpin');
		setTimeout(() => {
			play('ballLand');
			doSpin();
			spinning = false;
			singleSpin = false;
		}, 500);
	}

	function runN(n: number) {
		if (spinning) return;
		spinning = true;
		play('chipDown');
		let i = 0;
		const interval = setInterval(() => {
			if (i >= n || balance < BET) {
				clearInterval(interval);
				spinning = false;
				return;
			}
			doSpin();
			i++;
		}, 20);
	}

	function instantN(n: number) {
		if (spinning) return;
		play('chipDown');
		const oldBalance = balance;
		const balances = simulateRouletteSession(balance, BET, n);
		for (const b of balances) {
			totalSpins++;
			lifetimeSpins++;
			lifetimeWagered += BET;
		}
		if (balances.length > 0) {
			balance = balances[balances.length - 1];
			lastResult = null;
		}
		history = [...history, ...balances];
		ghostBulk(n);
		// Animate balance count-up
		animating = true;
		animatedBalance = oldBalance;
		countTo(oldBalance, balance, 600, (v) => { animatedBalance = v; }, () => { animating = false; });
		if (balance < BET) triggerShake();
	}

	function runMultiSession() {
		const TOTAL = 1000;
		const CHARTED = 100;
		const SPINS = 1000;
		const histories: number[][] = [];
		let wins = 0, losses = 0, busts = 0, totalFinal = 0;
		for (let s = 0; s < TOTAL; s++) {
			const balances = simulateRouletteSession(START, BET, SPINS);
			const final_ = balances.length > 0 ? balances[balances.length - 1] : START;
			if (s < CHARTED) histories.push([START, ...balances]);
			if (final_ > START) wins++;
			else if (final_ < BET) busts++;
			else losses++;
			totalFinal += final_;
		}
		multiResult = { wins, losses, busts, avgFinal: totalFinal / TOTAL };
		sessionHistories = histories;
	}

	function newSession() {
		const sessionNet = balance - START;
		lifetimeNet += sessionNet;
		lifetimeSessions++;
		if (sessionNet > 0) lifetimeSessionsUp++;

		balance = START;
		history = [START];
		lastResult = null;
		totalSpins = 0;
		spinning = false;
		resetGhosts();
	}

	function resetAll() {
		balance = START;
		history = [START];
		lastResult = null;
		totalSpins = 0;
		spinning = false;
		lifetimeSessions = 0;
		lifetimeSpins = 0;
		lifetimeWagered = 0;
		lifetimeNet = 0;
		lifetimeSessionsUp = 0;
		multiResult = null;
		sessionHistories = [];
		resetGhosts();
	}

	let pl = $derived(balance - START);
	let isUp = $derived(pl > 0);
	let isBroke = $derived(balance < BET);

	let commentary = $derived.by(() => {
		if (isBroke) {
			const totalPlayers = GHOST_COUNT + 1;
			const totalBust = ghostsBust + 1; // +1 for the player
			if (ghostsBust > GHOST_COUNT * 0.8) {
				return `Balance hit zero. ${totalBust} of ${totalPlayers} are broke. 18 out of 38, every time.`;
			}
			return `Balance hit zero. ${totalBust} of ${totalPlayers} are broke so far. Variance decides who goes first. The wheel decides the rest.`;
		}
		if (totalSpins < 10) return null;
		if (ghostsBust === GHOST_COUNT) {
			if (isUp) return "All 100 others went broke. You're the last one at the table, not the best one playing.";
			return "All 100 others went broke. You lasted longer, but the odds don't know your name.";
		}
		if (ghostsBust >= 90) {
			if (isUp) return ghostsBust + " of 100 others went broke. Still positive doesn't mean favored. Keep spinning.";
			return ghostsBust + " of 100 others went broke. Winning streaks end. The 5.26% doesn't. Keep spinning.";
		}
		if (isUp) {
			if (ghostsBust > 0) return ghostsBust + " of 100 others at your table are already broke.";
			return "Short sessions have high variance. The edge needs volume.";
		}
		if (pl === 0) return "Break even. Exactly where variance says you could be.";
		if (pl > -20) return "Slightly down. Most sessions look like this.";
		if (pl > -50) return "Trending negative. This is the expected trajectory.";
		return "Down " + money(Math.abs(pl)) + ". The 5.26% edge, compounding over " + totalSpins + " spins.";
	});

	let chartPath = $derived.by(() => {
		if (history.length < 2) return '';
		const max = Math.max(START + 30, ...history);
		const min = Math.min(0, ...history);
		const range = max - min || 1;
		return history
			.map((v, i) => {
				const x = (i / (history.length - 1)) * 100;
				const y = 100 - ((v - min) / range) * 100;
				return `${i === 0 ? 'M' : 'L'}${x},${y}`;
			})
			.join(' ');
	});

	let evPath = $derived.by(() => {
		if (history.length < 2) return '';
		const max = Math.max(START + 30, ...history);
		const min = Math.min(0, ...history);
		const range = max - min || 1;
		const lossPerSpin = BET * (2 / 38);
		const totalPts = history.length - 1;
		const toY = (bal: number) => 100 - ((bal - min) / range) * 100;
		const toX = (spin: number) => (spin / totalPts) * 100;

		const zeroSpin = START / lossPerSpin; // ~380 spins where EV hits $0

		if (totalPts <= zeroSpin) {
			// EV hasn't reached zero yet: straight line from START to expected balance
			const endBal = START - lossPerSpin * totalPts;
			return `M0,${toY(START)} L100,${toY(endBal)}`;
		} else {
			// EV hits zero partway through, then stays flat at $0
			const zeroX = toX(zeroSpin);
			const zeroY = toY(0);
			return `M0,${toY(START)} L${zeroX},${zeroY} L100,${zeroY}`;
		}
	});

	let startLineY = $derived.by(() => {
		if (history.length < 2) return 50;
		const max = Math.max(START + 30, ...history);
		const min = Math.min(0, ...history);
		const range = max - min || 1;
		return 100 - ((START - min) / range) * 100;
	});

	// Spaghetti chart: 100 session lines overlaid
	let multiChartData = $derived.by(() => {
		if (sessionHistories.length === 0) return null;
		const allBalances = sessionHistories.flat();
		const max = Math.max(START * 2, ...allBalances);
		const range = max; // min is always 0
		const maxLen = Math.max(...sessionHistories.map(h => h.length));

		const toY = (bal: number) => 100 - (bal / range) * 100;
		const toX = (i: number) => (i / (maxLen - 1)) * 100;

		const startY = toY(START);

		// EV reference line (hits $0 around spin ~380, then flat)
		const lossPerSpin = BET * (2 / 38);
		const zeroSpin = START / lossPerSpin;
		let evPath: string;
		if (maxLen - 1 <= zeroSpin) {
			evPath = `M0,${startY} L100,${toY(START - lossPerSpin * (maxLen - 1))}`;
		} else {
			const zeroX = (zeroSpin / (maxLen - 1)) * 100;
			const zeroY = toY(0);
			evPath = `M0,${startY} L${zeroX},${zeroY} L100,${zeroY}`;
		}

		const lines = sessionHistories.map(hist => {
			const final = hist[hist.length - 1];
			const isBust = final < BET;
			const isWin = final > START;
			const d = hist
				.map((v, i) => {
					const x = toX(i);
					const y = toY(v);
					return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
				})
				.join(' ');
			return { d, isBust, isWin };
		});

		return { lines, startY, evPath };
	});

	$effect(() => {
		if (lifetimeSpins === 0 && totalSpins === 0) return;
		updateStats('roulette', {
			wagered: lifetimeWagered,
			net: lifetimeNet + pl,
			rounds: lifetimeSpins,
		});
	});
</script>

<section class="px-5 py-16 md:px-10 md:py-24">
	<div class="max-w-4xl">
		<div use:inview class="fade-up">
			<h2 class="font-headline text-4xl md:text-6xl mb-2">ROULETTE</h2>
			<p class="text-muted text-sm uppercase tracking-widest mb-8">
				38 pockets. 18 are yours. 20 are theirs.
			</p>
		</div>

		<div use:inview class="fade-up max-w-2xl mb-8">
			<p class="text-base md:text-lg leading-relaxed mb-4">
				American roulette has 18 red, 18 black, and 2 green pockets (0 and 00).
				Betting red gives you <strong class="font-mono">18/38</strong> odds,
				or <strong class="font-mono">47.37%</strong>. That gap between 47.37% and 50%
				is a <strong class="font-mono text-loss">5.26%</strong> house edge on every single bet.
			</p>
			<p class="text-base md:text-lg leading-relaxed mb-4">
				Over 1,000 bets of $5, that edge costs you about <strong class="font-mono text-loss">$263</strong>.
				The wheel doesn't streak or balance out because each spin is independent: 18 out of 38, every time.
			</p>
			<p class="text-base md:text-lg leading-relaxed mb-4">
				After five reds in a row, black isn't "due." The wheel has no memory.
				The belief that past results change future odds is called the Gambler's
				Fallacy, and it's the most widespread error in gambling. The probability
				is <strong class="font-mono">18/38</strong> on spin one and
				<strong class="font-mono">18/38</strong> on spin ten thousand.
			</p>
			<p class="text-base md:text-lg leading-relaxed">
				Winnings also warp your judgment. Once you're up, the profit feels like
				"free money," so you bet bigger, stay longer, or switch to riskier wagers.
				Psychologists call this the House Money Effect: people take risks with gains
				they would never take with their own stake. The casino is counting on it.
				Most winning sessions end as losing sessions because the player stayed at
				the table long enough for the edge to take it back.
			</p>
		</div>

		<!-- Simulator: "The Felt" -->
		<div use:inview class="fade-up felt-box" class:shake={shaking} class:flash-red={shaking}>
			<div class="flex items-center justify-between mb-5">
				<div class="text-xs uppercase tracking-widest text-[#8fb89e]">Roulette / $5 on red, every spin</div>
				<div class="flex items-center gap-2">
					<button onclick={newSession} class="text-xs text-[#8fb89e] hover:text-[#d4c08a] transition-colors underline">New session</button>
					<button onclick={resetAll} class="text-[#8fb89e] hover:text-[#d4c08a] transition-colors" aria-label="Reset all">
						<IconRefresh size={16} />
					</button>
				</div>
			</div>

			<!-- Result ball / wheel spinner -->
			{#if singleSpin}
				<div class="flex items-center gap-4 mb-5">
					<div class="wheel-spinner"></div>
					<div class="text-sm text-[#8fb89e]">Spinning...</div>
				</div>
			{:else if lastResult}
				<div class="flex items-center gap-4 mb-5">
					<div class="result-ball w-16 h-16 flex items-center justify-center font-mono text-xl font-bold text-white shadow-lg shadow-black/30"
						class:bg-loss={lastResult.color === 'red'}
						class:bg-[#1a1a1a]={lastResult.color === 'black'}
						class:bg-house={lastResult.color === 'green'}
						style="border-radius: 50%;"
					>
						{lastResult.number === -1 ? '00' : lastResult.number}
					</div>
					<div class="text-sm text-[#c8d8ce]">
						{lastResult.color === 'red' ? 'Red. You win $5.' : lastResult.color === 'green' ? 'Green. House wins.' : 'Black. You lose $5.'}
					</div>
				</div>
			{/if}

			<!-- Stats -->
			<div class="flex flex-wrap items-center gap-6 mb-5">
				<div>
					<div class="text-xs text-[#8fb89e] uppercase tracking-wide">Balance</div>
					<div class="font-mono text-2xl font-bold"
						class:text-[#e8c66a]={isUp}
						class:text-[#ff8a8a]={!isUp && totalSpins > 0}>
						{money(animating ? animatedBalance : balance)}
					</div>
				</div>
				<div>
					<div class="text-xs text-[#8fb89e] uppercase tracking-wide">Spins</div>
					<div class="font-mono text-2xl font-bold text-[#e0ddd4]">{totalSpins}</div>
				</div>
				<div>
					<div class="text-xs text-[#8fb89e] uppercase tracking-wide">P/L</div>
					<div class="font-mono text-2xl font-bold"
						class:text-[#ff8a8a]={pl < 0}
						class:text-[#e8c66a]={pl > 0}
						class:text-[#e0ddd4]={pl === 0}>
						{pl >= 0 ? '+' : ''}{money(pl)}
					</div>
				</div>
			</div>

			<!-- Controls -->
			<div class="flex flex-wrap gap-2 mb-5">
				<button onclick={spin} disabled={spinning || isBroke}
					class="felt-btn-primary" title="Single spin">
					<IconPlayerPlay size={16} />
					<span>SPIN</span>
				</button>
				<button onclick={() => runN(50)} disabled={spinning || isBroke}
					class="felt-btn">
					50
				</button>
				<button onclick={() => runN(200)} disabled={spinning || isBroke}
					class="felt-btn">
					200
				</button>
				<button onclick={() => instantN(1000)} disabled={spinning || isBroke}
					class="felt-btn" title="Instant 1,000 spins">
					<IconFastForward size={14} />
					<span>1K</span>
				</button>
				<button onclick={() => instantN(10000)} disabled={spinning || isBroke}
					class="felt-btn" title="Instant 10,000 spins">
					<IconFastForward size={14} />
					<span>10K</span>
				</button>
			</div>

			<!-- Commentary -->
			{#if commentary}
				<div class="text-sm mb-5 py-2 border-l-2 pl-3 transition-all duration-300"
					class:border-[#ff8a8a]={!isUp || isBroke}
					class:text-[#ff8a8a]={!isUp || isBroke}
					class:border-[#e8c66a]={isUp && !isBroke}
					class:text-[#e8c66a]={isUp && !isBroke}
				>
					{commentary}
				</div>
			{/if}

			<!-- Ghost players strip -->
			{#if totalSpins > 0}
				<div class="mb-5">
					<div class="flex items-center justify-between mb-1.5">
						<span class="text-xs text-[#8fb89e] uppercase tracking-wide">You + 100 others at this table</span>
						<span class="font-mono text-xs font-bold" class:text-[#ff8a8a]={ghostsBust > 0} class:text-[#8fb89e]={ghostsBust === 0}>
							{ghostsBust + (isBroke ? 1 : 0)}/{GHOST_COUNT + 1} broke
						</span>
					</div>
					<div class="ghost-strip">
						{#each sortedAllPlayers as p}
							<div class="ghost-cell" class:ghost-bust={!p.alive} class:ghost-you={p.you && p.alive}></div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Chart -->
			{#if history.length > 2}
				<div class="w-full h-36 md:h-48 border border-[#2a5e3e] mb-1 bg-[#0f2818]">
					<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="w-full h-full">
						<line x1="0" y1={startLineY} x2="100" y2={startLineY}
							stroke="#2a5e3e" stroke-width="0.5" stroke-dasharray="2,2" />
						<path d={evPath} fill="none" stroke="#5a8a6a" stroke-width="0.5"
							stroke-dasharray="1.5,1.5" vector-effect="non-scaling-stroke" />
						<path d={chartPath} fill="none"
							stroke={pl < 0 ? '#ff8a8a' : '#e8c66a'}
							stroke-width="1.2" vector-effect="non-scaling-stroke"
						/>
					</svg>
				</div>
				<div class="flex justify-between text-xs text-[#8fb89e] mb-5">
					<span>Spin 1</span>
					<span class="font-mono opacity-60">dashed = expected value</span>
					<span>Spin {history.length - 1}</span>
				</div>
			{/if}

			<!-- Lifetime stats -->
			{#if lifetimeSessions > 0}
				<div class="border-t border-[#2a5e3e] pt-4 mt-2">
					<div class="text-xs uppercase tracking-widest text-[#8fb89e] mb-3">Lifetime (across {lifetimeSessions} session{lifetimeSessions === 1 ? '' : 's'})</div>
					<div class="flex flex-wrap gap-6 text-sm text-[#c8d8ce]">
						<div>
							<span class="text-[#8fb89e]">Total wagered:</span>
							<span class="font-mono font-bold ml-1">{money(lifetimeWagered)}</span>
						</div>
						<div>
							<span class="text-[#8fb89e]">Net:</span>
							<span class="font-mono font-bold ml-1"
								class:text-[#ff8a8a]={lifetimeNet < 0}
								class:text-[#e8c66a]={lifetimeNet > 0}>
								{lifetimeNet >= 0 ? '+' : ''}{money(lifetimeNet)}
							</span>
						</div>
						<div>
							<span class="text-[#8fb89e]">Sessions up:</span>
							<span class="font-mono font-bold ml-1">{lifetimeSessionsUp}/{lifetimeSessions}</span>
						</div>
					</div>
				</div>
			{/if}

			{#if isBroke}
				<div class="mt-5 text-[#ff8a8a] font-headline text-xl">
					YOU'RE BROKE. THE HOUSE THANKS YOU.
				</div>
			{/if}
		</div>

		<!-- Closing callout -->
		<div use:inview class="fade-up mt-10 pl-6 border-l-3 border-loss">
			<p class="font-headline text-xl md:text-2xl leading-tight">
				THE WHEEL HAS NO MEMORY.<br />
				THE MATH DOES.
			</p>
		</div>

		<!-- 1000 sessions proof -->
		<div use:inview class="fade-up mt-8 felt-box">
			{#if !multiResult}
				<div class="text-xs uppercase tracking-widest text-[#8fb89e] mb-3">
					Still not convinced?
				</div>
				<p class="text-sm mb-4 max-w-lg text-[#c8d8ce]">
					Simulate 1,000 players. Each starts with $100, bets $5 on red for 1,000 spins.
				</p>
				<button onclick={runMultiSession} class="felt-btn-primary">
					RUN 1,000 SESSIONS
				</button>
			{:else}
				<div class="text-xs uppercase tracking-widest text-[#8fb89e] mb-3">
					1,000 sessions / 1,000 spins each / $5 on red
				</div>

				<!-- Spaghetti chart: 100 session lines overlaid -->
				{#if multiChartData}
					<div class="w-full h-48 md:h-64 border border-[#2a5e3e] mb-1 bg-[#0f2818]">
						<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="w-full h-full">
							<!-- $100 start line -->
							<line x1="0" y1={multiChartData.startY} x2="100" y2={multiChartData.startY}
								stroke="#2a5e3e" stroke-width="0.5" stroke-dasharray="2,2" />
							<!-- Loss lines (background) -->
							{#each multiChartData.lines.filter(l => !l.isWin && !l.isBust) as line}
								<path d={line.d} fill="none" stroke="#ff8a8a" stroke-opacity="0.15"
									stroke-width="1" vector-effect="non-scaling-stroke" />
							{/each}
							<!-- Bust lines -->
							{#each multiChartData.lines.filter(l => l.isBust) as line}
								<path d={line.d} fill="none" stroke="#ff8a8a" stroke-opacity="0.35"
									stroke-width="1" vector-effect="non-scaling-stroke" />
							{/each}
							<!-- Win lines (foreground) -->
							{#each multiChartData.lines.filter(l => l.isWin) as line}
								<path d={line.d} fill="none" stroke="#e8c66a" stroke-opacity="0.5"
									stroke-width="1" vector-effect="non-scaling-stroke" />
							{/each}
							<!-- EV reference line -->
							<path d={multiChartData.evPath} fill="none" stroke="#8fb89e" stroke-width="1.5"
								stroke-dasharray="3,3" vector-effect="non-scaling-stroke" />
						</svg>
					</div>
					<div class="flex justify-between text-xs text-[#8fb89e] mb-5">
						<span>Spin 1</span>
						<span class="font-mono opacity-60">100 of 1,000 sessions shown</span>
						<span>Spin 1,000</span>
					</div>
				{/if}

				<!-- Hero stat -->
				<div class="flex items-baseline gap-3 mb-4">
					<div class="font-mono text-4xl md:text-5xl font-bold text-[#ff8a8a]">
						{money(multiResult.avgFinal)}
					</div>
					<div class="text-sm text-[#8fb89e]">
						average final balance, out of $100
					</div>
				</div>

				<div class="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#c8d8ce] mb-5">
					<div>
						<span class="text-[#e8c66a] font-mono font-bold">{multiResult.wins}</span>
						<span class="text-[#8fb89e] ml-1">ended up</span>
					</div>
					<div>
						<span class="text-[#ff8a8a] font-mono font-bold">{multiResult.losses + multiResult.busts}</span>
						<span class="text-[#8fb89e] ml-1">ended down</span>
					</div>
					<div>
						<span class="text-[#ff8a8a] font-mono font-bold">{multiResult.busts}</span>
						<span class="text-[#8fb89e] ml-1">went broke</span>
					</div>
				</div>

				<button onclick={runMultiSession} class="felt-btn">
					RUN AGAIN
				</button>
			{/if}
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

	/* Casino felt theme */
	.felt-box {
		background: #163d28;
		border: 1px solid #2a5e3e;
		padding: 1.25rem;
		color: #e0ddd4;
	}
	@media (min-width: 768px) {
		.felt-box { padding: 1.75rem; }
	}

	.felt-btn, .felt-btn-primary {
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
	.felt-btn {
		border: 1px solid #5a8a6a;
		color: #c8d8ce;
		background: transparent;
	}
	.felt-btn:hover:not(:disabled) {
		background: #1e4d33;
		border-color: #e8c66a;
		color: #e8c66a;
	}
	.felt-btn-primary {
		background: linear-gradient(135deg, #c5a044, #a37e2c);
		color: #1a1a1a;
		border: none;
		font-weight: 600;
	}
	.felt-btn-primary:hover:not(:disabled) {
		background: linear-gradient(135deg, #d4b050, #b88e34);
	}
	.felt-btn:disabled, .felt-btn-primary:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.ghost-strip {
		display: flex;
		gap: 1px;
		height: 6px;
	}
	.ghost-cell {
		flex: 1;
		background: #2a5e3e;
		transition: background 300ms;
	}
	.ghost-bust {
		background: #ff8a8a;
		animation: ghost-pop 300ms ease-out;
	}
	.ghost-you {
		background: #e8c66a;
	}

	.wheel-spinner {
		width: 4rem;
		height: 4rem;
		border: 2px solid #5a8a6a;
		border-radius: 50%;
		position: relative;
		animation: wheel-spin 0.5s ease-out;
	}
	.wheel-spinner::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 50%;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #e8c66a;
		transform: translateX(-50%);
	}
	@keyframes wheel-spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(720deg); }
	}

	.result-ball {
		animation: popIn 200ms ease-out;
	}
	@keyframes popIn {
		0% { transform: scale(0.6); opacity: 0; }
		100% { transform: scale(1); opacity: 1; }
	}
</style>
