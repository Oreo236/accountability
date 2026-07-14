// Fill this in after you deploy the Cloudflare Worker (see SETUP.md step 4).
// Example: 'https://deadline-api.yourname.workers.dev'
export const WORKER_URL = 'https://deadline-api.oreo236.workers.dev';

export const VAPID_PUBLIC_KEY = 'BDc-AaXUUnZYlXkV-y06y0hbj5nJ4x5DwAEI4rmmnBP4h2jG6lms6GBPlesZEFkU0ddqfGyDgkLdlQstwMZhtGo';

// The Worker's API_SECRET is intentionally NOT hardcoded here — this file is
// committed to a public repo. It's asked for once and kept in localStorage
// instead (see getApiKey() in api.js).
