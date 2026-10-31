import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/utils";
import {buttonRole,buttonSize} from '../../design-system/primitives/button-contract.js';
import '../../design-system/primitives/button-contract.css';

const Button = React.forwardRef(({ className, variant='primary', size='md', loading=false, loadingLabel, disabled=false, asChild = false, children, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      data-mrc-role={buttonRole(variant)}
      data-mrc-size={buttonSize(size)}
      data-mrc-link={variant==='link'||undefined}
      className={cn('mrc-button',className)}
      ref={ref}
      disabled={!asChild&&(disabled||Boolean(loading))||undefined}
      aria-disabled={asChild&&(disabled||Boolean(loading))||undefined}
      {...props}
      aria-busy={loading?true:props['aria-busy']}
      tabIndex={asChild&&(disabled||loading)?-1:props.tabIndex}
      onClickCapture={event=>{if(disabled||loading){event.preventDefault();event.stopPropagation();return;}props.onClickCapture?.(event);}}
      onClick={event=>{if(disabled||loading){event.preventDefault();event.stopPropagation();return;}props.onClick?.(event);}}
    >{asChild?children:<>{loading&&<span className="mrc-button__spinner" aria-hidden="true"/>}{loading&&loadingLabel?loadingLabel:children}</>}</Comp>
  );
});
Button.displayName = "Button";

export { Button };
