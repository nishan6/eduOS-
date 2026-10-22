import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-card",
        secondary: "border border-border bg-surface text-foreground hover:bg-surface-muted",
        ghost: "text-foreground hover:bg-surface-muted",
        danger: "bg-danger text-white hover:bg-danger/90",
        link: "text-primary underline-offset-4 hover:underline px-0",
      },
      size: { sm: "h-8 px-3", md: "h-10 px-4", lg: "h-11 px-5 text-base", icon: "size-9" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = "Button";
