<script lang="ts">
	import { MailIcon, LockIcon, ArrowRightIcon } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { session } from '$lib/session.svelte';
	import { errMsg } from '$lib/format';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import FormLabel from '$lib/components/FormLabel.svelte';
	import QuerySheriffMark from '$lib/icons/QuerySheriffMark.svelte';

	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let submitting = $state(false);

	$effect(() => {
		if (session.loaded && session.isAuthenticated) goto('/queries', { replaceState: true });
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (submitting) return;
		error = null;
		submitting = true;
		try {
			await session.login(email.trim(), password);
		} catch (err) {
			error = errMsg(err);
		} finally {
			submitting = false;
		}
	}

	const fieldClass =
		'flex h-[2.625rem] items-center gap-2.5 border border-line-strong bg-paper px-3.5 focus-within:border-command';
	const inputClass = 'min-w-0 flex-1 border-none bg-transparent font-mono text-md text-ink outline-none';
</script>

<div class="flex min-h-screen items-center justify-center bg-paper p-8 font-sans">
	<div class="w-full max-w-[25.25rem]">
		<div class="mb-8 flex items-center justify-center gap-3">
			<QuerySheriffMark class="size-10 flex-none text-ink" />
			<h1 class="font-sans text-[27px] font-bold text-ink">QuerySheriff</h1>
		</div>

		<form onsubmit={submit} class="border border-line-card bg-card px-8 pt-8 pb-7">
			<FormLabel for="login-email">Email</FormLabel>
			<div class="{fieldClass} mb-4">
				<MailIcon class="size-4 flex-none text-ink/55" />
				<input
					id="login-email"
					type="email"
					bind:value={email}
					placeholder="you@company.com"
					autocomplete="username"
					spellcheck="false"
					class={inputClass}
				/>
			</div>

			<FormLabel for="login-password">Password</FormLabel>
			<div class="{fieldClass} mb-5">
				<LockIcon class="size-4 flex-none text-ink/55" />
				<input
					id="login-password"
					type="password"
					bind:value={password}
					placeholder="••••••••"
					autocomplete="current-password"
					class={inputClass}
				/>
			</div>

			{#if error}
				<ErrorBanner message={error} class="mb-4 px-3 py-2.5 font-sans" />
			{/if}

			<button
				type="submit"
				disabled={submitting}
				class="flex h-[2.75rem] w-full cursor-pointer items-center justify-center gap-2.5 bg-command font-sans text-lg font-bold text-paper hover:bg-danger disabled:cursor-default disabled:opacity-70"
			>
				<span>{submitting ? 'Signing in…' : 'Sign in'}</span>
				<ArrowRightIcon class="size-4 stroke-[2.2]" />
			</button>
		</form>
	</div>
</div>
