<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Sidebar from './Sidebar.svelte';

	const { Story } = defineMeta({
		title: 'Chrome/Sidebar',
		component: Sidebar,
		parameters: { layout: 'fullscreen' }
	});
</script>

<script lang="ts">
	import { session } from '$lib/session.svelte';
	import type { User } from '$lib/gen/querysheriff/v1/auth_pb';

	// Seed the session singleton so the sidebar renders the signed-in nav + footer.
	session.user = { name: 'admin', isSuperAdmin: true } as unknown as User;
	session.loaded = true;
</script>

<Story name="Super admin">
	{#snippet template()}
		<Sidebar />
	{/snippet}
</Story>
