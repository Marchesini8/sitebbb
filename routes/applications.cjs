const express = require("express");
const applicationStore = require("../services/applicationStore.cjs");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const application = await applicationStore.saveApplication(req.body || {});
    return res.status(201).json({
      ok: true,
      application,
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message || "Não foi possível salvar a inscrição.",
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const applications = await applicationStore.listApplications();
    return res.json({
      ok: true,
      applications,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Não foi possível listar as inscrições.",
    });
  }
});

module.exports = router;
