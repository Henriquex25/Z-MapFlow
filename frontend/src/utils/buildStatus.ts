import type { Build } from "../types/keyboard";
// Wails returns a fresh snapshot on each poll, including while nothing changes.
export function sameBuild(a: Build | null, b: Build | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.revision === b.revision &&
    a.pluginId === b.pluginId &&
    a.variantId === b.variantId &&
    a.status === b.status &&
    a.stage === b.stage &&
    a.startedAt === b.startedAt &&
    a.finishedAt === b.finishedAt &&
    a.error === b.error &&
    (a.logs?.length ?? 0) === (b.logs?.length ?? 0) &&
    (a.logs ?? []).every((line, i) => line === b.logs?.[i]) &&
    (a.artifacts?.length ?? 0) === (b.artifacts?.length ?? 0) &&
    (a.artifacts ?? []).every((artifact, i) => {
      const other = b.artifacts?.[i];
      return (
        other &&
        artifact.targetId === other.targetId &&
        artifact.name === other.name &&
        artifact.size === other.size &&
        artifact.sha256 === other.sha256
      );
    })
  );
}
