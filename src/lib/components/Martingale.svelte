<script lang="ts">
	import { inview } from '$lib/utils/intersection';
	import { money, moneyWhole } from '$lib/utils/format';
	import { play } from '$lib/utils/audio';
	import { simulateMartingale } from '$lib/utils/random';
	import IconPlayerPlay from '@tabler/icons-svelte/icons/player-play';
	import IconRefresh from '@tabler/icons-svelte/icons/refresh';
	import IconFastForward from '@tabler/icons-svelte/icons/player-track-next';

	const BANKROLL = 1000;
	const BET = 10;
	const TABLE_MAX = 5000;

	// Pre-compute the doubling escalation (static)
	const escalation: { streak: number; bet: number; totalLost: number; prob: number }[] = [];
	{
		let b = BET, lost = 0, s = 0;
		while (lost + b <= BANKROLL && b <= TABLE_MAX) {
			s++;
			lost += b;
			escalation.push({ streak: s, bet: b, totalLost: lost, prob: Math.pow(20 / 38, s) });
			b *= 2;
		}
	}
	const maxBet = escalation[escalation.length - 1].bet;
	const totalLostOnBust = escalation[escalation.length - 1].totalLost;
	const bustAfterLosses = escalation.length + 1;
	const winsToRecover = Math.ceil(totalLostOnBust / BET);

	// Single session simulation
	let simResult: { balances: number[]; busted: boolean; bustRound: number; peakBalance: number } | null = $state(null);
	let simRunning = $state(false);
	let simAnimIndex = $state(0);
	let simAnimDone = $state(false);

	function runSim(rounds: number) {
		play('chipDown');
		simResult = simulateMartingale(BANKROLL, BET, TABLE_MAX, rounds);
		simAnimIndex = 0;
		simAnimDone = false;
		simRunning = true;
		let i = 0;
		const totalFrames = simResult.balances.length - 1;
		const ms = Math.max(10, Math.min(40, Math.round(1200 / totalFrames)));
		const interval = setInterval(() => {
			i++;
			simAnimIndex = i;
			if (i >= totalFrames) {
				clearInterval(interval);
				simAnimDone = true;
				simRunning = false;
				if (simResult?.busted) play('bust');
			}
		}, ms);
	}

	function runSimInstant(rounds: number) {
		play('chipDown');
		simResult = simulateMartingale(BANKROLL, BET, TABLE_MAX, rounds);
		simAnimIndex = simResult.balances.length - 1;
		simAnimDone = true;
		if (simResult.busted) play('bust');
	}

	function clearSim() {
		simResult = null;
		simAnimIndex = 0;
		simAnimDone = false;
	}

	let simCurrentBalance = $derived.by(() => {
		if (simResult && simAnimIndex < simResult.balances.length) {
			return simResult.balances[simAnimIndex];
		}
		return BANKROLL;
	});
	let simPL = $derived(simCurrentBalance - BANKROLL);

	let simChartPath = $derived.by(() => {
		if (!simResult || simAnimIndex < 1) return '';
		const data = simResult.balances.slice(0, simAnimIndex + 1);
		const dataMax = Math.max(...data);
		const dataMin = Math.min(...data);
		const padding = Math.max((dataMax - dataMin) * 0.15, 20);
		const max = dataMax + padding;
		const min = Math.max(0, dataMin - padding);
		const range = max - min || 1;
		return data
			.map((v, i) => {
				const x = (i / Math.max(data.length - 1, 1)) * 100;
				const y = 100 - ((v - min) / range) * 100;
				return `${i === 0 ? 'M' : 'L'}${x},${y}`;
			})
			.join(' ');
	});

	let simStartLineY = $derived.by(() => {
		if (!simResult || simAnimIndex < 1) return 50;
		const data = simResult.balances.slice(0, simAnimIndex + 1);
		const dataMax = Math.max(...data);
		const dataMin = Math.min(...data);
		const padding = Math.max((dataMax - dataMin) * 0.15, 20);
		const max = dataMax + padding;
		const min = Math.max(0, dataMin - padding);
		const range = max - min || 1;
		return 100 - ((BANKROLL - min) / range) * 100;
	});

	let simCommentary = $derived.by(() => {
		if (!simResult || !simAnimDone) return null;
		const final_ = simResult.balances[simResult.balances.length - 1];
		const profit = final_ - BANKROLL;
		if (simResult.busted) {
			const streakLoss = simResult.peakBalance - final_;
			const peakProfit = simResult.peakBalance - BANKROLL;
			if (peakProfit > 0) {
				return `Was up ${money(peakProfit)} after ${simResult.bustRound - 1} rounds. Lost ${money(streakLoss)} in one streak when the next doubled bet exceeded the bankroll. ${winsToRecover} winning rounds erased.`;
			}
			return `Busted on round ${simResult.bustRound}. Lost ${money(streakLoss)} in a single doubling sequence.`;
		}
		if (profit > 0)
			return `Survived ${simResult.bustRound === -1 ? simResult.balances.length - 1 : simResult.bustRound} rounds, up ${money(profit)}. Run it again. The bust probability compounds every round.`;
		return `No bust, but marginal return. The strategy works until it doesn't.`;
	});

	// 10 Players: run until bust
	type PlayerResult = {
		rounds: number;
		peakProfit: number;
		netPL: number;
		busted: boolean;
	};

	let playerResults: PlayerResult[] = $state([]);

	function runPlayers() {
		play('chipDown');
		playerResults = Array.from({ length: 10 }, () => {
			const result = simulateMartingale(BANKROLL, BET, TABLE_MAX, 5000);
			const peak = Math.max(...result.balances) - BANKROLL;
			const final_ = result.balances[result.balances.length - 1];
			return {
				rounds: result.busted ? result.bustRound : result.balances.length - 1,
				peakProfit: peak,
				netPL: final_ - BANKROLL,
				busted: result.busted,
			};
		}).sort((a, b) => b.rounds - a.rounds);
	}

	let maxPlayerRounds = $derived(
		playerResults.length > 0 ? Math.max(...playerResults.map((p) => p.rounds)) : 1
	);
	let avgRounds = $derived(
		playerResults.length > 0
			? Math.round(playerResults.reduce((s, p) => s + p.rounds, 0) / playerResults.length)
			: 0
	);
	let totalNetPL = $derived(playerResults.reduce((s, p) => s + p.netPL, 0));
	let bustCount = $derived(playerResults.filter((p) => p.busted).length);
</script>

<section class="px-5 py-16 md:px-10 md:py-24">
	<div class="max-w-4xl">
		<div use:inview class="fade-up">
			<h2 class="font-headline text-4xl md:text-6xl mb-2">THE MARTINGALE DELUSION</h2>
			<p class="text-muted text-sm uppercase tracking-widest mb-8">
				The strategy that turns small wins into total losses
			</p>
		</div>

		<div use:inview class="fade-up max-w-2xl mb-8">
			<p class="text-base md:text-lg leading-relaxed mb-4">
				The Martingale strategy: bet $10 on red. If you lose, double to $20.
				Lose again, $40. Keep doubling until you win. When you win, you're $10 ahead.
				It sounds like free money.
			</p>
			<p class="text-base md:text-lg leading-relaxed mb-4">
				The problem is the risk profile. You're collecting many small gains that mask
				a rare but total loss. When you hit a losing streak long enough to exceed
				your bankroll, you lose everything you've accumulated and more.
			</p>
			<p class="text-base md:text-lg leading-relaxed">
				The doubling just changes <em>when</em> you lose, not <em>whether</em>.
			</p>
		</div>

		<!-- The Escalation -->
		<div use:inview class="fade-up sim-box mb-6">
			<div class="text-xs uppercase tracking-widest text-muted mb-5">
				The doubling sequence / $1,000 bankroll / $10 initial bet
			</div>

			<div class="space-y-2 mb-5">
				{#each escalation as row}
					<div class="flex items-center gap-3">
						<div class="w-14 shrink-0 text-xs font-mono text-muted">Loss {row.streak}</div>
						<div class="flex-1 relative h-5">
							<div
								class="h-full bg-loss"
								style="width: {Math.max(3, (row.bet / maxBet) * 100)}%; opacity: {0.25 + row.streak * 0.12}"
							></div>
						</div>
						<div class="w-16 shrink-0 text-right font-mono text-sm font-bold text-loss">
							{moneyWhole(row.bet)}
						</div>
						<div class="w-16 shrink-0 text-right font-mono text-xs text-muted">
							{(row.prob * 100).toFixed(1)}%
						</div>
					</div>
				{/each}
				<div class="flex items-center gap-3 pt-1">
					<div class="w-14 shrink-0 text-xs font-mono text-loss font-bold">Loss {bustAfterLosses}</div>
					<div class="flex-1 font-headline text-sm text-loss tracking-wide">
						BUST
					</div>
					<div class="w-16 shrink-0 text-right font-mono text-sm font-bold text-loss">
						{moneyWhole(maxBet * 2)}
					</div>
					<div class="w-16 shrink-0"></div>
				</div>
			</div>

			<div class="border-t border-border pt-4">
				<div class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
					<div>
						<span class="text-muted">Loss on bust:</span>
						<span class="font-mono font-bold text-loss ml-1">{moneyWhole(totalLostOnBust)}</span>
					</div>
					<div>
						<span class="text-muted">Win per round:</span>
						<span class="font-mono font-bold ml-1">{moneyWhole(BET)}</span>
					</div>
					<div>
						<span class="text-muted">Wins to recover:</span>
						<span class="font-mono font-bold text-loss ml-1">{winsToRecover}</span>
					</div>
				</div>
				<p class="text-sm text-muted mt-3">
					You need {winsToRecover} winning rounds to offset a single bust.
					Each round carries a {(escalation[escalation.length - 1].prob * 100).toFixed(1)}% chance of the bust sequence,
					roughly 1 in {Math.round(1 / escalation[escalation.length - 1].prob)} rounds.
				</p>
				<p class="text-sm text-muted mt-2">
					Stopping the doubling early doesn't help. If you cap at loss 3 and walk away, you've lost $70 instead of $630,
					but you've also given up the recovery that makes the strategy "work." Cap or don't cap,
					the 5.26% edge is baked into every spin.
				</p>
			</div>
		</div>

		<!-- Single session sim -->
		<div use:inview class="fade-up sim-box mb-6">
			<div class="flex items-center justify-between mb-5">
				<div class="text-xs uppercase tracking-widest text-muted">
					Martingale simulation
				</div>
				<button onclick={clearSim} class="text-muted hover:text-ink transition-colors" aria-label="Reset">
					<IconRefresh size={16} />
				</button>
			</div>

			<div class="flex flex-wrap gap-2 mb-5">
				<button onclick={() => runSim(50)} disabled={simRunning} class="mart-btn-primary">
					<IconPlayerPlay size={16} />
					<span>50 ROUNDS</span>
				</button>
				<button onclick={() => runSim(200)} disabled={simRunning} class="mart-btn">
					200
				</button>
				<button onclick={() => runSimInstant(500)} disabled={simRunning} class="mart-btn">
					<IconFastForward size={14} />
					<span>500</span>
				</button>
			</div>

			{#if simResult && simAnimIndex > 0}
				<div class="flex flex-wrap items-center gap-6 mb-5">
					<div>
						<div class="text-xs text-muted uppercase tracking-wide">Balance</div>
						<div class="font-mono text-2xl font-bold" class:text-loss={simPL < 0 || (simResult.busted && simAnimDone)} class:text-house={simPL > 0 && !(simResult.busted && simAnimDone)}>
							{money(simCurrentBalance)}
						</div>
					</div>
					<div>
						<div class="text-xs text-muted uppercase tracking-wide">Round</div>
						<div class="font-mono text-2xl font-bold">{simResult.busted && simAnimDone ? simResult.bustRound : simAnimIndex}{#if simAnimDone}/{simResult.busted ? simResult.bustRound : simResult.balances.length - 1}{/if}</div>
					</div>
					<div>
						<div class="text-xs text-muted uppercase tracking-wide">{simResult.busted && simAnimDone ? 'Streak loss' : 'P/L'}</div>
						{#if simResult.busted && simAnimDone}
							<div class="font-mono text-2xl font-bold text-loss">
								-{money(simResult.peakBalance - simCurrentBalance)}
							</div>
						{:else}
							<div class="font-mono text-2xl font-bold" class:text-loss={simPL < 0} class:text-house={simPL > 0}>
								{simPL >= 0 ? '+' : ''}{money(simPL)}
							</div>
						{/if}
					</div>
					{#if simResult.busted && simAnimDone}
						<div>
							<div class="text-xs text-muted uppercase tracking-wide">Status</div>
							<div class="font-headline text-2xl text-loss">BUST</div>
						</div>
					{/if}
				</div>

				<div class="w-full h-44 md:h-56 border border-border mb-1 bg-white/50">
					<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="w-full h-full">
						<line
							x1="0"
							y1={simStartLineY}
							x2="100"
							y2={simStartLineY}
							stroke="var(--color-border)"
							stroke-width="0.5"
							stroke-dasharray="2,2"
						/>
						<path
							d={simChartPath}
							fill="none"
							stroke={simPL < 0 ? 'var(--color-loss)' : 'var(--color-ink)'}
							stroke-width="1.2"
							vector-effect="non-scaling-stroke"
						/>
					</svg>
				</div>
				<div class="flex justify-between text-xs text-muted mb-5">
					<span>Round 1</span>
					<span class="font-mono opacity-60">dashed = $1,000 start</span>
					<span>Round {simAnimIndex}</span>
				</div>

				{#if simCommentary && simAnimDone}
					<div
						class="text-sm py-2 border-l-2 pl-3 transition-all duration-300"
						class:border-loss={simResult.busted || simPL <= 0}
						class:text-loss={simResult.busted}
						class:border-ink={!simResult.busted && simPL > 0}
					>
						{simCommentary}
					</div>
				{/if}
			{/if}
		</div>

		<!-- 10 Players: Run Until Bust -->
		<div use:inview class="fade-up sim-box">
			{#if playerResults.length === 0}
				<div class="text-xs uppercase tracking-widest text-muted mb-3">
					How long does the strategy last?
				</div>
				<p class="text-sm mb-4 max-w-lg">
					10 players sit down with $1,000 each. They play Martingale until they bust.
					Every single one will.
				</p>
				<button onclick={runPlayers} class="mart-btn-primary">RUN 10 PLAYERS</button>
			{:else}
				<div class="text-xs uppercase tracking-widest text-muted mb-4">
					10 players / Martingale until bust / $1,000 each
				</div>

				<div class="space-y-1.5 mb-5">
					{#each playerResults as player, i}
						<div class="flex items-center gap-3">
							<div class="w-5 text-xs font-mono text-muted text-right">{i + 1}</div>
							<div class="flex-1 relative h-5">
								<div
									class="h-full bg-loss"
									style="width: {Math.max(2, (player.rounds / maxPlayerRounds) * 100)}%; opacity: {player.busted ? 0.35 : 0.15}"
								></div>
							</div>
							<div class="w-24 shrink-0 text-right font-mono text-xs">
								{player.rounds.toLocaleString('en-US')} rounds
							</div>
							<div class="w-20 shrink-0 text-right font-mono text-xs font-bold text-loss">
								{moneyWhole(player.netPL)}
							</div>
						</div>
					{/each}
				</div>

				<div class="border-t border-border pt-4 mb-4">
					<div class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
						<div>
							<span class="text-muted">Avg rounds to bust:</span>
							<span class="font-mono font-bold ml-1">{avgRounds}</span>
						</div>
						<div>
							<span class="text-muted">Combined P&L:</span>
							<span class="font-mono font-bold text-loss ml-1">{moneyWhole(totalNetPL)}</span>
						</div>
					</div>
					<p class="text-sm text-muted mt-3">
						Every player busted. The longest-lasting player survived {Math.max(...playerResults.map((p) => p.rounds)).toLocaleString('en-US')} rounds.
						Combined, all 10 lost {moneyWhole(Math.abs(totalNetPL))}.
					</p>
				</div>

				<button onclick={runPlayers} class="mart-btn">RUN AGAIN</button>
			{/if}
		</div>

		<div use:inview class="fade-up mt-10 pl-6 border-l-3 border-loss">
			<p class="font-headline text-xl md:text-2xl leading-tight">
				THE STRATEGY DOESN'T CHANGE THE ODDS.<br />
				IT CHANGES WHEN YOU LOSE.
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
	:global(.in-view).fade-up,
	.fade-up:global(.in-view) {
		opacity: 1;
		transform: translateY(0);
	}

	.mart-btn,
	.mart-btn-primary {
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
	.mart-btn {
		border: 1px solid var(--color-border);
		color: var(--color-ink);
		background: transparent;
	}
	.mart-btn:hover:not(:disabled) {
		background: var(--color-ink);
		color: var(--color-cream);
	}
	.mart-btn-primary {
		background: var(--color-ink);
		color: var(--color-cream);
		border: 1px solid var(--color-ink);
	}
	.mart-btn-primary:hover:not(:disabled) {
		background: #333;
	}
	.mart-btn:disabled,
	.mart-btn-primary:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}
</style>
