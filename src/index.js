const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const turnosRoutes = require("./routes/turnos");
const horariosRoutes = require("./routes/horarios");
const resenasRoutes = require("./routes/resenas");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/turnos", turnosRoutes);
app.use("/api/horarios", horariosRoutes);
app.use("/api/resenas", resenasRoutes);

app.get("/", (req, res) => {
  res.json({ mensaje: "API Mates con Fiore funcionando" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});


