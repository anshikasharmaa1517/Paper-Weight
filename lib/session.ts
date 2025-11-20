import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { UserProfile, UserRole, UserSession } from "./types";
import { getDefaultRedirectPath, isValidRole } from "./roles";

export async function getServerSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  // Determine user role first (this will create profile if needed)
  const role = await determineUserRole(user.id, supabase);

  // Get user profile with role (should exist now)
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    console.error(
      "Profile still not found after role determination for user:",
      user.id
    );
    return null;
  }

  const userProfile: UserProfile = {
    id: user.id,
    email: user.email || "",
    role,
    onboarded: profile.onboarded || false,
    avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
    created_at: user.created_at,
    updated_at: profile.updated_at || user.created_at,
  };

  return {
    user: userProfile,
    isAuthenticated: true,
    role,
    permissions: getPermissionsForRole(role),
  };
}

async function determineUserRole(
  userId: string,
  supabase: any
): Promise<UserRole> {
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email && adminEmails.includes(user.email.toLowerCase())) {
    return "admin";
  }

  // Simple role determination
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role) {
    return profile.role as UserRole;
  }

  // If profile doesn't exist, create one with default role "user"
  if (!profile) {
    try {
      await supabase
        .from("profiles")
        .insert({
          id: userId,
          role: "user",
          onboarded: false,
        });
    } catch (error) {
      console.error("Error creating profile:", error);
    }
  }

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

export function requireAuth(session: UserSession | null): UserSession {
  if (!session || !session.isAuthenticated) {
    throw new Error("Authentication required");
  }
  return session;
}

export function requireRole(
  session: UserSession | null,
  requiredRole: UserRole
): UserSession {
  const authSession = requireAuth(session);

  if (authSession.role !== requiredRole && authSession.role !== "admin") {
    throw new Error(`Role '${requiredRole}' required`);
  }

  return authSession;
}

export function requirePermission(
  session: UserSession | null,
  permission: string
): UserSession {
  const authSession = requireAuth(session);

  if (!authSession.permissions.includes(permission)) {
    throw new Error(`Permission '${permission}' required`);
  }

  return authSession;
}

export function getRedirectPath(
  session: UserSession | null,
  requestedPath: string
): string {
  if (!session || !session.isAuthenticated) {
    return "/login";
  }

  // If user is trying to access a path they don't have permission for
  const defaultPath = getDefaultRedirectPath(session.role);

  // Check if the requested path is appropriate for their role
  if (session.role === "user" && requestedPath.startsWith("/creator")) {
    return defaultPath;
  }

  if (session.role === "reviewer" && requestedPath.startsWith("/admin")) {
    return defaultPath;
  }

  if (session.role === "user" && requestedPath.startsWith("/admin")) {
    return defaultPath;
  }

  return requestedPath;
}

// Client-side session management
export function getClientSession(): UserSession | null {
  if (typeof window === "undefined") return null;

  try {
    const sessionData = localStorage.getItem("user_session");
    if (!sessionData) return null;

    const session = JSON.parse(sessionData);

    // Check if session is expired (24 hours)
    const now = Date.now();
    const sessionTime = new Date(session.created_at).getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (now - sessionTime > twentyFourHours) {
      localStorage.removeItem("user_session");
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function setClientSession(session: UserSession): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(
    "user_session",
    JSON.stringify({
      ...session,
      created_at: new Date().toISOString(),
    })
  );
}

export function clearClientSession(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem("user_session");
}
