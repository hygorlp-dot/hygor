import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";

// Célula editável da planilha do orçamento. `multiline` troca o <input> por um
// <textarea> de uma linha que cresce com o conteúdo: descrições longas quebram
// na célula em vez de ficarem cortadas por reticências. Enter continua
// confirmando (nunca insere quebra de linha), então o comportamento de edição
// é o mesmo nos dois modos.
export const BudgetTextCell = memo(function BudgetTextCell({
  value,
  onCommit,
  onDigitar,
  onEnter,
  onEscape,
  searchOnly = false,
  resetKey,
  onSearchEnd,
  multiline = false,
  ...props
}) {
  const [local, setLocal] = useState(value ?? "");
  const focused = useRef(false);
  const cancelling = useRef(false);
  const campo = useRef(null);

  useEffect(() => {
    if (!focused.current || searchOnly) setLocal(value ?? "");
  }, [value, searchOnly, resetKey]);

  const ajustarAltura = () => {
    const el = campo.current;
    if (!el || !multiline) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useLayoutEffect(ajustarAltura, [multiline, local]);
  // A largura muda ao ligar/desligar colunas ou redimensionar a janela, e com
  // ela o número de linhas; só reage à largura para não entrar em laço com a
  // própria mudança de altura.
  useEffect(() => {
    const el = campo.current;
    if (!multiline || !el || typeof ResizeObserver === "undefined") return undefined;
    let largura = el.offsetWidth;
    const observador = new ResizeObserver(() => {
      if (el.offsetWidth === largura) return;
      largura = el.offsetWidth;
      ajustarAltura();
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, [multiline]);

  const discard = element => {
    cancelling.current = true;
    setLocal(value ?? "");
    element.blur();
  };

  const Campo = multiline ? "textarea" : "input";
  return <Campo
    {...props}
    ref={campo}
    rows={multiline ? 1 : undefined}
    value={local}
    onFocus={() => { focused.current = true; }}
    onChange={event => {
      setLocal(event.target.value);
      onDigitar?.(event);
    }}
    onBlur={event => {
      focused.current = false;
      const text = event.target.value;
      if (searchOnly) {
        cancelling.current = false;
        setLocal(value ?? "");
        onSearchEnd?.();
        return;
      }
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
