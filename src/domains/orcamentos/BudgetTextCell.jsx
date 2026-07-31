import { memo, useEffect, useRef, useState } from "react";

export const BudgetTextCell = memo(function BudgetTextCell({
  value,
  onCommit,
  onDigitar,
  onEnter,
  onEscape,
  ...props
}) {
  const [local, setLocal] = useState(value ?? "");
  const focused = useRef(false);
  const cancelling = useRef(false);

  useEffect(() => {
    if (!focused.current) setLocal(value ?? "");
  }, [value]);

  const discard = element => {
    cancelling.current = true;
    setLocal(value ?? "");
    element.blur();
  };

  return <input
    {...props}
    value={local}
    onFocus={() => { focused.current = true; }}
    onChange={event => {
      setLocal(event.target.value);
      onDigitar?.(event);
    }}
    onBlur={event => {
      focused.current = false;
      const text = event.target.value;
      if (cancelling.current) {
        cancelling.current = false;
        setLocal(value ?? "");
        return;
      }
      if (text !== (value ?? "")) onCommit?.(text);
      else setLocal(value ?? "");
    }}
    onKeyDown={event => {
      if (event.key === "Escape") {
        onEscape?.();
        discard(event.currentTarget);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (onEnter?.(event) === true) discard(event.currentTarget);
        else event.currentTarget.blur();
      }
    }}
  />;
});

