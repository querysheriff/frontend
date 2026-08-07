import { format } from 'sql-formatter';

export type SqlNode = {
	/** The line's own text, without its indentation — depth carries that instead. */
	text: string;
	children: SqlNode[];
	/** Lines nested under this node, at any depth. Drives the folded "… N lines" hint. */
	lines: number;
};

/** Roughly how many lines the default view should occupy before anything is unfolded. */
const PREVIEW_LINES = 20;

// A projection is pure noise in a preview — a hundred aliased columns say far
// less than the FROM and WHERE beneath them — so it stays fully folded and its
// share of the budget goes to the clauses that carry the query's logic.
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

// sql-formatter emits a strict indentation tree: top-level clause keywords sit at
// column 0 and everything belonging to them — join lists, predicates, whole
// subqueries — is indented under them, recursively. So indentation alone recovers
// the query's structure, with no SQL parsing. Nesting matters: a `WHERE` can hold
// two top-level entries and still hide forty lines inside a subquery.
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

/**
 * How many children each root shows before the reader unfolds anything, keyed by
 * node path. Deeper nodes start folded, so a nested subquery costs one line.
 */
export function previewLimits(roots: SqlNode[], budget = PREVIEW_LINES): Map<string, number> {
	const shown = new Map<string, number>();
	const wants = roots
		.map((node, i) => ({ path: String(i), want: isProjection(node) ? 0 : node.children.length }))
		.filter((entry) => entry.want > 0);
	for (const entry of wants) shown.set(entry.path, 0);

	// Reserve a line for each root and for the "+N more" each truncated one needs.
	let remaining = Math.max(0, budget - roots.length - wants.length);

	// Water-fill: every clause draws an equal share each round, and whatever a
	// short clause cannot use flows to the ones still truncated. A round always
	// hands out at least one line per open clause, so this terminates.
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

/** Paths of every node that can fold, in document order. */
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

/** Lines hidden by showing only the first `shown` children — nested ones included. */
export function hiddenLines(node: SqlNode, shown: number): number {
	return node.children.slice(shown).reduce((total, child) => total + 1 + child.lines, 0);
}
