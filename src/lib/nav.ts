export interface NavItem {
	key: string;
	label: string;
	href: string;
	/** Hidden from the sidebar for everyone else, and its routes redirect them away. */
	superAdminOnly?: boolean;
}

// `query-detail` is a sub-view of Queries (reached by clicking a row), so it is not listed here.
export const navItems: NavItem[] = [
	{ key: 'slow-queries', label: 'QUERIES', href: '/queries' },
	{ key: 'locks', label: 'LOCKS', href: '/locks' },
	{ key: 'transactions', label: 'TRANSACTIONS', href: '/transactions' },
	{ key: 'logs', label: 'LOGS', href: '/logs' },
	{ key: 'alerts', label: 'ALERTS', href: '/alerts', superAdminOnly: true }
];

export const adminItems: NavItem[] = [
	{ key: 'admin-collectors', label: 'COLLECTORS', href: '/admin/collectors' },
	{ key: 'admin-users', label: 'USERS', href: '/admin/users' }
];

export const screenMeta: Record<string, { title: string; description: string }> = {
	'slow-queries': {
		title: 'QUERIES',
		description: 'How often queries ran, how long they took, and how each one compares'
	},
	'query-detail': {
		title: 'QUERY DETAIL',
		description: 'How often this query ran, how long it took, and real samples'
	},
	locks: {
		title: 'LOCKS',
		description: 'How much time queries spent stuck waiting, and what was holding them up'
	},
	transactions: {
		title: 'TRANSACTIONS',
		description: 'How long transactions stayed open, and what they were doing all that time'
	},
	logs: {
		title: 'LOGS',
		description: 'What PostgreSQL logged on this server, by severity and category'
	},
	alerts: {
		title: 'ALERTS',
		description: 'Slack notifications and per-alert toggles for each monitored server'
	},
	'admin-collectors': {
		title: 'COLLECTORS',
		description: 'Access tokens that let collectors report into querysheriff'
	},
	'admin-users': {
		title: 'USERS',
		description: 'User accounts and which servers each one can see'
	}
};

export function screenKeyForPath(pathname: string): string {
	if (pathname.startsWith('/queries/')) return 'query-detail';
	if (pathname.startsWith('/locks')) return 'locks';
	if (pathname.startsWith('/transactions')) return 'transactions';
	if (pathname.startsWith('/logs')) return 'logs';
	if (pathname.startsWith('/alerts')) return 'alerts';
	if (pathname.startsWith('/admin/collectors')) return 'admin-collectors';
	if (pathname.startsWith('/admin/users')) return 'admin-users';
	return 'slow-queries';
}

export function screenTitle(pathname: string): string {
	return screenMeta[screenKeyForPath(pathname)]?.title ?? '';
}

export function screenDescription(pathname: string): string {
	return screenMeta[screenKeyForPath(pathname)]?.description ?? '';
}

export function isNavActive(item: NavItem, pathname: string): boolean {
	if (item.key === 'slow-queries') return pathname === '/' || pathname.startsWith('/queries');
	return pathname.startsWith(item.href);
}

/** Whether `pathname` belongs to a super-admin-only section. Derived from `navItems` rather
 *  than listed again, so the sidebar and the route guard cannot disagree about who sees what. */
export function isSuperAdminOnlyPath(pathname: string): boolean {
	return navItems.some((item) => item.superAdminOnly && isNavActive(item, pathname));
}
