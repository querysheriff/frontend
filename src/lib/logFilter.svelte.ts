import {
	LogEvent_LogLevel,
	LogEvent_LogClassification,
	LogEvent_LogCategory,
	LogFacetField
} from '@buf/querysheriff_backend.bufbuild_es/querysheriff/v1/log_pb';
import { FACET_FIELDS, facetValueLabel } from './logs';
import type { UrlParams } from './urlState.svelte';

/** One applied filter. Values within a field are ORed, fields are ANDed. */
export type LogFacetFilter = { field: LogFacetField; values: string[] };

export type LogFilterChip = { field: LogFacetField; label: string; values: string };

const URL_KEY_BY_FIELD = new Map(FACET_FIELDS.map((f) => [f.field, f.urlKey]));

const CATEGORY_FIELDS = [LogFacetField.CATEGORY, LogFacetField.CLASSIFICATION];

// Values are user data — an application name can contain a comma — so the separator escapes.
function encodeValue(value: string): string {
	return value.replace(/([\\,])/g, '\\$1');
}

function splitValues(raw: string): string[] {
	const out: string[] = [];
	let current = '';

	for (let i = 0; i < raw.length; i++) {
		if (raw[i] === '\\' && i + 1 < raw.length) {
			current += raw[++i];
		} else if (raw[i] === ',') {
			out.push(current);
			current = '';
		} else {
			current += raw[i];
		}
	}
	out.push(current);

	// A trailing empty segment is an artefact of the split; a leading one is the real "(none)"
	// value that background-worker events carry, so only the tail is dropped.
	while (out.length > 1 && out[out.length - 1] === '') out.pop();

	return out;
}

// Guarded because splitValues('') yields [''], which Number() would turn into a filter for
// level 0 — so an absent param would silently filter on UNSPECIFIED.
function enumValues(raw: string | null): number[] {
	if (!raw) return [];

	return splitValues(raw)
		.map(Number)
		.filter((n) => Number.isInteger(n));
}

/** The table's filter: free text, the severity selection and the facet chips. All of it lives
 *  in the URL, so a filtered view is a link. The charts deliberately share none of it. */
export class LogFilterState implements UrlParams {
	// The committed search term; the page debounces the input into it.
	text = $state('');
	levels = $state<LogEvent_LogLevel[]>([]);
	facets = $state<LogFacetFilter[]>([]);

	applyQuery(params: URLSearchParams): void {
		this.text = params.get('q') ?? '';
		this.levels = enumValues(params.get('lvl'));

		const facets: LogFacetFilter[] = [];
		for (const { field, urlKey } of FACET_FIELDS) {
			if (field === LogFacetField.LEVEL) continue;

			const raw = params.get(urlKey);
			if (raw === null) continue;

			facets.push({ field, values: splitValues(raw) });
		}
		this.facets = facets;
	}

	writeQuery(params: URLSearchParams): void {
		if (this.text) params.set('q', this.text);
		if (this.levels.length > 0) params.set('lvl', this.levels.join(','));

		for (const facet of this.facets) {
			const key = URL_KEY_BY_FIELD.get(facet.field);
			if (key) params.set(key, facet.values.map(encodeValue).join(','));
		}
	}

	/** Categories and individual event types collapse into one chip: they come from the same
	 *  picker and the backend unions them, so two chips would read as an AND. */
	get chips(): LogFilterChip[] {
		const label = (field: LogFacetField): string => FACET_FIELDS.find((f) => f.field === field)?.label ?? '';

		const describe = (field: LogFacetField, values: string[]): string =>
			values.map((v) => facetValueLabel(field, v)).join(' or ');

		const chips: LogFilterChip[] = [];

		if (this.levels.length > 0) {
			chips.push({
				field: LogFacetField.LEVEL,
				label: label(LogFacetField.LEVEL),
				values: describe(LogFacetField.LEVEL, this.levels.map(String))
			});
		}

		const categories = this.valuesFor(LogFacetField.CATEGORY);
		const events = this.valuesFor(LogFacetField.CLASSIFICATION);

		if (categories.length > 0 || events.length > 0) {
			chips.push({
				field: LogFacetField.CATEGORY,
				// Named after what it actually holds: the picker writes either dimension, and
				// "Category = Lock deadlock detected" would be calling an event type a category.
				label: label(categories.length > 0 ? LogFacetField.CATEGORY : LogFacetField.CLASSIFICATION),
				values: [describe(LogFacetField.CATEGORY, categories), describe(LogFacetField.CLASSIFICATION, events)]
					.filter(Boolean)
					.join(' or ')
			});
		}

		for (const facet of this.facets) {
			if (CATEGORY_FIELDS.includes(facet.field)) continue;

			chips.push({ field: facet.field, label: label(facet.field), values: describe(facet.field, facet.values) });
		}

		return chips;
	}

	// Severity lives in its own field because it is the one filter the charts and the facet
	// counts ignore; these accessors hide that so callers treat every field the same way.
	valuesFor(field: LogFacetField): string[] {
		if (field === LogFacetField.LEVEL) return this.levels.map(String);

		return this.facets.find((f) => f.field === field)?.values ?? [];
	}

	/** Re-picking a field replaces its selection rather than adding a second chip that would
	 *  AND against it. An empty selection removes the chip. */
	set(field: LogFacetField, values: string[]): void {
		if (field === LogFacetField.LEVEL) {
			this.levels = values.map(Number).filter((n) => Number.isInteger(n));

			return;
		}

		if (values.length === 0) {
			this.facets = this.facets.filter((f) => f.field !== field);

			return;
		}

		const at = this.facets.findIndex((f) => f.field === field);
		if (at < 0) {
			this.facets = [...this.facets, { field, values }];

			return;
		}

		this.facets = this.facets.map((f, i) => (i === at ? { field, values } : f));
	}

	/** Adds one value, for click-a-cell-to-filter in the table. */
	add(field: LogFacetField, value: string): void {
		const current = this.valuesFor(field);
		if (current.includes(value)) return;

		this.set(field, [...current, value]);
	}

	/** The category chip stands for both dimensions the category picker writes, so it clears
	 *  both. */
	remove(field: LogFacetField): void {
		if (field === LogFacetField.CATEGORY) {
			this.set(LogFacetField.CLASSIFICATION, []);
		}

		this.set(field, []);
	}

	toggleLevel(level: LogEvent_LogLevel): void {
		this.levels = this.levels.includes(level) ? this.levels.filter((l) => l !== level) : [...this.levels, level];
	}

	clear(): void {
		this.levels = [];
		this.facets = [];
	}

	/** Categories go over the wire as categories, not expanded classifications: the backend
	 *  owns that mapping, so "everything under Lock" keeps meaning that as it grows. */
	toFacetRequest(): {
		classifications: LogEvent_LogClassification[];
		categories: LogEvent_LogCategory[];
		databases: string[];
		usernames: string[];
		applicationNames: string[];
		backendTypes: string[];
	} {
		return {
			classifications: this.valuesFor(LogFacetField.CLASSIFICATION).map(Number),
			categories: this.valuesFor(LogFacetField.CATEGORY).map(Number),
			databases: this.valuesFor(LogFacetField.DATABASE),
			usernames: this.valuesFor(LogFacetField.USERNAME),
			applicationNames: this.valuesFor(LogFacetField.APPLICATION_NAME),
			backendTypes: this.valuesFor(LogFacetField.BACKEND_TYPE)
		};
	}

	/** The table adds the severity selection; ListLogFacetsRequest has no field for it,
	 *  because the counts ignore it so the severity totals stay stable as you toggle. */
	toRequest(): ReturnType<LogFilterState['toFacetRequest']> & { logLevels: LogEvent_LogLevel[] } {
		return { ...this.toFacetRequest(), logLevels: [...this.levels] };
	}
}
