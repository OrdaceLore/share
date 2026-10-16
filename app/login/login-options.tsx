"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, AudioLines, Check, Copy, LoaderCircle, Music2 } from "lucide-react";

export function LoginOptions({ returnTo }: { returnTo: string }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function createQuickAccount() {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "quick-create" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "暂时无法创建账号");
      setCredentials({ username: result.username, password: result.password });
    } catch (error) { setNotice(error instanceof Error ? error.message : "暂时无法创建账号"); }
    finally { setBusy(false); }
  }

  async function quickLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "quick-login", username: form.get("username"), password: form.get("password") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "登录失败");
      window.location.assign(returnTo);
    } catch (error) { setNotice(error instanceof Error ? error.message : "登录失败"); setBusy(false); }
  }

  async function copyCredentials() {
    if (!credentials) return;
    await navigator.clipboard.writeText(`乐换用户名：${credentials.username}\n密码：${credentials.password}`);
    setCopied(true);
  }

  return <main className="login-page">
    <a className="login-back" href="/"><ArrowLeft size={16}/> 返回乐换</a>
    <section className="login-card">
      <a className="brand login-brand" href="/"><span className="brand-icon"><AudioLines size={25}/></span>乐换<span className="brand-dot">.</span></a>
      <div className="eyebrow"><span/> GOOD MUSIC, GOOD COMPANY</div>
      <h1>加入音乐交换。</h1>
      <p className="login-intro">选择一种方式，保存你的音乐和交换记录。</p>
      {credentials ? <div className="credential-receipt" role="status">
        <span className="credential-check"><Check size={19}/></span><h2>快速账号已准备好</h2>
        <p>用户名可以在登录后修改。请先保存这组登录信息。</p>
        <div><small>用户名</small><strong>{credentials.username}</strong></div>
        <div><small>初始密码</small><strong>{credentials.password}</strong></div>
        <button className="button dark full" onClick={copyCredentials}>{copied ? <Check size={17}/> : <Copy size={17}/>} {copied ? "已复制登录信息" : "复制登录信息"}</button>
        <a className="button orange full" href={returnTo}>进入乐换 <ArrowRight size={17}/></a>
      </div> : <div className="login-options">
        <section className="login-option quick-option">
          <div className="login-option-icon"><Music2 size={19}/></div><div className="eyebrow muted">不需要邮箱</div>
          <h2>快速登录</h2><p>立即生成一个随机用户名和初始密码 123456，登录后可修改用户名。</p>
          <button className="button orange full" disabled={busy} onClick={createQuickAccount}>{busy?<LoaderCircle className="spin" size={17}/>:<ArrowRight size={17}/>}创建快速账号</button>
        </section>
        <section className="login-option">
          <div className="login-option-icon"><AudioLines size={19}/></div><div className="eyebrow muted">使用现有账号</div>
          <h2>账号登录</h2><p>使用当前的 ChatGPT 账号注册或登录，账号资料由 ChatGPT 安全管理。</p>
          <a className="button dark full" href={`/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`} target="_top">继续使用 ChatGPT <ArrowRight size={17}/></a>
        </section>
        <form className="quick-return" onSubmit={quickLogin}>
          <h3>已有快速账号？</h3><div className="quick-return-fields"><input name="username" autoComplete="username" required placeholder="用户名"/><input name="password" type="password" autoComplete="current-password" required placeholder="密码"/><button className="button dark" disabled={busy}>{busy?<LoaderCircle className="spin" size={16}/>:"登录"}</button></div>
        </form>
      </div>}
      {notice&&<p className="login-error" role="alert">{notice}</p>}
      <p className="login-note">快速账号使用随机用户名区分。请妥善保存用户名和密码。</p>
    </section>
  </main>;
}
