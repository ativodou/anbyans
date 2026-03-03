import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

// Upload a file to Firebase Storage and return the download URL
export async function uploadFile(
  file: File,
  path: string
): Promise<string> {
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  const url = await getDownloadURL(snapshot.ref);
  return url;
}

// Upload event poster
export async function uploadEventPoster(
  file: File,
  eventId: string
): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `events/${eventId}/poster.${ext}`;
  return uploadFile(file, path);
}

// Upload venue floor plan
export async function uploadFloorPlan(
  file: File,
  venueOrEventId: string
): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `floorplans/${venueOrEventId}/floorplan.${ext}`;
  return uploadFile(file, path);
}