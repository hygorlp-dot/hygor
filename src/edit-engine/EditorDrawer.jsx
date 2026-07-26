import { Drawer } from "../design-system/primitives/Drawer.jsx";
import { EntityEditor } from "./EntityEditor.jsx";
export function EditorDrawer({ open, onOpenChange, schema, initialValues, onSubmit, readOnly, forbidden }) { return <Drawer open={open} onOpenChange={onOpenChange} title={initialValues?.id ? schema.title.edit : schema.title.create}><EntityEditor schema={schema} initialValues={initialValues} onSubmit={onSubmit} readOnly={readOnly} forbidden={forbidden} onRequestClose={() => onOpenChange(false)} /></Drawer>; }
