import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

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
  '/terms(.*)',
  '/privacy(.*)',
]);

const isClockRoute = createRouteMatcher([
  '/clock(.*)',
  '/api/clock/(.*)',
]);

const isOnboardingRoute = createRouteMatcher([
  '/onboarding(.*)',
  '/api/onboarding(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { userId, orgId } = await auth.protect();

  // Clock routes: authenticated but don't force onboarding redirect
  if (isClockRoute(req)) return;

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