import { describe, expect, test } from 'vitest';
import { create } from '@bufbuild/protobuf';
import {
	LogCategory,
	LogEvent_LogClassification,
	LogEvent_LogLevel,
	LogFacetField,
	LogFacetSchema
} from '$lib/gen/querysheriff/v1/log_pb';
import {
	CATEGORY_ORDER,
	FACET_FIELDS,
	LEVEL_ROWS,
	PICKABLE_FACETS,
	categoryBadge,
	categoryColor,
	categoryLabel,
	classificationCode,
	classificationLabel,
	facetTruncated,
	facetValueLabel,
	facetValues,
	levelBadge,
	levelColor,
	levelLabel,
	messageIsSampleText
} from './logs';

const UNKNOWN = 999;

const enumValues = (e: Record<string, string | number>): number[] =>
	Object.values(e).filter((v): v is number => typeof v === 'number');

describe('levels', () => {
	test('levelColor maps a level to its token, and an unknown one to steel', () => {
		expect(levelColor(LogEvent_LogLevel.PANIC)).toBe('var(--color-panic)');
		expect(levelColor(LogEvent_LogLevel.WARNING)).toBe('var(--color-warn)');
		expect(levelColor(UNKNOWN as LogEvent_LogLevel)).toBe('var(--color-steel)');
	});

	test('levelLabel uses the enum name, or UNKNOWN', () => {
		expect(levelLabel(LogEvent_LogLevel.ERROR)).toBe('ERROR');
		expect(levelLabel(UNKNOWN as LogEvent_LogLevel)).toBe('UNKNOWN');
	});

	test('severe levels get a solid badge', () => {
		expect(levelBadge(LogEvent_LogLevel.FATAL)).toEqual({
			color: 'var(--color-paper)',
			background: 'var(--color-danger)',
			border: '1px solid var(--color-danger)'
		});
		expect(levelBadge(LogEvent_LogLevel.ERROR).color).toBe('var(--color-paper)');
	});

	test('warnings get a stronger tint than info, and dark text variants', () => {
		expect(levelBadge(LogEvent_LogLevel.WARNING)).toEqual({
			color: 'var(--color-warn-text)',
			background: 'color-mix(in oklab, var(--color-warn) 16%, var(--color-card))',
			border: '1px solid color-mix(in oklab, var(--color-warn) 50%, var(--color-card))'
		});
		expect(levelBadge(LogEvent_LogLevel.INFO)).toEqual({
			color: 'var(--color-teal-text)',
			background: 'color-mix(in oklab, var(--color-teal) 10%, var(--color-card))',
			border: '1px solid color-mix(in oklab, var(--color-teal) 45%, var(--color-card))'
		});
	});

	test('an unknown level is badged like LOG', () => {
		expect(levelBadge(UNKNOWN as LogEvent_LogLevel)).toEqual(levelBadge(LogEvent_LogLevel.LOG));
	});

	test('LEVEL_ROWS lists every level once, most serious first', () => {
		expect(LEVEL_ROWS).toEqual([
			LogEvent_LogLevel.PANIC,
			LogEvent_LogLevel.FATAL,
			LogEvent_LogLevel.ERROR,
			LogEvent_LogLevel.WARNING,
			LogEvent_LogLevel.NOTICE,
			LogEvent_LogLevel.LOG,
			LogEvent_LogLevel.INFO,
			LogEvent_LogLevel.DEBUG
		]);
		expect([...LEVEL_ROWS].sort()).toEqual(
			enumValues(LogEvent_LogLevel)
				.filter((v) => v !== LogEvent_LogLevel.UNSPECIFIED)
				.sort()
		);
	});
});

describe('classifications', () => {
	test('classificationLabel turns the enum name into a sentence', () => {
		expect(classificationLabel(LogEvent_LogClassification.CHECKPOINT_STARTING)).toBe('Checkpoint starting');
		expect(classificationLabel(LogEvent_LogClassification.LOCK_DEADLOCK_DETECTED)).toBe('Lock deadlock detected');
	});

	test('classificationLabel shows a dash for unspecified or unknown values', () => {
		expect(classificationLabel(LogEvent_LogClassification.UNSPECIFIED)).toBe('—');
		expect(classificationLabel(UNKNOWN as LogEvent_LogClassification)).toBe('—');
	});

	test('classificationCode is the raw enum name', () => {
		expect(classificationCode(LogEvent_LogClassification.CHECKPOINT_STARTING)).toBe('CHECKPOINT_STARTING');
		expect(classificationCode(UNKNOWN as LogEvent_LogClassification)).toBe('');
	});

	test('only slow-statement and auto_explain messages are replaced by their sample', () => {
		expect(messageIsSampleText(LogEvent_LogClassification.STATEMENT_DURATION)).toBe(true);
		expect(messageIsSampleText(LogEvent_LogClassification.STATEMENT_AUTO_EXPLAIN)).toBe(true);
		expect(messageIsSampleText(LogEvent_LogClassification.STATEMENT_LOG)).toBe(false);
	});
});

describe('categories', () => {
	test('CATEGORY_ORDER shows every category once, server first and uncategorized last', () => {
		expect(CATEGORY_ORDER[0]).toBe(LogCategory.SERVER);
		expect(CATEGORY_ORDER.at(-1)).toBe(LogCategory.UNSPECIFIED);
		expect([...CATEGORY_ORDER].sort()).toEqual(enumValues(LogCategory).sort());
	});

	test('categoryLabel names a category, and anything unknown is uncategorized', () => {
		expect(categoryLabel(LogCategory.WAL_CHECKPOINT)).toBe('WAL & Checkpoint');
		expect(categoryLabel(LogCategory.UNSPECIFIED)).toBe('Uncategorized');
		expect(categoryLabel(UNKNOWN as LogCategory)).toBe('Uncategorized');
	});

	test('categoryColor uses tokens, shading one for standby', () => {
		expect(categoryColor(LogCategory.LOCK)).toBe('var(--color-danger)');
		expect(categoryColor(LogCategory.STANDBY)).toBe('color-mix(in oklab, var(--color-ok) 62%, var(--color-ink))');
		expect(categoryColor(UNKNOWN as LogCategory)).toBe('var(--color-steel)');
	});

	test('categoryBadge tints the category color and darkens its text', () => {
		expect(categoryBadge(LogCategory.LOCK)).toEqual({
			color: 'var(--color-danger-text)',
			background: 'color-mix(in oklab, var(--color-danger) 10%, var(--color-card))',
			border: '1px solid color-mix(in oklab, var(--color-danger) 40%, var(--color-card))'
		});
		expect(categoryBadge(LogCategory.UNSPECIFIED).color).toBe('var(--color-ink-muted)');
	});
});

describe('facets', () => {
	const facets = [
		create(LogFacetSchema, {
			field: LogFacetField.DATABASE,
			values: [{ value: 'shop', count: 3n }],
			truncated: true
		})
	];

	test('only the plain fields are pickable; category and event have their own picker', () => {
		expect(PICKABLE_FACETS.map((f) => f.field)).toEqual([
			LogFacetField.LEVEL,
			LogFacetField.DATABASE,
			LogFacetField.USERNAME,
			LogFacetField.APPLICATION_NAME,
			LogFacetField.BACKEND_TYPE
		]);
		expect(FACET_FIELDS.filter((f) => !f.pickable).map((f) => f.field)).toEqual([
			LogFacetField.CATEGORY,
			LogFacetField.CLASSIFICATION
		]);
	});

	test('facetValues finds a field, and is empty for a missing field or no facets', () => {
		expect(facetValues(facets, LogFacetField.DATABASE).map((v) => v.value)).toEqual(['shop']);
		expect(facetValues(facets, LogFacetField.USERNAME)).toEqual([]);
		expect(facetValues(undefined, LogFacetField.DATABASE)).toEqual([]);
	});

	test('facetTruncated reports the backend cap', () => {
		expect(facetTruncated(facets, LogFacetField.DATABASE)).toBe(true);
		expect(facetTruncated(facets, LogFacetField.USERNAME)).toBe(false);
		expect(facetTruncated(undefined, LogFacetField.DATABASE)).toBe(false);
	});

	test('facetValueLabel names enum values and shows (none) for an empty value', () => {
		expect(facetValueLabel(LogFacetField.DATABASE, '')).toBe('(none)');
		expect(facetValueLabel(LogFacetField.DATABASE, 'shop')).toBe('shop');
		expect(facetValueLabel(LogFacetField.CATEGORY, String(LogCategory.LOCK))).toBe('Lock');
		expect(facetValueLabel(LogFacetField.LEVEL, String(LogEvent_LogLevel.ERROR))).toBe('ERROR');
		expect(facetValueLabel(LogFacetField.CLASSIFICATION, String(LogEvent_LogClassification.CHECKPOINT_STARTING))).toBe(
			'Checkpoint starting'
		);
	});
});
