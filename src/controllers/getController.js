import mongoose from "mongoose";
import File from "../models/File.js";
import Folder from "../models/Folder.js";
import Share from "../models/Share.js";
import dayjs from "dayjs";

/* GET FOLDER CONTENT */
export const getFolderContent = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { parentFolderId } = req.query;

    const currentParentFolderId = parentFolderId
      ? new mongoose.Types.ObjectId(parentFolderId)
      : null;

    // Just read breadcrumb stored on the folder itself
    let breadcrumb = [{ name: "Home", id: null }];

    if (parentFolderId) {
      const currentFolder = await Folder.findById(parentFolderId);

      if (currentFolder) {
        // ✅ DB no breadcrumb + current folder = full path
        breadcrumb = [
          ...(currentFolder.breadcrumb?.length
            ? currentFolder.breadcrumb
            : [{ name: "Home", id: null }]),
          {
            name: currentFolder.name,
            id: currentFolder._id,
          },
        ];
      }
    }

    const folders = await Folder.find({
      ownerId,
      parentFolderId: currentParentFolderId,
      isDeleted: false,
    });

    const files = await File.find({
      ownerId,
      folderId: currentParentFolderId,
      isDeleted: { $ne: true },
    });

    return res.json({
      message: "Folder content fetched successfully",
      data: {
        folders,
        files,
        breadcrumb,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// Share
export const getShareInfo = async (req, res) => {
  try {
    const { token } = req.params;

    const share = await Share.findOne({ token });

    if (!share) {
      return res.status(404).json({
        success: false,
        message: "Share link not found or expired",
      });
    }

    // Expiry check
    if (share.expiryDate && dayjs().isAfter(share.expiryDate)) {
      return res.status(410).json({
        success: false,
        message: "This share link has expired",
      });
    }

    return res.status(200).json({
      success: true,
      shareType: share.shareType,
      allowDownload: share.allowDownload,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};
