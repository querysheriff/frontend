<script lang="ts">
	import { page } from '$app/state';
	import type { GetStatementSampleResponse } from '$lib/gen/querysheriff/v1/statement_pb';
	import { statementClient } from '$lib/connect';
	import { Loader } from '$lib/loader.svelte';
	import PlanViewer from '$lib/components/PlanViewer.svelte';

	const plan = new Loader<GetStatementSampleResponse>();

	const sampleId = $derived(page.params.sampleId ?? '');

	$effect(() => {
		if (!/^\d+$/.test(sampleId)) return plan.reset(false, 'Invalid sample id');
		const id = BigInt(sampleId);
		return plan.load((signal) => statementClient.getStatementSample({ id }, { signal }));
	});
</script>

<div class="h-screen w-screen bg-paper text-ink">
	{#if plan.data?.planJson}
		<PlanViewer planJson={plan.data.planJson} query={plan.data.query} />
	{:else}
		<div class="flex h-full items-center justify-center font-mono text-sm text-ink/70">
			{plan.loading ? 'Loading plan…' : (plan.error ?? 'No plan was captured for this sample')}
		</div>
	{/if}
</div>
