import { useEffect, useMemo, useState } from "react";
import { useEditorValidation } from "./useEditorValidation.js";

export function useEntityEditor({ schema, initialValues = {}, onSubmit, readOnly = false, forbidden = false }) {
  const [values, setValues] = useState(initialValues);
  const [initial, setInitial] = useState(initialValues);
  const [status, setStatus] = useState(forbidden ? "forbidden" : readOnly ? "readonly" : "ready");
  const { errors, setErrors, validate } = useEditorValidation(schema);
  useEffect(() => { setValues(initialValues); setInitial(initialValues); setErrors({}); setStatus(forbidden ? "forbidden" : readOnly ? "readonly" : "ready"); }, [forbidden, initialValues, readOnly, setErrors]);
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(initial), [initial, values]);
  useEffect(() => { if (status === "ready" || status === "dirty") setStatus(dirty ? "dirty" : "ready"); }, [dirty, status]);
  const setValue = (name, value) => setValues(current => ({ ...current, [name]: value }));
  const submit = async () => {
    if (readOnly || forbidden) return { ok: false, errors: {} };
    setStatus("validating");
    const nextErrors = await validate(values);
    if (Object.keys(nextErrors).length) { setStatus("dirty"); return { ok: false, errors: nextErrors }; }
    setStatus("saving");
    try {
      await onSubmit?.(values);
      setInitial(values); setStatus("success");
      return { ok: true, errors: {} };
    } catch (error) {
      const serverErrors = error?.fieldErrors || {};
      setErrors(serverErrors); setStatus("error");
      return { ok: false, errors: serverErrors, message: error?.message || "Não foi possível salvar." };
    }
  };
  return { values, errors, status, dirty, setValue, submit, reset: () => { setValues(initial); setErrors({}); setStatus("ready"); } };
}
