<script module lang="ts">
	export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
	export type ButtonSize = 'sm' | 'md';
</script>

<script lang="ts">
	import { clsx } from 'clsx';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	let {
		variant = 'primary',
		size = 'md',
		type = 'button',
		class: klass,
		children,
		...rest
	}: {
		variant?: ButtonVariant;
		size?: ButtonSize;
		class?: string;
		children: Snippet;
	} & HTMLButtonAttributes = $props();

	const base =
		'inline-flex cursor-pointer items-center justify-center gap-1.5 font-sans whitespace-nowrap transition-colors disabled:cursor-default disabled:opacity-60';

	const variants: Record<ButtonVariant, string> = {
		primary: 'bg-command font-bold text-paper hover:bg-danger',
		secondary: 'border border-line-strong font-bold text-ink/70 hover:bg-hover',
		ghost: 'border border-line-card font-semibold text-ink/70 hover:bg-hover hover:text-command'
	};

	const sizes: Record<ButtonSize, string> = {
		sm: 'px-3 py-1.5 text-xs',
		md: 'px-4 py-2.5 text-sm'
	};
</script>

<button {type} class={clsx(base, variants[variant], sizes[size], klass)} {...rest}>
	{@render children()}
</button>
