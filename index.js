"use strict";

// Load settings.

const settings = require("./settings.json");

const defaultthemesettings = {
  "index": "index.ejs",
  "notfound": "404.ejs",
  "pages": {},
  "mustbeloggedin": [],
  "variables": undefined,
  "callbackredirect": "/"
}

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

// Load database

const Keyv = require("keyv");
const keyv = new Keyv(settings.database);

keyv.on('error', err => {
  console.log("[DATABASE] An error has occured when attempting to access the database.")
});

// Load packages.

const fs = require("fs");
const indexjs = require("./index.js");

// Load websites.

const express = require("express");
const app = express();

// Load express addons.

const ejs = require("ejs");
const session = require("express-session");

// Load the website.

app.use(session({secret: settings.website.secret}));

app.use(express.json({
  inflate: true,
  limit: '500kb',
  reviver: null,
  strict: true,
  type: 'application/json',
  verify: undefined
}));

var cache = false;
app.use(function(req, res, next) { // Caching manager.
  let manager = JSON.parse(fs.readFileSync("pterodactyl-panel-rate-limit-manager.json").toString());
  if (manager[req._parsedUrl.pathname]) {
    if (cache == true) {
      setTimeout(async () => {
        res.redirect(req.originalUrl);
      }, 1000);
      return;
    } else {
      cache = true;
      setTimeout(async () => {
        cache = false;
      }, 1000 * manager[req._parsedUrl.pathname]);
    }
  };
  next();
});

const listener = app.listen(settings.website.port, function() {
  console.log("[WEBSITE] The dashboard has successfully loaded on port " + listener.address().port + ".");
});

// Home Page

app.get("/", async (req, res) => {
  if (req.session.pterodactyl) if (req.session.pterodactyl.id !== await keyv.get("users-" + req.session.userinfo.id)) return res.redirect("/login?prompt=none")
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

// Load the API files.

let apifiles = fs.readdirSync('./api').filter(file => file.endsWith('.js'));

for (let file of apifiles) {
	(require(`./api/${file}`)).load(app, keyv);
}

// Custom Pages + Assets

app.use('/assets', express.static('./assets'));

app.get("*", async (req, res) => {
  if (req.session.pterodactyl) if (req.session.pterodactyl.id !== await keyv.get("users-" + req.session.userinfo.id)) return res.redirect("/login?prompt=none");
  let theme = indexjs.get(req);
  if (theme.settings.mustbeloggedin.includes(req._parsedUrl.pathname)) if (!req.session.userinfo || !req.session.pterodactyl) return res.redirect("/login");
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

module.exports.get = function get(req) {
  let tname = getCookie(req, "theme");
  let name = (
    tname ?
      fs.existsSync(`./themes/${tname}`) ?
        tname
      : "default"
    : "default"
  )
  return {
    settings: (
      fs.existsSync(`./themes/${name}/pages.json`) ?
        JSON.parse(fs.readFileSync(`./themes/${name}/pages.json`).toString())
      : defaultthemesettings
    ),
    name: name
  };
};

// Get a cookie.
function getCookie(req, cname) {
  let cookies = req.headers.cookie;
  if (!cookies) return null;
  let name = cname + "=";
  let ca = cookies.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return decodeURIComponent(c.substring(name.length, c.length));
    }
  }
  return "";
}