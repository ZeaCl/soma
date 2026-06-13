/**
 * SandboxProvider — abstraction for agent file storage.
 *
 * Implement this interface to plug any storage backend (S3, GCS, local FS, memory)
 * into GliaFileBrowser without depending on Soma's REST API.
 */

export interface SandboxFile {
  name: string
  type: 'file' | 'dir'
  size: number
  ext?: string
}

export interface SandboxProvider {
  /** List files and directories at the given path */
  listFiles(path: string): Promise<SandboxFile[]>

  /** Read file content as string */
  readFile(path: string): Promise<string>

  /** Write content to a file, creating parent directories as needed */
  writeFile(path: string, content: string): Promise<void>

  /** Delete a file or empty directory */
  deleteFile(path: string): Promise<void>

  /** Create a directory */
  mkdir(path: string): Promise<void>

  /** Optional: get Git-like commit history */
  history?(path: string): Promise<Array<{ hash: string; message: string }>>
}
