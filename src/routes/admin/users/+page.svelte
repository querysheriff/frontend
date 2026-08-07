<script lang="ts">
	import { onMount } from 'svelte';
	import { PlusIcon, SquarePenIcon, Trash2Icon, CheckIcon } from '@lucide/svelte';
	import Alert from '$lib/components/Alert.svelte';
	import FormLabel from '$lib/components/FormLabel.svelte';
	import TextInput from '$lib/components/TextInput.svelte';
	import { timestampDate } from '@bufbuild/protobuf/wkt';
	import type { User } from '@buf/querysheriff_backend.bufbuild_es/querysheriff/v1/auth_pb';
	import { adminClient } from '$lib/connect';
	import StateBlock from '$lib/components/StateBlock.svelte';
	import { cleanErr, errMsg, fmtDateTime } from '$lib/format';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import PageBar from '$lib/components/PageBar.svelte';

	let users = $state<User[]>([]);
	let serverOptions = $state<string[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let modal = $state<'create' | 'edit' | null>(null);
	let editingId = $state<bigint | null>(null);
	let editingSuperAdmin = $state(false);
	let umName = $state('');
	let umEmail = $state('');
	let umPassword = $state('');
	let umServers = $state<string[]>([]);
	let userError = $state<string | null>(null);
	let saving = $state(false);

	const rowAction =
		'inline-flex cursor-pointer items-center gap-1.5 font-condensed text-xs leading-none font-bold tracking-[0.6px] uppercase';

	async function load() {
		loading = true;
		error = null;
		try {
			const [usersRes, tokensRes] = await Promise.all([adminClient.listUsers({}), adminClient.listCollectorTokens({})]);
			users = usersRes.users;
			serverOptions = [...new Set(tokensRes.tokens.map((t) => t.serverName))].sort((a, b) => a.localeCompare(b));
		} catch (e) {
			error = errMsg(e);
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function created(u: User): string {
		return u.createdAt ? fmtDateTime(timestampDate(u.createdAt)) : '—';
	}

	function openCreate() {
		editingId = null;
		editingSuperAdmin = false;
		umName = '';
		umEmail = '';
		umPassword = '';
		umServers = [];
		userError = null;
		modal = 'create';
	}

	function openEdit(u: User) {
		editingId = u.id;
		editingSuperAdmin = u.isSuperAdmin;
		umName = u.name;
		umEmail = u.email;
		umPassword = '';
		umServers = [...u.allowedServers];
		userError = null;
		modal = 'edit';
	}

	function close() {
		modal = null;
		umPassword = '';
	}

	function toggleServer(name: string) {
		umServers = umServers.includes(name) ? umServers.filter((s) => s !== name) : [...umServers, name];
	}

	async function save() {
		const name = umName.trim();
		const email = umEmail.trim();
		if (!name || !email) {
			userError = 'Name and email are required.';
			return;
		}
		if (modal === 'create' && !umPassword) {
			userError = 'Set a password.';
			return;
		}
		if (saving) return;
		saving = true;
		userError = null;
		try {
			if (modal === 'edit' && editingId !== null) {
				await adminClient.updateUser({ id: editingId, name, email, password: umPassword, allowedServers: umServers });
			} else {
				await adminClient.createUser({ name, email, password: umPassword, allowedServers: umServers });
			}
			close();
			await load();
		} catch (e) {
			userError = cleanErr(e);
		} finally {
			saving = false;
		}
	}

	async function remove(u: User) {
		if (!confirm(`Delete user "${u.name}" (${u.email})?`)) return;
		try {
			await adminClient.deleteUser({ id: u.id });
			await load();
		} catch (e) {
			error = errMsg(e);
		}
	}

	const th =
		'border-b border-line px-5 py-3 text-left font-condensed text-xs font-semibold tracking-[0.7px] whitespace-nowrap text-ink/70 uppercase';
	const allChip =
		'inline-block border border-accent-line bg-accent px-2 py-0.5 font-condensed text-2xs font-bold tracking-[0.5px] whitespace-nowrap text-command uppercase';
	const serverChip =
		'inline-block border border-steel/28 bg-steel/10 px-2 py-0.5 font-mono text-xs whitespace-nowrap text-steel';
</script>

<PageBar>
	{#snippet actions()}
		<Button onclick={openCreate}><PlusIcon class="size-3.5 stroke-[2.4]" /><span>New User</span></Button>
	{/snippet}
</PageBar>

<div class="mx-auto w-full max-w-[82.5rem] min-w-0 px-7 pt-7 pb-16">
	<div class="border border-line-card bg-card">
		<div class="overflow-x-auto">
			<table class="w-full min-w-[53.75rem] border-collapse font-sans">
				<thead>
					<tr class="bg-hover-soft">
						<th scope="col" class="{th} w-[11.875rem]">Name</th>
						<th scope="col" class="{th} w-[13.125rem]">Email</th>
						<th scope="col" class="{th} w-[9.375rem]">Created</th>
						<th scope="col" class={th}>Permissions</th>
						<th scope="col" class="{th} w-[9.375rem] text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each users as u (u.id.toString())}
						<tr class="hover:bg-hover-soft">
							<td
								class="border-b border-line-soft px-5 py-3.5 align-top font-mono text-md font-semibold whitespace-nowrap text-ink"
							>
								{u.name}
							</td>
							<td class="border-b border-line-soft px-5 py-3.5 align-top font-sans text-sm text-ink/78">{u.email}</td>
							<td
								class="border-b border-line-soft px-5 py-3.5 align-top font-mono text-sm whitespace-nowrap text-ink/70"
							>
								{created(u)}
							</td>
							<td class="border-b border-line-soft px-5 py-3.5 align-top">
								<div class="flex flex-wrap gap-1.5">
									{#if u.isSuperAdmin}
										<span class={allChip}>All servers</span>
									{:else if u.allowedServers.length === 0}
										<span class="font-mono text-sm text-ink/70">—</span>
									{:else}
										{#each u.allowedServers as s (s)}
											<span class={serverChip}>{s}</span>
										{/each}
									{/if}
								</div>
							</td>
							<td class="border-b border-line-soft px-5 py-3.5 text-right align-top">
								<div class="inline-flex items-center justify-end gap-4">
									<button type="button" onclick={() => openEdit(u)} class="{rowAction} text-command hover:text-danger">
										<SquarePenIcon class="size-3.5 shrink-0" />
										<span>Edit</span>
									</button>
									{#if !u.isSuperAdmin}
										<button type="button" onclick={() => remove(u)} class="{rowAction} text-ink/70 hover:text-danger">
											<Trash2Icon class="size-3.5 shrink-0" />
											<span>Delete</span>
										</button>
									{/if}
								</div>
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
		{:else if users.length === 0}
			<StateBlock class="px-11 py-11" message="No users yet" />
		{/if}
	</div>
</div>

{#if modal !== null}
	<Modal title={modal === 'edit' ? 'Edit User' : 'New User'} onclose={close} maxWidth="520px">
		<div class="p-5">
			<FormLabel for="um-name">Name</FormLabel>
			<TextInput id="um-name" type="text" bind:value={umName} placeholder="Jane Doe" spellcheck="false" class="mb-4" />

			<FormLabel for="um-email">Email</FormLabel>
			<TextInput
				id="um-email"
				type="email"
				bind:value={umEmail}
				placeholder="jdoe@company.com"
				spellcheck="false"
				class="mb-4"
			/>

			<FormLabel for="um-password">Password</FormLabel>
			<TextInput
				id="um-password"
				type="password"
				bind:value={umPassword}
				placeholder={modal === 'edit' ? 'Leave blank to keep current' : 'Set a password'}
				autocomplete="new-password"
				class="mb-5"
			/>

			{#if editingSuperAdmin}
				<div class="border border-line-card bg-hover-soft px-3.5 py-3 font-sans text-sm text-ink/70">
					The super admin can view every server.
				</div>
			{:else}
				<span class="mb-2 block font-condensed text-2xs font-semibold tracking-[1px] text-ink/70 uppercase">
					Allowed Servers
				</span>
				{#if serverOptions.length === 0}
					<div class="font-mono text-sm text-ink/70">No servers yet — create a collector token first</div>
				{:else}
					<div class="flex flex-wrap gap-2">
						{#each serverOptions as name (name)}
							{@const on = umServers.includes(name)}
							<button
								type="button"
								onclick={() => toggleServer(name)}
								class="inline-flex cursor-pointer items-center gap-2 border px-3 py-2 font-mono text-sm select-none {on
									? 'border-command bg-accent font-semibold text-command'
									: 'border-line-strong text-ink/70'}"
							>
								{#if on}<CheckIcon class="size-3.5" />{:else}<PlusIcon class="size-3.5" />{/if}{name}
							</button>
						{/each}
					</div>
				{/if}
			{/if}

			{#if userError}
				<Alert message={userError} class="mt-4 px-3 py-2.5" />
			{/if}
		</div>
		<div class="flex justify-end gap-2.5 border-t border-line px-5 py-3.5">
			<Button variant="secondary" onclick={close}>Cancel</Button>
			<Button onclick={save} disabled={saving}>
				{saving ? 'Saving…' : modal === 'edit' ? 'Save Changes' : 'Create User'}
			</Button>
		</div>
	</Modal>
{/if}
