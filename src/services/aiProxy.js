const axios = require("axios");

const askAI = async (question, chatHistory = [],sessionId) => {
  try{
    const res = await axios.post(
      process.env.AI_SERVICE_URL + "/ask",
      {
        question,
        chat_history: chatHistory,
        
      },{
        headers: {
          "x-session-id": sessionId
        },
        timeout:30000
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

module.exports = { askAI, generateQuizAI };


