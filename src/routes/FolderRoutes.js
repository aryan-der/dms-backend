import express from "express";
import multer from "multer";

import {
  createFolder,
  uploadFolder,
  getFolderContent,
  uploadFile,
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

// Create folder
router.post("/", createFolder);

// Get content
router.get("/content", getFolderContent);

// Upload actual folder
router.post("/upload", upload.array("files"), uploadFolder);

// Upload single file
router.post("/upload-file", upload.single("file"), uploadFile);

export default router;
