<script module>
	/** Only one popover open at a time across the entire page. */
	let openRefId = $state(null);
	let _nextId = 0;
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	let { num, children }: { num: number; children: Snippet } = $props();

	const id = `ref-${_nextId++}`;
	let triggerEl = $state<HTMLButtonElement | undefined>();
	let popoverEl = $state<HTMLDivElement | undefined>();
	let showAbove = $state(false);
	let posStyle = $state('position:fixed;visibility:hidden;');
	let positioned = $state(false);

	let isOpen = $derived(openRefId === id);

	function toggle(e: MouseEvent) {
		e.stopPropagation();
		if (openRefId === id) {
			openRefId = null;
		} else {
			positioned = false;
			posStyle = 'position:fixed;visibility:hidden;';
			openRefId = id;
		}
	}

	/** Svelte action: move node to document.body (portal) */
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	// Position the popover when it opens
	$effect(() => {
		if (!isOpen || !triggerEl) return;
		const frame = requestAnimationFrame(() => {
			if (!popoverEl || !triggerEl) return;
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const isMobile = vw < 640;
			const maxW = Math.min(400, vw - 24);

			// Apply size constraints before measuring so width is accurate
			popoverEl.style.position = 'fixed';
			popoverEl.style.visibility = 'hidden';
			if (isMobile) {
				popoverEl.style.left = '12px';
				popoverEl.style.right = '12px';
			} else {
				popoverEl.style.maxWidth = `${maxW}px`;
			}

			const tr = triggerEl.getBoundingClientRect();
			const pr = popoverEl.getBoundingClientRect();
			const gap = 8;

			const spaceBelow = vh - tr.bottom;
			showAbove = spaceBelow < pr.height + gap + 20;

			let top: number;
			if (showAbove) {
				top = tr.top - pr.height - gap;
			} else {
				top = tr.bottom + gap;
			}

			let style = `position:fixed;top:${top}px;`;

			if (isMobile) {
				style += `left:12px;right:12px;`;
			} else {
				let left = tr.left - 8;
				if (left + pr.width > vw - 12) left = vw - pr.width - 12;
				if (left < 12) left = 12;
				style += `left:${left}px;max-width:${maxW}px;`;
			}

			posStyle = style;
			positioned = true;
		});
		return () => cancelAnimationFrame(frame);
	});

	// Click outside / Escape / scroll to close
	$effect(() => {
		if (!isOpen) return;

		function handleClick(e: MouseEvent) {
			const target = e.target as Node;
			if (triggerEl?.contains(target)) return;
			if (popoverEl?.contains(target)) return;
			openRefId = null;
		}
		function handleKey(e: KeyboardEvent) {
			if (e.key === 'Escape') openRefId = null;
		}
		function handleScroll() {
			openRefId = null;
		}

		window.addEventListener('click', handleClick, true);
		window.addEventListener('keydown', handleKey);
		window.addEventListener('scroll', handleScroll, { passive: true, capture: true });

		return () => {
			window.removeEventListener('click', handleClick, true);
			window.removeEventListener('keydown', handleKey);
			window.removeEventListener('scroll', handleScroll, true);
		};
	});
</script>

<button
	bind:this={triggerEl}
	class="ref-trigger"
	aria-expanded={isOpen}
	aria-label="Reference {num}"
	onclick={toggle}
>[{num}]</button>

{#if isOpen}
	<div
		use:portal
		bind:this={popoverEl}
		class="ref-popover"
		class:ref-popover--above={showAbove}
		class:ref-popover--visible={positioned}
		style={posStyle}
		role="tooltip"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="ref-arrow"></div>
		<span class="ref-num">[{num}]</span>
		{@render children?.()}
	</div>
{/if}

<style>
	.ref-trigger {
		font-size: 0.65em;
		vertical-align: super;
		line-height: 0;
		opacity: 0.5;
		font-family: ui-monospace, monospace;
		cursor: pointer;
		background: none;
		border: none;
		padding: 0 0.05em;
		color: inherit;
		transition: opacity 150ms;
	}
	.ref-trigger:hover,
	.ref-trigger[aria-expanded='true'] {
		opacity: 1;
	}

	.ref-popover {
		z-index: 9999;
		background: var(--color-cream, #faf8f2);
		color: var(--color-muted, #888);
		border: 1px solid var(--color-border, #ddd);
		padding: 0.75rem 1rem;
		font-size: 0.75rem;
		line-height: 1.6;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
	}
	.ref-popover--visible {
		animation: refFadeIn 150ms ease-out;
	}
	@keyframes refFadeIn {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.ref-popover--above.ref-popover--visible {
		animation-name: refFadeInAbove;
	}
	@keyframes refFadeInAbove {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.ref-popover :global(em) {
		font-style: italic;
	}
	.ref-popover :global(a) {
		color: var(--color-ink, #1a1a1a);
		text-decoration: underline;
		text-underline-offset: 2px;
		transition: opacity 150ms;
	}
	.ref-popover :global(a:hover) {
		opacity: 0.6;
	}
	.ref-popover :global(sup) {
		font-size: 0.7em;
		vertical-align: super;
	}

	.ref-num {
		font-family: ui-monospace, monospace;
		font-weight: 600;
		color: var(--color-ink, #1a1a1a);
		margin-right: 0.3em;
	}

	/* Arrow pointing at trigger */
	.ref-arrow {
		position: absolute;
		top: -5px;
		left: 14px;
		width: 9px;
		height: 9px;
		background: var(--color-cream, #faf8f2);
		border-left: 1px solid var(--color-border, #ddd);
		border-top: 1px solid var(--color-border, #ddd);
		transform: rotate(45deg);
	}
	.ref-popover--above .ref-arrow {
		top: auto;
		bottom: -5px;
		border-left: none;
		border-top: none;
		border-right: 1px solid var(--color-border, #ddd);
		border-bottom: 1px solid var(--color-border, #ddd);
	}
</style>
