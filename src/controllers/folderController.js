import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
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

// Move Folders / Files
export const moveItems = async (req, res) => {
  try {
    const ownerId = req.user.id;

    const {
      folderIds = [],
      fileIds = [],
      destinationFolderId = null,
    } = req.body;

    // Validation
    if (
      (!Array.isArray(folderIds) || folderIds.length === 0) &&
      (!Array.isArray(fileIds) || fileIds.length === 0)
    ) {
      return res.status(400).json({
        message: "At least one folder or file required",
      });
    }

    // Optional destination folder check
    if (destinationFolderId) {
      const destinationFolder = await Folder.findOne({
        _id: destinationFolderId,
        ownerId,
        isDeleted: false,
      });

      if (!destinationFolder) {
        return res.status(404).json({
          message: "Destination folder not found",
        });
      }
    }

    // Move folders
    if (folderIds.length > 0) {
      await Folder.updateMany(
        {
          _id: { $in: folderIds },
          ownerId,
          isDeleted: false,
        },
        {
          $set: {
            parentFolderId: destinationFolderId,
          },
        },
      );
    }

    // Move files
    if (fileIds.length > 0) {
      await File.updateMany(
        {
          _id: { $in: fileIds },
          ownerId,
          isDeleted: false,
        },
        {
          $set: {
            folderId: destinationFolderId,
          },
        },
      );
    }

    return res.status(200).json({
      message: "Items moved successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// Download folders / files
export const downloadItems = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { folderIds = [], fileIds = [] } = req.body;

    if (folderIds.length === 0 && fileIds.length === 0) {
      return res.status(400).json({ message: "No items selected" });
    }

    let filesToDownload = [];

    // Recursive folder scan
    const collectFolderFiles = async (folderId, relativePath = "") => {
      const files = await File.find({ folderId, ownerId, isDeleted: false });

      for (const file of files) {
        filesToDownload.push({
          ...file.toObject(),
          zipPath: relativePath
            ? path.join(relativePath, file.name)
            : file.name,
        });
      }

      const childFolders = await Folder.find({
        parentFolderId: folderId,
        ownerId,
        isDeleted: false,
      });

      for (const child of childFolders) {
        await collectFolderFiles(
          child._id,
          path.join(relativePath, child.name),
        );
      }
    };

    // Collect files from folders
    for (const folderId of folderIds) {
      const folder = await Folder.findById(folderId);
      const rootName = folder ? folder.name : String(folderId);
      await collectFolderFiles(folderId, rootName);
    }

    // Direct selected files
    const selectedFiles = await File.find({
      _id: { $in: fileIds },
      ownerId,
      isDeleted: false,
    });

    for (const file of selectedFiles) {
      filesToDownload.push({ ...file.toObject(), zipPath: file.name });
    }

    // Remove duplicates
    const seen = new Map();
    for (const f of filesToDownload) {
      if (!seen.has(f._id.toString())) seen.set(f._id.toString(), f);
    }
    const uniqueFiles = [...seen.values()];

    // Single file direct download
    if (uniqueFiles.length === 1 && folderIds.length === 0) {
      const file = uniqueFiles[0];
      return res.download(file.path, file.name);
    }

    // ZIP download using adm-zip
    const zip = new AdmZip();

    for (const file of uniqueFiles) {
      if (fs.existsSync(file.path)) {
        const fileData = fs.readFileSync(file.path);
        const zipDir = path.dirname(file.zipPath); // preserves folder structure
        zip.addFile(file.zipPath, fileData, "", zipDir === "." ? "" : zipDir);
      }
    }

    const zipBuffer = zip.toBuffer();

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="download.zip"`);
    res.setHeader("Content-Length", zipBuffer.length);
    return res.end(zipBuffer);
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({ message: error.message });
    }
  }
};
