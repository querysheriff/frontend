<script lang="ts">
	import { Switch } from 'bits-ui';
	import { AlertLevel } from '@buf/querysheriff_backend.bufbuild_es/querysheriff/v1/alert_pb';
	import type { AlertSetting } from '@buf/querysheriff_backend.bufbuild_es/querysheriff/v1/alert_pb';
	import SortHeader from '$lib/components/SortHeader.svelte';
	import { fmtCount } from '$lib/format';

	let {
		serverName,
		alerts,
		onToggle
	}: { serverName: string; alerts: AlertSetting[]; onToggle: (alert: AlertSetting) => void } = $props();

	// Nothing sorts: the catalog is short, fixed, and reads best in the backend's order.
	const headDef: { label: string; align: 'left' | 'right'; cls: string }[] = [
		{ label: 'Severity', align: 'left', cls: 'w-[7rem]' },
		{ label: 'Alert', align: 'left', cls: '' },
		{ label: 'Fired in last 7d', align: 'right', cls: 'w-[10.5rem]' },
		{ label: 'Enabled', align: 'right', cls: 'w-[7rem]' }
	];

	const cell = 'border-b border-line-soft px-4 py-3 align-middle';
	// One line of the switch's height in every cell, so nothing centres on the baseline.
	const line = 'flex min-h-6 items-center';

	// Critical is filled, as LOGS fills its severe levels: tinted red misses AA on its own tint.
	const sev: Record<AlertLevel, { label: string; chip: string }> = {
		[AlertLevel.CRITICAL]: { label: 'Critical', chip: 'border-danger bg-danger text-paper' },
		[AlertLevel.WARNING]: { label: 'Warning', chip: 'border-warn/34 bg-warn/10 text-warn-text' },
		[AlertLevel.INFO]: { label: 'Info', chip: 'border-steel/34 bg-steel/10 text-steel-text' },
		[AlertLevel.UNSPECIFIED]: { label: 'Info', chip: 'border-steel/34 bg-steel/10 text-steel-text' }
	};
</script>

<div class="relative overflow-x-auto">
	<table class="w-full min-w-[38rem] table-fixed border-collapse font-sans">
		<caption class="sr-only">Alerts for {serverName}</caption>
		<thead>
			<tr class="bg-hover-soft">
				{#each headDef as h (h.label)}
					<SortHeader label={h.label} align={h.align} class={h.cls} />
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each alerts as alert (alert.key)}
				{@const fires = Number(alert.firesLastWeek)}
				<tr class="transition-colors hover:bg-hover-soft">
					<td class={cell}>
						<div class={line}>
							<span
								class="inline-flex h-6 w-[4.625rem] items-center justify-center border px-1.5 font-condensed text-2xs font-bold tracking-[0.7px] uppercase {sev[
									alert.level
								].chip}"
							>
								{sev[alert.level].label}
							</span>
						</div>
					</td>
					<td class={cell}>
						<div class="{line} font-sans text-lg font-semibold text-ink">{alert.title}</div>
					</td>
					<td class={cell}>
						<div
							class="{line} justify-end font-mono text-md whitespace-nowrap {fires === 0 ? 'text-ink/70' : 'text-ink'}"
						>
							{#if fires === 0}
								<!-- The dash is the visual form of zero; a screen reader gets the number. -->
								<span aria-hidden="true">—</span><span class="sr-only">0</span>
							{:else}
								{fmtCount(fires)}
							{/if}
						</div>
					</td>
					<td class={cell}>
						<div class="{line} justify-end">
							<Switch.Root
								checked={alert.enabled}
								onCheckedChange={() => onToggle(alert)}
								aria-label={`Enable ${alert.title}`}
								class="relative h-6 w-10 cursor-pointer rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-command focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none data-[state=checked]:bg-command data-[state=unchecked]:bg-ink/55"
							>
								<Switch.Thumb
									class="absolute top-0.5 left-0.5 size-5 rounded-full bg-card shadow-knob transition-transform data-[state=checked]:translate-x-4"
								/>
							</Switch.Root>
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
