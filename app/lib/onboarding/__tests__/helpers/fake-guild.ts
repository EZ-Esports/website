/**
 * A fake Discord guild behind the REAL `DiscordRestAdapter` (it is the `fetch` implementation), so
 * tests exercise the actual preflight, planning, ordering and error mapping. Models what matters
 * for role assignment: role positions, the bot's permissions, and Discord's hierarchy rule (a bot
 * cannot assign a role at or above its own highest role). No network, no tokens.
 */

export const GUILD = '800000000000000001';
export const BOT = '800000000000000002';

export interface FakeRole {
  id: string;
  position: number;
  /** Permission bitfield as Discord sends it: a decimal string. */
  permissions: string;
  managed?: boolean;
}

export const MANAGE_ROLES = String(0x10000000);
export const ADMINISTRATOR = String(0x8);

export interface FakeGuildOptions {
  roles: FakeRole[];
  botRoleIds: string[];
  /** user id -> role ids, or null when the user is not in the guild. */
  members: Record<string, string[] | null>;
  /** Called with the 1-based index of each role write; return an HTTP status to fail that write. */
  failWrite?: (index: number, method: string, roleId: string) => number | null;
}

export interface WriteRecord {
  index: number;
  method: 'PUT' | 'DELETE';
  userId: string;
  roleId: string;
  status: number;
}

export function createFakeGuild(opts: FakeGuildOptions) {
  const members = new Map(Object.entries(opts.members).map(([k, v]) => [k, v ? [...v] : null]));
  const writes: WriteRecord[] = [];
  const reads: string[] = [];
  let writeIndex = 0;
  const roleById = new Map(opts.roles.map((r) => [r.id, r]));

  const json = (status: number, body: unknown) =>
    new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  const botHighest = () =>
    Math.max(0, ...opts.botRoleIds.map((id) => roleById.get(id)?.position ?? 0));

  const state = { throwNetwork: false, status: {} as Record<string, number> };

  const fetchImpl = (async (url: string, init: RequestInit) => {
    if (state.throwNetwork) throw new TypeError('network down');
    const path = new URL(url).pathname.replace('/api/v10', '');
    const method = String(init.method ?? 'GET');
    const forced = state.status[`${method} ${path.replace(/\/members\/\d+/, '/members/:id').replace(/\/roles\/\d+/, '/roles/:id')}`];
    if (forced) return json(forced, { code: 0 });

    if (method === 'GET') {
      reads.push(path);
      if (path === '/users/@me') return json(200, { id: BOT });
      if (path === `/guilds/${GUILD}/roles`) return json(200, opts.roles);
      const m = path.match(new RegExp(`^/guilds/${GUILD}/members/(\\d+)$`));
      if (m) {
        if (m[1] === BOT) return json(200, { roles: opts.botRoleIds });
        const roles = members.get(m[1]);
        return roles ? json(200, { roles }) : json(404, { code: 10007 });
      }
      return json(404, { code: 0 });
    }

    const w = path.match(new RegExp(`^/guilds/${GUILD}/members/(\\d+)/roles/(\\d+)$`));
    if (!w || (method !== 'PUT' && method !== 'DELETE')) return json(405, null);
    const [, userId, roleId] = w;
    const index = ++writeIndex;
    const record = (status: number) => {
      writes.push({ index, method: method as 'PUT' | 'DELETE', userId, roleId, status });
    };

    const injected = opts.failWrite?.(index, method, roleId) ?? null;
    if (injected) {
      record(injected);
      return json(injected, { code: injected === 403 ? 50013 : 0 });
    }
    const role = roleById.get(roleId);
    if (!role) {
      record(404);
      return json(404, { code: 10011 });
    }
    // Discord's rule: the bot can only manage roles strictly below its highest role.
    if (role.position >= botHighest()) {
      record(403);
      return json(403, { code: 50013 });
    }
    const held = members.get(userId);
    if (!held) {
      record(404);
      return json(404, { code: 10007 });
    }
    members.set(userId, method === 'PUT' ? [...new Set([...held, roleId])] : held.filter((r) => r !== roleId));
    record(204);
    return json(204, null);
  }) as unknown as typeof fetch;

  return {
    fetchImpl,
    writes,
    reads,
    state,
    rolesOf: (userId: string) => members.get(userId) ?? null,
    successfulWrites: () => writes.filter((w) => w.status === 204),
  };
}
