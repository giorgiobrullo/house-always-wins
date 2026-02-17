export type GameId = 'roulette' | 'blackjack' | 'scratch' | 'slots' | 'crash' | 'lottery' | 'sports';

interface GameStats {
	label: string;
	wagered: number;
	net: number;
	rounds: number;
}

const defaults: Record<GameId, GameStats> = {
	roulette: { label: 'Roulette', wagered: 0, net: 0, rounds: 0 },
	blackjack: { label: 'Blackjack', wagered: 0, net: 0, rounds: 0 },
	scratch: { label: 'Scratch Tickets', wagered: 0, net: 0, rounds: 0 },
	slots: { label: 'Slots', wagered: 0, net: 0, rounds: 0 },
	crash: { label: 'Crash', wagered: 0, net: 0, rounds: 0 },
	lottery: { label: 'Lottery', wagered: 0, net: 0, rounds: 0 },
	sports: { label: 'Sports Betting', wagered: 0, net: 0, rounds: 0 },
};

let games = $state<Record<GameId, GameStats>>({ ...defaults });

export function update(id: GameId, data: { wagered: number; net: number; rounds: number }) {
	games[id] = { label: defaults[id].label, ...data };
}

const ALL_IDS: GameId[] = ['roulette', 'blackjack', 'scratch', 'slots', 'crash', 'lottery', 'sports'];
const NON_LOTTERY: GameId[] = ['roulette', 'blackjack', 'scratch', 'slots', 'crash', 'sports'];

export const stats = {
	get games() {
		return games;
	},
	get gamesPlayed(): GameId[] {
		return ALL_IDS.filter((id) => games[id].rounds > 0);
	},
	get totalWagered() {
		return NON_LOTTERY.reduce((sum, id) => sum + games[id].wagered, 0);
	},
	get totalNet() {
		return NON_LOTTERY.reduce((sum, id) => sum + games[id].net, 0);
	},
	get totalRounds() {
		return NON_LOTTERY.reduce((sum, id) => sum + games[id].rounds, 0);
	},
	get lotteryStats() {
		return games.lottery;
	},
	get hasAnyData() {
		return ALL_IDS.some((id) => games[id].rounds > 0);
	},
	get hasLotteryData() {
		return games.lottery.rounds > 0;
	},
};
