const express = require("express");
const pool = require("../db");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM alumnos ORDER BY nombre ASC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener alumnos" });
  }
});

router.get("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const alumno = await pool.query("SELECT * FROM alumnos WHERE id = $1", [id]);
    if (!alumno.rows.length) return res.status(404).json({ error: "Alumno no encontrado" });

    const turnos = await pool.query(
      "SELECT * FROM turnos WHERE alumno_id = $1 ORDER BY fecha DESC, hora DESC",
      [id]
    );

    res.json({ ...alumno.rows[0], turnos: turnos.rows });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener alumno" });
  }
});

router.get("/dni/:dni", authMiddleware, async (req, res) => {
  const { dni } = req.params;
  try {
    const result = await pool.query("SELECT * FROM alumnos WHERE dni = $1", [dni]);
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: "Error al buscar alumno" });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM turnos WHERE alumno_id = $1", [id]);
    const result = await client.query("DELETE FROM alumnos WHERE id = $1 RETURNING *", [id]);
    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Alumno no encontrado" });
    }
    await client.query("COMMIT");
    res.json({ mensaje: "Alumno eliminado" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Error al eliminar alumno" });
  } finally {
    client.release();
  }
});

router.patch("/:id/notas", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { notas } = req.body;
  try {
    const result = await pool.query(
      "UPDATE alumnos SET notas = $1 WHERE id = $2 RETURNING *",
      [notas, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar notas" });
  }
});

module.exports = router;