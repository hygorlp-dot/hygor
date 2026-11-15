import './task-disclosure.css';

/** Secondary tools stay available without preceding the operator's main task. */
export function TaskDisclosure({summary,children,defaultOpen=false}) {
  return <details className="mrc-task-disclosure" open={defaultOpen||undefined}>
    <summary>{summary}</summary><div className="mrc-task-disclosure__body">{children}</div>
  </details>;
}
