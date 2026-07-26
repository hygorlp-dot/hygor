import { EditorDrawer } from "../../edit-engine/EditorDrawer.jsx";
import { supplierAdapter } from "./supplierAdapter.js";
import { supplierEditorSchema } from "./supplierEditorSchema.js";

export function SupplierEditor({ open, supplier, onOpenChange, onSave, readOnly, forbidden }) {
  const initialValues = supplierAdapter.fromLegacy(supplier);
  return <EditorDrawer open={open} onOpenChange={onOpenChange} schema={supplierEditorSchema} initialValues={initialValues} readOnly={readOnly} forbidden={forbidden} onSubmit={async values => onSave?.(supplierAdapter.toLegacy(values, supplier || {}))} />;
}
