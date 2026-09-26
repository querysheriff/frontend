<script lang="ts">
	import { XIcon } from '@lucide/svelte';
	import { Dialog } from 'bits-ui';
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		description?: string;
		onclose: () => void;
		children: Snippet;
		maxWidth?: string;
	};

	let { title, description, onclose, children, maxWidth = '480px' }: Props = $props();
</script>

<Dialog.Root
	open
	onOpenChange={(o) => {
		if (!o) onclose();
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-[60] bg-scrim" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-[61] max-h-[calc(100vh-48px)] w-[calc(100vw-48px)] -translate-x-1/2 -translate-y-1/2 overflow-auto border border-line-bold bg-card font-sans shadow-modal"
			style="max-width: {maxWidth};"
		>
			<div class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
				<Dialog.Title class="font-sans text-xl font-bold text-ink">{title}</Dialog.Title>
				<Dialog.Description class="sr-only">{description ?? title}</Dialog.Description>
				<Dialog.Close aria-label="Close" class="cursor-pointer leading-none text-ink/55 hover:text-danger">
					<XIcon class="size-4" />
				</Dialog.Close>
			</div>
			{@render children()}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
