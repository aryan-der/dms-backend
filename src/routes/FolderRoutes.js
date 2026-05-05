import express from "express";
import {
  createFolder,
  favoriteFolder,
  deleteFolder,
  renameFolder,
  moveFolder,
  addFolderComment,
  uploadFolder,
  downloadFolder,
} from "../controllers/folderController.js";

import { verifyToken } from "../middleware/authMiddleware.js"; // ✅ import middleware

const router = express.Router();

router.use(verifyToken);

// ✅ Create a new folder
router.post("/", createFolder);

// ⭐ Favorite or unfavorite a folder
router.patch("/:folderId/favorite", favoriteFolder);

// 🗑 Soft-delete a folder (move to trash)
router.delete("/:folderId", deleteFolder);

// ✏️ Rename a folder
router.patch("/:folderId/rename", renameFolder);

// 📁 Move a folder to another parent folder
router.patch("/:folderId/move", moveFolder);

// 💬 Add a comment to a folder
router.post("/:folderId/comments", addFolderComment);

// 📤 Upload folder (to implement)
router.post("/:folderId/upload", uploadFolder);

// 📥 Download folder (to implement)
router.get("/:folderId/download", downloadFolder);

export default router;
