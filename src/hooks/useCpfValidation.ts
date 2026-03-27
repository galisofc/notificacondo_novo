import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isValidCPF } from "@/lib/utils";

export type CpfStatus = "idle" | "checking" | "available" | "taken" | "invalid";

interface UseCpfValidationOptions {
  debounceMs?: number;
  minLength?: number;
  table?: "profiles" | "residents";
  excludeUserId?: string;
}

interface UseCpfValidationReturn {
  cpfStatus: CpfStatus;
  setCpfStatus: React.Dispatch<React.SetStateAction<CpfStatus>>;
  validateCpf: (cpf: string) => void;
  resetStatus: () => void;
  isValidating: boolean;
}

export function useCpfValidation(options: UseCpfValidationOptions = {}): UseCpfValidationReturn {
  const { debounceMs = 500, minLength = 11, table = "profiles", excludeUserId } = options;
  const [cpfStatus, setCpfStatus] = useState<CpfStatus>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkCpfAvailability = useCallback(async (cpf: string) => {
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length < minLength) { setCpfStatus("idle"); return; }
    if (!isValidCPF(cleanCpf)) { setCpfStatus("invalid"); return; }
    setCpfStatus("checking");
    try {
      let query = supabase.from(table).select("id, user_id").eq("cpf", cleanCpf);
      const { data: existingRecords, error } = await query;
      if (error) { setCpfStatus("idle"); return; }
      const filteredRecords = excludeUserId ? existingRecords?.filter(record => record.user_id !== excludeUserId) : existingRecords;
      setCpfStatus(filteredRecords && filteredRecords.length > 0 ? "taken" : "available");
    } catch { setCpfStatus("idle"); }
  }, [minLength, table, excludeUserId]);

  const validateCpf = useCallback((cpf: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length < minLength) { setCpfStatus("idle"); return; }
    if (!isValidCPF(cleanCpf)) { setCpfStatus("invalid"); return; }
    timeoutRef.current = setTimeout(() => { checkCpfAvailability(cpf); }, debounceMs);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [debounceMs, minLength, checkCpfAvailability]);

  const resetStatus = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setCpfStatus("idle");
  }, []);

  return { cpfStatus, setCpfStatus, validateCpf, resetStatus, isValidating: cpfStatus === "checking" };
}