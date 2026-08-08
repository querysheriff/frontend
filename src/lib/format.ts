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

export function fmtRel(sec: number): string {
	const s = Math.max(0, Math.round(sec));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// "2026-06-09 14:00:00" → "Jun 9 14:00:00"
export function fmtClock(s: string): string {
	if (!s) return '—';
	const [d, t] = s.split(/[ T]/);
	const [, M, D] = d.split('-');
	return `${MONTHS[+M - 1]} ${+D} ${t}`;
}

export function fmtTs(d: Date): string {
	const p = (n: number, w = 2) => String(n).padStart(w, '0');
	return (
		`${MONTHS[d.getMonth()]} ${d.getDate()} ` +
		`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
	);
}

export function fmtClockDate(d: Date): string {
	const p = (n: number) => String(n).padStart(2, '0');
	return `${MONTHS[d.getMonth()]} ${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function fmtClockMinute(d: Date): string {
	const p = (n: number) => String(n).padStart(2, '0');
	return `${MONTHS[d.getMonth()]} ${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtBucketRange(end: Date, bucketMs: number): string {
	const start = new Date(end.getTime() - bucketMs);
	const p = (n: number) => String(n).padStart(2, '0');
	const hm = (d: Date) => `${p(d.getHours())}:${p(d.getMinutes())}`;
	const head = `${MONTHS[start.getMonth()]} ${start.getDate()} ${hm(start)}`;
	if (start.toDateString() === end.toDateString()) return `${head} – ${hm(end)}`;
	return `${head} – ${MONTHS[end.getMonth()]} ${end.getDate()} ${hm(end)}`;
}

// The metric bucket is always a whole number of minutes (backend rounds to the
// minute, floor 1). Renders it as an adjective for "<size> buckets", e.g.
// "1-minute" / "24-minute" / "2-hour".
export function fmtBucketSize(bucketMs: number): string {
	const minutes = Math.round(bucketMs / 60_000);
	if (minutes < 60) return `${minutes}-minute`;
	const hours = minutes / 60;
	if (Number.isInteger(hours)) return `${hours}-hour`;
	return `${minutes}-minute`;
}

export function fmtAxisTime(value: Date | number): string {
	const d = value instanceof Date ? value : new Date(value);
	const p = (n: number) => String(n).padStart(2, '0');
	if (d.getHours() === 0 && d.getMinutes() === 0) return `${d.getMonth() + 1}/${d.getDate()}`;
	return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Keys like `process_id` or `request_id` are high-cardinality identifiers: useful
 *  once you have found the row, useless for scanning. The tag strip is a single
 *  line that clips, so they sort last and the meaningful tag is the one that
 *  survives the clip. */
const isIdTag = (key: string): boolean => key.endsWith('_id');

export function kvTags(tags: Record<string, string>): string[] {
	return Object.entries(tags)
		.sort(([a], [b]) => Number(isIdTag(a)) - Number(isIdTag(b)) || a.localeCompare(b))
		.map(([k, v]) => `${k}=${v}`);
}

export function truncate(text: string, max: number): string {
	return text.length > max ? text.slice(0, max) + '...' : text;
}

export function fmtDateTime(d: Date): string {
	const p = (n: number) => String(n).padStart(2, '0');
	return (
		`${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ` +
		`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
	);
}

export function errMsg(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

export function cleanErr(e: unknown): string {
	return errMsg(e).replace(/^\[[a-z_]+\]\s*/, '');
}

export const sevByMean = (ms: number): string =>
	ms >= 4000 ? 'var(--color-danger)' : ms >= 800 ? 'var(--color-warn)' : 'var(--color-ok)';
export const sevByDuration = (ms: number): string =>
	ms >= 10000 ? 'var(--color-danger)' : ms >= 1000 ? 'var(--color-warn)' : 'var(--color-ok)';

// The vivid warn/ok fills fail text contrast; swap them for their darker
// text-safe variants when a severity color paints text (danger already passes).
export const sevText = (sev: string): string =>
	sev === 'var(--color-warn)' ? 'var(--color-warn-text)' : sev === 'var(--color-ok)' ? 'var(--color-ok-text)' : sev;
