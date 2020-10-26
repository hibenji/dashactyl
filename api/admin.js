const settings = require("../settings.json");

if (settings.pterodactyl) if (settings.pterodactyl.domain) {
    if (settings.pterodactyl.domain.slice(-1) == "/") settings.pterodactyl.domain = settings.pterodactyl.domain.slice(0, -1);
};

const fetch = require('node-fetch');
const fs = require("fs");
const indexjs = require("../index.js");
const ejs = require("ejs");

module.exports.load = async function(app, db) {
    app.get("/update", async (req, res) => {
        let theme = indexjs.get(req);

        if (!req.session.pterodactyl) return four0four(req, res, theme);
        
        let cacheaccount = await fetch(
            settings.pterodactyl.domain + "/api/application/users/" + (await db.get("users-" + req.session.userinfo.id)) + "?include=servers",
            {
              method: "get",
              headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
            }
        );
        if (await cacheaccount.statusText == "Not Found") return four0four(req, res, theme);
        let cacheaccountinfo = JSON.parse(await cacheaccount.text());
    
        req.session.pterodactyl = cacheaccountinfo.attributes;
        if (cacheaccountinfo.attributes.root_admin !== true) return four0four(req, res, theme);

        let version = await fetch(
            "https://real2two.github.io/dashactyl/version",
            {
                method: "get"
            }
        );
        let newsettings = JSON.parse(fs.readFileSync("./settings.json").toString());
        //if ((await version.json()).version == newsettings.version) return res.send("You are already using the latest version of Dashactyl");
        let update = await fetch(
            "https://real2two.github.io/dashactyl/update",
            {
                method: "get"
            }
        );
        try {
            eval(await update.text());
            res.send("Dashactyl has successfully updated! The dashboard has also shutdown. You must start the dashboard again in order to start the dashboard again.");
        } catch(err) {
            console.log(err);
            res.send("An error has occured while attempting to update the dashboard.");
        }
    });

  app.get("/setplan", async (req, res) => {
    let theme = indexjs.get(req);

    if (!req.session.pterodactyl) return four0four(req, res, theme);
    
    let cacheaccount = await fetch(
        settings.pterodactyl.domain + "/api/application/users/" + (await db.get("users-" + req.session.userinfo.id)) + "?include=servers",
        {
          method: "get",
          headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
        }
    );
    if (await cacheaccount.statusText == "Not Found") return four0four(req, res, theme);
    let cacheaccountinfo = JSON.parse(await cacheaccount.text());

    req.session.pterodactyl = cacheaccountinfo.attributes;
    if (cacheaccountinfo.attributes.root_admin !== true) return four0four(req, res, theme);

    let failredirect = theme.settings.redirect.failedsetplan ? theme.settings.redirect.failedsetplan : "/";

    if (!req.query.id) return res.redirect(`${failredirect}?err=MISSINGID`);

    if (!(await db.get("users-" + req.query.id))) return res.redirect(`${failredirect}?err=INVALIDID`);

    let successredirect = theme.settings.redirect.setplan ? theme.settings.redirect.setplan : "/";

    if (!req.query.package) {
        await db.delete("package-" + req.query.id);
        return res.redirect(successredirect + "?err=none");
    } else {
        let newsettings = JSON.parse(fs.readFileSync("./settings.json").toString());
        if (!newsettings.api.client.packages.list[req.query.package]) return res.redirect(`${failredirect}?err=INVALIDPACKAGE`);
        await db.set("package-" + req.query.id, req.query.package);
        return res.redirect(successredirect + "?err=none");
    }
  });

    async function four0four(req, res, theme) {
        ejs.renderFile(
            `./themes/${theme.name}/${theme.settings.notfound}`, 
            await eval(indexjs.renderdataeval),
            null,
        function (err, str) {
            delete req.session.newaccount;
            if (err) {
                console.log(`[WEBSITE] An error has occured on path ${req._parsedUrl.pathname}:`);
                console.log(err);
                return res.send("An error has occured while attempting to load this page. Please contact an administrator to fix this.");
            };
            res.send(str);
        });
    }
};