export const scopedWorks = context => {
  const works = Array.isArray(context?.payload?.obras) ? context.payload.obras : [];
  return context?.user?.obraId
    ? works.filter(work => String(work.id) === String(context.user.obraId))
    : works;
};

export const knownWorkspace = work => ({
  driveId: String(work?.oneDriveDriveId || ""),
  folderId: String(work?.oneDriveFolderId || ""),
  folders: work?.oneDriveFolders && typeof work.oneDriveFolders === "object"
    ? work.oneDriveFolders
    : {},
});

export const findScopedWork = (context, request = {}) => {
  const works = scopedWorks(context);
  const id=String(request.obraId??'').trim();
  if(id)return works.find(work=>String(work.id)===id)||null;
  const name = String(request.obraName || "").trim().toLocaleLowerCase("pt-BR");
  // Um ID/nome inválido não pode cair silenciosamente em outra obra que
  // usa o mesmo drive. Drives corporativos normalmente contêm várias obras.
  const matches=name ? works.filter(work=>String(work.name||'').trim().toLocaleLowerCase('pt-BR')===name)
    : request.driveId ? works.filter(work=>String(work.oneDriveDriveId||'')===String(request.driveId)) : [];
  return matches.length===1?matches[0]:null;
};
