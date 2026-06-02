"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { UserRole, UserSession } from "@/lib/types";
import { checkRouteAccess, getDefaultRedirectPath } from "@/lib/roles";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: UserRole[];
  fallback?: ReactNode;
  redirectTo?: string;
}

export function RoleGuard({
  children,
  allowedRoles,
  fallback = null,
  redirectTo,
}: RoleGuardProps) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkSession() {
      try {
        const supabase = getBrowserSupabaseClient();
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          router.push("/login");
          return;
        }

        // Get user profile with role
        const { data: initialProfile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        let profile = initialProfile;

        if (profileError || !profile) {
          console.log(
            "Profile not found, creating default profile for user:",
            user.id
          );
          // Create a default profile for new users
          const { data: newProfile, error: createError } = await supabase
            .from("profiles")
            .insert({
              id: user.id,
              role: "user",
              onboarded: false,
            })
            .select("*")
            .single();

          if (createError) {
            console.error("Error creating profile:", createError);
            router.push("/login");
            return;
          }
          profile = newProfile;
        }

        // Determine user role
        const role = await determineUserRole(user.id, supabase);

        const userSession: UserSession = {
          user: {
            id: user.id,
            email: user.email || "",
            role,
            onboarded: profile.onboarded || false,
            avatar_url:
              user.user_metadata?.avatar_url || user.user_metadata?.picture,
            created_at: user.created_at,
            updated_at: profile.updated_at || user.created_at,
          },
          isAuthenticated: true,
          role,
          permissions: getPermissionsForRole(role),
        };

        setSession(userSession);

        // Check if user has permission to access this route
        if (!allowedRoles.includes(role)) {
          const redirectPath = redirectTo || getDefaultRedirectPath(role);
          router.push(redirectPath);
          return;
        }
      } catch (error) {
        console.error("Session check error:", error);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }

    checkSession();
  }, [router, allowedRoles, redirectTo]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!session || !session.isAuthenticated) {
    return <>{fallback}</>;
  }

  if (!allowedRoles.includes(session.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

async function determineUserRole(
  userId: string,
  supabase: any
): Promise<UserRole> {
  // Check if user is admin
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email && adminEmails.includes(user.email.toLowerCase())) {
    return "admin";
  }

  // Try to get user profile role first (if column exists)
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    console.log(`RoleGuard: Profile role for user ${userId}:`, profile?.role);

    // If profile exists and has a role, use it
    if (profile?.role && ["user", "reviewer", "admin"].includes(profile.role)) {
      console.log(`RoleGuard: Using profile role: ${profile.role}`);
      return profile.role as UserRole;
    }
  } catch (error) {
    console.log(
      `RoleGuard: Profile role column may not exist, using fallback:`,
      error
    );
  }

  // Fallback: Check if user has a reviewer profile (for backward compatibility)
  const { data: reviewerProfile } = await supabase
    .from("reviewers")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (reviewerProfile) {
    return "reviewer";
  }

  // Default to regular user
  return "user";
}

function getPermissionsForRole(role: UserRole): string[] {
  const permissions = {
    user: [
      "upload_resume",
      "view_reviewers",
      "follow_reviewer",
      "view_own_resumes",
      "edit_own_profile",
    ],
    reviewer: [
      "upload_resume",
      "view_reviewers",
      "follow_reviewer",
      "view_own_resumes",
      "edit_own_profile",
      "create_reviewer_profile",
      "edit_reviewer_profile",
      "view_own_reviews",
      "review_resumes",
      "manage_followers",
    ],
    admin: [
      "upload_resume",
      "view_reviewers",
      "follow_reviewer",
      "view_own_resumes",
      "edit_own_profile",
      "create_reviewer_profile",
      "edit_reviewer_profile",
      "view_own_reviews",
      "review_resumes",
      "manage_followers",
      "manage_all_users",
      "manage_all_reviewers",
      "manage_all_resumes",
      "view_analytics",
      "manage_system",
    ],
  };

  return permissions[role] || [];
}

// Hook for using session in components
export function useSession() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      try {
        const supabase = getBrowserSupabaseClient();
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          setSession(null);
          return;
        }

        // Get user profile with role
        const { data: initialProfile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        let profile = initialProfile;

        // If no profile exists, create a default one for new users
        if (profileError || !profile) {
          console.log(
            "Profile not found in useSession, creating default profile for user:",
            user.id
          );
          const { data: newProfile, error: createError } = await supabase
            .from("profiles")
            .insert({
              id: user.id,
              role: "user",
              onboarded: false,
            })
            .select("*")
            .single();

          if (createError) {
            console.error("Error creating profile:", createError);
            setSession(null);
            return;
          }
          profile = newProfile;
        }

        // Determine user role
        const role = await determineUserRole(user.id, supabase);

        const userSession: UserSession = {
          user: {
            id: user.id,
            email: user.email || "",
            role,
            onboarded: profile.onboarded || false,
            avatar_url:
              user.user_metadata?.avatar_url || user.user_metadata?.picture,
            created_at: user.created_at,
            updated_at: profile.updated_at || user.created_at,
          },
          isAuthenticated: true,
          role,
          permissions: getPermissionsForRole(role),
        };

        setSession(userSession);
      } catch (error) {
        console.error("Session load error:", error);
        setSession(null);
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, []);

  // Listen for session refresh events
  useEffect(() => {
    const handleSessionRefresh = async () => {
      // Smoothly refresh the session without page reload
      setLoading(true);
      try {
        const supabase = getBrowserSupabaseClient();
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          setSession(null);
          return;
        }

        // Get updated user profile
        let { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (!profile) {
          setSession(null);
          return;
        }

        // Determine user role
        const role = await determineUserRole(user.id, supabase);

        const userSession: UserSession = {
          user: {
            id: user.id,
            email: user.email || "",
            role,
            onboarded: profile.onboarded || false,
            avatar_url:
              user.user_metadata?.avatar_url || user.user_metadata?.picture,
            created_at: user.created_at,
            updated_at: profile.updated_at || user.created_at,
          },
          isAuthenticated: true,
          role,
          permissions: getPermissionsForRole(role),
        };

        setSession(userSession);
      } catch (error) {
        console.error("Session refresh error:", error);
      } finally {
        setLoading(false);
      }
    };

    window.addEventListener("session-refresh", handleSessionRefresh);
    return () =>
      window.removeEventListener("session-refresh", handleSessionRefresh);
  }, []);

  return { session, loading };
}
