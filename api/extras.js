const settings = require("../settings.json");

module.exports.load = async function(app, db) {
  app.get("/panel", async (req, res) => {
    res.redirect(settings.pterodactyl.domain);
  });
};