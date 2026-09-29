export interface RegistryConfig {
  owner: string;
  repo: string;
  /** Directory path within the repo, no leading/trailing slash. */
  path: string;
  branch: string;
}

/**
 * The registry lives as a directory in this app's own repo rather than a separate one --
 * one fewer thing to create/administer, and the client already has write access to it.
 * See docs/SEGMENT_REGISTRY.md for why this approach was chosen over a hosted backend.
 */
export function defaultRegistryConfig(): RegistryConfig {
  return {
    owner: "frason",
    repo: "GritMap",
    path: "registry/segments",
    branch: "main",
  };
}
