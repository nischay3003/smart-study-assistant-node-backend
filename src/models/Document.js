import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
  chatId:         { type: String, required: true, index: true },  // "global" for admin docs
  userId:         { type: String, index: true },
  doc_id:         { type: String, required: true, unique: true },  // real unique index now
  gridfs_file_id: mongoose.Schema.Types.ObjectId,
  title:          String,
  filename:       String,
  fileHash:       String,
  mimeType:       String,
  content:        { type: String,default: null },
  size:           Number,
  category:       { type: String, default: "General" },
  description:    String,
  type:           { type: String, enum: ["file", "text"] },
  source:         { type: String, enum: ["personal", "global"] },
  uploadedAt:     { type: Date, default: Date.now },
});

// Compound index — most queries are "all docs for this chat"
documentSchema.index({ chatId: 1, uploadedAt: -1 });

export default mongoose.model("Document", documentSchema);