import multer from "multer";

import storage from "../config/gridfs.js";

const upload = multer({ storage });

export default upload;