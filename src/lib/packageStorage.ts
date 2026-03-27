import { supabase } from "@/integrations/supabase/client";

type SignedUrlFunctionResponse = {
  signedUrl: string | null;
};

export function extractFilePathFromUrl(photoUrl: string): string | null {
  if (!photoUrl) return null;
  
  try {
    const bucketName = "package-photos";
    
    if (!photoUrl.includes('/') && !photoUrl.startsWith('http')) {
      return photoUrl;
    }
    
    const patterns = [
      `/object/public/${bucketName}/`,
      `/object/sign/${bucketName}/`,
      `/public/${bucketName}/`,
    ];
    
    for (const pattern of patterns) {
      const patternIndex = photoUrl.indexOf(pattern);
      if (patternIndex !== -1) {
        let filePath = photoUrl.substring(patternIndex + pattern.length);
        const queryIndex = filePath.indexOf('?');
        if (queryIndex !== -1) {
          filePath = filePath.substring(0, queryIndex);
        }
        return filePath || null;
      }
    }
    
    if (photoUrl.includes(`/${bucketName}/`)) {
      const parts = photoUrl.split(`/${bucketName}/`);
      if (parts.length > 1) {
        let filePath = parts[parts.length - 1];
        const queryIndex = filePath.indexOf('?');
        if (queryIndex !== -1) {
          filePath = filePath.substring(0, queryIndex);
        }
        return filePath || null;
      }
    }
    
    console.warn("Could not extract file path from URL format:", photoUrl);
    return null;
  } catch (error) {
    console.error("Error extracting file path from URL:", error);
    return null;
  }
}

export async function deletePackagePhoto(photoUrl: string): Promise<{ success: boolean; error?: string }> {
  if (!photoUrl) {
    return { success: true };
  }

  const filePath = extractFilePathFromUrl(photoUrl);
  
  if (!filePath) {
    console.warn("Could not extract file path from photo URL:", photoUrl);
    return { success: true };
  }

  try {
    const { error } = await supabase.storage
      .from("package-photos")
      .remove([filePath]);

    if (error) {
      console.error("Error deleting package photo:", error);
      return { success: false, error: error.message };
    }

    console.log("Package photo deleted successfully:", filePath);
    return { success: true };
  } catch (error) {
    console.error("Error deleting package photo:", error);
    return { success: false, error: String(error) };
  }
}

export async function getSignedPackagePhotoUrl(
  photoUrl: string,
  expiresIn: number = 3600,
  maxRetries: number = 3
): Promise<string | null> {
  if (!photoUrl) return null;

  const filePath = extractFilePathFromUrl(photoUrl);
  
  if (!filePath) {
    console.warn("Could not extract file path from photo URL:", photoUrl);
    return null;
  }

  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data, error } = await supabase.storage
        .from("package-photos")
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        const message = (error as any)?.message ?? String(error);
        const shouldFallbackToFunction =
          typeof message === "string" &&
          (message.toLowerCase().includes("object not found") || message.toLowerCase().includes("not_found"));

        if (shouldFallbackToFunction) {
          try {
            const { data: fnData, error: fnError } = await supabase.functions.invoke<SignedUrlFunctionResponse>(
              "get-package-photo-signed-url",
              { body: { filePath, expiresIn } }
            );

            if (!fnError && fnData?.signedUrl) return fnData.signedUrl;
          } catch (fnInvokeError) {
            console.warn(`Attempt ${attempt}/${maxRetries} - Function fallback exception:`, fnInvokeError);
          }
        }

        lastError = error as Error;
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      } else {
        return data?.signedUrl || null;
      }
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error("Failed to create signed URL after all retries:", lastError);
  return null;
}

export async function deleteMultiplePackagePhotos(photoUrls: string[]): Promise<{ success: boolean; deletedCount: number; errors: string[] }> {
  const filePaths: string[] = [];
  const errors: string[] = [];

  for (const photoUrl of photoUrls) {
    if (!photoUrl) continue;
    
    const filePath = extractFilePathFromUrl(photoUrl);
    if (filePath) {
      filePaths.push(filePath);
    }
  }

  if (filePaths.length === 0) {
    return { success: true, deletedCount: 0, errors: [] };
  }

  try {
    const { error } = await supabase.storage
      .from("package-photos")
      .remove(filePaths);

    if (error) {
      console.error("Error deleting package photos:", error);
      errors.push(error.message);
      return { success: false, deletedCount: 0, errors };
    }

    return { success: true, deletedCount: filePaths.length, errors: [] };
  } catch (error) {
    console.error("Error deleting package photos:", error);
    errors.push(String(error));
    return { success: false, deletedCount: 0, errors };
  }
}