<script lang="ts">
	import { onMount } from 'svelte';
	import { PlusIcon, Trash2Icon, TriangleAlertIcon, CopyIcon } from '@lucide/svelte';
	import Alert from '$lib/components/Alert.svelte';
	import FormLabel from '$lib/components/FormLabel.svelte';
	import TextInput from '$lib/components/TextInput.svelte';
	import { timestampDate } from '@bufbuild/protobuf/wkt';
	import type { CollectorToken } from '@buf/querysheriff_backend.bufbuild_es/querysheriff/v1/admin_pb';
	import { adminClient } from '$lib/connect';
	import StateBlock from '$lib/components/StateBlock.svelte';
	import { cleanErr, errMsg, fmtDateTime } from '$lib/format';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import PageBar from '$lib/components/PageBar.svelte';

	let tokens = $state<CollectorToken[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let modal = $state<'form' | 'reveal' | null>(null);
	let serverName = $state('');
	let formError = $state<string | null>(null);
	let creating = $state(false);
	let newToken = $state('');
	let newTokenServer = $state('');
	let copied = $state(false);

	const rowAction =
		'inline-flex cursor-pointer items-center gap-1.5 font-condensed text-xs leading-none font-bold tracking-[0.6px] uppercase';

	async function load() {
		loading = true;
		error = null;
		try {
			const res = await adminClient.listCollectorTokens({});
			tokens = res.tokens;
		} catch (e) {
			error = errMsg(e);
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function created(t: CollectorToken): string {
		return t.createdAt ? fmtDateTime(timestampDate(t.createdAt)) : '—';
	}

	function openForm() {
		serverName = '';
		formError = null;
		modal = 'form';
	}

	function close() {
		modal = null;
		newToken = '';
		newTokenServer = '';
		copied = false;
	}

	async function create() {
		const name = serverName.trim();
		if (!name) {
			formError = 'Enter a Postgres server name.';
			return;
		}
		if (creating) return;
		creating = true;
		formError = null;
		try {
			const res = await adminClient.createCollectorToken({ serverName: name });
			newToken = res.tokenValue;
			newTokenServer = res.token?.serverName ?? name;
			copied = false;
			modal = 'reveal';
			await load();
		} catch (e) {
			formError = cleanErr(e);
		} finally {
			creating = false;
		}
	}

	async function copyToken() {
		try {
			await navigator.clipboard.writeText(newToken);
			copied = true;
		} catch {
			// Clipboard may be unavailable; the token stays visible to copy manually.
		}
	}

	async function remove(token: CollectorToken) {
		if (!confirm(`Delete the collector token for "${token.serverName}"? That collector will stop reporting.`)) return;
		try {
			await adminClient.deleteCollectorToken({ id: token.id });
			await load();
		} catch (e) {
			error = errMsg(e);
		}
	}

	const th =
		'border-b border-line px-5 py-3 font-condensed text-xs font-semibold tracking-[0.7px] whitespace-nowrap text-ink/70 uppercase';
</script>

<PageBar>
	{#snippet actions()}
		<Button onclick={openForm}>
			<PlusIcon class="size-3.5 stroke-[2.4]" />
			<span>New Token</span>
		</Button>
	{/snippet}
</PageBar>

<div class="mx-auto w-full max-w-[82.5rem] min-w-0 px-7 pt-7 pb-16">
	<div class="border border-line-card bg-card">
		<div class="overflow-x-auto">
			<table class="w-full min-w-[35rem] border-collapse font-sans">
				<thead>
					<tr class="bg-hover-soft">
						<th scope="col" class="{th} text-left">Postgres Server</th>
						<th scope="col" class="{th} text-left">Created</th>
						<th scope="col" class="{th} w-[7.5rem] text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each tokens as token (token.id.toString())}
						<tr class="hover:bg-hover-soft">
							<td class="border-b border-line-soft px-5 py-3.5">
								<span class="font-mono text-md font-medium text-ink">{token.serverName}</span>
							</td>
							<td class="border-b border-line-soft px-5 py-3.5 font-mono text-sm whitespace-nowrap text-ink/70">
								{created(token)}
							</td>
							<td class="border-b border-line-soft px-5 py-3.5 text-right">
								<button type="button" onclick={() => remove(token)} class="{rowAction} text-ink/70 hover:text-danger">
									<Trash2Icon class="size-3.5 shrink-0" />
									<span>Delete</span>
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if loading}
			<StateBlock class="px-11 py-7" message="Loading…" />
		{:else if error}
			<StateBlock kind="error" class="px-11 py-7" message={error} />
		{:else if tokens.length === 0}
			<StateBlock class="px-11 py-11" message="No collector tokens yet. Create one to connect a collector" />
		{/if}
	</div>
</div>

{#if modal !== null}
	<Modal title={modal === 'reveal' ? 'Token Created' : 'Create Collector Token'} onclose={close}>
		{#if modal === 'form'}
			<div class="p-5">
				<FormLabel for="token-server">Postgres Server</FormLabel>
				<TextInput
					id="token-server"
					type="text"
					bind:value={serverName}
					placeholder="e.g. shdp-prod-5"
					spellcheck="false"
					onkeydown={(e) => e.key === 'Enter' && create()}
				/>
				{#if formError}
					<Alert message={formError} class="mt-3.5 px-3 py-2.5" />
				{/if}
			</div>
			<div class="flex justify-end gap-2.5 border-t border-line px-5 py-3.5">
				<Button variant="secondary" onclick={close}>Cancel</Button>
				<Button onclick={create} disabled={creating}>
					{creating ? 'Creating…' : 'Create Token'}
				</Button>
			</div>
		{:else}
			<div class="p-5">
				<div role="alert" class="mb-4 flex items-center gap-2.5 border border-danger/30 bg-danger/8 px-3.5 py-3">
					<TriangleAlertIcon class="size-4 flex-none text-danger" />
					<div class="font-condensed text-sm font-bold tracking-[0.6px] text-danger uppercase">
						Copy this token now. It will not be shown again.
					</div>
				</div>
				<span class="mb-1.5 block font-condensed text-2xs font-semibold tracking-[1px] text-ink/70 uppercase"
					>Token</span
				>
				<div class="flex items-center gap-3 border border-line-boldest bg-ink px-3.5 py-3.5">
					<code class="min-w-0 flex-1 font-mono text-md leading-[1.5] break-all text-paper">{newToken}</code>
					<button
						type="button"
						onclick={copyToken}
						class="inline-flex flex-none cursor-pointer items-center gap-1.5 bg-command px-3 py-1.5 font-condensed text-xs font-bold tracking-[0.6px] whitespace-nowrap text-paper uppercase hover:bg-danger"
					>
						<CopyIcon class="size-3 stroke-[2.2]" />
						<span>{copied ? 'Copied' : 'Copy'}</span>
					</button>
				</div>
				<div class="mt-3 font-sans text-sm text-ink/70">
					Server <span class="font-mono text-ink">{newTokenServer}</span>
				</div>
			</div>
			<div class="flex justify-end gap-2.5 border-t border-line px-5 py-3.5">
				<Button onclick={close}>Done</Button>
			</div>
		{/if}
	</Modal>
{/if}
