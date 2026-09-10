# Auto Subpages on New Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a boolean switch in space settings that, when enabled, automatically inserts a "Subpages (Child pages)" block as the first content node of every new page created in that space.

**Architecture:** A new `autoSubpages` flag lives inside the existing `settings` JSONB column on the `spaces` table, under a new `pages` key (`settings.pages.autoSubpages`). The space settings UI gets a new toggle in the General tab. When a page is created server-side, the page service checks this flag and, if true, prepends a `subpages` ProseMirror node to the page's initial content — the same node the slash menu "Subpages (Child pages)" command inserts.

**Tech Stack:** NestJS (server), Kysely ORM + PostgreSQL, React 19 + Mantine UI (client), TipTap 3 editor, Jotai + TanStack Query 5.

## Global Constraints

- Follow existing JSONB settings pattern (`sharing`, `comments`) — new `pages` key follows same merge-via-SQL approach.
- No database migration needed — `settings` is already `Json | null`.
- No license gating — this feature is available to all plans (unlike security settings).
- The subpages block uses the existing `Subpages` TipTap extension (`packages/editor-ext/src/lib/subpages/subpages.ts`) — no new editor extension required.
- Text follows i18n pattern (`useTranslation` + `t()`).

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `apps/client/src/features/space/types/space.types.ts` | Add `ISpacePagesSettings` to `ISpaceSettings` |
| Create | `apps/client/src/features/space/components/auto-subpages-toggle.tsx` | Toggle component for the setting |
| Modify | `apps/client/src/features/space/components/space-details.tsx` | Render the toggle in General tab |
| Modify | `apps/server/src/core/space/dto/update-space.dto.ts` | Add `autoSubpages` validation field |
| Modify | `apps/server/src/database/repos/space/space.repo.ts` | Add `updatePagesSettings` method |
| Modify | `apps/server/src/core/space/services/space.service.ts` | Handle `autoSubpages` in `updateSpace` |
| Modify | `apps/server/src/core/page/services/page.service.ts` | Inject subpages node on page creation |

---

### Task 1: Add `ISpacePagesSettings` to client types

**Files:**
- Modify: `apps/client/src/features/space/types/space.types.ts:16-19`

**Interfaces:**
- Produces: `ISpacePagesSettings` with `autoSubpages?: boolean`, consumed by Task 2 and Task 3

- [ ] **Step 1: Read the current file**

Read `apps/client/src/features/space/types/space.types.ts` lines 8-19 to confirm current structure.

- [ ] **Step 2: Add `ISpacePagesSettings` interface and update `ISpaceSettings`**

In `apps/client/src/features/space/types/space.types.ts`, add after `ISpaceCommentsSettings`:

```typescript
export interface ISpacePagesSettings {
  autoSubpages?: boolean;
}
```

And update `ISpaceSettings` to include the new key:

```typescript
export interface ISpaceSettings {
  sharing?: ISpaceSharingSettings;
  comments?: ISpaceCommentsSettings;
  pages?: ISpacePagesSettings;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/features/space/types/space.types.ts
git commit -m "feat(client): add ISpacePagesSettings to space types"
```

---

### Task 2: Create `AutoSubpagesToggle` component

**Files:**
- Create: `apps/client/src/features/space/components/auto-subpages-toggle.tsx`

**Interfaces:**
- Consumes: `ISpace` (from space.types.ts), `useUpdateSpaceMutation` (from space-query.ts)
- Produces: `AutoSubpagesToggle` React component, consumed by Task 3

- [ ] **Step 1: Create the toggle component**

Create `apps/client/src/features/space/components/auto-subpages-toggle.tsx`:

```tsx
import { Group, Text, Switch } from "@mantine/core";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ISpace } from "@/features/space/types/space.types.ts";
import { useUpdateSpaceMutation } from "@/features/space/queries/space-query.ts";

type AutoSubpagesToggleProps = {
  space: ISpace;
};

export default function AutoSubpagesToggle({
  space,
}: AutoSubpagesToggleProps) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(
    space.settings?.pages?.autoSubpages === true,
  );
  const updateSpaceMutation = useUpdateSpaceMutation();

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    try {
      await updateSpaceMutation.mutateAsync({
        spaceId: space.id,
        autoSubpages: value,
      });
      setChecked(value);
    } catch {
      // error handled by mutation
    }
  };

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">{t("Auto-insert subpages block")}</Text>
        <Text size="sm" c="dimmed">
          {t("Automatically add a subpages block at the top of every new page in this space.")}
        </Text>
      </div>
      <Switch
        checked={checked}
        onChange={handleChange}
        size="xs"
        aria-label={t("Toggle auto subpages")}
      />
    </Group>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/features/space/components/auto-subpages-toggle.tsx
git commit -m "feat(client): add AutoSubpagesToggle component"
```

---

### Task 3: Render toggle in space settings General tab

**Files:**
- Modify: `apps/client/src/features/space/components/space-details.tsx:88-89`

**Interfaces:**
- Consumes: `AutoSubpagesToggle` (from Task 2), `ISpace` from `useSpaceQuery`

- [ ] **Step 1: Import and render the toggle**

In `apps/client/src/features/space/components/space-details.tsx`:

1. Add import at the top:
```tsx
import AutoSubpagesToggle from "@/features/space/components/auto-subpages-toggle.tsx";
```

2. After the `<EditSpaceForm>` closing tag (line 89), add:

```tsx
<Divider my="lg" />

<AutoSubpagesToggle space={space} />
```

The full section around line 89 should become:

```tsx
          <EditSpaceForm space={space} readOnly={readOnly} />

          <Divider my="lg" />

          <AutoSubpagesToggle space={space} />

          {!readOnly && (
            <>
              <Divider my="lg" />
              {/* ... existing Export and Delete rows ... */}
```

- [ ] **Step 2: Verify the UI renders**

Run the dev server and open space settings → General tab. The toggle should appear between the edit form and the Export row.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/features/space/components/space-details.tsx
git commit -m "feat(client): render AutoSubpagesToggle in space General settings"
```

---

### Task 4: Add `autoSubpages` to server DTO

**Files:**
- Modify: `apps/server/src/core/space/dto/update-space.dto.ts`

**Interfaces:**
- Produces: `autoSubpages?: boolean` validated field, consumed by Task 6

- [ ] **Step 1: Add the field to `UpdateSpaceDto`**

In `apps/server/src/core/space/dto/update-space.dto.ts`, add after `allowViewerComments`:

```typescript
  @IsOptional()
  @IsBoolean()
  autoSubpages: boolean;
```

The full file becomes:

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateSpaceDto } from './create-space.dto';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateSpaceDto extends PartialType(CreateSpaceDto) {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  spaceId: string;

  @IsOptional()
  @IsBoolean()
  disablePublicSharing: boolean;

  @IsOptional()
  @IsBoolean()
  allowViewerComments: boolean;

  @IsOptional()
  @IsBoolean()
  autoSubpages: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/core/space/dto/update-space.dto.ts
git commit -m "feat(server): add autoSubpages field to UpdateSpaceDto"
```

---

### Task 5: Add `updatePagesSettings` to space repo

**Files:**
- Modify: `apps/server/src/database/repos/space/space.repo.ts` (after `updateCommentSettings`, ~line 161)

**Interfaces:**
- Produces: `updatePagesSettings(spaceId, workspaceId, prefKey, prefValue, trx?)` method, consumed by Task 6

- [ ] **Step 1: Add the method**

In `apps/server/src/database/repos/space/space.repo.ts`, add after `updateCommentSettings` (after line 161):

```typescript
  async updatePagesSettings(
    spaceId: string,
    workspaceId: string,
    prefKey: string,
    prefValue: string | boolean,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('spaces')
      .set({
        settings: sql`COALESCE(settings, '{}'::jsonb)
          || jsonb_build_object('pages', COALESCE(settings->'pages', '{}'::jsonb)
          || jsonb_build_object('${sql.raw(prefKey)}', ${sql.lit(prefValue)}))`,
        updatedAt: new Date(),
      })
      .where('id', '=', spaceId)
      .where('workspaceId', '=', workspaceId)
      .returningAll()
      .executeTakeFirst();
  }
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/database/repos/space/space.repo.ts
git commit -m "feat(server): add updatePagesSettings method to SpaceRepo"
```

---

### Task 6: Handle `autoSubpages` in `updateSpace` service

**Files:**
- Modify: `apps/server/src/core/space/services/space.service.ts:184-219`

**Interfaces:**
- Consumes: `updatePagesSettings` (from Task 5), `autoSubpages` field on DTO (from Task 4)
- Produces: `settings.pages.autoSubpages` persisted in DB

- [ ] **Step 1: Add autoSubpages handling inside the transaction**

In `apps/server/src/core/space/services/space.service.ts`, inside the `executeTx` callback (after the `allowViewerComments` block, around line 219), add:

```typescript
      if (typeof updateSpaceDto.autoSubpages !== 'undefined') {
        const prev = settingsBefore?.pages?.autoSubpages ?? false;
        if (prev !== updateSpaceDto.autoSubpages) {
          before.autoSubpages = prev;
          after.autoSubpages = updateSpaceDto.autoSubpages;
        }

        await this.spaceRepo.updatePagesSettings(
          updateSpaceDto.spaceId,
          workspaceId,
          'autoSubpages',
          updateSpaceDto.autoSubpages,
          trx,
        );
      }
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/core/space/services/space.service.ts
git commit -m "feat(server): handle autoSubpages in updateSpace service"
```

---

### Task 7: Inject subpages block on page creation

**Files:**
- Modify: `apps/server/src/core/page/services/page.service.ts:92-150`

**Interfaces:**
- Consumes: `spaceRepo.findById` to read `settings.pages.autoSubpages`, `createYdocFromJson` (already imported)
- Produces: pages created with a `subpages` ProseMirror node as the first content block when the flag is enabled

- [ ] **Step 1: Inject SpaceRepo dependency**

In `apps/server/src/core/page/services/page.service.ts`, ensure `SpaceRepo` is injected. Check the constructor — if `spaceRepo` is not already available, add it:

```typescript
// In the constructor parameters, add:
private readonly spaceRepo: SpaceRepo,
```

And add the import at the top:
```typescript
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
```

(If `spaceRepo` is already injected, skip this step.)

- [ ] **Step 2: Add subpages content injection in the `create` method**

In the `create` method of `page.service.ts`, after the parent page validation (line ~116) and before the content parsing block (line ~118), add the auto-subpages logic:

```typescript
    // Auto-insert subpages block if space setting is enabled
    if (!createPageDto.content) {
      const space = await this.spaceRepo.findById(
        createPageDto.spaceId,
        workspaceId,
      );

      if ((space?.settings as any)?.pages?.autoSubpages === true) {
        createPageDto.content = JSON.stringify({
          type: 'doc',
          content: [
            { type: 'subpages' },
          ],
        });
        // format defaults to 'json' via the Transform decorator
      }
    }
```

The full `create` method flow becomes:

```typescript
  async create(
    userId: string,
    workspaceId: string,
    createPageDto: CreatePageDto,
    trx?: KyselyTransaction,
    isBase: boolean = false,
  ): Promise<Page> {
    let parentPageId = undefined;

    // check if parent page exists
    if (createPageDto.parentPageId) {
      const parentPage = await this.pageRepo.findById(
        createPageDto.parentPageId,
      );

      if (
        !parentPage ||
        parentPage.deletedAt ||
        parentPage.spaceId !== createPageDto.spaceId
      ) {
        throw new NotFoundException('Parent page not found');
      }

      parentPageId = parentPage.id;
    }

    // Auto-insert subpages block if space setting is enabled
    if (!createPageDto.content) {
      const space = await this.spaceRepo.findById(
        createPageDto.spaceId,
        workspaceId,
      );

      if ((space?.settings as any)?.pages?.autoSubpages === true) {
        createPageDto.content = JSON.stringify({
          type: 'doc',
          content: [
            { type: 'subpages' },
          ],
        });
        // format defaults to 'json' via the Transform decorator
      }
    }

    let content = undefined;
    let textContent = undefined;
    let ydoc = undefined;

    if (createPageDto?.content && createPageDto?.format) {
      const prosemirrorJson = await this.parseProsemirrorContent(
        createPageDto.content,
        createPageDto.format,
      );

      content = prosemirrorJson;
      textContent = jsonToText(prosemirrorJson);
      ydoc = createYdocFromJson(prosemirrorJson);
    }

    // ... rest of the method unchanged
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/core/page/services/page.service.ts
git commit -m "feat(server): inject subpages block on page creation when autoSubpages is enabled"
```

---

### Task 8: End-to-end verification

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Enable the toggle**

1. Navigate to any space
2. Open Space Settings → General tab
3. Toggle "Auto-insert subpages block" to ON
4. Verify the toast "Space updated successfully" appears

- [ ] **Step 3: Create a new page and verify**

1. In the same space, create a new page (from sidebar or anywhere)
2. Verify the page opens with a "Subpages (Child pages)" block already present as the first content node
3. Verify it shows "No subpages" (correct — the page is new and has no children)
4. Create a child page under it — verify the subpages block on the parent now shows the child

- [ ] **Step 4: Verify toggle OFF behavior**

1. Go back to Space Settings → General → toggle OFF
2. Create another new page
3. Verify the page opens empty (no subpages block)

- [ ] **Step 5: Verify existing pages are unaffected**

1. Open a page that existed before the toggle was enabled
2. Verify it has no auto-inserted subpages block (unless it had one manually)

- [ ] **Step 6: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "fix: address review feedback for auto-subpages feature"
```
