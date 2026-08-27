import { addToLibrary, fetchUserLibrary, removeFromLibrary } from './stream-api';
import {
  isCloudLibraryId,
  libraryItemToSavedChannel,
  loadPersonalLibrary,
  mergeSavedChannels,
  reconcilePersonalLibrary,
  savedChannelIdentity,
  savedChannelToLibraryItem,
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

export async function addSavedChannelToPersonalLibrary(
  channel: SavedChannel,
): Promise<SavedChannel> {
  const identity = savedChannelIdentity(channel);
  const current = loadPersonalLibrary();
  const existing = current.find(item => savedChannelIdentity(item) === identity);
  if (existing) return existing;

  savePersonalLibrary([...current, channel]);
  notifyPersonalLibraryUpdated();

  const cloudItem = await addToLibrary(savedChannelToLibraryItem(channel));
  if (!cloudItem) return channel;

  const syncedChannel = libraryItemToSavedChannel(cloudItem);
  const latest = loadPersonalLibrary();
  const index = latest.findIndex(item => savedChannelIdentity(item) === identity);

  // The user may have removed it while the request was running. Do not put it
  // back into the browser in that case.
  if (index === -1) return syncedChannel;

  const updated = [...latest];
  updated[index] = syncedChannel;
  savePersonalLibrary(mergeSavedChannels(updated, []));
  notifyPersonalLibraryUpdated();
  return syncedChannel;
}

export async function removeSavedChannelFromPersonalLibrary(
  channel: SavedChannel,
): Promise<boolean> {
  const identity = savedChannelIdentity(channel);
  const current = loadPersonalLibrary();
  const updated = current.filter(item => savedChannelIdentity(item) !== identity);

  savePersonalLibrary(updated);
  notifyPersonalLibraryUpdated();

  // Browser-only entries have never received the server's UUID, so there is
  // nothing in Supabase to delete.
  if (!isCloudLibraryId(channel.id)) return true;

  const removed = await removeFromLibrary(channel.id);
  if (removed) return true;

  // If the cloud deletion fails, restore the local entry so both copies do not
  // silently disagree.
  savePersonalLibrary(mergeSavedChannels(loadPersonalLibrary(), [channel]));
  notifyPersonalLibraryUpdated();
  return false;
}
