import { TagFilterOperator, QueryKind } from '$lib/gen/querysheriff/v1/statement_pb';
export type TagOp = 'eq' | 'ne' | 'exists';

export type TagFilter = { key: string; op: TagOp; values: string[] };

export const OP_SYMBOL = { eq: '=', ne: '!=', exists: 'exists' } as const satisfies Record<TagOp, string>;

// The backend rejects a filter on any other key.
const TAG_KEY_RE = /^[a-z][a-z0-9_]*$/;

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

export class QueryFilterState {
	text = $state('');
	tags = $state<TagFilter[]>([]);
	kinds = $state<Record<KindKey, boolean>>({ reads: true, writes: true, others: true });

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
		if (!TAG_KEY_RE.test(filter.key)) return;
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
