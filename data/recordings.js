/* ============================================================================
 * 老可梦图鉴 · 诡异实录（影像档案）数据源
 * ----------------------------------------------------------------------------
 * 和 data/entries.js 同一套思路：页面里不写死任何一段影像，只留空容器 +
 * data-record-grid 标记，由 data/render.js 画出来。加一段录像只改这个文件。
 *
 * 引入顺序：data/entries.js → data/img-info.js → data/recordings.js
 *           → data/render.js → ui.js
 *
 * 字段说明
 *   id          数字，唯一，用于 data-record-open 定位
 *   code        登记号，REC-001 起
 *   title       登记标题（不是对画面内容的断言，只是归档时起的名字）
 *   note        客观描述：画幅、时长、亮度、色偏。不写"画面里有什么"
 *   w / h       视频像素尺寸（取自 ffprobe）
 *   ratio       画幅方向，用于卡片上的角标
 *   duration    秒（保留一位小数）
 *   durationText 磁带计数器样式的时间码
 *   src / poster / thumb   三段资源地址，均在 videos/ 下
 *   thumbW/H    缩略图尺寸，写进 <img> 防止加载时跳版
 *   status      登记状态，卡片的角标色由它决定
 *
 * 为什么 note 只写客观项：这四段影像的来源、拍摄时间与画面内容都没有可核实的
 * 依据。把它们写成"记录到某种东西"属于编造，所以这里只登记能被测量的事实
 * （尺寸、时长、平均亮度、色度偏移），画面内容留给观看者自己判断。
 * ========================================================================== */
(function () {
  "use strict";

  var RECORDINGS = [
    {
      id: 1,
      code: "REC-001",
      title: "余温",
      note:
        "竖幅手持影像，29.7 秒，平均亮度 94.9（四段中居中）。" +
        "来源、拍摄时间与拍摄者均未登记；本页只登记载体本身，不对画面内容作解释。",
      w: 720,
      h: 1280,
      ratio: "竖幅",
      duration: 29.7,
      durationText: "00:29.7",
      src: "videos/rec-001.mp4",
      poster: "videos/rec-001.poster.webp",
      thumb: "videos/rec-001.thumb.webp",
      thumbW: 480,
      thumbH: 854,
      status: "PENDING",
    },
    {
      id: 2,
      code: "REC-002",
      title: "白昼切片",
      note:
        "近方形画幅，19.3 秒，平均亮度 145.9——四段里最亮的一段，接近日间曝光。" +
        "拍摄地点未登记，声音轨完整，未做任何后期处理。",
      w: 720,
      h: 1040,
      ratio: "近方",
      duration: 19.3,
      durationText: "00:19.3",
      src: "videos/rec-002.mp4",
      poster: "videos/rec-002.poster.webp",
      thumb: "videos/rec-002.thumb.webp",
      thumbW: 480,
      thumbH: 694,
      status: "PENDING",
    },
    {
      id: 3,
      code: "REC-003",
      title: "无光段",
      note:
        "横幅影像，23.1 秒，平均亮度 79.7——四段里最暗的一段。" +
        "原文件帧率不规整（约 27.3 fps），已原样保留，未做补帧或降噪。",
      w: 1248,
      h: 720,
      ratio: "横幅",
      duration: 23.11,
      durationText: "00:23.1",
      src: "videos/rec-003.mp4",
      poster: "videos/rec-003.poster.webp",
      thumb: "videos/rec-003.thumb.webp",
      thumbW: 480,
      thumbH: 278,
      status: "PENDING",
    },
    {
      id: 4,
      code: "REC-004",
      title: "偏色",
      note:
        "竖幅影像，16.3 秒，平均亮度 98.3；色度整体偏暖（U 112.7 / V 137.3），" +
        "偏色均匀分布在全片，不是某一帧的偶然。",
      w: 720,
      h: 960,
      ratio: "竖幅",
      duration: 16.3,
      durationText: "00:16.3",
      src: "videos/rec-004.mp4",
      poster: "videos/rec-004.poster.webp",
      thumb: "videos/rec-004.thumb.webp",
      thumbW: 480,
      thumbH: 640,
      status: "PENDING",
    },
  ];

  window.RECORDINGS = RECORDINGS;

  /* 供 render.js / ui.js 使用的查询接口（与 POKEDEX 的风格保持一致） */
  window.RECORDS = {
    list: function () {
      return RECORDINGS.slice();
    },
    find: function (id) {
      var n = parseInt(id, 10);
      for (var i = 0; i < RECORDINGS.length; i++) {
        if (RECORDINGS[i].id === n) return RECORDINGS[i];
      }
      return null;
    },
    count: function () {
      return RECORDINGS.length;
    },
  };
})();
