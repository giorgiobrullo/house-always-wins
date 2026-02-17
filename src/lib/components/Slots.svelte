<script lang="ts">
	import { inview } from '$lib/utils/intersection';
	import { update as updateStats } from '$lib/stores/simStats.svelte';
	import { spinSlotReel, slotPayout, simulateSlotSession, type SlotSymbol } from '$lib/utils/random';
	import { money } from '$lib/utils/format';
	import { play } from '$lib/utils/audio';
	import { countTo } from '$lib/utils/effects';
	import Ref from '$lib/components/Ref.svelte';
	import IconRefresh from '@tabler/icons-svelte/icons/refresh';
	import IconPlayerPlay from '@tabler/icons-svelte/icons/player-play';
	import IconFastForward from '@tabler/icons-svelte/icons/player-track-next';
	import IconCherry from '@tabler/icons-svelte/icons/cherry';
	import IconBell from '@tabler/icons-svelte/icons/bell';
	import IconDiamond from '@tabler/icons-svelte/icons/diamond';
	import IconStar from '@tabler/icons-svelte/icons/star';
	import IconCrown from '@tabler/icons-svelte/icons/crown';
	import IconBolt from '@tabler/icons-svelte/icons/bolt';
	import IconNumber7 from '@tabler/icons-svelte/icons/number-7';

	const COST = 1;
	const START = 100;

	const iconMap: Record<SlotSymbol, { icon: typeof IconCherry; color: string }> = {
		cherry: { icon: IconCherry, color: 'text-[#ff4d4d]' },
		bell: { icon: IconBell, color: 'text-[#ffd700]' },
		diamond: { icon: IconDiamond, color: 'text-[#4dc9f6]' },
		star: { icon: IconStar, color: 'text-[#ffd700]' },
		crown: { icon: IconCrown, color: 'text-[#ff9f1c]' },
		bolt: { icon: IconBolt, color: 'text-[#ffe066]' },
		seven: { icon: IconNumber7, color: 'text-[#ff4d4d]' },
	};

	let reels: [SlotSymbol, SlotSymbol, SlotSymbol] = $state(['cherry', 'bell', 'diamond']);
	/** 3 columns × 3 rows: [top, middle/payline, bottom] */
	let reelStrips: [SlotSymbol, SlotSymbol, SlotSymbol][] = $state([
		[spinSlotReel(), 'cherry', spinSlotReel()],
		[spinSlotReel(), 'bell', spinSlotReel()],
		[spinSlotReel(), 'diamond', spinSlotReel()],
	]);
	let spinning = $state(false);
	let balance = $state(START);
	let history: number[] = $state([START]);
	let totalPulls = $state(0);
	let lastPayout = $state(0);
	let reelLocked: [boolean, boolean, boolean] = $state([false, false, false]);

	// Visual effects state
	let shaking = $state(false);
	let animating = $state(false);
	let animatedBalance = $state(START);

	function triggerShake() {
		shaking = true;
		setTimeout(() => { shaking = false; }, 500);
	}

	// Lifetime
	let lifetimeSessions = $state(0);
	let lifetimePulls = $state(0);
	let lifetimeIn = $state(0);
	let lifetimeOut = $state(0);
	let lifetimeNet = $state(0);
	let lifetimeSessionsUp = $state(0);

	// Multi-session
	let multiResult: { wins: number; losses: number; busts: number; avgFinal: number } | null = $state(null);
	let sessionHistories: number[][] = $state([]);

	let pl = $derived(balance - START);
	let isUp = $derived(pl > 0);
	let isBroke = $derived(balance < COST);

	// Speed context
	let realWorldMinutes = $derived(totalPulls > 0 ? (totalPulls / 600 * 60).toFixed(0) : '0');
	let netPerHour = $derived(totalPulls > 0 ? (pl / (totalPulls / 600)).toFixed(0) : '0');

	function doPull(): number {
		if (balance < COST) return 0;
		const r: [SlotSymbol, SlotSymbol, SlotSymbol] = [spinSlotReel(), spinSlotReel(), spinSlotReel()];
		reels = r;
		reelStrips = [
			[spinSlotReel(), r[0], spinSlotReel()],
			[spinSlotReel(), r[1], spinSlotReel()],
			[spinSlotReel(), r[2], spinSlotReel()],
		];
		balance -= COST;
		lifetimeIn += COST;
		totalPulls++;
		lifetimePulls++;
		const payout = slotPayout(r[0], r[1], r[2]);
		balance += payout;
		balance = Math.round(balance * 100) / 100;
		lifetimeOut += payout;
		lastPayout = payout;
		history = [...history, balance];
		return payout;
	}

	function pull() {
		if (spinning || isBroke) return;
		spinning = true;
		lastPayout = 0;
		reelLocked = [false, false, false];
		play('reelSpin');

		const finalReels: [SlotSymbol, SlotSymbol, SlotSymbol] = [spinSlotReel(), spinSlotReel(), spinSlotReel()];

		// Scramble all 3 strips rapidly
		const scramble = setInterval(() => {
			for (let c = 0; c < 3; c++) {
				if (!reelLocked[c]) {
					reelStrips[c] = [spinSlotReel(), spinSlotReel(), spinSlotReel()];
				}
			}
			reelStrips = [...reelStrips];
		}, 55);

		// Stop reels left to right
		function stopReel(col: number) {
			reelLocked[col] = true;
			reelLocked = [...reelLocked];
			reels[col] = finalReels[col];
			reelStrips[col] = [spinSlotReel(), finalReels[col], spinSlotReel()];
			reelStrips = [...reelStrips];
			play('reelStop');
		}

		setTimeout(() => stopReel(0), 500);
		setTimeout(() => stopReel(1), 800);
		setTimeout(() => {
			clearInterval(scramble);
			stopReel(2);

			balance -= COST;
			lifetimeIn += COST;
			totalPulls++;
			lifetimePulls++;
			const payout = slotPayout(reels[0], reels[1], reels[2]);
			balance += payout;
			balance = Math.round(balance * 100) / 100;
			lifetimeOut += payout;
			lastPayout = payout;
			history = [...history, balance];
			spinning = false;
			if (payout > 0) play('slotWin');
			else if (balance < COST) { play('bust'); triggerShake(); }
		}, 1100);
	}

	function runN(n: number) {
		if (spinning) return;
		spinning = true;
		play('chipDown');
		let i = 0;
		const interval = setInterval(() => {
			if (i >= n || balance < COST) {
				clearInterval(interval);
				spinning = false;
				return;
			}
			doPull();
			i++;
		}, 30);
	}

	function instantN(n: number) {
		if (spinning) return;
		const oldBalance = balance;
		play('chipDown');
		const newHistory: number[] = [];
		let bal = balance;
		let tIn = 0;
		let tOut = 0;
		let lastR: [SlotSymbol, SlotSymbol, SlotSymbol] = reels;
		let lp = 0;

		for (let i = 0; i < n; i++) {
			if (bal < COST) break;
			bal -= COST;
			tIn += COST;
			const r: [SlotSymbol, SlotSymbol, SlotSymbol] = [spinSlotReel(), spinSlotReel(), spinSlotReel()];
			const payout = slotPayout(r[0], r[1], r[2]);
			bal += payout;
			bal = Math.round(bal * 100) / 100;
			tOut += payout;
			lp = payout;
			newHistory.push(bal);
			lastR = r;
		}

		reels = lastR;
		lastPayout = lp;
		balance = bal;
		totalPulls += newHistory.length;
		lifetimeIn += tIn;
		lifetimeOut += tOut;
		lifetimePulls += newHistory.length;
		history = [...history, ...newHistory];

		// Animate balance count-up
		animating = true;
		animatedBalance = oldBalance;
		countTo(oldBalance, balance, 600, (v) => { animatedBalance = v; }, () => { animating = false; });
		if (balance < COST) triggerShake();
	}

	function newSession() {
		const sessionNet = balance - START;
		lifetimeNet += sessionNet;
		lifetimeSessions++;
		if (sessionNet > 0) lifetimeSessionsUp++;

		balance = START;
		history = [START];
		lastPayout = 0;
		totalPulls = 0;
		spinning = false;
		reelLocked = [false, false, false];
	}

	function resetAll() {
		balance = START;
		history = [START];
		lastPayout = 0;
		totalPulls = 0;
		spinning = false;
		reelLocked = [false, false, false];
		lifetimeSessions = 0;
		lifetimePulls = 0;
		lifetimeIn = 0;
		lifetimeOut = 0;
		lifetimeNet = 0;
		lifetimeSessionsUp = 0;
		multiResult = null;
		sessionHistories = [];
	}

	function runMultiSession() {
		const TOTAL = 1000;
		const CHARTED = 100;
		const PULLS = 1000;
		const histories: number[][] = [];
		let wins = 0, losses = 0, busts = 0, totalFinal = 0;
		for (let s = 0; s < TOTAL; s++) {
			const balances = simulateSlotSession(START, COST, PULLS);
			const final_ = balances.length > 0 ? balances[balances.length - 1] : START;
			if (s < CHARTED) histories.push([START, ...balances]);
			if (final_ > START) wins++;
			else if (final_ < COST) busts++;
			else losses++;
			totalFinal += final_;
		}
		multiResult = { wins, losses, busts, avgFinal: totalFinal / TOTAL };
		sessionHistories = histories;
	}

	let commentary = $derived.by(() => {
		if (isBroke) {
			return `Balance hit zero. At a real machine's pace, that was ${realWorldMinutes} minutes.`;
		}
		if (totalPulls < 10) return null;
		if (isUp) {
			if (totalPulls < 100) return "Positive on " + totalPulls + " pulls. A real machine runs 600/hour. Give it a lunch break.";
			return "Still up after " + totalPulls + " pulls. At 600/hour, that's " + realWorldMinutes + " minutes. The 11% hasn't finished.";
		}
		if (pl === 0) return "Even. The machine is calibrated to return 89 cents per dollar. Speed does the rest.";
		if (pl > -20) return "Down " + money(Math.abs(pl)) + ". At 600 pulls/hour, a real machine does this before you finish your drink.";
		if (pl > -50) return money(Math.abs(pl)) + " gone in " + realWorldMinutes + " minutes at real-world speed. Slots don't need time. They need volume.";
		return "Down " + money(Math.abs(pl)) + " in " + realWorldMinutes + " real-world minutes. That's the 11% edge at machine speed.";
	});

	// Chart: balance history
	let chartPath = $derived.by(() => {
		if (history.length < 2) return '';
		const max = Math.max(START + 30, ...history);
		const min = Math.min(0, ...history);
		const range = max - min || 1;
		const len = history.length;
		const MAX_PTS = 800;
		if (len <= MAX_PTS) {
			return history
				.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (len - 1)) * 100},${100 - ((v - min) / range) * 100}`)
				.join(' ');
		}
		const step = (len - 1) / (MAX_PTS - 1);
		const parts: string[] = [];
		for (let i = 0; i < MAX_PTS; i++) {
			const idx = Math.round(i * step);
			parts.push(`${i === 0 ? 'M' : 'L'}${(idx / (len - 1)) * 100},${100 - ((history[idx] - min) / range) * 100}`);
		}
		return parts.join(' ');
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
		const lossPerPull = COST * 0.11; // ~11% house edge
		const totalPts = history.length - 1;
		const toY = (bal: number) => 100 - ((bal - min) / range) * 100;

		const zeroPull = START / lossPerPull;
		if (totalPts <= zeroPull) {
			const endBal = START - lossPerPull * totalPts;
			return `M0,${toY(START)} L100,${toY(endBal)}`;
		} else {
			const zeroX = (zeroPull / totalPts) * 100;
			const zeroY = toY(0);
			return `M0,${toY(START)} L${zeroX},${zeroY} L100,${zeroY}`;
		}
	});

	// Multi-session spaghetti chart
	let multiChartData = $derived.by(() => {
		if (sessionHistories.length === 0) return null;
		const allBalances = sessionHistories.flat();
		const max = Math.max(START * 2, ...allBalances);
		const range = max;
		const maxLen = Math.max(...sessionHistories.map(h => h.length));

		const toY = (bal: number) => 100 - (bal / range) * 100;
		const startY = toY(START);

		const lossPerPull = COST * 0.11;
		const zeroPull = START / lossPerPull;
		let evLine: string;
		if (maxLen - 1 <= zeroPull) {
			evLine = `M0,${startY} L100,${toY(START - lossPerPull * (maxLen - 1))}`;
		} else {
			const zeroX = (zeroPull / (maxLen - 1)) * 100;
			const zeroY = toY(0);
			evLine = `M0,${startY} L${zeroX},${zeroY} L100,${zeroY}`;
		}

		const lines = sessionHistories.map(hist => {
			const final_ = hist[hist.length - 1];
			const isBust = final_ < COST;
			const isWin = final_ > START;
			const d = hist
				.map((v, i) => {
					const x = (i / (maxLen - 1)) * 100;
					const y = toY(v);
					return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
				})
				.join(' ');
			return { d, isBust, isWin };
		});

		return { lines, startY, evLine };
	});

	$effect(() => {
		if (lifetimePulls === 0 && totalPulls === 0) return;
		updateStats('slots', {
			wagered: lifetimeIn,
			net: lifetimeNet + pl,
			rounds: lifetimePulls,
		});
	});
</script>

<section class="px-5 py-16 md:px-10 md:py-24">
	<div class="max-w-4xl">
		<div use:inview class="fade-up">
			<h2 class="font-headline text-4xl md:text-6xl mb-2">SLOT MACHINES</h2>
			<p class="text-muted text-sm uppercase tracking-widest mb-8">
				Engineered to extract maximum money with minimum thought
			</p>
		</div>

		<div use:inview class="fade-up max-w-2xl mb-8">
			<p class="text-base md:text-lg leading-relaxed mb-4">
				Slots are the most profitable game in the casino for the house.
				They return about <strong class="font-mono">85-95%</strong> of money put in.<Ref num={1}>Nevada Gaming Control Board, Gaming Revenue Reports (via UNLV Center for Gaming Research). Statewide average slot hold ≈ 7-8%; observed RTP range 85-95%.</Ref>
				That sounds close to fair until you account for speed: a modern video slot
				can run 600-1,200 spins per hour.<Ref num={2}>Harrigan, K.A. &amp; Dixon, M.J. "PAR Sheets, Probabilities, and Slot Machine Play." <em>Journal of Gambling Issues</em>, 23, 81-110, 2009.</Ref>
				Each one shaving off 5-15%, which adds up fast.
			</p>
			<p class="text-base md:text-lg leading-relaxed mb-4">
				Two 7s and a cherry is not "almost winning." Each spin's outcome is determined
				by a random number generator, and past displays have zero predictive value. But the
				frequency of near-miss displays is not random. Manufacturers use "virtual reel mapping"
				to place extra stops adjacent to jackpot symbols, making near-misses appear
				far more often than pure chance would produce.<Ref num={3}>Harrigan, K.A. "Slot Machine Structural Characteristics: Creating Near Misses Using High Award Symbol Ratios." <em>International Journal of Mental Health and Addiction</em>, 6, 353-368, 2008.</Ref>
			</p>
			<p class="text-base md:text-lg leading-relaxed">
				What makes slots uniquely addictive is their reward schedule. Behavioral
				psychology calls it variable ratio reinforcement: payouts arrive at
				unpredictable intervals after an unpredictable number of actions.
				This pattern produces the strongest, most extinction-resistant behavior
				of any reinforcement schedule tested, across every species studied.
				Slot machines don't use this by accident. They are the purest commercial
				application of the effect ever built.
			</p>
		</div>

		<div use:inview class="fade-up cabinet" class:shake={shaking} class:flash-red={shaking}>
			<!-- Cabinet header -->
			<div class="cabinet-header">
				<div class="flex items-center justify-between">
					<div class="text-xs uppercase tracking-widest text-[#9a8494]">$1 per pull / $100 bankroll</div>
					<div class="flex items-center gap-2">
						<button onclick={newSession} class="text-xs text-[#9a8494] hover:text-[#d8c8d2] transition-colors underline">New session</button>
						<button onclick={resetAll} class="text-[#9a8494] hover:text-[#d8c8d2] transition-colors" aria-label="Reset all">
							<IconRefresh size={16} />
						</button>
					</div>
				</div>
			</div>

			<!-- Reel window -->
			<div class="reel-window">
				<div class="reel-machine">
					<!-- Payline indicator left -->
					<div class="payline-arrow payline-arrow-left">▶</div>

					{#each reelStrips as strip, i}
						<div class="reel-col"
							class:reel-col-spinning={spinning && !reelLocked[i]}
							class:reel-col-locked={reelLocked[i]}>
							{#each strip as symbol, row}
								{@const info = iconMap[symbol]}
								<div class="reel-cell" class:reel-payline={row === 1}>
									<info.icon size={row === 1 ? 32 : 20} class={info.color} />
								</div>
							{/each}
						</div>
					{/each}

					<!-- Payline indicator right -->
					<div class="payline-arrow payline-arrow-right">◀</div>
				</div>

				{#if lastPayout > 0 && !spinning}
					<div class="text-center font-headline text-xl text-[#ffd700] mt-3 win-flash">
						WIN: ${lastPayout}
					</div>
				{:else}
					<div class="h-8 mt-3"></div>
				{/if}
			</div>

			<!-- Stats strip -->
			<div class="stats-strip">
				<div class="text-center">
					<div class="text-[10px] text-[#9a8494] uppercase tracking-wide">Balance</div>
					<div class="font-mono text-lg font-bold"
						class:text-[#ffd700]={isUp}
						class:text-[#ff6b6b]={!isUp && totalPulls > 0}
						class:text-[#e0d4dc]={totalPulls === 0}>
						{money(animating ? animatedBalance : balance)}
					</div>
				</div>
				<div class="text-center">
					<div class="text-[10px] text-[#9a8494] uppercase tracking-wide">Pulls</div>
					<div class="font-mono text-lg font-bold text-[#e0d4dc]">{totalPulls}</div>
				</div>
				<div class="text-center">
					<div class="text-[10px] text-[#9a8494] uppercase tracking-wide">P/L</div>
					<div class="font-mono text-lg font-bold" class:text-[#ff6b6b]={pl < 0} class:text-[#ffd700]={pl > 0} class:text-[#e0d4dc]={pl === 0}>
						{pl >= 0 ? '+' : ''}{money(pl)}
					</div>
				</div>
			</div>

			<!-- Controls -->
			<div class="cabinet-controls">
				<div class="flex flex-wrap gap-2 justify-center">
					<button onclick={pull} disabled={spinning || isBroke} class="slot-btn-pull" title="Single pull">
						<IconPlayerPlay size={16} />
						<span>PULL</span>
					</button>
					<button onclick={() => runN(50)} disabled={spinning || isBroke} class="slot-btn">50</button>
					<button onclick={() => runN(200)} disabled={spinning || isBroke} class="slot-btn">200</button>
					<button onclick={() => instantN(1000)} disabled={spinning || isBroke} class="slot-btn" title="Instant 1,000">
						<IconFastForward size={14} />
						<span>1K</span>
					</button>
					<button onclick={() => instantN(10000)} disabled={spinning || isBroke} class="slot-btn" title="Instant 10,000">
						<IconFastForward size={14} />
						<span>10K</span>
					</button>
				</div>
			</div>

			<!-- Commentary -->
			{#if commentary}
				<div class="px-4 md:px-6 pb-4">
					<div class="text-sm py-2 border-l-2 pl-3"
						class:border-[#ff6b6b]={!isUp || isBroke}
						class:text-[#ff6b6b]={!isUp || isBroke}
						class:border-[#ffd700]={isUp && !isBroke}
						class:text-[#ffd700]={isUp && !isBroke}
					>
						{commentary}
					</div>
				</div>
			{/if}

			<!-- Speed callout -->
			{#if totalPulls > 0}
				<div class="mb-4 px-4 md:px-6">
					<div class="flex items-center justify-between mb-1.5">
						<span class="text-xs text-[#9a8494] uppercase tracking-wide">Real-world speed</span>
					</div>
					<div class="flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#c0b0ba]">
						<div>
							<span class="text-[#9a8494]">At 600 pulls/hr:</span>
							<span class="font-mono font-bold ml-1">{realWorldMinutes} min</span>
						</div>
						{#if totalPulls >= 20}
							<div>
								<span class="text-[#9a8494]">Rate:</span>
								<span class="font-mono font-bold ml-1" class:text-[#ff6b6b]={pl < 0} class:text-[#ffd700]={pl >= 0}>{money(Number(netPerHour))}/hr</span>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Balance Chart -->
			{#if history.length > 2}
				<div class="px-4 md:px-6 pb-1">
					<div class="w-full h-32 md:h-44 border border-[#3d2a35] bg-[#140c12]">
						<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="w-full h-full">
							<line x1="0" y1={startLineY} x2="100" y2={startLineY}
								stroke="#5a3a4a" stroke-width="0.5" stroke-dasharray="2,2" />
							<path d={evPath} fill="none" stroke="#7a5a6a" stroke-width="0.5"
								stroke-dasharray="1.5,1.5" vector-effect="non-scaling-stroke" />
							<path d={chartPath} fill="none"
								stroke={pl < 0 ? '#ff6b6b' : '#ffd700'}
								stroke-width="1" vector-effect="non-scaling-stroke"
								/>
						</svg>
					</div>
					<div class="flex justify-between text-xs text-[#7a5a6a] mb-4 mt-1">
						<span>Pull 1</span>
						<span class="font-mono opacity-60">dashed = expected value</span>
						<span>Pull {totalPulls}</span>
					</div>
				</div>
			{/if}

			<!-- Lifetime -->
			{#if lifetimeSessions > 0}
				<div class="px-4 md:px-6 pb-4">
					<div class="border-t border-[#3d2a35] pt-4">
						<div class="text-xs uppercase tracking-widest text-[#9a8494] mb-3">Lifetime (across {lifetimeSessions} session{lifetimeSessions === 1 ? '' : 's'})</div>
						<div class="flex flex-wrap gap-6 text-sm text-[#c0b0ba]">
							<div>
								<span class="text-[#9a8494]">Put in:</span>
								<span class="font-mono font-bold ml-1 text-[#e0d4dc]">{money(lifetimeIn)}</span>
							</div>
							<div>
								<span class="text-[#9a8494]">Net:</span>
								<span class="font-mono font-bold ml-1"
									class:text-[#ff6b6b]={lifetimeNet + pl < 0}
									class:text-[#ffd700]={lifetimeNet + pl > 0}>
									{(lifetimeNet + pl) >= 0 ? '+' : ''}{money(lifetimeNet + pl)}
								</span>
							</div>
							<div>
								<span class="text-[#9a8494]">Sessions up:</span>
								<span class="font-mono font-bold ml-1 text-[#e0d4dc]">{lifetimeSessionsUp}/{lifetimeSessions}</span>
							</div>
						</div>
					</div>
				</div>
			{/if}

			{#if isBroke}
				<div class="px-4 md:px-6 pb-4">
					<div class="text-[#ff6b6b] font-headline text-xl">
						YOU'RE BROKE. THE MACHINE THANKS YOU.
					</div>
				</div>
			{/if}
		</div>

		<!-- 1000 sessions proof -->
		<div use:inview class="fade-up mt-8 cabinet">
			{#if !multiResult}
				<div class="cabinet-header">
					<div class="text-xs uppercase tracking-widest text-[#9a8494] mb-3">
						Now multiply by speed
					</div>
					<p class="text-sm mb-4 max-w-lg text-[#c0b0ba]">
						1,000 players. $100 each, $1 pulls, 1,000 spins. At real-world speed, that's about 100 minutes per player.
					</p>
					<button onclick={runMultiSession} class="slot-btn-pull">
						RUN 1,000 SESSIONS
					</button>
				</div>
			{:else}
				<div class="cabinet-header" style="border-bottom: none;">
					<div class="text-xs uppercase tracking-widest text-[#9a8494] mb-3">
						1,000 sessions / 1,000 pulls each / $1 slots
					</div>
				</div>

				{#if multiChartData}
					<div class="px-4 md:px-6">
						<div class="w-full h-48 md:h-64 border border-[#3d2a35] mb-1 bg-[#140c12]">
							<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="w-full h-full">
								<line x1="0" y1={multiChartData.startY} x2="100" y2={multiChartData.startY}
									stroke="#3d2a35" stroke-width="0.5" stroke-dasharray="2,2" />
								{#each multiChartData.lines.filter(l => !l.isWin && !l.isBust) as line}
									<path d={line.d} fill="none" stroke="#ff6b6b" stroke-opacity="0.15"
										stroke-width="1" vector-effect="non-scaling-stroke" />
								{/each}
								{#each multiChartData.lines.filter(l => l.isBust) as line}
									<path d={line.d} fill="none" stroke="#ff6b6b" stroke-opacity="0.35"
										stroke-width="1" vector-effect="non-scaling-stroke" />
								{/each}
								{#each multiChartData.lines.filter(l => l.isWin) as line}
									<path d={line.d} fill="none" stroke="#ffd700" stroke-opacity="0.5"
										stroke-width="1" vector-effect="non-scaling-stroke" />
								{/each}
								<path d={multiChartData.evLine} fill="none" stroke="#9a8494" stroke-width="1.5"
									stroke-dasharray="3,3" vector-effect="non-scaling-stroke" />
							</svg>
						</div>
						<div class="flex justify-between text-xs text-[#7a5a6a] mb-5">
							<span>Pull 1</span>
							<span class="font-mono opacity-60">100 of 1,000 sessions shown</span>
							<span>Pull 1,000</span>
						</div>
					</div>
				{/if}

				<div class="px-4 md:px-6 pb-4">
					<div class="flex items-baseline gap-3 mb-4">
						<div class="font-mono text-4xl md:text-5xl font-bold text-[#ff6b6b]">
							{money(multiResult.avgFinal)}
						</div>
						<div class="text-sm text-[#9a8494]">
							average final balance, out of $100
						</div>
					</div>

					<div class="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#c0b0ba] mb-5">
						<div>
							<span class="text-[#ffd700] font-mono font-bold">{multiResult.wins}</span>
							<span class="text-[#9a8494] ml-1">ended up</span>
						</div>
						<div>
							<span class="text-[#ff6b6b] font-mono font-bold">{multiResult.losses + multiResult.busts}</span>
							<span class="text-[#9a8494] ml-1">ended down</span>
						</div>
						<div>
							<span class="text-[#ff6b6b] font-mono font-bold">{multiResult.busts}</span>
							<span class="text-[#9a8494] ml-1">went broke</span>
						</div>
					</div>

					<div class="text-sm text-[#9a8494] mt-3">
						At 600 pulls/hour, each player's 1,000 spins took about 100 minutes. A single afternoon.
					</div>

					<button onclick={runMultiSession} class="slot-btn">
						RUN AGAIN
					</button>
				</div>
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

	/* Slot machine cabinet - warm casino velvet */
	.cabinet {
		background: #1a1018;
		border: 2px solid #3d2a35;
		overflow: hidden;
	}
	.cabinet-header {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #3d2a35;
	}
	.reel-window {
		padding: 1.5rem 1rem;
		background: linear-gradient(180deg, #231828 0%, #1a1018 100%);
		border-bottom: 1px solid #3d2a35;
	}
	.stats-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		justify-content: center;
		padding: 0.75rem 1rem;
		background: #140c12;
		border-bottom: 1px solid #3d2a35;
	}
	.cabinet-controls {
		padding: 1rem;
	}

	/* Reel machine layout */
	.reel-machine {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 6px;
	}
	.reel-col {
		display: flex;
		flex-direction: column;
		border: 2px solid #5a3a4a;
		background: #f5f0e0;
		overflow: hidden;
	}
	.reel-cell {
		width: 4.5rem;
		height: 3rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f5f0e0;
		position: relative;
	}
	.reel-payline {
		background: #fffbe6;
		box-shadow: inset 0 0 8px rgba(255, 215, 0, 0.15);
	}
	/* Dim top/bottom rows */
	.reel-cell:not(.reel-payline) {
		opacity: 0.4;
	}
	@media (min-width: 768px) {
		.reel-cell {
			width: 5.5rem;
			height: 3.5rem;
		}
	}

	/* Payline arrows */
	.payline-arrow {
		font-size: 10px;
		color: #ffd700;
		line-height: 1;
		user-select: none;
	}
	.payline-arrow-left { margin-right: 4px; }
	.payline-arrow-right { margin-left: 4px; }

	/* Spinning column - blur + vertical jitter */
	.reel-col-spinning .reel-cell {
		animation: reelSpin 80ms linear infinite;
	}
	@keyframes reelSpin {
		0%   { transform: translateY(-2px); }
		50%  { transform: translateY(2px); }
		100% { transform: translateY(-2px); }
	}

	/* Locked column - bounce into place */
	.reel-col-locked {
		animation: reelLock 200ms ease-out;
	}
	@keyframes reelLock {
		0%   { transform: translateY(-6px); }
		60%  { transform: translateY(3px); }
		100% { transform: translateY(0); }
	}
	.win-flash {
		animation: flashIn 300ms ease-out;
	}
	@keyframes flashIn {
		0% { opacity: 0; transform: scale(0.8); }
		50% { transform: scale(1.05); }
		100% { opacity: 1; transform: scale(1); }
	}


	/* Slot buttons */
	.slot-btn, .slot-btn-pull {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.5rem 1rem;
		font-family: var(--font-headline);
		font-size: 0.875rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		transition: all 150ms;
		line-height: 0.95;
	}
	.slot-btn {
		border: 1px solid #5a3a4a;
		color: #b09aaa;
		background: transparent;
	}
	.slot-btn:hover:not(:disabled) {
		border-color: #ffd700;
		color: #ffd700;
		background: #2a1a25;
	}
	.slot-btn-pull {
		background: #c0392b;
		color: #fff;
		border: none;
		font-weight: 600;
		padding: 0.6rem 1.5rem;
	}
	.slot-btn-pull:hover:not(:disabled) {
		background: #e74c3c;
	}
	.slot-btn:disabled, .slot-btn-pull:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}
</style>
