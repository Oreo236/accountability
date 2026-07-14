// Direct Upstash REST access for GitHub Actions (uses its own secrets — never shipped to the browser).
export function makeRedis({ url, token }) {
  async function command(...args) {
    const res = await fetch(`${url}/${args.map((a) => encodeURIComponent(a)).join('/')}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`redis ${args[0]} failed: ${JSON.stringify(body)}`);
    return body.result;
  }

  return {
    get: (key) => command('GET', key),
    set: (key, value) => command('SET', key, value),
    setex: (key, seconds, value) => command('SET', key, value, 'EX', String(seconds)),
    smembers: (key) => command('SMEMBERS', key),
    sadd: (key, member) => command('SADD', key, member),
  };
}
