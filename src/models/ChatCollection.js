
import mongoose from "mongoose";
console.log("Updated 2 Model Schema......")

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "assistant"],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const chatSchema = new mongoose.Schema({
  userId:{
    type:String,
    required:true,
    index:true,
  },
  chatId: {
    type: String,
    required: true,
    index: true,
  },

  title: {
    type: String,
    default: "New Chat",
  },

  messages: [messageSchema],
    documents: {
    type: [
        {
        name: String,
        doc_id: { type: String, required: true },
        uploadedAt: {
            type: Date,
            default: Date.now
        },
        fileHash: { type: String ,required:true},
        }
    ],
    default: []
    
    },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// auto update updatedAt
chatSchema.pre("save", async function () {
  this.updatedAt = Date.now();
  
});



export default mongoose.model("Chat", chatSchema);