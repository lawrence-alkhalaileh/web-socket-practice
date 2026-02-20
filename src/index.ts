import express from "express";
import env from "dotenv";

const app = express();
app.use(express.json());

env.config();
const PORT = Number(process.env.SERVER_BACKEND_PORT);

app.get("/", () => {
  console.log("a7a");
});

app.listen(PORT, () => {
  console.log(`app is listening to port ${PORT}`);
});
