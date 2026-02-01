"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useUser, useClerk, useAuth as useClerkAuth } from "@clerk/nextjs";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
}

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
  const { signOut: clerkSignOut, openSignIn } = useClerk();
  const { isSignedIn } = useClerkAuth();
  const router = useRouter();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Convert Clerk user to our user format
  const user: UserLike | null = clerkUser ? {
    id: clerkUser.id,
    email: clerkUser.emailAddresses[0]?.emailAddress,
  } : null;

  // Create session-like object
  const session = user ? { user } : null;

  // Fetch profile from API when Clerk user changes
  useEffect(() => {
    const fetchProfile = async () => {
      if (!clerkUser || !isSignedIn) {
        setProfile(null);
        return;
      }

      setIsLoadingProfile(true);
      
      try {
        // Fetch profile through API route (uses service role key)
        const res = await fetch("/api/profile");
        
        if (res.ok) {
          const data = await res.json();
          setProfile({
            id: clerkUser.id,
            email: data.email || clerkUser.emailAddresses[0]?.emailAddress || "",
            full_name: data.full_name || clerkUser.fullName || null,
            avatar_url: data.avatar_url || clerkUser.imageUrl || null,
            role: data.role || "member",
          });
        } else {
          // API failed, use Clerk data as fallback
          console.warn("Failed to fetch profile from API, using Clerk data");
          setProfile({
            id: clerkUser.id,
            email: clerkUser.emailAddresses[0]?.emailAddress || "",
            full_name: clerkUser.fullName || null,
            avatar_url: clerkUser.imageUrl || null,
            role: "member",
          });
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
        // Set minimal profile from Clerk on error
        if (clerkUser) {
          setProfile({
            id: clerkUser.id,
            email: clerkUser.emailAddresses[0]?.emailAddress || "",
            full_name: clerkUser.fullName || null,
            avatar_url: clerkUser.imageUrl || null,
            role: "member",
          });
        }
      } finally {
        setIsLoadingProfile(false);
      }
    };

    if (clerkLoaded) {
      fetchProfile();
    }
  }, [clerkUser, clerkLoaded, isSignedIn]);

  // Sign in with Google - Clerk handles this
  const signInWithGoogle = async () => {
    openSignIn({
      afterSignInUrl: "/library",
      afterSignUpUrl: "/library",
    });
  };

  // Sign in with email - redirect to Clerk sign-in
  const signInWithEmail = async (email: string, password: string) => {
    router.push("/sign-in");
    return { error: null };
  };

  // Sign up with email - redirect to Clerk sign-up
  const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    router.push("/sign-up");
    return { error: null };
  };

  // Sign out
  const signOut = async () => {
    await clerkSignOut();
    setProfile(null);
    router.push("/");
  };

  // Check if user is admin or owner
  const isAdmin = profile?.role === "admin" || profile?.role === "owner";

  const value: AuthContextType = {
    user,
    profile,
    session,
    isLoading: !clerkLoaded || isLoadingProfile,
    isAdmin,
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