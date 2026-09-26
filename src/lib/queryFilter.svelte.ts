import { TagFilterOperator, QueryKind } from '$lib/gen/querysheriff/v1/statement_pb';
import { decodeTagFilter, encodeTagFilter, isTagKey, type TagFilter, type TagOp } from './urlCodec';
import type { UrlParams } from './urlState.svelte';

export type KindKey = 'reads' | 'writes' | 'others';

const KIND_KEYS: KindKey[] = ['reads', 'writes', 'others'];

const kindToProto: Record<KindKey, QueryKind> = {
	reads: QueryKind.READS,
	writes: QueryKind.WRITES,
	others: QueryKind.OTHERS
};

const opToProto: Record<TagOp, TagFilterOperator> = {
	eq: TagFilterOperator.EQUAL,
	ne: TagFilterOperator.NOT_EQUAL,
	exists: TagFilterOperator.EXISTS
};

const sameSlot = (a: TagFilter, b: TagFilter): boolean => a.key === b.key && a.op === b.op;

export class QueryFilterState implements UrlParams {
	text = $state('');
	tags = $state<TagFilter[]>([]);
	// Serialized to ?kind= only when it diverges from all-on (absent = all on, empty = all off).
	kinds = $state<Record<KindKey, boolean>>({ reads: true, writes: true, others: true });

	applyQuery(params: URLSearchParams): void {
		this.text = params.get('q') ?? '';
		const tags: TagFilter[] = [];
		for (const raw of params.getAll('tag')) {
			const filter = decodeTagFilter(raw);
			if (filter && !tags.some((f) => sameSlot(f, filter))) tags.push(filter);
		}
		this.tags = tags;

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
		for (const filter of this.tags) params.append('tag', encodeTagFilter(filter));

		const on = KIND_KEYS.filter((k) => this.kinds[k]);
		if (on.length !== KIND_KEYS.length) params.set('kind', on.join(','));
	}

	toRequest() {
		return {
			search: this.text,
			tagFilters: this.tags.map((f) => ({
				key: f.key,
				op: opToProto[f.op],
				values: f.op === 'exists' ? [] : f.values
			})),
			kinds: KIND_KEYS.filter((k) => this.kinds[k]).map((k) => kindToProto[k])
		};
	}

	// One filter per key and operator: a second one replaces the first.
	add(filter: TagFilter): void {
		if (!isTagKey(filter.key)) return;
		const at = this.tags.findIndex((f) => sameSlot(f, filter));
		this.tags = at < 0 ? [...this.tags, filter] : this.tags.map((f, i) => (i === at ? filter : f));
	}

	replace(index: number, filter: TagFilter): void {
		this.tags = this.tags.flatMap((f, i) => (i === index ? [filter] : sameSlot(f, filter) ? [] : [f]));
	}

	remove(index: number): void {
		this.tags = this.tags.filter((_, i) => i !== index);
	}

	clear(): void {
		this.tags = [];
	}
}
