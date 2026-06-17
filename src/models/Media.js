import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    originalName: {
      type: String,
    },

    // IMAGE or VIDEO only
    type: {
      type: String,
      enum: ["IMAGE", "VIDEO"],
      required: true,
    },

    mimeType: {
      type: String,
      required: true,
    },

    size: {
      type: Number,
      required: true,
    },

    // Physical storage path on disk
    path: {
      type: String,
      required: true,
    },

    // Media can live inside an existing folder, or be null (root gallery)
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
    },

    // Optional thumbnail (mainly for videos)
    thumbnailPath: {
      type: String,
      default: null,
    },

    width: {
      type: Number,
      default: null,
    },

    height: {
      type: Number,
      default: null,
    },

    // In seconds, for videos
    duration: {
      type: Number,
      default: null,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

mediaSchema.index({ ownerId: 1, folderId: 1, isDeleted: 1 });

export default mongoose.model("Media", mediaSchema);
