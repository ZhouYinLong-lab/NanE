const icons = {
  bell: "\uf0f3",
  arrowLeft: "\uf060",
  box: "\uf466",
  calendar: "\uf133",
  check: "\uf00c",
  chevronRight: "\uf054",
  circleInfo: "\uf05a",
  clipboardList: "\uf46d",
  clock: "\uf017",
  filter: "\uf0b0",
  handHoldingHeart: "\ue05c",
  heartPulse: "\uf21e",
  home: "\uf015",
  idCard: "\uf2c2",
  locationDot: "\uf3c5",
  magnifyingGlass: "\uf002",
  notesMedical: "\uf481",
  pen: "\uf304",
  plus: "\u002b",
  shieldHeart: "\ue574",
  user: "\uf007"
};

const itemIconOptions = [
  { key: "plus", label: "通用", glyph: "\u002b" },
  { key: "bandage", label: "创可贴", glyph: "\uf462" },
  { key: "notesMedical", label: "护理单", glyph: "\uf481" },
  { key: "kitMedical", label: "急救包", glyph: "\uf479" },
  { key: "capsules", label: "胶囊", glyph: "\uf46b" },
  { key: "pills", label: "药丸", glyph: "\uf484" },
  { key: "tablets", label: "药片", glyph: "\uf490" },
  { key: "prescriptionBottleMedical", label: "药瓶", glyph: "\uf486" },
  { key: "temperatureHalf", label: "体温", glyph: "\uf2c9" },
  { key: "maskFace", label: "口罩", glyph: "\ue1d7" },
  { key: "shieldVirus", label: "防护", glyph: "\ue06c" },
  { key: "pumpMedical", label: "消毒液", glyph: "\ue06a" },
  { key: "bottleDroplet", label: "滴剂", glyph: "\ue4c4" },
  { key: "box", label: "盒装", glyph: "\uf466" },
  { key: "boxOpen", label: "开盒", glyph: "\uf49e" },
  { key: "droplet", label: "液体", glyph: "\uf043" },
  { key: "handHoldingMedical", label: "互助", glyph: "\ue05c" },
  { key: "heartPulse", label: "健康", glyph: "\uf21e" },
  { key: "syringe", label: "器具", glyph: "\uf48e" },
  { key: "soap", label: "清洁", glyph: "\ue06e" }
];

const itemIconMap = itemIconOptions.reduce((result, option) => {
  result[option.key] = option.glyph;
  return result;
}, {});

function defaultItemIcon(itemType) {
  return itemType === "medicine" ? "capsules" : "plus";
}

function itemIconGlyph(key, itemType) {
  return itemIconMap[key] || itemIconMap[defaultItemIcon(itemType)] || icons.plus;
}

module.exports = {
  ...icons,
  defaultItemIcon,
  itemIconGlyph,
  itemIconOptions
};
