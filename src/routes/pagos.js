const express = require("express");
const { MercadoPagoConfig, Preference } = require("mercadopago");
const pool = require("../db");
require("dotenv").config();

const router = express.Router();

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

router.post("/crear-preferencia", async (req, res) => {
  const { turno_id, nombre, email, horario_id, fecha, hora } = req.body;

  try {
    const preference = new Preference(client);

    const resultado = await preference.create({
      body: {
        items: [
          {
          title: `Clase de matemáticas - ${new Date(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })} ${hora.slice(0,5)}hs`,
            quantity: 1,
            unit_price: 15000,
            currency_id: "ARS"
          }
        ],
        payer: {
          name: nombre,
          email: email
        },
        back_urls: {
          success: `${process.env.FRONTEND_URL}/turnos/pago-exitoso`,
          failure: `${process.env.FRONTEND_URL}/turnos/pago-fallido`,
          pending: `${process.env.FRONTEND_URL}/turnos/pago-pendiente`
        },
        auto_return: "approved",
        external_reference: `${fecha}_${hora.slice(0, 5)}`,
        notification_url: `${process.env.BACKEND_URL}/api/pagos/webhook`
      }
    });

    res.json({ init_point: resultado.init_point, preference_id: resultado.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear preferencia de pago" });
  }
});

router.post("/webhook", async (req, res) => {
  const { type, data } = req.body;

  if (type === "payment") {
    try {
      const { Payment } = require("mercadopago");
      const payment = new Payment(client);
      const pagoInfo = await payment.get({ id: data.id });

      if (pagoInfo.status === "approved") {
        const [fecha, hora] = pagoInfo.external_reference.split("_");
        if (fecha && hora) {
          await pool.query(
            "UPDATE turnos SET pago = 'recibido' WHERE fecha = $1 AND hora = $2 AND estado = 'confirmado'",
            [fecha, hora + ":00"]
          );
        }
      }
    } catch (err) {
      console.error("Error en webhook:", err);
    }
  }

  res.sendStatus(200);
});

module.exports = router;
