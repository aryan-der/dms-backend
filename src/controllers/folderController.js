import File from "../models/File.js";
import Folder from "../models/Folder.js";

/* CREATE FOLDER */
export const createFolder = async (req, res) => {
  try {
    const ownerId = req.user.id;

    const { name, parentFolderId = null } = req.body;

    if (!name) {
      return res.status(400).json({
        message: "Folder name required",
      });
    }

    // Duplicate check
    const existing = await Folder.findOne({
      ownerId,
      name,
      parentFolderId,
      isDeleted: false,
    });

    if (existing) {
      return res.status(400).json({
        message: "Folder already exists",
      });
    }

    const folder = await Folder.create({
      ownerId,
      name,
      parentFolderId,
      type: "FOLDER",
    });

    return res.status(201).json({
      message: "Folder created",
      folder,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

/* UPLOAD FOLDER */
export const uploadFolder = async (req, res) => {
  try {
    const ownerId = req.user.id;

    const uploadedFiles = req.files;

    const paths = Array.isArray(req.body.paths)
      ? req.body.paths
      : [req.body.paths];

    const parentFolderId = req.body.parentFolderId || null;

    if (!uploadedFiles?.length) {
      return res.status(400).json({
        message: "No files uploaded",
      });
    }

    // Validation
    if (uploadedFiles.length !== paths.length) {
      return res.status(400).json({
        message: "Files and paths count mismatch",
      });
    }

    // Folder cache
    const createdFoldersMap = {};

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];

      const relativePath = paths[i];

      if (!relativePath) {
        continue;
      }

      // Support windows + linux paths
      const pathParts = relativePath.split(/[\\/]/);

      const fileName = pathParts.pop();

      let currentParentId = parentFolderId;

      let currentPath = "";

      // Create folders recursively
      for (const folderName of pathParts) {
        currentPath += `/${folderName}`;

        // Already cached
        if (createdFoldersMap[currentPath]) {
          currentParentId = createdFoldersMap[currentPath];

          continue;
        }

        // Check existing folder
        let folder = await Folder.findOne({
          ownerId,
          name: folderName,
          parentFolderId: currentParentId,
          isDeleted: false,
        });

        // Create if not exists
        if (!folder) {
          folder = await Folder.create({
            ownerId,
            name: folderName,
            parentFolderId: currentParentId,
            type: "FOLDER",
          });
        }

        // Cache folder
        createdFoldersMap[currentPath] = folder._id;

        currentParentId = folder._id;
      }

      // Duplicate file check
      const existingFile = await File.findOne({
        ownerId,
        folderId: currentParentId,
        name: fileName,
        isDeleted: false,
      });

      // Skip duplicate file
      if (existingFile) {
        continue;
      }

      // Create file
      await File.create({
        ownerId,
        name: fileName,
        folderId: currentParentId,
        type: "FILE",
        mimeType: file.mimetype,
        size: file.size,
        path: file.path,
        originalName: file.originalname,
      });
    }

    return res.status(201).json({
      message: "Folder uploaded successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

/*  UPLOAD FILE */
export const uploadFile = async (req, res) => {
  try {
    const ownerId = req.user.id;

    const { folderId = null } = req.body;

    const file = req.file;

    if (!file) {
      return res.status(400).json({
        message: "No file uploaded",
      });
    }

    // Validate folder
    if (folderId) {
      const folder = await Folder.findOne({
        _id: folderId,
        ownerId,
        isDeleted: false,
        type: "FOLDER",
      });

      if (!folder) {
        return res.status(404).json({
          message: "Parent folder not found",
        });
      }
    }

    // Duplicate check
    const existing = await File.findOne({
      ownerId,
      folderId,
      name: file.originalname,
      isDeleted: false,
    });

    if (existing) {
      return res.status(400).json({
        message: "File with this name already exists",
      });
    }

    const newFile = await File.create({
      ownerId,
      name: file.originalname,
      folderId,
      type: "FILE",
      mimeType: file.mimetype,
      size: file.size,
      path: file.path,
      originalName: file.originalname,
    });

    return res.status(201).json({
      message: "File uploaded successfully",
      file: newFile,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

/* GET FOLDER CONTENT */
export const getFolderContent = async (req, res) => {
  try {
    const ownerId = req.user.id;

    const { parentFolderId } = req.query;

    const currentParentFolderId = parentFolderId || null;

    // Folders
    const folders = await Folder.find({
      ownerId,
      parentFolderId: currentParentFolderId,
      isDeleted: false,
    });

    // Files
    const files = await File.find({
      ownerId,
      folderId: currentParentFolderId,
      isDeleted: { $ne: true },
    });

    return res.json({
      message: "Folder content fetched successfully",
      data: {
        folders,
        files,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};
