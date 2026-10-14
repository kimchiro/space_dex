export type NoticeCategory = "공지" | "점검" | "업데이트" | "이벤트";

export type Notice = {
  id: string;
  category: NoticeCategory;
  title: string;
  date: string;
  pinned?: boolean;
};

export const notices: Notice[] = [
  {
    id: "n-1005",
    category: "점검",
    title: "10월 20일(화) 02:00~04:00 스마트 컨트랙트 업그레이드로 스왑 및 유동성 공급이 일시 중단돼요.",
    date: "2026.10.14",
    pinned: true,
  },
  { id: "n-1004", category: "업데이트", title: "코인 상세 화면에 코인정보·뉴스 탭이 추가됐어요", date: "2026.10.13" },
  { id: "n-1003", category: "이벤트", title: "첫 스왑 수수료 0원 이벤트 (~10월 31일)", date: "2026.10.10" },
  { id: "n-1002", category: "공지", title: "Arbitrum 네트워크 가스비 정책 변경 안내", date: "2026.10.07" },
  { id: "n-1001", category: "공지", title: "개인정보 처리방침 개정 안내", date: "2026.10.01" },
  { id: "n-1000", category: "업데이트", title: "최근 조회 코인 목록 기능이 추가됐어요", date: "2026.09.28" },
];

export const pinnedNotice = notices.find((n) => n.pinned) ?? notices[0];
