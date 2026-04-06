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
  const { nombre, email, whatsapp, dni, nivel, fecha, hora } = req.body;

  if (!nombre || !email || !whatsapp || !dni || !nivel || !fecha || !hora) {
    return res.status(400).json({ error: "Todos los campos son requeridos." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Email inválido." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verificar que el slot no esté ya reservado
    const conflicto = await client.query(
      "SELECT 1 FROM turnos WHERE fecha = $1 AND hora = $2 AND estado = 'confirmado'",
      [fecha, hora]
    );
    if (conflicto.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "El horario ya no está disponible." });
    }

    let alumno_id;
    const alumnoExistente = await client.query(
      "SELECT * FROM alumnos WHERE dni = $1", [dni]
    );

    if (alumnoExistente.rows.length) {
      alumno_id = alumnoExistente.rows[0].id;
      await client.query(
        "UPDATE alumnos SET nombre = $1, email = $2, whatsapp = $3, nivel = $4 WHERE id = $5",
        [nombre, email, whatsapp, nivel, alumno_id]
      );
    } else {
      const nuevoAlumno = await client.query(
        "INSERT INTO alumnos (nombre, email, whatsapp, dni, nivel) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [nombre, email, whatsapp, dni, nivel]
      );
      alumno_id = nuevoAlumno.rows[0].id;
    }

    const result = await client.query(
      `INSERT INTO turnos (nombre, email, whatsapp, dni, nivel, horario_id, fecha, hora, estado, alumno_id)
       VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, 'confirmado', $8) RETURNING *`,
      [nombre, email, whatsapp, dni, nivel, fecha, hora, alumno_id]
    );

    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    // Error de constraint único (double-booking concurrente)
    if (err.code === '23505') {
      return res.status(409).json({ error: "El horario ya no está disponible." });
    }
    console.error(err);
    res.status(500).json({ error: "Error al solicitar turno" });
  } finally {
    client.release();
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
    res.json({ mensaje: "Turno reprogramado — el alumno debe reservar de nuevo." });
  } catch (err) {
    res.status(500).json({ error: "Error al reprogramar turno" });
  }
});

router.patch("/:id/pago", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { pago } = req.body;
  try {
    const result = await pool.query(
      "UPDATE turnos SET pago = $1 WHERE id = $2 RETURNING *",
      [pago, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Turno no encontrado" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar pago" });
  }
});

module.exports = router;
