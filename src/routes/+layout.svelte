<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { session } from '$lib/session.svelte';

	let { children } = $props();

	onMount(() => {
		session.load();
	});
</script>

{@render children()}
