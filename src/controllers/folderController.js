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

    let breadcrumb = [
      {
        name: "Home",
        id: null,
      },
    ];

    if (parentFolderId) {
      const parentFolder = await Folder.findById(parentFolderId);

      if (parentFolder) {
        breadcrumb = [
          ...parentFolder.breadcrumb,
          {
            name: parentFolder.name,
            id: parentFolder._id,
          },
        ];
      }
    }

    const folder = await Folder.create({
      ownerId,
      name,
      parentFolderId,
      breadcrumb,
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
      // Create folders recursively
      for (const folderName of pathParts) {
        currentPath += `/${folderName}`;

        if (createdFoldersMap[currentPath]) {
          currentParentId = createdFoldersMap[currentPath];
          continue;
        }

        // ✅ FIX: currentParentId use karo, parentFolderId nahi
        let breadcrumb = [{ name: "Home", id: null }];

        if (currentParentId) {
          const parentFolder = await Folder.findById(currentParentId);

          if (parentFolder) {
            breadcrumb = [
              ...(parentFolder.breadcrumb?.length
                ? parentFolder.breadcrumb
                : [{ name: "Home", id: null }]),
              {
                name: parentFolder.name,
                id: parentFolder._id,
              },
            ];
          }
        }

        let folder = await Folder.findOne({
          ownerId,
          name: folderName,
          parentFolderId: currentParentId,
          isDeleted: false,
        });

        if (!folder) {
          folder = await Folder.create({
            ownerId,
            name: folderName,
            parentFolderId: currentParentId,
            type: "FOLDER",
            breadcrumb,
          });
        }

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

/* UPDATE FOLDER */
export const updateFolder = async (req, res) => {
  try {
    const ownerId = req.user.id;

    const { folderId } = req.params;

    const { name } = req.body;

    if (!folderId) {
      return res.status(400).json({
        message: "Folder id required",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Folder name required",
      });
    }

    const folder = await Folder.findOne({
      _id: folderId,
      ownerId,
      isDeleted: false,
    });

    if (!folder) {
      return res.status(404).json({
        message: "Folder not found",
      });
    }

    // Duplicate check
    const existingFolder = await Folder.findOne({
      _id: { $ne: folderId },
      ownerId,
      parentFolderId: folder.parentFolderId,
      name: name.trim(),
      isDeleted: false,
    });

    if (existingFolder) {
      return res.status(400).json({
        message: "Folder with same name already exists",
      });
    }

    folder.name = name.trim();

    await folder.save();

    return res.status(200).json({
      message: "Folder updated successfully",
      folder,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

/* DELETE FOLDERS */
export const deleteFolders = async (req, res) => {
  try {
    const ownerId = req.user.id;

    const { folderIds } = req.body;

    if (!Array.isArray(folderIds) || folderIds.length === 0) {
      return res.status(400).json({
        message: "folderIds array required",
      });
    }

    // Recursive delete function
    const deleteFolderRecursively = async (currentFolderId) => {
      // Find child folders
      const childFolders = await Folder.find({
        parentFolderId: currentFolderId,
        ownerId,
        isDeleted: false,
      });

      // Delete child folders recursively
      for (const child of childFolders) {
        await deleteFolderRecursively(child._id);
      }

      // Delete files
      await File.updateMany(
        {
          folderId: currentFolderId,
          ownerId,
          isDeleted: false,
        },
        {
          $set: {
            isDeleted: true,
          },
        },
      );

      // Delete folder
      await Folder.findByIdAndUpdate(currentFolderId, {
        $set: {
          isDeleted: true,
        },
      });
    };

    // Delete all selected folders
    for (const folderId of folderIds) {
      const folder = await Folder.findOne({
        _id: folderId,
        ownerId,
        isDeleted: false,
      });

      if (!folder) {
        continue;
      }

      await deleteFolderRecursively(folderId);
    }

    return res.status(200).json({
      message: "Folders deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};
