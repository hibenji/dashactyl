"use strict";

const settings = require("../settings.json");
if (settings.api) {
  if (settings.api.client) {
      if (settings.api.client.oauth2) {
          if (settings.api.client.oauth2.link) {
              if (settings.api.client.oauth2.link.slice(-1) == "/") settings.api.client.oauth2.link = settings.api.client.oauth2.link.slice(0, -1);
          }
          if (settings.api.client.oauth2.callbackpath) {
              if (settings.api.client.oauth2.callbackpath.slice(0, 1) !== "/") settings.api.client.oauth2.callbackpath = "/" + settings.api.client.oauth2.callbackpath;
          }
      };
  };
};

if (settings.pterodactyl) if (settings.pterodactyl.domain) {
  if (settings.pterodactyl.domain.slice(-1) == "/") settings.pterodactyl.domain = settings.pterodactyl.domain.slice(0, -1);
};

const fetch = require('node-fetch');

const indexjs = require("../index.js");

const fs = require("fs");

module.exports.load = async function(app, db) {
  app.get("/login", async (req, res) => {
    if (req.query.redirect) req.session.redirect = "/" + req.query.redirect
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${settings.api.client.oauth2.id}&redirect_uri=${encodeURIComponent(settings.api.client.oauth2.link + settings.api.client.oauth2.callbackpath)}&response_type=code&scope=identify%20email${settings.api.client.oauth2.prompt == false ? "&prompt=none" : (req.query.prompt ? (req.query.prompt == "none" ? "&prompt=none" : "") : "")}`);
  });

  app.get("/logout", (req, res) => {
    let theme = indexjs.get(req);
    req.session.destroy(() => {
      return res.redirect(theme.settings.redirect.logout ? theme.settings.redirect.logout : "/");
    });
  });

  app.get(settings.api.client.oauth2.callbackpath, async (req, res) => {
    let customredirect = req.session.redirect;
    delete req.session.redirect;
    if (!req.query.code) return res.send("Missing code.")
    let json = await fetch(
      'https://discordapp.com/api/oauth2/token',
      {
        method: "post",
        body: "client_id=" + settings.api.client.oauth2.id + "&client_secret=" + settings.api.client.oauth2.secret + "&grant_type=authorization_code&code=" + encodeURIComponent(req.query.code) + "&redirect_uri=" + encodeURIComponent(settings.api.client.oauth2.link + settings.api.client.oauth2.callbackpath),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );
    if (json.ok == true) {
      let codeinfo = JSON.parse(await json.text());
      let scopes = codeinfo.scope;
      let missingscopes = [];
      if (scopes.replace(/identify/g, "") == scopes) missingscopes.push("identify");
      if (scopes.replace(/email/g, "") == scopes) missingscopes.push("email");
      if (missingscopes.length !== 0) return res.send("Missing scopes: " + missingscopes.join(", "));
      let userjson = await fetch(
        'https://discordapp.com/api/users/@me',
        {
          method: "get",
          headers: {
            "Authorization": `Bearer ${codeinfo.access_token}`
          }
        }
      );
      let userinfo = JSON.parse(await userjson.text());
      if (userinfo.verified == true) {
        if (!await db.get("users-" + userinfo.id)) {
          let newsettings = JSON.parse(fs.readFileSync("./settings.json"));
          if (newsettings.api.client.allow.newusers == true) {
            let genpassword = null;
            if (typeof newsettings.api.client.passwordgenerator.signup == true) genpassword = makeid(newsettings.api.client.passwordgenerator["length"]);
            let accountjson = await fetch(
              settings.pterodactyl.domain + "/api/application/users",
              {
                method: "post",
                headers: {
                  'Content-Type': 'application/json',
                  "Authorization": `Bearer ${settings.pterodactyl.key}`
                },
                body: JSON.stringify({
                  username: userinfo.id,
                  email: userinfo.email,
                  first_name: userinfo.username,
                  last_name: "#" + userinfo.discriminator,
                  password: genpassword
                })
              }
            );
            if (await accountjson.status == 201) {
              let accountinfo = JSON.parse(await accountjson.text());
              let userids = await db.get("users") ? await db.get("users") : [];
              userids.push(accountinfo.attributes.id);
              await db.set("users", userids);
              await db.set("users-" + userinfo.id, accountinfo.attributes.id);
              req.session.newaccount = true;
              req.session.password = genpassword;
              return res.redirect("/login?prompt=true");
            } else {
              let accountlistjson = await fetch(
                settings.pterodactyl.domain + "/api/application/users?include=servers",
                {
                  method: "get",
                  headers: {
                    'Content-Type': 'application/json',
                    "Authorization": `Bearer ${settings.pterodactyl.key}`
                  }
                }
              );
              let accountlist = JSON.parse(await accountlistjson.text());
              let user = accountlist.data.filter(acc => acc.attributes.email == userinfo.email);
              if (user.length == 1) {
                let userid = user[0].attributes.id;
                let userids = await db.get("users") ? await db.get("users") : [];
                if (userids.filter(id => id == userid).length == 0) {
                  userids.push(userid);
                  await db.set("users", userids);
                  await db.set("users-" + userinfo.id, userid);
                  req.session.pterodactyl = user[0].attributes;
                } else {
                  return res.send("We have detected an account with your Discord email on it but the user id has already been claimed on another Discord account.");
                }
              } else {
                return res.send("An error has occured when attempting to create your account.");
              };
            };
          } else {
            return res.send("New users cannot signup currently.")
          }
        } else {
          let cacheaccount = await fetch(
            settings.pterodactyl.domain + "/api/application/users/" + (await db.get("users-" + userinfo.id)) + "?include=servers",
            {
              method: "get",
              headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
            }
          );
          if (await cacheaccount.statusText == "Not Found") return res.send("An error has occured while attempting to get your user information.");
          let cacheaccountinfo = JSON.parse(await cacheaccount.text());
          req.session.pterodactyl = cacheaccountinfo.attributes;
        };
        req.session.userinfo = userinfo;
        let theme = indexjs.get(req);
        if (customredirect) return res.redirect(customredirect);
        return res.redirect(theme.settings.redirect.callback ? theme.settings.redirect.callback : "/");
      };
      res.send("Not verified a Discord account.");
    } else {
      res.send("Invalid code.");
    };
  });
};

function makeid(length) {
  let result = '';
  let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
     result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}