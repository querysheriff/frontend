<script lang="ts">
	import { DatabaseIcon, ClockIcon, ChevronDownIcon, CheckIcon, ArrowRightIcon, StarIcon } from '@lucide/svelte';
	import { Select, Popover } from 'bits-ui';
	import type { DateRange } from 'bits-ui';
	import { fromDate, getLocalTimeZone, toCalendarDateTime } from '@internationalized/date';
	import { ctx, defaultScope, serversState, presets } from '$lib/state.svelte';
	import { fmtClockDate } from '$lib/format';
	import PageBar from '$lib/components/PageBar.svelte';
	import DateTimeRangeField from '$lib/components/DateTimeRangeField.svelte';

	let timeOpen = $state(false);
	let draftRange = $state<DateRange>(currentRange());

	function currentRange(): DateRange {
		const tz = getLocalTimeZone();
		return {
			start: toCalendarDateTime(fromDate(ctx.customFrom, tz)),
			end: toCalendarDateTime(fromDate(ctx.customTo, tz))
		};
	}

	const healthDot = (server: string): string => (serversState.isHealthy(server) ? 'bg-ok' : 'bg-warn');
	const healthTitle = (server: string): string =>
		serversState.isHealthy(server)
			? 'Collector healthy · reported within 5 minutes'
			: 'Collector not responding · no health check in over 5 minutes';

	function selectServer(name: string) {
		ctx.server = name;
		serversState.reconcile();
	}
	function selectPreset(key: string) {
		ctx.range = key;
		timeOpen = false;
	}
	function applyCustom() {
		const { start, end } = draftRange;
		if (!start || !end) return;
		const tz = getLocalTimeZone();
		ctx.setCustom(start.toDate(tz), end.toDate(tz));
		timeOpen = false;
	}

	const triggerCls = 'flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-hover-soft';
	const panelCls = 'z-50 max-w-[calc(100vw-24px)] border border-line-strong bg-card p-1.5 shadow-dropdown';
	const itemCls =
		'flex w-full cursor-pointer items-center gap-2.5 px-2.5 py-2 font-mono text-sm text-ink hover:bg-hover data-[highlighted]:bg-hover';
	const labelCls = 'px-2.5 pt-1.5 pb-1 font-sans text-2xs font-semibold text-ink/70';
</script>

<PageBar>
	{#snippet actions()}
		<div class="flex border border-line-card bg-card">
			{#if ctx.scopeLocked}
				<div
					class="flex items-center gap-2 border-r border-line px-3 py-2"
					title="This query lives on {ctx.server} — the server is fixed here"
				>
					<span class="h-2 w-2 rounded-full {healthDot(ctx.server)}" title={healthTitle(ctx.server)}></span>
					<span class="font-mono text-sm font-medium text-ink">{ctx.server}</span>
				</div>
				<div
					class="flex items-center gap-2 px-3 py-2"
					title="This query lives in {ctx.db} — the database is fixed here"
				>
					<DatabaseIcon class="size-3.5 flex-none text-steel" />
					<span class="font-mono text-sm font-medium text-ink">{ctx.db}</span>
				</div>
			{:else}
				<Select.Root type="single" value={ctx.server} onValueChange={selectServer}>
					<Select.Trigger>
						{#snippet child({ props })}
							<button {...props} class={triggerCls} aria-label="Select Postgres server">
								<span class="h-2 w-2 rounded-full {healthDot(ctx.server)}" title={healthTitle(ctx.server)}></span>
								<span class="font-mono text-sm font-medium text-ink">{ctx.server || '—'}</span>
								<ChevronDownIcon class="size-3.5 text-ink/55" />
							</button>
						{/snippet}
					</Select.Trigger>
					<Select.Portal>
						<Select.Content sideOffset={6} align="start" class="{panelCls} min-w-[13.125rem]">
							<div class={labelCls}>Postgres server</div>
							{#each serversState.names as s (s)}
								<Select.Item value={s} label={s}>
									{#snippet child({ props, selected })}
										<div {...props} class="{itemCls} {selected ? 'font-semibold' : ''}">
											<span class="h-2 w-2 rounded-full {healthDot(s)}"></span>
											<span class="flex-1 text-left">{s}</span>
											{#if selected}<CheckIcon class="size-3.5 text-command" />{/if}
										</div>
									{/snippet}
								</Select.Item>
							{:else}
								<div class="px-2.5 py-2 font-mono text-sm text-ink/70">No servers</div>
							{/each}
						</Select.Content>
					</Select.Portal>
				</Select.Root>

				{#if ctx.dbScoped}
					<Select.Root type="single" value={ctx.db} onValueChange={(v) => (ctx.db = v)}>
						<Select.Trigger>
							{#snippet child({ props })}
								<button {...props} title="Select database" class="{triggerCls} border-l border-line">
									<DatabaseIcon class="size-3.5 flex-none text-steel" />
									<span class="font-mono text-sm font-medium text-ink">{ctx.db || '—'}</span>
									<ChevronDownIcon class="size-3.5 text-ink/55" />
								</button>
							{/snippet}
						</Select.Trigger>
						<Select.Portal>
							<Select.Content sideOffset={6} align="end" class="{panelCls} min-w-[11.875rem]">
								<div class={labelCls}>Database</div>
								{#each serversState.databasesFor(ctx.server) as d (d)}
									<Select.Item value={d} label={d}>
										{#snippet child({ props, selected })}
											<div {...props} class="{itemCls} {selected ? 'font-semibold' : ''}">
												<span class="flex-1 text-left">{d}</span>
												{#if selected}<CheckIcon class="size-3.5 text-command" />{/if}
											</div>
										{/snippet}
									</Select.Item>
								{:else}
									<div class="px-2.5 py-2 font-mono text-sm text-ink/70">No databases</div>
								{/each}
							</Select.Content>
						</Select.Portal>
					</Select.Root>
					<button
						type="button"
						onclick={() => defaultScope.toggle()}
						disabled={!ctx.server || !ctx.db}
						aria-pressed={defaultScope.isCurrent}
						aria-label="Set as default server and database"
						title={defaultScope.isCurrent
							? 'Default server and database · click to unset'
							: 'Set as default server and database'}
						class="flex cursor-pointer items-center border-l border-line px-2.5 hover:bg-hover-soft disabled:cursor-default disabled:opacity-40"
					>
						<StarIcon class="size-3.5 {defaultScope.isCurrent ? 'fill-warn text-warn' : 'text-ink/55'}" />
					</button>
				{/if}
			{/if}
		</div>

		<Popover.Root
			bind:open={timeOpen}
			onOpenChange={(o) => {
				if (o) draftRange = currentRange();
			}}
		>
			<Popover.Trigger>
				{#snippet child({ props })}
					<button
						{...props}
						class="flex cursor-pointer items-center gap-2 border border-line-card bg-card px-3 py-2 hover:bg-hover-soft"
					>
						<ClockIcon class="size-3.5 flex-none text-warn" />
						{#if ctx.isCustom}
							<span class="flex items-center gap-1.5 font-mono text-sm font-medium whitespace-nowrap text-ink">
								{fmtClockDate(ctx.customFrom)}
								<ArrowRightIcon class="size-3 flex-none text-ink/55" />
								{fmtClockDate(ctx.customTo)}
							</span>
						{:else}
							<span class="font-mono text-sm font-medium whitespace-nowrap text-ink">{ctx.timeLabel}</span>
						{/if}
						<ChevronDownIcon class="size-3.5 text-ink/55" />
					</button>
				{/snippet}
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content
					sideOffset={6}
					align="end"
					class="z-50 flex max-w-[calc(100vw-24px)] flex-col border border-line-strong bg-card shadow-popover sm:flex-row"
				>
					<div class="border-b border-line px-2 py-3.5 sm:min-w-[10.75rem] sm:border-r sm:border-b-0">
						<div class="mb-2.5 px-2.5 font-sans text-2xs font-semibold text-ink/70">Quick ranges</div>
						{#each presets as { key, label } (key)}
							<button
								type="button"
								onclick={() => selectPreset(key)}
								class="block w-full cursor-pointer px-3 py-2 text-left font-sans text-sm whitespace-nowrap hover:bg-hover {ctx.range ===
								key
									? 'bg-accent font-semibold text-command'
									: 'text-ink'}"
							>
								{label}
							</button>
						{/each}
					</div>
					<div class="w-[16.75rem] max-w-full px-4 py-3.5">
						<div class="mb-2.5 font-sans text-2xs font-semibold text-ink/70">Absolute time range</div>
						<DateTimeRangeField bind:value={draftRange} onSubmit={applyCustom} />
						<button
							type="button"
							onclick={applyCustom}
							class="mt-3.5 w-full cursor-pointer bg-command px-2.5 py-2.5 text-center font-sans text-md font-semibold text-paper hover:bg-danger"
						>
							Apply range
						</button>
					</div>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	{/snippet}
</PageBar>
