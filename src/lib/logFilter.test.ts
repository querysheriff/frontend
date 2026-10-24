import { describe, expect, test } from 'vitest';
import {
	LogCategory,
	LogEvent_LogClassification,
	LogEvent_LogLevel,
	LogFacetField
} from '$lib/gen/querysheriff/v1/log_pb';
import { LogFilterState } from './logFilter.svelte';

const ERROR = String(LogEvent_LogLevel.ERROR);
const FATAL = String(LogEvent_LogLevel.FATAL);
const LOCK = String(LogCategory.LOCK);
const CHECKPOINT = String(LogEvent_LogClassification.CHECKPOINT_STARTING);

describe('set and valuesFor', () => {
	test('stores values per field, and an empty list removes the field', () => {
		const filters = new LogFilterState();
		filters.set(LogFacetField.DATABASE, ['shop']);

		expect(filters.valuesFor(LogFacetField.DATABASE)).toEqual(['shop']);
		expect(filters.valuesFor(LogFacetField.USERNAME)).toEqual([]);

		filters.set(LogFacetField.DATABASE, []);
		expect(filters.valuesFor(LogFacetField.DATABASE)).toEqual([]);
		expect(filters.chips).toEqual([]);
	});

	test('setting a field again replaces it in place', () => {
		const filters = new LogFilterState();
		filters.set(LogFacetField.DATABASE, ['shop']);
		filters.set(LogFacetField.USERNAME, ['app']);
		filters.set(LogFacetField.DATABASE, ['billing']);

		expect(filters.chips.map((c) => c.values)).toEqual(['billing', 'app']);
	});
});

describe('chips', () => {
	test('lists severity first, then category, then the other fields in the order they were set', () => {
		const filters = new LogFilterState();
		filters.set(LogFacetField.DATABASE, ['shop', '']);
		filters.set(LogFacetField.CATEGORY, [LOCK]);
		filters.set(LogFacetField.LEVEL, [ERROR, FATAL]);

		expect(filters.chips).toEqual([
			{ field: LogFacetField.LEVEL, label: 'Severity', values: 'ERROR or FATAL' },
			{ field: LogFacetField.CATEGORY, label: 'Category', values: 'Lock' },
			{ field: LogFacetField.DATABASE, label: 'Database', values: 'shop or (none)' }
		]);
	});

	test('merges categories and event types into one chip, since the backend unions them', () => {
		const filters = new LogFilterState();
		filters.set(LogFacetField.CATEGORY, [LOCK]);
		filters.set(LogFacetField.CLASSIFICATION, [CHECKPOINT]);

		expect(filters.chips).toEqual([
			{ field: LogFacetField.CATEGORY, label: 'Category', values: 'Lock or Checkpoint starting' }
		]);
	});

	test('labels the merged chip Event when only event types are picked', () => {
		const filters = new LogFilterState();
		filters.set(LogFacetField.CLASSIFICATION, [CHECKPOINT]);

		expect(filters.chips).toEqual([{ field: LogFacetField.CATEGORY, label: 'Event', values: 'Checkpoint starting' }]);
	});
});

describe('remove and clear', () => {
	test('removing the category chip also drops the event types merged into it', () => {
		const filters = new LogFilterState();
		filters.set(LogFacetField.CATEGORY, [LOCK]);
		filters.set(LogFacetField.CLASSIFICATION, [CHECKPOINT]);
		filters.set(LogFacetField.DATABASE, ['shop']);

		filters.remove(LogFacetField.CATEGORY);

		expect(filters.valuesFor(LogFacetField.CATEGORY)).toEqual([]);
		expect(filters.valuesFor(LogFacetField.CLASSIFICATION)).toEqual([]);
		expect(filters.valuesFor(LogFacetField.DATABASE)).toEqual(['shop']);
	});

	test('removing another field drops only that field', () => {
		const filters = new LogFilterState();
		filters.set(LogFacetField.DATABASE, ['shop']);
		filters.set(LogFacetField.USERNAME, ['app']);

		filters.remove(LogFacetField.DATABASE);

		expect(filters.chips.map((c) => c.field)).toEqual([LogFacetField.USERNAME]);
	});

	test('clear drops every field but keeps the search text', () => {
		const filters = new LogFilterState();
		filters.text = 'deadlock';
		filters.set(LogFacetField.DATABASE, ['shop']);

		filters.clear();

		expect(filters.chips).toEqual([]);
		expect(filters.toFilter().search).toBe('deadlock');
	});
});

test('toFilter sends enum fields as numbers and categories as categories', () => {
	const filters = new LogFilterState();
	filters.text = 'deadlock';
	filters.set(LogFacetField.LEVEL, [ERROR]);
	filters.set(LogFacetField.CATEGORY, [LOCK]);
	filters.set(LogFacetField.CLASSIFICATION, [CHECKPOINT]);
	filters.set(LogFacetField.DATABASE, ['shop']);
	filters.set(LogFacetField.USERNAME, ['app']);
	filters.set(LogFacetField.APPLICATION_NAME, ['checkout']);
	filters.set(LogFacetField.BACKEND_TYPE, ['client backend']);

	expect(filters.toFilter()).toEqual({
		search: 'deadlock',
		levels: [LogEvent_LogLevel.ERROR],
		classifications: [LogEvent_LogClassification.CHECKPOINT_STARTING],
		categories: [LogCategory.LOCK],
		databases: ['shop'],
		usernames: ['app'],
		applicationNames: ['checkout'],
		backendTypes: ['client backend']
	});
});
