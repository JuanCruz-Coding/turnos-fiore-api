const express = require("express");
const pool = require("../db");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM disponibilidad ORDER BY dia_semana, hora_inicio"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener disponibilidad" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  const { dia_semana, hora_inicio, hora_fin, duracion_minutos } = req.body;

  const dia = parseInt(dia_semana);
  const duracion = parseInt(duracion_minutos);

  if (isNaN(dia) || dia < 0 || dia > 6) {
    return res.status(400).json({ error: "dia_semana debe ser un número entre 0 y 6." });
  }
  if (!hora_inicio || !hora_fin) {
    return res.status(400).json({ error: "hora_inicio y hora_fin son requeridos." });
  }
  if (hora_fin <= hora_inicio) {
    return res.status(400).json({ error: "hora_fin debe ser posterior a hora_inicio." });
  }
  if (isNaN(duracion) || duracion <= 0) {
    return res.status(400).json({ error: "duracion_minutos debe ser un número positivo." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO disponibilidad (dia_semana, hora_inicio, hora_fin, duracion_minutos)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [dia, hora_inicio, hora_fin, duracion]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al crear regla de disponibilidad" });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { activa, hora_inicio, hora_fin, duracion_minutos } = req.body;

  try {
    // Si solo se manda activa, hacemos toggle
    if (activa !== undefined && !hora_inicio && !hora_fin) {
      const result = await pool.query(
        "UPDATE disponibilidad SET activa = $1 WHERE id = $2 RETURNING *",
        [activa, id]
      );
      if (!result.rows.length) return res.status(404).json({ error: "Regla no encontrada" });
      return res.json(result.rows[0]);
    }

    // Actualización completa
    if (hora_fin <= hora_inicio) {
      return res.status(400).json({ error: "hora_fin debe ser posterior a hora_inicio." });
    }
    const result = await pool.query(
      `UPDATE disponibilidad
       SET hora_inicio = $1, hora_fin = $2, duracion_minutos = $3, activa = $4
       WHERE id = $5 RETURNING *`,
      [hora_inicio, hora_fin, parseInt(duracion_minutos), activa ?? true, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Regla no encontrada" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar regla" });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM disponibilidad WHERE id = $1", [id]);
    res.json({ mensaje: "Regla eliminada" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar regla" });
  }
});

module.exports = router;
