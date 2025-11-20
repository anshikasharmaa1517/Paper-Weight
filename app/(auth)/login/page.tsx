"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const params =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;
  const nextPath = params?.get("next") || "/reviewers";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"enterEmail" | "password" | "magic">(
    "enterEmail"
  );
  const [isSignup, setIsSignup] = useState(false);
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = getBrowserSupabaseClient();
    
    // Store the next path in localStorage so we can retrieve it after magic link click
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_redirect_next", nextPath);
    }
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth-callback`
            : undefined,
      },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  // OAuth removed per requirements; keep email + password/magic link only

  async function continueWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "enterEmail") {
      setMode("password");
      return;
    }
    const supabase = getBrowserSupabaseClient();
    setLoading(true);
    if (isSignup) {
      // Store the next path in localStorage for post-signup redirect
      if (typeof window !== "undefined") {
        localStorage.setItem("auth_redirect_next", nextPath);
      }
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth-callback`,
        },
      });
      if (error) setError(error.message);
      else setSent(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        // Determine user role and redirect accordingly
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", (await supabase.auth.getUser()).data.user?.id)
            .single();

          const role = profile?.role || "user";
          let redirectPath = "/dashboard";

          if (role === "admin") {
            redirectPath = "/admin";
          } else if (role === "reviewer") {
            redirectPath = "/creator";
          }

          router.replace(redirectPath);
        } catch {
          router.replace("/dashboard");
        }
      }
    }
    setLoading(false);
  }

  function isValidEmail(value: string) {
    return /[^@\s]+@[^@\s]+\.[^@\s]+/.test(value);
  }

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 relative light-theme">
      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-end p-4 md:p-6">
        <a
          href="/become-reviewer-auth"
          className="rounded-full bg-black text-white px-5 md:px-6 py-2 md:py-2.5 text-xs md:text-sm font-medium shadow-sm hover:bg-zinc-900 active:bg-zinc-800 cursor-pointer"
        >
          Become reviewer
        </a>
      </div>
      <div className="hidden md:block relative bg-[#FAD7A1]">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-80 h-80 rounded-full bg-white/40 flex items-center justify-center">
            <img
              src="/logo.png"
              alt="PaperWeight Logo"
              className="w-75 h-75 object-contain mix-blend-multiply"
            />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-10">
            <h1 className="text-5xl font-serif leading-tight text-zinc-900">
              Better resume,
              <span className="whitespace-nowrap"> better&#8209;hiring.</span>
            </h1>
          </div>
          {sent ? (
            <p className="text-sm">
              Check your email for a magic link to sign in.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Step 1: Email */}
              {mode !== "password" && (
                <form onSubmit={continueWithPassword} className="space-y-4">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    required
                    className="w-full rounded-lg border border-pink-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={!isValidEmail(email)}
                      className="rounded-lg bg-black text-white px-5 py-3 cursor-pointer transition-colors hover:bg-zinc-900 active:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        sendMagicLink(e as any);
                      }}
                      disabled={!isValidEmail(email)}
                      className="rounded-lg border border-zinc-300 text-zinc-700 px-5 py-3 cursor-pointer transition-colors hover:bg-zinc-50 active:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Send magic link
                    </button>
                  </div>
                </form>
              )}

              {/* Step 2: Password Sign in / Sign up */}
              {mode === "password" && (
                <form onSubmit={continueWithPassword} className="space-y-4">
                  <div className="text-sm text-zinc-600">
                    {email}{" "}
                    <button
                      type="button"
                      className="ml-2 underline"
                      onClick={() => {
                        setMode("enterEmail");
                        setPassword("");
                      }}
                    >
                      Change
                    </button>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                    className="w-full rounded-lg border border-pink-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <div className="flex items-center justify-between text-sm">
                    <label className="inline-flex items-center gap-2 select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-zinc-300"
                      />
                      Keep me signed in
                    </label>
                    <button
                      type="button"
                      className="underline cursor-pointer"
                      onClick={async () => {
                        const supabase = getBrowserSupabaseClient();
                        setError(null);
                        const { error } =
                          await supabase.auth.resetPasswordForEmail(email, {
                            redirectTo: `${window.location.origin}/auth/callback`,
                          });
                        if (error) setError(error.message);
                        else setSent(true);
                      }}
                    >
                      Forgot your password?
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className="rounded-lg bg-black text-white px-5 py-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? "Working…" : "Sign in"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("enterEmail")}
                      className="rounded-lg border border-zinc-300 text-zinc-700 px-5 py-3 cursor-pointer hover:bg-zinc-50"
                    >
                      Back
                    </button>
                  </div>
                  {/* magic link and create account controls intentionally removed */}
                </form>
              )}

              {/* OAuth removed */}
            </div>
          )}
          <p className="text-xs text-zinc-600 mt-8">
            Looking for your account?{" "}
            <a href="#" className="underline">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
