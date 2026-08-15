import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_path: string | null;
  avatar_url: string | null;
  xp: number;
  league_id: string | null;
  hidden_from_rankings: boolean;
  episodes_completed: number;
  correct_answers: number;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const loadProfile = useCallback(async (nextUser: User) => {
    const { data } = await supabase
      .from("profiles")
      .select(
        "id, username, display_name, bio, avatar_path, avatar_url, xp, league_id, hidden_from_rankings, episodes_completed, correct_answers",
      )
      .eq("id", nextUser.id)
      .maybeSingle();
    if (data) {
      setProfile(data as Profile);
      return;
    }

    const { data: ensured } = await supabase.rpc("ensure_profile");
    setProfile((ensured as Profile | null) ?? null);
  }, []);

  useEffect(() => {
    let active = true;

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (event === "SIGNED_OUT") {
        setProfile(null);
        queryClient.clear();
      }
      if (nextSession?.user && (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "INITIAL_SESSION")) {
        void loadProfile(nextSession.user);
      }
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile, queryClient]);

  const refreshProfile = useCallback(async () => {
    const user = session?.user;
    if (user) await loadProfile(user);
  }, [loadProfile, session?.user]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      refreshProfile,
      signOut,
    }),
    [session, profile, loading, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
