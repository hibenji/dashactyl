const settings = require("../settings.json");

module.exports.load = async function(app, db) {
    if (settings.api.client.allow.renewsuspendsystem.enabled == true) {

        let renewalservers = {};
        
        const indexjs = require("../index.js");
        const fetch = require('node-fetch');

        setInterval(async () => {
            for (let [id, value] of Object.entries(renewalservers)) {
                renewalservers[id]--;
                if (renewalservers[id] < 1) {
                    let canpass = await indexjs.islimited();
                    if (canpass == false) return;
                    indexjs.ratelimits(1);
                    await fetch(
                        settings.pterodactyl.domain + "/api/application/servers/" + id + "/suspend",
                        {
                          method: "post",
                          headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
                        }
                    );
                    delete renewalservers[id];
                }
            }
        }, 1000);

        app.get("/renew", async (req, res) => {
            if (!req.session.pterodactyl) return res.send("Not logged in.");
        
            if (!req.query.id) return res.send("Missing id.");
            if (!req.session.pterodactyl.relationships.servers.data.filter(server => server.attributes.id == req.query.id)) return res.send("Could not find server with that ID.");
        
            let theme = indexjs.get(req);
            
            renewalservers[req.query.id] = settings.api.client.allow.renewsuspendsystem.time;
            
            await fetch(
                settings.pterodactyl.domain + "/api/application/servers/" + req.query.id + "/unsuspend",
                {
                  method: "post",
                  headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
                }
            );
        
            return res.redirect(theme.settings.redirect.renewserver ? theme.settings.redirect.renewserver : "/");
        });

        module.exports.set = async function(id) {
            renewalservers[id] = settings.api.client.allow.renewsuspendsystem.time;
        }

        module.exports.delete = async function(id) {
            delete renewalservers[id];
        }
    }
};