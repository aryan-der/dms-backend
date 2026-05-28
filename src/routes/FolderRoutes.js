import express from "express";
import multer from "multer";

import {
  createFolder,
  deleteItems,
  downloadItems,
  moveItems,
  updateFolder,
  uploadFolder,
} from "../controllers/folderController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(verifyToken);

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

router.post("/", createFolder);
router.post("/upload", upload.array("files"), uploadFolder);
router.put("/update-folder/:folderId", updateFolder);
router.delete("/delete-items", deleteItems);
router.put("/move-items", moveItems);
router.post("/download-items", downloadItems);

export default router;
