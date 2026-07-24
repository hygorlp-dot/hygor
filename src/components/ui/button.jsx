import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border text-sm font-semibold normal-case tracking-[0.01em] ring-offset-background transition-[background-color,border-color,color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] focus-visible:ring-offset-2 active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-[#b8930f] bg-[#d4af37] text-[#121212] hover:bg-[#c8a329]",
        destructive: "border-[#e0b1b1] bg-[#fff7f7] text-[#b71c1c] hover:border-[#b71c1c] hover:bg-[#fbeaea]",
        outline: "border-[#cdd0d3] bg-[#fafafa] text-[#121212] hover:border-[#aeb3b7] hover:bg-[#e6e8ea]",
        secondary: "border-[#cdd0d3] bg-[#e6e8ea] text-[#121212] hover:bg-[#d9dcde]",
        ghost: "border-transparent bg-transparent text-[#41464b] hover:bg-[#e6e8ea] hover:text-[#121212]",
        link: "border-transparent bg-transparent text-[#0d47a1] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
