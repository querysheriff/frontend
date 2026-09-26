// Values are user data (an application name can contain a comma), so the separator is escaped.
export function encodeList(values: string[]): string {
	return values.map((v) => v.replace(/([\\,])/g, '\\$1')).join(',');
}

export function decodeList(raw: string): string[] {
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

	return out;
}

export type TagOp = 'eq' | 'ne' | 'exists';

export type TagFilter = {
	key: string;
	op: TagOp;
	values: string[];
};

// A key can never contain '=', so the first '=' is the operator and only the values need escaping.
const KEY_RE = /^[a-z][a-z0-9_]*$/;

export const OP_SYMBOL = { eq: '=', ne: '!=', exists: 'exists' } as const satisfies Record<TagOp, string>;

export const isTagKey = (key: string): boolean => KEY_RE.test(key);

export function encodeTagFilter(filter: TagFilter): string {
	if (filter.op === 'exists') return filter.key;

	return `${filter.key}${OP_SYMBOL[filter.op]}${encodeList(filter.values)}`;
}

export function decodeTagFilter(raw: string): TagFilter | null {
	const eq = raw.indexOf('=');
	if (eq < 0) return isTagKey(raw) ? { key: raw, op: 'exists', values: [] } : null;

	const ne = raw[eq - 1] === '!';
	const key = raw.slice(0, ne ? eq - 1 : eq);
	if (!isTagKey(key)) return null;

	const values = decodeList(raw.slice(eq + 1)).filter((v) => v !== '');
	if (values.length === 0) return null;

	return { key, op: ne ? 'ne' : 'eq', values };
}
