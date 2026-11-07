import type { Component } from 'svelte';
import {
	ArrowLeftRightIcon,
	BellIcon,
	DatabaseZapIcon,
	KeyRoundIcon,
	LockIcon,
	ScrollTextIcon,
	UsersIcon
} from '@lucide/svelte';

// Set when the dashboard is served under a path prefix, like the landing page's demo at /demo.
const ROOT: string = import.meta.env.VITE_APP_ROOT ?? '';

/** A dashboard path with the prefix it is served under. */
export const route = (path: string): string => ROOT + path;

const unprefixed = (pathname: string): string => (pathname.startsWith(ROOT) ? pathname.slice(ROOT.length) : pathname);

type NavItem = { label: string; href: string; description: string; icon: Component<{ class?: string }> };

export const navItems: NavItem[] = [
	{
		label: 'Queries',
		href: '/queries',
		icon: DatabaseZapIcon,
		description: 'How often queries ran, how long they took, and which ones used the most time'
	},
	{
		label: 'Locks',
		href: '/locks',
		icon: LockIcon,
		description: 'How long queries waited on locks, and what blocked them'
	},
	{
		label: 'Transactions',
		href: '/transactions',
		icon: ArrowLeftRightIcon,
		description: 'How long transactions stayed open, and what they were doing'
	},
	{
		label: 'Logs',
		href: '/logs',
		icon: ScrollTextIcon,
		description: 'What PostgreSQL logged on this server, grouped by severity and category'
	},
	{
		label: 'Alerts',
		href: '/alerts',
		icon: BellIcon,
		description: 'Slack alerts and per-alert settings for each monitored server'
	}
];

export const adminItems: NavItem[] = [
	{
		label: 'Collectors',
		href: '/admin/collectors',
		icon: KeyRoundIcon,
		description: 'Access tokens collectors use to send data to QuerySheriff'
	},
	{
		label: 'Users',
		href: '/admin/users',
		icon: UsersIcon,
		description: 'User accounts and which monitored servers they can access'
	}
];

// A sub-view of Queries, reached by clicking a row, so it has no sidebar entry.
const queryDetail = {
	title: 'Query detail',
	description: 'How often this query ran, how long it took, and real captured runs'
};

export function screenFor(pathname: string): { title: string; description: string } {
	const path = unprefixed(pathname);
	if (path.startsWith('/queries/')) return queryDetail;
	const item = [...navItems, ...adminItems].find((i) => path.startsWith(i.href)) ?? navItems[0];
	return { title: item.label, description: item.description };
}

export const isNavActive = (item: NavItem, pathname: string): boolean => unprefixed(pathname).startsWith(item.href);
