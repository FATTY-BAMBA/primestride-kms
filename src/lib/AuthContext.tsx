"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useUser, useClerk, useAuth as useClerkAuth } from "@clerk/nextjs";
import { createClient } from "@/lib/supabase";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
}

// Create a user-like object from Clerk user
interface UserLike {
  id: string;
  email?: string;
}

interface AuthContextType {
  user: UserLike | null;
  profile: Profile | null;
  session: { user: UserLike } | null;
  isLoading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { signOut: clerkSignOut, openSignIn, openSignUp } = useClerk();
  const { isSignedIn } = useClerkAuth();
  const router = useRouter();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [supabase] = useState(() => createClient());

  // Convert Clerk user to our user format
  const user: UserLike | null = clerkUser ? {
    id: clerkUser.id,
    email: clerkUser.emailAddresses[0]?.emailAddress,
  } : null;

  // Create session-like object
  const session = user ? { user } : null;

  // Fetch or create profile in Supabase when Clerk user changes
  useEffect(() => {
    const syncProfile = async () => {
      if (!clerkUser) {
        setProfile(null);
        return;
      }

      setIsLoadingProfile(true);
      
      try {
        const email = clerkUser.emailAddresses[0]?.emailAddress;
        const fullName = clerkUser.fullName || clerkUser.firstName || email?.split('@')[0];
        
        // Try to fetch existing profile
        const { data: existingProfile, error: fetchError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", clerkUser.id)
          .single();

        if (existingProfile) {
          setProfile(existingProfile as Profile);
        } else {
          // Create new profile if doesn't exist
          const { data: newProfile, error: createError } = await supabase
            .from("profiles")
            .upsert({
              id: clerkUser.id,
              email: email,
              full_name: fullName,
              avatar_url: clerkUser.imageUrl,
              role: "user",
            }, {
              onConflict: "id"
            })
            .select()
            .single();

          if (newProfile) {
            setProfile(newProfile as Profile);
          } else if (createError) {
            console.error("Error creating profile:", createError);
            // Set a minimal profile even if DB fails
            setProfile({
              id: clerkUser.id,
              email: email || "",
              full_name: fullName || null,
              avatar_url: clerkUser.imageUrl || null,
              role: "user",
            });
          }
        }
      } catch (err) {
        console.error("Profile sync error:", err);
        // Set minimal profile on error
        if (clerkUser) {
          setProfile({
            id: clerkUser.id,
            email: clerkUser.emailAddresses[0]?.emailAddress || "",
            full_name: clerkUser.fullName || null,
            avatar_url: clerkUser.imageUrl || null,
            role: "user",
          });
        }
      } finally {
        setIsLoadingProfile(false);
      }
    };

    if (clerkLoaded) {
      syncProfile();
    }
  }, [clerkUser, clerkLoaded, supabase]);

  // Sign in with Google - Clerk handles this
  const signInWithGoogle = async () => {
    openSignIn({
      afterSignInUrl: "/library",
      afterSignUpUrl: "/library",
    });
  };

  // Sign in with email - redirect to Clerk sign-in
  const signInWithEmail = async (email: string, password: string) => {
    // Clerk handles email/password through its own UI
    // This is here for compatibility - redirect to sign-in page
    router.push("/sign-in");
    return { error: null };
  };

  // Sign up with email - redirect to Clerk sign-up
  const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    // Clerk handles email/password through its own UI
    router.push("/sign-up");
    return { error: null };
  };

  // Sign out
  const signOut = async () => {
    await clerkSignOut();
    setProfile(null);
    router.push("/sign-in");
  };

  const value: AuthContextType = {
    user,
    profile,
    session,
    isLoading: !clerkLoaded || isLoadingProfile,
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