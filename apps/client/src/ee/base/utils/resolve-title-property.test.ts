import { describe, expect, it } from "vitest";
import type { BasePropertyType, IBaseProperty } from "@/ee/base/types/base.types";
import { resolveTitleProperty } from "./resolve-title-property";

function prop(
  id: string,
  type: BasePropertyType,
  isPrimary = false,
): IBaseProperty {
  return {
    id,
    pageId: "page",
    name: id,
    type,
    position: "a0",
    typeOptions: {},
    isPrimary,
    workspaceId: "ws",
    createdAt: "",
    updatedAt: "",
  };
}

describe("resolveTitleProperty", () => {
  it("uses the primary property when it is a text column", () => {
    const properties = [prop("status", "status"), prop("name", "text", true)];

    expect(resolveTitleProperty(properties)?.id).toBe("name");
  });

  it("falls back to the text column when the primary is not text", () => {
    // Boards seeded before the Name column existed carry isPrimary on Status,
    // which would render the choice id (or "Untitled") as the card title.
    const properties = [
      prop("status", "status", true),
      prop("titulo", "text"),
      prop("descricao", "longText"),
    ];

    expect(resolveTitleProperty(properties)?.id).toBe("titulo");
  });

  it("ignores non-text columns that precede the text column", () => {
    const properties = [
      prop("status", "status", true),
      prop("id", "number"),
      prop("pessoa", "person"),
      prop("titulo", "text"),
    ];

    expect(resolveTitleProperty(properties)?.id).toBe("titulo");
  });

  it("returns the earliest text column when several exist", () => {
    const properties = [
      prop("status", "status", true),
      prop("titulo", "text"),
      prop("outro", "text"),
    ];

    expect(resolveTitleProperty(properties)?.id).toBe("titulo");
  });

  it("returns undefined when the board has no text column", () => {
    const properties = [prop("status", "status", true), prop("id", "number")];

    expect(resolveTitleProperty(properties)).toBeUndefined();
  });

  it("returns undefined for an empty property list", () => {
    expect(resolveTitleProperty([])).toBeUndefined();
  });
});
