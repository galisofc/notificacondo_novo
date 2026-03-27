import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type EmailStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "conflict";

interface UseEmailValidationOptions {
  debounceMs?: number;
  minLength?: number;
  conflictRoles?: string[];
  condominiumId?: string;
  table?: "profiles";
}

interface UseEmailValidationReturn {
  emailStatus: EmailStatus;
  setEmailStatus: (status: EmailStatus) => void;
  validateEmail: (email: string) => void;
  resetStatus: () => void;
  isValidating: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useEmailValidation(options: UseEmailValidationOptions = {}): UseEmailValidationReturn {
  const { debounceMs = 500, minLength = 5, conflictRoles = [], condominiumId, table = "profiles" } = options;
  const conflictRolesKey = conflictRoles.join(",");
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);

  const isValidEmailFormat = (email: string): boolean => EMAIL_REGEX.test(email);

  const checkEmailAvailability = useCallback(async (email: string, condoId?: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!isValidEmailFormat(trimmedEmail)) { setEmailStatus("invalid"); return; }
    setEmailStatus("checking");
    try {
      const { data: existingProfile, error } = await supabase.from(table).select("id, user_id").eq("email", trimmedEmail).maybeSingle();
      if (error) { setEmailStatus("idle"); return; }
      if (existingProfile) {
        if (conflictRoles.length > 0) {
          const { data: existingRoles } = await supabase.from("user_roles").select("role").eq("user_id", existingProfile.user_id);
          const roles = (existingRoles || []).map((r) => r.role as string);
          if (conflictRoles.some((role) => roles.includes(role))) { setEmailStatus("conflict"); return; }
        }
        if (condoId) {
          const { data: existingLink } = await supabase.from("user_condominiums").select("id").eq("user_id", existingProfile.user_id).eq("condominium_id", condoId).maybeSingle();
          if (existingLink) { setEmailStatus("taken"); return; }
        }
        if (!condoId && conflictRoles.length === 0) { setEmailStatus("taken"); return; }
        setEmailStatus("available");
      } else {
        setEmailStatus("available");
      }
    } catch { setEmailStatus("idle"); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, conflictRolesKey, condominiumId]);

  const validateEmail = useCallback((email: string) => {
    if (timeoutId) clearTimeout(timeoutId);
    const trimmedEmail = email.trim();
    if (trimmedEmail.length < minLength) { setEmailStatus("idle"); return; }
    const newTimeoutId = setTimeout(() => { checkEmailAvailability(email, condominiumId); }, debounceMs);
    setTimeoutId(newTimeoutId);
  }, [timeoutId, minLength, debounceMs, checkEmailAvailability, condominiumId]);

  const resetStatus = useCallback(() => {
    setEmailStatus("idle");
    if (timeoutId) clearTimeout(timeoutId);
  }, [timeoutId]);

  useEffect(() => { return () => { if (timeoutId) clearTimeout(timeoutId); }; }, [timeoutId]);

  return { emailStatus, setEmailStatus, validateEmail, resetStatus, isValidating: emailStatus === "checking" };
}