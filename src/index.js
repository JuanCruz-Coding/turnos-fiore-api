const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// Validar variables de entorno requeridas al arrancar
const requeridas = ["JWT_SECRET", "DATABASE_URL", "ADMIN_USUARIO", "ADMIN_PASSWORD"];
requeridas.forEach(v => {
  if (!process.env[v]) throw new Error(`Variable de entorno faltante: ${v}`);
});

const authRoutes = require("./routes/auth");
const turnosRoutes = require("./routes/turnos");
const horariosRoutes = require("./routes/horarios");
const resenasRoutes = require("./routes/resenas");
const alumnosRoutes = require("./routes/alumnos");
const pagosRoutes = require("./routes/pagos");

const app = express();

// Seguridad: headers HTTP
app.use(helmet());

// CORS restringido al frontend
const origenesPermitidos = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map(o => o.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (ej: Postman, Railway health checks)
    if (!origin) return callback(null, true);
    if (origenesPermitidos.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origen no permitido: ${origin}`));
  },
}));

// Limitar tamaño de requests
app.use(express.json({ limit: "10kb" }));

// Rate limiting en endpoints públicos
const limitadorPublico = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes, intentá en unos minutos." },
});

const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de login, esperá unos minutos." },
});

app.use("/api/auth/login", limitadorLogin);
app.use("/api/turnos", limitadorPublico);
app.use("/api/resenas", limitadorPublico);
app.use("/api/pagos/crear-preferencia", limitadorPublico);

app.use("/api/auth", authRoutes);
app.use("/api/turnos", turnosRoutes);
app.use("/api/horarios", horariosRoutes);
app.use("/api/resenas", resenasRoutes);
app.use("/api/alumnos", alumnosRoutes);
app.use("/api/pagos", pagosRoutes);

app.get("/", (req, res) => {
  res.json({ mensaje: "API Mates con Fiore funcionando" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
