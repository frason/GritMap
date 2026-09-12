import { Directory, File, Paths } from "expo-file-system";

const RETAINED_FOLDER_NAME = "fit-imports";

export interface RetainedFile {
  uri: string;
  fileSizeBytes: number;
}

/**
 * Copies a picker-selected ride file (FIT or GPX) into permanent app storage. A picker URI --
 * especially an Android `content://` one -- isn't guaranteed to stay valid after the picker
 * session ends, so this satisfies MVP.md's "retain each original file" requirement. Keeps the
 * original filename's extension (falling back to no extension) rather than hardcoding `.fit`,
 * since the retained copy would otherwise silently mislabel a GPX import on disk -- cosmetic
 * only (nothing re-reads this extension, see persistImportedRide.ts), but not honest.
 */
export function retainRideFile(
  sourceUri: string,
  originalFilename: string,
  generateId: () => string,
): RetainedFile {
  const directory = new Directory(Paths.document, RETAINED_FOLDER_NAME);
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });

  const dotIndex = originalFilename.lastIndexOf(".");
  const extension = dotIndex > 0 ? originalFilename.slice(dotIndex) : "";
  const destination = new File(directory, `${generateId()}${extension}`);
  new File(sourceUri).copySync(destination);

  return { uri: destination.uri, fileSizeBytes: destination.size };
}

/**
 * Deletes a retained file. Logs and swallows failure -- an orphaned file is a recoverable
 * cleanup nit, never a reason to fail an otherwise-successful import/replace.
 */
export function deleteRetainedFile(uri: string): void {
  try {
    new File(uri).delete();
  } catch (error) {
    console.warn(`Failed to delete retained file ${uri}`, error);
  }
}
