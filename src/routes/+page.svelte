<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { replaceState } from '$app/navigation';
	import Hero from '$lib/components/Hero.svelte';
	import HouseEdge from '$lib/components/HouseEdge.svelte';
	import Roulette from '$lib/components/Roulette.svelte';
	import Martingale from '$lib/components/Martingale.svelte';
	import WalkAway from '$lib/components/WalkAway.svelte';
	import Blackjack from '$lib/components/Blackjack.svelte';
	import ScratchTickets from '$lib/components/ScratchTickets.svelte';
	import Slots from '$lib/components/Slots.svelte';
	import Crash from '$lib/components/Crash.svelte';
	import SportsBetting from '$lib/components/SportsBetting.svelte';
	import Lottery from '$lib/components/Lottery.svelte';
	import Closer from '$lib/components/Closer.svelte';
	import CollapsibleSection from '$lib/components/CollapsibleSection.svelte';
	import { toggleMute, getMuted } from '$lib/utils/audio';
	import { play } from '$lib/utils/audio';

	let audioMuted = $state(getMuted());

	const sections = [
		'hero',
		'house-edge',
		'roulette',
		'martingale',
		'walk-away',
		'blackjack',
		'slots',
		'scratch-tickets',
		'crash',
		'sports-betting',
		'lottery',
		'closer',
	] as const;

	const wallSections = [
		{ id: 'martingale', title: 'Martingale', subtitle: 'Doubling down always fails' },
		{ id: 'walk-away', title: 'Walk-Away', subtitle: 'Quitting ahead doesn\'t work' },
		{ id: 'blackjack', title: 'Blackjack', subtitle: 'Skill doesn\'t erase the edge' },
		{ id: 'slots', title: 'Slots', subtitle: 'Maximum extraction, minimum thought' },
		{ id: 'scratch-tickets', title: 'Scratchers', subtitle: 'Worse odds than any table' },
		{ id: 'crash', title: 'Crash', subtitle: 'Every cashout strategy loses' },
		{ id: 'sports-betting', title: 'Sports', subtitle: 'Knowledge doesn\'t beat the vig' },
		{ id: 'lottery', title: 'Lottery', subtitle: 'The worst expected value' },
	];

	let activeSection = $state('house-edge');

	// Collapsible section open states (bindable from CollapsibleSection)
	let openMartingale = $state(false);
	let openWalkAway = $state(false);
	let openBlackjack = $state(false);
	let openSlots = $state(false);
	let openScratchTickets = $state(false);
	let openCrash = $state(false);
	let openSportsBetting = $state(false);
	let openLottery = $state(false);

	let openStates = $derived({
		'martingale': openMartingale,
		'walk-away': openWalkAway,
		'blackjack': openBlackjack,
		'slots': openSlots,
		'scratch-tickets': openScratchTickets,
		'crash': openCrash,
		'sports-betting': openSportsBetting,
		'lottery': openLottery,
	} as Record<string, boolean>);

	// Open-only map for hash navigation on load
	const collapsibleOpen: Record<string, () => void> = {
		'martingale': () => { openMartingale = true; },
		'walk-away': () => { openWalkAway = true; },
		'blackjack': () => { openBlackjack = true; },
		'slots': () => { openSlots = true; },
		'scratch-tickets': () => { openScratchTickets = true; },
		'crash': () => { openCrash = true; },
		'sports-betting': () => { openSportsBetting = true; },
		'lottery': () => { openLottery = true; },
	};

	// Toggle map for the wall
	const collapsibleToggle: Record<string, () => void> = {
		'martingale': () => { openMartingale = !openMartingale; },
		'walk-away': () => { openWalkAway = !openWalkAway; },
		'blackjack': () => { openBlackjack = !openBlackjack; },
		'slots': () => { openSlots = !openSlots; },
		'scratch-tickets': () => { openScratchTickets = !openScratchTickets; },
		'crash': () => { openCrash = !openCrash; },
		'sports-betting': () => { openSportsBetting = !openSportsBetting; },
		'lottery': () => { openLottery = !openLottery; },
	};

	onMount(() => {
		// Instant scroll to hash on load — expand if collapsed
		if (location.hash) {
			const id = location.hash.slice(1);
			if (id in collapsibleOpen) {
				collapsibleOpen[id]();
			}
			tick().then(() => {
				const el = document.getElementById(id);
				if (el) el.scrollIntoView();
			});
		}

		// Track which section is in view and update hash
		const sectionEls = sections
			.map((id) => document.getElementById(id))
			.filter((el): el is HTMLElement => el !== null);

		let currentHash = location.hash.slice(1);
		let ticking = false;

		// Skip collapsed sections on desktop — they have height:0 but still trigger the observer
		const isDesktop = () => window.matchMedia('(min-width: 1280px)').matches;
		function isSectionVisible(id: string) {
			if (!isDesktop()) return true;
			if (id in collapsibleOpen) return openStates[id];
			return true;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (ticking) return;
				ticking = true;
				requestAnimationFrame(() => {
					// Find the topmost visible section
					let topSection = '';
					let topY = Infinity;
					for (const entry of entries) {
						if (entry.isIntersecting && isSectionVisible(entry.target.id)) {
							const rect = entry.boundingClientRect;
							if (rect.top < topY) {
								topY = rect.top;
								topSection = entry.target.id;
							}
						}
					}
					// Fallback: check all observed elements if none intersecting in this batch
					if (!topSection) {
						for (const el of sectionEls) {
							if (!isSectionVisible(el.id)) continue;
							const rect = el.getBoundingClientRect();
							if (rect.top < window.innerHeight * 0.5 && rect.bottom > 0) {
								topSection = el.id;
							}
						}
					}
					if (topSection && topSection !== currentHash) {
						currentHash = topSection;
						activeSection = topSection;
						replaceState(`#${topSection}`, {});
					}
					ticking = false;
				});
			},
			{ threshold: 0.15 }
		);

		for (const el of sectionEls) {
			observer.observe(el);
		}

		return () => observer.disconnect();
	});

	function wallToggle(id: string) {
		const wasOpen = openStates[id];
		play('click');
		collapsibleToggle[id]();
		if (!wasOpen) {
			// Opening — scroll to expanded section
			tick().then(() => {
				document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
			});
		} else {
			// Closing — scroll to section position to prevent jumping to page end
			tick().then(() => {
				document.getElementById(id)?.scrollIntoView({ behavior: 'instant' });
			});
		}
	}
</script>

<main>
	<div id="hero"><Hero /></div>

	<div class="nav-scope">
		<div id="house-edge"><HouseEdge /></div>
		<div id="roulette"><Roulette /></div>

		<div class="wall-scope">
			<aside class="section-wall" aria-label="Game sections">
				<div class="wall-track">
					{#each wallSections as item}
						<button
							class="wall-card"
							class:is-active={activeSection === item.id}
							class:is-open={openStates[item.id]}
							onclick={() => wallToggle(item.id)}
							aria-expanded={openStates[item.id]}
						>
							<div>
								<div class="wall-card-title">{item.title}</div>
								<div class="wall-card-subtitle">{item.subtitle}</div>
							</div>
							<svg
								class="wall-chevron"
								class:wall-chevron-open={openStates[item.id]}
								xmlns="http://www.w3.org/2000/svg"
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<polyline points="6 9 12 15 18 9"></polyline>
							</svg>
						</button>
					{/each}
				</div>
			</aside>

			<CollapsibleSection id="martingale" title="THE MARTINGALE DELUSION" subtitle="The strategy that turns small wins into total losses" bind:open={openMartingale}>
				<Martingale hideTitle />
			</CollapsibleSection>

			<CollapsibleSection id="walk-away" title="THE EXIT STRATEGY" subtitle={'Why "quit while you\'re ahead" doesn\'t work'} bind:open={openWalkAway}>
				<WalkAway hideTitle />
			</CollapsibleSection>

			<CollapsibleSection id="blackjack" title="BLACKJACK" subtitle="The skill game. The house edge is still there." bind:open={openBlackjack}>
				<Blackjack hideTitle />
			</CollapsibleSection>

			<CollapsibleSection id="slots" title="SLOT MACHINES" subtitle="Engineered to extract maximum money with minimum thought" bind:open={openSlots}>
				<Slots hideTitle />
			</CollapsibleSection>

			<CollapsibleSection id="scratch-tickets" title="SCRATCH TICKETS" subtitle="Worse than any table game, sold at every gas station" bind:open={openScratchTickets}>
				<ScratchTickets hideTitle />
			</CollapsibleSection>

			<CollapsibleSection id="crash" title="CRASH" subtitle="Every cashout strategy loses. Pick one and watch." bind:open={openCrash}>
				<Crash hideTitle />
			</CollapsibleSection>

			<CollapsibleSection id="sports-betting" title="SPORTS BETTING" subtitle="Knowledge doesn't beat the vig" bind:open={openSportsBetting}>
				<SportsBetting hideTitle />
			</CollapsibleSection>

			<CollapsibleSection id="lottery" title="THE LOTTERY" subtitle="The worst expected value in gambling" bind:open={openLottery}>
				<Lottery hideTitle />
			</CollapsibleSection>

			<div class="wall-bridge">
				<p class="font-headline text-2xl text-muted">EVERY GAME. SAME MATH.</p>
				<p class="text-sm text-muted mt-2">Pick one to see for yourself.</p>
			</div>
		</div>
	</div>

	<div id="closer"><Closer /></div>
</main>

<!-- Global mute toggle -->
<button
	class="mute-toggle"
	onclick={() => { audioMuted = toggleMute(); }}
	aria-label={audioMuted ? 'Unmute sounds' : 'Mute sounds'}
	title={audioMuted ? 'Unmute' : 'Mute'}
>
	{#if audioMuted}
		<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
			fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
			<line x1="23" y1="9" x2="17" y2="15"/>
			<line x1="17" y1="9" x2="23" y2="15"/>
		</svg>
	{:else}
		<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
			fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
			<path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
			<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
		</svg>
	{/if}
</button>

<style>
	.nav-scope {
		position: relative;
	}

	/* ── Wall scope (wraps the 8 collapsible sections) ── */
	.wall-scope {
		position: relative;
	}

	/* ── Section Wall (desktop sidebar) ── */
	.section-wall {
		display: none;
	}

	@media (min-width: 1280px) {
		.section-wall {
			display: block;
			position: absolute;
			top: 0;
			right: 0;
			bottom: 0;
			pointer-events: none;
			z-index: 40;
		}

		.wall-track {
			position: sticky;
			top: 2rem;
			width: 260px;
			margin-left: auto;
			margin-right: 1.5rem;
			pointer-events: auto;
			border-left: 3px solid var(--color-ink);
		}

		.wall-card {
			display: flex;
			align-items: flex-start;
			justify-content: space-between;
			gap: 0.5rem;
			padding: 0.625rem 0.75rem;
			cursor: pointer;
			border: none;
			background: none;
			text-align: left;
			width: 100%;
			border-bottom: 1px solid var(--color-border);
			transition: background 200ms;
		}

		.wall-card:last-child {
			border-bottom: none;
		}

		.wall-card:hover {
			background: color-mix(in srgb, var(--color-cream) 50%, white 50%);
		}

		.wall-card-title {
			font-family: var(--font-headline);
			font-size: 0.8125rem;
			text-transform: uppercase;
			line-height: 0.95;
			letter-spacing: 0.02em;
			color: var(--color-muted);
			transition: color 200ms;
		}

		.wall-card.is-active .wall-card-title,
		.wall-card.is-open .wall-card-title {
			color: var(--color-ink);
		}

		.wall-card-subtitle {
			font-size: 0.5625rem;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--color-muted);
			margin-top: 0.15rem;
			line-height: 1.3;
		}

		.wall-chevron {
			flex-shrink: 0;
			width: 14px;
			height: 14px;
			margin-top: 0.1rem;
			color: var(--color-muted);
			transition: transform 300ms ease, color 200ms;
		}

		.wall-chevron-open {
			transform: rotate(180deg);
			color: var(--color-ink);
		}
	}

	/* ── Bridge text (desktop only) ── */
	.wall-bridge {
		display: none;
	}

	@media (min-width: 1280px) {
		.wall-bridge {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			min-height: 40vh;
			padding: 4rem 2.5rem;
			text-align: center;
		}
	}

	/* ── Mute toggle ── */
	.mute-toggle {
		position: fixed;
		bottom: 1.25rem;
		right: 1.25rem;
		z-index: 100;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		background: var(--color-ink);
		color: var(--color-cream);
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.45;
		transition: opacity 150ms;
	}
	.mute-toggle:hover {
		opacity: 0.85;
	}
</style>
