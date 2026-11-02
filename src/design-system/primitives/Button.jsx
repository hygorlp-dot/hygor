import { forwardRef } from "react";
import { cn } from "../lib/cn.js";
import {Button as CoreButton} from '../../components/ui/button.jsx';
import {buttonSize} from './button-contract.js';

export const buttonVariants=({size='md',className}={})=>cn('arcd-button',buttonSize(size)==='icon'&&'arcd-button--icon',className);

export const Button = forwardRef(function Button({ className, variant, size, loading = false, disabled, children, type = "button", ...props }, ref) {
  return <CoreButton ref={ref} type={type} variant={variant} size={size} className={cn(buttonVariants({size}),className)} disabled={disabled} loading={loading} {...props}>{children}</CoreButton>;
});
