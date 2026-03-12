const mongoose = require("mongoose");

const studentProgressSchema=new mongoose.Schema({
    topic:String,
    questionAsked:{type:Number,default:0},
    lowConfidence:{type:Number,default:0},
    quizAttempts:{type:Number,default:0},
    quizCorrect:{type:Number,default:0},

})

module.exports=mongoose.model("StudentProgress",studentProgressSchema)