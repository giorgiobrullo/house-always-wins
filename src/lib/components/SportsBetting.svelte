<script lang="ts">
	import { inview } from '$lib/utils/intersection';
	import { update as updateStats } from '$lib/stores/simStats.svelte';
	import { simulateSportsBets } from '$lib/utils/random';
	import { money } from '$lib/utils/format';
	import { play } from '$lib/utils/audio';
	import { countTo } from '$lib/utils/effects';
	import Ref from '$lib/components/Ref.svelte';
	import IconRefresh from '@tabler/icons-svelte/icons/refresh';
	import IconFastForward from '@tabler/icons-svelte/icons/player-track-next';

	const START = 1000;
	const BET = 100;
	const WIN_PROFIT = BET * (100 / 110); // $90.91 at -110 odds

	const WIN_RATES = [
		{ rate: 0.48, label: '48%', desc: 'Recreational' },
		{ rate: 0.50, label: '50%', desc: 'Coin flip' },
		{ rate: 0.524, label: '52.4%', desc: 'Break-even' },
		{ rate: 0.55, label: '55%', desc: 'Sharp' },
	];

	let winRate = $state(0.48);
	let balance = $state(START);
	let history: number[] = $state([START]);
	let totalBets = $state(0);

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
	let lifetimeBets = $state(0);
	let lifetimeWagered = $state(0);
	let lifetimeNet = $state(0);
	let lifetimeSessionsUp = $state(0);

	// W-L record tracking
	let sessionWins = $state(0);
	let sessionLosses = $state(0);
	let winPct = $derived(sessionWins + sessionLosses > 0 ? ((sessionWins / (sessionWins + sessionLosses)) * 100).toFixed(1) : '—');

	// Multi-session
	let multiResult: { wins: number; losses: number; busts: number; avgFinal: number } | null = $state(null);
	let sessionHistories: number[][] = $state([]);

	function placeBets(n: number) {
		play('chipDown');
		const oldBalance = balance;
		const balances = simulateSportsBets(balance, BET, winRate, n);
		const actual = balances.length;
		totalBets += actual;
		lifetimeBets += actual;
		lifetimeWagered += actual * BET;
		// Count wins/losses from consecutive balance diffs
		let prev = oldBalance;
		for (const b of balances) {
			if (b > prev) sessionWins++;
			else sessionLosses++;
			prev = b;
		}

		if (balances.length > 0) {
			balance = balances[balances.length - 1];
		}
		history = [...history, ...balances];

		// Animate balance count-up
		animating = true;
		animatedBalance = oldBalance;
		countTo(oldBalance, balance, 600, (v) => { animatedBalance = v; }, () => { animating = false; });
		if (balance < BET) triggerShake();
	}

	function newSession() {
		const sessionNet = balance - START;
		lifetimeNet += sessionNet;
		lifetimeSessions++;
		if (sessionNet > 0) lifetimeSessionsUp++;

		balance = START;
		history = [START];
		totalBets = 0;
		sessionWins = 0;
		sessionLosses = 0;
	}

	function resetAll() {
		balance = START;
		history = [START];
		totalBets = 0;
		lifetimeSessions = 0;
		lifetimeBets = 0;
		lifetimeWagered = 0;
		lifetimeNet = 0;
		lifetimeSessionsUp = 0;
		multiResult = null;
		sessionHistories = [];
		sessionWins = 0;
		sessionLosses = 0;
	}

	function runMultiSession() {
		play('click');
		const TOTAL = 1000;
		const CHARTED = 100;
		const ROUNDS = 1000;
		const histories: number[][] = [];
		let wins = 0, losses = 0, busts = 0, totalFinal = 0;
		for (let s = 0; s < TOTAL; s++) {
			const balances = simulateSportsBets(START, BET, winRate, ROUNDS);
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

	let pl = $derived(balance - START);
	let isUp = $derived(pl > 0);
	let isBroke = $derived(balance < BET);
	let evPerBet = $derived(winRate * WIN_PROFIT - (1 - winRate) * BET);

	let commentary = $derived.by(() => {
		if (isBroke) {
			if (winRate <= 0.50) return sessionWins + "-" + sessionLosses + ". The vig collects regardless of how close to .500 you are.";
			if (winRate <= 0.524) return sessionWins + "-" + sessionLosses + ". Broke at the break-even rate. Variance needs bankroll to survive.";
			return sessionWins + "-" + sessionLosses + ". Even sharps go broke with undersized bankrolls. Edge doesn't eliminate swings.";
		}
		if (totalBets < 10) return null;

		if (winRate <= 0.48) {
			if (isUp && totalBets < 100) return sessionWins + "-" + sessionLosses + ". Positive at 48%. Small sample. The vig hasn't finished working.";
			if (isUp) return sessionWins + "-" + sessionLosses + " (" + winPct + "%). Ahead at 48%. This variance keeps recreational bettors depositing.";
			return sessionWins + "-" + sessionLosses + ". That's " + winPct + "%. You need 52.4% to break even.";
		}
		if (winRate <= 0.50) {
			if (isUp) return sessionWins + "-" + sessionLosses + ". Winning half your bets with a 10% tax on each win. Variance, not skill.";
			return sessionWins + "-" + sessionLosses + " (" + winPct + "%). 50% accuracy minus 10% vig. The leak is slow but relentless.";
		}
		if (winRate <= 0.524) {
			if (Math.abs(pl) < 150) return sessionWins + "-" + sessionLosses + ". Hovering near zero. This is what break-even feels like. Flat, with swings.";
			if (isUp) return sessionWins + "-" + sessionLosses + " (" + winPct + "%). Up at the break-even rate. Luck, not edge.";
			return sessionWins + "-" + sessionLosses + ". Down at 52.4%. Break-even is a long-run property, not a session guarantee.";
		}
		// 55%
		if (isUp && totalBets < 100) return sessionWins + "-" + sessionLosses + " (" + winPct + "%). This is what sharps look like. Until the book limits them.";
		if (isUp) return sessionWins + "-" + sessionLosses + ". +" + money(pl) + " at 55%. The sportsbook would have flagged this account by now.";
		if (totalBets < 100) return sessionWins + "-" + sessionLosses + ". Down at 55%. Edge shows up over thousands of bets, not dozens.";
		return sessionWins + "-" + sessionLosses + " (" + winPct + "%). Negative at 55% after " + totalBets + " bets. Even a real edge needs volume.";
	});

	// Balance chart
	let chartPath = $derived.by(() => {
		if (history.length < 2) return '';
		const max = Math.max(START + 300, ...history);
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
			const y = 100 - ((history[history.length - 1] - min) / range) * 100;
			pts.push(`L100,${y.toFixed(1)}`);
		}
		return pts.join(' ');
	});

	let startLineY = $derived.by(() => {
		if (history.length < 2) return 50;
		const max = Math.max(START + 300, ...history);
		const min = Math.min(0, ...history);
		const range = max - min || 1;
		return 100 - ((START - min) / range) * 100;
	});

	let evChartPath = $derived.by(() => {
		if (history.length < 2) return '';
		const max = Math.max(START + 300, ...history);
		const min = Math.min(0, ...history);
		const range = max - min || 1;
		const totalPts = history.length - 1;
		const toY = (bal: number) => 100 - ((Math.max(min, Math.min(max, bal)) - min) / range) * 100;

		if (evPerBet >= 0) {
			const endBal = START + evPerBet * totalPts;
			return `M0,${toY(START)} L100,${toY(endBal)}`;
		} else {
			const zeroRound = START / Math.abs(evPerBet);
			if (totalPts <= zeroRound) {
				const endBal = START + evPerBet * totalPts;
				return `M0,${toY(START)} L100,${toY(endBal)}`;
			} else {
				const zeroX = (zeroRound / totalPts) * 100;
				return `M0,${toY(START)} L${zeroX},${toY(0)} L100,${toY(0)}`;
			}
		}
	});

	// Multi-session spaghetti chart
	let multiChartData = $derived.by(() => {
		if (sessionHistories.length === 0) return null;
		const allBalances = sessionHistories.flat();
		const max = Math.max(START * 2, ...allBalances);
		const range = max;
		const maxLen = Math.max(...sessionHistories.map(h => h.length));

		const toY = (bal: number) => 100 - (Math.max(0, bal) / range) * 100;
		const startY = toY(START);

		let evLine: string;
		if (evPerBet >= 0) {
			const endBal = Math.min(START + evPerBet * (maxLen - 1), max);
			evLine = `M0,${startY} L100,${toY(endBal)}`;
		} else {
			const zeroRound = START / Math.abs(evPerBet);
			if (maxLen - 1 <= zeroRound) {
				evLine = `M0,${startY} L100,${toY(START + evPerBet * (maxLen - 1))}`;
			} else {
				const zeroX = (zeroRound / (maxLen - 1)) * 100;
				evLine = `M0,${startY} L${zeroX},${toY(0)} L100,${toY(0)}`;
			}
		}

		const lines = sessionHistories.map(hist => {
			const final_ = hist[hist.length - 1];
			const isBust = final_ < BET;
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
		if (lifetimeBets === 0 && totalBets === 0) return;
		updateStats('sports', {
			wagered: lifetimeWagered,
			net: lifetimeNet + pl,
			rounds: lifetimeBets,
		});
	});
</script>

{#snippet ref1()}Levitt, S.D. "Why Are Gambling Markets Organised So Differently from Financial Markets?" <em>The Economic Journal</em>, 114(495), 223-246, 2004. <a href="https://pricetheory.uchicago.edu/levitt/Papers/LevittWhyAreGamblingMarkets2004.pdf" target="_blank" rel="noopener">PDF</a>{/snippet}
{#snippet ref2()}UK Gambling Commission. "Commercial Restrictions by Betting Operators." 2025. <a href="https://www.gamblingcommission.gov.uk/blog/post/commercial-restrictions-by-betting-operators" target="_blank" rel="noopener">Link</a>{/snippet}
{#snippet ref3()}Purdum, D.P. "Sportsbooks Defend Practice of Limiting How Much Sharp Customers Can Bet." <em>ESPN</em>, Sept. 2024. <a href="https://www.espn.com/sports-betting/story/_/id/41231266" target="_blank" rel="noopener">Link</a>{/snippet}

<section class="px-5 py-16 md:px-10 md:py-24">
	<div class="max-w-4xl">
		<div use:inview class="fade-up">
			<h2 class="font-headline text-4xl md:text-6xl mb-2">SPORTS BETTING</h2>
			<p class="text-muted text-sm uppercase tracking-widest mb-8">
				Knowledge doesn't beat the vig
			</p>
		</div>

		<div use:inview class="fade-up max-w-2xl mb-10">
			<p class="text-base md:text-lg leading-relaxed mb-4">
				Standard sportsbook odds of <strong class="font-mono">-110</strong> on both sides mean
				you bet $110 to win $100. That 10% spread is the "vig" or "juice."
				To break even long-term, you need to win <strong class="font-mono text-loss">52.4%</strong>
				of your bets, not 50%.
			</p>
			<p class="text-base md:text-lg leading-relaxed mb-4">
				Professional bettors who do this full-time with statistical models and data teams
				hit about 53-57%. Most of them get their accounts limited or closed
				once the books identify them as sharp.<Ref num={1}>{@render ref2()}</Ref><Ref num={2}>{@render ref3()}</Ref>
			</p>
			<p class="text-base md:text-lg leading-relaxed mb-4">
				Recreational bettors consistently underperform the 52.4% threshold.<Ref num={3}>Taylor, W.J., McCarthy, D.M. &amp; Wilbur, K.C. "Online Gambling Policy Effects on Tax Revenue and Irresponsible Gambling." SSRN Working Paper No. 4856684, 2024. <a href="https://ssrn.com/abstract=4856684" target="_blank" rel="noopener">Link</a></Ref><Ref num={4}>Nelson, S.E. et al. "Changes to the Playing Field: A Contemporary Study of Actual European Online Sports Betting." <em>Journal of Behavioral Addictions</em>, 10(3), 396-411, 2021. <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC8997203/" target="_blank" rel="noopener">PMC</a></Ref>
				The sportsbooks know the exact distribution of their customer base's win rates.
				That's why their customer acquisition budgets are in the hundreds of millions.
			</p>
			<p class="text-base md:text-lg leading-relaxed">
				Everyone remembers the upset they called. The losses don't make the
				group chat. Over time you build a highlight reel of wins and discard
				the rest, which creates the feeling that you're beating the market.
				This is confirmation bias, and sportsbooks are built on it.
				Your actual record is in the book's database. If it were above
				<strong class="font-mono">52.4%</strong> over any meaningful sample, they would have
				limited your account already. The fact that you can still bet freely
				is the book telling you that you're not a threat.
			</p>
		</div>

		<div use:inview class="fade-up">
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
				<div class="sim-box">
					<div class="stat-card text-loss">~4%</div>
					<div class="text-sm mt-2">
						Percentage of online gamblers profitable long-term.
						The other 96% subsidize the industry.<Ref num={3}>Taylor, W.J., McCarthy, D.M. &amp; Wilbur, K.C. "Online Gambling Policy Effects on Tax Revenue and Irresponsible Gambling." SSRN Working Paper No. 4856684, 2024. <a href="https://ssrn.com/abstract=4856684" target="_blank" rel="noopener">Link</a></Ref>
					</div>
				</div>
				<div class="sim-box">
					<div class="stat-card text-ink">52.4%</div>
					<div class="text-sm mt-2">
						Win rate required to break even at -110 odds.
						Most recreational bettors fall short.<Ref num={4}>Nelson, S.E. et al. "Changes to the Playing Field: A Contemporary Study of Actual European Online Sports Betting." <em>Journal of Behavioral Addictions</em>, 10(3), 396-411, 2021. <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC8997203/" target="_blank" rel="noopener">PMC</a></Ref>
					</div>
				</div>
				<div class="sim-box">
					<div class="stat-card text-house">~$150B</div>
					<div class="text-sm mt-2">
						US sports betting handle in 2024.
						The books kept $13.7B in revenue.<Ref num={5}>American Gaming Association. "2024 Commercial Gaming Revenue Reaches $71.9B." Feb. 2025. <a href="https://www.americangaming.org/2024-commercial-gaming-revenue-reaches-71-9b-marking-fourth-straight-year-of-record-revenue/" target="_blank" rel="noopener">Link</a></Ref>
					</div>
				</div>
			</div>
		</div>

		<!-- Interactive sim -->
		<div use:inview class="fade-up sim-box mb-6" class:shake={shaking} class:flash-red={shaking}>
			<div class="flex items-center justify-between mb-5">
				<div class="sim-label">
					Pick your win rate / $100 bets at -110
				</div>
				<div class="flex items-center gap-2">
					<button onclick={newSession} class="text-xs text-muted hover:text-ink transition-colors underline">New session</button>
					<button onclick={resetAll} class="text-muted hover:text-ink transition-colors" aria-label="Reset all">
						<IconRefresh size={16} />
					</button>
				</div>
			</div>

			<!-- Win rate selector -->
			<div class="flex flex-wrap items-center gap-2 mb-5">
				{#each WIN_RATES as wr}
					<button
						onclick={() => { winRate = wr.rate; }}
						class="rate-btn"
						class:active={winRate === wr.rate}
					>
						<span class="font-mono font-bold">{wr.label}</span>
						<span class="text-muted text-xs">{wr.desc}</span>
					</button>
				{/each}
			</div>

			<!-- Stats -->
			<div class="flex flex-wrap items-center gap-6 mb-5">
				<div>
					<div class="text-xs text-muted uppercase tracking-wide">Balance</div>
					<div class="font-mono text-2xl font-bold"
						class:text-house={isUp}
						class:text-loss={!isUp && totalBets > 0}>
						{money(animating ? animatedBalance : balance)}
					</div>
				</div>
				<div>
					<div class="text-xs text-muted uppercase tracking-wide">Bets</div>
					<div class="font-mono text-2xl font-bold">{totalBets}</div>
				</div>
				<div>
					<div class="text-xs text-muted uppercase tracking-wide">P/L</div>
					<div class="font-mono text-2xl font-bold"
						class:text-loss={pl < 0}
						class:text-house={pl > 0}>
						{pl >= 0 ? '+' : ''}{money(pl)}
					</div>
				</div>
				<div>
					<div class="text-xs text-muted uppercase tracking-wide">EV / bet</div>
					<div class="font-mono text-sm font-bold"
						class:text-loss={evPerBet < 0}
						class:text-house={evPerBet > 0}>
						{evPerBet >= 0 ? '+' : ''}{money(evPerBet)}
					</div>
				</div>
			</div>

			<!-- Controls -->
			<div class="flex flex-wrap gap-2 mb-5">
				<button onclick={() => placeBets(50)} disabled={isBroke} class="sports-btn border border-ink">
					50 BETS
				</button>
				<button onclick={() => placeBets(200)} disabled={isBroke} class="sports-btn border border-ink">
					200 BETS
				</button>
				<button onclick={() => placeBets(1000)} disabled={isBroke} class="sports-btn border border-ink">
					<IconFastForward size={14} />
					<span>1K</span>
				</button>
			</div>

			<!-- Commentary -->
			{#if commentary}
				<div class="text-sm mb-5 py-2 border-l-2 pl-3 transition-all duration-300"
					class:border-loss={!isUp || isBroke}
					class:text-loss={!isUp || isBroke}
					class:border-house={isUp && !isBroke}
					class:text-house={isUp && !isBroke}
				>
					{commentary}
				</div>
			{/if}

			<!-- W-L record -->
			{#if totalBets > 0}
				<div class="mb-5">
					<div class="flex items-center justify-between mb-1.5">
						<span class="text-xs text-muted uppercase tracking-wide">Your record</span>
					</div>
					<div class="flex items-center gap-4">
						<div class="font-mono text-lg font-bold">
							<span class="text-house">{sessionWins}W</span>
							<span class="text-muted">–</span>
							<span class="text-loss">{sessionLosses}L</span>
						</div>
						<div class="font-mono text-sm" class:text-loss={Number(winPct) < 52.4} class:text-house={Number(winPct) >= 52.4}>
							{winPct}%
						</div>
						<div class="text-xs text-muted">
							{Number(winPct) < 52.4 ? 'Below' : 'Above'} the 52.4% break-even line
						</div>
					</div>
					<!-- Visual bar showing win% vs 52.4% threshold -->
					<div class="mt-2 relative h-2 bg-border overflow-hidden">
						<div class="absolute inset-y-0 left-0 bg-house transition-all duration-300"
							style="width: {Math.min(100, Number(winPct) || 0)}%"></div>
						<div class="absolute inset-y-0 w-px bg-ink" style="left: 52.4%"></div>
					</div>
					<div class="flex justify-between text-[10px] text-muted mt-0.5">
						<span>0%</span>
						<span class="font-mono">52.4% break-even</span>
						<span>100%</span>
					</div>
				</div>
			{/if}

			<!-- Balance chart -->
			{#if history.length > 2}
				<div class="w-full h-36 md:h-48 border border-border mb-1">
					<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="w-full h-full">
						<line x1="0" y1={startLineY} x2="100" y2={startLineY}
							stroke="#d6d0c6" stroke-width="0.5" stroke-dasharray="2,2" />
						<path d={evChartPath} fill="none" stroke="#9a9488" stroke-width="0.5"
							stroke-dasharray="1.5,1.5" vector-effect="non-scaling-stroke" />
						<path d={chartPath} fill="none"
							stroke={pl < 0 ? '#c53030' : '#2d8a4e'}
							stroke-width="1.5" vector-effect="non-scaling-stroke"
							/>
					</svg>
				</div>
				<div class="flex justify-between text-xs text-muted mb-5">
					<span>Bet 1</span>
					<span class="font-mono opacity-60">dashed = expected value</span>
					<span>Bet {history.length - 1}</span>
				</div>
			{/if}

			<!-- Lifetime -->
			{#if lifetimeSessions > 0}
				<div class="border-t border-border pt-4 mt-2">
					<div class="text-xs uppercase tracking-widest text-muted mb-3">Lifetime (across {lifetimeSessions} session{lifetimeSessions === 1 ? '' : 's'})</div>
					<div class="flex flex-wrap gap-6 text-sm">
						<div>
							<span class="text-muted">Total wagered:</span>
							<span class="font-mono font-bold ml-1">{money(lifetimeWagered)}</span>
						</div>
						<div>
							<span class="text-muted">Net:</span>
							<span class="font-mono font-bold ml-1"
								class:text-loss={lifetimeNet < 0}
								class:text-house={lifetimeNet > 0}>
								{lifetimeNet >= 0 ? '+' : ''}{money(lifetimeNet)}
							</span>
						</div>
						<div>
							<span class="text-muted">Sessions up:</span>
							<span class="font-mono font-bold ml-1">{lifetimeSessionsUp}/{lifetimeSessions}</span>
						</div>
					</div>
				</div>
			{/if}

			{#if isBroke}
				<div class="mt-5 text-loss font-headline text-xl">
					YOU'RE BROKE. THE VIG ALWAYS COLLECTS.
				</div>
			{/if}
		</div>

		<!-- 1,000 sessions proof -->
		<div use:inview class="fade-up sim-box mb-8">
			{#if !multiResult}
				<div class="sim-label mb-3">
					1,000 bettors, your win rate
				</div>
				<p class="text-sm mb-4 max-w-lg">
					1,000 bettors place $100 at -110 odds with a {(winRate * 100).toFixed(1)}% win rate, 1,000 bets each. Starting bankroll: $1,000.
				</p>
				<button onclick={runMultiSession} class="sports-btn bg-ink text-cream">
					RUN 1,000 SEASONS
				</button>
			{:else}
				<div class="sim-label mb-3">
					1,000 bettors / 1,000 bets each / {(winRate * 100).toFixed(1)}% win rate / -110 odds
				</div>

				{#if multiChartData}
					<div class="w-full h-48 md:h-64 border border-border mb-1">
						<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="w-full h-full">
							<line x1="0" y1={multiChartData.startY} x2="100" y2={multiChartData.startY}
								stroke="#d6d0c6" stroke-width="0.5" stroke-dasharray="2,2" />
							{#each multiChartData.lines.filter(l => !l.isWin && !l.isBust) as line}
								<path d={line.d} fill="none" stroke="#c53030" stroke-opacity="0.15"
									stroke-width="1" vector-effect="non-scaling-stroke" />
							{/each}
							{#each multiChartData.lines.filter(l => l.isBust) as line}
								<path d={line.d} fill="none" stroke="#c53030" stroke-opacity="0.35"
									stroke-width="1" vector-effect="non-scaling-stroke" />
							{/each}
							{#each multiChartData.lines.filter(l => l.isWin) as line}
								<path d={line.d} fill="none" stroke="#2d8a4e" stroke-opacity="0.5"
									stroke-width="1" vector-effect="non-scaling-stroke" />
							{/each}
							<path d={multiChartData.evLine} fill="none" stroke="#9a9488" stroke-width="1.5"
								stroke-dasharray="3,3" vector-effect="non-scaling-stroke" />
						</svg>
					</div>
					<div class="flex justify-between text-xs text-muted mb-5">
						<span>Bet 1</span>
						<span class="font-mono opacity-60">100 of 1,000 bettors shown</span>
						<span>Bet 1,000</span>
					</div>
				{/if}

				<div class="flex items-baseline gap-3 mb-4">
					<div class="font-mono text-4xl md:text-5xl font-bold"
						class:text-loss={multiResult.avgFinal < START}
						class:text-house={multiResult.avgFinal >= START}>
						{money(multiResult.avgFinal)}
					</div>
					<div class="text-sm text-muted">
						avg. final balance from $1,000
					</div>
				</div>

				<div class="flex flex-wrap gap-x-6 gap-y-2 text-sm mb-5">
					<div>
						<span class="text-house font-mono font-bold">{multiResult.wins}</span>
						<span class="text-muted ml-1">finished positive</span>
					</div>
					<div>
						<span class="text-loss font-mono font-bold">{multiResult.losses + multiResult.busts}</span>
						<span class="text-muted ml-1">finished negative</span>
					</div>
					<div>
						<span class="text-loss font-mono font-bold">{multiResult.busts}</span>
						<span class="text-muted ml-1">couldn't cover a bet</span>
					</div>
				</div>

				{#if winRate >= 0.55}
					<div class="text-sm py-2 border-l-2 border-house pl-3 text-house mb-5">
						{multiResult.wins} finished positive. In practice, those accounts get limited or closed.
						The edge is real. The access isn't.
					</div>
				{:else if winRate >= 0.524}
					<div class="text-sm py-2 border-l-2 border-muted pl-3 text-muted mb-5">
						Break-even in theory. Variance in practice. And that's the best-case threshold.
					</div>
				{:else if winRate >= 0.50}
					<div class="text-sm py-2 border-l-2 border-loss pl-3 text-loss mb-5">
						50% accuracy with a 10% tax on every win. The vig doesn't need you to lose bets. It just needs you to win them at the wrong price.
					</div>
				{:else}
					<div class="text-sm py-2 border-l-2 border-loss pl-3 text-loss mb-5">
						This is the median recreational bettor. The sportsbook's revenue model depends on this distribution.
					</div>
				{/if}

				<button onclick={runMultiSession} class="sports-btn border border-ink">
					RUN AGAIN
				</button>
			{/if}
		</div>

		<div use:inview class="fade-up bg-ink text-cream p-6">
			<p class="font-headline text-xl md:text-2xl leading-tight mb-3">
				SPORTSBOOKS DON'T JUST BROKER RISK. THEY EXPLOIT IT.
			</p>
			<p class="text-sm leading-relaxed opacity-80">
				The traditional view is that books balance money on both sides and collect the vig.
				In practice, research shows they also take directional positions,
				setting lines to exploit systematic bettor biases for additional profit.<Ref num={6}>{@render ref1()}</Ref>
				When someone consistently beats the spread, their accounts get restricted or shut down.<Ref num={1}>{@render ref2()}</Ref><Ref num={2}>{@render ref3()}</Ref>
			</p>
		</div>

		<div use:inview class="fade-up mt-10 pl-6 border-l-3 border-loss">
			<p class="font-headline text-xl md:text-2xl leading-tight">
				THE ONLY WINNERS GET THEIR ACCOUNTS CLOSED.
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

	.stat-card {
		font-family: ui-monospace, monospace;
		font-size: clamp(2rem, 6vw, 3.5rem);
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.03em;
	}

	.sim-label {
		font-family: var(--font-headline);
		font-size: 0.75rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-muted);
	}

	/* Win rate selector */
	.rate-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.1rem;
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--color-border);
		background: transparent;
		transition: all 150ms;
	}
	.rate-btn:hover {
		border-color: var(--color-ink);
	}
	.rate-btn.active {
		background: var(--color-ink);
		color: var(--color-cream);
		border-color: var(--color-ink);
	}
	.rate-btn.active .text-muted {
		color: var(--color-cream);
		opacity: 0.7;
	}

	/* Buttons */
	.sports-btn {
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
	.sports-btn:hover:not(:disabled) {
		background: var(--color-ink);
		color: var(--color-cream);
	}
	.sports-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}
</style>
