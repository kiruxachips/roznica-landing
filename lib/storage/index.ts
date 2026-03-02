import { saveImageLocal, deleteImageLocal } from "./local"

export interface ImageStorage {
  save(file: Buffer, filename: string, entityId: string, type?: string): Promise<string>
  delete(url: string): Promise<void>
}

const localStorage: ImageStorage = {
  save: saveImageLocal,
  delete: deleteImageLocal,
}

export function getStorage(): ImageStorage {
  // Future: check env for S3 config
  return localStorage
}
