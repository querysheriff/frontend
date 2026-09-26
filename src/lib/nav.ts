type NavItem = { label: string; href: string; description: string };

export const navItems: NavItem[] = [
	{
		label: 'Queries',
		href: '/queries',
		description: 'How often queries ran, how long they took, and how each one compares'
	},
	{
		label: 'Locks',
		href: '/locks',
		description: 'How much time queries spent stuck waiting, and what was holding them up'
	},
	{
		label: 'Transactions',
		href: '/transactions',
		description: 'How long transactions stayed open, and what they were doing all that time'
	},
	{ label: 'Logs', href: '/logs', description: 'What PostgreSQL logged on this server, by severity and category' },
	{
		label: 'Alerts',
		href: '/alerts',
		description: 'Slack notifications and per-alert toggles for each monitored server'
	}
];

export const adminItems: NavItem[] = [
	{
		label: 'Collectors',
		href: '/admin/collectors',
		description: 'Access tokens that let collectors report into querysheriff'
	},
	{ label: 'Users', href: '/admin/users', description: 'User accounts and which servers each one can see' }
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
