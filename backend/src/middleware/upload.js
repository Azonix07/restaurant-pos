const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Use USER_DATA_PATH (from Electron) if available, otherwise fall back to relative path (dev mode)
const baseDir = process.env.USER_DATA_PATH || path.join(__dirname, '../..');
const UPLOAD_DIR = path.join(baseDir, 'uploads');
const IMAGES_DIR = path.join(UPLOAD_DIR, 'images');
const WASTAGE_DIR = path.join(UPLOAD_DIR, 'wastage');

// Ensure directories exist
[UPLOAD_DIR, IMAGES_DIR, WASTAGE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Image upload for menu items
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, IMAGES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `item-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, safeName);
  },
});

// Wastage photo upload
const wastageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, WASTAGE_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `waste-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, safeName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Only image files are allowed'), false);
};

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter,
});

const uploadWastagePhoto = multer({
  storage: wastageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter,
});

// Static serve with caching headers
const serveImages = express.static(IMAGES_DIR, {
  maxAge: '7d',
  etag: true,
  lastModified: true,
});

const serveWastage = express.static(WASTAGE_DIR, {
  maxAge: '1d',
  etag: true,
});

module.exports = {
  uploadImage,
  uploadWastagePhoto,
  serveImages,
  serveWastage,
  IMAGES_DIR,
  WASTAGE_DIR,
};
