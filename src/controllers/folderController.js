import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import File from "../models/File.js";
import Folder from "../models/Folder.js";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import dayjs from "dayjs";
import Share from "../models/Share.js";
import { sendShareEmail } from "../utils/sendEmail.js";
import { getAllFolderContents } from "../utils/folderUtils.js";

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
export const deleteItems = async (req, res) => {
  try {
    const ownerId = req.user.id;

    let { folderIds = [], fileIds = [] } = req.body;

    // Single support
    if (!Array.isArray(folderIds)) {
      folderIds = folderIds ? [folderIds] : [];
    }

    if (!Array.isArray(fileIds)) {
      fileIds = fileIds ? [fileIds] : [];
    }

    // Nothing selected
    if (folderIds.length === 0 && fileIds.length === 0) {
      return res.status(400).json({
        message: "folderIds or fileIds required",
      });
    }

    /* DELETE PHYSICAL FILE */
    const deletePhysicalFile = (filePath) => {
      try {
        if (!filePath) return;

        const fullPath = path.join(process.cwd(), filePath);

        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (error) {
        console.log("Physical file delete error:", error.message);
      }
    };

    /* DELETE FOLDER RECURSIVELY */
    const deleteFolderRecursively = async (currentFolderId) => {
      // Child folders
      const childFolders = await Folder.find({
        parentFolderId: currentFolderId,
        ownerId,
        isDeleted: false,
      });

      // Recursive delete
      for (const child of childFolders) {
        await deleteFolderRecursively(child._id);
      }

      // Files inside current folder
      const files = await File.find({
        folderId: currentFolderId,
        ownerId,
        isDeleted: false,
      });

      // Delete physical files
      for (const file of files) {
        deletePhysicalFile(file.path);
      }

      // Delete files from DB
      await File.deleteMany({
        folderId: currentFolderId,
        ownerId,
      });

      // Delete folder from DB
      await Folder.findByIdAndDelete(currentFolderId);
    };

    /* DELETE SELECTED FOLDERS */
    for (const folderId of folderIds) {
      const folder = await Folder.findOne({
        _id: folderId,
        ownerId,
      });

      if (!folder) continue;

      await deleteFolderRecursively(folderId);
    }

    /* DELETE SELECTED FILES */
    if (fileIds.length > 0) {
      const files = await File.find({
        _id: { $in: fileIds },
        ownerId,
      });

      // Delete physical files
      for (const file of files) {
        deletePhysicalFile(file.path);
      }

      // Delete from DB
      await File.deleteMany({
        _id: { $in: fileIds },
        ownerId,
      });
    }

    return res.status(200).json({
      message: "Selected items deleted successfully",
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

// Share
export const shareItems = async (req, res) => {
  try {
    const {
      folderIds = [],
      fileIds = [],
      shareType,
      password,
      emails = [],
      phones = [],
      allowDownload = true,
      expiryDays = 7,
    } = req.body;

    if (folderIds.length === 0 && fileIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one file or folder",
      });
    }

    if (!["public", "private"].includes(shareType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid share type",
      });
    }

    if (shareType === "private" && !password) {
      return res.status(400).json({
        success: false,
        message: "Password is required for private sharing",
      });
    }

    const token = nanoid(32);
    const shareData = {
      token,
      shareType,
      folderIds,
      fileIds,
      emails,
      phones,
      allowDownload,
      createdBy: req.user.id,
    };

    if (expiryDays) {
      shareData.expiryDate = dayjs().add(expiryDays, "day").toDate();
    }

    if (shareType === "private") {
      shareData.passwordHash = await bcrypt.hash(password, 10);
    }
    const share = await Share.create(shareData);

    const shareUrl = `${process.env.CLIENT_URL}/share/${token}`;

    // Email block
    if (emails.length) {
      const emailPromises = emails.map((email) =>
        sendShareEmail({
          to: email,
          link: shareUrl,
          password: shareType === "private" ? password : null,
          expiryDays,
        }).catch((err) => console.error(`Email failed for ${email}:`, err)),
      );

      await Promise.all(emailPromises);
    }

    const whatsappLinks = [];
    if (shareType === "private" && phones.length) {
      for (const phone of phones) {
        const message = `A secure file has been shared with you. Link:${shareUrl} Password: ${password} `;
        whatsappLinks.push({
          phone,
          url: `https://wa.me/${phone.replace(
            /\+/g,
            "",
          )}?text=${encodeURIComponent(message)}`,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Items shared successfully",

      share: {
        id: share._id,
        token,
        shareType,
        shareUrl,
        expiryDate: share.expiryDate,
      },
      whatsappLinks,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to share items",
    });
  }
};

// Access Share
export const accessShare = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    const share = await Share.findOne({ token })
      .populate("fileIds")
      .populate("folderIds");

    if (!share) {
      return res.status(404).json({
        success: false,
        message: "Share link not found",
      });
    }

    // Expiry Check
    if (share.expiryDate && dayjs().isAfter(share.expiryDate)) {
      return res.status(410).json({
        success: false,
        message: "This share link has expired",
      });
    }

    // Password Check
    if (share.shareType === "private") {
      if (!password) {
        return res.status(401).json({
          success: false,
          message: "Password is required",
        });
      }

      const isValid = bcrypt.compareSync(password, share.passwordHash);

      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: "Incorrect password",
        });
      }
    }

    // ==========================
    // Shared Files & Folders
    // ==========================

    let allFolders = [...share.folderIds];
    let allFiles = [...share.fileIds];

    // Shared folders ni andar na folders/files
    for (const folder of share.folderIds) {
      const nestedData = await getAllFolderContents(folder._id);

      allFolders.push(...nestedData.folders);
      allFiles.push(...nestedData.files);
    }

    // Remove Duplicate Folders
    allFolders = [
      ...new Map(
        allFolders.map((folder) => [folder._id.toString(), folder]),
      ).values(),
    ];

    // Remove Duplicate Files
    allFiles = [
      ...new Map(allFiles.map((file) => [file._id.toString(), file])).values(),
    ];

    return res.status(200).json({
      success: true,
      allowDownload: share.allowDownload,
      files: allFiles,
      folders: allFolders,
      directFileIds: share.fileIds.map((file) => file._id.toString()),
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};