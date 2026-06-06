const locations = require("../data/locations");

const ROOM_EMPTY = "不填写宿舍号";
const campusAliases = {
  鼓楼: "鼓楼校区",
  仙林: "仙林校区",
  苏州: "苏州校区",
  浦口: "浦口校区"
};
const chineseDigits = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10
};

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）\-_/]/g, "")
    .replace(/校区|宿舍楼|宿舍|房间|第\d+层|第[一二三四五六七八九十]+层/g, "")
    .replace(/南园/g, "南")
    .replace(/北园/g, "北")
    .replace(/舍|幢|栋|号楼|楼/g, "");
}

function parseChineseNumber(text) {
  const value = String(text || "");
  if (/^\d+$/.test(value)) {
    return Number(value);
  }
  if (value === "十") {
    return 10;
  }
  if (value.includes("十")) {
    const [left, right] = value.split("十");
    const tens = left ? chineseDigits[left] || 0 : 1;
    const ones = right ? chineseDigits[right] || 0 : 0;
    return tens * 10 + ones;
  }
  return chineseDigits[value];
}

function aliasesForBuilding(name) {
  const aliases = new Set([normalize(name)]);
  const raw = String(name || "");
  const numberMatch = raw.match(/(\d+)/);
  if (numberMatch) {
    const number = numberMatch[1];
    aliases.add(number);
    aliases.add(`${number}舍`);
    aliases.add(`${number}栋`);
    aliases.add(`${number}幢`);
    if (raw.includes("南园")) {
      aliases.add(`南${number}`);
    }
    if (raw.includes("北园")) {
      aliases.add(`北${number}`);
    }
  }
  return Array.from(aliases).map(normalize);
}

function getCampusNames() {
  return locations.map(campus => campus.name);
}

function getBuildings(campusIndex) {
  return (locations[campusIndex] && locations[campusIndex].buildings) || [];
}

function getRooms(campusIndex, buildingIndex) {
  const building = getBuildings(campusIndex)[buildingIndex];
  return [ROOM_EMPTY].concat(building ? building.rooms : []);
}

function buildPickerColumns(campusIndex, buildingIndex) {
  const campuses = getCampusNames();
  const buildings = getBuildings(campusIndex).map(building => building.name);
  const rooms = getRooms(campusIndex, buildingIndex);
  return [campuses, buildings, rooms];
}

function clampSelection(selection) {
  const campusIndex = Math.max(0, Math.min(selection[0] || 0, locations.length - 1));
  const buildingCount = getBuildings(campusIndex).length;
  const buildingIndex = Math.max(0, Math.min(selection[1] || 0, Math.max(buildingCount - 1, 0)));
  const roomCount = getRooms(campusIndex, buildingIndex).length;
  const roomIndex = Math.max(0, Math.min(selection[2] || 0, Math.max(roomCount - 1, 0)));
  return [campusIndex, buildingIndex, roomIndex];
}

function selectionToLocation(selection) {
  const [campusIndex, buildingIndex, roomIndex] = clampSelection(selection);
  const campus = locations[campusIndex];
  const building = getBuildings(campusIndex)[buildingIndex];
  const room = getRooms(campusIndex, buildingIndex)[roomIndex];
  return {
    campus: campus ? campus.name : "",
    building: building ? building.name : "",
    room: room && room !== ROOM_EMPTY ? room : "",
    selection: [campusIndex, buildingIndex, roomIndex],
    columns: buildPickerColumns(campusIndex, buildingIndex)
  };
}

function extractRoomNumber(text) {
  const match = String(text || "").match(/(\d{2,4})(?!.*\d)/);
  return match ? match[1] : "";
}

function findCampusIndex(input) {
  const normalized = normalize(input);
  for (const [alias, name] of Object.entries(campusAliases)) {
    if (normalized.includes(normalize(alias))) {
      return locations.findIndex(campus => campus.name === name);
    }
  }
  return locations.findIndex(campus => normalized.includes(normalize(campus.name)));
}

function findBuildingIndex(campusIndex, input) {
  const buildingInput = String(input || "").replace(/[\s,，]+(\d{3,4})\s*$/, "");
  const normalized = normalize(buildingInput);
  const buildings = getBuildings(campusIndex);
  let best = -1;
  let bestLength = 0;
  buildings.forEach((building, index) => {
    for (const alias of aliasesForBuilding(building.name)) {
      const numericAlias = /^\d+$/.test(alias);
      const matched = numericAlias
        ? new RegExp(`(^|[^0-9])${alias}([^0-9]|$)`).test(normalized)
        : normalized.includes(alias);
      if (alias && matched && alias.length > bestLength) {
        best = index;
        bestLength = alias.length;
      }
    }
  });
  if (best !== -1) {
    return best;
  }

  const compact = normalized.replace(/[鼓楼仙林苏州浦口]/g, "");
  const directional = compact.match(/([南北]?)([一二两三四五六七八九十\d]{1,2})/);
  if (!directional) {
    return -1;
  }
  const direction = directional[1];
  const number = parseChineseNumber(directional[2]);
  if (!number) {
    return -1;
  }
  const directionText = direction === "南" ? "南园" : direction === "北" ? "北园" : "";
  return buildings.findIndex(building => {
    const name = building.name;
    if (directionText && !name.includes(directionText)) {
      return false;
    }
    const firstNumber = name.match(/\d+/);
    return firstNumber && Number(firstNumber[0]) === number;
  });
}

function findRoomIndex(campusIndex, buildingIndex, input) {
  const roomNumber = String(input || "").match(/(?:^|[\s,，])(\d{3,4})\s*$/);
  const normalizedInput = normalize(input);
  const fallbackRoomNumber = normalizedInput.match(/(\d{3,4})$/);
  const value = roomNumber ? roomNumber[1] : fallbackRoomNumber ? fallbackRoomNumber[1] : "";
  if (!value) {
    return 0;
  }
  const rooms = getRooms(campusIndex, buildingIndex);
  const exact = rooms.findIndex(room => normalize(room) === normalize(value));
  if (exact !== -1) {
    return exact;
  }
  const contains = rooms.findIndex(room => normalize(room).includes(normalize(value)));
  return contains === -1 ? 0 : contains;
}

function parseLocationInput(input) {
  const campusIndex = findCampusIndex(input);
  if (campusIndex === -1) {
    return {
      matched: false,
      message: "未识别校区，请手动选择",
      ...selectionToLocation([0, 0, 0])
    };
  }
  const buildingIndex = findBuildingIndex(campusIndex, input);
  if (buildingIndex === -1) {
    return {
      matched: false,
      message: "已识别校区，请手动选择楼栋",
      ...selectionToLocation([campusIndex, 0, 0])
    };
  }
  const roomIndex = findRoomIndex(campusIndex, buildingIndex, input);
  return {
    matched: true,
    message: roomIndex > 0 ? "已识别校区、楼栋和宿舍号" : "已识别校区和楼栋，宿舍号未填写",
    ...selectionToLocation([campusIndex, buildingIndex, roomIndex])
  };
}

module.exports = {
  ROOM_EMPTY,
  buildPickerColumns,
  clampSelection,
  getRooms,
  parseLocationInput,
  selectionToLocation
};
