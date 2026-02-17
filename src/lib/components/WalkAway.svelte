<script lang="ts">
	import { inview } from '$lib/utils/intersection';
	import { moneyWhole, pct } from '$lib/utils/format';
	import { simulateWalkAwayBatch, type WalkAwayResult } from '$lib/utils/random';
	import { play } from '$lib/utils/audio';

	const BANKROLL = 200;
	const BET = 10;
	const SESSIONS = 1000;

	const targets = [
		{ label: '+$50', value: 50 },
		{ label: '+$100', value: 100 },
		{ label: '+$200', value: 200 },
	];

	let selectedTarget = $state(50);
	let result: WalkAwayResult | null = $state(null);
	let running = $state(false);

	let avgFormatted = $derived(
		result ? (result.avgNet >= 0 ? '+' : '') + moneyWhole(result.avgNet) : ''
	);

	function run() {
		play('click');
		running = true;
		setTimeout(() => {
			result = simulateWalkAwayBatch(SESSIONS, BANKROLL, selectedTarget, BET);
			running = false;
		}, 0);
	}

	function pick(value: number) {
		play('click');
		selectedTarget = value;
		result = null;
	}
</script>

<section class="px-5 py-16 md:px-10 md:py-24">
	<div class="max-w-4xl">

		<div use:inview class="fade-up">
			<h2 class="font-headline text-4xl md:text-6xl mb-2">THE EXIT STRATEGY</h2>
			<p class="text-muted text-sm uppercase tracking-widest mb-8">
				Why "quit while you're ahead" doesn't work
			</p>
		</div>

		<div use:inview class="fade-up max-w-2xl mb-10">
			<p class="text-base md:text-lg leading-relaxed mb-4">
				Every gambler has a plan: win a little, walk away, stay disciplined.
				The Martingale system tries to guarantee wins. This one tries to
				guarantee exits. Set a target, hit it, leave the table.
			</p>
			<p class="text-base md:text-lg leading-relaxed">
				It sounds like it works because it <em>does</em> produce winning sessions,
				more than half the time. What it hides is the asymmetry: when you win,
				you win your small target. When you lose, you lose your entire bankroll.
				The house edge doesn't disappear; it concentrates into fewer, bigger losses.
			</p>
		</div>

		<div use:inview class="fade-up sim-box mb-6">
			<div class="text-xs uppercase tracking-widest text-muted mb-5">
				Walk-Away Simulator / ${BANKROLL} bankroll &bull; ${BET} flat bets &bull; roulette (red/black)
			</div>

			<div class="mb-5">
				<div class="text-sm text-muted mb-2">Profit target: walk away when you're up</div>
				<div class="flex flex-wrap gap-2">
					{#each targets as t}
						<button
							class="wa-btn"
							class:wa-btn-active={selectedTarget === t.value}
							onclick={() => pick(t.value)}
							disabled={running}
						>
							{t.label}
						</button>
					{/each}
				</div>
			</div>

			<button
				class="wa-run"
				onclick={run}
				disabled={running}
			>
				{running ? 'RUNNING...' : result ? 'RUN AGAIN' : 'RUN 1,000 SESSIONS'}
			</button>

			{#if result}
				<div class="mt-6">
					<div class="text-xs text-muted uppercase tracking-wide mb-2">
						1,000 sessions:
						<span class="text-house">hit target</span> /
						<span class="text-loss">went broke</span>
					</div>
					<div class="dot-strip">
						{#each result.sessions as hit}
							<div class="dot-pip" class:pip-hit={hit} class:pip-bust={!hit}></div>
						{/each}
					</div>
				</div>

				<div class="border-t border-border pt-4 mt-4">
					<div class="flex flex-wrap gap-x-8 gap-y-3 mb-4">
						<div>
							<div class="text-xs text-muted uppercase tracking-wide mb-0.5">Hit target</div>
							<div class="font-mono text-2xl font-bold text-house">
								{result.hitCount.toLocaleString('en-US')}
								<span class="text-sm font-normal text-muted ml-1">({pct(result.hitCount / SESSIONS)})</span>
							</div>
						</div>
						<div>
							<div class="text-xs text-muted uppercase tracking-wide mb-0.5">Went broke</div>
							<div class="font-mono text-2xl font-bold text-loss">
								{result.brokeCount.toLocaleString('en-US')}
								<span class="text-sm font-normal text-muted ml-1">({pct(result.brokeCount / SESSIONS)})</span>
							</div>
						</div>
						<div>
							<div class="text-xs text-muted uppercase tracking-wide mb-0.5">Avg per session</div>
							<div class="font-mono text-2xl font-bold text-loss">
								{avgFormatted}
							</div>
						</div>
					</div>

					<div class="insight-callout">
						<span class="font-mono font-bold text-house">{pct(result.hitCount / SESSIONS)}</span>
						walked away winners.
						The average session still lost
						<span class="font-mono font-bold text-loss">{moneyWhole(Math.abs(result.avgNet))}</span>.
						Small wins, total losses.
					</div>
				</div>
			{/if}
		</div>

		<div use:inview class="fade-up max-w-2xl mt-10 mb-8">
			<p class="text-base md:text-lg leading-relaxed mb-4">
				"I only gamble occasionally." A few times a year, each time with
				a budget and a plan. Each casino visit is one of the sessions above:
				a night out, a trip to Vegas, a birthday poker game. The math doesn't
				change because the visits are spread out.
			</p>
			<p class="text-base md:text-lg leading-relaxed mb-4">
				The exit strategy makes losses feel like bad luck and wins feel
				like discipline, but discipline was never the variable. The
				<strong class="font-mono">5.26%</strong> edge was there before
				you sat down and it's there after you leave.
			</p>
			<p class="text-base md:text-lg leading-relaxed mb-4">
				There's no visit frequency that changes the underlying math.
				Occasional gamblers pay the same expected loss per dollar wagered
				as daily gamblers. The house doesn't give a discount for moderation.
			</p>
			<p class="text-base md:text-lg leading-relaxed">
				The exit plan also assumes you'll follow it. When you're down
				$150 of your $200, walking away feels like accepting defeat, so
				you keep playing to "win it back." This is loss chasing, the sunk
				cost fallacy applied to gambling, and the single most reliable way
				to turn a bad session into a catastrophe. The money already lost
				doesn't come back with more bets. It compounds.
			</p>
		</div>

		<div use:inview class="fade-up pl-6 border-l-3 border-ink">
			<p class="font-headline text-2xl md:text-3xl leading-tight">
				MORE THAN HALF WALKED AWAY WINNERS.<br />
				EVERYONE STILL LOST MONEY.
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

	/* Buttons */
	.wa-btn,
	.wa-run {
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
	.wa-btn {
		border: 1px solid var(--color-border);
		color: var(--color-ink);
		background: transparent;
	}
	.wa-btn:hover:not(:disabled) {
		background: var(--color-ink);
		color: var(--color-cream);
	}
	.wa-btn-active {
		background: var(--color-ink);
		color: var(--color-cream);
		border-color: var(--color-ink);
	}
	.wa-run {
		background: var(--color-ink);
		color: var(--color-cream);
		border: 1px solid var(--color-ink);
	}
	.wa-run:hover:not(:disabled) {
		background: #333;
	}
	.wa-btn:disabled,
	.wa-run:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	/* 1,000-session dot strip */
	.dot-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
	}
	.dot-pip {
		width: 7px;
		height: 7px;
		border-radius: 1px;
		background: var(--color-border);
	}
	.pip-hit {
		background: var(--color-house);
		opacity: 0.8;
	}
	.pip-bust {
		background: var(--color-loss);
		opacity: 0.8;
	}

	/* Insight callout - tinted warning box */
	.insight-callout {
		padding: 0.75rem 1rem;
		background: color-mix(in srgb, var(--color-loss) 6%, var(--color-cream) 94%);
		border-left: 3px solid var(--color-loss);
		font-size: 0.9375rem;
		line-height: 1.6;
	}
</style>
