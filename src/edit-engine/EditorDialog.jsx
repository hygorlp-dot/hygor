import { Dialog } from "../design-system/primitives/Dialog.jsx";
import { EntityEditor } from "./EntityEditor.jsx";

export function EditorDialog({ open, onOpenChange, schema, initialValues, onSubmit, readOnly, forbidden }) { return <Dialog open={open} onOpenChange={onOpenChange} title={initialValues?.id ? schema.title.edit : schema.title.create}><EntityEditor schema={schema} initialValues={initialValues} onSubmit={onSubmit} readOnly={readOnly} forbidden={forbidden} onRequestClose={() => onOpenChange(false)} /></Dialog>; }
