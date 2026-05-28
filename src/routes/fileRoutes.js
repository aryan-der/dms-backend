import express from "express";
import multer from "multer";
import {
  uploadFile,
  viewFile,
  updateFile,
  deleteFiles,
} from "../controllers/fileController.js";
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

// Upload single file
router.post("/upload", upload.single("file"), uploadFile);
router.get("/view/:id", viewFile);
router.put("/update-file/:fileId", updateFile);
router.delete("/delete-file", deleteFiles);

export default router;
