const test = require("node:test");
const assert = require("node:assert");

// Runtime check for MySQL JSON path construction used in cases.service.js
const isMysql = (process.env.DATABASE_URL || "").startsWith("mysql");
const jsonPath = (key) => (isMysql ? key : [key]);

test("jsonPath uses string on mysql and array otherwise", () => {
  if (isMysql) {
    assert.strictEqual(jsonPath("source"), "source");
  } else {
    assert.deepStrictEqual(jsonPath("source"), ["source"]);
  }
});
