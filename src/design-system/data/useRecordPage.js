import {useEffect} from 'react';
import {useWorkspaceState} from '../../features/workflow/workspace-session.jsx';

export function recordPage(rows,page=0,size=12){
 const pageCount=Math.max(1,Math.ceil(rows.length/size));
 const index=Math.max(0,Math.min(Math.trunc(Number(page)||0),pageCount-1));
 return {rows:rows.slice(index*size,(index+1)*size),page:index,pageCount,count:rows.length,start:rows.length?index*size+1:0,end:Math.min((index+1)*size,rows.length)};
}
export function useRecordPage(screen,rows,filter='',instance=''){
 const [cursor,setCursor]=useWorkspaceState(screen,'recordPage',{filter,page:0},instance);
 const result=recordPage(rows,cursor.filter===filter?cursor.page:0);
 useEffect(()=>{if(cursor.filter!==filter)setCursor({filter,page:0});},[filter,cursor.filter,setCursor]);
 return {...result,onPageChange:page=>setCursor({filter,page})};
}
