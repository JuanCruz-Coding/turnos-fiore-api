const express = require("express");
const pool = require("../db");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM resenas WHERE aprobada = true ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener reseñas" });
  }
});

router.get("/todas", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM resenas ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener reseñas" });
  }
});

router.post("/", async (req, res) => {
  const { nombre, texto, estrellas } = req.body;
  if (!nombre || !texto || !estrellas) {
    return res.status(400).json({ error: "Completá todos los campos." });
  }
  const estrellasNum = parseInt(estrellas);
  if (isNaN(estrellasNum) || estrellasNum < 1 || estrellasNum > 5) {
    return res.status(400).json({ error: "Las estrellas deben ser un número entre 1 y 5." });
  }
  if (typeof nombre !== "string" || nombre.length > 100) {
    return res.status(400).json({ error: "Nombre inválido." });
  }
  if (typeof texto !== "string" || texto.length > 1000) {
    return res.status(400).json({ error: "El texto no puede superar los 1000 caracteres." });
  }
  try {
    const result = await pool.query(
      "INSERT INTO resenas (nombre, texto, estrellas) VALUES ($1, $2, $3) RETURNING *",
      [nombre, texto, estrellasNum]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al guardar reseña" });
  }
});

router.patch("/:id/aprobar", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "UPDATE resenas SET aprobada = true WHERE id = $1 RETURNING *",
      [id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al aprobar reseña" });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM resenas WHERE id = $1", [id]);
    res.json({ mensaje: "Reseña eliminada" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar reseña" });
  }
});

module.exports = router;