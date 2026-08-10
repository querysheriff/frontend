<script lang="ts">
	import { clsx } from 'clsx';
	import { onMount } from 'svelte';
	import { LogOutIcon, XIcon } from '@lucide/svelte';
	import { Dialog } from 'bits-ui';
	import { page } from '$app/state';
	import { afterNavigate, goto } from '$app/navigation';
	import { navItems, adminItems, isNavActive } from '$lib/nav';
	import { session } from '$lib/session.svelte';
	import { sidebar } from '$lib/sidebar.svelte';
	import QuerySheriffMark from '$lib/icons/QuerySheriffMark.svelte';

	const visibleNav = $derived(navItems.filter((i) => !i.superAdminOnly || session.isSuperAdmin));

	const navClass = (active: boolean): string =>
		clsx(
			'flex flex-col gap-0.5 border-l-[3px] py-2.5 pr-3 pl-3.5 transition-colors',
			active ? 'border-command bg-accent text-ink' : 'border-transparent text-ink/70 hover:bg-hover-soft'
		);

	afterNavigate(() => sidebar.closeDrawer());

	// The mobile drawer is a modal Dialog; if the viewport grows to desktop while
	// it is open, close it so bits-ui doesn't keep the (now-hidden) scroll lock.
	onMount(() => {
		const mq = window.matchMedia('(min-width: 768px)');
		const onChange = () => mq.matches && sidebar.closeDrawer();
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	async function handleLogout() {
		await session.logout();
		goto('/login');
	}
</script>

{#snippet body()}
	<!-- Height matches the ContextBar (min-h-[4.25rem]) so this border lines up with the section header's. -->
	<div class="flex h-[4.25rem] items-center gap-3 border-b border-line px-5">
		<QuerySheriffMark class="size-8 flex-none text-command" />
		<span class="font-condensed text-2xl font-bold tracking-[2.5px] text-ink">QuerySheriff</span>
		<button
			type="button"
			aria-label="Close navigation"
			onclick={() => sidebar.closeDrawer()}
			class="ml-auto flex size-8 flex-none cursor-pointer items-center justify-center text-ink/50 hover:text-command md:hidden"
		>
			<XIcon class="size-5" />
		</button>
	</div>

	<nav class="flex flex-col gap-0.5 px-2 py-2.5">
		{#each visibleNav as item (item.key)}
			<a href={item.href} title={item.label} class={navClass(isNavActive(item, page.url.pathname))}>
				<span class="font-condensed text-lg font-semibold tracking-[0.4px] uppercase">{item.label}</span>
			</a>
		{/each}
	</nav>

	{#if session.isSuperAdmin}
		<div class="mt-auto border-t border-line px-2 pt-2 pb-1">
			<div class="px-3.5 pt-2 pb-2 font-condensed text-2xs font-bold tracking-[1.4px] text-ink/70 uppercase">Admin</div>
			<div class="flex flex-col gap-0.5">
				{#each adminItems as item (item.key)}
					<a href={item.href} title={item.label} class={navClass(isNavActive(item, page.url.pathname))}>
						<span class="font-condensed text-lg font-semibold tracking-[0.4px] uppercase">{item.label}</span>
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<div class="{session.isSuperAdmin ? '' : 'mt-auto'} border-t border-line p-3.5">
		<div class="flex items-center gap-3 px-2.5 py-2 hover:bg-hover-soft">
			<span
				class="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-command font-condensed text-xl font-bold text-paper"
				>{session.displayName.charAt(0).toUpperCase()}</span
			>
			<span class="min-w-0 flex-1 truncate font-sans text-md font-semibold text-ink">{session.displayName}</span>
			<button
				type="button"
				title="Sign out"
				onclick={handleLogout}
				class="flex h-7 w-7 flex-none cursor-pointer items-center justify-center text-ink/50 hover:text-danger"
			>
				<LogOutIcon class="size-4" />
			</button>
		</div>
	</div>
{/snippet}

<!-- Desktop: persistent sticky sidebar -->
<aside
	class="hidden h-screen w-[15.625rem] flex-none flex-col border-r border-line bg-shell md:sticky md:top-0 {sidebar.collapsed
		? 'md:hidden'
		: 'md:flex'}"
>
	{@render body()}
</aside>

<!-- Mobile: off-canvas drawer (bits-ui Dialog — focus trap, escape, scrim, return-focus) -->
<Dialog.Root bind:open={sidebar.drawerOpen}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-40 bg-scrim md:hidden" />
		<Dialog.Content
			class="fixed inset-y-0 left-0 z-50 flex h-screen w-[15.625rem] flex-none flex-col border-r border-line bg-shell shadow-drawer md:hidden"
		>
			<Dialog.Title class="sr-only">Navigation</Dialog.Title>
			{@render body()}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
