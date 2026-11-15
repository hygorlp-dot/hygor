import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
const font=name=>Uint8Array.from(readFileSync(`public/fonts/marcell/NimbusSans-${name}.woff2`));
let requests,load,read;
beforeEach(async()=>{
 vi.resetModules();requests=[];
 vi.stubGlobal('caches',undefined);
 vi.stubGlobal('fetch',vi.fn(async url=>{requests.push(url);const bytes=font(url.includes('Regular')?'Regular':'Bold');return {ok:true,arrayBuffer:async()=>bytes.buffer};}));
 ({loadReportFonts:load,readReportFonts:read}=await import('./report-fonts.js'));
});
afterEach(()=>vi.unstubAllGlobals());
it('reuses a pending load and embeds byte-identical official fonts',async()=>{
 const [one,two]=await Promise.all([load(),load()]);expect(one).toBe(two);expect(requests).toHaveLength(2);
 for(const [key,name] of [['regularFont','Regular'],['boldFont','Bold']])expect(Buffer.from(one[key].split(',')[1],'base64')).toEqual(Buffer.from(font(name)));
 expect(read()).toBe(one);expect(await load()).toBe(one);expect(requests).toHaveLength(2);
});
it('requires successful preparation instead of silently exporting fallback fonts',()=>{
 expect(()=>read()).toThrow('fontes');expect(requests).toEqual([]);
});
it('allows retry after a network failure',async()=>{
 fetch.mockRejectedValueOnce(new Error('offline'));await expect(load()).rejects.toThrow('fontes');expect(()=>read()).toThrow('fontes');
 expect((await load()).regularFont).toMatch(/^data:font\/woff2;base64,/);
});
it('rejects an HTTP error or a truncated font',async()=>{
 fetch.mockResolvedValueOnce({ok:false});await expect(load()).rejects.toThrow('fontes');
 fetch.mockResolvedValueOnce({ok:true,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer});await expect(load()).rejects.toThrow('fontes');
});
it('can prepare the first report without a network using the persistent font cache',async()=>{
 const match=vi.fn(async url=>{const bytes=font(url.includes('Regular')?'Regular':'Bold');return {ok:true,arrayBuffer:async()=>bytes.buffer};});
 vi.stubGlobal('caches',{open:vi.fn(async()=>({match}))});fetch.mockRejectedValue(new Error('offline'));
 expect((await load()).boldFont).toMatch(/^data:font\/woff2;base64,/);expect(match).toHaveBeenCalledTimes(2);expect(fetch).not.toHaveBeenCalled();
});
it('keeps report generation available when persistent caching is denied',async()=>{
 vi.stubGlobal('caches',{open:vi.fn(async()=>{throw Error('storage denied');})});expect((await load()).regularFont).toMatch(/^data:font\/woff2;base64,/);
});
it('completes a synchronous report template only at the prepared window boundary',async()=>{
 const {marcellReportHtml}=await import('./marcell-report.js');
 const raw='<html><head></head><body><p>marcell-report-font:regular</p><table><tr><td>R$ 1.234,56</td></tr></table></body></html>';
 const template=marcellReportHtml(raw);
 expect(template).toContain('url("marcell-report-font:regular")');
 expect(()=>marcellReportHtml(template,{requireFonts:true})).toThrow('fontes');
 await load();const complete=marcellReportHtml(template,{requireFonts:true});
 expect(complete).not.toContain('url("marcell-report-font:');
 expect(complete).toContain('<p>marcell-report-font:regular</p>');
 expect(complete).toContain('<td>R$ 1.234,56</td>');
 expect(marcellReportHtml(complete,{requireFonts:true})).toBe(complete);
});
