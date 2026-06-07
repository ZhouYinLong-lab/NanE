const XIANLIN_GROUPS = [
  range(16, 24).concat([26, 27]),
  range(1, 5),
  range(6, 11),
  range(12, 15).concat(range(28, 30)),
  [25]
];

const PUKOU_GROUPS = [
  range(1, 6),
  range(7, 8),
  range(9, 11),
  range(12, 15),
  range(16, 18),
  range(19, 21),
  range(22, 25),
  range(26, 29)
];

const SUZHOU_GARDENS = {
  真园: ["甲"],
  知园: ["甲", "乙", "丙"],
  仁园: ["甲", "乙", "丙", "丁", "戊", "己"],
  勇园: ["甲", "乙", "丙"],
  勤园: ["甲", "乙", "丙"],
  朴园: ["甲", "乙"],
  诚园: ["甲", "乙", "丙"]
};

const LETTER_NUMBER = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  甲: 1,
  乙: 2,
  丙: 3,
  丁: 4,
  戊: 5,
  己: 6
};

function range(start, end) {
  const values = [];
  for (let value = start; value <= end; value += 1) {
    values.push(value);
  }
  return values;
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[（）()_\-/]/g, "");
}

function normalizeCampus(campus) {
  return normalizeText(campus).replace(/校区/g, "");
}

function buildingNumber(building) {
  const text = normalizeText(building);
  const number = text.match(/\d+/);
  if (number) {
    return Number(number[0]);
  }
  const letter = text.match(/[ABCDEF甲乙丙丁戊己]/);
  return letter ? LETTER_NUMBER[letter[0]] : null;
}

function numericGroupId(prefix, number, groups) {
  if (!number) {
    return "";
  }
  const index = groups.findIndex(group => group.includes(number));
  return index === -1 ? "" : `${prefix}-${index}`;
}

function suzhouGroupId(building) {
  const text = normalizeText(building);
  for (const [garden, letters] of Object.entries(SUZHOU_GARDENS)) {
    if (!text.includes(garden)) {
      continue;
    }
    const letter = letters.find(value => text.includes(value));
    return letter ? `suzhou-${garden}` : "";
  }
  return "";
}

function dormGroupId(campus, building) {
  const campusName = normalizeCampus(campus);
  if (campusName.includes("仙林")) {
    return numericGroupId("xianlin", buildingNumber(building), XIANLIN_GROUPS);
  }
  if (campusName.includes("苏州")) {
    return suzhouGroupId(building);
  }
  if (campusName.includes("浦口")) {
    return numericGroupId("pukou", buildingNumber(building), PUKOU_GROUPS);
  }
  return "";
}

function sameBuilding(left, right) {
  return normalizeText(left) === normalizeText(right);
}

function proximityForItem(row, viewer) {
  if (sameBuilding(row.building, viewer.building) && normalizeCampus(row.campus) === normalizeCampus(viewer.campus)) {
    return { rank: 0, scope: "same_building", label: "同楼栋优先" };
  }
  if (normalizeCampus(row.campus) !== normalizeCampus(viewer.campus)) {
    return { rank: 3, scope: "other_campus", label: "跨校区" };
  }

  const rowGroup = dormGroupId(row.campus, row.building);
  const viewerGroup = dormGroupId(viewer.campus, viewer.building);
  if (rowGroup && rowGroup === viewerGroup) {
    return { rank: 1, scope: "same_dorm_group", label: "同宿舍群" };
  }

  return { rank: 2, scope: "same_campus", label: "同校区" };
}

function sortByProximity(rows, viewer) {
  return rows.slice().sort((left, right) => {
    const leftRank = proximityForItem(left, viewer).rank;
    const rightRank = proximityForItem(right, viewer).rank;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });
}

module.exports = {
  dormGroupId,
  proximityForItem,
  sortByProximity
};
