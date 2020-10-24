const indexjs = require("../index.js");
const ejs = require("ejs");
const express = require("express");
const settings = require("../settings.json");

module.exports.load = async function(app, db) {
  app.get("/", async (req, res) => {
    if (req.session.pterodactyl) if (req.session.pterodactyl.id !== await db.get("users-" + req.session.userinfo.id)) return res.redirect("/login?prompt=none")
    let theme = indexjs.get(req);
    if (theme.settings.mustbeloggedin.includes(req._parsedUrl.pathname)) if (!req.session.userinfo || !req.session.pterodactyl) return res.redirect("/login");
    ejs.renderFile(
      `./themes/${theme.name}/${theme.settings.index}`, 
      await eval(indexjs.renderdataeval),
      null,
    function (err, str) {
      if (err) {
        console.log(`[WEBSITE] An error has occured on path ${req._parsedUrl.pathname}:`);
        console.log(err);
        return res.send("An error has occured while attempting to load this page. Please contact an administrator to fix this.");
      };
      delete req.session.newaccount;
      res.send(str);
    });
  });

  app.use('/assets', express.static('./assets'));
};