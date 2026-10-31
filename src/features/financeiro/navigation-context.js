// Keep the existing scroll containers: a finance panel can live inside the app's
// scrolling main region rather than in the browser window.
export function captureFinancePosition(element) {
  const positions = [];
  for (let node = element; node; node = node.parentElement) {
    positions.push({node, top: node.scrollTop, left: node.scrollLeft});
  }
  return positions;
}

export function restoreFinancePosition(positions = []) {
  for (const {node, top, left} of positions) {
    if (!node.isConnected) continue;
    node.scrollTop = top;
    node.scrollLeft = left;
  }
}
