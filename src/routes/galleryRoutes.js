import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { authMiddleware } from "../middlewares/authMiddleware.js"; // adjust to your actual auth middleware path/name
import {
  uploadMedia,
  updateMedia,
  deleteMedia,
  moveMedia,
  downloadMedia,
  shareMedia,
  accessMediaShare,
  getGalleryItems,
} from "../controllers/galleryController.js";

const router = express.Router();

const MEDIA_UPLOAD_DIR = "uploads/media";
if (!fs.existsSync(MEDIA_UPLOAD_DIR)) {
  fs.mkdirSync(MEDIA_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, MEDIA_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9,
    )}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const isMedia = /^image\/|^video\//.test(file.mimetype);

  if (isMedia) {
    cb(null, true);
  } else {
    cb(new Error("Only image and video files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024,
  },
});

router.get("/", authMiddleware, getGalleryItems);
router.post("/upload", authMiddleware, upload.array("media", 20), uploadMedia);
router.patch("/:mediaId", authMiddleware, updateMedia);
router.delete("/", authMiddleware, deleteMedia);
router.post("/move", authMiddleware, moveMedia);
router.post("/download", authMiddleware, downloadMedia);
router.post("/share", authMiddleware, shareMedia);

router.post("/share/:token", accessMediaShare);

export default router;
