export function money(n: number): string {
	return n < 0
		? `-$${Math.abs(n).toFixed(2)}`
		: `$${n.toFixed(2)}`;
}

export function moneyWhole(n: number): string {
	return n < 0
		? `-$${Math.abs(Math.round(n)).toLocaleString('en-US')}`
		: `$${Math.round(n).toLocaleString('en-US')}`;
}

export function pct(n: number, decimals = 1): string {
	return `${(n * 100).toFixed(decimals)}%`;
}

export function odds(n: number): string {
	if (n >= 1) return `1 in ${Math.round(n).toLocaleString('en-US')}`;
	return `${(n * 100).toFixed(1)}%`;
}

export function compact(n: number): string {
	if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
	return n.toLocaleString('en-US');
}

export function moneyCompact(n: number): string {
	const abs = Math.abs(n);
	const sign = n < 0 ? '-' : '';
	if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
	if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
	return moneyWhole(n);
}
