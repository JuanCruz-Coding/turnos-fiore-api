const express = require("express");
const pool = require("../db");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM horarios WHERE disponible = true ORDER BY fecha, hora"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener horarios" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  const { fecha, hora } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO horarios (fecha, hora) VALUES ($1, $2) RETURNING *",
      [fecha, hora]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al agregar horario" });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM horarios WHERE id = $1", [id]);
    res.json({ mensaje: "Horario eliminado" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar horario" });
  }
});

module.exports = router;