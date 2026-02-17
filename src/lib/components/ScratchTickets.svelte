<script lang="ts">
	import { inview } from '$lib/utils/intersection';
	import { update as updateStats } from '$lib/stores/simStats.svelte';
	import { scratchTicketPrize } from '$lib/utils/random';
	import { money } from '$lib/utils/format';
	import { play } from '$lib/utils/audio';
	import Ref from '$lib/components/Ref.svelte';
	import IconRefresh from '@tabler/icons-svelte/icons/refresh';
	import IconCoin from '@tabler/icons-svelte/icons/coin';
	import IconX from '@tabler/icons-svelte/icons/x';
	import IconFastForward from '@tabler/icons-svelte/icons/player-track-next';

	const TICKET_COST = 2;
	const START = 100;
	const EV_RETURN = 0.62;

	type Ticket = { prize: number; scratched: boolean; id: number; animating: boolean };

	let tickets: Ticket[] = $state(makeTickets());
	let balance = $state(START);
	let totalSpent = $state(0);
	let totalWon = $state(0);
	let ticketsBought = $state(0);

	// Lifetime
	let lifetimeSpent = $state(0);
	let lifetimeWon = $state(0);
	let lifetimeTickets = $state(0);

	// Balance history for chart
	let balanceHistory: number[] = $state([START]);

	// Visual effects state
	let shaking = $state(false);

	function triggerShake() {
		shaking = true;
		setTimeout(() => { shaking = false; }, 500);
	}

	let isBroke = $derived(balance < TICKET_COST);

	function makeTickets(): Ticket[] {
		return Array.from({ length: 6 }, () => ({
			prize: scratchTicketPrize(),
			scratched: false,
			id: Math.random(),
			animating: false,
		}));
	}

	function scratch(index: number) {
		if (tickets[index].scratched || balance < TICKET_COST) return;
		play('scratch');
		tickets[index].animating = true;
		setTimeout(() => {
			tickets[index].scratched = true;
			tickets[index].animating = false;
			balance -= TICKET_COST;
			balance += tickets[index].prize;
			if (tickets[index].prize > 0) play('reveal');
			totalSpent += TICKET_COST;
			totalWon += tickets[index].prize;
			ticketsBought++;
			lifetimeSpent += TICKET_COST;
			lifetimeWon += tickets[index].prize;
			lifetimeTickets++;
			balanceHistory = [...balanceHistory, balance];
		}, 150);
	}

	function scratchAll() {
		play('chipDown');
		let delay = 0;
		for (let i = 0; i < tickets.length; i++) {
			if (!tickets[i].scratched) {
				setTimeout(() => scratch(i), delay);
				delay += 100;
			}
		}
	}

	function buyMore() {
		play('click');
		tickets = makeTickets();
	}

	function buyBulk(count: number) {
		if (balance < TICKET_COST) return;
		play('chipDown');
		// Cap to what the player can afford
		const maxAffordable = Math.floor(balance / TICKET_COST);
		const actual = Math.min(count, maxAffordable);
		const newPoints: number[] = [];
		let bal = balance;
		let spent = 0;
		let won = 0;
		for (let i = 0; i < actual; i++) {
			if (bal < TICKET_COST) break;
			bal -= TICKET_COST;
			const prize = scratchTicketPrize();
			bal += prize;
			spent += TICKET_COST;
			won += prize;
			newPoints.push(bal);
		}
		balance = bal;
		totalSpent += spent;
		totalWon += won;
		ticketsBought += newPoints.length;
		lifetimeSpent += spent;
		lifetimeWon += won;
		lifetimeTickets += newPoints.length;
		balanceHistory = [...balanceHistory, ...newPoints];
		tickets = makeTickets();
		for (const t of tickets) {
			t.scratched = true;
			t.prize = scratchTicketPrize();
		}
		if (balance < TICKET_COST) { play('bust'); triggerShake(); }
	}

	function reset() {
		play('click');
		tickets = makeTickets();
		balance = START;
		totalSpent = 0;
		totalWon = 0;
		ticketsBought = 0;
		balanceHistory = [START];
	}

	function resetAll() {
		play('click');
		reset();
		lifetimeSpent = 0;
		lifetimeWon = 0;
		lifetimeTickets = 0;
	}

	let allScratched = $derived(tickets.every((t) => t.scratched));
	let netPL = $derived(totalWon - totalSpent);
	let lifetimeNet = $derived(lifetimeWon - lifetimeSpent);
	let returnRate = $derived(totalSpent > 0 ? ((totalWon / totalSpent) * 100).toFixed(0) : '-');

	// --- Chart derivations ---

	let histMinMax = $derived.by(() => {
		let lo = Infinity, hi = -Infinity;
		for (const v of balanceHistory) {
			if (v < lo) lo = v;
			if (v > hi) hi = v;
		}
		const max = Math.max(START + 10, hi);
		const min = Math.min(0, lo);
		return { min, max, range: max - min || 1 };
	});

	let chartPath = $derived.by(() => {
		const len = balanceHistory.length;
		if (len < 2) return '';
		const { min, range } = histMinMax;
		const toY = (v: number) => 100 - ((v - min) / range) * 100;
		const MAX_PTS = 800;
		if (len <= MAX_PTS) {
			return balanceHistory
				.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (len - 1)) * 100},${toY(v)}`)
				.join(' ');
		}
		const step = (len - 1) / (MAX_PTS - 1);
		const parts: string[] = [];
		for (let i = 0; i < MAX_PTS; i++) {
			const idx = Math.round(i * step);
			parts.push(`${i === 0 ? 'M' : 'L'}${(idx / (len - 1)) * 100},${toY(balanceHistory[idx])}`);
		}
		return parts.join(' ');
	});

	let startLineY = $derived.by(() => {
		if (balanceHistory.length < 2) return 50;
		const { min, range } = histMinMax;
		return 100 - ((START - min) / range) * 100;
	});

	let evLinePath = $derived.by(() => {
		const len = balanceHistory.length;
		if (len < 2) return '';
		const { min, range } = histMinMax;
		const toY = (v: number) => 100 - ((v - min) / range) * 100;
		const lossPerTicket = TICKET_COST * (1 - EV_RETURN);
		const totalTicketsShown = len - 1;
		const evEnd = Math.max(0, START - lossPerTicket * totalTicketsShown);
		return `M0,${toY(START)} L100,${toY(evEnd)}`;
	});

	// --- Commentary ---

	let commentary = $derived.by(() => {
		if (ticketsBought < 6) return null;

		if (isBroke) {
			return "$2 at a time. That's how it goes.";
		}

		const weeksEquiv = ticketsBought >= 3 ? Math.round(ticketsBought / 3) : null;

		if (netPL > 0 && ticketsBought < 20) return "Positive on a small sample. The expected return is 62 cents per dollar.";
		if (netPL > 0 && ticketsBought < 50) return "Ahead after " + ticketsBought + " tickets. Return rate: " + returnRate + "%. Expected: 62%. The gap shows up with volume.";
		if (netPL > 0) return "Still positive after " + ticketsBought + " tickets. At 3 per week, that's " + (weeksEquiv ?? '—') + " weeks of the habit.";
		if (netPL === 0) return "Break even. That won't last at a 62% return rate.";
		if (ticketsBought < 20) return "Down " + money(Math.abs(netPL)) + ". Returning " + returnRate + " cents per dollar. Expected: 62.";
		if (ticketsBought < 50) return "Return rate: " + returnRate + "%. Expected: ~62%. At 3 per week, that's " + (weeksEquiv ?? '—') + " weeks.";
		return returnRate + "% return over " + ticketsBought + " tickets. At 3 per week, that habit runs " + (weeksEquiv ?? '—') + " weeks. The math doesn't change.";
	});

	$effect(() => {
		if (lifetimeTickets === 0) return;
		updateStats('scratch', {
			wagered: lifetimeSpent,
			net: lifetimeWon - lifetimeSpent,
			rounds: lifetimeTickets,
		});
	});
</script>

<section class="px-5 py-16 md:px-10 md:py-24">
	<div class="max-w-4xl">
		<div use:inview class="fade-up">
			<h2 class="font-headline text-4xl md:text-6xl mb-2">SCRATCH TICKETS</h2>
			<p class="text-muted text-sm uppercase tracking-widest mb-8">
				Worse than any table game, sold at every gas station
			</p>
		</div>

		<div use:inview class="fade-up max-w-2xl mb-8">
			<p class="text-base md:text-lg leading-relaxed mb-4">
				Scratch tickets return about <strong class="font-mono">$0.60 to $0.75</strong> for every
				<strong class="font-mono">$1.00</strong> spent, depending on the ticket price and
				state.<Ref num={1}>NASPL reports ~65% national average prize payout across lottery products. State-level data ranges from ~60% (low-cost tickets) to ~75% (premium tickets). See individual state lottery commission annual reports.</Ref> That's a 25-40% house edge,
				worse than almost any casino table game. The format hides it well because
				each ticket feels like its own independent event.
			</p>
			<p class="text-base md:text-lg leading-relaxed mb-4">
				Tickets that show symbols one away from a big prize are deliberately
				overrepresented in the print run. One study found jackpot near-miss pairs appeared
				at triple the expected rate across 102 scratch cards, with zero actual
				jackpot winners in the sample.<Ref num={2}>Stange, M., Brown, A.L.F., Harrigan, K.A. &amp; Dixon, M.J. "All Losses Disguised as Wins: How Near Misses Are Distributed on Scratch Cards." <em>Journal of Gambling Issues</em>, 35, 45-57, 2017.</Ref>
			</p>
			<p class="text-base md:text-lg leading-relaxed">
				"It's only $2." One ticket with your morning coffee, one on your
				lunch break, maybe one more on the drive home. At $2 per ticket,
				three a week is $312 a year. Over 30 years that's
				<strong class="font-mono text-loss">$9,360</strong> spent, returning
				roughly <strong class="font-mono text-loss">$5,800</strong> at a 62%
				payout rate. The amount that felt too small to notice quietly became
				a used car.
			</p>
		</div>

		<div use:inview class="fade-up scratch-box" class:shake={shaking} class:flash-red={shaking}>
			<div class="flex items-center justify-between mb-4">
				<div class="scratch-label">
					Scratch Tickets / $2 each
				</div>
				<div class="flex items-center gap-2">
					<button onclick={reset} class="text-xs text-muted hover:text-ink transition-colors underline">New batch</button>
					<button onclick={resetAll} class="text-muted hover:text-ink transition-colors" aria-label="Reset all">
						<IconRefresh size={16} />
					</button>
				</div>
			</div>

			<!-- Receipt-style stats -->
			<div class="receipt">
				<div class="receipt-row font-bold">
					<span>Balance</span>
					<span class="font-mono" class:text-loss={balance < START} class:text-house={balance > START}>
						{money(balance)}
					</span>
				</div>
				<div class="receipt-divider"></div>
				<div class="receipt-row">
					<span>Spent</span>
					<span class="font-mono font-bold">{money(totalSpent)}</span>
				</div>
				<div class="receipt-row">
					<span>Won</span>
					<span class="font-mono font-bold" class:text-house={totalWon > 0}>{money(totalWon)}</span>
				</div>
				<div class="receipt-row text-xs text-muted">
					<span>{ticketsBought} ticket{ticketsBought !== 1 ? 's' : ''}</span>
					<span class="font-mono">Return: {returnRate}%</span>
				</div>
			</div>

			<!-- Ticket grid -->
			<div class="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
				{#each tickets as ticket, i (ticket.id)}
					<button
						onclick={() => scratch(i)}
						disabled={ticket.scratched || ticket.animating || isBroke}
						class="ticket-card aspect-square flex items-center justify-center
							   transition-all duration-200
							   {ticket.animating
								? 'scratching'
								: ticket.scratched
									? ticket.prize > 0
										? 'ticket-win'
										: 'ticket-lose'
									: 'ticket-unscratched'}"
					>
						{#if ticket.scratched}
							<div class="reveal-in">
								{#if ticket.prize > 0}
									<div class="flex flex-col items-center gap-0.5">
										<IconCoin size={20} class="text-gold" />
										<span class="font-mono text-sm font-bold">${ticket.prize}</span>
									</div>
								{:else}
									<IconX size={22} class="text-muted/40" />
								{/if}
							</div>
						{:else if ticket.animating}
							<span class="text-muted text-sm">...</span>
						{:else}
							<div class="ticket-surface">
								<span class="text-[#888] text-2xl font-mono select-none">$</span>
							</div>
						{/if}
					</button>
				{/each}
			</div>

			<!-- Controls -->
			<div class="flex flex-wrap gap-2 mb-4">
				{#if !allScratched}
					<button onclick={scratchAll} disabled={isBroke} class="scratch-btn border border-ink">SCRATCH ALL</button>
				{:else}
					<button onclick={buyMore} disabled={isBroke} class="scratch-btn bg-ink text-cream">BUY 6 MORE</button>
				{/if}
				<button onclick={() => buyBulk(50)} disabled={isBroke} class="scratch-btn border border-ink">
					<IconFastForward size={14} />
					<span>50</span>
				</button>
				<button onclick={() => buyBulk(500)} disabled={isBroke} class="scratch-btn border border-ink">
					<IconFastForward size={14} />
					<span>500</span>
				</button>
			</div>

			<!-- Commentary -->
			{#if commentary}
				<div class="text-sm py-2 border-l-2 pl-3 transition-all duration-300 mb-4"
					class:border-loss={netPL < 0}
					class:text-loss={netPL < 0}
					class:border-house={netPL > 0}
					class:text-house={netPL > 0}
					class:border-muted={netPL === 0}
				>
					{commentary}
				</div>
			{/if}

			<!-- P/L Chart -->
			{#if balanceHistory.length > 2}
				<div class="w-full h-32 md:h-44 border border-border mb-1 bg-white/50">
					<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="w-full h-full">
						<line x1="0" y1={startLineY} x2="100" y2={startLineY}
							stroke="var(--color-border)" stroke-width="0.5" stroke-dasharray="2,2" />
						<path d={evLinePath} fill="none" stroke="var(--color-muted)" stroke-width="0.5"
							stroke-dasharray="1.5,1.5" vector-effect="non-scaling-stroke" />
						<path d={chartPath} fill="none"
							stroke={netPL < 0 ? 'var(--color-loss)' : 'var(--color-house)'}
							stroke-width="1.2" vector-effect="non-scaling-stroke" />
					</svg>
				</div>
				<div class="flex justify-between text-xs text-muted mb-4">
					<span>Ticket 1</span>
					<span class="font-mono opacity-60">dashed = expected value (62% return)</span>
					<span>Ticket {ticketsBought}</span>
				</div>
			{/if}

			<!-- Lifetime -->
			{#if lifetimeTickets > ticketsBought}
				<div class="border-t border-border pt-4">
					<div class="receipt">
						<div class="text-xs uppercase tracking-widest text-muted mb-2">Lifetime</div>
						<div class="receipt-row text-sm">
							<span class="text-muted">Tickets</span>
							<span class="font-mono font-bold">{lifetimeTickets.toLocaleString('en-US')}</span>
						</div>
						<div class="receipt-row text-sm">
							<span class="text-muted">Spent</span>
							<span class="font-mono font-bold">{money(lifetimeSpent)}</span>
						</div>
						<div class="receipt-row text-sm">
							<span class="text-muted">Net</span>
							<span class="font-mono font-bold" class:text-loss={lifetimeNet < 0} class:text-house={lifetimeNet > 0}>
								{lifetimeNet >= 0 ? '+' : ''}{money(lifetimeNet)}
							</span>
						</div>
						<div class="receipt-row text-sm">
							<span class="text-muted">Return</span>
							<span class="font-mono font-bold" class:text-loss={lifetimeWon / lifetimeSpent < 1}>
								{((lifetimeWon / lifetimeSpent) * 100).toFixed(0)}%
							</span>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Habit calculator -->
		<div use:inview class="fade-up mt-8 scratch-box">
			<div class="scratch-label mb-3">The cost of "just $2"</div>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border text-left">
							<th class="pb-2 pr-4 text-xs uppercase tracking-wide text-muted font-normal">Pace</th>
							<th class="pb-2 pr-4 text-xs uppercase tracking-wide text-muted font-normal text-right">1 Year</th>
							<th class="pb-2 pr-4 text-xs uppercase tracking-wide text-muted font-normal text-right">5 Years</th>
							<th class="pb-2 pr-4 text-xs uppercase tracking-wide text-muted font-normal text-right">10 Years</th>
							<th class="pb-2 text-xs uppercase tracking-wide text-muted font-normal text-right">30 Years</th>
						</tr>
					</thead>
					<tbody>
						{#each [
							{ label: '1 per week', spent: [104, 520, 1040, 3120] },
							{ label: '3 per week', spent: [312, 1560, 3120, 9360] },
							{ label: '1 per day', spent: [730, 3650, 7300, 21900] },
						] as row}
							<tr class="border-b border-border/50">
								<td class="py-2 pr-4 text-muted">{row.label}</td>
								{#each row.spent as s}
									<td class="py-2 pr-4 text-right">
										<div class="font-mono font-bold">{money(s)}</div>
										<div class="font-mono text-xs text-loss">{@html '&minus;'}{money(Math.round(s * 0.38))}</div>
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="text-xs text-muted mt-3">
				Top: total spent. <span class="text-loss">Bottom: net loss</span> at 62% return rate. All at $2 per ticket.
			</div>
		</div>

		<!-- Invest instead comparison -->
		<div use:inview class="fade-up mt-8 scratch-box">
			<div class="scratch-label mb-3">Or invest it instead</div>
			<p class="text-sm text-muted mb-3">
				Same money, same pace, into an S&P 500 index fund instead of scratch tickets.
			</p>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border text-left">
							<th class="pb-2 pr-4 text-xs uppercase tracking-wide text-muted font-normal">Pace</th>
							<th class="pb-2 pr-4 text-xs uppercase tracking-wide text-muted font-normal text-right">1 Year</th>
							<th class="pb-2 pr-4 text-xs uppercase tracking-wide text-muted font-normal text-right">5 Years</th>
							<th class="pb-2 pr-4 text-xs uppercase tracking-wide text-muted font-normal text-right">10 Years</th>
							<th class="pb-2 text-xs uppercase tracking-wide text-muted font-normal text-right">30 Years</th>
						</tr>
					</thead>
					<tbody>
						{#each [
							{ label: '1 per week', values: [104, 635, 1657, 17127] },
							{ label: '3 per week', values: [312, 1904, 4972, 51382] },
							{ label: '1 per day', values: [730, 4457, 11627, 120172] },
						] as row}
							<tr class="border-b border-border/50">
								<td class="py-2 pr-4 text-muted">{row.label}</td>
								{#each row.values as v}
									<td class="py-2 pr-4 text-right">
										<div class="font-mono font-bold text-house">{money(v)}</div>
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="text-xs text-muted mt-3">
				Based on S&P 500 historical average ~10%/year (nominal). 3 tickets/week for 30 years:
				<span class="text-loss font-mono font-bold">{@html '&minus;'}$3,557</span> on scratchers vs
				<span class="text-house font-mono font-bold">$51,382</span> invested.
			</div>
		</div>

		<div use:inview class="fade-up mt-10 pl-6 border-l-3 border-loss">
			<p class="font-headline text-xl md:text-2xl leading-tight">
				THE WORST ODDS IN THE STORE.<br />
				SOLD NEXT TO THE MILK.
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


	/* Newsstand / convenience store theme */
	.scratch-box {
		border: 1px solid var(--color-border);
		padding: 1.25rem;
		background: #faf8f2;
	}
	@media (min-width: 768px) {
		.scratch-box { padding: 1.75rem; }
	}

	.scratch-label {
		font-family: var(--font-headline);
		font-size: 0.75rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-muted);
	}

	/* Receipt-style stats */
	.receipt {
		font-family: ui-monospace, monospace;
		font-size: 0.875rem;
		margin-bottom: 1rem;
		max-width: 16rem;
	}
	.receipt-row {
		display: flex;
		justify-content: space-between;
		padding: 0.15rem 0;
	}
	.receipt-divider {
		border-top: 1px dashed var(--color-border);
		margin: 0.25rem 0;
	}

	/* Ticket cards */
	.ticket-card {
		transition: transform 150ms ease, background 200ms ease;
		border: 1px solid #ccc;
	}
	.ticket-unscratched {
		background: linear-gradient(135deg, #d4d0c8 0%, #c0bdb6 50%, #d4d0c8 100%);
		cursor: pointer;
	}
	.ticket-unscratched:hover {
		transform: scale(1.03);
		background: linear-gradient(135deg, #cac6be 0%, #b6b3ac 50%, #cac6be 100%);
	}
	.ticket-surface {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: repeating-linear-gradient(
			45deg,
			transparent,
			transparent 4px,
			rgba(0,0,0,0.03) 4px,
			rgba(0,0,0,0.03) 8px
		);
	}
	.scratching {
		background: #e8e4dc;
		transform: scale(0.95);
	}
	.ticket-win {
		background: #fef9e7;
		border-color: var(--color-gold);
	}
	.ticket-lose {
		background: #f5f3ee;
		border-color: #ddd;
	}
	.reveal-in {
		animation: revealPop 200ms ease-out;
	}
	@keyframes revealPop {
		0% { transform: scale(0.7); opacity: 0; }
		100% { transform: scale(1); opacity: 1; }
	}

	.scratch-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.5rem 1rem;
		font-family: var(--font-headline);
		font-size: 0.875rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		transition: all 150ms;
		line-height: 0.95;
	}
	.scratch-btn:hover:not(:disabled) {
		background: var(--color-ink);
		color: var(--color-cream);
	}
	.scratch-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

</style>
