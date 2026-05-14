import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.65)]',
        outline:
          'border border-white/40 dark:border-white/10 bg-white/30 dark:bg-white/5 backdrop-blur-md hover:bg-white/50 dark:hover:bg-white/10 text-foreground',
        ghost: 'hover:bg-white/40 dark:hover:bg-white/10 text-foreground',
        link: 'text-[hsl(var(--primary))] underline-offset-4 hover:underline',
        gradient:
          'text-white shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.65)] bg-[length:200%_200%] bg-gradient-to-br from-[hsl(var(--aurora-1))] via-[hsl(var(--aurora-3))] to-[hsl(var(--aurora-2))] hover:bg-[length:240%_240%]',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-9 px-4 text-xs',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});

export { Button, buttonVariants };
