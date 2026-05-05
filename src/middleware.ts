import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
      return NextResponse.next();
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return true;
        return !!token;
      },
    },
    pages: { signIn: "/login" },
  },
);

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - api/auth (NextAuth)
     * - api/trpc (tRPC handles its own auth)
     * - _next (static)
     * - favicon, public assets
     */
    "/((?!api/auth|api/trpc|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
