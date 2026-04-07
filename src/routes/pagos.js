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

// ─── PayPal ──────────────────────────────────────────────────────────────────

function paypalBase() {
  return process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getPayPalToken() {
  const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  return data.access_token;
}

router.post("/paypal/crear-orden", async (req, res) => {
  const { nombre, email, fecha, hora } = req.body;
  try {
    const token = await getPayPalToken();
    const fechaFormateada = new Date(fecha).toLocaleDateString("es-AR", {
      day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires",
    });
    const response = await fetch(`${paypalBase()}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          custom_id: `${fecha}_${hora.slice(0, 5)}`,
          description: `Clase de matemáticas - ${fechaFormateada} ${hora.slice(0, 5)}hs`,
          amount: {
            currency_code: "USD",
            value: process.env.PAYPAL_PRICE_USD || "15.00",
          },
        }],
        application_context: {
          brand_name: "Mates con Fiore",
          user_action: "PAY_NOW",
        },
      }),
    });
    const order = await response.json();
    if (!order.id) {
      console.error("PayPal crear-orden error:", order);
      return res.status(500).json({ error: "Error al crear orden de PayPal" });
    }
    res.json({ orderID: order.id });
  } catch (err) {
    console.error("PayPal crear-orden:", err);
    res.status(500).json({ error: "Error al crear orden de PayPal" });
  }
});

router.post("/paypal/capturar-orden", async (req, res) => {
  const { orderID } = req.body;
  try {
    const token = await getPayPalToken();
    const response = await fetch(`${paypalBase()}/v2/checkout/orders/${orderID}/capture`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const captureData = await response.json();
    if (captureData.status === "COMPLETED") {
      const customId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id;
      if (customId) {
        const [fecha, hora] = customId.split("_");
        if (fecha && hora) {
          await pool.query(
            "UPDATE turnos SET pago = 'recibido' WHERE fecha = $1 AND hora = $2 AND estado = 'confirmado'",
            [fecha, hora + ":00"]
          );
        }
      }
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "El pago no fue completado" });
    }
  } catch (err) {
    console.error("PayPal capturar-orden:", err);
    res.status(500).json({ error: "Error al capturar orden de PayPal" });
  }
});

module.exports = router;
