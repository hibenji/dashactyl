const settings = require("../settings.json");
const fetch = require('node-fetch');
const indexjs = require("../index.js");

module.exports.load = async function(app, db) {
  app.get("/create", async (req, res) => {
    if (!req.session.pterodactyl) return res.send("Not logged in.")
    
    if (req.query.ram && req.query.disk && req.query.cpu && req.query.egg) {
      let egg = req.query.egg;
      let ram = parseFloat(req.query.ram);
      let disk = parseFloat(req.query.disk);
      let cpu = parseFloat(req.query.cpu);
      if (!isNaN(ram) && !isNaN(disk) && !isNaN(cpu)) {
        res.send({
          unfinished: "endpoint",
          egg: egg,
          ram: ram,
          disk: disk,
          cpu: cpu
        });
      } else {
        res.send("ram, disk and/or cpu is not a number")
      }
    } else {
      res.send("missing ram, disk, cpu and/or egg")
    }
  });

  app.get("/delete", async (req, res) => {
    if (!req.query.id) return res.send("Missing id.");
    if (!req.session.pterodactyl) return res.send("Not logged in.")
    if (!req.session.pterodactyl.relationships.servers.data.filter(server => server.attributes.id == req.query.id)) return res.send("Could not find server with that ID.");

    let deletionresults = await fetch(
      settings.pterodactyl.domain + "/api/application/servers/" + req.query.id,
      {
        method: "delete",
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${settings.pterodactyl.key}`
        }
      }
    );
    let ok = await deletionresults.ok;
    if (ok !== true) return res.send("An error has occur while attempting to delete the server.");
    let pterodactylinfo = req.session.pterodactyl;
    pterodactylinfo.relationships.servers.data = pterodactylinfo.relationships.servers.data.filter(server => server.attributes.id.toString() !== req.query.id);
    req.session.pterodactyl = pterodactylinfo;

    let theme = indexjs.get(req);

    return res.redirect(theme.settings.redirect.deleteserver ? theme.settings.redirect.deleteserver : "/");
  });
};