import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "./lib/session";
import { checkRouteAccess, getDefaultRedirectPath } from "./lib/roles";

// Rate limiting storage (in production, use Redis or database)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Security headers function
function addSecurityHeaders(response: NextResponse): void {
  // Prevent XSS attacks
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Content Security Policy
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https://*.supabase.co; " +
      "frame-ancestors 'none';"
  );

  // HTTPS enforcement in production
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // Prevent MIME type confusion
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Remove server information
  response.headers.delete("Server");
  response.headers.delete("X-Powered-By");
}

// Rate limiting function
function checkRateLimit(ip: string, endpoint: string): boolean {
  const key = `${ip}:${endpoint}`;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = endpoint.startsWith("/api/") ? 100 : 1000; // Lower limit for API routes

  const current = rateLimitStore.get(key);

  if (!current || now > current.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (current.count >= maxRequests) {
    return false;
  }

  current.count++;
  return true;
}

// Get client IP address
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  const cfConnectingIP = request.headers.get("cf-connecting-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (realIP) {
    return realIP;
  }

  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback to a default IP since request.ip doesn't exist in NextRequest
  return "127.0.0.1";
}

// API routes that don't require authentication
const PUBLIC_API_ROUTES = ["/api/auth/", "/api/public/"];

// API routes that require specific roles
const ROLE_PROTECTED_API_ROUTES = {
  "/api/admin/": ["admin"],
  "/api/creator/": ["reviewer", "admin"],
  "/api/reviewer-ratings": ["user", "admin"], // Users can rate reviewers
  "/api/experiences": ["reviewer", "admin"], // Only reviewers can manage experiences
  "/api/reviewer-experiences": ["user", "reviewer", "admin"], // Anyone can view reviewer experiences
  "/api/resumes/create": ["user", "admin"], // Only users can create/upload resumes
  "/api/resumes/": ["user", "reviewer", "admin"], // Users and reviewers can access resumes
  "/api/reviewers": ["user", "reviewer", "admin"], // Anyone authenticated can view reviewers
  "/api/conversations": ["user", "reviewer", "admin"], // Authenticated users can access conversations
  "/api/messages": ["user", "reviewer", "admin"], // Authenticated users can access messages
};

async function handleApiRoutes(
  request: NextRequest,
  pathname: string
): Promise<NextResponse> {
  // Allow public API routes
  if (PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  try {
    // Get user session for protected API routes
    const session = await getServerSession();

    // Check if authentication is required
    if (!session || !session.isAuthenticated) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check role-based access for specific API routes
    for (const [routePrefix, allowedRoles] of Object.entries(
      ROLE_PROTECTED_API_ROUTES
    )) {
      if (pathname.startsWith(routePrefix)) {
        if (!allowedRoles.includes(session.role)) {
          return NextResponse.json(
            {
              error: `Access denied. Required role: ${allowedRoles.join(
                " or "
              )}`,
            },
            { status: 403 }
          );
        }
        break;
      }
    }

    // Add user info to headers for API routes
    const response = NextResponse.next();
    response.headers.set("x-user-role", session.role);
    response.headers.set("x-user-id", session.user.id);

    // Add security headers for API routes
    addSecurityHeaders(response);
    return response;
  } catch (error) {
    console.error("API middleware error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 401 }
    );
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log(`Middleware: Processing request for ${pathname}`);

  // Skip middleware for static files only
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/public/") ||
    (pathname.includes(".") && !pathname.startsWith("/api/"))
  ) {
    return NextResponse.next();
  }

  // Rate limiting check
  const clientIP = getClientIP(request);
  if (!checkRateLimit(clientIP, pathname)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  // Handle API routes separately
  if (pathname.startsWith("/api/")) {
    return await handleApiRoutes(request, pathname);
  }

  try {
    // Get user session
    const session = await getServerSession();

    // Public routes that don't require authentication
    const publicRoutes = [
      "/",
      "/login",
      "/auth-callback",
      "/reviewer-login",
      "/become-reviewer",
      "/become-reviewer-auth",
      "/leaderboard",
      "/auth/callback",
      "/debug", // Temporary debug page
    ];

    // Check if it's a public reviewer profile (e.g., /r/username)
    const isPublicReviewerProfile = pathname.match(/^\/r\/[^\/]+$/);

    if (publicRoutes.includes(pathname) || isPublicReviewerProfile) {
      return NextResponse.next();
    }

    // Allow authenticated users to access /reviewers route
    // (removed the redirect that was preventing access)

    // Require authentication for protected routes
    if (!session || !session.isAuthenticated) {
      // Prevent redirect loops - don't redirect if already on login page
      if (pathname === "/login") {
        return NextResponse.next();
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Check role-based access
    const accessCheck = checkRouteAccess(session.role, pathname);

    console.log(
      `Middleware: User role: ${session.role}, Path: ${pathname}, Allowed: ${accessCheck.allowed}`
    );

    if (!accessCheck.allowed) {
      // Redirect to appropriate dashboard based on user role
      const redirectPath = getDefaultRedirectPath(session.role);
      console.log(`Middleware: Access denied, redirecting to: ${redirectPath}`);
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }

    // Add user role to headers for use in components
    const response = NextResponse.next();
    response.headers.set("x-user-role", session.role);
    response.headers.set("x-user-id", session.user.id);

    // Add security headers for all pages
    addSecurityHeaders(response);
    return response;
  } catch (error) {
    console.error("Middleware error:", error);

    // On error, allow public routes to pass through
    const publicRoutes = [
      "/",
      "/login",
      "/become-reviewer",
      "/become-reviewer-auth",
      "/leaderboard",
    ];
    if (publicRoutes.includes(pathname)) {
      return NextResponse.next();
    }

    // For protected routes, redirect to login but prevent loops
    if (pathname !== "/login") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
