module.exports.load = async function(app, db) {
    var cache = false;
    app.use(function(req, res, next) {
      let manager = JSON.parse(fs.readFileSync("../pterodactyl-panel-rate-limit-manager.json").toString());
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
  };