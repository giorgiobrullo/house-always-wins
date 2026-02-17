<script lang="ts">
	import { inview } from '$lib/utils/intersection';
	import { update as updateStats } from '$lib/stores/simStats.svelte';
	import {
		drawCard, handValue, basicStrategy, playBlackjackHand, simulateBlackjackSession,
		cardStr, isRedSuit, type Card, type BlackjackHandResult
	} from '$lib/utils/random';
	import { money } from '$lib/utils/format';
	import { play } from '$lib/utils/audio';
	import { countTo } from '$lib/utils/effects';
	import Ref from '$lib/components/Ref.svelte';
	import IconRefresh from '@tabler/icons-svelte/icons/refresh';
	import IconPlayerPlay from '@tabler/icons-svelte/icons/player-play';
	import IconFastForward from '@tabler/icons-svelte/icons/player-track-next';

	let { hideTitle = false }: { hideTitle?: boolean } = $props();

	const BET = 5;
	const START = 100;
	const HOUSE_EDGE = 0.005;
	const LOSS_PER_HAND = BET * HOUSE_EDGE;

	// ── Strategy Tester (Quiz) ──────────────────────────────

	type BJAction = 'H' | 'S' | 'D' | 'P' | 'R';

	interface QuizHand {
		playerCards: Card[];
		dealerUp: Card;
		correctAction: BJAction;
		availableActions: BJAction[];
	}

	const ACTION_LABELS: Record<BJAction, string> = {
		H: 'HIT', S: 'STAND', D: 'DOUBLE', P: 'SPLIT', R: 'SURRENDER'
	};

	let quizActive = $state(false);
	let quizHands: QuizHand[] = $state([]);
	let quizIndex = $state(0);
	let quizAnswers: (boolean | null)[] = $state([]);
	let quizDone = $state(false);
	let quizLastAnswer: boolean | null = $state(null);
	let quizLastCorrect: BJAction | null = $state(null);
	let quizPlayerChoice: BJAction | null = $state(null);
	let advanceTimer: ReturnType<typeof setTimeout> | null = null;

	function generateQuizHands(): QuizHand[] {
		const hands: QuizHand[] = [];
		for (let i = 0; i < 20; i++) {
			const playerCards = [drawCard(), drawCard()];
			const dealerUp = drawCard();
			const correct = basicStrategy(playerCards, dealerUp);
			const { total, soft } = handValue(playerCards);
			const r0 = Math.min(playerCards[0].rank, 10);
			const r1 = Math.min(playerCards[1].rank, 10);
			const isPair = r0 === r1;

			const available = new Set<BJAction>(['H', 'S', 'D']);
			if (isPair) available.add('P');
			// Show surrender only when it's the correct play
			if (correct === 'R') available.add('R');

			hands.push({ playerCards, dealerUp, correctAction: correct, availableActions: [...available] });
		}
		return hands;
	}

	function startQuiz() {
		play('cardDeal');
		quizHands = generateQuizHands();
		quizAnswers = Array(20).fill(null);
		quizIndex = 0;
		quizDone = false;
		quizActive = true;
		quizLastAnswer = null;
		quizLastCorrect = null;
		quizPlayerChoice = null;
	}

	function answerQuiz(action: BJAction) {
		if (quizAnswers[quizIndex] !== null || quizDone) return;
		const correct = action === quizHands[quizIndex].correctAction;
		play(correct ? 'quizCorrect' : 'quizWrong');
		quizAnswers[quizIndex] = correct;
		quizLastAnswer = correct;
		quizLastCorrect = quizHands[quizIndex].correctAction;
		quizPlayerChoice = action;

		if (advanceTimer) clearTimeout(advanceTimer);
		advanceTimer = setTimeout(() => {
			quizLastAnswer = null;
			quizPlayerChoice = null;
			if (quizIndex < quizHands.length - 1) {
				quizIndex++;
			} else {
				quizDone = true;
			}
		}, 1400);
	}

	let quizScore = $derived(quizAnswers.filter(a => a === true).length);
	let quizWrong = $derived(quizAnswers.filter(a => a === false).length);
	let quizEdgeTier = $derived.by(() => {
		const wrong = 20 - quizScore;
		if (wrong === 0) return { label: 'Optimal', edge: '0.5%', color: '#4ade80' };
		if (wrong <= 2) return { label: 'Good', edge: '~0.8%', color: '#86efac' };
		if (wrong <= 4) return { label: 'Average', edge: '~1.5%', color: '#fde047' };
		if (wrong <= 7) return { label: 'Costly', edge: '~2.5%', color: '#fb923c' };
		return { label: 'Gut Feel', edge: '3.5%+', color: '#f87171' };
	});

	// ── Simulator ───────────────────────────────────────────

	let balance = $state(START);
	let history: number[] = $state([START]);
	let playing = $state(false);
	let lastHand: BlackjackHandResult | null = $state(null);
	let totalHands_ = $state(0);

	// Visual effects state
	let shaking = $state(false);
	let animating = $state(false);
	let animatedBalance = $state(START);

	function triggerShake() {
		shaking = true;
		setTimeout(() => { shaking = false; }, 500);
	}

	let lifetimeSessions = $state(0);
	let lifetimeHands = $state(0);
	let lifetimeWagered = $state(0);
	let lifetimeNet = $state(0);
	let lifetimeSessionsUp = $state(0);

	let expectedPL = $derived(-(totalHands_ * BET * HOUSE_EDGE));
	let lifetimeExpected = $derived(-(lifetimeHands * BET * HOUSE_EDGE));

	const GHOST_COUNT = 100;
	let ghostBalances: number[] = $state(Array.from({ length: GHOST_COUNT }, () => START));
	let ghostsBust = $derived(ghostBalances.filter(b => b < BET).length);
	let sortedAllPlayers = $derived(
		[...ghostBalances.map(b => ({ b, you: false })), { b: balance, you: true }]
			.sort((a, b) => b.b - a.b)
			.map(p => ({ alive: p.b >= BET, you: p.you }))
	);

	function ghostHand() {
		for (let g = 0; g < GHOST_COUNT; g++) {
			if (ghostBalances[g] < BET) continue;
			const { result } = playBlackjackHand();
			ghostBalances[g] += BET * result;
			ghostBalances[g] = Math.round(ghostBalances[g] * 100) / 100;
		}
		ghostBalances = [...ghostBalances];
	}

	function ghostBulk(n: number) {
		for (let g = 0; g < GHOST_COUNT; g++) {
			for (let i = 0; i < n; i++) {
				if (ghostBalances[g] < BET) break;
				const { result } = playBlackjackHand();
				ghostBalances[g] += BET * result;
				ghostBalances[g] = Math.round(ghostBalances[g] * 100) / 100;
			}
		}
		ghostBalances = [...ghostBalances];
	}

	function resetGhosts() {
		ghostBalances = Array.from({ length: GHOST_COUNT }, () => START);
	}

	function doHand() {
		const handResult = playBlackjackHand();
		const wager = BET * (handResult.doubled ? 2 : handResult.split ? 2 : 1);
		balance += BET * handResult.result;
		balance = Math.round(balance * 100) / 100;
		lastHand = handResult;
		totalHands_++;
		lifetimeHands++;
		lifetimeWagered += wager;
		history = [...history, balance];
		ghostHand();
		if (handResult.result === 1.5) play('blackjack');
		else if (handResult.result > 0) play('win');
		else if (handResult.result < 0) { if (balance < BET) { play('bust'); triggerShake(); } else play('loss'); }
	}

	function playOne() {
		if (playing || balance < BET) return;
		playing = true;
		play('cardDeal');
		setTimeout(() => {
			doHand();
			playing = false;
		}, 200);
	}

	function runN(n: number) {
		if (playing) return;
		playing = true;
		play('chipDown');
		let i = 0;
		const interval = setInterval(() => {
			if (i >= n || balance < BET) {
				clearInterval(interval);
				playing = false;
				return;
			}
			doHand();
			i++;
		}, 20);
	}

	function instantN(n: number) {
		if (playing) return;
		const oldBalance = balance;
		play('chipDown');
		const balances = simulateBlackjackSession(balance, BET, n);
		for (const b of balances) {
			totalHands_++;
			lifetimeHands++;
			lifetimeWagered += BET;
		}
		if (balances.length > 0) {
			balance = balances[balances.length - 1];
			lastHand = null;
		}
		history = [...history, ...balances];
		ghostBulk(n);
		// Animate balance count-up
		animating = true;
		animatedBalance = oldBalance;
		countTo(oldBalance, balance, 600, (v) => { animatedBalance = v; }, () => { animating = false; });
		if (balance < BET) triggerShake();
	}

	function newSession() {
		play('click');
		const sessionNet = balance - START;
		lifetimeNet += sessionNet;
		lifetimeSessions++;
		if (sessionNet > 0) lifetimeSessionsUp++;
		balance = START;
		history = [START];
		lastHand = null;
		totalHands_ = 0;
		playing = false;
		resetGhosts();
	}

	function resetAll() {
		play('click');
		balance = START;
		history = [START];
		lastHand = null;
		totalHands_ = 0;
		playing = false;
		lifetimeSessions = 0;
		lifetimeHands = 0;
		lifetimeWagered = 0;
		lifetimeNet = 0;
		lifetimeSessionsUp = 0;
		resetGhosts();
	}

	let pl = $derived(balance - START);
	let isUp = $derived(pl > 0);
	let isBroke = $derived(balance < BET);

	function handOutcomeText(h: BlackjackHandResult): string {
		const pv = handValue(h.playerCards).total;
		const dv = handValue(h.dealerCards).total;
		if (h.result === 1.5) return `Blackjack! +$${(BET * 1.5).toFixed(2)}`;
		if (h.result === -0.5) return `Surrender. −$${(BET * 0.5).toFixed(2)}`;
		const mult = Math.abs(h.result);
		const amt = (BET * mult).toFixed(2);
		if (h.result > 0) return `${pv} vs ${dv > 21 ? 'bust' : dv}${h.doubled ? ' (doubled)' : ''} → Win +$${amt}`;
		if (h.result < 0) return `${pv > 21 ? 'bust' : pv} vs ${dv}${h.doubled ? ' (doubled)' : ''} → Lose −$${amt}`;
		return `${pv} vs ${dv} → Push`;
	}

	let commentary = $derived.by(() => {
		if (isBroke) {
			const totalBust = ghostsBust + 1;
			return `Balance hit zero. ${totalBust} of ${GHOST_COUNT + 1} are broke. Every one of them played perfect basic strategy.`;
		}
		if (totalHands_ < 10) return null;
		if (ghostsBust === GHOST_COUNT) {
			if (isUp) return "All 100 others went broke playing perfect strategy. You're still standing. Variance, not talent.";
			return "All 100 others went broke. You lasted longer. The 0.5% doesn't care.";
		}
		if (ghostsBust >= 80) {
			if (isUp) return `${ghostsBust} of 100 others are broke. All played basic strategy. Still think skill matters?`;
			return `${ghostsBust} of 100 others are broke. Perfect play doesn't mean winning play.`;
		}
		if (isUp) {
			if (ghostsBust > 0) return `${ghostsBust} of 100 others are already broke. All playing the same optimal strategy.`;
			return "Short sessions hide the edge. The 0.5% needs volume.";
		}
		if (pl === 0) return "Break even. Exactly where variance says you could be. Temporarily.";
		if (pl > -20) return "Slightly down. This is what optimal play looks like.";
		if (pl > -50) return "Trending negative. Every hand costs $0.025 in expected value. Even the ones you win.";
		return `Down ${money(Math.abs(pl))}. ${totalHands_} hands of mathematically perfect play.`;
	});

	let chartPath = $derived.by(() => {
		if (history.length < 2) return '';
		const max = Math.max(START + 30, ...history);
		const min = Math.min(0, ...history);
		const range = max - min || 1;
		return history
			.map((v, i) => {
				const x = (i / (history.length - 1)) * 100;
				const y = 100 - ((v - min) / range) * 100;
				return `${i === 0 ? 'M' : 'L'}${x},${y}`;
			})
			.join(' ');
	});

	let evPath = $derived.by(() => {
		if (history.length < 2) return '';
		const max = Math.max(START + 30, ...history);
		const min = Math.min(0, ...history);
		const range = max - min || 1;
		const totalPts = history.length - 1;
		const toY = (bal: number) => 100 - ((bal - min) / range) * 100;
		const zeroHand = START / LOSS_PER_HAND;
		if (totalPts <= zeroHand) {
			const endBal = START - LOSS_PER_HAND * totalPts;
			return `M0,${toY(START)} L100,${toY(endBal)}`;
		} else {
			const zeroX = (zeroHand / totalPts) * 100;
			return `M0,${toY(START)} L${zeroX},${toY(0)} L100,${toY(0)}`;
		}
	});

	let startLineY = $derived.by(() => {
		if (history.length < 2) return 50;
		const max = Math.max(START + 30, ...history);
		const min = Math.min(0, ...history);
		const range = max - min || 1;
		return 100 - ((START - min) / range) * 100;
	});

	$effect(() => {
		if (lifetimeHands === 0 && totalHands_ === 0) return;
		updateStats('blackjack', {
			wagered: lifetimeWagered,
			net: lifetimeNet + pl,
			rounds: lifetimeHands,
		});
	});
</script>

<section class="px-5 py-16 md:px-10 md:py-24">
	<div class="max-w-4xl">

		<!-- Title -->
		{#if !hideTitle}
		<div use:inview class="fade-up">
			<h2 class="font-headline text-4xl md:text-6xl mb-2">BLACKJACK</h2>
			<p class="text-muted text-sm uppercase tracking-widest mb-8">
				The skill game. The house edge is still there.
			</p>
		</div>
		{/if}

		<!-- Prose -->
		<div use:inview class="fade-up max-w-2xl mb-8">
			<p class="text-base md:text-lg leading-relaxed mb-4">
				Blackjack feels different because you make decisions, study charts,
				and casinos even hand you a strategy card. The illusion of control
				is the hook, and it keeps you at the table longer.
			</p>
			<p class="text-base md:text-lg leading-relaxed">
				Basic strategy is a 350-cell decision matrix derived from combinatorial analysis of every possible hand.<Ref num={1}>Baldwin, R.R. et al. "The Optimum Strategy in Blackjack." <em>Journal of the American Statistical Association</em>, 51(275), 429-439, 1956.</Ref>
				Play it perfectly, every hit, stand, double, split, and the house edge drops to
				<strong class="font-mono text-loss">~0.5%</strong>.<Ref num={2}>Griffin, P.A. <em>The Theory of Blackjack</em>, 6th ed. Huntington Press, 1999. Exact edge varies by rule set (0.4-0.6% under typical conditions).</Ref>
				The lowest of any table game, and still not zero.
			</p>
		</div>

		<!-- ── Strategy Tester ──────────────────────────────── -->
		<div use:inview class="fade-up bj-box mb-8">
			{#if !quizActive}
				<!-- Pre-start -->
				<div class="text-xs uppercase tracking-widest text-[#6b7a8e] mb-3">
					Strategy tester
				</div>
				<p class="text-sm mb-4 max-w-lg text-[#c8d0dc]">
					20 hands. Pick the correct basic strategy play for each one.
					Most people get fewer right than they think.
				</p>
				<button onclick={startQuiz} class="bj-btn-primary">
					TEST YOUR STRATEGY
				</button>
			{:else if !quizDone}
				<!-- Active quiz -->
				<div class="flex items-center justify-between mb-4">
					<div class="text-xs uppercase tracking-widest text-[#6b7a8e]">
						Hand {quizIndex + 1} of 20
					</div>
					<div class="font-mono text-sm text-[#c8d0dc]">
						<span class="text-[#4ade80]">{quizScore}</span>
						{#if quizWrong > 0}
							<span class="text-[#6b7a8e]"> / </span>
							<span class="text-[#ff8a8a]">{quizWrong}</span>
						{/if}
					</div>
				</div>

				<!-- Hand display -->
				{@const hand = quizHands[quizIndex]}
				{@const pv = handValue(hand.playerCards)}
				<div class="mb-5">
					<div class="flex items-end gap-6 md:gap-8">
						<!-- Player cards -->
						<div>
							<div class="text-xs text-[#6b7a8e] uppercase tracking-wide mb-2">You</div>
							<div class="flex gap-1.5">
								{#each hand.playerCards as c}
									<div class="card card-lg" class:card-red={isRedSuit(c)}>
										<span class="card-rank">{cardStr(c).slice(0, -1)}</span>
										<span class="card-suit">{cardStr(c).slice(-1)}</span>
									</div>
								{/each}
							</div>
							<div class="text-xs text-[#6b7a8e] font-mono mt-1.5">
								{pv.soft ? 'Soft ' : ''}{pv.total}
							</div>
						</div>
						<!-- vs -->
						<div class="text-[#6b7a8e] text-xs uppercase tracking-wide pb-6">vs</div>
						<!-- Dealer card -->
						<div>
							<div class="text-xs text-[#6b7a8e] uppercase tracking-wide mb-2">Dealer</div>
							<div class="flex gap-1.5">
								<div class="card card-lg" class:card-red={isRedSuit(hand.dealerUp)}>
									<span class="card-rank">{cardStr(hand.dealerUp).slice(0, -1)}</span>
									<span class="card-suit">{cardStr(hand.dealerUp).slice(-1)}</span>
								</div>
								<div class="card card-lg card-back">
									<span class="card-rank">?</span>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Action buttons -->
				<div class="flex flex-wrap gap-2 mb-3">
					{#each hand.availableActions as action}
						<button
							class="quiz-action-btn"
							class:correct={quizLastAnswer !== null && action === hand.correctAction}
							class:wrong={quizLastAnswer !== null && quizPlayerChoice === action && action !== hand.correctAction}
							disabled={quizAnswers[quizIndex] !== null}
							onclick={() => answerQuiz(action)}
						>
							{ACTION_LABELS[action]}
						</button>
					{/each}
				</div>

				<!-- Feedback -->
				{#if quizLastAnswer !== null}
					<div class="text-sm font-mono" class:text-[#4ade80]={quizLastAnswer} class:text-[#ff8a8a]={!quizLastAnswer}>
						{quizLastAnswer ? '✓ Correct' : `✗ Correct play: ${ACTION_LABELS[quizLastCorrect ?? 'H']}`}
					</div>
				{/if}

				<!-- Progress dots -->
				<div class="flex gap-1 mt-4">
					{#each quizAnswers as ans, i}
						<div class="w-2 h-2 rounded-full transition-colors"
							class:bg-[#4ade80]={ans === true}
							class:bg-[#ff8a8a]={ans === false}
							class:bg-[#1e3050]={ans === null && i !== quizIndex}
							class:bg-[#3a5070]={i === quizIndex && ans === null}
						></div>
					{/each}
				</div>
			{:else}
				<!-- Quiz results -->
				<div class="text-xs uppercase tracking-widest text-[#6b7a8e] mb-4">
					Results
				</div>

				<div class="flex items-baseline gap-3 mb-2">
					<div class="font-mono text-4xl md:text-5xl font-bold" style="color: {quizEdgeTier.color}">
						{quizScore}/20
					</div>
					<div class="text-sm text-[#6b7a8e]">correct</div>
				</div>

				<div class="flex items-center gap-2 mb-4">
					<div class="text-xs uppercase tracking-wider font-bold" style="color: {quizEdgeTier.color}">
						{quizEdgeTier.label}
					</div>
					<div class="text-xs text-[#6b7a8e]">
						Estimated house edge: <span class="font-mono">{quizEdgeTier.edge}</span>
					</div>
				</div>

				<div class="text-sm text-[#8a9ab0] border-l-2 border-[#e8c66a] pl-3 mb-5">
					{#if quizScore === 20}
						Perfect play. The house still takes half a cent of every dollar you bet. Over 1,000 hands, that's $25.
					{:else if quizScore >= 18}
						Close to perfect. The mistakes add up, but even fixing them all leaves you losing.
					{:else if quizScore >= 14}
						About average. Every wrong decision widens the gap. But even 20/20 doesn't close it.
					{:else}
						A lot of mistakes. This is what casinos are counting on. But even perfect players lose.
					{/if}
				</div>

				<button onclick={startQuiz} class="bj-btn">
					TRY AGAIN
				</button>
			{/if}
		</div>

		<!-- ── Simulator ───────────────────────────────────── -->
		<div use:inview class="fade-up bj-box" class:shake={shaking} class:flash-red={shaking}>
			<div class="flex items-center justify-between mb-5">
				<div class="text-xs uppercase tracking-widest text-[#6b7a8e]">Blackjack / $5 bet, basic strategy auto-play</div>
				<div class="flex items-center gap-2">
					<button onclick={newSession} class="text-xs text-[#6b7a8e] hover:text-[#e8c66a] transition-colors underline">New session</button>
					<button onclick={resetAll} class="text-[#6b7a8e] hover:text-[#e8c66a] transition-colors" aria-label="Reset all">
						<IconRefresh size={16} />
					</button>
				</div>
			</div>

			<!-- Last hand -->
			{#if lastHand}
				<div class="mb-5">
					<div class="flex items-end gap-4 md:gap-5">
						<div>
							<div class="text-xs text-[#6b7a8e] uppercase tracking-wide mb-1">You</div>
							<div class="flex gap-1">
								{#each lastHand.playerCards as c}
									<div class="card card-sm" class:card-red={isRedSuit(c)}>
										<span class="card-rank">{cardStr(c).slice(0, -1)}</span>
										<span class="card-suit">{cardStr(c).slice(-1)}</span>
									</div>
								{/each}
							</div>
						</div>
						<div class="text-[#6b7a8e] text-xs uppercase pb-3">vs</div>
						<div>
							<div class="text-xs text-[#6b7a8e] uppercase tracking-wide mb-1">Dealer</div>
							<div class="flex gap-1">
								{#each lastHand.dealerCards as c}
									<div class="card card-sm" class:card-red={isRedSuit(c)}>
										<span class="card-rank">{cardStr(c).slice(0, -1)}</span>
										<span class="card-suit">{cardStr(c).slice(-1)}</span>
									</div>
								{/each}
							</div>
						</div>
					</div>
					<div class="text-sm font-mono mt-2"
						class:text-[#e8c66a]={lastHand.result > 0}
						class:text-[#ff8a8a]={lastHand.result < 0}
						class:text-[#6b7a8e]={lastHand.result === 0}>
						{handOutcomeText(lastHand)}
					</div>
				</div>
			{/if}

			<!-- Stats -->
			<div class="flex flex-wrap items-center gap-6 mb-5">
				<div>
					<div class="text-xs text-[#6b7a8e] uppercase tracking-wide">Balance</div>
					<div class="font-mono text-2xl font-bold"
						class:text-[#e8c66a]={isUp}
						class:text-[#ff8a8a]={!isUp && totalHands_ > 0}>
						{money(animating ? animatedBalance : balance)}
					</div>
				</div>
				<div>
					<div class="text-xs text-[#6b7a8e] uppercase tracking-wide">Hands</div>
					<div class="font-mono text-2xl font-bold text-[#c8d0dc]">{totalHands_}</div>
				</div>
				<div>
					<div class="text-xs text-[#6b7a8e] uppercase tracking-wide">P/L</div>
					<div class="font-mono text-2xl font-bold"
						class:text-[#ff8a8a]={pl < 0}
						class:text-[#e8c66a]={pl > 0}
						class:text-[#c8d0dc]={pl === 0}>
						{pl >= 0 ? '+' : ''}{money(pl)}
					</div>
				</div>
				<div>
					<div class="text-xs text-[#6b7a8e] uppercase tracking-wide">Expected</div>
					<div class="font-mono text-2xl font-bold text-[#6b8aae]">
						{expectedPL >= 0 ? '+' : ''}{money(expectedPL)}
					</div>
				</div>
			</div>

			<!-- Controls -->
			<div class="flex flex-wrap gap-2 mb-5">
				<button onclick={playOne} disabled={playing || isBroke}
					class="bj-btn-primary" title="Single hand">
					<IconPlayerPlay size={16} />
					<span>DEAL</span>
				</button>
				<button onclick={() => runN(50)} disabled={playing || isBroke} class="bj-btn">50</button>
				<button onclick={() => runN(200)} disabled={playing || isBroke} class="bj-btn">200</button>
				<button onclick={() => instantN(1000)} disabled={playing || isBroke}
					class="bj-btn" title="Instant 1,000 hands">
					<IconFastForward size={14} />
					<span>1K</span>
				</button>
				<button onclick={() => instantN(10000)} disabled={playing || isBroke}
					class="bj-btn" title="Instant 10,000 hands">
					<IconFastForward size={14} />
					<span>10K</span>
				</button>
			</div>

			<!-- Commentary -->
			{#if commentary}
				<div class="text-sm mb-5 py-2 border-l-2 pl-3 transition-all duration-300"
					class:border-[#ff8a8a]={!isUp || isBroke}
					class:text-[#ff8a8a]={!isUp || isBroke}
					class:border-[#e8c66a]={isUp && !isBroke}
					class:text-[#e8c66a]={isUp && !isBroke}
				>
					{commentary}
				</div>
			{/if}

			<!-- Ghost strip -->
			{#if totalHands_ > 0}
				<div class="mb-5">
					<div class="flex items-center justify-between mb-1.5">
						<span class="text-xs text-[#6b7a8e] uppercase tracking-wide">You + 100 others, all playing basic strategy</span>
						<span class="font-mono text-xs font-bold" class:text-[#ff8a8a]={ghostsBust > 0} class:text-[#6b7a8e]={ghostsBust === 0}>
							{ghostsBust + (isBroke ? 1 : 0)}/{GHOST_COUNT + 1} broke
						</span>
					</div>
					<div class="ghost-strip">
						{#each sortedAllPlayers as p}
							<div class="ghost-cell" class:ghost-bust={!p.alive} class:ghost-you={p.you && p.alive}></div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Chart -->
			{#if history.length > 2}
				<div class="w-full h-36 md:h-48 border border-[#1e3050] mb-1 bg-[#0a1220]">
					<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="w-full h-full">
						<line x1="0" y1={startLineY} x2="100" y2={startLineY}
							stroke="#1e3050" stroke-width="0.5" stroke-dasharray="2,2" />
						<path d={evPath} fill="none" stroke="#3a5a7a" stroke-width="0.5"
							stroke-dasharray="1.5,1.5" vector-effect="non-scaling-stroke" />
						<path d={chartPath} fill="none"
							stroke={pl < 0 ? '#ff8a8a' : '#e8c66a'}
							stroke-width="1.2" vector-effect="non-scaling-stroke"
							/>
					</svg>
				</div>
				<div class="flex justify-between text-xs text-[#6b7a8e] mb-5">
					<span>Hand 1</span>
					<span class="font-mono opacity-60">dashed = expected value</span>
					<span>Hand {history.length - 1}</span>
				</div>
			{/if}

			<!-- Lifetime -->
			{#if lifetimeSessions > 0}
				<div class="border-t border-[#1e3050] pt-4 mt-2">
					<div class="text-xs uppercase tracking-widest text-[#6b7a8e] mb-3">Lifetime (across {lifetimeSessions} session{lifetimeSessions === 1 ? '' : 's'})</div>
					<div class="flex flex-wrap gap-6 text-sm text-[#c8d0dc]">
						<div>
							<span class="text-[#6b7a8e]">Total wagered:</span>
							<span class="font-mono font-bold ml-1">{money(lifetimeWagered)}</span>
						</div>
						<div>
							<span class="text-[#6b7a8e]">Expected loss:</span>
							<span class="font-mono font-bold ml-1 text-[#6b8aae]">
								{money(lifetimeExpected)}
							</span>
						</div>
						<div>
							<span class="text-[#6b7a8e]">Net:</span>
							<span class="font-mono font-bold ml-1"
								class:text-[#ff8a8a]={lifetimeNet < 0}
								class:text-[#e8c66a]={lifetimeNet > 0}>
								{lifetimeNet >= 0 ? '+' : ''}{money(lifetimeNet)}
							</span>
						</div>
						<div>
							<span class="text-[#6b7a8e]">Sessions up:</span>
							<span class="font-mono font-bold ml-1">{lifetimeSessionsUp}/{lifetimeSessions}</span>
						</div>
					</div>
				</div>
			{/if}

			{#if isBroke}
				<div class="mt-5 text-[#ff8a8a] font-headline text-xl">
					YOU'RE BROKE. PERFECT PLAY, SAME RESULT.
				</div>
			{/if}
		</div>

		<!-- ── Card counting callout ───────────────────────── -->
		<div use:inview class="fade-up mt-8 bj-counting-box">
			<div class="text-xs uppercase tracking-widest text-[#6b7a8e] mb-3">Card counting</div>
			<p class="text-sm text-[#8a9ab0] leading-relaxed mb-3">
				Card counting works and has been mathematically proven since 1961.<Ref num={3}>Thorp, E.O. "A Favorable Strategy for Twenty-One." <em>Proceedings of the National Academy of Sciences</em>, 47(1), 110-112, 1961. <a href="https://www.pnas.org/doi/10.1073/pnas.47.1.110" target="_blank" rel="noopener">DOI</a></Ref>
				It is not illegal either, just a mental skill no different from remembering
				which cards have been played.
			</p>
			<p class="text-sm text-[#8a9ab0] leading-relaxed mb-4">
				Casinos don't call the police. They call security.
				Facial recognition. Continuous shuffling machines. Mid-shoe shuffles.
				Backroom conversations.<Ref num={4}>Kneitel, A. "Casino Countermeasures: Are Casinos Cheating?" <em>Harvard Journal of Sports &amp; Entertainment Law</em>, 10(1), 55-84, 2019.</Ref> The one strategy that actually flips the edge
				isn't against the law. It's against the rules.
			</p>
			<p class="text-base font-medium text-[#c9d1d9] leading-snug pl-4 border-l-2 border-[#6b7a8e]">
				The house doesn't outplay skill. It removes it.
			</p>
		</div>

		<!-- ── Closing callout ─────────────────────────────── -->
		<div use:inview class="fade-up mt-10 pl-6 border-l-3 border-[#e8c66a]">
			<p class="font-headline text-xl md:text-2xl leading-tight">
				THE ONLY GAME YOU CAN PLAY PERFECTLY.<br />
				YOU STILL LOSE.
			</p>
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

	/* Midnight blue casino theme */
	.bj-box {
		background: #0f1a2e;
		border: 1px solid #1e3050;
		padding: 1.25rem;
		color: #c8d0dc;
	}
	@media (min-width: 768px) {
		.bj-box { padding: 1.75rem; }
	}

	/* Playing cards */
	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: #e8e4da;
		border-radius: 4px;
		font-family: ui-monospace, monospace;
		font-weight: 700;
		color: #1a1a1a;
		line-height: 1;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
		user-select: none;
		position: relative;
	}
	.card-sm {
		width: 2rem;
		height: 2.8rem;
		font-size: 0.75rem;
	}
	.card-lg {
		width: 2.75rem;
		height: 3.85rem;
		font-size: 1rem;
	}
	.card-rank {
		font-size: 1em;
		line-height: 1;
	}
	.card-suit {
		font-size: 0.85em;
		line-height: 1;
		margin-top: 1px;
	}
	.card-red {
		color: #c0392b;
	}
	.card-back {
		background: #1e3050;
		color: #3a5a7a;
		border: 1.5px solid #2a4060;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3), inset 0 0 0 3px #162538;
	}
	.card-back .card-rank {
		font-size: 1.2em;
	}

	.bj-btn, .bj-btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.5rem 1.25rem;
		font-family: var(--font-headline);
		font-size: 0.875rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		transition: all 150ms;
		line-height: 0.95;
		border-radius: 999px;
	}
	.bj-btn {
		border: 1px solid #2a4060;
		color: #8a9ab0;
		background: transparent;
	}
	.bj-btn:hover:not(:disabled) {
		background: #162538;
		border-color: #e8c66a;
		color: #e8c66a;
	}
	.bj-btn-primary {
		background: linear-gradient(135deg, #c5a044, #a37e2c);
		color: #1a1a1a;
		border: none;
		font-weight: 600;
	}
	.bj-btn-primary:hover:not(:disabled) {
		background: linear-gradient(135deg, #d4b050, #b88e34);
	}
	.bj-btn:disabled, .bj-btn-primary:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	/* Ghost strip */
	.ghost-strip {
		display: flex;
		gap: 1px;
		height: 6px;
	}
	.ghost-cell {
		flex: 1;
		background: #1e3050;
		transition: background 300ms;
	}
	.ghost-bust {
		background: #ff8a8a;
		animation: ghost-pop 300ms ease-out;
	}
	.ghost-you {
		background: #e8c66a;
	}

	/* Quiz action buttons */
	.quiz-action-btn {
		padding: 0.5rem 1rem;
		font-family: var(--font-headline);
		font-size: 0.8125rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		border: 1px solid #2a4060;
		color: #8a9ab0;
		background: transparent;
		border-radius: 6px;
		transition: all 150ms;
		cursor: pointer;
		line-height: 0.95;
	}
	.quiz-action-btn:hover:not(:disabled) {
		border-color: #e8c66a;
		color: #e8c66a;
		background: #162538;
	}
	.quiz-action-btn:disabled {
		cursor: default;
		opacity: 0.6;
	}
	.quiz-action-btn.correct {
		border-color: #4ade80;
		color: #4ade80;
		background: rgba(74, 222, 128, 0.1);
		opacity: 1;
	}
	.quiz-action-btn.wrong {
		border-color: #ff8a8a;
		color: #ff8a8a;
		background: rgba(255, 138, 138, 0.1);
		opacity: 1;
	}

	/* Card counting callout */
	.bj-counting-box {
		background: #0a1520;
		border: 1px solid #1e3050;
		border-left: 3px solid #e8c66a;
		padding: 1.25rem 1.5rem;
	}
</style>
