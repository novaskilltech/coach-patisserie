const fs = require("fs");
const path = require("path");

function normalizeSessionTitle(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, "\"")
    .trim();
}

function extractSessionsFromWeekMarkdown(content) {
  const lines = content.split(/\r?\n/);
  const sessions = [];
  const seen = new Set();

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/S\s*([1-5])\s*[\u2013\u2014-]\s*(.+)$/);
    if (!match) continue;

    const num = Number(match[1]);
    if (seen.has(num)) continue;
    seen.add(num);

    let title = normalizeSessionTitle(match[2]);
    let next = index + 1;
    while (
      title.length < 58 &&
      next < lines.length &&
      lines[next].trim() &&
      !/Objectifs|But|D[ée]roul[ée]|Points|Ce que|R[oô]le/i.test(lines[next]) &&
      !/S\s*[1-5]\s*[\u2013\u2014-]/.test(lines[next])
    ) {
      title = normalizeSessionTitle(`${title} ${lines[next]}`);
      next += 1;
    }

    sessions.push({ num, label: `S${num}`, titre: title });
  }

  return sessions.sort((a, b) => a.num - b.num);
}

function buildProgrammeSessionsIndex() {
  const sessions = {};
  const programmeDir = path.join(process.cwd(), "functions", "programme_cap");

  for (let week = 1; week <= 52; week += 1) {
    const filePath = path.join(programmeDir, `semaine_${week}.md`);
    if (!fs.existsSync(filePath)) continue;
    sessions[week] = extractSessionsFromWeekMarkdown(fs.readFileSync(filePath, "utf8"));
  }

  return sessions;
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  res.status(200).json({ sessions: buildProgrammeSessionsIndex() });
};
