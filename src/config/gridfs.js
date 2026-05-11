import multer from "multer";
import mongoose from "mongoose";

// Use memory storage for multer
const storage = multer.memoryStorage();

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit - adjust as needed
  }
});

export default upload;