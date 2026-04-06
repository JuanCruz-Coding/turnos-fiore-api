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
      "INSERT INTO horarios (fecha, hora) VALUES ($1::date, $2::time) RETURNING *",
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

router.post("/generar", authMiddleware, async (req, res) => {
  const { reglas, desde, hasta } = req.body;

  if (!reglas?.length || !desde || !hasta) {
    return res.status(400).json({ error: "Faltan datos." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const fechaDesde = new Date(desde + "T12:00:00");
    const fechaHasta = new Date(hasta + "T12:00:00");

    await client.query("DELETE FROM horarios WHERE disponible = true");

    const horariosNuevos = [];
    const current = new Date(fechaDesde);

    while (current <= fechaHasta) {
      const diaSemana = current.getDay();

      for (const regla of reglas) {
        if (regla.dia === diaSemana) {
          const fechaStr = current.toISOString().split("T")[0];
          horariosNuevos.push({ fecha: fechaStr, hora: regla.hora });
        }
      }
      current.setDate(current.getDate() + 1);
    }

    for (const h of horariosNuevos) {
      await client.query(
        "INSERT INTO horarios (fecha, hora) VALUES ($1::date, $2::time)",
        [h.fecha, h.hora]
      );
    }

    await client.query("COMMIT");
    res.json({ mensaje: `Se generaron ${horariosNuevos.length} horarios.`, total: horariosNuevos.length });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Error al generar horarios." });
  } finally {
    client.release();
  }
});

module.exports = router;