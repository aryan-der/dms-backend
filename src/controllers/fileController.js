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
