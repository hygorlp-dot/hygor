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
  const byId = request.obraId && works.find(work => String(work.id) === String(request.obraId));
  const byDrive = request.driveId && works.find(work =>
    String(work.oneDriveDriveId || "") === String(request.driveId));
  const name = String(request.obraName || "").trim().toLocaleLowerCase("pt-BR");
  const byName = name && works.find(work =>
    String(work.name || "").trim().toLocaleLowerCase("pt-BR") === name);
  return byId || byName || byDrive || null;
};
