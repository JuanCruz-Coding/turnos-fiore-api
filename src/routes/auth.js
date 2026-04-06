const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();

const USUARIO = process.env.ADMIN_USUARIO;
const PASSWORD_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);

router.post("/login", async (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ error: "Credenciales requeridas" });
  }

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
