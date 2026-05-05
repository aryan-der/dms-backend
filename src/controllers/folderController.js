import Folder from "../models/Folder.js";
// Make sure to import the File model if you have one
// For this example, let's assume it's in "../models/File.js"
// If you do not have a File model, you need to create one that relates files to folders
// import File from "../models/File.js";

export const createFolder = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { name, parentFolderId = null } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Folder name required" });
    }

    const existing = await Folder.findOne({
      ownerId,
      name,
      parentFolderId,
    });

    if (existing) {
      return res.status(400).json({ message: "Folder already exists" });
    }

    const folder = await Folder.create({
      ownerId,
      name,
      parentFolderId,
    });

    return res.status(201).json({ message: "Folder created", folder });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const favoriteFolder = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { folderId } = req.params;
    const folder = await Folder.findOne({
      _id: folderId,
      ownerId,
      isDeleted: false,
    });
    if (!folder) return res.status(404).json({ message: "Folder not found" });

    folder.isFavorite = !folder.isFavorite;
    await folder.save();

    return res.json({ message: "Favorite status updated", folder });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteFolder = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { folderId } = req.params;

    const folder = await Folder.findOneAndUpdate(
      { _id: folderId, ownerId, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() },
      { new: true },
    );

    if (!folder) return res.status(404).json({ message: "Folder not found" });
    return res.json({ message: "Folder moved to trash (30 days)", folder });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const renameFolder = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { folderId } = req.params;
    const { name } = req.body;

    const folder = await Folder.findOneAndUpdate(
      { _id: folderId, ownerId, isDeleted: false },
      { name },
      { new: true },
    );

    if (!folder) return res.status(404).json({ message: "Folder not found" });
    return res.json({ message: "Folder renamed", folder });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const moveFolder = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { folderId } = req.params;
    const { targetParentFolderId = null } = req.body;

    if (String(folderId) === String(targetParentFolderId)) {
      return res
        .status(400)
        .json({ message: "Cannot move folder into itself" });
    }

    const folder = await Folder.findOneAndUpdate(
      { _id: folderId, ownerId, isDeleted: false },
      { parentFolderId: targetParentFolderId },
      { new: true },
    );

    if (!folder) return res.status(404).json({ message: "Folder not found" });
    return res.json({ message: "Folder moved", folder });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const addFolderComment = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { folderId } = req.params;
    const { text } = req.body;

    const folder = await Folder.findOne({
      _id: folderId,
      ownerId,
      isDeleted: false,
    });
    if (!folder) return res.status(404).json({ message: "Folder not found" });

    folder.comments.push({ userId: ownerId, text });
    await folder.save();

    return res.status(201).json({ message: "Comment added", folder });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// New API: getFolderContent
// export const getFolderContent = async (req, res) => {
//   try {
//     const ownerId = req.user.id;
//     // You could filter by a parentFolderId if you want directory-like navigation
//     // e.g., /api/folders/:parentFolderId/content
//     // For now, we'll fetch ALL folders and files for this owner

//     // Get all non-deleted folders for the user
//     const folders = await Folder.find({ ownerId, isDeleted: false });

//     // Get all files for the user. Adjust filter if your File model relates to folders.
//     const files = await File.find({ ownerId, isDeleted: { $ne: true } });

//     return res.json({
//       message: "Folders and files fetched successfully",
//       folders,
//       files,
//     });
//   } catch (error) {
//     return res.status(500).json({ message: error.message });
//   }
// };

// uploadFolder and downloadFolder need multer/archiver + File model
export const uploadFolder = async (req, res) => {};
export const downloadFolder = async (req, res) => {};
