// 実行: node test/run.js
const assert = require("assert");
const { WORDS } = require("../js/words.js");
const { normalizeAnswer, isCorrect } = require("../js/judge.js");

// データ整合性：漢字とハングルは1字1音節で対応している
const seen = new Set();
for (const w of WORDS) {
  assert.strictEqual([...w.hanja].length, [...w.ko].length, `文字数不一致: ${w.ko} / ${w.hanja}`);
  assert.ok(/^[가-힣]+$/.test(w.ko), `ハングル以外を含む: ${w.ko}`);
  assert.ok(w.ja.length > 0, `正解なし: ${w.ko}`);
  assert.ok([1, 2].includes(w.level), `レベル不正: ${w.ko}`);
  assert.ok(!seen.has(w.ko), `重複: ${w.ko}`);
  seen.add(w.ko);
}

// 判定
const school = WORDS.find((w) => w.ko === "학교");
assert.ok(isCorrect(school, "学校"));
assert.ok(isCorrect(school, "がっこう"));
assert.ok(isCorrect(school, "ガッコウ"));
assert.ok(isCorrect(school, " がっこう。"));
assert.ok(!isCorrect(school, "學校"));
assert.ok(!isCorrect(school, ""));
assert.ok(isCorrect(WORDS.find((w) => w.ko === "공부"), "べんきょう"));
assert.ok(!isCorrect(WORDS.find((w) => w.ko === "공부"), "くふう"));
assert.strictEqual(normalizeAnswer("ＡＢＣ　テスト"), "abcてすと");

console.log(`OK: ${WORDS.length} words`);
