"use client";

import { useState, type ReactElement } from "react";
import { Tooltip } from "radix-ui";

export function StudyTooltip({
  children,
  description,
  openOnActivation = false,
}: {
  children: ReactElement;
  description: string;
  openOnActivation?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Tooltip.Provider delayDuration={250} disableHoverableContent>
      <Tooltip.Root open={open} onOpenChange={setOpen}>
        <Tooltip.Trigger
          asChild
          onClick={openOnActivation ? (event) => {
            event.preventDefault();
            setOpen(true);
          } : undefined}
        >
          {children}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={7}
            collisionPadding={12}
            className="z-50 max-w-60 rounded-card border border-line bg-card px-3 py-2 text-xs font-normal whitespace-pre-line text-ink shadow-card"
          >
            {description}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
