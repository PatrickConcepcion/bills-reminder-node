import app from "./app";
import { AppDataSource } from "./data-source";

const PORT = Number(process.env.PORT || 3000);

AppDataSource.initialize()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("DB init failed:", err);
    process.exit(1);
  });
