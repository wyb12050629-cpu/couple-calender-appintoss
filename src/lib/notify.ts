/**
 * 우리사이 — 토스 스마트 메시지 발송 클라이언트 헬퍼
 * ─────────────────────────────────────────────
 * 클라이언트 → Vercel 함수(/api/notify/send) → 토스 messenger API
 *
 * 환경변수:
 *   NEXT_PUBLIC_TOSS_NOTIFY_FN_URL  (기본: 같은 Vercel 프로젝트의 /api/notify/send)
 *
 * 발송 실패는 사용자 흐름을 막지 않도록 swallow — 콘솔 경고만 남김.
 * 일정 저장 자체는 이미 Firestore에 반영됐으니, 푸시는 베스트 에포트.
 */

import { getFirebaseAuth } from './firebase-client';

/**
 * 단일 템플릿 — 일정 등록 시 모든 톤(me / shared / partner)에 동일하게 사용.
 * 제목·내용 모두 "상대방이 새로운 일정을 등록했어요." 로 고정.
 *
 * 인앱 수락/거절 UI는 EventAcceptToast가 Firestore에서 직접 결정하므로
 * 푸시 메시지를 통일해도 인앱 동작에는 영향 없음.
 */
export type NotifyTemplate = 'woorisai_event_new';

export type NotifyContext = {
  /** 통일 메시지에는 변수 없음. 토스 콘솔에 변수 등록 X. (확장 대비 필드만 유지) */
  senderName?: string;
  eventTitle?: string;
  eventDate?:  string;
  eventTime?:  string | null;
};

export async function sendTossNotify(params: {
  recipientUid:    string;            // 수신자 토스 userKey (= Firebase uid)
  templateSetCode: NotifyTemplate;
  context:         NotifyContext;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!params.recipientUid) return { ok: false, reason: 'no_recipient' };

  const fnUrl = process.env.NEXT_PUBLIC_TOSS_NOTIFY_FN_URL;
  if (!fnUrl) {
    console.warn('[notify] NEXT_PUBLIC_TOSS_NOTIFY_FN_URL 미설정 — 푸시 발송 건너뜀');
    return { ok: false, reason: 'no_fn_url' };
  }

  const user = getFirebaseAuth().currentUser;
  if (!user) return { ok: false, reason: 'not_signed_in' };

  let idToken: string;
  try {
    idToken = await user.getIdToken();
  } catch (e) {
    console.warn('[notify] ID token 발급 실패:', e);
    return { ok: false, reason: 'id_token_failed' };
  }

  try {
    const res = await fetch(fnUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        recipientUserKey: params.recipientUid,
        templateSetCode:  params.templateSetCode,
        context:          params.context,
        idToken,
      }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.warn('[notify] 발송 실패:', res.status, errBody);
      return { ok: false, reason: `http_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.warn('[notify] 네트워크 오류:', e);
    return { ok: false, reason: 'network_error' };
  }
}
