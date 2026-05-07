/**
 * 우리 사이 — 도메인 타입 (Firestore 네이티브 모델)
 * ─────────────────────────────────────────────────────
 * Owner('yubin'|'munsung') 폐기.
 * 신원은 모두 Firebase UID(string)로 표현.
 * UI에서 "내 일정 / 상대 일정 / 공유"는 Tone 타입으로 derive.
 * ─────────────────────────────────────────────────────
 */

// ── 캐릭터 ──
export type CharacterType =
  | 'poodle_brown'
  | 'poodle_white'
  | 'dino'
  | 'bear'
  | 'cat_siamese'
  | 'shiba'
  | 'cat_tabby'
  | 'hamster'
  | 'quokka'
  | 'bunny';

// ── 상태 enum ──
export type CoupleStatus    = 'pending' | 'connected' | 'disconnected';
export type EventStatus     = 'pending' | 'accepted' | 'rejected';
export type EventVisibility = 'private' | 'shared';

/** UI에서 색상/라벨을 분기할 때 쓰는 derived 값 */
export type Tone = 'me' | 'partner' | 'shared';

// ── 사용자 프로필 ──
/**
 * Firestore 경로:
 *   /users/{uid} → 자기 프로필 + 파트너 정보 캐시
 *
 * partnerUid / partnerNickname / partnerCharacter 는
 * 커플 연결 시 Firestore Function 또는 클라이언트가 양쪽 users 문서에
 * 양방향으로 채워줌(후에 onSnapshot으로 구독).
 */
export type UserProfile = {
  uid:               string;
  nickname:          string;
  characterType:     CharacterType;

  partnerUid:        string | null;
  partnerNickname:   string;
  partnerCharacter:  CharacterType;

  anniversaryDate:   string;   // YYYY-MM-DD
  myBirthday:        string;   // MM-DD
  partnerBirthday:   string;   // MM-DD

  isOnboarded:       boolean;
  coupleId:          string | null;
  coupleStatus:      CoupleStatus | null;
  inviteCode:        string | null;   // 내가 발급한 초대 코드(있을 때만)
};

// ── 일정 ──
/**
 * Firestore 경로: /couples/{coupleId}/events/{eventId}
 *
 * - creatorUid  : 만든 사람 UID (라벨/색상 derive에 사용)
 * - visibility  : 'private' = 만든 사람만 확인하면 되는 일정,
 *                 'shared'  = 둘 다 자기 일정으로 인식
 * - status      : 'pending' = 상대방 미확인, 'accepted'/'rejected' = 상대 응답
 */
export type Event = {
  id:         string;
  coupleId:   string;
  creatorUid: string;
  visibility: EventVisibility;

  title:      string;
  date:       string;          // YYYY-MM-DD
  endDate:    string | null;
  startTime:  string | null;   // HH:mm
  endTime:    string | null;
  allDay:     boolean;
  memo:       string | null;
  imageUrl:   string | null;

  createdAt:  string;          // ISO
  status:     EventStatus;
};

// ── 감사한 일 ──
/**
 * Firestore 경로: /couples/{coupleId}/gratitudes/{id}
 *
 * fromUid → toUid 일방향 메시지.
 * Tone derive: fromUid === myUid ? 'me' : 'partner'
 */
export type Gratitude = {
  id:        string;
  coupleId:  string;
  fromUid:   string;
  toUid:     string;
  message:   string;
  createdAt: string;
  updatedAt: string | null;
};

// ── 초대 코드 인덱스 ──
/**
 * Firestore 경로: /inviteCodes/{code}
 * 코드로 빠르게 inviter를 찾기 위한 lookup용 문서.
 * 커플 연결되면 삭제하거나 status='used'로.
 */
export type InviteCodeDoc = {
  code:        string;
  inviterUid:  string;
  coupleId:    string;
  createdAt:   string;
  expiresAt:   string | null;
  status:      'pending' | 'used' | 'expired';
};

// ── 커플 해지 예약 ──
/**
 * 사용자가 '커플 연결 해지'를 누르면 즉시 삭제하지 않고
 * 48시간 유예 기간을 두고 예약. requestedBy와 동일한 uid만 취소 가능.
 * executeAt을 지나면 다음 앱 오픈 시 클라이언트가 실제 disconnectCouple()을 트리거.
 */
export type PendingDeletion = {
  requestedBy: string;   // 해지 버튼 누른 uid
  requestedAt: string;   // ISO
  executeAt:   string;   // ISO — 이 시각 이후엔 클라이언트가 실삭제
};

/**
 * 솔로 leave (한쪽이 즉시 떠난) 후 커플 doc에 박히는 익명화 정보.
 * - members 배열에서 leaver는 제거되어 더 이상 데이터 접근 불가
 * - 남은 사람의 시점에서는 archivedMember.nickname('상대방')으로 표시되고
 *   파트너 톤 일정 등록은 비활성화됨 (UserContext에서 derive)
 */
export type ArchivedMember = {
  uid:       string;   // 떠난 사람의 uid (이력용)
  nickname:  string;   // 항상 '상대방'으로 박음
  leftAt:    string;   // ISO
};

// ── 커플 문서 ──
/**
 * Firestore 경로: /couples/{coupleId}
 * 두 멤버의 UID를 [a, b] 배열로 보관 (보안 규칙에서 array-contains 활용).
 */
export type CoupleDoc = {
  id:          string;
  members:     [string, string] | [string];   // 1명일 땐 invite 대기 또는 솔로 leave 직후
  inviterUid:  string;
  inviteeUid:  string | null;
  inviteCode:  string | null;
  status:      CoupleStatus;
  createdAt:   string;
  connectedAt: string | null;
  pendingDeletion?: PendingDeletion | null;
  archivedMember?:  ArchivedMember | null;
};
