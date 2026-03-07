import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Public routes - no auth required
const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/signup(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/invite/(.*)',
  '/api/invitations/(.*)',
  '/contact(.*)',
  '/api/contact(.*)',
  '/api/v1/(.*)',
  '/audit(.*)',
  '/api/audit(.*)',
  '/api/documents/parse(.*)',
]);

// Routes that authenticated users can access WITHOUT an org
const isOnboardingRoute = createRouteMatcher([
  '/onboarding(.*)',
  '/api/onboarding(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // Public routes — anyone can access
  if (isPublicRoute(req)) {
    return;
  }

  // All other routes require authentication
  const { userId, orgId } = await auth.protect();

  // If user is authenticated but has no active organization
  // and is NOT on the onboarding page, redirect them there
  if (userId && !orgId && !isOnboardingRoute(req)) {
    const onboardingUrl = new URL('/onboarding', req.url);
    return NextResponse.redirect(onboardingUrl);
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};