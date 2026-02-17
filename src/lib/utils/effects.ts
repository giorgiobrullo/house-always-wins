// ── Visual Effect Utilities ──────────────────────────────────────────
// Reusable helpers for balance count-up animation and reduced-motion detection.

function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined') return false;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export { prefersReducedMotion };

/**
 * Animate a numeric value from `from` to `to` over `duration` ms (ease-out).
 * Calls `onTick` every frame with the interpolated value, then `onDone` with the final value.
 * Respects prefers-reduced-motion - skips straight to `onDone(to)` if enabled.
 */
export function countTo(
	from: number,
	to: number,
	duration: number,
	onTick: (value: number) => void,
	onDone?: () => void,
): void {
	if (prefersReducedMotion() || duration <= 0 || from === to) {
		onTick(to);
		onDone?.();
		return;
	}

	const start = performance.now();

	function frame(now: number) {
		const elapsed = now - start;
		const t = Math.min(elapsed / duration, 1);
		// ease-out cubic
		const eased = 1 - Math.pow(1 - t, 3);
		const current = from + (to - from) * eased;
		onTick(Math.round(current * 100) / 100); // two decimal places
		if (t < 1) {
			requestAnimationFrame(frame);
		} else {
			onTick(to); // ensure exact final value
			onDone?.();
		}
	}

	requestAnimationFrame(frame);
}
