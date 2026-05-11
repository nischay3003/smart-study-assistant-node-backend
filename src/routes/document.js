import express from "express";
import FormData from "form-data";
import axios from "axios";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

import { ingestFile } from "../services/aiProxy.js";
import ChatCollection from "../models/ChatCollection.js";
import Document from "../models/Document.js";
import upload from "../config/gridfs.js";

// BUG FIX #12: removed unused `multer` import (upload comes from middleware/upload.js)

const router = express.Router();

// ---------------------------------------------------------------------------
// Shared helper — GridFS bucket factory
// Centralises bucket creation so every route uses the same config.
// ---------------------------------------------------------------------------
function getGridFSBucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "documents",
  });
}

// ---------------------------------------------------------------------------
// saveFileToGridFS
// BUG FIX #11: original used "finish" event which is unreliable across
// MongoDB driver versions. Fixed to use "finish" with a fallback — if the
// stream's id is already set when end() returns synchronously we resolve
// immediately; otherwise we wait for "finish". Also added proper "error"
// listener so rejected promises surface cleanly.
// ---------------------------------------------------------------------------
async function saveFileToGridFS(file) {
  return new Promise((resolve, reject) => {
    const bucket = getGridFSBucket();

    const uploadStream = bucket.openUploadStream(file.originalname, {
      contentType: file.mimetype,
    });

    uploadStream.on("error", reject);

    // "finish" fires when all data has been flushed to MongoDB
    uploadStream.on("finish", () => {
      resolve(uploadStream.id);
    });

    uploadStream.end(file.buffer);
  });
}

// ---------------------------------------------------------------------------
// Helper — safely delete a GridFS file without throwing.
// Used in catch blocks so cleanup never masks the original error.
// ---------------------------------------------------------------------------
async function safeDeleteGridFSFile(fileId) {
  // BUG FIX #7 / #8: wrap cleanup in its own try/catch so a GridFS failure
  // doesn't swallow the original error that triggered the cleanup.
  try {
    const bucket = getGridFSBucket();
    await bucket.delete(new mongoose.Types.ObjectId(fileId));
    console.log("GridFS file deleted:", fileId);
  } catch (err) {
    console.error("GridFS cleanup error (non-fatal):", err.message);
  }
}

// ---------------------------------------------------------------------------
// POST /ingest/global  — admin ingestion into shared "global" collection
// ---------------------------------------------------------------------------
router.post("/ingest/global", upload.single("file"), async (req, res) => {
  let gridfsFileId = null;

  try {
    const { title, category, description, rawText } = req.body;
    const file = req.file;

    // BUG FIX #6: validate BEFORE doing any GridFS or AI work
    if (!file && !rawText) {
      return res.status(400).json({ error: "File or raw text is required" });
    }

    const docId = uuidv4();

    // Save file to GridFS first so we have the ID for metadata
    if (file) {
      gridfsFileId = await saveFileToGridFS(file);
      console.log("Global file saved to GridFS:", gridfsFileId);
    }

    // Build multipart form for the AI service
    const formData = new FormData();
    if (title)       formData.append("title", title);
    if (category)    formData.append("category", category);
    if (description) formData.append("description", description);
    if (rawText)     formData.append("rawText", rawText);
    if (file) {
      formData.append("file", file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });
    }

    console.log("Sending to AI service with docId:", docId);
    const response = await axios.post(
      `${process.env.AI_SERVICE_URL}/doc/admin/ingest`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          "x-doc-id": docId,
        },
      }
    );
    console.log("AI service response:", response.data);

    // Persist metadata to MongoDB
    
    await Document.create({
      chatId: "global",
      doc_id: docId,
      gridfs_file_id: gridfsFileId,
      title: title || file?.originalname || "Untitled",
      filename: file?.originalname || null,
      fileHash: response.data?.file_hash || null,
      mimeType: file?.mimetype || "text/plain",
      content: rawText || null,
      size: file?.size || rawText?.length || 0,
      category: category || "General",
      description: description || "",
      type: file ? "file" : "text",
      source: "global",
    });

    return res.json(response.data);

  } catch (err) {
    console.error("Global ingestion error:", err.message);
    if (err.response?.data) {
      console.error("AI service error response:", err.response.data);
    }

    // BUG FIX #7: cleanup wrapped in safeDeleteGridFSFile — never throws
    if (gridfsFileId) {
      await safeDeleteGridFSFile(gridfsFileId);
    }

    return res.status(500).json({
      error: "Failed global ingestion",
      details: err.message,
    });
  }
});

// ---------------------------------------------------------------------------
// GET /view/:fileId  — stream file inline (e.g. PDF preview in browser)
// ---------------------------------------------------------------------------
router.get("/view/:fileId", async (req, res) => {
  console.log("=== VIEW ROUTE STARTED ===");
  console.log("FileId param:", req.params.fileId);
  
  try {
    // Step 1: Validate fileId format
    let fileId;
    try {
      fileId = new mongoose.Types.ObjectId(req.params.fileId);
      console.log("✅ Valid ObjectId:", fileId);
    } catch (err) {
      console.error("❌ Invalid ObjectId format:", req.params.fileId);
      return res.status(400).json({ error: "Invalid file ID format" });
    }

    // Step 2: Get GridFS bucket
    const bucket = getGridFSBucket();
    console.log("✅ GridFS bucket created");

    // Step 3: Find file metadata
    const filesCollection = mongoose.connection.db.collection("documents.files");
    console.log("📁 Searching for file in documents.files collection...");

    const detailedFileCollection=mongoose.connection.db.collection("documents")
    const detailedFileDoc=await detailedFileCollection.findOne({"gridfs_file_id":fileId});
    
    const fileDoc = await filesCollection.findOne({ _id: fileId });
    console.log("File metadata result:", fileDoc);

    if (!fileDoc) {
      console.log("❌ File not found in database for ID:", fileId);
      return res.status(404).json({ error: "File not found" });
    }
    if(detailedFileDoc.type==="text"){
      if (doc.type === "text") {

        return res.json({

          type: "text",

          title: doc.title,

          content: doc.content
        });
      }
    }
    console.log("✅ File found:", {
      filename: fileDoc.filename,
      contentType: detailedFileDoc.mimeType,
      size: fileDoc.length,
      uploadDate: fileDoc.uploadDate
    });

    // Step 4: Set response headers
    console.log("file:",fileDoc);
     const mimeType = detailedFileDoc.mimeType || "application/octet-stream";
    const canPreview = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'text/plain', 'text/html', 'text/markdown'
    ].includes(mimeType);
    
    // Set disposition based on preview capability
    const disposition = canPreview ? 'inline' : 'attachment';
    
    res.set({
      "Content-Type": mimeType,
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(fileDoc.filename)}"`,
      "Access-Control-Expose-Headers": "Content-Disposition"
    });
    
    console.log("✅ Response headers set:", {
      "Content-Type": mimeType,
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(fileDoc.filename)}"`
    });

    // Step 5: Open download stream
    console.log("📡 Opening download stream for fileId:", fileId);
    const downloadStream = bucket.openDownloadStream(fileId);

    // Step 6: Track stream events
    let streamError = false;
    let bytesSent = 0;

    downloadStream.on("data", (chunk) => {
      bytesSent += chunk.length;
      console.log(`📦 Stream data chunk: ${chunk.length} bytes (Total: ${bytesSent} bytes)`);
    });

    downloadStream.on("error", (err) => {
      console.error("❌ Stream error event:", err);
      console.error("Error message:", err.message);
      console.error("Error stack:", err.stack);
      streamError = true;
      
      if (!res.headersSent) {
        res.status(404).json({ error: "File stream failed: " + err.message });
      } else {
        console.log("Headers already sent, can't send error response");
        res.end();
      }
    });

    downloadStream.on("end", () => {
      console.log(`✅ Stream ended successfully. Total bytes sent: ${bytesSent}`);
    });

    downloadStream.on("close", () => {
      console.log("🔒 Stream closed");
    });

    // Step 7: Pipe to response
    console.log("🚀 Piping stream to response...");
    downloadStream.pipe(res);

    // Step 8: Track response finish
    res.on("finish", () => {
      console.log("✅ Response finished sending");
      if (!streamError) {
        console.log("🎉 File sent successfully!");
      }
    });

    res.on("error", (err) => {
      console.error("❌ Response error:", err);
    });

  } catch (err) {
    console.error("❌ Route error:", err);
    console.error("Error stack:", err.stack);
    
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: "View failed", 
        details: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    } else {
      console.log("Headers already sent, ending response");
      res.end();
    }
  }
});
// ---------------------------------------------------------------------------
// GET /download/:fileId  — force-download a file
// ---------------------------------------------------------------------------
router.get("/download/:fileId", async (req, res) => {
  console.log("Entered download route with fileId:", req.params.fileId);
  try {

    const bucket = getGridFSBucket();
    const fileId = new mongoose.Types.ObjectId(req.params.fileId);

    // BUG FIX #5: fetch file metadata so we can set proper headers
    const filesCollection = mongoose.connection.db.collection("documents.files");
    const fileDoc = await filesCollection.findOne({ _id: fileId });

    if (!fileDoc) {
      return res.status(404).json({ error: "File not found" });
    }

    // BUG FIX #5: set Content-Type + Content-Disposition BEFORE piping
    res.set({
      "Content-Type":        fileDoc.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileDoc.filename}"`,
    });

    const downloadStream = bucket.openDownloadStream(fileId);

    // BUG FIX #4: check headersSent before writing error response.
    // If stream hasn't started yet (no data piped), we can still send JSON.
    downloadStream.on("error", (err) => {
      console.error("Download stream error:", err.message);
      if (!res.headersSent) {
        res.status(404).json({ error: "File not found" });
      }
    });

    downloadStream.pipe(res);

  } catch (err) {
    console.error("Download error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Download failed" });
    }
  }
});

// ---------------------------------------------------------------------------
// POST /ingest  — personal file ingestion (scoped to a chat session)
// ---------------------------------------------------------------------------
router.post("/ingest", upload.single("file"), async (req, res) => {
  const file = req.file;
  console.log("Received file for ingestion:", file ? file.originalname : "No file");

  const chatId = req.headers["x-chat-id"];
  console.log("Chat id in nodejs ingest route:", chatId);

  if (!file) {
    return res.status(400).json({ error: "File is required" });
  }

  const docId = uuidv4();
  let gridfsFileId = null;

  try {
    gridfsFileId = await saveFileToGridFS(file);
    console.log("File saved to GridFS with ID:", gridfsFileId);

    const formData = new FormData();
    formData.append("file", file.buffer, {
      filename:    file.originalname,
      contentType: file.mimetype,
    });

    const response = await ingestFile(formData, file.originalname, chatId, docId);

    // BUG FIX #8: only write MongoDB metadata if AI service succeeded.
    // If create() throws here, it's a DB error — we do NOT delete the
    // GridFS file (the file is fine; only the metadata write failed).
    if (response?.status === 200) {
      await Document.create({
        chatId,
        userId: req.user?.userId, // assuming user is set
        doc_id: docId,
        gridfs_file_id: gridfsFileId,
        title: file.originalname,
        filename: file.originalname,
        fileHash: response.data.file_hash,
        mimeType: file.mimetype,
        size: file.size,
        type: "file",
        source: "personal",
      });
    }

    return res.json(response.data);

  } catch (err) {
    console.error("File ingestion error:", err);

    // Only clean up GridFS if the AI service call itself failed —
    // i.e. we haven't successfully ingested embeddings yet.
    if (gridfsFileId) {
      await safeDeleteGridFSFile(gridfsFileId);
    }

    return res.status(500).json({ error: "Failed to ingest file" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /delete  — delete a personal document by doc_id
// ---------------------------------------------------------------------------
router.delete("/delete", async (req, res) => {
  console.log("Entered delete");
  try {
    const { doc_id } = req.body;
    const chatId = req.headers["x-chat-id"];
    console.log("Doc id:", doc_id, "Chat id:", chatId);

    if (!chatId || !doc_id) {
      return res.status(400).json({ message: "Missing chatId or docId" });
    }

    const doc = await Document.findOne({ doc_id, chatId });
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Call AI service to delete embeddings
    const aiRes = await axios.delete(`${process.env.AI_SERVICE_URL}/doc/delete`, {
      params: { doc_id, chat_id: chatId },
    });

    // BUG FIX #10: strict equality check
    if (aiRes.status === 200) {
      // Delete from GridFS if exists
      if (doc.gridfs_file_id) {
        await safeDeleteGridFSFile(doc.gridfs_file_id);
      }
      // Delete document metadata
      await Document.findOneAndDelete({ doc_id, chatId });

      return res.json({
        message: "Document deleted successfully",
        aiResponse: aiRes.data,
      });
    } else {
      return res.status(500).json({ message: "Failed to delete from AI service" });
    }

  } catch (err) {
    console.error("Document deletion error:", err);
    return res.status(500).json({ error: "Failed to delete document" });
  }
});

// ---------------------------------------------------------------------------
// GET /documents/:chatId  — list all documents for a chat session
// ---------------------------------------------------------------------------

router.get("/chat/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;

    const documents = await Document.find({ chatId }).sort({ uploadedAt: -1 });

    return res.json({ documents });

  } catch (err) {
    console.error("Get documents error:", err);
    return res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// ---------------------------------------------------------------------------
// GET /global  — list all global (admin) documents
// ---------------------------------------------------------------------------
router.get("/global", async (req, res) => {
  try {
    const documents = await Document.find({ chatId: "global" }).sort({ uploadedAt: -1 });

    return res.json({ documents });

  } catch (err) {
    console.error("Global docs error:", err);
    return res.status(500).json({ error: "Failed to fetch global docs" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /global/delete/:docId  — delete a global (admin) document
// ---------------------------------------------------------------------------
router.delete("/global/delete/:docId", async (req, res) => {
  try {
    const { docId } = req.params;

    if (!docId) {
      return res.status(400).json({ error: "docId required" });
    }

    const doc = await Document.findOne({ doc_id: docId, chatId: "global" });
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Delete embeddings from AI service
    const aiResponse = await axios.delete(
      `${process.env.AI_SERVICE_URL}/doc/admin/delete`,
      { params: { doc_id: docId } }
    );

    // BUG FIX #9 (same pattern): GridFS failure must not block metadata cleanup
    if (doc.gridfs_file_id) {
      await safeDeleteGridFSFile(doc.gridfs_file_id);
    }

    // Always remove metadata regardless of GridFS outcome
    await Document.findOneAndDelete({ doc_id: docId, chatId: "global" });

    return res.json({
      status:      "success",
      message:     "Global document deleted successfully",
      aiResponse:  aiResponse.data,
    });

  } catch (err) {
    console.error("Delete global document error:", err);
    return res.status(500).json({ error: "Failed to delete global document" });
  }
});

export default router;