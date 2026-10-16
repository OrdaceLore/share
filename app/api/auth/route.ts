import { env } from "cloudflare:workers";
import { getChatGPTUser, getCookie, hashToken } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";
const SESSION_COOKIE = "le_session";
// Device identity stays on this browser until its local cookie is cleared.
const SESSION_SECONDS = 60 * 60 * 24 * 365 * 10;

async function ensureSchema() {
  const db = env.DB!;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS quick_accounts (id TEXT PRIMARY KEY NOT NULL, username TEXT NOT NULL COLLATE NOCASE UNIQUE, salt TEXT NOT NULL, password_hash TEXT NOT NULL, created INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS quick_sessions (token_hash TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, expires INTEGER NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS quick_sessions_expires ON quick_sessions(expires)"),
  ]);
}

function randomHex(bytes = 24) {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cookie(value: string, maxAge: number, secure: boolean) {
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax`;
}

function passwordHash(password: string, salt: string) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"])
    .then((key) => crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 120_000 }, key, 256))
    .then((bits) => Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, "0")).join(""));
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function startSession(userId: string) {
  const token = randomHex(32);
  await env.DB!.prepare("INSERT INTO quick_sessions(token_hash,user_id,expires) VALUES(?,?,?)")
    .bind(await hashToken(token), userId, Date.now() + SESSION_SECONDS * 1000).run();
  return token;
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ signedIn: false });
  return Response.json({ signedIn: true, username: user.displayName, quickAccount: user.quickAccount === true });
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
    const secure = new URL(request.url).protocol === "https:";
    if (!env.DB) return Response.json({ error: "账号服务暂不可用" }, { status: 503 });
    await ensureSchema();
    const body = await request.json() as { action?: string; username?: string; password?: string };

    if (body.action === "device-login" || body.action === "quick-create") {
      const existingToken = getCookie(request.headers.get("cookie"), SESSION_COOKIE);
      if (existingToken) {
        const existing = await env.DB.prepare("SELECT user_id FROM quick_sessions WHERE token_hash=? AND expires>? LIMIT 1")
          .bind(await hashToken(existingToken), Date.now()).first<{ user_id: string }>();
        if (existing) {
          await env.DB.prepare("UPDATE quick_sessions SET expires=? WHERE token_hash=?").bind(Date.now() + SESSION_SECONDS * 1000, await hashToken(existingToken)).run();
          return Response.json({ deviceLogin: true }, { headers: { "Set-Cookie": cookie(existingToken, SESSION_SECONDS, secure) } });
        }
      }
      const userId = crypto.randomUUID();
      const username = `本机-${randomHex(6)}`;
      const salt = randomHex(16);
      const password = randomHex(32);
      await env.DB.prepare("INSERT INTO quick_accounts(id,username,salt,password_hash,created) VALUES(?,?,?,?,?)")
        .bind(userId, username, salt, await passwordHash(password, salt), Date.now()).run();
      const token = await startSession(userId);
      return Response.json({ deviceLogin: true }, { headers: { "Set-Cookie": cookie(token, SESSION_SECONDS, secure) } });
    }

    if (body.action === "quick-login") {
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      if (!username || username.length > 32 || password.length > 128) return Response.json({ error: "请输入用户名和密码" }, { status: 400 });
      const account = await env.DB.prepare("SELECT id,salt,password_hash FROM quick_accounts WHERE username=? COLLATE NOCASE")
        .bind(username).first<{ id: string; salt: string; password_hash: string }>();
      if (!account || await passwordHash(password, account.salt) !== account.password_hash) {
        return Response.json({ error: "用户名或密码不正确" }, { status: 401 });
      }
      const token = await startSession(account.id);
      return Response.json({ username }, { headers: { "Set-Cookie": cookie(token, SESSION_SECONDS, secure) } });
    }

    if (body.action === "rename") {
      const user = await getChatGPTUser();
      if (!user?.quickAccount) return Response.json({ error: "只有快速账号可以在这里修改用户名" }, { status: 401 });
      const username = String(body.username || "").trim();
      if (!/^[\p{L}\p{N}_-]{2,24}$/u.test(username)) return Response.json({ error: "用户名需为 2–24 个字，只能包含文字、数字、下划线或短横线" }, { status: 400 });
      try {
        await env.DB.prepare("UPDATE quick_accounts SET username=? WHERE id=?").bind(username, user.userId.slice("quick:".length)).run();
      } catch {
        return Response.json({ error: "这个用户名已被使用，请换一个" }, { status: 409 });
      }
      return Response.json({ username });
    }

    if (body.action === "logout") {
      const headers = new Headers({ "Set-Cookie": cookie("", 0, secure) });
      const token = getCookie(request.headers.get("cookie"), SESSION_COOKIE);
      if (token) await env.DB.prepare("DELETE FROM quick_sessions WHERE token_hash=?").bind(await hashToken(token)).run();
      return Response.json({ signedOut: true }, { headers });
    }

    return Response.json({ error: "未知操作" }, { status: 400 });
  } catch (error) {
    console.error("Authentication operation failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "账号操作未完成，请稍后重试" }, { status: 503 });
  }
}
