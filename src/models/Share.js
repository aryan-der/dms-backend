// models/Share.js

import mongoose from "mongoose";

const shareSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    shareType: {
      type: String,
      enum: ["public", "private"],
      required: true,
    },

    // Shared folders
    folderIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Folder",
      },
    ],

    // Shared files
    fileIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "File",
      },
    ],

    passwordHash: {
      type: String,
      default: null,
    },

    emails: [
      {
        type: String,
      },
    ],

    phones: [
      {
        type: String,
      },
    ],

    allowDownload: {
      type: Boolean,
      default: true,
    },

    expiryDate: {
      type: Date,
      default: null,
    },

    accessCount: {
      type: Number,
      default: 0,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Share", shareSchema);
