import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import dayjs from "dayjs";
import Media from "../models/Media.js";
import Folder from "../models/Folder.js";
import Share from "../models/Share.js";
import { sendShareEmail } from "../utils/sendEmail.js";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
];

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-matroska",
  "video/avi",
];

const getMediaType = (mimeType) => {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return "IMAGE";
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return "VIDEO";
  return null;
};

const deletePhysicalFile = (filePath) => {
  try {
    if (!filePath) return;

    const fullPath = path.join(process.cwd(), filePath);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (error) {
    console.log("Physical media delete error:", error.message);
  }
};

/* UPLOAD MEDIA (images + videos only) */
export const uploadMedia = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const uploadedFiles = req.files;
    const { folderId = null } = req.body;

    if (!uploadedFiles?.length) {
      return res.status(400).json({
        message: "No media files uploaded",
      });
    }

    // Validate destination folder if one was passed
    if (folderId) {
      const folder = await Folder.findOne({
        _id: folderId,
        ownerId,
        isDeleted: false,
      });

      if (!folder) {
        return res.status(404).json({
          message: "Destination folder not found",
        });
      }
    }

    const createdMedia = [];
    const rejectedFiles = [];

    for (const file of uploadedFiles) {
      const mediaType = getMediaType(file.mimetype);

      // Reject anything that isn't an image or video
      if (!mediaType) {
        deletePhysicalFile(file.path);
        rejectedFiles.push(file.originalname);
        continue;
      }

      // Duplicate check (same name in same folder)
      const existing = await Media.findOne({
        ownerId,
        folderId,
        name: file.originalname,
        isDeleted: false,
      });

      if (existing) {
        deletePhysicalFile(file.path);
        continue;
      }

      const media = await Media.create({
        ownerId,
        name: file.originalname,
        originalName: file.originalname,
        type: mediaType,
        mimeType: file.mimetype,
        size: file.size,
        path: file.path,
        folderId,
      });

      createdMedia.push(media);
    }

    return res.status(201).json({
      message: "Media uploaded successfully",
      media: createdMedia,
      rejectedFiles,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

/* UPDATE MEDIA (rename) */
export const updateMedia = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { mediaId } = req.params;
    const { name } = req.body;

    if (!mediaId) {
      return res.status(400).json({
        message: "Media id required",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Media name required",
      });
    }

    const media = await Media.findOne({
      _id: mediaId,
      ownerId,
      isDeleted: false,
    });

    if (!media) {
      return res.status(404).json({
        message: "Media not found",
      });
    }

    // Duplicate check
    const existing = await Media.findOne({
      _id: { $ne: mediaId },
      ownerId,
      folderId: media.folderId,
      name: name.trim(),
      isDeleted: false,
    });

    if (existing) {
      return res.status(400).json({
        message: "Media with same name already exists",
      });
    }

    media.name = name.trim();

    await media.save();

    return res.status(200).json({
      message: "Media updated successfully",
      media,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

/* DELETE MEDIA */
export const deleteMedia = async (req, res) => {
  try {
    const ownerId = req.user.id;
    let { mediaIds = [] } = req.body;

    if (!Array.isArray(mediaIds)) {
      mediaIds = mediaIds ? [mediaIds] : [];
    }

    if (mediaIds.length === 0) {
      return res.status(400).json({
        message: "mediaIds required",
      });
    }

    const mediaItems = await Media.find({
      _id: { $in: mediaIds },
      ownerId,
    });

    // Remove physical files + thumbnails
    for (const item of mediaItems) {
      deletePhysicalFile(item.path);
      deletePhysicalFile(item.thumbnailPath);
    }

    await Media.deleteMany({
      _id: { $in: mediaIds },
      ownerId,
    });

    return res.status(200).json({
      message: "Selected media deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

/* MOVE MEDIA */
export const moveMedia = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { mediaIds = [], destinationFolderId = null } = req.body;

    if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
      return res.status(400).json({
        message: "At least one media item required",
      });
    }

    // Optional destination folder check
    if (destinationFolderId) {
      const destinationFolder = await Folder.findOne({
        _id: destinationFolderId,
        ownerId,
        isDeleted: false,
      });

      if (!destinationFolder) {
        return res.status(404).json({
          message: "Destination folder not found",
        });
      }
    }

    await Media.updateMany(
      {
        _id: { $in: mediaIds },
        ownerId,
        isDeleted: false,
      },
      {
        $set: {
          folderId: destinationFolderId,
        },
      },
    );

    return res.status(200).json({
      message: "Media moved successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

/* DOWNLOAD MEDIA (single file or zip) */
export const downloadMedia = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { mediaIds = [] } = req.body;

    if (!mediaIds.length) {
      return res.status(400).json({
        message: "No media selected",
      });
    }

    const mediaItems = await Media.find({
      _id: { $in: mediaIds },
      ownerId,
      isDeleted: false,
    });

    if (!mediaItems.length) {
      return res.status(404).json({
        message: "Media not found",
      });
    }

    // Single file direct download
    if (mediaItems.length === 1) {
      const media = mediaItems[0];
      return res.download(media.path, media.name);
    }

    // ZIP download for multiple items
    const zip = new AdmZip();

    for (const media of mediaItems) {
      if (fs.existsSync(media.path)) {
        const fileData = fs.readFileSync(media.path);
        zip.addFile(media.name, fileData);
      }
    }

    const zipBuffer = zip.toBuffer();

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="gallery.zip"`);
    res.setHeader("Content-Length", zipBuffer.length);
    return res.end(zipBuffer);
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({ message: error.message });
    }
  }
};

/* SHARE MEDIA */
export const shareMedia = async (req, res) => {
  try {
    const {
      mediaIds = [],
      shareType,
      password,
      emails = [],
      phones = [],
      allowDownload = true,
      expiryDays = 7,
    } = req.body;

    if (mediaIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one media item",
      });
    }

    if (!["public", "private"].includes(shareType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid share type",
      });
    }

    if (shareType === "private" && !password) {
      return res.status(400).json({
        success: false,
        message: "Password is required for private sharing",
      });
    }

    const token = nanoid(32);
    const shareData = {
      token,
      shareType,
      mediaIds,
      emails,
      phones,
      allowDownload,
      createdBy: req.user.id,
    };

    if (expiryDays) {
      shareData.expiryDate = dayjs().add(expiryDays, "day").toDate();
    }

    if (shareType === "private") {
      shareData.passwordHash = await bcrypt.hash(password, 10);
    }

    const share = await Share.create(shareData);

    const shareUrl = `${process.env.CLIENT_URL}/share/${token}`;

    // Email block
    if (emails.length) {
      const emailPromises = emails.map((email) =>
        sendShareEmail({
          to: email,
          link: shareUrl,
          password: shareType === "private" ? password : null,
          expiryDays,
        }).catch((err) => console.error(`Email failed for ${email}:`, err)),
      );

      await Promise.all(emailPromises);
    }

    const whatsappLinks = [];
    if (shareType === "private" && phones.length) {
      for (const phone of phones) {
        const message = `A secure media file has been shared with you. Link:${shareUrl} Password: ${password} `;
        whatsappLinks.push({
          phone,
          url: `https://wa.me/${phone.replace(
            /\+/g,
            "",
          )}?text=${encodeURIComponent(message)}`,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Media shared successfully",

      share: {
        id: share._id,
        token,
        shareType,
        shareUrl,
        expiryDate: share.expiryDate,
      },
      whatsappLinks,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to share media",
    });
  }
};

/* ACCESS MEDIA SHARE */
export const accessMediaShare = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const share = await Share.findOne({ token }).populate("mediaIds");

    if (!share) {
      return res.status(404).json({
        success: false,
        message: "Share link not found",
      });
    }

    // Expiry check
    if (share.expiryDate && dayjs().isAfter(share.expiryDate)) {
      return res.status(410).json({
        success: false,
        message: "This share link has expired",
      });
    }

    // Password check
    if (share.shareType === "private") {
      if (!password) {
        return res.status(401).json({
          success: false,
          message: "Password is required",
        });
      }

      const isValid = bcrypt.compareSync(password, share.passwordHash);

      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: "Incorrect password",
        });
      }
    }

    return res.status(200).json({
      success: true,
      allowDownload: share.allowDownload,
      media: share.mediaIds,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

/* LIST GALLERY ITEMS (bonus helper, useful for rendering the gallery view) */
export const getGalleryItems = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { folderId = null } = req.query;

    const items = await Media.find({
      ownerId,
      folderId: folderId || null,
      isDeleted: false,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Gallery items fetched successfully",
      media: items,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};
