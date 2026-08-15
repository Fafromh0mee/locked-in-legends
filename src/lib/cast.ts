import { supabase } from "@/integrations/supabase/client";

const MAX_BYTES = 25 * 1024 * 1024;

/** Uploads cast reference photos to the private characters bucket and returns paths + signed URLs. */
export async function uploadCastPhotos(userId: string, files: File[]) {
  const paths: string[] = [];
  const urls: string[] = [];

  for (const file of files) {
    if (file.size > MAX_BYTES) throw new Error(`${file.name} is over the 25 MB limit.`);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("characters").upload(path, file, { upsert: true });
    if (error) throw error;
    paths.push(path);
    const { data: signed } = await supabase.storage.from("characters").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signed?.signedUrl) urls.push(signed.signedUrl);
  }

  return { paths, urls };
}

/** Uploads a study material file to the private materials bucket. */
export async function uploadMaterial(userId: string, file: File) {
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is over the 25 MB limit.`);
  const path = `${userId}/${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage.from("materials").upload(path, file, { upsert: true });
  if (error) throw error;
  return { path, name: file.name, size: file.size, type: file.type };
}
