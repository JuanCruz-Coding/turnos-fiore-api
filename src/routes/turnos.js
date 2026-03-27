const express = require("express");
const pool = require("../db");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM turnos ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener turnos" });
  }
});

router.post("/", async (req, res) => {
  const { nombre, email, nivel, horario_id, fecha, hora } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO turnos (nombre, email, nivel, horario_id, fecha, hora)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre, email, nivel, horario_id, fecha, hora]
    );
    await pool.query(
      "UPDATE horarios SET disponible = false WHERE id = $1",
      [horario_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al solicitar turno" });
  }
});

router.patch("/:id/confirmar", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "UPDATE turnos SET estado = 'confirmado' WHERE id = $1 RETURNING *",
      [id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al confirmar turno" });
  }
});

router.patch("/:id/cancelar", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "UPDATE turnos SET estado = 'cancelado' WHERE id = $1 RETURNING *",
      [id]
    );
    await pool.query(
      "UPDATE horarios SET disponible = true WHERE id = (SELECT horario_id FROM turnos WHERE id = $1)",
      [id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al cancelar turno" });
  }
});

module.exports = router;