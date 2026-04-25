import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log("Verification of Token Started")
  console.log("Auth Header:",authHeader)

  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1]; // Bearer TOKEN

  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    console.log("Decoded token:",decoded);
    req.user = decoded; // 🔥 attach user info

    next(); // continue request

  } catch (err) {
    return res.status(403).json({ message: "Invalid token" });
  }
};
