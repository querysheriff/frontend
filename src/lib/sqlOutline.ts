import { format } from 'sql-formatter';

export type SqlNode = {
	text: string;
	children: SqlNode[];
	/** Lines nested under this node, at any depth. Drives the folded "… N lines" hint. */
	lines: number;
};

const PREVIEW_LINES = 20;

const PROJECTIONS = new Set(['SELECT', 'SELECT DISTINCT', 'SELECT ALL', 'RETURNING']);

export function isProjection(node: SqlNode): boolean {
	return PROJECTIONS.has(node.text.trim().toUpperCase());
}

export function formatSql(raw: string): string {
	try {
		return format(raw, { language: 'postgresql' });
	} catch {
		return raw;
	}
}

// sql-formatter indents strictly, so indentation alone recovers the structure — no SQL parsing.
export function buildSqlTree(formatted: string): SqlNode[] {
	const roots: SqlNode[] = [];
	const stack: { node: SqlNode; indent: number }[] = [];

	for (const raw of formatted.split('\n')) {
		if (raw.trim() === '') continue;
		const indent = raw.length - raw.trimStart().length;
		const node: SqlNode = { text: raw.trim(), children: [], lines: 0 };

		while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop();
		if (stack.length > 0) stack[stack.length - 1].node.children.push(node);
		else roots.push(node);
		stack.push({ node, indent });
	}

	for (const root of roots) countLines(root);
	return roots;
}

function countLines(node: SqlNode): number {
	node.lines = node.children.reduce((total, child) => total + 1 + countLines(child), 0);
	return node.lines;
}

export function previewLimits(roots: SqlNode[], budget = PREVIEW_LINES): Map<string, number> {
	const shown = new Map<string, number>();
	const wants = roots
		.map((node, i) => ({ path: String(i), want: isProjection(node) ? 0 : node.children.length }))
		.filter((entry) => entry.want > 0);
	for (const entry of wants) shown.set(entry.path, 0);

	// Reserve a line for each root and for the "+N more" each truncated one needs.
	let remaining = Math.max(0, budget - roots.length - wants.length);

	// Water-fill: an equal share each round, leftovers flow to the still-truncated, one line minimum.
	let open = wants;
	while (remaining > 0 && open.length > 0) {
		const share = Math.max(1, Math.floor(remaining / open.length));
		for (const entry of open) {
			if (remaining <= 0) break;
			const current = shown.get(entry.path) ?? 0;
			const add = Math.min(share, entry.want - current, remaining);
			shown.set(entry.path, current + add);
			remaining -= add;
		}
		open = open.filter((entry) => (shown.get(entry.path) ?? 0) < entry.want);
	}

	return shown;
}

export function foldablePaths(roots: SqlNode[]): string[] {
	const paths: string[] = [];
	const walk = (nodes: SqlNode[], prefix: string) => {
		nodes.forEach((node, i) => {
			if (node.children.length === 0) return;
			const path = prefix === '' ? String(i) : `${prefix}.${i}`;
			paths.push(path);
			walk(node.children, path);
		});
	};
	walk(roots, '');
	return paths;
}

export function hiddenLines(node: SqlNode, shown: number): number {
	return node.children.slice(shown).reduce((total, child) => total + 1 + child.lines, 0);
}
