// Presentation only: authorization and loading belong to the asset consumer.
// Callers keep the shared surface, typography and spacing of their control.
export function MediaBackground({as:Component='div',background,style,...props}){
 return <Component {...props} style={{...style,background}}/>;
}
