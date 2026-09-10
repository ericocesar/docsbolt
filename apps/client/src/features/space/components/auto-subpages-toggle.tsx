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
