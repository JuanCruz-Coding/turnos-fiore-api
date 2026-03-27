const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const router = express.Router();

const USUARIO = "fiore";
const PASSWORD_HASH = bcrypt.hashSync("matesconfiore2025", 10);

router.post("/login", async (req, res) => {
  const { usuario, password } = req.body;

  if (usuario !== USUARIO) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }

  const passwordValida = await bcrypt.compare(password, PASSWORD_HASH);
  if (!passwordValida) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }

  const token = jwt.sign({ usuario }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.json({ token });
});

module.exports = router;