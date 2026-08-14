<script lang="ts">
	import { onMount } from 'svelte';
	import { LinkIcon, InfoIcon, XIcon } from '@lucide/svelte';
	import Alert from '$lib/components/Alert.svelte';
	import AlertsTable from '$lib/components/AlertsTable.svelte';
	import Button from '$lib/components/Button.svelte';
	import DocCard from '$lib/components/DocCard.svelte';
	import FormLabel from '$lib/components/FormLabel.svelte';
	import type {
		ServerAlertSettings,
		AlertSetting
	} from '@buf/querysheriff_backend.bufbuild_es/querysheriff/v1/alert_pb';
	import { alertClient } from '$lib/connect';
	import StateBlock from '$lib/components/StateBlock.svelte';
	import { DOC_ID_SEP } from '$lib/docsContent';
	import { errMsg } from '$lib/format';
	import PageBar from '$lib/components/PageBar.svelte';

	let servers = $state<ServerAlertSettings[]>([]);
	let drafts = $state<Record<string, string>>({});
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function load() {
		loading = true;
		error = null;
		try {
			const res = await alertClient.queryAlerts({});
			servers = res.servers;
			drafts = Object.fromEntries(res.servers.map((s) => [s.serverName, s.slackWebhookUrl]));
		} catch (e) {
			error = errMsg(e);
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function isDirty(s: ServerAlertSettings): boolean {
		return (drafts[s.serverName] ?? '').trim() !== s.slackWebhookUrl.trim();
	}

	async function persist(
		s: ServerAlertSettings,
		slackWebhookUrl: string,
		toggles: { key: string; enabled: boolean }[]
	) {
		await alertClient.updateAlertSettings({ serverName: s.serverName, slackWebhookUrl, toggles });
	}

	async function saveWebhook(s: ServerAlertSettings) {
		const url = (drafts[s.serverName] ?? '').trim();
		error = null;
		try {
			await persist(s, url, []);
			s.slackWebhookUrl = url;
			drafts[s.serverName] = url;
		} catch (e) {
			error = errMsg(e);
		}
	}

	function clearWebhook(s: ServerAlertSettings) {
		drafts[s.serverName] = '';
	}

	async function toggleAlert(s: ServerAlertSettings, alert: AlertSetting) {
		const next = !alert.enabled;
		alert.enabled = next; // optimistic; reverted on failure
		error = null;
		try {
			await persist(s, s.slackWebhookUrl, [{ key: alert.key, enabled: next }]);
		} catch (e) {
			alert.enabled = !next;
			error = errMsg(e);
		}
	}
</script>

<PageBar />

<div class="mx-auto w-full max-w-[68.75rem] min-w-0 px-7 pt-7 pb-16">
	{#if error && servers.length > 0}
		<Alert message={error} class="mb-5 px-3.5 py-2.5" />
	{/if}

	{#if loading}
		<StateBlock class="px-11 py-7" message="Loading…" />
	{:else if error && servers.length === 0}
		<StateBlock kind="error" class="px-11 py-7" message={error} />
	{:else if servers.length === 0}
		<StateBlock class="border border-line-card bg-card px-11 py-11" message="No servers to configure yet" />
	{:else}
		<div class="flex flex-col gap-6">
			{#each servers as s (s.serverName)}
				<DocCard id={`a-alerts${DOC_ID_SEP}${s.serverName}`}>
					<div class="border-b border-line py-3.5 pr-11 pl-5">
						<h2 class="font-mono text-lg font-semibold text-ink">{s.serverName}</h2>
					</div>

					<div class="border-b border-line-soft px-5 py-4">
						<FormLabel for={`wh-${s.serverName}`}>Slack webhook URL</FormLabel>
						<div class="flex items-stretch gap-2.5">
							<div
								class="flex min-w-0 flex-1 items-center gap-2.5 border border-line-strong bg-paper px-3.5 focus-within:border-command"
							>
								<LinkIcon class="size-4 shrink-0 text-ink/55" />
								<input
									id={`wh-${s.serverName}`}
									type="text"
									spellcheck="false"
									placeholder="https://hooks.slack.com/services/T…/B…/…"
									bind:value={drafts[s.serverName]}
									class="h-[2.625rem] min-w-0 flex-1 border-none bg-transparent font-mono text-sm text-ink outline-none"
								/>
								{#if (drafts[s.serverName] ?? '') !== ''}
									<button
										type="button"
										aria-label="Remove webhook"
										title="Remove webhook"
										onclick={() => clearWebhook(s)}
										class="shrink-0 cursor-pointer text-ink/55 hover:text-danger"
									>
										<XIcon class="size-3.5" />
									</button>
								{/if}
							</div>
							<Button class="shrink-0 px-5" disabled={!isDirty(s)} onclick={() => saveWebhook(s)}>Save</Button>
						</div>
						{#if s.slackWebhookUrl.trim() === ''}
							<div class="mt-3 flex items-center gap-2 font-sans text-sm text-ink/70">
								<InfoIcon class="size-3.5 shrink-0" />
								<span>Add a webhook URL to configure alerts for this server.</span>
							</div>
						{/if}
					</div>

					{#if s.slackWebhookUrl.trim() !== ''}
						<AlertsTable serverName={s.serverName} alerts={s.alerts} onToggle={(alert) => toggleAlert(s, alert)} />
					{/if}
				</DocCard>
			{/each}
		</div>
	{/if}
</div>
