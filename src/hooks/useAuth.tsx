import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface SignUpMetadata {
  fullName: string;
  phone?: string;
  cpf?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata: SignUpMetadata) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const consumePendingRedirect = (nextSession: Session | null) => {
    if (!nextSession) return;
    const pending = localStorage.getItem("post_magiclink_redirect");
    if (pending) {
      localStorage.removeItem("post_magiclink_redirect");
      setTimeout(() => {
        navigate(pending, { replace: true });
      }, 100);
    }
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        consumePendingRedirect(session);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      consumePendingRedirect(session);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signUp = async (email: string, password: string, metadata: SignUpMetadata) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: metadata.fullName,
          phone: metadata.phone || null,
          cpf: metadata.cpf || null,
          role: metadata.role || 'sindico',
        },
      },
    });
    
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) return { error: error as Error | null };

    // Check if user is a porter and if they are active
    const userId = data.user?.id;
    if (userId) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "porteiro")
        .maybeSingle();

      if (roles) {
        // User is a porter - check is_active on their condominium links
        const { data: condoLinks } = await supabase
          .from("user_condominiums")
          .select("id, is_active")
          .eq("user_id", userId) as any;

        const links = condoLinks as any[] || [];
        const hasActiveLink = links.some((link: any) => link.is_active !== false);

        if (!hasActiveLink) {
          // No active links - sign out and return error
          await supabase.auth.signOut();
          return { error: new Error("Sua conta está desativada. Entre em contato com o síndico.") };
        }
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    setUser(null);
    setSession(null);
    
    const keysToRemove = Object.keys(localStorage).filter(key => 
      key.startsWith('sb-') || key.includes('supabase')
    );
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (error) {
      console.log("Sign out completed (session may have already expired)");
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};