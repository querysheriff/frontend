import {
	LogEvent_LogLevel,
	LogEvent_LogClassification,
	LogCategory,
	LogFacetField,
	type LogFacet,
	type LogFacetValue
} from '$lib/gen/querysheriff/v1/log_pb';

export type LevelTier = 'info' | 'warn' | 'severe';

type LevelMeta = { tier: LevelTier; color: string };

const META: Record<LogEvent_LogLevel, LevelMeta> = {
	[LogEvent_LogLevel.UNSPECIFIED]: { tier: 'info', color: 'var(--color-steel)' },
	[LogEvent_LogLevel.PANIC]: { tier: 'severe', color: 'var(--color-panic)' },
	[LogEvent_LogLevel.FATAL]: { tier: 'severe', color: 'var(--color-danger)' },
	[LogEvent_LogLevel.ERROR]: { tier: 'severe', color: 'var(--color-command)' },
	[LogEvent_LogLevel.WARNING]: { tier: 'warn', color: 'var(--color-warn)' },
	[LogEvent_LogLevel.NOTICE]: { tier: 'info', color: 'var(--color-ok)' },
	[LogEvent_LogLevel.LOG]: { tier: 'info', color: 'var(--color-steel)' },
	[LogEvent_LogLevel.INFO]: { tier: 'info', color: 'var(--color-teal)' },
	[LogEvent_LogLevel.DEBUG]: { tier: 'info', color: 'var(--color-taupe)' }
};

export function levelColor(level: LogEvent_LogLevel): string {
	return (META[level] ?? { color: 'var(--color-steel)' }).color;
}

export function levelLabel(level: LogEvent_LogLevel): string {
	return LogEvent_LogLevel[level] ?? 'UNKNOWN';
}

function tint(color: string, pct: number): string {
	return `color-mix(in oklab, ${color} ${pct}%, transparent)`;
}

type PillStyle = { color: string; background: string; border: string };

export function levelBadge(level: LogEvent_LogLevel): PillStyle {
	const m = META[level] ?? META[LogEvent_LogLevel.LOG];

	if (m.tier === 'severe') {
		return { color: 'var(--color-paper)', background: m.color, border: `1px solid ${m.color}` };
	}

	if (m.tier === 'warn') {
		return {
			color: 'var(--color-warn-text)',
			background: tint(m.color, 16),
			border: `1px solid ${tint(m.color, 50)}`
		};
	}

	return { color: m.color, background: tint(m.color, 10), border: `1px solid ${tint(m.color, 45)}` };
}

export function classificationLabel(c: LogEvent_LogClassification): string {
	const name = LogEvent_LogClassification[c];
	if (!name || c === LogEvent_LogClassification.UNSPECIFIED) return '—';
	const words = name.toLowerCase().split('_');
	return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
}

/** Whether `message` is machine output the sample replaces: blanked at ingest, or a corrupted plan. */
export function messageIsSampleText(c: LogEvent_LogClassification): boolean {
	return c === LogEvent_LogClassification.STATEMENT_DURATION || c === LogEvent_LogClassification.STATEMENT_AUTO_EXPLAIN;
}

export function classificationCode(c: LogEvent_LogClassification): string {
	return LogEvent_LogClassification[c] ?? '';
}

function shade(token: string): string {
	return `color-mix(in oklab, ${token} 62%, var(--color-ink))`;
}

/** The categories in display order. The classification -> category mapping lives in the backend. */
const CATEGORY_META: { category: LogCategory; label: string; color: string }[] = [
	{ category: LogCategory.SERVER, label: 'Server', color: 'var(--color-panic)' },
	{ category: LogCategory.CONNECTION, label: 'Connection', color: 'var(--color-teal)' },
	{ category: LogCategory.WAL_CHECKPOINT, label: 'WAL & Checkpoint', color: 'var(--color-taupe)' },
	{ category: LogCategory.AUTOVACUUM, label: 'Autovacuum', color: 'var(--color-ok)' },
	{ category: LogCategory.LOCK, label: 'Lock', color: 'var(--color-danger)' },
	{ category: LogCategory.STATEMENT, label: 'Statement', color: 'var(--color-steel)' },
	{ category: LogCategory.STANDBY, label: 'Standby Server', color: shade('var(--color-ok)') },
	{
		category: LogCategory.CONSTRAINT_VIOLATION,
		label: 'Constraint Violation',
		color: 'var(--color-warn)'
	},
	{
		category: LogCategory.APPLICATION_ERROR,
		label: 'Application Error',
		color: 'var(--color-command)'
	},
	{ category: LogCategory.UNSPECIFIED, label: 'Uncategorized', color: 'var(--color-line-boldest)' }
];

export const CATEGORY_ORDER: LogCategory[] = CATEGORY_META.map((m) => m.category);

const CATEGORY_BY_VALUE = new Map(CATEGORY_META.map((m) => [m.category, m]));

export function categoryLabel(category: LogCategory): string {
	return CATEGORY_BY_VALUE.get(category)?.label ?? 'Uncategorized';
}

export function categoryColor(category: LogCategory): string {
	return CATEGORY_BY_VALUE.get(category)?.color ?? 'var(--color-steel)';
}

export function categoryBadge(category: LogCategory): PillStyle {
	const color = categoryColor(category);

	return { color, background: tint(color, 10), border: `1px solid ${tint(color, 40)}` };
}

/** Most serious first, not `log_min_messages` order, which ranks LOG above ERROR. */
export const LEVEL_ROWS: LogEvent_LogLevel[] = [
	LogEvent_LogLevel.PANIC,
	LogEvent_LogLevel.FATAL,
	LogEvent_LogLevel.ERROR,
	LogEvent_LogLevel.WARNING,
	LogEvent_LogLevel.NOTICE,
	LogEvent_LogLevel.LOG,
	LogEvent_LogLevel.INFO,
	LogEvent_LogLevel.DEBUG
];

type FacetMeta = { field: LogFacetField; label: string; urlKey: string; pickable: boolean };

/** Every filterable field with its `f`-prefixed URL key; category and event are not pickable. */
export const FACET_FIELDS: FacetMeta[] = [
	{ field: LogFacetField.CATEGORY, label: 'Category', urlKey: 'fcat', pickable: false },
	{ field: LogFacetField.CLASSIFICATION, label: 'Event', urlKey: 'fevent', pickable: false },
	{ field: LogFacetField.LEVEL, label: 'Severity', urlKey: 'lvl', pickable: true },
	{ field: LogFacetField.DATABASE, label: 'Database', urlKey: 'fdb', pickable: true },
	{ field: LogFacetField.USERNAME, label: 'User', urlKey: 'fuser', pickable: true },
	{ field: LogFacetField.APPLICATION_NAME, label: 'Application', urlKey: 'fapp', pickable: true },
	{ field: LogFacetField.BACKEND_TYPE, label: 'Backend', urlKey: 'fbackend', pickable: true }
];

export const PICKABLE_FACETS: FacetMeta[] = FACET_FIELDS.filter((f) => f.pickable);

// Background workers have no session, so no database, user or application. The backend sends ''.
const NO_VALUE_LABEL = '(none)';

export function facetValues(facets: LogFacet[] | undefined, field: LogFacetField): LogFacetValue[] {
	return facets?.find((f) => f.field === field)?.values ?? [];
}

export function facetTruncated(facets: LogFacet[] | undefined, field: LogFacetField): boolean {
	return facets?.find((f) => f.field === field)?.truncated ?? false;
}

export function facetValueLabel(field: LogFacetField, value: string): string {
	if (value === '') return NO_VALUE_LABEL;
	if (field === LogFacetField.CATEGORY) return categoryLabel(Number(value));
	if (field === LogFacetField.LEVEL) return levelLabel(Number(value));
	if (field === LogFacetField.CLASSIFICATION) return classificationLabel(Number(value));

	return value;
}
