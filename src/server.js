import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import loginRoutes from "./routes/loginRoutes.js";
import folderRoutes from "./routes/FolderRoutes.js";
import { connectDB } from "./config/db.js";

dotenv.config();

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/Auth", authRoutes);
app.use("/api/Login", loginRoutes);
app.use("/api/folders", folderRoutes);
app.use("/api/files", folderRoutes);
app.get("/", (req, res) => {
  res.send("API Running 🚀");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
