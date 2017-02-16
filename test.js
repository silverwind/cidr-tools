import test from "ava";
import m from ".";

test("merge v4 nets", async function(t) {
  t.deepEqual(await m.merge(["1.0.0.0/24", "1.0.1.0/24"]), ["1.0.0.0/23"]);
});

test("merge v6 nets", async function(t) {
  t.deepEqual(await m.merge(["::0/128", "::1/128"]), ["::/127"]);
});

test("merge mixed", async function(t) {
  t.deepEqual(await m.merge(["::0/128", "1.2.3.4/24"]), ["1.2.3.4/24", "::/128"]);
});

test("exclude v4 nets", async function(t) {
  t.deepEqual(await m.exclude(["1.0.0.0/23"], ["1.0.1.0/24"]), ["1.0.0.0/24"]);
});

test("exclude v4 nets #2", async function(t) {
  t.deepEqual(await m.exclude(["1.0.0.0/24"], ["1.0.0.0/16"]), []);
});

test("exclude v6 nets", async function(t) {
  t.deepEqual(await m.exclude(["::/127"], ["::1/128"]), ["::/128"]);
});

test("exclude v6 nets #2", async function(t) {
  t.deepEqual(await m.exclude(["::/120"], ["::1/112"]), []);
});

test("exclude mixed", async function(t) {
  t.deepEqual(await m.exclude(["::0/127", "1.2.3.0/24"], ["::/128"]), ["1.2.3.0/24", "::1/128"]);
});

test("exclude mixed #2", async function(t) {
  t.deepEqual(await m.exclude(["::0/127", "1.2.3.0/24"], ["::/0", "0.0.0.0/0"]), []);
});
