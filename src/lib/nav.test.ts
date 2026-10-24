import { expect, test } from 'vitest';
import { adminItems, isNavActive, navItems, screenFor } from './nav';

test('screenFor titles a screen by its section', () => {
	expect(screenFor('/locks').title).toBe('Locks');
	expect(screenFor('/admin/users').title).toBe('Users');
	expect(screenFor('/queries').title).toBe('Queries');
});

test('screenFor gives query detail its own title', () => {
	expect(screenFor('/queries/123').title).toBe('Query detail');
	expect(screenFor('/queries/123/plan/4').title).toBe('Query detail');
});

test('screenFor falls back to Queries for an unknown path', () => {
	expect(screenFor('/nope')).toEqual({ title: 'Queries', description: navItems[0].description });
});

test('isNavActive matches a section and its sub-paths', () => {
	const users = adminItems[1];

	expect(isNavActive(users, '/admin/users')).toBe(true);
	expect(isNavActive(users, '/admin/collectors')).toBe(false);
	expect(isNavActive(navItems[0], '/queries/42')).toBe(true);
});
