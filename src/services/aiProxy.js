const axios = require("axios");

const askAI = async (question, chatHistory = [],chatId) => {
  try{
    const res = await axios.post(
      process.env.AI_SERVICE_URL + "/ask",
      {
        question,
        chat_history: chatHistory,
        
      },{
        headers: {
          "x-chat-id": chatId
        },
        
      },
      
      
    );
     return res.data;
  }catch(err){
    console.error("Error communicating with AI service:", err);
    throw new Error("Failed to get response from AI service");
  }
 
};

const generateQuizAI = async (topic, difficulty = "easy") => {
  const res = await axios.post(
    process.env.AI_SERVICE_URL + "/generate-quiz",
    {
      topic,
      difficulty,
      num_questions: 3,
    }
  );
  console.log("Quiz generation response:", res.data);

  return res.data;
};

const ingestFile=async(formData, fileName, chatId, docId)=>{

    const response = await axios.post(process.env.AI_SERVICE_URL + "/doc/ingest", formData, {
      headers: {
        ...formData.getHeaders(),
        "x-chat-id": chatId,
        "x-doc-id": docId

      },
    });
  

    return response;
  
};

module.exports = { askAI, generateQuizAI ,ingestFile};
