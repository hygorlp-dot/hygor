const editors = new Map();
export function registerEditor(entity, editor) { editors.set(entity, editor); }
export function getEditor(entity) { return editors.get(entity); }
