"use strict";

const execa = require("execa");
const fs = require("mz/fs");
const path = require("path");
const tempfile = require("tempfile");

const merge = path.join(__dirname, "cidr-merge.py");
const exclude = path.join(__dirname, "cidr-exclude.py");
const expand = path.join(__dirname, "cidr-expand.py");

function parseNets(nets) {
  if (typeof nets === "string") {
    return nets;
  } else if (Array.isArray(nets)) {
    return nets.join("\n");
  }
}

module.exports.merge = function(nets) {
  return new Promise(function(resolve, reject) {
    if (!Array.isArray(nets) && typeof nets !== "string") {
      return reject(new Error("Expected an array or string, not " + nets));
    }

    const netfile = tempfile(".net");

    fs.writeFile(netfile, parseNets(nets)).then(function() {
      execa.stdout(merge, [netfile]).then(function(stdout) {
        resolve(stdout.split("\n").filter(net => Boolean(net)));
        fs.unlink(netfile);
      }).catch(function(err) {
        resolve(err);
        fs.unlink(netfile);
      });
    }).catch(reject);
  });
};

module.exports.exclude = function(basenets, excludenets) {
  return new Promise(function(resolve, reject) {
    if (!Array.isArray(basenets) && typeof basenets !== "string") {
      return reject(new Error("Expected an array or string, not " + basenets));
    }
    if (!Array.isArray(excludenets) && typeof excludenets !== "string") {
      return reject(new Error("Expected an array or string, not " + excludenets));
    }

    const basefile = tempfile(".net");
    const excludefile = tempfile(".net");

    fs.writeFile(basefile, parseNets(basenets)).then(function() {
      fs.writeFile(excludefile, parseNets(excludenets)).then(function() {
        execa.stdout(exclude, [basefile, excludefile]).then(function(stdout) {
          resolve(stdout.split("\n").filter(net => Boolean(net)));
          fs.unlink(basefile);
          fs.unlink(excludefile);
        }).catch(function(err) {
          resolve(err);
          fs.unlink(basefile);
          fs.unlink(excludefile);
        });
      }).catch(reject);
    }).catch(reject);
  });
};

module.exports.expand = function(nets) {
  return new Promise(function(resolve, reject) {
    if (!Array.isArray(nets) && typeof nets !== "string") {
      return reject(new Error("Expected an array or string, not " + nets));
    }

    const netfile = tempfile(".net");

    fs.writeFile(netfile, parseNets(nets)).then(function() {
      execa.stdout(expand, [netfile]).then(function(stdout) {
        resolve(stdout.split("\n").filter(net => Boolean(net)));
        fs.unlink(netfile);
      }).catch(function(err) {
        resolve(err);
        fs.unlink(netfile);
      });
    }).catch(reject);
  });
};
