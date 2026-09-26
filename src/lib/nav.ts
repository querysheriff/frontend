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

type NavItem = { label: string; href: string; description: string; icon: Component<{ class?: string }> };

export const navItems: NavItem[] = [
	{
		label: 'Queries',
		href: '/queries',
		icon: DatabaseZapIcon,
		description: 'How often queries ran, how long they took, and how each one compares'
	},
	{
		label: 'Locks',
		href: '/locks',
		icon: LockIcon,
		description: 'How much time queries spent stuck waiting, and what was holding them up'
	},
	{
		label: 'Transactions',
		href: '/transactions',
		icon: ArrowLeftRightIcon,
		description: 'How long transactions stayed open, and what they were doing all that time'
	},
	{
		label: 'Logs',
		href: '/logs',
		icon: ScrollTextIcon,
		description: 'What PostgreSQL logged on this server, by severity and category'
	},
	{
		label: 'Alerts',
		href: '/alerts',
		icon: BellIcon,
		description: 'Slack notifications and per-alert toggles for each monitored server'
	}
];

export const adminItems: NavItem[] = [
	{
		label: 'Collectors',
		href: '/admin/collectors',
		icon: KeyRoundIcon,
		description: 'Access tokens that let collectors report into querysheriff'
	},
	{
		label: 'Users',
		href: '/admin/users',
		icon: UsersIcon,
		description: 'User accounts and which servers each one can see'
	}
];

// A sub-view of Queries, reached by clicking a row, so it has no sidebar entry.
const queryDetail = {
	title: 'Query detail',
	description: 'How often this query ran, how long it took, and real samples'
};

export function screenFor(pathname: string): { title: string; description: string } {
	if (pathname.startsWith('/queries/')) return queryDetail;
	const item = [...navItems, ...adminItems].find((i) => pathname.startsWith(i.href)) ?? navItems[0];
	return { title: item.label, description: item.description };
}

export const isNavActive = (item: NavItem, pathname: string): boolean => pathname.startsWith(item.href);
