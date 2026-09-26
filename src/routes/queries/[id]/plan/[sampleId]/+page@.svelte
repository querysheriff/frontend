<script lang="ts">
	import { page } from '$app/state';
	import type { GetStatementSampleResponse } from '$lib/gen/querysheriff/v1/statement_pb';
	import { statementClient } from '$lib/connect';
	import { errMsg } from '$lib/format';
	import PlanViewer from '$lib/components/PlanViewer.svelte';

	let plan = $state<GetStatementSampleResponse | undefined>(undefined);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const sampleId = $derived(page.params.sampleId ?? '');

	$effect(() => {
		const sid = sampleId;
		if (!/^\d+$/.test(sid)) {
			error = 'Invalid sample id';
			loading = false;
			return;
		}

		let cancelled = false;
		loading = true;
		error = null;

		statementClient
			.getStatementSample({ id: BigInt(sid) })
			.then((res) => {
				if (!cancelled) plan = res;
			})
			.catch((e: unknown) => {
				if (cancelled) return;
				error = errMsg(e);
			})
			.finally(() => {
				if (!cancelled) loading = false;
			});

		return () => {
			cancelled = true;
		};
	});
</script>

<div class="h-screen w-screen bg-paper text-ink">
	{#if plan && plan.planJson}
		<PlanViewer planJson={plan.planJson} statement={plan.query} />
	{:else}
		<div class="flex h-full items-center justify-center font-mono text-sm text-ink/70">
			{loading ? 'Loading plan…' : (error ?? 'No plan was captured for this sample')}
		</div>
	{/if}
</div>
