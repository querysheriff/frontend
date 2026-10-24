import { describe, expect, test } from 'vitest';
import { buildSqlTree, foldablePaths, formatSql, hiddenLines, previewLimits, type SqlNode } from './sqlOutline';

const node = (text: string, children: SqlNode[] = []): SqlNode => ({ text, children, lines: 0 });

const withChildren = (text: string, count: number): SqlNode =>
	node(
		text,
		Array.from({ length: count }, (_, i) => node(`c${i}`))
	);

const NESTED = ['SELECT', '  *', 'FROM', '  (', '    SELECT', '      1', '  ) s'].join('\n');

describe('formatSql', () => {
	test('formats PostgreSQL into one clause per line with indented bodies', () => {
		const roots = buildSqlTree(formatSql('select a, b from t join u on u.id = t.id where x = $1'));

		expect(roots.map((r) => r.text)).toEqual(['select', 'from', 'where']);
		expect(roots[0].children.map((c) => c.text)).toEqual(['a,', 'b']);
		expect(roots[1].children.map((c) => c.text)).toEqual(['t', 'join u on u.id = t.id']);
	});

	test('returns the raw text when the formatter cannot parse it', () => {
		expect(formatSql("select 'unterminated")).toBe("select 'unterminated");
	});
});

describe('buildSqlTree', () => {
	test('recovers the clause structure from indentation alone', () => {
		const roots = buildSqlTree(['SELECT', '  a,', '  b', '', 'FROM', '  t', 'WHERE', '  x = 1'].join('\n'));

		expect(roots.map((r) => r.text)).toEqual(['SELECT', 'FROM', 'WHERE']);
		expect(roots.map((r) => r.children.map((c) => c.text))).toEqual([['a,', 'b'], ['t'], ['x = 1']]);
	});

	test('nests deeper levels and counts every line below a node', () => {
		const [select, from] = buildSqlTree(NESTED);
		const [paren, close] = from.children;

		expect(select.lines).toBe(1);
		expect(paren.text).toBe('(');
		expect(paren.children[0].text).toBe('SELECT');
		expect(paren.children[0].children[0].text).toBe('1');
		expect(paren.lines).toBe(2);
		expect(close.text).toBe(') s');
		expect(close.lines).toBe(0);
		expect(from.lines).toBe(4);
	});

	test('returns no roots for empty text', () => {
		expect(buildSqlTree('')).toEqual([]);
	});
});

describe('previewLimits', () => {
	test('shares the line budget, giving what a short clause does not use to the long ones', () => {
		const roots = [withChildren('SELECT', 5), withChildren('FROM', 2), withChildren('WHERE', 30)];

		// 20 lines minus 3 roots minus 2 "+N more" rows leaves 15: FROM takes its 2, WHERE gets the other 13.
		expect(previewLimits(roots, 20)).toEqual(
			new Map([
				['1', 2],
				['2', 13]
			])
		);
	});

	test('leaves projection lists folded, whatever their case', () => {
		const roots = [withChildren('select', 3), withChildren('RETURNING', 3), withChildren('select distinct', 3)];

		expect(previewLimits(roots, 20)).toEqual(new Map());
	});

	test('shows every clause in full when the budget allows', () => {
		const roots = [withChildren('FROM', 2), withChildren('WHERE', 1)];

		expect(previewLimits(roots, 20)).toEqual(
			new Map([
				['0', 2],
				['1', 1]
			])
		);
	});

	test('gives at least one line per round, so a tiny leftover still ends the loop', () => {
		const roots = [withChildren('A', 5), withChildren('B', 5), withChildren('C', 5)];

		expect(previewLimits(roots, 7)).toEqual(
			new Map([
				['0', 1],
				['1', 0],
				['2', 0]
			])
		);
	});

	test('shows no children when the roots alone exceed the budget', () => {
		const roots = [withChildren('A', 2), withChildren('B', 2), withChildren('C', 2)];

		expect(previewLimits(roots, 2)).toEqual(
			new Map([
				['0', 0],
				['1', 0],
				['2', 0]
			])
		);
	});

	test('defaults to a 20-line budget', () => {
		const roots = [withChildren('FROM', 100)];

		// 20 minus 1 root minus 1 "+N more" row.
		expect(previewLimits(roots).get('0')).toBe(18);
	});
});

test('foldablePaths lists every node with children, depth first', () => {
	expect(foldablePaths(buildSqlTree(NESTED))).toEqual(['0', '1', '1.0', '1.0.0']);
});

test('hiddenLines counts the lines under the children that are not shown', () => {
	const from = buildSqlTree(NESTED)[1];

	expect(hiddenLines(from, 0)).toBe(4);
	expect(hiddenLines(from, 1)).toBe(1);
	expect(hiddenLines(from, 2)).toBe(0);
});
