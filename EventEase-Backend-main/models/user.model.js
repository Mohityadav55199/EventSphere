import mongoose, { Schema } from "mongoose"; 
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = new Schema({
   name : {
    type: String,
    required: [true, "Name is required"],
    lowercase: true,
    trim: true
   },
   email : {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
    required : [true,"Email is required"],
   },
   password: {
    type: String,
    required: [true,'Password is required'],  
   },
   role: {
    type: String,
    required: true,
    enum: ["attendee", "organizer", "admin"],
    default: "attendee",
   },
    refreshToken :{
        type: String
    },

    walletPoints: {
        type: Number,
        default: 0,
        min: [0, "Wallet points cannot be negative"]
    }

},{timestamps: true})



userSchema.pre("save",async function (next) {
 if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 10);
})

userSchema.methods.isPasswordCorrect = async function (password){
    return await bcrypt.compare(password,this.password)
}

userSchema.methods.genearteAccessToken = function () {
    return jwt.sign({
        _id : this._id,
         name: this.name,
         email: this.email,
         role : this.role
    },
     process.env.ACCESS_TOKEN_SECRET,
     {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY
     })
}

userSchema.methods.refreshAccessToken = function(){
    return jwt.sign({
        _id: this._id
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRY
    }
)
}

const User = mongoose.model("User",userSchema);
export default User;