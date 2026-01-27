import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch (error) {
              // Handle cookie errors in Server Component
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // If 'next' parameter is provided (password reset), redirect there
      if (next) {
        return NextResponse.redirect(new URL(next, requestUrl.origin));
      }
      
      // Otherwise, redirect to library (normal login)
      return NextResponse.redirect(new URL("/library", requestUrl.origin));
    }
  }

  // If something went wrong, redirect to login
  return NextResponse.redirect(new URL("/login", requestUrl.origin));
}