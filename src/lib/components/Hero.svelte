<script lang="ts">
	import { inview } from '$lib/utils/intersection';
</script>

<section class="relative px-5 pt-8 pb-16 md:px-10 md:pt-12 md:pb-24 overflow-hidden">
	<div class="border-b border-border pb-3 mb-8">
		<div class="font-headline text-lg md:text-xl">THE HOUSE ALWAYS WINS</div>
	</div>

	<div use:inview class="fade-up">
		<h1 class="font-headline text-5xl md:text-7xl lg:text-8xl xl:text-[9rem] leading-[0.9] mb-6 max-w-5xl">
			EVERY GAMBLER THINKS THEY'RE THE EXCEPTION.
		</h1>
		<div class="flex items-start gap-4 md:gap-8 mb-10">
			<div class="w-16 md:w-24 shrink-0">
				<hr class="divider" />
			</div>
			<p class="text-lg md:text-2xl font-headline tracking-wide text-loss">
				NONE OF THEM ARE.
			</p>
		</div>
	</div>

	<div use:inview class="fade-up max-w-2xl">
		<p class="text-base md:text-lg leading-relaxed mb-4">
			Every casino game is designed to return less than it takes in,
			not on bad nights but on average, always. The math is public knowledge,
			printed right on the machines. Casinos just know most people won't look.
		</p>
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
</style>
