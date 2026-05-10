import mongoose from "mongoose";
import { GridFsStorage } from "multer-gridfs-storage";

const storage = new GridFsStorage({

  url: process.env.MONGO_URI,

  file: (req, file) => {

    return {

      filename:
        `${Date.now()}-${file.originalname}`,

      bucketName: "documents"

    };
  }
});

export default storage;