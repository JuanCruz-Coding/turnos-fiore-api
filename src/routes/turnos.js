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

router.get("/stats", authMiddleware, async (req, res) => {
  try {
    const hoy = new Date().toISOString().split("T")[0];
    const lunesStr = (() => {
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      return d.toISOString().split("T")[0];
    })();

    const [proximosDia, semana, alumnosUnicos] = await Promise.all([
      pool.query(
        "SELECT * FROM turnos WHERE fecha = $1 AND estado = 'confirmado' ORDER BY hora",
        [hoy]
      ),
      pool.query(
        "SELECT COUNT(*) FROM turnos WHERE fecha >= $1 AND estado = 'confirmado'",
        [lunesStr]
      ),
      pool.query(
        "SELECT COUNT(DISTINCT email) FROM turnos WHERE estado = 'confirmado'"
      ),
    ]);

    res.json({
      proximosDia: proximosDia.rows,
      clasesSemana: parseInt(semana.rows[0].count),
      alumnosUnicos: parseInt(alumnosUnicos.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

router.post("/", async (req, res) => {
  const { nombre, email, whatsapp, nivel, horario_id, fecha, hora } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO turnos (nombre, email, whatsapp, nivel, horario_id, fecha, hora, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmado') RETURNING *`,
      [nombre, email, whatsapp, nivel, horario_id, fecha, hora]
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

router.patch("/:id/cancelar", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const turno = await pool.query("SELECT * FROM turnos WHERE id = $1", [id]);
    if (!turno.rows.length) return res.status(404).json({ error: "Turno no encontrado" });

    const fechaTurno = new Date(`${turno.rows[0].fecha.toISOString().split("T")[0]}T${turno.rows[0].hora}`);
    const ahora = new Date();
    const diffHoras = (fechaTurno - ahora) / (1000 * 60 * 60);

    if (diffHoras < 24) {
      return res.status(400).json({ error: "No se puede cancelar con menos de 24hs de anticipación." });
    }

    await pool.query(
      "UPDATE turnos SET estado = 'cancelado' WHERE id = $1",
      [id]
    );
    await pool.query(
      "UPDATE horarios SET disponible = true WHERE id = (SELECT horario_id FROM turnos WHERE id = $1)",
      [id]
    );
    res.json({ mensaje: "Turno cancelado" });
  } catch (err) {
    res.status(500).json({ error: "Error al cancelar turno" });
  }
});

router.patch("/:id/reprogramar", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const turno = await pool.query("SELECT * FROM turnos WHERE id = $1", [id]);
    if (!turno.rows.length) return res.status(404).json({ error: "Turno no encontrado" });

    const fechaTurno = new Date(`${turno.rows[0].fecha.toISOString().split("T")[0]}T${turno.rows[0].hora}`);
    const ahora = new Date();
    const diffHoras = (fechaTurno - ahora) / (1000 * 60 * 60);

    if (diffHoras < 24) {
      return res.status(400).json({ error: "No se puede reprogramar con menos de 24hs de anticipación." });
    }

    await pool.query(
      "UPDATE turnos SET estado = 'cancelado', reprogramado = true WHERE id = $1",
      [id]
    );
    await pool.query(
      "UPDATE horarios SET disponible = true WHERE id = (SELECT horario_id FROM turnos WHERE id = $1)",
      [id]
    );
    res.json({ mensaje: "Turno reprogramado — el alumno debe reservar de nuevo." });
  } catch (err) {
    res.status(500).json({ error: "Error al reprogramar turno" });
  }
});

module.exports = router;