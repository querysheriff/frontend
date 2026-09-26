import { ConnectError } from '@connectrpc/connect';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function sig3(n: number): string {
	if (!Number.isFinite(n)) return '—';
	const abs = Math.abs(n);
	const decimals = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
	const s = n.toFixed(decimals);
	return s.indexOf('.') === -1 ? s : s.replace(/\.?0+$/, '');
}

export function fmtDuration(ms: number): string {
	if (ms < 1000) return `${sig3(ms)}ms`;
	if (ms < 60_000) return `${sig3(ms / 1000)}s`;
	if (ms < 3_600_000) return `${sig3(ms / 60_000)}min`;
	if (ms < 86_400_000) return `${sig3(ms / 3_600_000)}h`;
	return `${sig3(ms / 86_400_000)}d`;
}

export function fmtCount(n: number): string {
	const abs = Math.abs(n);
	if (abs < 1000) return sig3(n);
	if (abs < 1e6) return sig3(n / 1e3) + 'K';
	if (abs < 1e9) return sig3(n / 1e6) + 'M';
	return sig3(n / 1e9) + 'B';
}

export function fmtCountFull(n: number): string {
	return Math.round(n).toLocaleString('en-US');
}

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');
const monthDay = (d: Date): string => `${MONTHS[d.getMonth()]} ${d.getDate()}`;
const hourMinute = (d: Date): string => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function fmtRel(sec: number): string {
	const s = Math.max(0, Math.round(sec));
	return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

// "Jun 9 14:05"
export const fmtClockMinute = (d: Date): string => `${monthDay(d)} ${hourMinute(d)}`;

// "Jun 9 14:05:09"
export const fmtClockDate = (d: Date): string => `${fmtClockMinute(d)}:${pad(d.getSeconds())}`;

// "Jun 9 14:05:09.042"
export const fmtTs = (d: Date): string => `${fmtClockDate(d)}.${pad(d.getMilliseconds(), 3)}`;

// "Jun 9, 2026 14:05:09"
export const fmtDateTime = (d: Date): string =>
	`${monthDay(d)}, ${d.getFullYear()} ${hourMinute(d)}:${pad(d.getSeconds())}`;

export function fmtBucketRange(end: Date, bucketMs: number): string {
	const start = new Date(end.getTime() - bucketMs);
	const head = fmtClockMinute(start);
	if (start.toDateString() === end.toDateString()) return `${head} – ${hourMinute(end)}`;
	return `${head} – ${fmtClockMinute(end)}`;
}

export function fmtBucketSize(bucketMs: number): string {
	const minutes = Math.round(bucketMs / 60_000);
	if (minutes < 60) return `${minutes}-minute`;
	const hours = minutes / 60;
	if (Number.isInteger(hours)) return `${hours}-hour`;
	return `${minutes}-minute`;
}

export function fmtAxisTime(value: Date | number): string {
	const d = value instanceof Date ? value : new Date(value);
	if (d.getHours() === 0 && d.getMinutes() === 0) return `${d.getMonth() + 1}/${d.getDate()}`;
	return hourMinute(d);
}

const isIdTag = (key: string): boolean => key.endsWith('_id');

export function kvTags(tags: Record<string, string>): string[] {
	return Object.entries(tags)
		.sort(([a], [b]) => Number(isIdTag(a)) - Number(isIdTag(b)) || a.localeCompare(b))
		.map(([k, v]) => `${k}=${v}`);
}

export function truncate(text: string, max: number): string {
	return text.length > max ? text.slice(0, max) + '...' : text;
}

export function errMsg(e: unknown): string {
	const err = ConnectError.from(e);
	return err.rawMessage || err.message;
}

// The vivid warn/ok fills fail text contrast, so text uses their darker variants.
export function durationColor(ms: number, warnMs: number, dangerMs: number): string {
	if (ms >= dangerMs) return 'var(--color-danger)';
	if (ms >= warnMs) return 'var(--color-warn-text)';
	return 'var(--color-ok-text)';
}

export const avgDurationColor = (ms: number): string => durationColor(ms, 800, 4000);

export const runDurationColor = (ms: number): string => durationColor(ms, 1000, 10_000);
