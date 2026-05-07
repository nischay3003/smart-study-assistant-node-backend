import express from "express";
const router=express.Router();
import { ingestFile } from "../services/aiProxy.js";
import multer from "multer";
import FormData from "form-data";
import axios from "axios"
import ChatCollection from "../models/ChatCollection.js";
import { v4 as uuidv4 } from 'uuid';
const storage=multer.memoryStorage();
const upload=multer({dest:"uploads/",storage});
router.post(
  "/ingest/global",
  upload.single("file"),
  async (req, res) => {

    try {

      const {
        title,
        category,
        description,
        rawText
      } = req.body;

      const file = req.file;

      const docId = uuidv4();

      console.log("Global ingestion started");

      // ❌ require either file or raw text
      if (!file && !rawText) {
        return res.status(400).json({
          error: "File or raw text is required"
        });
      }

      const formData = new FormData();

      // 🔥 append metadata - only if they exist
      if (title) formData.append("title", title);
      if (category) formData.append("category", category);
      if (description) formData.append("description", description);
      if (rawText) formData.append("rawText", rawText);

      // 🔥 append file if exists
      if (file) {
        formData.append("file", file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype,
        });
      }

      // 🔥 call AI service
      console.log("Sending to AI service with docId:", docId);
      const response = await axios.post(
        `${process.env.AI_SERVICE_URL}/doc/admin/ingest`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            "x-doc-id": docId
          }
        }
      );

      console.log("AI service response:", response.data);

      // 🔥 save metadata
      const chatId = "global";

      await ChatCollection.updateOne(
        { chatId },
        {
          $push: {
            documents: {
              name: file
                ? file.originalname
                : title,
              doc_id: docId,
              category,
              description,
              type: file ? "file" : "text"
            }
          }
        },
        { upsert: true }
      );

      return res.json(response.data);

    } catch (err) {

      console.error("Global ingestion error:", err.message);
      if (err.response?.data) {
        console.error("AI service error response:", err.response.data);
      }

      return res.status(500).json({
        error: "Failed global ingestion",
        details: err.message
      });
    }
  }
);
router.post("/ingest",upload.single("file"), async (req, res) => {
  const file = req.file;
  console.log("Received file for ingestion:", file ? file.originalname : "No file");

  const chatId=req.headers["x-chat-id"] ;
  console.log("Chat id in nodejs ingest route:",chatId);
  
  if (!file) {
    return res.status(400).json({ error: "PDF file is required" });
  }

  // Generate unique doc_id
  const docId = uuidv4();

  try {
    const formData = new FormData();
    formData.append("file", file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
        });

    // const response = await axios.post(process.env.AI_SERVICE_URL + "/ingest/pdf", formData, {
    //   headers: {
    //     ...formData.getHeaders(),
    //     "x-chat-id": chatId

    //   },
    // });
    const response=await ingestFile(formData, file.originalname, chatId, docId);

    if (response.status==200){
        await ChatCollection.updateOne(
        { chatId },
        {
            $push: {
            documents: {
                name: file.originalname,
                doc_id: docId,
                fileHash:response.data.file_hash
            }
            }
        }
        );
    }
    res.json(response.data);
    
  } catch (err) {
    console.error("PDF Ingestion error:", err);
    res.status(500).json({ error: "Failed to ingest PDF" });
  }
});
router.delete("/delete", async (req, res) => {
  console.log("Entered delete")
  try {
    const { doc_id } = req.body;
    const chatId = req.headers["x-chat-id"];
    console.log("Doc _id:",doc_id," Chat_id",chatId)

    if (!chatId || !doc_id) {
      return res.status(400).json({ message: "Missing chatId or docId" });
    }

    console.log("Deleting doc:", doc_id, "from chat:", chatId);

    // 🔹 1. Find and remove from MongoDB
    const chat = await ChatCollection.findOne({ chatId });
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const docIndex = chat.documents.findIndex(doc => doc.doc_id === doc_id);
    console.log("Document index in chat:", docIndex);
    if (docIndex === -1) {
      return res.status(404).json({ message: "Document not found in chat" });
    }

    chat.documents.splice(docIndex, 1);
    

    // 🔹 2. Call Python AI service to delete embeddings
    const aiRes = await axios.delete(
      `${process.env.AI_SERVICE_URL}/doc/delete`,
      {
        params: {
          doc_id: doc_id,
          chat_id: chatId
        }
      }
    );
    if (aiRes.status == 200) {
      await chat.save();
    }


    return res.json({
      message: "Document deleted successfully",
      aiResponse: aiRes.data
    });

  } catch (err) {
    console.error("Document deletion error:", err);
    res.status(500).json({ error: "Failed to delete document" });
  }
});
router.get("/global", async (req, res) => {
  try {

    const globalChat = await ChatCollection.findOne({
      chatId: "global"
    });

    if (!globalChat) {
      return res.json({
        documents: []
      });
    }

    return res.json({
      documents: globalChat.documents || []
    });

  } catch (err) {

    console.error("Get global documents error:", err);

    return res.status(500).json({
      error: "Failed to fetch global documents"
    });
  }
});
router.delete("/global/delete/:docId", async (req, res) => {

  try {

    const { docId } = req.params;

    if (!docId) {
      return res.status(400).json({
        error: "docId required"
      });
    }

    // 🔥 find global chat
    const globalChat = await ChatCollection.findOne({
      chatId: "global"
    });

    if (!globalChat) {
      return res.status(404).json({
        error: "Global knowledge not found"
      });
    }

    // 🔥 find document
    const doc = globalChat.documents.find(
      d => d.doc_id === docId
    );

    if (!doc) {
      return res.status(404).json({
        error: "Document not found"
      });
    }

    // 🔥 call AI service
    const aiResponse = await axios.delete(
      `${process.env.AI_SERVICE_URL}/doc/admin/delete`,
      {
        params: {
          doc_id: docId
        }
      }
    );

    // 🔥 remove from MongoDB
    await ChatCollection.updateOne(
      { chatId: "global" },
      {
        $pull: {
          documents: {
            doc_id: docId
          }
        }
      }
    );

    

    return res.json({
      status: "success",
      message: "Global document deleted",
      aiResponse: aiResponse.data
    });

  } catch (err) {

    console.error("Delete global document error:", err);

    return res.status(500).json({
      error: "Failed to delete global document"
    });
  }
});
      

export default router;


  