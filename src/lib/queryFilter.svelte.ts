import { TagFilterOperator, QueryKind } from '$lib/gen/querysheriff/v1/statement_pb';
import type { UrlParams } from './urlState.svelte';

export type TagOp = 'eq' | 'ne' | 'exists';

export type KindKey = 'reads' | 'writes' | 'others';

export const KIND_KEYS: KindKey[] = ['reads', 'writes', 'others'];

const kindToProto: Record<KindKey, QueryKind> = {
	reads: QueryKind.READS,
	writes: QueryKind.WRITES,
	others: QueryKind.OTHERS
};

export type TagFilter = {
	key: string;
	op: TagOp;
	values: string[];
};

// A key can never contain '=', so the first '=' is the operator and only the values need escaping.
const KEY_RE = /^[a-z][a-z0-9_]*$/;

function encodeValue(value: string): string {
	return value.replace(/([\\,])/g, '\\$1');
}

function splitValues(raw: string): string[] {
	const out: string[] = [];
	let current = '';

	for (let i = 0; i < raw.length; i++) {
		if (raw[i] === '\\' && i + 1 < raw.length) {
			current += raw[++i];
		} else if (raw[i] === ',') {
			out.push(current);
			current = '';
		} else {
			current += raw[i];
		}
	}
	out.push(current);

	return out.filter((v) => v !== '');
}

function encodeTagFilter(filter: TagFilter): string {
	if (filter.op === 'exists') return filter.key;

	return `${filter.key}${filter.op === 'ne' ? '!=' : '='}${filter.values.map(encodeValue).join(',')}`;
}

function decodeTagFilter(raw: string): TagFilter | null {
	const eq = raw.indexOf('=');
	if (eq < 0) return KEY_RE.test(raw) ? { key: raw, op: 'exists', values: [] } : null;

	const ne = raw[eq - 1] === '!';
	const key = raw.slice(0, ne ? eq - 1 : eq);
	if (!KEY_RE.test(key)) return null;

	const values = splitValues(raw.slice(eq + 1));
	if (values.length === 0) return null;

	return { key, op: ne ? 'ne' : 'eq', values };
}

// The backend omits any key whose samples disagree, so a displayed tag is always one agreed value.
export function parseDisplayTag(text: string): TagFilter | null {
	const eq = text.indexOf('=');
	if (eq < 0) return null;

	const key = text.slice(0, eq);
	const value = text.slice(eq + 1);
	if (!KEY_RE.test(key) || value === '') return null;

	return { key, op: 'eq', values: [value] };
}

export function describeTagFilter(filter: TagFilter): string {
	if (filter.op === 'exists') return `${filter.key} exists`;

	return `${filter.key} ${filter.op === 'ne' ? '!=' : '='} ${filter.values.join(' or ')}`;
}

const opToProto: Record<TagOp, TagFilterOperator> = {
	eq: TagFilterOperator.EQUAL,
	ne: TagFilterOperator.NOT_EQUAL,
	exists: TagFilterOperator.EXISTS
};

export class QueryFilterState implements UrlParams {
	text = $state('');
	chips = $state<TagFilter[]>([]);
	// Serialized to ?kind= only when it diverges from all-on (absent = all on, empty = all off).
	kinds = $state<Record<KindKey, boolean>>({ reads: true, writes: true, others: true });

	applyQuery(params: URLSearchParams): void {
		this.text = params.get('q') ?? '';
		this.chips = params
			.getAll('tag')
			.map(decodeTagFilter)
			.filter((f): f is TagFilter => f !== null);

		const kind = params.get('kind');
		if (kind === null) {
			this.kinds = { reads: true, writes: true, others: true };
		} else {
			const on = kind.split(',');
			this.kinds = {
				reads: on.includes('reads'),
				writes: on.includes('writes'),
				others: on.includes('others')
			};
		}
	}

	writeQuery(params: URLSearchParams): void {
		if (this.text) params.set('q', this.text);
		for (const filter of this.chips) params.append('tag', encodeTagFilter(filter));

		const on = KIND_KEYS.filter((k) => this.kinds[k]);
		if (on.length !== KIND_KEYS.length) params.set('kind', on.join(','));
	}

	toProto(): { key: string; op: TagFilterOperator; values: string[] }[] {
		return this.chips.map((f) => ({
			key: f.key,
			op: opToProto[f.op],
			values: f.op === 'exists' ? [] : f.values
		}));
	}

	kindsProto(): QueryKind[] {
		return KIND_KEYS.filter((k) => this.kinds[k]).map((k) => kindToProto[k]);
	}

	add(filter: TagFilter): void {
		const at = this.chips.findIndex((f) => f.key === filter.key && f.op === filter.op);
		if (at < 0) {
			this.chips = [...this.chips, filter];
			return;
		}

		this.chips = this.chips.map((f, i) => (i === at ? filter : f));
	}

	replace(index: number, filter: TagFilter): void {
		this.chips = this.chips.map((f, i) => (i === index ? filter : f));
	}

	remove(index: number): void {
		this.chips = this.chips.filter((_, i) => i !== index);
	}

	clear(): void {
		this.chips = [];
	}
}
