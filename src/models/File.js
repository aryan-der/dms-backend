import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["FILE"],
      default: "FILE",
    },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    path: { type: String, required: true },
    originalName: { type: String, required: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// avoid duplicate file names inside same folder for same owner
fileSchema.index({ ownerId: 1, folderId: 1, name: 1 }, { unique: true });

export default mongoose.model("File", fileSchema);
