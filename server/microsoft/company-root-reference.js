// Owner URLs identify private personal-drive items without creating a share link.
export function personalRootReference(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.origin !== 'https://onedrive.live.com' || url.username || url.password) return null;
  const driveId = url.searchParams.get('cid');
  const itemId = url.searchParams.get('id');
  if (url.searchParams.getAll('cid').length !== 1 || url.searchParams.getAll('id').length !== 1
    || !/^[a-f0-9]{16}$/i.test(driveId || '') || !/^[a-f0-9]{16}![a-z0-9-]+$/i.test(itemId || '')
    || itemId.slice(0, 16).toUpperCase() !== driveId.toUpperCase()) return null;
  return {driveId: driveId.toUpperCase(), itemId: driveId.toUpperCase() + itemId.slice(16)};
}

export function sameRootReference(first, second) {
  if (first === second) return true;
  const a = personalRootReference(first), b = personalRootReference(second);
  return !!(a && b && a.driveId === b.driveId && a.itemId.toLowerCase() === b.itemId.toLowerCase());
}
