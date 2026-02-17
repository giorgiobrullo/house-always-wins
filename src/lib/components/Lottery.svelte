<script lang="ts">
	import { inview } from '$lib/utils/intersection';
	import { update as updateStats } from '$lib/stores/simStats.svelte';
	import { simulateLotteryLifetime, computeLotteryPopulationStats, JACKPOT_ODDS } from '$lib/utils/random';
	import { moneyWhole, moneyCompact, compact } from '$lib/utils/format';
	import { play } from '$lib/utils/audio';
	import type { LotteryLifetimeResult } from '$lib/utils/random';
	import IconPlayerPlay from '@tabler/icons-svelte/icons/player-play';
	import IconZoomIn from '@tabler/icons-svelte/icons/zoom-in';
	import Ref from '$lib/components/Ref.svelte';

	const TICKETS_PER_DAY = 10;
	const TICKET_COST = 2;
	const YEARS = 50;
	const DAILY_COST = TICKETS_PER_DAY * TICKET_COST; // $20/day

	const POWERBALL_DENOM = 292_201_338;
	const comparisons = [
		{ event: 'Bowling a perfect 300 game', odds: '1 in 11,500', denom: 11_500, ref: 4 },
		{ event: 'Getting struck by lightning (lifetime)', odds: '1 in 15,300', denom: 15_300, ref: 3 },
		{ event: 'Getting dealt a royal flush', odds: '1 in 649,740', denom: 649_740, ref: 0 },
		{ event: 'Being killed by a shark (lifetime)', odds: '1 in 4,332,817', denom: 4_332_817, ref: 5 },
		{ event: 'Dying in a plane crash (per boarding)', odds: '1 in 13,700,000', denom: 13_700_000, ref: 6 },
	];
	const minDenom = comparisons[0].denom;

	// --- Act 1: Lifetime sim ---
	let simResult: LotteryLifetimeResult | null = $state(null);
	let simRunning = $state(false);
	let currentYear = $state(0);
	let animatedSpent = $state(0);
	let animatedWon = $state(0);
	let animatedJackpots = $state(0);
	let animDone = $state(false);
	let recentPrize: { amount: number; key: number } | null = $state(null);
	let recentPrizeKey = 0;
	let recentPrizeTimeout: ReturnType<typeof setTimeout> | null = null;
	let animInterval: ReturnType<typeof setInterval> | null = null;

	// Cumulative lifetime counter
	let lifetimesRun = $state(0);
	let lifetimeTotalTickets = $state(0);
	let lifetimeTotalJackpots = $state(0);

	function finishSim(result: LotteryLifetimeResult) {
		// Jump to final state
		let cumSpent = 0, cumWon = 0, cumJackpots = 0;
		for (const yr of result.years) {
			cumSpent += yr.spent;
			cumWon += yr.won;
			cumJackpots += yr.jackpots;
		}
		currentYear = YEARS;
		animatedSpent = cumSpent;
		animatedWon = cumWon;
		animatedJackpots = cumJackpots;
		simRunning = false;
		animDone = true;
		recentPrize = null;
		if (animInterval) { clearInterval(animInterval); animInterval = null; }
		lifetimesRun++;
		lifetimeTotalTickets += result.totalTickets;
		lifetimeTotalJackpots += result.jackpots;
	}

	let lotteryTickCount = 0;

	function runLifetimeSim() {
		if (simRunning) return;
		play('click');
		lotteryTickCount = 0;

		// Run simulation instantly
		const result = simulateLotteryLifetime(TICKETS_PER_DAY, YEARS, TICKET_COST);
		simResult = result;
		simRunning = true;
		animDone = false;
		currentYear = 0;
		animatedSpent = 0;
		animatedWon = 0;
		animatedJackpots = 0;
		recentPrize = null;

		// Animate year by year
		let yearIdx = 0;
		let cumSpent = 0;
		let cumWon = 0;
		let cumJackpots = 0;

		animInterval = setInterval(() => {
			if (yearIdx >= result.years.length) {
				finishSim(result);
				return;
			}

			const yr = result.years[yearIdx];
			cumSpent += yr.spent;
			cumWon += yr.won;
			cumJackpots += yr.jackpots;
			currentYear = yr.year;
			animatedSpent = cumSpent;
			animatedWon = cumWon;
			animatedJackpots = cumJackpots;
			lotteryTickCount++;
			if (lotteryTickCount % 5 === 0) play('tick');

			// Flash biggest prize this year (keyed so same value re-triggers)
			if (yr.biggestPrize >= 1_000_000) {
				play('jackpot');
			} else if (yr.biggestPrize >= 7) {
				play('reveal');
			}
			if (yr.biggestPrize >= 7) {
				recentPrize = { amount: yr.biggestPrize, key: ++recentPrizeKey };
				if (recentPrizeTimeout) clearTimeout(recentPrizeTimeout);
				recentPrizeTimeout = setTimeout(() => { recentPrize = null; }, 400);
			}

			yearIdx++;
		}, 60);
	}

	function skipAnim() {
		if (!simResult || !simRunning) return;
		finishSim(simResult);
	}

	let netLoss = $derived(simResult ? animatedSpent - animatedWon : 0);

	// Commentary after sim completes
	let lifetimeCommentary = $derived.by(() => {
		if (!simResult || !animDone) return null;
		const totalTickets = simResult.totalTickets;
		const oddsOneLife = Math.round(JACKPOT_ODDS / totalTickets);
		if (simResult.jackpots === 0) {
			return `${totalTickets.toLocaleString('en-US')} tickets. Zero jackpots. The probability said 1 in ${oddsOneLife.toLocaleString('en-US')}. It was right.`;
		}
		return `This simulation hit a jackpot, a 0.06% event. Run it again. See how many lifetimes pass before the next one.`;
	});

	// --- Act 2: Population scale-up ---
	const POPULATIONS = [
		{ label: 'You', people: 1, detail: '1 person' },
		{ label: 'Family', people: 5, detail: '5 people' },
		{ label: 'Block', people: 50, detail: '50 people' },
		{ label: 'Town', people: 500, detail: '500 people' },
		{ label: 'Stadium', people: 50_000, detail: '50,000 people' },
	];

	let popLevel = $state(0);
	let popStats = $derived(
		computeLotteryPopulationStats(POPULATIONS[popLevel].people, TICKETS_PER_DAY, YEARS, TICKET_COST)
	);

	let popCommentary = $derived.by(() => {
		const p = POPULATIONS[popLevel];
		const prob = popStats.probAtLeastOneJackpot;
		const spent = moneyCompact(popStats.totalSpent);
		if (prob < 0.01) {
			return `${p.detail}, ${YEARS} years each, ${spent} spent. Probability of a single jackpot: ${(prob * 100).toFixed(3)}%. Effectively zero.`;
		}
		if (prob < 0.5) {
			return `${p.detail}, every one buying ${TICKETS_PER_DAY} tickets a day for ${YEARS} years. ${spent} spent. ${Math.round((1 - prob) * 100)}% chance not a single jackpot.`;
		}
		if (popStats.expectedJackpots < 5) {
			return `${p.detail}. ${spent} spent across all their lifetimes. Expected jackpots: ${popStats.expectedJackpots.toFixed(1)}. The cost per expected jackpot: ${moneyCompact(popStats.totalSpent / popStats.expectedJackpots)}.`;
		}
		return `${p.detail}. ${spent} spent. ~${Math.round(popStats.expectedJackpots)} jackpots expected, but the total prize money is a fraction of what was spent.`;
	});

	// --- Act 3: Opportunity cost ---
	// $20/day invested at 7% annual return for 50 years
	// FV of daily annuity: PMT × (((1 + r/365)^(365*n) - 1) / (r/365))
	const dailyRate = 0.07 / 365;
	const investmentFV = Math.round(DAILY_COST * ((Math.pow(1 + dailyRate, 365 * YEARS) - 1) / dailyRate));
	const totalLotterySpend = TICKETS_PER_DAY * 365 * YEARS * TICKET_COST;
	// Expected small-prize return over a lifetime (from stats)
	const lifetimeExpectedReturn = computeLotteryPopulationStats(1, TICKETS_PER_DAY, YEARS, TICKET_COST).expectedSmallWinnings;
	const investPct = 100; // reference bar
	const lotteryReturnPct = Math.round((lifetimeExpectedReturn / investmentFV) * 100);

	$effect(() => {
		if (!animDone || !simResult) return;
		updateStats('lottery', {
			wagered: animatedSpent,
			net: animatedWon - animatedSpent,
			rounds: lifetimeTotalTickets,
		});
	});
</script>

<section class="px-5 py-16 md:px-10 md:py-24">
	<div class="max-w-4xl">
		<div use:inview class="fade-up">
			<h2 class="font-headline text-4xl md:text-6xl mb-2">THE LOTTERY</h2>
			<p class="text-muted text-sm uppercase tracking-widest mb-8">
				The worst expected value in gambling
			</p>
		</div>

		<div use:inview class="fade-up max-w-2xl mb-10">
			<p class="text-base md:text-lg leading-relaxed mb-4">
				A Powerball ticket costs $2. The non-jackpot prizes return about
				<strong class="font-mono text-loss">$0.32</strong> on average.<Ref num={1}>Powerball prize structure and odds from <a href="https://www.powerball.com/about/odds-chart" target="_blank" rel="noopener">Powerball.com</a>. Non-jackpot EV computed from fixed prize tiers.</Ref>
				The jackpot adds a variable amount depending on its size, but even at
				record highs the total expected value rarely exceeds $1. Most drawings,
				you're looking at a <strong class="font-mono text-loss">>50%</strong> house edge.
			</p>
			<p class="text-base md:text-lg leading-relaxed mb-4">
				"Someone has to win." And someone will, eventually. But you only see
				winners because winning is news. Lottery ads show the one person holding
				an oversized check, not the 292 million who bought tickets that week and
				lost. This is survivorship bias: judging the game by its most visible
				outcome, not its most common one. For every jackpot story on the news,
				there are millions of $2 receipts in the trash.
			</p>
			<p class="text-base md:text-lg leading-relaxed">
				Ten tickets a day for 50 years is {(TICKETS_PER_DAY * 365 * YEARS).toLocaleString('en-US')} tickets.
				Total cost: <strong class="font-mono">{moneyWhole(totalLotterySpend)}</strong>.
				Your cumulative odds of hitting the jackpot:
				<strong class="font-mono text-loss">1 in {Math.round(JACKPOT_ODDS / (TICKETS_PER_DAY * 365 * YEARS)).toLocaleString('en-US')}</strong>.
			</p>
		</div>

		<!-- Odds comparison chart (true linear scale) -->
		<div use:inview class="fade-up sim-box mb-8">
			<div class="text-xs uppercase tracking-widest text-muted mb-5">
				Things more likely than winning the Powerball
			</div>

			<div class="space-y-4">
				{#each comparisons as item}
					<div>
						<div class="flex justify-between items-baseline mb-1">
							<span class="text-sm font-medium">{item.event}</span>
							<span class="font-mono text-xs text-muted ml-2 shrink-0">{item.odds}{#if item.ref === 3}<Ref num={3}>National Weather Service, <a href="https://www.weather.gov/safety/lightning-odds" target="_blank" rel="noopener">"How Dangerous Is Lightning?"</a></Ref>{:else if item.ref === 4}<Ref num={4}>United States Bowling Congress (USBC) statistics on 300 games.</Ref>{:else if item.ref === 5}<Ref num={5}>Florida Museum International Shark Attack File, 2021 data. <a href="https://www.floridamuseum.ufl.edu/shark-attacks/odds/calculator/" target="_blank" rel="noopener">ISAF</a></Ref>{:else if item.ref === 6}<Ref num={6}>Barnett, A. "Aviation Safety: A Whole New World?" <em>Transportation Science</em>, 2024; MIT data: 1 in 13.7M per boarding.</Ref>{/if}</span>
						</div>
						<div class="h-2.5 bg-ink/5 relative">
							<div
								class="h-full bg-ink/60 transition-all duration-700"
								style="width: {(minDenom / item.denom) * 100}%"
							></div>
						</div>
					</div>
				{/each}

				<!-- Powerball: true scale (invisible) -->
				<div>
					<div class="flex justify-between items-baseline mb-1">
						<span class="text-sm font-bold text-loss">Winning the Powerball</span>
						<span class="font-mono text-xs text-loss ml-2 shrink-0">1 in 292,201,338</span>
					</div>
					<div class="h-2.5 bg-ink/5 relative">
						<div class="h-full bg-loss/70" style="width: {(minDenom / POWERBALL_DENOM) * 100}%"></div>
					</div>
				</div>

				<!-- Powerball: zoomed callout -->
				<div class="border border-border/60 px-3 py-2.5 -mt-1.5">
					<div class="flex items-center gap-1.5 mb-1.5">
						<IconZoomIn size={13} class="text-muted opacity-60" />
						<span class="font-mono text-xs text-muted">magnified 1,000×</span>
					</div>
					<div class="h-2.5 bg-ink/5 relative">
						<div class="h-full bg-loss/70" style="width: {(minDenom / POWERBALL_DENOM) * 100 * 1_000}%"></div>
					</div>
					<div class="font-mono text-xs text-muted mt-1.5">
						That sliver is the Powerball, magnified a thousand times.
					</div>
				</div>
			</div>
		</div>

		<!-- ═══════════ ACT 1: YOUR LIFETIME ═══════════ -->
		<div use:inview class="fade-up terminal-box mb-8">
			<div class="terminal-label mb-5">
				Lifetime simulator / {TICKETS_PER_DAY} tickets per day / {YEARS} years
			</div>

			{#if !simResult}
				<!-- Pre-sim -->
				<div class="mb-5">
					<p class="text-sm terminal-text mb-3">
						You buy {TICKETS_PER_DAY} Powerball tickets every day, ${DAILY_COST}/day, for the rest of your working life.
						{(TICKETS_PER_DAY * 365 * YEARS).toLocaleString('en-US')} tickets. {moneyWhole(totalLotterySpend)} spent.
					</p>
					<p class="text-sm terminal-muted">
						How many jackpots do you hit?
					</p>
				</div>
				<button onclick={runLifetimeSim} class="terminal-btn-primary">
					<IconPlayerPlay size={16} />
					<span>SIMULATE YOUR LIFETIME</span>
				</button>
			{:else}
				<!-- During / after sim -->
				<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
					<div>
						<div class="terminal-stat-label">Year</div>
						<div class="terminal-stat">{currentYear}<span class="terminal-muted text-lg">/{YEARS}</span></div>
					</div>
					<div>
						<div class="terminal-stat-label">Spent</div>
						<div class="terminal-stat text-[#c53030]">{moneyWhole(animatedSpent)}</div>
					</div>
					<div>
						<div class="terminal-stat-label">Won back</div>
						<div class="terminal-stat" class:text-[#ffd43b]={animatedWon > 0}>{moneyWhole(animatedWon)}</div>
					</div>
					<div>
						<div class="terminal-stat-label">Jackpots</div>
						<div class="terminal-stat-jackpot" class:jackpot-zero={animatedJackpots === 0} class:jackpot-hit={animatedJackpots > 0}>
							{animatedJackpots}
						</div>
					</div>
				</div>

				<!-- Net loss -->
				{#if netLoss > 0}
					<div class="flex items-baseline gap-2 mb-4">
						<span class="terminal-stat-label">Net</span>
						<span class="font-mono text-xl font-bold text-[#c53030]">-{moneyWhole(netLoss)}</span>
					</div>
				{/if}

				<!-- Prize flash -->
				{#if recentPrize !== null}
					{#key recentPrize.key}
						<div class="prize-flash">
							Won ${recentPrize.amount.toLocaleString('en-US')}
						</div>
					{/key}
				{/if}

				<!-- Skip button during animation -->
				{#if simRunning}
					<button onclick={skipAnim} class="terminal-btn text-xs mt-2">
						SKIP
					</button>
				{/if}

				<!-- Commentary + controls (after sim) -->
				{#if animDone}
					{#if lifetimeCommentary}
						<div class="text-sm py-2 border-l-2 border-[#4dabf7] pl-3 mb-5 text-[#4dabf7]">
							{lifetimeCommentary}
						</div>
					{/if}

					<div class="flex flex-wrap items-center gap-4">
						<button onclick={runLifetimeSim} class="terminal-btn">
							RUN AGAIN
						</button>
						{#if lifetimesRun > 1}
							<span class="text-xs terminal-muted font-mono">
								{lifetimesRun} lifetimes. {lifetimeTotalTickets.toLocaleString('en-US')} tickets. Jackpots: {lifetimeTotalJackpots}.
							</span>
						{/if}
					</div>
				{/if}
			{/if}
		</div>

		<!-- ═══════════ ACT 2: SCALE UP ═══════════ -->
		<div use:inview class="fade-up terminal-box mb-8">
			<div class="terminal-label mb-2">
				What if it wasn't just you?
			</div>
			<p class="text-sm terminal-muted mb-5">
				Everyone buys {TICKETS_PER_DAY} tickets/day for {YEARS} years. Same math, more people.
			</p>

			<!-- Population selector -->
			<div class="flex flex-wrap gap-2 mb-5">
				{#each POPULATIONS as pop, i}
					<button
						onclick={() => popLevel = i}
						class="terminal-btn"
						class:terminal-btn-active={popLevel === i}
					>
						{pop.label}
					</button>
				{/each}
			</div>

			<!-- Stats -->
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
				<div>
					<div class="terminal-stat-label">People</div>
					<div class="terminal-stat">{POPULATIONS[popLevel].people.toLocaleString('en-US')}</div>
				</div>
				<div>
					<div class="terminal-stat-label">Total tickets</div>
					<div class="terminal-stat">{compact(popStats.totalTickets)}</div>
				</div>
				<div>
					<div class="terminal-stat-label">Total spent</div>
					<div class="terminal-stat text-[#c53030]">{moneyCompact(popStats.totalSpent)}</div>
				</div>
				<div>
					<div class="terminal-stat-label">Expected jackpots</div>
					<div class="terminal-stat" class:text-[#ffd43b]={popStats.expectedJackpots >= 1}>
						{popStats.expectedJackpots < 0.01
							? popStats.expectedJackpots.toFixed(4)
							: popStats.expectedJackpots < 1
								? popStats.expectedJackpots.toFixed(2)
								: popStats.expectedJackpots.toFixed(1)}
					</div>
				</div>
			</div>

			<!-- Probability bar -->
			<div class="mb-5">
				<div class="flex justify-between items-baseline mb-1.5">
					<span class="text-xs terminal-muted uppercase tracking-wide">Probability of at least 1 jackpot</span>
					<span class="font-mono text-sm font-bold"
						class:text-[#c53030]={popStats.probAtLeastOneJackpot < 0.5}
						class:text-[#ffd43b]={popStats.probAtLeastOneJackpot >= 0.5}
					>
						{(popStats.probAtLeastOneJackpot * 100).toFixed(popStats.probAtLeastOneJackpot < 0.01 ? 3 : 1)}%
					</span>
				</div>
				<div class="h-3 bg-[#161b22] border border-[#30363d]">
					<div
						class="h-full transition-all duration-500"
						class:bg-[#c53030]={popStats.probAtLeastOneJackpot < 0.5}
						class:bg-[#ffd43b]={popStats.probAtLeastOneJackpot >= 0.5}
						style="width: {Math.max(popStats.probAtLeastOneJackpot * 100, 0.5)}%"
					></div>
				</div>
			</div>

			<!-- Commentary -->
			<div class="text-sm py-2 border-l-2 border-[#30363d] pl-3 terminal-muted">
				{popCommentary}
			</div>
		</div>

		<!-- ═══════════ ACT 3: OPPORTUNITY COST ═══════════ -->
		<div use:inview class="fade-up">
			<div class="stat-huge text-loss mb-2">{moneyWhole(totalLotterySpend)}</div>
			<p class="text-sm text-muted max-w-md mb-6">
				Cost of {TICKETS_PER_DAY} Powerball tickets per day for {YEARS} years.
			</p>

			<div class="max-w-lg mb-6">
				<div class="flex items-center gap-3 mb-3">
					<div class="flex-1">
						<div class="text-xs text-muted uppercase tracking-wide mb-1">Lottery: won back in small prizes</div>
						<div class="h-5 bg-ink/5 relative">
							<div class="h-full bg-loss/60" style="width: {lotteryReturnPct}%"></div>
						</div>
					</div>
					<div class="font-mono text-sm font-bold text-loss shrink-0 w-20 text-right">
						~{moneyCompact(lifetimeExpectedReturn)}
					</div>
				</div>
				<div class="flex items-center gap-3">
					<div class="flex-1">
						<div class="text-xs text-muted uppercase tracking-wide mb-1">${DAILY_COST}/day invested at 7%</div>
						<div class="h-5 bg-ink/5 relative">
							<div class="h-full bg-house/60" style="width: {investPct}%"></div>
						</div>
					</div>
					<div class="font-mono text-sm font-bold text-house shrink-0 w-20 text-right">
						{moneyCompact(investmentFV)}
					</div>
				</div>
			</div>

			<p class="text-sm text-muted max-w-md">
				Same ${DAILY_COST}/day. Same {YEARS} years. The lottery gives you back
				<span class="font-mono font-bold text-loss">~{Math.round((lifetimeExpectedReturn / totalLotterySpend) * 100)}%</span>
				of what you put in.<Ref num={2}>FV of ${DAILY_COST}/day annuity at 7% for {YEARS} years with daily compounding.</Ref>
				The market gives you
				<span class="font-mono font-bold text-house">{moneyCompact(investmentFV)}</span>.
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

	/* ── Terminal theme ── */
	.terminal-box {
		background: #0d1117;
		border: 1px solid #30363d;
		padding: 1.25rem;
		color: #c9d1d9;
		font-variant-numeric: tabular-nums;
	}
	@media (min-width: 768px) {
		.terminal-box { padding: 1.75rem; }
	}

	.terminal-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #4dabf7;
	}
	.terminal-text {
		color: #c9d1d9;
	}
	.terminal-muted {
		color: #6e7681;
	}

	.terminal-stat-label {
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #6e7681;
		margin-bottom: 0.15rem;
	}
	.terminal-stat {
		font-family: ui-monospace, monospace;
		font-size: 1.25rem;
		font-weight: 700;
		color: #c9d1d9;
		line-height: 1.2;
	}
	@media (min-width: 768px) {
		.terminal-stat { font-size: 1.5rem; }
	}

	.terminal-stat-jackpot {
		font-family: ui-monospace, monospace;
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1.2;
	}
	@media (min-width: 768px) {
		.terminal-stat-jackpot { font-size: 2rem; }
	}
	.jackpot-zero {
		color: #6e7681;
	}
	.jackpot-hit {
		color: #ffd43b;
		animation: jackpotPulse 600ms ease-out;
	}

	/* Buttons */
	.terminal-btn, .terminal-btn-primary {
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
	.terminal-btn {
		border: 1px solid #30363d;
		color: #6e7681;
		background: transparent;
	}
	.terminal-btn:hover {
		border-color: #4dabf7;
		color: #4dabf7;
		background: #161b22;
	}
	.terminal-btn-active {
		border-color: #4dabf7 !important;
		color: #c9d1d9 !important;
		background: #1a2332 !important;
	}
	.terminal-btn-primary {
		background: #4dabf7;
		color: #0d1117;
		border: none;
		font-weight: 600;
	}
	.terminal-btn-primary:hover {
		background: #6bc1ff;
	}
	.terminal-btn:disabled, .terminal-btn-primary:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	/* Prize flash */
	.prize-flash {
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		color: #ffd43b;
		padding: 0.25rem 0;
		animation: flashFade 400ms ease-out forwards;
	}
	@keyframes flashFade {
		0% { opacity: 1; }
		70% { opacity: 1; }
		100% { opacity: 0; }
	}

	@keyframes jackpotPulse {
		0% { transform: scale(1.3); }
		100% { transform: scale(1); }
	}

</style>
