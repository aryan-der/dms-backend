import express from "express";
import multer from "multer";

import {
  accessShare,
  createFolder,
  deleteItems,
  downloadItems,
  moveItems,
  shareItems,
  updateFolder,
  uploadFolder,
} from "../controllers/folderController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },

  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
});

router.post("/", verifyToken, createFolder);
router.post("/upload", upload.array("files"), verifyToken, uploadFolder);
router.put("/update-folder/:folderId", verifyToken, updateFolder);
router.delete("/delete-items", verifyToken, deleteItems);
router.put("/move-items", verifyToken, moveItems);
router.post("/download-items", verifyToken, downloadItems);
router.post("/share", verifyToken, shareItems);
router.post("/share/:token/access", accessShare);

export default router;
