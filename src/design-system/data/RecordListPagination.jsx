import {DataTablePagination} from './DataTablePagination.jsx';
import {UI_TEXT} from '../copy.js';

export function RecordListPagination({pagination,label='registros'}){
 return <section aria-label={UI_TEXT.pagination.results(label)}>
  <p role="status">{pagination.count?UI_TEXT.pagination.range(pagination.start,pagination.end,pagination.count,label):UI_TEXT.pagination.empty(label)}</p>
  <DataTablePagination page={pagination.page} pageCount={pagination.pageCount} onPageChange={pagination.onPageChange}/>
 </section>;
}
