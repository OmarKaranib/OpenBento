import { addToLibrary, fetchUserLibrary } from './stream-api';
import {
  loadPersonalLibrary,
  reconcilePersonalLibrary,
  savePersonalLibrary,
  type SavedChannel,
} from './personal-library';

export const PERSONAL_LIBRARY_UPDATED_EVENT = 'personalLibraryUpdated';

export function notifyPersonalLibraryUpdated(): void {
  window.dispatchEvent(new CustomEvent(PERSONAL_LIBRARY_UPDATED_EVENT));
}

export async function syncPersonalLibraryWithCloud(): Promise<SavedChannel[] | null> {
  const cloudItems = await fetchUserLibrary();
  if (!cloudItems) return null;

  const reconciled = await reconcilePersonalLibrary(
    loadPersonalLibrary(),
    cloudItems,
    addToLibrary,
  );

  savePersonalLibrary(reconciled);
  notifyPersonalLibraryUpdated();
  return reconciled;
}
