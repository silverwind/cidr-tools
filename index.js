"use strict";

const execa = require("execa");
const fs = require("mz/fs");
const path = require("path");
const tempfile = require("tempfile");

const merge = path.join(__dirname, "cidr-merge.py");
const exclude = path.join(__dirname, "cidr-exclude.py");

module.exports.merge = function(nets) {
  return new Promise(function(resolve, reject) {
    if (!Array.isArray(nets)) return reject(new Error("Expected an array"));
    const netfile = tempfile(".net");
    fs.writeFile(netfile, nets.join("\n")).then(function() {
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
    if (!Array.isArray(basenets) || !Array.isArray(excludenets)) {
      return reject(new Error("Expected an array"));
    }
    const basefile = tempfile(".net");
    const excludefile = tempfile(".net");
    fs.writeFile(basefile, basenets.join("\n")).then(function() {
      fs.writeFile(excludefile, excludenets.join("\n")).then(function() {
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
