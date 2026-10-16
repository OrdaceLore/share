"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, AudioLines, LoaderCircle, Music2 } from "lucide-react";

export function LoginOptions({ returnTo }: { returnTo: string }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function loginOnThisDevice() {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "device-login" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "本机登录暂不可用");
      window.location.assign(returnTo);
    } catch (error) { setNotice(error instanceof Error ? error.message : "本机登录暂不可用"); setBusy(false); }
  }

  return <main className="login-page">
    <a className="login-back" href="/"><ArrowLeft size={16}/> 返回乐换</a>
    <section className="login-card">
      <a className="brand login-brand" href="/"><span className="brand-icon"><AudioLines size={25}/></span>乐换<span className="brand-dot">.</span></a>
      <div className="eyebrow"><span/> GOOD MUSIC, GOOD COMPANY</div>
      <h1>加入音乐交换。</h1>
      <p className="login-intro">选择一种方式，保存你的音乐和交换记录。</p>
      <div className="login-options">
        <section className="login-option quick-option">
          <div className="login-option-icon"><Music2 size={19}/></div><div className="eyebrow muted">仅在此浏览器</div>
          <h2>本机设备登录</h2><p>无需填写资料或密码。此浏览器会自动保存你的登录状态和音乐记录。</p>
          <button className="button orange full" disabled={busy} onClick={loginOnThisDevice}>{busy?<LoaderCircle className="spin" size={17}/>:<ArrowRight size={17}/>}本机登录</button>
        </section>
        <section className="login-option">
          <div className="login-option-icon"><AudioLines size={19}/></div><div className="eyebrow muted">使用现有账号</div>
          <h2>账号登录</h2><p>使用当前的 ChatGPT 账号注册或登录，账号资料由 ChatGPT 安全管理。</p>
          <a className="button dark full" href={`/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`} target="_top">继续使用 ChatGPT <ArrowRight size={17}/></a>
        </section>
      </div>
      {notice&&<p className="login-error" role="alert">{notice}</p>}
      <p className="login-note">本机登录身份只在当前浏览器有效；清除浏览器数据或更换设备后，无法找回本机身份下的记录。</p>
    </section>
  </main>;
}
