"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
    React.ElementRef<typeof SwitchPrimitives.Root>,
    React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
    <SwitchPrimitives.Root
        ref={ref}
        className={cn(
            "peer inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-input bg-input transition-colors data-[state=checked]:bg-primary",
            className
        )}
        {...props}
    >
      <SwitchPrimitives.Thumb
          className={cn(
              "pointer-events-none block h-5 w-5 translate-x-0.5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-[1.375rem]"
          )}
      />
    </SwitchPrimitives.Root>
));
Switch.displayName = "Switch";

export { Switch };