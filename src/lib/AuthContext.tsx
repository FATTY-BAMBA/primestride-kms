"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { User, Session, SupabaseClient } from "@supabase/supabase-js";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [supabase] = useState<SupabaseClient>(() => createClient());
  const router = useRouter();

  const fetchProfile = async (userId: string) => {
    try {
      console.log("👤 Fetching profile for:", userId);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("❌ Profile fetch error:", error);
        return;
      }
      
      console.log("✅ Profile loaded:", data);
      setProfile(data as Profile);
    } catch (err) {
      console.error("❌ Profile fetch exception:", err);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("🔄 Auth state changed:", event, session ? "has session" : "no session");
        
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false); // Set loading false IMMEDIATELY

        if (session?.user) {
          // Fetch profile in background (don't await)
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }

        if (event === "SIGNED_OUT") {
          router.push("/login");
        }
      }
    );

    // Check for existing session
    const initAuth = async () => {
      try {
        console.log("🔍 Checking session...");
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.error("❌ Session error:", error);
          setIsLoading(false);
          return;
        }
        
        console.log("📋 Session found:", session ? "Yes" : "No");
        
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false); // Set loading false IMMEDIATELY

        if (session?.user) {
          // Fetch profile in background (don't await)
          fetchProfile(session.user.id);
        }
      } catch (error) {
        console.error("❌ Auth init error:", error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  const signInWithGoogle = async () => {
    const redirectTo = typeof window !== "undefined" 
      ? `${window.location.origin}/auth/callback`
      : "/auth/callback";

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    router.push("/");
    return { error: null };
  };

  const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    router.push("/login");
  };

  const value: AuthContextType = {
    user,
    profile,
    session,
    isLoading,
    isAdmin: profile?.role === "admin",
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}