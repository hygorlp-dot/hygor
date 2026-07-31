import { useCallback, useState } from "react";
import { validateSchema } from "../validation/validateSchema.js";

export function useEditorValidation(schema) {
  const [errors, setErrors] = useState({});
  const validate = useCallback(async values => { const nextErrors = await validateSchema(schema, values); setErrors(nextErrors); return nextErrors; }, [schema]);
  return { errors, setErrors, validate };
}
