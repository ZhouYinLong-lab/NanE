/* NanE Demo Mode — fetch() interception layer
 * Intercepts all /api/* requests and returns realistic mock data
 * so the entire frontend works without a backend.
 */

(function () {
  /* ── SVG placeholder image generator ────────────────────────────── */

  function demoImage(label, bgColor) {
    if (bgColor === void 0) bgColor = "6E0065";
    var encoded = encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">' +
      '<rect fill="%23' + bgColor + '" width="400" height="300" rx="12"/>' +
      '<circle cx="200" cy="110" r="40" fill="rgba(255,255,255,0.2)"/>' +
      '<text x="200" y="120" text-anchor="middle" dominant-baseline="middle" font-size="36" fill="white">📦</text>' +
      '<text x="200" y="200" text-anchor="middle" dominant-baseline="middle" font-size="22" fill="white" font-family="sans-serif">' + label + '</text>' +
      '<text x="200" y="235" text-anchor="middle" dominant-baseline="middle" font-size="13" fill="rgba(255,255,255,0.6)" font-family="sans-serif">NanE 南易 · 演示物品</text>' +
      '</svg>'
    );
    return "data:image/svg+xml," + encoded;
  }

  /* ── Mock Data ─────────────────────────────────────────────────── */

  var DEMO_USER_ID = "u_demo_3f8a2b1c";
  var DEMO_USER = {
    id: DEMO_USER_ID,
    name: "南易同学",
    campus: "仙林校区",
    building: "南苑 A 栋",
    room: "101",
    is_verified: true,
    is_banned: false,
    profileComplete: true,
    hasPassword: true,
    wechat: "nju_demo_wechat",
    qq: "1234567890",
    createdAt: "2026-03-15T10:30:00.000Z",
    trustSummary: {
      positiveReviewCount: 5,
      totalReviewCount: 5,
      topTags: ["响应快", "物品干净", "靠谱"]
    }
  };

  var DEMO_ITEMS = [
    /* ── 耗材 (consumable) ──────────────────────────────── */
    {
      id: "item_demo_c01",
      title: "云南白药创可贴 透气型",
      description: "全新未拆封的云南白药创可贴，一盒100片。弹性透气型，适合日常小伤口。买多了用不完，分享给需要的同学。",
      itemType: "consumable", itemTypeText: "消耗品",
      category: "外伤处理",
      campus: "仙林校区", building: "南苑 A 栋", room: "101",
      status: "online", quantity: 80, unit: "片",
      imageUrl: demoImage("创可贴", "D4855E"), imageCount: 1,
      noExpiry: false, expireDate: "2027-06-30",
      createdAt: "2026-07-20T09:15:00.000Z",
      ownerId: DEMO_USER_ID, ownerName: "南易同学",
      distanceLabel: "同楼",
      ownerTrustSummary: { positiveReviewCount: 5, totalReviewCount: 5, topTags: ["响应快", "物品干净", "靠谱"] },
      pendingClaimCount: 1,
      claimRequests: [
        { id: "claim_demo_c01", status: "pending", requesterName: "张三", requesterId: "u_demo_z1",
          createdAt: "2026-07-21T14:00:00.000Z", message: "你好，我宿舍就在3楼，可以现在来拿吗？" }
      ]
    },
    {
      id: "item_demo_c02",
      title: "碘伏棉签独立包装 50支",
      description: "碘伏棉签独立包装，一盒50支，掰断即可使用。处理小伤口超级方便，全新未拆封。军训必备！",
      itemType: "consumable", itemTypeText: "消耗品",
      category: "消毒护理",
      campus: "仙林校区", building: "南苑 A 栋", room: "505",
      status: "online", quantity: 50, unit: "支",
      imageUrl: demoImage("碘伏棉签", "C4843B"), imageCount: 1,
      noExpiry: false, expireDate: "2027-05-01",
      createdAt: "2026-07-05T10:00:00.000Z",
      ownerId: "u_demo_other2", ownerName: "小王同学",
      distanceLabel: "同楼",
      ownerTrustSummary: { positiveReviewCount: 2, totalReviewCount: 2, topTags: ["爽快", "物品新"] },
      pendingClaimCount: 0
    },
    {
      id: "item_demo_c03",
      title: "N95 防护口罩 独立包装",
      description: "独立包装N95防护口罩，一盒20只，全新未使用。买了两盒用不完，出一盒。贴合性好，戴眼镜不起雾。",
      itemType: "consumable", itemTypeText: "消耗品",
      category: "防护用品",
      campus: "仙林校区", building: "南苑 C 栋", room: "118",
      status: "online", quantity: 20, unit: "只",
      imageUrl: demoImage("N95口罩", "5B7A9A"), imageCount: 1,
      noExpiry: false, expireDate: "2028-03-15",
      createdAt: "2026-07-22T08:45:00.000Z",
      ownerId: "u_demo_other3", ownerName: "小赵同学",
      distanceLabel: "同校区",
      ownerTrustSummary: { positiveReviewCount: 8, totalReviewCount: 8, topTags: ["回复及时", "东西好", "靠谱"] },
      pendingClaimCount: 0
    },
    {
      id: "item_demo_c04",
      title: "欧姆龙电子体温计 MC-246",
      description: "欧姆龙电子体温计，只用过两次，已用酒精消毒。15秒快速测量，准确可靠。配保护盒，方便收纳。",
      itemType: "consumable", itemTypeText: "消耗品",
      category: "退烧降温",
      campus: "仙林校区", building: "南苑 A 栋", room: "312",
      status: "online", quantity: 1, unit: "支",
      imageUrl: demoImage("电子体温计", "4A8C6F"), imageCount: 1,
      noExpiry: false, expireDate: "2028-01-01",
      createdAt: "2026-07-15T11:00:00.000Z",
      ownerId: "u_demo_other2", ownerName: "小王同学",
      distanceLabel: "同楼",
      ownerTrustSummary: { positiveReviewCount: 2, totalReviewCount: 2, topTags: ["爽快", "物品新"] },
      pendingClaimCount: 0
    },
    {
      id: "item_demo_c05",
      title: "一次性速冷冰袋 6袋装",
      description: "一次性速冷冰袋，捏破即可制冷，无需冰箱。适合扭伤、发烧物理降温、军训后冷敷。6袋独立包装。",
      itemType: "consumable", itemTypeText: "消耗品",
      category: "应急耗材",
      campus: "仙林校区", building: "南苑 D 栋", room: "208",
      status: "online", quantity: 6, unit: "袋",
      imageUrl: demoImage("速冷冰袋", "7EB5D6"), imageCount: 1,
      noExpiry: false, expireDate: "2028-06-01",
      createdAt: "2026-07-24T15:30:00.000Z",
      ownerId: "u_demo_other8", ownerName: "小孙同学",
      distanceLabel: "同校区",
      ownerTrustSummary: { positiveReviewCount: 0, totalReviewCount: 0, topTags: [] },
      pendingClaimCount: 0
    },
    {
      id: "item_demo_c06",
      title: "暖宝宝贴片 10片装",
      description: "暖宝宝贴片，冬天贴身上取暖。已过期但包装完好，不建议领取使用。仅作为平台展示样例。",
      itemType: "consumable", itemTypeText: "消耗品",
      category: "其他耗材",
      campus: "仙林校区", building: "南苑 A 栋", room: "101",
      status: "expired", quantity: 10, unit: "片",
      imageUrl: demoImage("暖宝宝", "B0A090"), imageCount: 1,
      noExpiry: false, expireDate: "2025-12-01",
      createdAt: "2026-06-01T08:00:00.000Z",
      ownerId: DEMO_USER_ID, ownerName: "南易同学",
      distanceLabel: "同楼",
      ownerTrustSummary: { positiveReviewCount: 5, totalReviewCount: 5, topTags: ["响应快", "物品干净", "靠谱"] },
      pendingClaimCount: 0
    },

    /* ── 药品 (medicine) ───────────────────────────────── */
    {
      id: "item_demo_m01",
      title: "三九感冒灵颗粒 未开封",
      description: "三九感冒灵颗粒，未开封，有效期到2026年12月。一次一包，温水冲服。感冒好了用不到了，分享给需要的同学。",
      itemType: "medicine", itemTypeText: "药品",
      category: "感冒药",
      campus: "仙林校区", building: "南苑 B 栋", room: "205",
      status: "online", quantity: 1, unit: "盒",
      imageUrl: demoImage("感冒灵颗粒", "E8734A"), imageCount: 1,
      noExpiry: false, expireDate: "2026-12-31",
      createdAt: "2026-07-18T16:30:00.000Z",
      ownerId: "u_demo_other1", ownerName: "小李同学",
      distanceLabel: "同组",
      ownerTrustSummary: { positiveReviewCount: 7, totalReviewCount: 7, topTags: ["靠谱", "物品新", "描述准确"] },
      pendingClaimCount: 0
    },
    {
      id: "item_demo_m02",
      title: "布洛芬缓释胶囊 12粒",
      description: "布洛芬缓释胶囊，还剩12粒。用于缓解轻至中度疼痛及退烧。有效期到2027年。注意：对阿司匹林过敏者禁用。",
      itemType: "medicine", itemTypeText: "药品",
      category: "退烧药",
      campus: "仙林校区", building: "南苑 A 栋", room: "315",
      status: "online", quantity: 12, unit: "粒",
      imageUrl: demoImage("布洛芬", "C0392B"), imageCount: 1,
      noExpiry: false, expireDate: "2027-03-15",
      createdAt: "2026-07-23T19:00:00.000Z",
      ownerId: "u_demo_other9", ownerName: "小杨同学",
      distanceLabel: "同楼",
      ownerTrustSummary: { positiveReviewCount: 3, totalReviewCount: 3, topTags: ["热心"] },
      pendingClaimCount: 0
    },
    {
      id: "item_demo_m03",
      title: "氯雷他定片 抗过敏",
      description: "氯雷他定片，抗过敏药。全新未开封，有效期到2027年。换季过敏已缓解，还剩一盒。",
      itemType: "medicine", itemTypeText: "药品",
      category: "过敏药",
      campus: "仙林校区", building: "南苑 B 栋", room: "402",
      status: "online", quantity: 1, unit: "盒",
      imageUrl: demoImage("氯雷他定", "2E86C1"), imageCount: 1,
      noExpiry: false, expireDate: "2027-09-01",
      createdAt: "2026-07-19T12:00:00.000Z",
      ownerId: "u_demo_other10", ownerName: "小林同学",
      distanceLabel: "同组",
      ownerTrustSummary: { positiveReviewCount: 1, totalReviewCount: 1, topTags: ["物品新"] },
      pendingClaimCount: 0
    },
    {
      id: "item_demo_m04",
      title: "蒙脱石散 止泻药",
      description: "蒙脱石散，常用于急性腹泻。全新未开封，有效期到2027年6月。配送量杯。注意：需温水冲服。",
      itemType: "medicine", itemTypeText: "药品",
      category: "肠胃药",
      campus: "仙林校区", building: "南苑 D 栋", room: "105",
      status: "online", quantity: 1, unit: "盒",
      imageUrl: demoImage("蒙脱石散", "A569BD"), imageCount: 1,
      noExpiry: false, expireDate: "2027-06-15",
      createdAt: "2026-07-14T09:00:00.000Z",
      ownerId: "u_demo_other6", ownerName: "小刘同学",
      distanceLabel: "同校区",
      ownerTrustSummary: { positiveReviewCount: 4, totalReviewCount: 4, topTags: ["热心", "很新"] },
      pendingClaimCount: 0
    },
    {
      id: "item_demo_m05",
      title: "力度伸维生素C泡腾片",
      description: "力度伸维C泡腾片，未开封，买多了喝不完。每天一片补充维C，增强免疫力。橙子味。",
      itemType: "medicine", itemTypeText: "药品",
      category: "其他非处方药",
      campus: "仙林校区", building: "南苑 A 栋", room: "220",
      status: "reviewing", quantity: 1, unit: "盒",
      imageUrl: demoImage("维C泡腾片", "F39C12"), imageCount: 1,
      noExpiry: false, expireDate: "2027-08-01",
      createdAt: "2026-07-24T19:00:00.000Z",
      ownerId: "u_demo_other4", ownerName: "小陈同学",
      distanceLabel: "同楼",
      ownerTrustSummary: { positiveReviewCount: 0, totalReviewCount: 0, topTags: [] },
      pendingClaimCount: 0
    },
    {
      id: "item_demo_m06",
      title: "润洁氯霉素滴眼液",
      description: "润洁氯霉素滴眼液，缓解眼部疲劳和轻度结膜炎。未开封。注意：对氯霉素过敏者勿用，开封后需一个月内用完。",
      itemType: "medicine", itemTypeText: "药品",
      category: "其他非处方药",
      campus: "仙林校区", building: "南苑 B 栋", room: "410",
      status: "claimed", quantity: 1, unit: "瓶",
      imageUrl: demoImage("滴眼液", "17A589"), imageCount: 1,
      noExpiry: false, expireDate: "2026-09-30",
      createdAt: "2026-07-10T13:20:00.000Z",
      ownerId: "u_demo_other5", ownerName: "小周同学",
      distanceLabel: "同组",
      ownerTrustSummary: { positiveReviewCount: 2, totalReviewCount: 2, topTags: ["描述准确"] },
      pendingClaimCount: 0
    },

    /* ── 工具 (tool) ──────────────────────────────────── */
    {
      id: "item_demo_t01",
      title: "多功能螺丝刀套装 31合1",
      description: "31合1精密螺丝刀套装，含十字、一字、梅花、内六角等批头。拆装笔记本、手机、小家电都很方便。用了两次闲置了。",
      itemType: "tool", itemTypeText: "工具",
      category: "常用工具",
      campus: "仙林校区", building: "南苑 A 栋", room: "101",
      status: "online", quantity: 1, unit: "套",
      imageUrl: demoImage("螺丝刀套装", "5D6D7E"), imageCount: 1,
      noExpiry: true, expireDate: "",
      createdAt: "2026-07-16T20:30:00.000Z",
      ownerId: DEMO_USER_ID, ownerName: "南易同学",
      distanceLabel: "同楼",
      ownerTrustSummary: { positiveReviewCount: 5, totalReviewCount: 5, topTags: ["响应快", "物品干净", "靠谱"] },
      pendingClaimCount: 0
    },
    {
      id: "item_demo_t02",
      title: "自行车打气筒 便携款",
      description: "便携自行车打气筒，带气压表，美嘴/法嘴通用。只用过一次，毕业出闲置。骑车上课的同学必备。",
      itemType: "tool", itemTypeText: "工具",
      category: "常用工具",
      campus: "仙林校区", building: "南苑 B 栋", room: "308",
      status: "online", quantity: 1, unit: "个",
      imageUrl: demoImage("打气筒", "6C7A89"), imageCount: 1,
      noExpiry: true, expireDate: "",
      createdAt: "2026-07-17T11:00:00.000Z",
      ownerId: "u_demo_other11", ownerName: "小吴同学",
      distanceLabel: "同组",
      ownerTrustSummary: { positiveReviewCount: 6, totalReviewCount: 6, topTags: ["物品新", "爽快"] },
      pendingClaimCount: 0
    },
    {
      id: "item_demo_t03",
      title: "热熔胶枪 + 胶棒 20根",
      description: "手工热熔胶枪，配20根7mm胶棒。做手工、修补小物件都很好用。只用过一次，手残党放弃了。",
      itemType: "tool", itemTypeText: "工具",
      category: "手工工具",
      campus: "仙林校区", building: "南苑 C 栋", room: "212",
      status: "online", quantity: 1, unit: "套",
      imageUrl: demoImage("热熔胶枪", "E67E22"), imageCount: 1,
      noExpiry: true, expireDate: "",
      createdAt: "2026-07-21T16:45:00.000Z",
      ownerId: "u_demo_other12", ownerName: "小郑同学",
      distanceLabel: "同校区",
      ownerTrustSummary: { positiveReviewCount: 0, totalReviewCount: 0, topTags: [] },
      pendingClaimCount: 0
    },
    {
      id: "item_demo_t04",
      title: "电工胶带3卷 + 卷尺5米",
      description: "电工绝缘胶带3卷（黑红蓝）+ 5米钢卷尺。宿舍日常维修、布线、量尺寸都用得上。",
      itemType: "tool", itemTypeText: "工具",
      category: "维修工具",
      campus: "浦口校区", building: "浦苑 1 栋", room: "303",
      status: "online", quantity: 1, unit: "套",
      imageUrl: demoImage("电工胶带", "34495E"), imageCount: 1,
      noExpiry: true, expireDate: "",
      createdAt: "2026-07-13T10:00:00.000Z",
      ownerId: "u_demo_other13", ownerName: "浦口老张",
      distanceLabel: "其他校区",
      ownerTrustSummary: { positiveReviewCount: 10, totalReviewCount: 10, topTags: ["老用户", "靠谱", "东西好"] },
      pendingClaimCount: 0
    },
    {
      id: "item_demo_t05",
      title: "静电除尘拖把替换布 20片",
      description: "静电除尘拖把替换布，适配大部分平板拖把。吸附灰尘和头发效果很好，20片装够用一个学期。全新未拆。",
      itemType: "tool", itemTypeText: "工具",
      category: "清洁工具",
      campus: "苏州校区", building: "仁园 1 栋", room: "201",
      status: "online", quantity: 20, unit: "片",
      imageUrl: demoImage("除尘替换布", "1ABC9C"), imageCount: 1,
      noExpiry: false, expireDate: "2028-12-01",
      createdAt: "2026-07-24T20:00:00.000Z",
      ownerId: "u_demo_other7", ownerName: "苏州校区小吴",
      distanceLabel: "其他校区",
      ownerTrustSummary: { positiveReviewCount: 1, totalReviewCount: 1, topTags: ["描述准确"] },
      pendingClaimCount: 0
    },
    {
      id: "item_demo_t06",
      title: "便携针线盒 24色线",
      description: "24色针线盒，含剪刀、卷尺、穿针器、各色线轴。缝扣子、补衣服、改裤脚全能。全新。",
      itemType: "tool", itemTypeText: "工具",
      category: "其他工具",
      campus: "仙林校区", building: "南苑 A 栋", room: "101",
      status: "online", quantity: 1, unit: "盒",
      imageUrl: demoImage("针线盒", "8E44AD"), imageCount: 1,
      noExpiry: true, expireDate: "",
      createdAt: "2026-07-22T07:30:00.000Z",
      ownerId: DEMO_USER_ID, ownerName: "南易同学",
      distanceLabel: "同楼",
      ownerTrustSummary: { positiveReviewCount: 5, totalReviewCount: 5, topTags: ["响应快", "物品干净", "靠谱"] },
      pendingClaimCount: 0
    }
  ];

  var DEMO_MY_ITEMS = DEMO_ITEMS.filter(function (item) {
    return item.ownerId === DEMO_USER_ID;
  });

  var DEMO_LOCATIONS = {
    locations: [
      {
        name: "仙林校区",
        buildings: [
          { name: "南苑 A 栋", rooms: ["101","102","103","104","105","201","202","203","204","205","301","302","303","304","305","401","402","403","404","405","501","502","503","504","505"] },
          { name: "南苑 B 栋", rooms: ["101","102","103","104","105","201","202","203","204","205","301","302","303","304","305","401","402","403","404","405"] },
          { name: "南苑 C 栋", rooms: ["101","102","103","104","201","202","203","204","301","302","303","304","401","402","403","404"] },
          { name: "南苑 D 栋", rooms: ["101","102","103","104","105","201","202","203","204","208","301","302","303","304","401","402","403"] }
        ]
      },
      {
        name: "苏州校区",
        buildings: [
          { name: "仁园 1 栋", rooms: ["101","102","103","104","201","202","203","204","301","302","303","304"] },
          { name: "仁园 2 栋", rooms: ["101","102","103","104","105","201","202","203","204","301","302","303","304"] }
        ]
      },
      {
        name: "浦口校区",
        buildings: [
          { name: "浦苑 1 栋", rooms: ["101","102","103","201","202","203","301","302","303"] },
          { name: "浦苑 2 栋", rooms: ["101","102","103","201","202","203","301","302","303"] }
        ]
      }
    ]
  };

  var DEMO_AGREEMENT =
    "# NanE 南易用户协议\n\n## 一、总则\n\nNanE（南易）是面向南京大学在校学生的校园免费互助平台。本平台仅提供信息匹配服务，不涉及物品流转。\n\n## 二、核心原则\n\n1. **免费共享**：平台禁止任何形式的收费行为，所有物品必须免费分享。\n2. **人工审核**：所有发布内容需经管理员审核后方可上线。\n3. **药品限制**：药品仅限常见非处方药（OTC）品类，禁止处方药及管制药品。\n\n## 三、用户义务\n\n用户需确保所发布信息的真实性，并对物品的质量、安全性、适用性自行负责。\n\n## 四、免责声明\n\n平台不对物品的质量、安全性、适用性作任何保证。领取人应在领取前自行检查物品状况，评估使用风险。";

  var DEMO_PRIVACY =
    "# NanE 隐私保护指引\n\n## 一、信息收集\n\n我们仅收集运行平台所必需的最少信息：\n- 南京大学校园邮箱地址（用于身份验证）\n- 用户选择的宿舍楼栋信息（用于同楼匹配）\n- 用户主动填写的联系方式（微信/QQ，仅对已登录且完善资料的用户可见）\n\n## 二、信息使用\n\n- 楼栋信息用于计算物品与用户的距离排序\n- 联系方式在用户主动点击"查看联系方式"后展示\n- 每人每日查看联系方式上限为5次\n\n## 三、信息保护\n\n我们采取合理的措施保护用户信息安全，不对任何第三方分享用户个人信息。删除账号后，所有关联数据将在30天内清除。";

  /* ── Helpers ───────────────────────────────────────────────────── */

  var NATIVE_FETCH = window.fetch;
  var _uploadCounter = 0; // for generating unique demo upload URLs

  function mockResponse(data, status) {
    if (status === void 0) status = 200;
    return new Response(JSON.stringify(data), {
      status: status,
      headers: { "Content-Type": "application/json" }
    });
  }

  function errorResponse(message, status) {
    if (status === void 0) status = 400;
    return mockResponse({ error: true, message: message }, status);
  }

  function parseBody(options) {
    try {
      return options && options.body ? JSON.parse(options.body) : {};
    } catch (e) {
      return {};
    }
  }

  function makeId(prefix) {
    var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    var id = "";
    for (var i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return prefix + "_" + id;
  }

  function now() { return new Date().toISOString(); }

  function findItem(id) {
    for (var i = 0; i < DEMO_ITEMS.length; i++) {
      if (DEMO_ITEMS[i].id === id) return DEMO_ITEMS[i];
    }
    return null;
  }

  function parseQuery(url) {
    var q = {};
    var idx = url.indexOf("?");
    if (idx === -1) return q;
    var search = url.substring(idx + 1);
    var pairs = search.split("&");
    for (var i = 0; i < pairs.length; i++) {
      var eq = pairs[i].indexOf("=");
      if (eq === -1) continue;
      q[decodeURIComponent(pairs[i].substring(0, eq))] = decodeURIComponent(pairs[i].substring(eq + 1));
    }
    return q;
  }

  /* ── Route matcher ──────────────────────────────────────────────── */

  function matchRoute(method, path) {
    var re;
    // Auth
    if ((re = /^\/api\/auth\/password\/login$/.exec(path)) && method === "POST") return "login";
    if ((re = /^\/api\/auth\/password\/reset-challenge$/.exec(path)) && method === "POST") return "resetChallenge";
    if ((re = /^\/api\/auth\/password\/reset$/.exec(path)) && method === "POST") return "reset";
    if ((re = /^\/api\/auth\/password\/set$/.exec(path)) && method === "POST") return "setPassword";
    if ((re = /^\/api\/auth\/password\/change$/.exec(path)) && method === "POST") return "changePassword";
    if ((re = /^\/api\/auth\/nanna\/challenge$/.exec(path)) && method === "POST") return "nannaChallenge";
    if ((re = /^\/api\/auth\/nanna\/verify$/.exec(path)) && method === "POST") return "nannaVerify";
    if ((re = /^\/api\/auth\/email\/challenge$/.exec(path)) && method === "POST") return "emailChallenge";
    if ((re = /^\/api\/auth\/email\/verify$/.exec(path)) && method === "POST") return "emailVerify";
    // Legal
    if ((re = /^\/api\/legal\/agreement$/.exec(path)) && method === "GET") return "agreement";
    if ((re = /^\/api\/legal\/privacy$/.exec(path)) && method === "GET") return "privacy";
    // Locations
    if ((re = /^\/api\/locations$/.exec(path)) && method === "GET") return "locations";
    // Items
    if ((re = /^\/api\/items$/.exec(path)) && method === "GET") return "itemsList";
    if ((re = /^\/api\/items$/.exec(path)) && method === "POST") return "createItem";
    if ((re = /^\/api\/items\/([^\/]+)$/.exec(path)) && method === "GET") return { route: "itemDetail", id: re[1] };
    if ((re = /^\/api\/items\/([^\/]+)\/contact$/.exec(path)) && method === "POST") return { route: "itemContact", id: re[1] };
    if ((re = /^\/api\/items\/([^\/]+)\/claim$/.exec(path)) && method === "POST") return { route: "itemClaim", id: re[1] };
    if ((re = /^\/api\/items\/([^\/]+)\/report$/.exec(path)) && method === "POST") return { route: "itemReport", id: re[1] };
    // Uploads
    if ((re = /^\/api\/uploads\/images$/.exec(path)) && method === "POST") return "uploadImage";
    // Me
    if ((re = /^\/api\/me$/.exec(path)) && method === "GET") return "me";
    if ((re = /^\/api\/me\/profile$/.exec(path)) && method === "PUT") return "updateProfile";
    if ((re = /^\/api\/me\/items$/.exec(path)) && method === "GET") return "myItems";
    if ((re = /^\/api\/me\/reviews\/pending$/.exec(path)) && method === "GET") return "pendingReviews";
    if ((re = /^\/api\/me\/items\/([^\/]+)$/.exec(path)) && method === "GET") return { route: "myItemDetail", id: re[1] };
    if ((re = /^\/api\/me\/items\/([^\/]+)$/.exec(path)) && method === "PUT") return { route: "updateMyItem", id: re[1] };
    if ((re = /^\/api\/me\/items\/([^\/]+)\/delete$/.exec(path)) && method === "POST") return { route: "deleteMyItem", id: re[1] };
    if ((re = /^\/api\/me\/export$/.exec(path)) && method === "GET") return "export";
    if ((re = /^\/api\/me\/delete$/.exec(path)) && method === "POST") return "deleteAccount";
    if ((re = /^\/api\/me\/notifications\/feed/.exec(path)) && method === "GET") return "notifFeed";
    if ((re = /^\/api\/me\/notifications$/.exec(path)) && method === "GET") return "notifSettings";
    if ((re = /^\/api\/me\/notifications$/.exec(path)) && method === "POST") return "updateNotifSettings";
    // Push
    if ((re = /^\/api\/me\/push\/public-key$/.exec(path)) && method === "GET") return "pushPublicKey";
    if ((re = /^\/api\/me\/push\/subscribe$/.exec(path)) && method === "POST") return "pushSubscribe";
    if ((re = /^\/api\/me\/push\/unsubscribe$/.exec(path)) && method === "POST") return "pushUnsubscribe";
    // Claims
    if ((re = /^\/api\/claims\/([^\/]+)\/cancel$/.exec(path)) && method === "POST") return { route: "claimCancel", id: re[1] };
    if ((re = /^\/api\/claims\/([^\/]+)\/reviews$/.exec(path)) && method === "POST") return { route: "claimReview", id: re[1] };
    if ((re = /^\/api\/claims\/([^\/]+)\/(approve|reject)$/.exec(path)) && method === "POST") return { route: "claimAction", id: re[1], action: re[2] };
    // Activity
    if ((re = /^\/api\/activity/.exec(path)) && method === "GET") return "activity";
    return null;
  }

  /* ── Route handlers ─────────────────────────────────────────────── */

  function handleApiCall(url, options) {
    var method = (options && options.method) || "GET";
    var matched = matchRoute(method, url);
    var route = typeof matched === "string" ? matched : (matched && matched.route);
    var body;

    switch (route) {
      /* Auth */
      case "login":
        return mockResponse({ token: "demo_token_jwt_fake", user: DEMO_USER });
      case "resetChallenge":
      case "emailChallenge":
      case "nannaChallenge":
        return mockResponse({ challengeId: "challenge_demo_" + Date.now() });
      case "reset":
      case "emailVerify":
      case "nannaVerify":
        return mockResponse({ token: "demo_token_jwt_fake", user: DEMO_USER });
      case "setPassword":
      case "changePassword":
        return mockResponse({});

      /* Legal */
      case "agreement":
        return mockResponse({ version: "v1.0", markdown: DEMO_AGREEMENT });
      case "privacy":
        return mockResponse({ markdown: DEMO_PRIVACY });

      /* Locations */
      case "locations":
        return mockResponse(DEMO_LOCATIONS);

      /* Items — list with filtering */
      case "itemsList":
        var query = parseQuery(url);
        var keyword = (query.keyword || "").toLowerCase();
        var itemType = query.itemType || "";
        var category = query.category || "";
        var campus = query.campus || "";
        var building = query.building || "";
        var offset = parseInt(query.offset, 10) || 0;
        var limit = parseInt(query.limit, 10) || 20;

        var filtered = DEMO_ITEMS.filter(function (item) {
          if (keyword) {
            var haystack = (item.title + " " + item.description + " " + item.category + " " + item.building).toLowerCase();
            if (haystack.indexOf(keyword) === -1) return false;
          }
          if (itemType && item.itemType !== itemType) return false;
          if (category && item.category !== category) return false;
          if (campus && item.campus !== campus) return false;
          if (building && item.building !== building) return false;
          return true;
        });

        var total = filtered.length;
        var hasMore = offset + limit < total;
        var page = filtered.slice(offset, offset + limit);

        return mockResponse({
          items: page,
          total: total,
          hasMore: hasMore,
          viewer: { campus: DEMO_USER.campus, building: DEMO_USER.building }
        });

      /* Items — create */
      case "createItem":
        body = parseBody(options);
        var itemTypeText = body.itemType === "medicine" ? "药品" : body.itemType === "tool" ? "工具" : "消耗品";
        var newItem = {
          id: makeId("item"),
          title: body.title || "新物品",
          description: body.description || "",
          itemType: body.itemType || "consumable",
          itemTypeText: itemTypeText,
          category: body.category || "其他",
          campus: body.campus || DEMO_USER.campus,
          building: body.building || DEMO_USER.building,
          room: body.room || "",
          status: "reviewing",
          quantity: body.quantity || 1,
          unit: body.unit || "件",
          imageUrl: (body.imageUrls && body.imageUrls[0]) || "",
          imageCount: (body.imageUrls && body.imageUrls.length) || 0,
          noExpiry: !!body.noExpiry,
          expireDate: body.expireDate || "",
          createdAt: now(),
          ownerId: DEMO_USER_ID,
          ownerName: DEMO_USER.name,
          distanceLabel: "同楼",
          ownerTrustSummary: DEMO_USER.trustSummary,
          pendingClaimCount: 0
        };
        return mockResponse({ item: newItem });

      /* Items — detail */
      case "itemDetail":
        var detailItem = findItem(matched.id);
        if (!detailItem) return errorResponse("物品不存在", 404);
        return mockResponse({ item: detailItem });

      /* Items — contact */
      case "itemContact":
        var contactItem = findItem(matched.id);
        if (!contactItem) return errorResponse("物品不存在", 404);
        return mockResponse({
          contact: {
            wechat: "demo_wxid_" + contactItem.ownerName.replace(/[^\w一-鿿]/g, ""),
            qq: "1234567890"
          }
        });

      /* Items — claim */
      case "itemClaim":
        return mockResponse({ claim: { id: makeId("claim"), status: "pending" } });

      /* Items — report */
      case "itemReport":
        return mockResponse({});

      /* Upload image — return a demo placeholder so preview shows */
      case "uploadImage":
        _uploadCounter++;
        var imgUrl = demoImage("已上传 #" + _uploadCounter, "6E0065");
        return mockResponse({ url: imgUrl });

      /* Me */
      case "me":
        return mockResponse({ user: DEMO_USER });

      case "updateProfile":
        body = parseBody(options);
        DEMO_USER.name = body.nickname || body.name || DEMO_USER.name;
        DEMO_USER.campus = body.campus || DEMO_USER.campus;
        DEMO_USER.building = body.building || DEMO_USER.building;
        DEMO_USER.room = body.room || DEMO_USER.room;
        DEMO_USER.wechat = body.wechat || DEMO_USER.wechat;
        DEMO_USER.qq = body.qq || DEMO_USER.qq;
        DEMO_USER.profileComplete = !!(DEMO_USER.campus && DEMO_USER.building);
        return mockResponse({ user: DEMO_USER });

      case "myItems":
        return mockResponse({ items: DEMO_MY_ITEMS });

      case "pendingReviews":
        return mockResponse({ reviews: [] });

      case "myItemDetail":
        var myDetail = findItem(matched.id);
        if (!myDetail) return errorResponse("物品不存在", 404);
        return mockResponse({ item: myDetail });

      case "updateMyItem":
        body = parseBody(options);
        return mockResponse({ item: body });

      case "deleteMyItem":
        return mockResponse({});

      case "export":
        return mockResponse({ data: JSON.stringify({ user: DEMO_USER, items: DEMO_MY_ITEMS }) });

      case "deleteAccount":
        return mockResponse({});

      /* Notifications */
      case "notifFeed":
        return mockResponse({ events: [], total: 0 });

      case "notifSettings":
        return mockResponse({ pushEnabled: false, pushQuietStart: "22:00", pushQuietEnd: "08:00" });

      case "updateNotifSettings":
        return mockResponse({});

      /* Push — not configured in demo */
      case "pushPublicKey":
        return mockResponse({ configured: false, publicKey: null });
      case "pushSubscribe":
      case "pushUnsubscribe":
        return mockResponse({});

      /* Claims */
      case "claimCancel":
        return mockResponse({});
      case "claimReview":
        return mockResponse({});
      case "claimAction":
        return mockResponse({});

      /* Activity */
      case "activity":
        return mockResponse({
          events: [
            { type: "item_published", itemId: DEMO_ITEMS[0].id, itemTitle: DEMO_ITEMS[0].title, actor: DEMO_ITEMS[0].ownerName, detail: "发布了新物品", createdAt: DEMO_ITEMS[0].createdAt },
            { type: "item_published", itemId: DEMO_ITEMS[6].id, itemTitle: DEMO_ITEMS[6].title, actor: DEMO_ITEMS[6].ownerName, detail: "发布了新物品", createdAt: DEMO_ITEMS[6].createdAt },
            { type: "item_published", itemId: DEMO_ITEMS[12].id, itemTitle: DEMO_ITEMS[12].title, actor: DEMO_ITEMS[12].ownerName, detail: "发布了新物品", createdAt: DEMO_ITEMS[12].createdAt }
          ]
        });

      default:
        if (window.NanE && window.NanE.DEBUG_MODE) {
          console.warn("[Mock] Unmatched:", method, url);
        }
        return mockResponse({});
    }
  }

  /* ── Fetch override ─────────────────────────────────────────────── */

  window.fetch = function (url, options) {
    var urlStr = typeof url === "string" ? url : (url && url.url ? url.url : "");
    if (!urlStr && url instanceof Request) urlStr = url.url;

    if (typeof urlStr === "string" && urlStr.indexOf("/api/") !== -1) {
      return Promise.resolve(handleApiCall(urlStr, options));
    }

    return NATIVE_FETCH.call(window, url, options);
  };

  /* ── Init ───────────────────────────────────────────────────────── */

  // Seed demo session into localStorage
  (function () {
    var existingToken = localStorage.getItem("nane_web_token");
    if (!existingToken || existingToken === "demo_token_jwt_fake") {
      localStorage.setItem("nane_web_token", "demo_token_jwt_fake");
      localStorage.setItem("nane_web_user", JSON.stringify(DEMO_USER));
      localStorage.setItem("nane_agreement_accepted", "v1.0");
    }
  })();

  // Demo banner dismiss handler
  document.addEventListener("DOMContentLoaded", function () {
    var banner = document.getElementById("demoBanner");
    var dismissBtn = document.getElementById("demoBannerDismiss");
    if (!banner || !dismissBtn) return;
    if (sessionStorage.getItem("demo_banner_dismissed") === "1") {
      banner.hidden = true;
    }
    dismissBtn.addEventListener("click", function () {
      sessionStorage.setItem("demo_banner_dismissed", "1");
      banner.hidden = true;
    });
  });

  if (window.NanE && window.NanE.DEBUG_MODE) {
    console.log("[Mock] Demo mode active — " + DEMO_ITEMS.length + " items across " + DEMO_LOCATIONS.locations.length + " campuses");
  }
})();
