import mongoose from "mongoose";

const folderCommentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

const breadcrumbSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    id: { type: mongoose.Schema.Types.ObjectId, ref: "Folder", default: null },
  },
  { _id: false },
);

const folderSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    parentFolderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
      index: true,
    },
    isFavorite: { type: Boolean, default: false },
    comments: {
      type: [folderCommentSchema],
      default: [],
    },
    breadcrumb: {
      type: [breadcrumbSchema],
      default: [],
    },
    type: {
      type: String,
      required: true,
      enum: ["FOLDER", "FILE"],
      default: "FOLDER",
    },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// avoid duplicate folder names inside same parent for same owner
folderSchema.index(
  { ownerId: 1, parentFolderId: 1, name: 1 },
  { unique: true },
);

export default mongoose.model("Folder", folderSchema);
