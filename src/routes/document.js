import express from "express";
const router=express.Router();
import { ingestPdf } from "../services/aiProxy.js";
import multer from "multer";
import FormData from "form-data";
import axios from "axios"
import ChatCollection from "../models/ChatCollection.js";
const storage=multer.memoryStorage();
const upload=multer({dest:"uploads/",storage});
router.post("/ingest/pdf",upload.single("file"), async (req, res) => {
  const file = req.file;
  console.log("Received file for ingestion:", file ? file.originalname : "No file");

  const chatId=req.headers["x-chat-id"] ;
  console.log("Chat id in nodejs ingest route:",chatId);
  
  if (!file) {
    return res.status(400).json({ error: "PDF file is required" });
  }


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
    const response=await ingestPdf(formData, file.originalname, chatId);

    if (response.status==200){
        await ChatCollection.updateOne(
        { chatId },
        {
            $push: {
            documents: {
                name: file.originalname,
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
router.delete("/:fileHash", async (req, res) => {
  console.log("Entered delete")
  try {
    const { fileHash } = req.params;
    const chatId = req.headers["x-chat-id"]; // or from body/query

    if (!chatId || !fileHash) {
      return res.status(400).json({ message: "Missing chatId or fileHash" });
    }

    console.log("Deleting doc:", fileHash, "from chat:", chatId);

    // 🔹 1. Remove from MongoDB
    const result = await ChatCollection.updateOne(
      { chatId },
      {
        $pull: {
          documents: { fileHash: fileHash }
        }
      }
    );

    console.log("Mongo update result:", result);

    // 🔹 2. Call Python AI service to delete embeddings
    const aiRes = await axios.delete(
      `${process.env.AI_SERVICE_URL}/doc/delete`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        params:{
          file_hash: fileHash,
          chat_id: chatId
        }
      }
    );

    const aiData = await aiRes.json();

    return res.json({
      message: "Document deleted successfully",
      aiResponse: aiData
    });

  } catch (err) {
    console.error("Error deleting document:", err);
    res.status(500).json({ message: "Failed to delete document" });
  }
});

export default router;


  