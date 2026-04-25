import express from "express"
import User from "../models/User.js"
const router=express.Router();


router.get("/",async(req,res)=>{
    const userId=req.user.userId;
    console.log("UserId in user.js",userId);
    const user=await User.findOne({"_id":userId});
    console.log("User in user.js",user);
    if(!user){
        res.status(400).json({message:"User not found!"});
    }
    res.status(200).json(user);


})
export default router;
