import { lazy } from 'react';

const pendingStyles = new WeakMap();
const cssFailure = error => String(error?.message || '').match(/^Unable to preload CSS for (.+)$/)?.[1];

function retryStyle(url, document) {
  let pending = pendingStyles.get(document);
  if (!pending) pendingStyles.set(document, pending = new Map());
  if (pending.has(url.href)) return pending.get(url.href);
  const task = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    const original = [...document.querySelectorAll('link[rel="stylesheet"]')].find(item => item.href === url.href);
    if (original?.nonce) link.nonce = original.nonce;
    link.rel = 'stylesheet';
    link.dataset.arcdCssRetry = 'true';
    const fresh = new URL(url);
    fresh.searchParams.set('_arcd_css_retry', Date.now().toString());
    link.href = fresh.href;
    const finish = error => {
      clearTimeout(timer);
      link.onload = link.onerror = null;
      if (error) { link.remove(); reject(error); }
      else resolve();
    };
    const timer = setTimeout(() => finish(new Error('CSS retry timed out')), 8000);
    link.onload = () => finish();
    link.onerror = () => finish(new Error('CSS retry failed'));
    document.head.append(link);
  });
  pending.set(url.href, task);
  task.then(() => pending.delete(url.href), () => pending.delete(url.href));
  return task;
}

export async function importWithCssRetry(load, document = globalThis.document) {
  try { return await load(); }
  catch (error) {
    const failed = cssFailure(error);
    if (!failed || !document) throw error;
    try {
      const url = new URL(failed, document.baseURI);
      const localCss = item => item.origin === new URL(document.baseURI).origin && item.pathname.startsWith('/assets/') && item.pathname.endsWith('.css');
      if (!localCss(url)) throw error;
      // Vite marca TODAS as dependências como vistas antes de aguardar o CSS.
      // Repetir apenas import() abriria o módulo sem as demais folhas que falharam.
      const styles = new Map([[url.href, url]]);
      for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
        const candidate = new URL(link.href);
        if (!link.sheet && !link.dataset.arcdCssRetry && localCss(candidate)) styles.set(candidate.href, candidate);
      }
      await Promise.all([...styles.values()].map(style => retryStyle(style, document)));
    } catch { throw error; }
    // Só uma repetição; erros de JS e falhas persistentes chegam ao boundary.
    return load();
  }
}

export const lazyWithCssRetry = load => lazy(() => importWithCssRetry(load));
