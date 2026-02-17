<script lang="ts">
	import { inview } from '$lib/utils/intersection';

	const edges = [
		{ game: 'Blackjack', edge: 1.5, note: 'typical player' },
		{ game: 'Sports Betting', edge: 4.5, note: 'standard -110' },
		{ game: 'Roulette', edge: 5.26, note: 'American double-zero' },
		{ game: 'Slots', edge: 8, note: 'typical average' },
		{ game: 'Scratch Tickets', edge: 35, note: 'varies by state' },
		{ game: 'Lottery (Powerball)', edge: 50, note: 'jackpot-dependent' },
	];

	// Build 100-cell grid for each game. Red cells = house edge (rounded).
	function makeGrid(edge: number): boolean[] {
		const redCount = Math.round(edge);
		return Array.from({ length: 100 }, (_, i) => i >= 100 - redCount);
	}
</script>

<section class="px-5 py-16 md:px-10 md:py-24">
	<div class="max-w-4xl">
		<div use:inview class="fade-up">
			<h2 class="font-headline text-4xl md:text-6xl mb-2">THE HOUSE EDGE</h2>
			<p class="text-muted text-sm uppercase tracking-widest mb-8">The percentage the house keeps, per game</p>
		</div>

		<div use:inview class="fade-up max-w-2xl mb-12">
			<p class="text-base md:text-lg leading-relaxed mb-4">
				That built-in cut has a name: the house edge. It's the percentage the casino
				expects to keep per bet, forever. Over enough bets, your results will
				converge on these numbers.
			</p>
			<p class="text-base md:text-lg leading-relaxed mb-4">
				Winning sessions happen because of variance, but variance works in both
				directions and the house edge only works in one. Given enough time,
				it always collects.
			</p>
			<p class="text-base md:text-lg leading-relaxed">
				"It's just entertainment" is the most common reframe: treat losses
				as the price of a good time. But name another form of entertainment
				that charges 5 to 50 cents on every dollar you put in, every time,
				with no cap. A movie ticket costs $15 and you keep $15 of value.
				A $15 roulette bet returns $14.21 on average. The difference funds the
				casino, and unlike any other entertainment, you don't know the final
				price until you've already paid it.
			</p>
		</div>

		<div use:inview class="fade-up">
			<div class="text-xs uppercase tracking-widest text-muted mb-5">
				Each grid = $100 wagered. <span class="text-loss">Red</span> = house keeps.
			</div>

			<div class="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
				{#each edges as item}
					{@const grid = makeGrid(item.edge)}
					<div class="edge-card">
						<div class="text-sm font-bold mb-0.5">{item.game}</div>
						{#if item.note}<div class="text-[10px] text-muted mb-1">{item.note}</div>{/if}
						<div class="dot-grid">
							{#each grid as isHouse}
								<div class="dot" class:dot-house={isHouse}></div>
							{/each}
						</div>
						<div class="flex items-baseline justify-between mt-1.5">
							<span class="font-mono text-xs text-loss font-bold">-{item.edge}%</span>
							<span class="font-mono text-xs text-muted">{(100 - item.edge).toFixed(item.edge % 1 ? 1 : 0)}% back</span>
						</div>
					</div>
				{/each}
			</div>

			<div class="mt-5 text-xs text-muted">
				Each square = $1. Blackjack: ~0.5% with perfect basic strategy, 1.5% for a typical player, 2-4% without any strategy.
				Slots from NGCB data. Scratch tickets vary by state (60-75% return). Lottery edge is jackpot-dependent.
			</div>
		</div>

		<div use:inview class="fade-up mt-12 pl-6 border-l-3 border-ink">
			<p class="font-headline text-2xl md:text-3xl leading-tight">
				THE HOUSE DOESN'T GAMBLE.<br />YOU DO.
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

	.edge-card {
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		background: color-mix(in srgb, var(--color-cream) 50%, white 50%);
	}

	.dot-grid {
		display: grid;
		grid-template-columns: repeat(10, 1fr);
		gap: 2px;
	}

	.dot {
		aspect-ratio: 1;
		background: color-mix(in srgb, var(--color-cream) 30%, white 70%);
		border: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent 50%);
	}
	.dot-house {
		background: var(--color-loss);
		border-color: var(--color-loss);
	}
</style>
