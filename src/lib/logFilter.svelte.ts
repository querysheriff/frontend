import type { MessageInitShape } from '@bufbuild/protobuf';
import { LogFacetField, type LogFilterSchema } from '$lib/gen/querysheriff/v1/log_pb';
import { FACET_FIELDS, facetValueLabel } from './logs';
import { decodeList, encodeList } from './urlCodec';
import type { UrlParams } from './urlState.svelte';

/** One applied filter. Values within a field are ORed, fields are ANDed. */
type LogFacetFilter = { field: LogFacetField; values: string[] };

type LogFilterChip = { field: LogFacetField; label: string; values: string };

const ENUM_FIELDS = [LogFacetField.LEVEL, LogFacetField.CATEGORY, LogFacetField.CLASSIFICATION];

function parseValues(field: LogFacetField, raw: string): string[] {
	const values = decodeList(raw);

	return ENUM_FIELDS.includes(field) ? values.filter((v) => /^\d+$/.test(v)) : values;
}

const fieldLabel = (field: LogFacetField): string => FACET_FIELDS.find((f) => f.field === field)?.label ?? '';

const describe = (field: LogFacetField, values: string[]): string =>
	values.map((v) => facetValueLabel(field, v)).join(' or ');

export class LogFilterState implements UrlParams {
	text = $state('');
	#selected = $state.raw<LogFacetFilter[]>([]);

	applyQuery(params: URLSearchParams): void {
		this.text = params.get('q') ?? '';

		const selected: LogFacetFilter[] = [];
		for (const { field, urlKey } of FACET_FIELDS) {
			const raw = params.get(urlKey);
			if (raw === null) continue;

			const values = parseValues(field, raw);
			if (values.length > 0) selected.push({ field, values });
		}
		this.#selected = selected;
	}

	writeQuery(params: URLSearchParams): void {
		if (this.text) params.set('q', this.text);

		for (const { field, urlKey } of FACET_FIELDS) {
			const values = this.valuesFor(field);
			if (values.length > 0) params.set(urlKey, encodeList(values));
		}
	}

	/** Categories and event types collapse into one chip: the backend unions them, so two would read as AND. */
	get chips(): LogFilterChip[] {
		const chips: LogFilterChip[] = [];

		const levels = this.valuesFor(LogFacetField.LEVEL);
		if (levels.length > 0) {
			chips.push({
				field: LogFacetField.LEVEL,
				label: fieldLabel(LogFacetField.LEVEL),
				values: describe(LogFacetField.LEVEL, levels)
			});
		}

		const categories = this.valuesFor(LogFacetField.CATEGORY);
		const events = this.valuesFor(LogFacetField.CLASSIFICATION);
		if (categories.length > 0 || events.length > 0) {
			chips.push({
				field: LogFacetField.CATEGORY,
				label: fieldLabel(categories.length > 0 ? LogFacetField.CATEGORY : LogFacetField.CLASSIFICATION),
				values: [describe(LogFacetField.CATEGORY, categories), describe(LogFacetField.CLASSIFICATION, events)]
					.filter(Boolean)
					.join(' or ')
			});
		}

		for (const { field, values } of this.#selected) {
			if (ENUM_FIELDS.includes(field)) continue;
			chips.push({ field, label: fieldLabel(field), values: describe(field, values) });
		}

		return chips;
	}

	valuesFor(field: LogFacetField): string[] {
		return this.#selected.find((f) => f.field === field)?.values ?? [];
	}

	set(field: LogFacetField, values: string[]): void {
		const at = this.#selected.findIndex((f) => f.field === field);
		if (values.length === 0) this.#selected = this.#selected.filter((f) => f.field !== field);
		else if (at < 0) this.#selected = [...this.#selected, { field, values }];
		else this.#selected = this.#selected.map((f, i) => (i === at ? { field, values } : f));
	}

	remove(field: LogFacetField): void {
		if (field === LogFacetField.CATEGORY) this.set(LogFacetField.CLASSIFICATION, []);
		this.set(field, []);
	}

	clear(): void {
		this.#selected = [];
	}

	/** Categories go over the wire as categories: the backend owns the mapping. */
	toFilter(): MessageInitShape<typeof LogFilterSchema> {
		return {
			search: this.text,
			levels: this.valuesFor(LogFacetField.LEVEL).map(Number),
			classifications: this.valuesFor(LogFacetField.CLASSIFICATION).map(Number),
			categories: this.valuesFor(LogFacetField.CATEGORY).map(Number),
			databases: this.valuesFor(LogFacetField.DATABASE),
			usernames: this.valuesFor(LogFacetField.USERNAME),
			applicationNames: this.valuesFor(LogFacetField.APPLICATION_NAME),
			backendTypes: this.valuesFor(LogFacetField.BACKEND_TYPE)
		};
	}
}
