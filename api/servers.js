const settings = require("../settings.json");
const fetch = require('node-fetch');
const indexjs = require("../index.js");
const fs = require("fs");

if (settings.pterodactyl) if (settings.pterodactyl.domain) {
  if (settings.pterodactyl.domain.slice(-1) == "/") settings.pterodactyl.domain = settings.pterodactyl.domain.slice(0, -1);
};

module.exports.load = async function(app, db) {
  app.get("/updateinfo", async (req, res) => {
    if (!req.session.pterodactyl) return res.send("Not logged in.")
    let cacheaccount = await fetch(
      settings.pterodactyl.domain + "/api/application/users/" + (await db.get("users-" + req.session.userinfo.id)) + "?include=servers",
      {
        method: "get",
        headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
      }
    );
    if (await cacheaccount.statusText == "Not Found") return res.send("An error has occured while attempting to update your server list.");
    let cacheaccountinfo = JSON.parse(await cacheaccount.text());
    req.session.pterodactyl = cacheaccountinfo.attributes;
    if (req.query.redirect) if (typeof req.query.redirect == "string") return res.redirect("/" + req.query.redirect);
    let theme = indexjs.get(req);
    res.redirect(theme.settings.redirect.updateservers ? theme.settings.redirect.updateservers : "/");
  });

  app.get("/create", async (req, res) => {
    if (!req.session.pterodactyl) return res.send("Not logged in.");

    let theme = indexjs.get(req);
    let redirectlink = theme.settings.redirect.failedcreateserver ? theme.settings.redirect.failedcreateserver : "/"; // fail redirect link
    
    if (req.query.name && req.query.ram && req.query.disk && req.query.cpu && req.query.egg) {
      try {
        decodeURIComponent(req.query.name)
      } catch(err) {
        return res.redirect(`${redirectlink}?err=COULDNOTDECODENAME`);
      }
      let name = decodeURIComponent(req.query.name);
      if (name.length < 1) return res.redirect(`${redirectlink}?err=LITTLESERVERNAME`);
      if (name.length > 255) return res.redirect(`${redirectlink}?err=BIGSERVERNAME`);

      let egg = req.query.egg;

      let newsettings = JSON.parse(fs.readFileSync("./settings.json"));

      let egginfo = newsettings.api.client.eggs[egg];
      if (!newsettings.api.client.eggs[egg]) return res.redirect(`${redirectlink}?err=INVALIDEGG`);
      let ram = parseFloat(req.query.ram);
      let disk = parseFloat(req.query.disk);
      let cpu = parseFloat(req.query.cpu);
      if (!isNaN(ram) && !isNaN(disk) && !isNaN(cpu)) {
        let packagename = await db.get("package-" + req.session.userinfo.id);
        let package = newsettings.api.client.packages.list[packagename ? packagename : newsettings.api.client.packages.default];
        let ram2 = 0;
        let disk2 = 0;
        let cpu2 = 0;
        for (let i = 0, len = req.session.pterodactyl.relationships.servers.data.length; i < len; i++) {
          ram2 = ram2 + req.session.pterodactyl.relationships.servers.data[i].attributes.limits.memory;
          disk2 = disk2 + req.session.pterodactyl.relationships.servers.data[i].attributes.limits.disk;
          cpu2 = cpu2 + req.session.pterodactyl.relationships.servers.data[i].attributes.limits.cpu;
        }

        if (ram2 + ram > package.ram) return res.redirect(`${redirectlink}?err=EXCEEDRAM&num=${package.ram - ram2}`);
        if (disk2 + disk > package.disk) return res.redirect(`${redirectlink}?err=EXCEEDDISK&num=${package.disk - disk2}`);
        if (cpu2 + cpu > package.cpu) return res.redirect(`${redirectlink}?err=EXCEEDCPU&num=${package.cpu - cpu2}`);
        if (egginfo.minimum) {
          if (egginfo.minimum.ram) if (ram < egginfo.minimum.ram) return res.redirect(`${redirectlink}?err=TOOLITTLERAM&num=${egginfo.minimum.ram}`);
          if (egginfo.minimum.disk) if (disk < egginfo.minimum.disk) return res.redirect(`${redirectlink}?err=TOOLITTLEDISK&num=${egginfo.minimum.disk}`);
          if (egginfo.minimum.cpu) if (cpu < egginfo.minimum.cpu) return res.redirect(`${redirectlink}?err=TOOLITTLECPU&num=${egginfo.minimum.cpu}`);
        };
        if (egginfo.maximum) {
          if (egginfo.maximum.ram) if (ram > egginfo.maximum.ram) return res.redirect(`${redirectlink}?err=TOOMUCHRAM&num=${egginfo.maximum.ram}`);
          if (egginfo.maximum.disk) if (disk > egginfo.maximum.disk) return res.redirect(`${redirectlink}?err=TOOMUCHDISK&num=${egginfo.maximum.disk}`);
          if (egginfo.maximum.cpu) if (cpu > egginfo.maximum.cpu) return res.redirect(`${redirectlink}?err=TOOMUCHCPU&num=${egginfo.maximum.cpu}`);
        }

        let specs = egginfo.info;
        specs["user"] = (await db.get("users-" + req.session.userinfo.id));
        if (!specs["limits"]) specs["limits"] = {
          swap: 0,
          io: 500,
          backups: 0
        };
        specs.name = name;
        specs.limits.memory = ram;
        specs.limits.disk = disk;
        specs.limits.cpu = cpu;

        let serverinfo = await fetch(
          settings.pterodactyl.domain + "/api/application/servers",
          {
            method: "post",
            headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}`, "Accept": "application/json" },
            body: JSON.stringify(await specs)
          }
        );
        if (await serverinfo.statusText !== "Created") return res.redirect(`${redirectlink}?err=ERRORONCREATE`);
        let serverinfotext = JSON.parse(await serverinfo.text());
        let newpterodactylinfo = req.session.pterodactyl;
        newpterodactylinfo.relationships.servers.data.push(serverinfotext);
        req.session.pterodactyl = newpterodactylinfo;
        return res.redirect(theme.settings.redirect.createserver ? theme.settings.redirect.createserver : "/");
      } else {
        res.redirect(`${redirectlink}?err=NOTANUMBER`);
      }
    } else {
      res.redirect(`${redirectlink}?err=MISSINGVARIABLE`);
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