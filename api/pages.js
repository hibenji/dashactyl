const indexjs = require("../index.js");
const ejs = require("ejs");
const express = require("express");
const settings = require("../settings.json");

const renderdataeval =
  `//(async () => {
    let renderdata = {
      req: req,
      settings: settings,
      userinfo: req.session.userinfo,
      pterodactyl: req.session.pterodactyl,
      extra: theme.settings.variables
    };
    renderdata;
    //return renderdata;
  //})();`;

module.exports.load = async function(app, db) {
    app.get("/", async (req, res) => {
        if (req.session.pterodactyl) if (req.session.pterodactyl.id !== await db.get("users-" + req.session.userinfo.id)) return res.redirect("/login?prompt=none")
        let theme = indexjs.get(req);
        if (theme.settings.mustbeloggedin.includes(req._parsedUrl.pathname)) if (!req.session.userinfo || !req.session.pterodactyl) return res.redirect("/login");
        ejs.renderFile(
          `./themes/${theme.name}/${theme.settings.index}`, 
          await eval(renderdataeval),
          null,
        function (err, str) {
          if (err) {
            console.log(`[WEBSITE] An error has occured on path ${req._parsedUrl.pathname}:`);
            console.log(err);
            return res.send("404");
          };
          delete req.session.newaccount;
          res.send(str);
        });
      });

    app.use('/assets', express.static('./assets'));

    app.get("*", async (req, res) => {
      if (req.session.pterodactyl) if (req.session.pterodactyl.id !== await db.get("users-" + req.session.userinfo.id)) return res.redirect("/login?prompt=none");
      let theme = indexjs.get(req);
      if (theme.settings.mustbeloggedin.includes(req._parsedUrl.pathname)) if (!req.session.userinfo || !req.session.pterodactyl) return res.redirect("/login" + (req._parsedUrl.pathname.slice(0, 1) == "/" ? "?redirect=" + req._parsedUrl.pathname.slice(1) : ""));
      ejs.renderFile(
        `./themes/${theme.name}/${theme.settings.pages[req._parsedUrl.pathname.slice(1)] ? theme.settings.pages[req._parsedUrl.pathname.slice(1)] : theme.settings.notfound}`, 
        await eval(renderdataeval),
        null,
      function (err, str) {
        delete req.session.newaccount;
        if (err) {
          console.log(`[WEBSITE] An error has occured on path ${req._parsedUrl.pathname}:`);
          console.log(err);
          return res.send("404");
        };
        res.send(str);
      });
    });
};