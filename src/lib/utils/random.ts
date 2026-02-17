/** Fair random float [0, 1) */
export function rand(): number {
	return Math.random();
}

/** Random int in [min, max] inclusive */
export function randInt(min: number, max: number): number {
	return Math.floor(rand() * (max - min + 1)) + min;
}

/** Roulette spin: returns 0-36 for European, 0-37 for American (37 = 00) */
export function spinRoulette(american = true): number {
	return randInt(0, american ? 37 : 36);
}

/** Is this roulette number red? */
export function isRed(n: number): boolean {
	const reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
	return reds.includes(n);
}

/**
 * Run a full roulette session (always bet red).
 * Returns array of balances after each spin.
 */
export function simulateRouletteSession(
	startBalance: number,
	betAmount: number,
	spins: number,
	american = true
): number[] {
	const balances: number[] = [];
	let balance = startBalance;
	for (let i = 0; i < spins; i++) {
		if (balance < betAmount) break;
		const result = spinRoulette(american);
		if (isRed(result)) balance += betAmount;
		else balance -= betAmount;
		balances.push(balance);
	}
	return balances;
}

/**
 * Run N full roulette sessions and return summary stats.
 */
export function simulateRouletteSessions(
	sessions: number,
	startBalance: number,
	betAmount: number,
	spinsPerSession: number
): { wins: number; losses: number; busts: number; avgFinal: number; worstFinal: number; bestFinal: number } {
	let wins = 0, losses = 0, busts = 0;
	let totalFinal = 0, worstFinal = Infinity, bestFinal = -Infinity;
	for (let s = 0; s < sessions; s++) {
		const balances = simulateRouletteSession(startBalance, betAmount, spinsPerSession);
		const final = balances.length > 0 ? balances[balances.length - 1] : startBalance;
		if (final > startBalance) wins++;
		else if (final < betAmount) busts++;
		else losses++;
		totalFinal += final;
		if (final < worstFinal) worstFinal = final;
		if (final > bestFinal) bestFinal = final;
	}
	return { wins, losses, busts, avgFinal: totalFinal / sessions, worstFinal, bestFinal };
}

/**
 * Simulate martingale strategy. Returns array of balances.
 * Each entry is balance after a "round" (bet until win or bust).
 */
export function simulateMartingale(
	startBalance: number,
	initialBet: number,
	tableMax: number,
	rounds: number
): { balances: number[]; busted: boolean; bustRound: number; peakBalance: number } {
	const balances: number[] = [startBalance];
	let balance = startBalance;
	let peakBalance = startBalance;
	for (let r = 0; r < rounds; r++) {
		let bet = initialBet;
		const streakLosses: number[] = [];
		// Keep doubling until win or can't bet
		while (true) {
			if (balance < bet || bet > tableMax) {
				// Bust: push each loss from the fatal streak so the chart shows the cascade
				for (const b of streakLosses) balances.push(b);
				balances.push(0); // Strategy failed - bankroll is gone
				return { balances, busted: true, bustRound: r + 1, peakBalance };
			}
			const result = spinRoulette(true);
			if (isRed(result)) {
				balance += bet;
				break; // Won this round
			} else {
				balance -= bet;
				bet *= 2;
				streakLosses.push(balance);
			}
		}
		balances.push(balance);
		if (balance > peakBalance) peakBalance = balance;
	}
	return { balances, busted: false, bustRound: -1, peakBalance };
}

// ── Walk-Away Simulator ─────────────────────────────────────────

export interface WalkAwayResult {
	sessions: boolean[];   // true = hit target, false = went broke
	hitCount: number;
	brokeCount: number;
	avgNet: number;        // (hitCount/N)*target + (brokeCount/N)*(-bankroll)
}

/** Simulate N walk-away roulette sessions (red/black, flat bets). */
export function simulateWalkAwayBatch(
	count: number,
	bankroll: number,
	profitTarget: number,
	betSize: number
): WalkAwayResult {
	const sessions: boolean[] = [];
	let hitCount = 0;
	const goal = bankroll + profitTarget;

	for (let s = 0; s < count; s++) {
		let balance = bankroll;
		while (balance >= betSize && balance < goal) {
			if (isRed(spinRoulette(true))) balance += betSize;
			else balance -= betSize;
		}
		const hit = balance >= goal;
		sessions.push(hit);
		if (hit) hitCount++;
	}

	const brokeCount = count - hitCount;
	const avgNet = (hitCount / count) * profitTarget + (brokeCount / count) * -bankroll;

	return { sessions, hitCount, brokeCount, avgNet };
}

/** Slot reel symbols as string IDs */
export const SLOT_SYMBOLS = ['cherry', 'bell', 'diamond', 'star', 'crown', 'bolt', 'seven'] as const;
export type SlotSymbol = (typeof SLOT_SYMBOLS)[number];

const SLOT_WEIGHTS = [25, 25, 20, 5, 2, 20, 3];
const SLOT_WEIGHT_TOTAL = 100; // pre-computed sum

export function spinSlotReel(): SlotSymbol {
	let r = rand() * SLOT_WEIGHT_TOTAL;
	for (let i = 0; i < SLOT_WEIGHTS.length; i++) {
		r -= SLOT_WEIGHTS[i];
		if (r <= 0) return SLOT_SYMBOLS[i];
	}
	return SLOT_SYMBOLS[0];
}

export function slotPayout(a: SlotSymbol, b: SlotSymbol, c: SlotSymbol): number {
	// Calibrated for ~89% return rate (EV ≈ $0.89 per $1 pull)
	if (a === 'seven' && b === 'seven' && c === 'seven') return 100;
	if (a === 'diamond' && b === 'diamond' && c === 'diamond') return 25;
	if (a === 'star' && b === 'star' && c === 'star') return 50;
	if (a === 'crown' && b === 'crown' && c === 'crown') return 40;
	if (a === 'bell' && b === 'bell' && c === 'bell') return 12;
	if (a === b && b === c) return 7;
	if (a === 'cherry' && b === 'cherry') return 3;
	if (a === 'cherry') return 1;
	return 0;
}

/**
 * Run a full slot session with bankroll.
 * Each pull costs $cost, returns slotPayout.
 * Returns array of balance after each pull.
 */
export function simulateSlotSession(
	startBalance: number,
	cost: number,
	pulls: number
): number[] {
	const balances: number[] = [];
	let balance = startBalance;
	for (let i = 0; i < pulls; i++) {
		if (balance < cost) break;
		balance -= cost;
		const r: [SlotSymbol, SlotSymbol, SlotSymbol] = [spinSlotReel(), spinSlotReel(), spinSlotReel()];
		balance += slotPayout(r[0], r[1], r[2]);
		balance = Math.round(balance * 100) / 100;
		balances.push(balance);
	}
	return balances;
}

/** Scratch ticket ($2): returns prize (0 = loss). ~62% return = 38% house edge. */
export function scratchTicketPrize(): number {
	const r = rand();
	if (r < 0.75) return 0;
	if (r < 0.90) return 2;
	if (r < 0.95) return 4;
	if (r < 0.97) return 5;
	if (r < 0.985) return 10;
	if (r < 0.995) return 20;
	if (r < 0.999) return 50;
	return 100;
}

/**
 * Generate a crash point with ~4% house edge.
 * Uses inverse CDF: max(1, floor(0.96 / rand())).
 * ~4-5% of rounds crash instantly at 1.00× (when r > ~0.95).
 * Returns the multiplier at which the game crashes (e.g. 1.00, 2.35, 15.7).
 */
export function crashPoint(): number {
	const r = rand();
	return Math.max(1.0, Math.floor((0.96 / r) * 100) / 100);
}

/**
 * Simulate N crash rounds with a fixed cashout target.
 * Returns array of balances after each round.
 */
export function simulateCrashSession(
	startBalance: number,
	betAmount: number,
	cashoutTarget: number,
	rounds: number
): number[] {
	const balances: number[] = [];
	let balance = startBalance;
	for (let i = 0; i < rounds; i++) {
		if (balance < betAmount) break;
		const crash = crashPoint();
		if (crash >= cashoutTarget) {
			balance += betAmount * (cashoutTarget - 1);
		} else {
			balance -= betAmount;
		}
		balances.push(Math.round(balance * 100) / 100);
	}
	return balances;
}

/** Simulate a scratch ticket session with a starting bankroll.
 *  Returns array of balances after each ticket. Stops when balance < ticketCost. */
export function simulateScratchSession(
	startBalance: number,
	ticketCost: number,
	maxTickets: number
): number[] {
	const balances: number[] = [];
	let balance = startBalance;
	for (let i = 0; i < maxTickets; i++) {
		if (balance < ticketCost) break;
		balance -= ticketCost;
		balance += scratchTicketPrize();
		balances.push(balance);
	}
	return balances;
}

/** Run N scratch tickets, return total prize */
export function simulateScratchBulk(count: number, ticketCost: number): { totalSpent: number; totalWon: number; prizes: number[] } {
	const prizes: number[] = [];
	let totalWon = 0;
	for (let i = 0; i < count; i++) {
		const p = scratchTicketPrize();
		prizes.push(p);
		totalWon += p;
	}
	return { totalSpent: count * ticketCost, totalWon, prizes };
}

/** Simulate sports bets at -110 odds. Returns array of balances. */
export function simulateSportsBets(
	startBalance: number,
	betSize: number,
	winRate: number,
	count: number
): number[] {
	const balances: number[] = [];
	let balance = startBalance;
	const winProfit = betSize * (100 / 110);
	for (let i = 0; i < count; i++) {
		if (balance < betSize) break;
		if (rand() < winRate) {
			balance += winProfit;
		} else {
			balance -= betSize;
		}
		balance = Math.round(balance * 100) / 100;
		balances.push(balance);
	}
	return balances;
}

// --- LOTTERY / POWERBALL ---

/** Prize tiers: [odds denominator, prize amount]. Excludes jackpot (tracked separately). */
const POWERBALL_TIERS: [number, number][] = [
	[38, 4],             // PB only
	[92, 4],             // 1+PB
	[701, 7],            // 2+PB
	[580, 7],            // 3 match
	[14494, 100],        // 3+PB
	[36525, 100],        // 4 match
	[913129, 50000],     // 4+PB
	[11688054, 1000000], // 5 match
];

/** Cumulative probability thresholds for fast lookup */
const POWERBALL_CUM: [number, number][] = (() => {
	const out: [number, number][] = [];
	let cum = 0;
	for (const [denom, prize] of POWERBALL_TIERS) {
		cum += 1 / denom;
		out.push([cum, prize]);
	}
	return out;
})();

export const JACKPOT_ODDS = 292_201_338;

export interface LotteryYearResult {
	year: number;
	spent: number;
	won: number;
	jackpots: number;
	biggestPrize: number;
}

export interface LotteryLifetimeResult {
	years: LotteryYearResult[];
	totalTickets: number;
	totalSpent: number;
	totalWon: number;
	jackpots: number;
	biggestPrize: number;
}

/** Simulate one person buying lottery tickets for N years */
export function simulateLotteryLifetime(
	ticketsPerDay: number,
	years: number,
	ticketCost: number
): LotteryLifetimeResult {
	const ticketsPerYear = ticketsPerDay * 365;
	const yearResults: LotteryYearResult[] = [];
	let totalWon = 0;
	let totalJackpots = 0;
	let biggestPrize = 0;

	// Pre-determine jackpot positions using geometric skip-ahead
	const totalTickets = ticketsPerYear * years;
	const jackpotPositions = new Set<number>();
	let pos = 0;
	while (pos < totalTickets) {
		const skip = Math.floor(-Math.log(rand()) * JACKPOT_ODDS);
		pos += skip;
		if (pos < totalTickets) jackpotPositions.add(pos);
	}

	let ticketIndex = 0;
	for (let y = 0; y < years; y++) {
		let yearWon = 0;
		let yearJackpots = 0;
		let yearBiggest = 0;

		for (let t = 0; t < ticketsPerYear; t++) {
			// Check jackpot
			if (jackpotPositions.has(ticketIndex)) {
				yearJackpots++;
				// Don't add jackpot $ to winnings - tracked separately
			}

			// Small prizes via cumulative lookup
			const r = rand();
			for (const [cum, prize] of POWERBALL_CUM) {
				if (r < cum) {
					yearWon += prize;
					if (prize > yearBiggest) yearBiggest = prize;
					break;
				}
			}
			ticketIndex++;
		}

		totalWon += yearWon;
		totalJackpots += yearJackpots;
		if (yearBiggest > biggestPrize) biggestPrize = yearBiggest;

		yearResults.push({
			year: y + 1,
			spent: ticketsPerYear * ticketCost,
			won: yearWon,
			jackpots: yearJackpots,
			biggestPrize: yearBiggest,
		});
	}

	return {
		years: yearResults,
		totalTickets,
		totalSpent: totalTickets * ticketCost,
		totalWon,
		jackpots: totalJackpots,
		biggestPrize,
	};
}

export interface LotteryPopulationStats {
	people: number;
	totalTickets: number;
	totalSpent: number;
	expectedSmallWinnings: number;
	expectedJackpots: number;
	probAtLeastOneJackpot: number;
}

/** Statistical computation for large populations (no simulation needed) */
export function computeLotteryPopulationStats(
	people: number,
	ticketsPerDay: number,
	years: number,
	ticketCost: number
): LotteryPopulationStats {
	const totalTickets = people * ticketsPerDay * 365 * years;
	const totalSpent = totalTickets * ticketCost;

	let expectedSmallWinnings = 0;
	for (const [denom, prize] of POWERBALL_TIERS) {
		expectedSmallWinnings += (totalTickets / denom) * prize;
	}

	const lambda = totalTickets / JACKPOT_ODDS;
	const probAtLeastOne = 1 - Math.exp(-lambda);

	return {
		people,
		totalTickets,
		totalSpent,
		expectedSmallWinnings,
		expectedJackpots: lambda,
		probAtLeastOneJackpot: probAtLeastOne,
	};
}

// ============================================================
// BLACKJACK
// ============================================================

export type Card = { rank: number; suit: number }; // rank 1-13 (A=1, J=11, Q=12, K=13), suit 0-3

export const BJ_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export const BJ_SUITS = ['♠', '♥', '♦', '♣'] as const;

export function cardStr(c: Card): string {
	return BJ_RANKS[c.rank - 1] + BJ_SUITS[c.suit];
}

export function isRedSuit(c: Card): boolean {
	return c.suit === 1 || c.suit === 2; // hearts, diamonds
}

/** Draw from infinite deck (multi-deck shoe approximation) */
export function drawCard(): Card {
	return { rank: randInt(1, 13), suit: randInt(0, 3) };
}

/** Card's blackjack value (face cards = 10, ace = 11 initially) */
function cardVal(c: Card): number {
	if (c.rank >= 10) return 10;
	if (c.rank === 1) return 11;
	return c.rank;
}

/** Hand value with ace handling. Returns { total, soft } where soft = an ace still counts as 11 */
export function handValue(cards: Card[]): { total: number; soft: boolean } {
	let total = 0;
	let aces = 0;
	for (const c of cards) {
		total += cardVal(c);
		if (c.rank === 1) aces++;
	}
	while (total > 21 && aces > 0) {
		total -= 10;
		aces--;
	}
	return { total, soft: aces > 0 };
}

// --- Basic Strategy Tables (6-deck, S17, DAS, late surrender) ---
// Each string: 10 chars for dealer upcard 2,3,4,5,6,7,8,9,T,A
// H=Hit, S=Stand, D=Double(else Hit), P=Split, R=Surrender(else Hit)

const HARD: string[] = [
	'HHHHHHHHHH', // 5
	'HHHHHHHHHH', // 6
	'HHHHHHHHHH', // 7
	'HHHHHHHHHH', // 8
	'HDDDDHHHHH', // 9
	'DDDDDDDDHH', // 10
	'DDDDDDDDDH', // 11
	'HHHSSHHHHH', // 12
	'SSSSSHHHHH', // 13
	'SSSSSHHHHH', // 14
	'SSSSSHHHRH', // 15 (R vs T)
	'SSSSSHHRRR', // 16 (R vs 9,T,A)
	'SSSSSSSSSS', // 17
	'SSSSSSSSSS', // 18
	'SSSSSSSSSS', // 19
	'SSSSSSSSSS', // 20
	'SSSSSSSSSS', // 21
];

const SOFT: string[] = [
	'HHHDDHHHHH', // soft 13 (A+2)
	'HHHDDHHHHH', // soft 14 (A+3)
	'HHDDDHHHHH', // soft 15 (A+4)
	'HHDDDHHHHH', // soft 16 (A+5)
	'HDDDDHHHHH', // soft 17 (A+6)
	'SDDDDSSHHH', // soft 18 (A+7)
	'SSSSSSSSSS', // soft 19 (A+8)
	'SSSSSSSSSS', // soft 20 (A+9)
];

const PAIRS: string[] = [
	'PPPPPPPPPP', // A,A
	'PPPPPPHHHH', // 2,2
	'PPPPPPHHHH', // 3,3
	'HHHPPHHHHH', // 4,4
	'DDDDDDDDHH', // 5,5 (treat as hard 10)
	'PPPPPHHHHH', // 6,6
	'PPPPPPHHHH', // 7,7
	'PPPPPPPPPP', // 8,8
	'PPPPPSPPSS', // 9,9 (stand vs 7,T,A)
	'SSSSSSSSSS', // T,T
];

/** Dealer upcard → column index (0-9) */
function dealerCol(c: Card): number {
	const v = Math.min(c.rank, 10);
	return v === 1 ? 9 : v - 2; // A→9, 2→0, 3→1, ...10→8
}

type BJAction = 'H' | 'S' | 'D' | 'P' | 'R';

/** Basic strategy lookup: returns optimal first action */
export function basicStrategy(playerCards: Card[], dealerUp: Card): BJAction {
	const col = dealerCol(dealerUp);
	const { total, soft } = handValue(playerCards);
	const canDouble = playerCards.length === 2;
	const canSurrender = playerCards.length === 2;

	// Pairs
	if (playerCards.length === 2) {
		const r0 = Math.min(playerCards[0].rank, 10);
		const r1 = Math.min(playerCards[1].rank, 10);
		if (r0 === r1) {
			const idx = r0 === 1 ? 0 : r0 - 1;
			const action = PAIRS[idx][col] as BJAction;
			if (action === 'P') return 'P';
			// If pair table says D/H/S, fall through to hard/soft tables
		}
	}

	// Soft hands
	if (soft && total >= 13 && total <= 20) {
		const idx = total - 13;
		let action = SOFT[idx][col] as BJAction;
		// Ds distinction: soft 18+ falls back to Stand, soft 13-17 falls back to Hit
		if (action === 'D' && !canDouble) action = total >= 18 ? 'S' : 'H';
		return action;
	}

	// Hard hands
	const idx = Math.min(Math.max(total - 5, 0), HARD.length - 1);
	let action = HARD[idx][col] as BJAction;
	if (action === 'D' && !canDouble) action = 'H';
	if (action === 'R' && !canSurrender) action = 'H';
	return action;
}

export interface BlackjackHandResult {
	result: number; // net P/L multiplier: -1, -0.5, 0, +1, +1.5, -2, +2
	playerCards: Card[];
	dealerCards: Card[];
	doubled: boolean;
	split: boolean;
}

/** Play a single sub-hand (used for split hands and normal play) */
function playSubHand(startCards: Card[], dealerUp: Card): { cards: Card[]; doubled: boolean } {
	const cards = [...startCards];
	const action = basicStrategy(cards, dealerUp);

	if (action === 'D') {
		cards.push(drawCard());
		return { cards, doubled: true };
	}

	// Hit loop (after 2 cards, basicStrategy only returns H or S)
	let next: BJAction = action;
	while (next !== 'S') {
		cards.push(drawCard());
		if (handValue(cards).total >= 21) break;
		next = basicStrategy(cards, dealerUp);
	}
	return { cards, doubled: false };
}

/** Dealer plays: hits until hard 17+ (S17 rules) */
function dealerPlay(cards: Card[]): Card[] {
	const result = [...cards];
	let hv = handValue(result);
	while (hv.total < 17) {
		result.push(drawCard());
		hv = handValue(result);
	}
	return result;
}

/** Resolve one hand vs dealer total. Returns multiplier (-1, 0, +1) */
function resolveVsDealer(playerTotal: number, dealerTotal: number): number {
	if (playerTotal > 21) return -1;
	if (dealerTotal > 21) return 1;
	if (playerTotal > dealerTotal) return 1;
	if (playerTotal < dealerTotal) return -1;
	return 0;
}

/** Play one complete blackjack hand using basic strategy */
export function playBlackjackHand(): BlackjackHandResult {
	const playerCards: Card[] = [drawCard(), drawCard()];
	const dealerCards: Card[] = [drawCard(), drawCard()];
	const dealerUp = dealerCards[0];

	const pv = handValue(playerCards);
	const dv = handValue(dealerCards);

	// Natural blackjack check
	if (pv.total === 21) {
		if (dv.total === 21) return { result: 0, playerCards, dealerCards, doubled: false, split: false };
		return { result: 1.5, playerCards, dealerCards, doubled: false, split: false };
	}
	// Dealer blackjack (player doesn't have one)
	if (dv.total === 21) {
		return { result: -1, playerCards, dealerCards, doubled: false, split: false };
	}

	const action = basicStrategy(playerCards, dealerUp);

	// Surrender
	if (action === 'R') {
		return { result: -0.5, playerCards, dealerCards, doubled: false, split: false };
	}

	// Split
	if (action === 'P') {
		const finDealer = dealerPlay(dealerCards);
		const dt = handValue(finDealer).total;
		let totalResult = 0;
		let anyDouble = false;
		for (let s = 0; s < 2; s++) {
			const splitCard = [playerCards[s], drawCard()];
			const sub = playSubHand(splitCard, dealerUp);
			const pt = handValue(sub.cards).total;
			const mult = sub.doubled ? 2 : 1;
			totalResult += resolveVsDealer(pt, dt) * mult;
			if (sub.doubled) anyDouble = true;
		}
		return { result: totalResult, playerCards, dealerCards: finDealer, doubled: anyDouble, split: true };
	}

	// Normal play (hit/stand/double)
	const sub = playSubHand(playerCards, dealerUp);
	const pt = handValue(sub.cards).total;

	// Player bust - no dealer play needed
	if (pt > 21) {
		return { result: sub.doubled ? -2 : -1, playerCards: sub.cards, dealerCards, doubled: sub.doubled, split: false };
	}

	// Dealer plays
	const finDealer = dealerPlay(dealerCards);
	const dt = handValue(finDealer).total;
	const mult = sub.doubled ? 2 : 1;
	const outcome = resolveVsDealer(pt, dt) * mult;

	return { result: outcome, playerCards: sub.cards, dealerCards: finDealer, doubled: sub.doubled, split: false };
}

/** Simulate a blackjack session with bankroll. Returns array of balances after each hand. */
export function simulateBlackjackSession(
	startBalance: number,
	betAmount: number,
	hands: number
): number[] {
	const balances: number[] = [];
	let balance = startBalance;
	for (let i = 0; i < hands; i++) {
		if (balance < betAmount) break;
		const { result } = playBlackjackHand();
		balance += betAmount * result;
		balance = Math.round(balance * 100) / 100;
		balances.push(balance);
	}
	return balances;
}
