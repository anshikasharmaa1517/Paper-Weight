"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = getBrowserSupabaseClient();
        
        // Get the session after auth callback
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          console.error("Auth callback error:", error);
          router.replace("/login");
          return;
        }

        // Get the redirect path from localStorage
        const redirectPath = localStorage.getItem("auth_redirect_next") || "/dashboard";
        localStorage.removeItem("auth_redirect_next");

        // Get user profile to determine role-based redirect
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        const role = profile?.role || "user";
        let finalRedirectPath = redirectPath;

        // If redirectPath is /dashboard or /reviewers, determine based on role
        if (redirectPath === "/dashboard" || redirectPath === "/reviewers") {
          if (role === "admin") {
            finalRedirectPath = "/admin";
          } else if (role === "reviewer") {
            finalRedirectPath = "/creator";
          } else {
            finalRedirectPath = "/dashboard";
          }
        }

        router.replace(finalRedirectPath);
      } catch (error) {
        console.error("Callback error:", error);
        router.replace("/login");
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Signing you in...</p>
    </div>
  );
}
