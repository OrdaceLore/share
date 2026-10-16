import { LoginOptions } from "./login-options";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const params = await searchParams;
  const target = params.return_to || "/";
  const returnTo = target.startsWith("/") && !target.startsWith("//") ? target : "/";
  return <LoginOptions returnTo={returnTo} />;
}
