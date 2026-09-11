import { useCallback } from "react";
import { Popover } from "@mantine/core";
import { DatePicker } from "@mantine/dates";
import {
  IBaseProperty,
  DateTypeOptions,
} from "@/ee/base/types/base.types";
import cellClasses from "@/ee/base/styles/cells.module.css";

type CellDateProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

export function formatDateDisplay(
  dateStr: string | null | undefined,
  options: DateTypeOptions | undefined,
): string {
  if (!dateStr) return "";
  try {
    let dayStr: string;
    let monthStr: string;
    let yearStr: string;
    let hoursStr = "";
    let minutesStr = "";
    let ampm = "";

    // Handle "YYYY-MM-DD" plain date strings without time or timezone to avoid UTC shifting
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
    if (dateOnlyMatch) {
      yearStr = dateOnlyMatch[1];
      monthStr = dateOnlyMatch[2];
      dayStr = dateOnlyMatch[3];
    } else {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "";

      yearStr = String(date.getFullYear());
      monthStr = String(date.getMonth() + 1).padStart(2, "0");
      dayStr = String(date.getDate()).padStart(2, "0");

      if (options?.includeTime) {
        if (options.timeFormat === "24h") {
          hoursStr = String(date.getHours()).padStart(2, "0");
          minutesStr = String(date.getMinutes()).padStart(2, "0");
        } else {
          let hours = date.getHours();
          ampm = hours >= 12 ? "PM" : "AM";
          hours = hours % 12 || 12;
          hoursStr = String(hours).padStart(2, "0");
          minutesStr = String(date.getMinutes()).padStart(2, "0");
        }
      }
    }

    const format = options?.dateFormat ?? "DD/MM/YYYY";
    let result: string;

    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const monthIndex = parseInt(monthStr, 10) - 1;
    const monthName = months[monthIndex] ?? monthStr;

    switch (format) {
      case "YYYY-MM-DD":
      case "yyyy-MM-dd":
        result = `${yearStr}-${monthStr}-${dayStr}`;
        break;
      case "MM/DD/YYYY":
      case "MM/dd/yyyy":
        result = `${monthStr}/${dayStr}/${yearStr}`;
        break;
      case "MMM D, YYYY":
        result = `${monthName} ${parseInt(dayStr, 10)}, ${yearStr}`;
        break;
      case "DD/MM/YYYY":
      case "dd/MM/yyyy":
      case "dd/MM/YYYY":
      default:
        result = `${dayStr}/${monthStr}/${yearStr}`;
        break;
    }

    if (options?.includeTime && hoursStr) {
      if (ampm) {
        result += ` ${hoursStr}:${minutesStr} ${ampm}`;
      } else {
        result += ` ${hoursStr}:${minutesStr}`;
      }
    }

    return result;
  } catch {
    return "";
  }
}

function toISODateString(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const dateOnlyMatch = /^(\d{4}-\d{2}-\d{2})/.exec(dateStr.trim());
  if (dateOnlyMatch) {
    return dateOnlyMatch[1];
  }
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

export function CellDate({
  value,
  property,
  isEditing,
  onCommit,
  onCancel,
}: CellDateProps) {
  const typeOptions = property.typeOptions as DateTypeOptions | undefined;
  const dateStr = typeof value === "string" ? value : null;
  const pickerValue = toISODateString(dateStr);

  const handleChange = useCallback(
    (selected: string | null) => {
      if (selected) {
        const date = new Date(selected);
        onCommit(date.toISOString());
      } else {
        onCommit(null);
      }
    },
    [onCommit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [onCancel],
  );

  if (isEditing) {
    return (
      <Popover
        opened
        onChange={(o) => {
          if (!o) onCancel();
        }}
        onClose={onCancel}
        position="bottom-start"
        width="auto"
        trapFocus
        closeOnClickOutside
        closeOnEscape
      >
        <Popover.Target>
          <div className={cellClasses.popoverTarget}>
            <span className={cellClasses.dateValue}>
              {formatDateDisplay(dateStr, typeOptions)}
            </span>
          </div>
        </Popover.Target>
        <Popover.Dropdown p="xs" onKeyDown={handleKeyDown}>
          <DatePicker
            value={pickerValue}
            onChange={handleChange}
            size="sm"
          />
        </Popover.Dropdown>
      </Popover>
    );
  }

  if (!dateStr) {
    return <span className={cellClasses.emptyValue} />;
  }

  return (
    <span className={cellClasses.dateValue}>
      {formatDateDisplay(dateStr, typeOptions)}
    </span>
  );
}
