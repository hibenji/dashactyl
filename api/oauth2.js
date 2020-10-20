const fs = require("fs");

const settings = require("../settings.json")
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

const fetch = require('node-fetch');

const indexjs = require("../index.js")

module.exports.load = async function(app) {
  app.get("/login", async (req, res) => {
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${settings.api.client.oauth2.id}&redirect_uri=${encodeURIComponent(settings.api.client.oauth2.link + settings.api.client.oauth2.callbackpath)}&response_type=code&scope=identify%20email${settings.api.client.oauth2.prompt == false ? "&prompt=none" : ""}`);
  });

  app.get("/logout", (req, res) => {
    req.session.destroy(() => {
      return res.redirect("/");
    });
  });

  app.get(settings.api.client.oauth2.callbackpath, async (req, res) => {
    if (!req.query.code) return res.send("Missing code.")
    fetch(
      'https://discordapp.com/api/oauth2/token',
      {
        method: "post",
        body: "client_id=" + settings.api.client.oauth2.id + "&client_secret=" + settings.api.client.oauth2.secret + "&grant_type=authorization_code&code=" + encodeURIComponent(req.query.code) + "&redirect_uri=" + encodeURIComponent(settings.api.client.oauth2.link + settings.api.client.oauth2.callbackpath),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    )
    .then(json => {
      callbackfunc(json);
      async function callbackfunc(json) {
        if (json.ok == true) {
          let codeinfo = JSON.parse(await json.text());
          let scopes = codeinfo.scope;
          let missingscopes = [];
          if (scopes.replace(/identify/g, "") == scopes) missingscopes.push("identify");
          if (scopes.replace(/email/g, "") == scopes) missingscopes.push("email");
          if (missingscopes.length !== 0) return res.send("Missing scopes: " + missingscopes.join(", "));
          fetch(
            'https://discordapp.com/api/users/@me',
            {
              method: "get",
              headers: {
                "Authorization": `Bearer ${codeinfo.access_token}`
              }
            }
          ).then(userjson => {
            callbackfunc2(userjson);
            async function callbackfunc2(userjson) {
              let userinfo = JSON.parse(await userjson.text());
              req.session.userinfo = userinfo;
              let theme = indexjs.get(req);
              return res.redirect(theme.settings.callbackredirect ? theme.settings.callbackredirect : "/");
            };
          });
        } else {
          res.send("Invalid code.");
        };
      };
    });
  });
};