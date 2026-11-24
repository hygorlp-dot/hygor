import { createHash } from 'node:crypto';
import postcss from 'postcss';

export function visitCssStyles(source, file, visit) {
  const stylesheet = postcss.parse(source, { from: file });
  function inspect(node, property, value) {
    const selectors = [];
    const context = [];
    for (let parent = node.parent; parent.type !== 'root'; parent = parent.parent) {
      if (parent.type === 'rule') {
        selectors.unshift(parent.selector);
        context.unshift(parent.selector.trim().replace(/\s+/g, ' '));
      }
      if (parent.type === 'atrule') context.unshift(`@${parent.name} ${parent.params}`);
    }
    visit({ property, value, selectors, context, line: node.source.start.line });
  }
  stylesheet.walkDecls(node => inspect(node, node.prop, `${node.value}${node.important ? ' !important' : ''}`));
  stylesheet.walkAtRules('apply', node => inspect(node, '@apply', node.params));
}

export const legacyKey = signature => createHash('sha256').update(signature).digest('hex').slice(0, 16);

export function findOverrides(findings, existing = []) {
  const remaining = [...existing];
  return findings.filter(({ signature }) => {
    const index = remaining.indexOf(legacyKey(signature));
    if (index === -1) return true;
    remaining.splice(index, 1);
    return false;
  });
}
