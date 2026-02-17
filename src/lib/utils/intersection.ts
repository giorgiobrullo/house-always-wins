export function inview(node: HTMLElement, params: { threshold?: number; once?: boolean } = {}) {
	const { threshold = 0.2, once = true } = params;
	let triggered = false;

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting && !triggered) {
					node.classList.add('in-view');
					node.dispatchEvent(new CustomEvent('inview'));
					if (once) {
						triggered = true;
						observer.unobserve(node);
					}
				}
			}
		},
		{ threshold }
	);

	observer.observe(node);

	return {
		destroy() {
			observer.unobserve(node);
		}
	};
}
