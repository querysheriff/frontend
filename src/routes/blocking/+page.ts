import { redirect } from '@sveltejs/kit';

// Blocking now lives on the Locks screen; keep old links working.
export const load = () => {
	redirect(307, '/locks');
};
