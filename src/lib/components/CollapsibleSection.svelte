<script lang="ts">
	import { slide } from 'svelte/transition';
	import { tick } from 'svelte';
	import { play } from '$lib/utils/audio';
	import type { Snippet } from 'svelte';

	let {
		title,
		subtitle,
		id,
		open = $bindable(false),
		children
	}: {
		title: string;
		subtitle: string;
		id: string;
		open?: boolean;
		children: Snippet;
	} = $props();

	function toggle() {
		play('click');
		open = !open;
	}

	function collapse() {
		play('click');
		open = false;
		// On desktop, scroll to this section's position to prevent jumping to page end
		tick().then(() => {
			const el = document.getElementById(id);
			if (el) el.scrollIntoView({ behavior: 'instant' });
		});
	}
</script>

<section class="collapsible-section" class:is-open={open} {id}>
	<button class="collapsible-header" onclick={toggle} aria-expanded={open}>
		<div class="header-text">
			<h2 class="font-headline text-4xl md:text-6xl mb-2">{title}</h2>
			<p class="text-muted text-sm uppercase tracking-widest">{subtitle}</p>
		</div>
		<svg
			class="chevron"
			class:rotated={open}
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
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

	{#if open}
		<div transition:slide={{ duration: 350 }}>
			<div class="desktop-title">
				<button class="collapse-close" onclick={collapse} aria-label="Collapse {title}">
					<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
						fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="18 15 12 9 6 15"></polyline>
					</svg>
					<span>Collapse</span>
				</button>
				<h2 class="font-headline text-4xl md:text-6xl mb-2">{title}</h2>
				<p class="text-muted text-sm uppercase tracking-widest">{subtitle}</p>
			</div>
			{@render children()}
		</div>
	{/if}
</section>

<hr class="divider section-hr" />

<style>
	.collapsible-section {
		padding: 2.5rem 1.25rem;
	}

	@media (min-width: 768px) {
		.collapsible-section {
			padding: 4rem 2.5rem;
		}
	}

	.collapsible-section.is-open {
		padding-bottom: 0;
	}

	.collapsible-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		width: 100%;
		background: none;
		border: none;
		text-align: left;
		cursor: pointer;
		color: var(--color-ink);
		padding: 0;
	}

	.collapsible-header:hover .chevron {
		opacity: 1;
	}

	.header-text {
		flex: 1;
		min-width: 0;
	}

	.chevron {
		flex-shrink: 0;
		margin-top: 0.5rem;
		opacity: 0.4;
		transition: transform 300ms ease, opacity 150ms;
	}

	.chevron.rotated {
		transform: rotate(180deg);
		opacity: 0.7;
	}

	/* Desktop title + collapse button (hidden on mobile) */
	.desktop-title {
		display: none;
	}

	.collapse-close {
		display: none;
	}

	/* Desktop: hide header + divider, collapse to zero when closed */
	@media (min-width: 1280px) {
		.desktop-title {
			display: block;
			margin-bottom: 2rem;
		}

		.collapsible-header {
			display: none;
		}

		.collapsible-section {
			padding: 0;
			overflow: hidden;
		}

		.collapsible-section:not(.is-open) {
			height: 0;
		}

		.collapsible-section.is-open {
			padding: 4rem 2.5rem;
			height: auto;
			overflow: visible;
		}

		.section-hr {
			display: none;
		}

		.collapse-close {
			display: inline-flex;
			align-items: center;
			gap: 0.4rem;
			font-family: ui-monospace, monospace;
			font-size: 0.625rem;
			text-transform: uppercase;
			letter-spacing: 0.1em;
			color: var(--color-muted);
			background: none;
			border: none;
			cursor: pointer;
			padding: 0;
			margin-bottom: 1rem;
			transition: color 150ms;
		}

		.collapse-close:hover {
			color: var(--color-ink);
		}
	}
</style>
