
import mongoose from "mongoose";

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
chatSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model("Chat", chatSchema);