import {it,expect} from 'vitest';
import {projectLocalReviewFiles} from './company-review-files.mjs';
it('só apresenta a cópia local conferida da empresa e bloqueia URLs da nuvem',()=>{
  const data={photo:'https://storage.test/storage/v1/object/public/diario-obra/a/file.jpg',folder:'https://1drv.ms/shared',children:[{url:'https://other.test/external'}]};
  const original=structuredClone(data),audit={objects:[{id:'file',company:'arcd',originHost:'storage.test',bucket:'diario-obra',name:'a/file.jpg',localCopy:{sha256:'hash'}}]};
  expect(projectLocalReviewFiles(data,'arcd',audit,()=>'/api/local-review-file?companyId=arcd')).toEqual({photo:'/api/local-review-file?companyId=arcd',folder:'/api/local-review-file-unavailable',children:[{url:'/api/local-review-file-unavailable'}]});
  expect(projectLocalReviewFiles(data,'mrc',audit,()=>'/leaked').photo).toBe('/api/local-review-file-unavailable');
  expect(data).toEqual(original);
  audit.objects[0].originHost='other.test';expect(projectLocalReviewFiles(data,'arcd',audit,()=>'/leaked').photo).toBe('/api/local-review-file-unavailable');
});
