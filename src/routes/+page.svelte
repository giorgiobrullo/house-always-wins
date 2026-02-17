<script lang="ts">
	import { onMount } from 'svelte';
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
	import { toggleMute, getMuted } from '$lib/utils/audio';

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

	const navItems = [
		{ id: 'house-edge', label: 'The Edge' },
		{ id: 'roulette', label: 'Roulette' },
		{ id: 'martingale', label: 'Martingale' },
		{ id: 'walk-away', label: 'Walk-Away' },
		{ id: 'blackjack', label: 'Blackjack' },
		{ id: 'slots', label: 'Slots' },
		{ id: 'scratch-tickets', label: 'Scratchers' },
		{ id: 'crash', label: 'Crash' },
		{ id: 'sports-betting', label: 'Sports' },
		{ id: 'lottery', label: 'Lottery' },
	];

	let activeSection = $state('house-edge');

	onMount(() => {
		// Instant scroll to hash on load (no smooth)
		if (location.hash) {
			const el = document.querySelector(location.hash);
			if (el) {
				el.scrollIntoView();
			}
		}

		// Track which section is in view and update hash
		const sectionEls = sections
			.map((id) => document.getElementById(id))
			.filter((el): el is HTMLElement => el !== null);

		let currentHash = location.hash.slice(1);
		let ticking = false;

		const observer = new IntersectionObserver(
			(entries) => {
				if (ticking) return;
				ticking = true;
				requestAnimationFrame(() => {
					// Find the topmost visible section
					let topSection = '';
					let topY = Infinity;
					for (const entry of entries) {
						if (entry.isIntersecting) {
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

	function scrollTo(id: string) {
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
	}
</script>

<main>
	<div id="hero"><Hero /></div>

	<div class="nav-scope">
		<nav class="section-nav" aria-label="Page sections">
			<div class="nav-track">
				{#each navItems as item}
					<a
						href="#{item.id}"
						class="nav-item"
						class:active={activeSection === item.id}
						onclick={(e) => { e.preventDefault(); scrollTo(item.id); }}
					>
						{item.label}
					</a>
				{/each}
			</div>
		</nav>

		<div id="house-edge"><HouseEdge /></div>
		<div id="roulette"><Roulette /></div>
		<div id="martingale"><Martingale /></div>
		<div id="walk-away"><WalkAway /></div>
		<div id="blackjack"><Blackjack /></div>
		<div id="slots"><Slots /></div>
		<div id="scratch-tickets"><ScratchTickets /></div>
		<div id="crash"><Crash /></div>
		<div id="sports-betting"><SportsBetting /></div>
		<div id="lottery"><Lottery /></div>
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

	.section-nav {
		display: none;
	}

	@media (min-width: 1280px) {
		.section-nav {
			display: block;
			position: absolute;
			top: 0;
			right: 0;
			bottom: 0;
			pointer-events: none;
			z-index: 40;
		}

		.nav-track {
			position: sticky;
			top: 2rem;
			width: max-content;
			margin-left: auto;
			margin-right: 1.5rem;
			pointer-events: auto;
			display: flex;
			flex-direction: column;
		}
	}

	.nav-item {
		display: block;
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-family: ui-monospace, monospace;
		color: var(--color-muted);
		text-decoration: none;
		padding: 0.3rem 0 0.3rem 0.75rem;
		border-left: 2px solid transparent;
		transition: color 200ms, border-color 200ms;
	}

	.nav-item.active {
		color: var(--color-ink);
		border-left-color: var(--color-ink);
	}

	.nav-item:hover {
		color: var(--color-ink);
	}

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
