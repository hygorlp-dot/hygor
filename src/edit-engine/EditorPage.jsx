import { ModuleLayout } from "../design-system/patterns/ModuleLayout.jsx";
import { PageHeader } from "../design-system/patterns/PageHeader.jsx";
import { EntityEditor } from "./EntityEditor.jsx";
export function EditorPage({ schema, ...props }) { return <ModuleLayout header={<PageHeader title={props.initialValues?.id ? schema.title.edit : schema.title.create} />}><EntityEditor schema={schema} {...props} /></ModuleLayout>; }
