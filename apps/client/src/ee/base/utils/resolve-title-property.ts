import type { IBaseProperty } from "@/ee/base/types/base.types";

/**
 * Resolve which property supplies the card title / row-detail header.
 *
 * Boards seeded before the `Name` column existed carry `isPrimary` on a
 * non-text column (Status), so reading the primary cell would render a choice
 * id — or "Untitled" when empty — as the title and leave the real title
 * property rendered as an ordinary field.
 *
 * Prefer the primary column when it holds text; otherwise fall back to the
 * first text column (properties arrive ordered by position).
 */
export function resolveTitleProperty(
  properties: IBaseProperty[],
): IBaseProperty | undefined {
  const primary = properties.find((p) => p.isPrimary);
  if (primary?.type === "text") return primary;
  return properties.find((p) => p.type === "text");
}
