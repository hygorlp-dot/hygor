import {expect, it} from 'vitest';
import {documentPreviewType, isMicrosoftDocumentUrl, previewDocumentUrl} from './document-preview.js';

it('aceita originais HTTP e somente a rota relativa protegida de arquivo', () => {
  expect(previewDocumentUrl('https://example.com/nota.pdf')).toBe('https://example.com/nota.pdf');
  expect(previewDocumentUrl('/api/microsoft/onedrive?action=file&driveId=a&itemId=b&sig=c')).toContain('action=file&');
  for (const url of ['javascript:alert(1)','data:text/html,hi','blob:https://example.com/a','file:///C:/nota.pdf','//example.com/a.pdf','/api/data','/api/microsoft/onedrive?action=upload','https://user:password@example.com/a.pdf']) {
    expect(previewDocumentUrl(url)).toBeNull();
  }
});

it('identifica o formato por MIME ou nome sem executar XML, HTML ou SVG', () => {
  expect(documentPreviewType({nome:'nota.PDF'})).toBe('pdf');
  expect(documentPreviewType({tipo:'application/pdf',url:'https://example.com/file?id=1'})).toBe('pdf');
  expect(documentPreviewType({url:'https://example.com/foto.jpeg?download=1'})).toBe('image');
  expect(documentPreviewType({nome:'nfe.xml'})).toBe('xml');
  expect(documentPreviewType({nome:'malicioso.html',tipo:'text/html'})).toBe('unsupported');
  expect(documentPreviewType({nome:'desenho.svg',tipo:'image/svg+xml'})).toBe('unsupported');
});

it('resolve somente hosts Microsoft reconhecidos, sem aceitar domínios parecidos', () => {
  for (const url of ['https://tenant.sharepoint.com/a','https://onedrive.live.com/a','https://1drv.ms/a']) expect(isMicrosoftDocumentUrl(url)).toBe(true);
  for (const url of ['https://sharepoint.com.evil.test/a','https://evilsharepoint.com/a','/api/data']) expect(isMicrosoftDocumentUrl(url)).toBe(false);
});
