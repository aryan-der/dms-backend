import Folder from "../models/Folder.js";
import File from "../models/File.js";

export const getAllFolderContents = async (
  parentFolderId,
  folders = [],
  files = [],
) => {
  const childFolders = await Folder.find({
    parentFolderId,
    isDeleted: false,
  });

  const childFiles = await File.find({
    folderId: parentFolderId,
    isDeleted: { $ne: true },
  });

  folders.push(...childFolders);
  files.push(...childFiles);

  for (const folder of childFolders) {
    await getAllFolderContents(folder._id, folders, files);
  }

  return {
    folders,
    files,
  };
};
