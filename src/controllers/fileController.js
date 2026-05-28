import fs from "fs";
import path from "path";
import File from "../models/File.js";
import Folder from "../models/Folder.js";

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

// File Viewer
export const viewFile = async (req, res) => {
  try {
    const ownerId = req.user.id;

    const fileId = req.params.id;

    // Find file
    const file = await File.findOne({
      _id: fileId,
      ownerId,
      isDeleted: false,
    });

    if (!file) {
      return res.status(404).json({
        message: "File not found",
      });
    }

    // Physical path
    const filePath = path.resolve(file.path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        message: "Physical file missing",
      });
    }

    const stat = fs.statSync(filePath);

    const fileSize = stat.size;

    const range = req.headers.range;

    // VERY IMPORTANT FOR PDF.js
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");

      const start = parseInt(parts[0], 10);

      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      const chunkSize = end - start + 1;

      const stream = fs.createReadStream(filePath, {
        start,
        end,
      });

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Access-Control-Expose-Headers":
          "Accept-Ranges, Content-Length, Content-Range",
      });

      stream.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Access-Control-Expose-Headers":
          "Accept-Ranges, Content-Length, Content-Range",
      });

      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// Update File
export const updateFile = async (req, res) => {
  try {
    const ownerId = req.user.id;

    const { fileId } = req.params;

    const { name } = req.body;

    if (!fileId) {
      return res.status(400).json({
        message: "File id required",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "File name required",
      });
    }

    const file = await File.findOne({
      _id: fileId,
      ownerId,
      isDeleted: false,
    });

    if (!file) {
      return res.status(404).json({
        message: "File not found",
      });
    }

    // Duplicate check
    const existingFile = await File.findOne({
      _id: { $ne: fileId },
      ownerId,
      parentFolderId: file.parentFolderId,
      name: name.trim(),
      isDeleted: false,
    });

    if (existingFile) {
      return res.status(400).json({
        message: "File with same name already exists",
      });
    }

    file.name = name.trim();

    await file.save();

    return res.status(200).json({
      message: "File updated successfully",
      file,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const deleteFiles = async (req, res) => {
  try {
    const ownerId = req.user.id;

    // Support both single ID (param or body) and multiple IDs (body)
    let fileIds;

    if (req.body.fileIds !== undefined) {
      // Received in body: array or single ID
      if (Array.isArray(req.body.fileIds)) {
        fileIds = req.body.fileIds;
      } else if (req.body.fileIds) {
        fileIds = [req.body.fileIds];
      } else {
        fileIds = [];
      }
    } else if (req.params.fileId) {
      // Received in URL param
      fileIds = [req.params.fileId];
    } else {
      fileIds = [];
    }

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({
        message:
          "At least one fileId must be provided (in fileIds[] or as fileId param)",
      });
    }

    const result = await File.updateMany(
      {
        _id: { $in: fileIds },
        ownerId,
        isDeleted: false,
      },
      {
        $set: {
          isDeleted: true,
        },
      },
    );

    return res.status(200).json({
      message: "File(s) deleted successfully",
      modifiedCount: result.nModified ?? result.modifiedCount,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};
