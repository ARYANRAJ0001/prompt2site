const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^\S+@\S+\.\S+$/ },
    password: { type: String, required: true, minlength: 6 },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword() {
  if (this.isModified("password")) this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.checkPassword = function checkPassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);
