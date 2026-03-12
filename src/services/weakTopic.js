const isWeakTopic = (record)=>{
    if(!record) return false;

    if(record.quizAttempts>=2){
        const accuracy=record.quizCorrect/(record.quizAttempts*3);
        if(accuracy<0.5) return true;
    }

    if(record.lowConfidenceCount>=2) return true;
    const ratio= record.questionAsked===0?0:record.lowConfidentCount/record.questionAsked;
    return ratio>0.4;
}
module.exports=isWeakTopic;