<script lang="ts">
	import { inview } from '$lib/utils/intersection';
	import { stats } from '$lib/stores/simStats.svelte';
	import { money, moneyWhole } from '$lib/utils/format';
	import Ref from '$lib/components/Ref.svelte';
	import { play } from '$lib/utils/audio';

	let nonLotteryPlayed = $derived(stats.gamesPlayed.filter(id => id !== 'lottery'));
	let hasNonLottery = $derived(nonLotteryPlayed.length > 0);
	let primaryNet = $derived(hasNonLottery ? stats.totalNet : stats.lotteryStats.net);
	let gameCount = $derived(nonLotteryPlayed.length);

	let primaryFormatted = $derived((primaryNet >= 0 ? '+' : '') + moneyWhole(primaryNet));
	let amtSize = $derived(
		primaryFormatted.length >= 11 ? 'amt-sm' :
		primaryFormatted.length >= 8 ? 'amt-md' :
		'amt-lg'
	);

	let copied = $state(false);
	function copyUrl() {
		play('click');
		navigator.clipboard.writeText('https://youlo.se').then(() => {
			copied = true;
			setTimeout(() => copied = false, 2000);
		});
	}
</script>

<section class="px-5 py-20 md:px-10 md:py-32">
	<div class="closer-layout">
		<!-- Left column: main content -->
		<div>
			<div use:inview class="fade-up">
				<h2 class="font-headline text-5xl md:text-7xl lg:text-8xl mb-8">
					STOP.
				</h2>
			</div>

			{#if stats.hasAnyData && primaryNet < 0}
				<div use:inview class="fade-up mb-10 max-w-xl">
					<div class="your-results">
						<div class="primary-amount font-mono font-bold mb-2 {amtSize}"
							class:text-loss={primaryNet < 0}
							class:text-house={primaryNet > 0}>
							{primaryFormatted}
						</div>
						<div class="text-sm text-muted mb-4">
							{#if hasNonLottery}
								{primaryNet < 0 ? 'lost' : 'ahead'} across {gameCount} game{gameCount !== 1 ? 's' : ''} on this page
							{:else}
								lost in a 50-year lottery simulation
							{/if}
						</div>

						{#if hasNonLottery}
							<div class="space-y-1">
								{#each nonLotteryPlayed as id}
									{@const g = stats.games[id]}
									<div class="flex justify-between text-sm font-mono">
										<span class="text-muted">{g.label}</span>
										<span class="font-bold" class:text-loss={g.net < 0} class:text-house={g.net > 0}>
											{g.net >= 0 ? '+' : ''}{money(g.net)}
										</span>
									</div>
								{/each}
							</div>
						{/if}

						{#if stats.hasLotteryData && hasNonLottery}
							<div class="border-t border-border mt-3 pt-3">
								<div class="flex justify-between text-sm font-mono">
									<span class="text-muted">Lottery <span class="text-xs opacity-70">(50-yr sim)</span></span>
									<span class="font-bold text-loss">{moneyWhole(stats.lotteryStats.net)}</span>
								</div>
							</div>
						{/if}

						<p class="text-xs text-muted mt-4">
							These were simulations. In a real casino, this money is gone.
						</p>
					</div>
				</div>
			{/if}

			<div use:inview class="fade-up mb-10 max-w-xl">
				<p class="text-lg md:text-xl leading-relaxed mb-6">
					Every game on this page pays out less than it takes in, not on bad nights
					but by design. The house edge is a mathematical property of the rules,
					not a streak that can be broken.
				</p>
				<p class="text-base text-muted leading-relaxed">
					The average American household loses about $1,600 per year to gambling.<Ref num={1}>Bureau of Economic Analysis, Personal Consumption Expenditures: Gambling, 2024. ~$207B nationally / ~132.7M households ≈ $1,560/yr. <a href="https://www.bea.gov/data/consumer-spending/main" target="_blank" rel="noopener">BEA</a></Ref>
					Over 40 years that adds up to $64,000, which at average market returns
					would compound to roughly <strong class="font-mono text-house">$320,000</strong>
					by retirement.<Ref num={2}>FV of $1,600/yr annuity at 7% for 40 years = $1,600 × ((1.07<sup>40</sup> − 1) / 0.07) ≈ $319,600.</Ref>
				</p>
			</div>

			<div use:inview class="fade-up pl-6 border-l-3 border-ink max-w-xl">
				<p class="font-headline text-2xl md:text-3xl leading-tight mb-4">
					NOBODY IS THE EXCEPTION.
				</p>
				<p class="text-base leading-relaxed">
					None of the numbers on this page change based on how smart you are,
					how disciplined you are, or how much you study the game. They apply
					to everyone at the table. If someone you know gambles, they might
					not know that yet.
				</p>
			</div>
		</div>

		<!-- Right column: help resources -->
		<aside use:inview class="fade-up">
			<div class="help-box">
				<div class="text-xs uppercase tracking-widest text-muted mb-4">Get help</div>

				<div class="help-region">United States</div>
				<div class="help-entries">
					<div>
						<div class="font-medium">National Problem Gambling Helpline</div>
						<div class="font-mono font-bold">1-800-MY-RESET</div>
					</div>
					<div>
						<div class="font-medium">Crisis Text Line</div>
						<div class="font-mono text-muted">Text <strong class="text-ink">HOME</strong> to 741741</div>
					</div>
					<div>
						<a href="https://www.gamblersanonymous.org" target="_blank" rel="noopener" class="help-link">gamblersanonymous.org</a>
					</div>
				</div>

				<div class="help-region">United Kingdom</div>
				<div class="help-entries">
					<div>
						<div class="font-medium">GamCare</div>
						<div class="font-mono font-bold">0808 8020 133</div>
					</div>
					<div>
						<a href="https://www.gamcare.org.uk" target="_blank" rel="noopener" class="help-link">gamcare.org.uk</a>
					</div>
				</div>

				<div class="help-region">Europe</div>
				<div class="help-entries">
					<div>
						<div class="font-medium">Germany: BIOG</div>
						<div class="font-mono font-bold">0800 1 37 27 00</div>
					</div>
					<div>
						<div class="font-medium">France: Joueurs Info Service</div>
						<div class="font-mono font-bold">09 74 75 13 13</div>
					</div>
					<div>
						<div class="font-medium">Italy: Telefono Verde (ISS)</div>
						<div class="font-mono font-bold">800 558 822</div>
					</div>
					<div>
						<a href="https://www.easg.org" target="_blank" rel="noopener" class="help-link">easg.org</a>
					</div>
				</div>

				<div class="help-region">Australia & New Zealand</div>
				<div class="help-entries">
					<div>
						<div class="font-medium">Gambling Help Online (AU)</div>
						<div class="font-mono font-bold">1800 858 858</div>
					</div>
					<div>
						<div class="font-medium">Gambling Helpline (NZ)</div>
						<div class="font-mono font-bold">0800 654 655</div>
					</div>
				</div>

				<div class="help-region">Canada</div>
				<div class="help-entries last">
					<div>
						<div class="font-medium">ConnexOntario</div>
						<div class="font-mono font-bold">1-866-531-2600</div>
					</div>
					<div>
						<a href="https://www.responsiblegambling.org" target="_blank" rel="noopener" class="help-link">responsiblegambling.org</a>
					</div>
				</div>
			</div>
		</aside>
	</div>

	<!-- Footer -->
	<div use:inview class="fade-up mt-12">
		<hr class="divider-thin mb-6" />
		<div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
			<div class="font-headline text-lg">THE HOUSE ALWAYS WINS</div>
			<div class="flex items-center gap-3">
				<span class="text-xs text-muted">If this helped, pass it along.</span>
				<button onclick={copyUrl} class="copy-btn">
					{copied ? 'Copied' : 'Copy link'}
				</button>
			</div>
		</div>
	</div>
</section>

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

	.your-results {
		border: 1px solid var(--color-border);
		padding: 1.5rem;
		width: fit-content;
		min-width: 16rem;
		max-width: 100%;
	}

	/* Headline amount – three tiers so long numbers never overflow */
	.primary-amount { line-height: 1.1; }
	.amt-lg { font-size: 2.25rem; }   /* ≤7 chars  e.g. +$1,234 */
	.amt-md { font-size: 1.875rem; }  /* 8-10 chars e.g. -$12,345 */
	.amt-sm { font-size: 1.5rem; }    /* 11+ chars  e.g. -$332,053 */
	@media (min-width: 768px) {
		.amt-lg { font-size: 3.75rem; }  /* text-6xl */
		.amt-md { font-size: 2.625rem; } /* between text-4xl and text-5xl */
		.amt-sm { font-size: 2.25rem; }  /* text-4xl */
	}

	/* Two-column layout: content left, help sidebar right */
	.closer-layout {
		display: grid;
		grid-template-columns: 1fr;
		gap: 2.5rem;
	}
	@media (min-width: 1024px) {
		.closer-layout {
			grid-template-columns: minmax(0, 48rem) 20rem;
			gap: 3rem;
			align-items: start;
		}
	}

	/* Help box */
	.help-box {
		border: 1px solid var(--color-border);
		padding: 1.25rem;
		font-size: 0.8125rem;
	}
	@media (min-width: 1024px) {
		.help-box {
			position: sticky;
			top: 2rem;
		}
	}

	.help-region {
		font-size: 0.5625rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--color-muted);
		margin-bottom: 0.4rem;
	}

	.help-entries {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-bottom: 1.25rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid var(--color-border);
	}
	.help-entries.last {
		margin-bottom: 0;
		padding-bottom: 0;
		border-bottom: none;
	}

	.help-link {
		font-family: ui-monospace, monospace;
		font-size: 0.6875rem;
		color: var(--color-muted);
		text-decoration: underline;
		text-underline-offset: 2px;
		transition: color 150ms;
	}
	.help-link:hover {
		color: var(--color-ink);
	}

	.copy-btn {
		font-family: ui-monospace, monospace;
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		padding: 0.35rem 0.75rem;
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
		transition: color 150ms, border-color 150ms;
		white-space: nowrap;
	}
	.copy-btn:hover {
		color: var(--color-ink);
		border-color: var(--color-ink);
	}
</style>
