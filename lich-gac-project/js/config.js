const CA = [
  ["06:00 – 08:00", "14:00 – 16:00", "22:00 – 24:00"],
  ["08:00 – 10:00", "16:00 – 18:00", "00:00 – 02:00"],
  ["10:00 – 12:00", "18:00 – 20:00", "02:00 – 04:00"],
  ["12:00 – 14:00", "20:00 – 22:00", "04:00 – 06:00"]
];

const CATS = [
  ["phep", "Nghỉ phép", "P"],
  ["congtac", "Công tác", "CT"],
  ["om", "Ốm tại nhà", "O"],
  ["om_tai_vien", "Ốm tại viện", "OV"],
  ["nghibu", "Nghỉ bù", "NB"],
  ["hoctap", "Học tập", "H"],
  ["khac", "Công việc khác", "K"]
];

const DOW = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
const KEY = "lich-gac-v12";
const ROLE_KEY = "lich-gac-role";
const USER_KEY = "lich-gac-current-user";

const DEFAULT_COMMANDER_ACCOUNTS = {
  "chihuy": "doi3",
  "truongban": "doi3",
  "admin": "123456"
};

// CẤU HÌNH 4 TỔ GÁC CỐ ĐỊNH THEO TOUR (ĐỐC GÁC & CHIẾN SĨ NGHĨA VỤ CÙNG TỔ)
const DEFAULT_TEAMS = [
  {
    id: 1,
    name: "Tổ 1",
    officers: [
      "Nguyễn Xuân Vũ (SQ01)",
      "Nguyễn Hồng Nam (SQ02)",
      "Lê Xuân Trình (SQ03)"
    ],
    soldiers: [
      "Trần Văn Hiệp (CS01)",
      "Bùi Quốc Huy (CS02)",
      "Nguyễn Huy Hiệu (CS03)",
      "Đoàn Trung Sang (CS04)",
      "Bùi Trọng Toàn (CS05)",
      "Nghiêm Kim Nhật Ninh (CS06)",
      "Phạm Văn Cường (CS07)"
    ]
  },
  {
    id: 2,
    name: "Tổ 2",
    officers: [
      "Ứng Đình Dũng (SQ04)",
      "Võ Anh Quốc (SQ05)",
      "Trần Quốc Vương (SQ06)"
    ],
    soldiers: [
      "Nguyễn Chiến Thắng (CS08)",
      "Nguyễn Xuân Đạt (CS09)",
      "Nguyễn Thế Mạnh (CS10)",
      "Lê Văn Sơn (CS11)",
      "Nguyễn Phấn Phương Nam (CS12)",
      "Nguyễn Trọng Đức Anh (CS13)",
      "Nguyễn Ngọc Minh (CS14)"
    ]
  },
  {
    id: 3,
    name: "Tổ 3",
    officers: [
      "Nguyễn Văn Thụ (SQ07)",
      "Nguyễn Đức Thập Ân (SQ08)",
      "Đặng Tuấn Anh (SQ09)"
    ],
    soldiers: [
      "Nguyễn Văn Thắng (CS15)",
      "Nguyễn Bá Anh Đức (CS16)",
      "Trần Văn Đức (CS17)",
      "Đỗ Văn Trường (CS18)",
      "Lý Đức Huy (CS19)",
      "Lê Văn Thịnh (CS20)",
      "Tạ Đức Vũ (CS21)"
    ]
  },
  {
    id: 4,
    name: "Tổ 4",
    officers: [
      "Nguyễn Thanh Thủy (SQ10)",
      "Trần Ngọc Đức (SQ11)",
      "Trần Bảo Ngọc (SQ12)"
    ],
    soldiers: [
      "Đoàn Ngọc Vũ (CS22)",
      "Nguyễn Quang Huy (CS23)",
      "Lã Huy Hiệu (CS24)",
      "Lê Văn Phúc (CS25)",
      "Nguyễn Tuấn Anh (CS26)",
      "Phan Đình Hoàn (CS27)",
      "Trương Văn An (CS28)"
    ]
  }
];
