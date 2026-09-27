// 解答判定ユーティリティ（ブラウザ / Node 共通）

// 全角半角・カタカナ・空白・記号の揺れを吸収する
function normalizeAnswer(s) {
  return String(s)
    .normalize("NFKC")
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s。、．，.,!?！？「」『』（）()・]/g, "")
    .toLowerCase();
}

function isCorrect(word, input) {
  const a = normalizeAnswer(input);
  if (!a) return false;
  return word.ja.some((j) => normalizeAnswer(j) === a);
}

if (typeof module !== "undefined") module.exports = { normalizeAnswer, isCorrect };
