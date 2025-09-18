import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: function() { return this.role !== 'farmer'; },
    unique: true,
    sparse: true
  },
  
  phoneNumber: { 
    type: String, 
    required: function() { return this.role === 'farmer'; },
    unique: true,
    sparse: true
  },

  password: { 
    type: String, 
    required: function() { return this.role !== 'farmer'; }
  },

  role: { 
    type: String, 
    enum: ["farmer", "lab", "processor", "consumer"], 
    required: true 
  }
  
}, { timestamps: true });

export default mongoose.model("User", userSchema);
