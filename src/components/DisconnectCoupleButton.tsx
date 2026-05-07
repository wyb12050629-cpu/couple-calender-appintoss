'use client';

import { useState } from 'react';
import { useUser } from '@/context/UserContext';
import { scheduleCoupleDeletion, leaveCoupleSolo } from '@/lib/db';

/**
 * 우리사이 — 커플 연결 해지
 * ─────────────────────────────────────────────
 * 두 가지 방식 제공:
 *  1) 혼자 떠나기 (즉시)
 *     - 본인 데이터만 사라짐 (토스 로그인부터 다시 시작)
 *     - 상대방은 그대로 데이터 유지, 본인 닉네임만 '상대방'으로 익명화
 *     - 경고문 모달 → "해지하기" 한 번 더 누르면 즉시 실행 (사용자 명세)
 *
 *  2) 함께 종료 (48시간 유예)
 *     - 양쪽 데이터 모두 삭제, 본인만 취소 가능
 *     - 기존 "해지" 텍스트 입력 게이트 유지
 *
 * 이미 해지 예약 중일 때(pendingDeletion)는 버튼 자체를 숨김 — 배너가 노출됨.
 */
type Phase = 'closed' | 'choose' | 'soloWarn' | 'soloConfirm' | 'schedule';

export default function DisconnectCoupleButton() {
  const { profile, uid, pendingDeletion } = useUser();
  const [phase, setPhase]     = useState<Phase>('closed');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // 커플 연결이 없거나 이미 해지 예약 중이면 버튼 숨김
  if (!profile?.coupleId) return null;
  if (pendingDeletion)    return null;

  const close = () => {
    if (busy) return;
    setPhase('closed');
    setConfirm('');
    setError(null);
  };

  // ── 1) 혼자 떠나기 (즉시) ──
  const handleSoloLeave = async () => {
    if (!profile?.coupleId || !uid) return;
    setBusy(true);
    setError(null);
    try {
      await leaveCoupleSolo(profile.coupleId, uid);
      // user 문서 isOnboarded=false 됨 → onSnapshot이 authState='new'로 전이
      // → ready→new 전이 effect가 '/'로 보내줌
    } catch (e) {
      console.error('[DisconnectCoupleButton] 솔로 해지 실패:', e);
      setError(e instanceof Error ? `해지 실패: ${e.message}` : '해지 처리 중 오류가 발생했어요.');
      setBusy(false);
    }
  };

  // ── 2) 함께 종료 (48시간 예약) ──
  const handleSchedule = async () => {
    if (!profile?.coupleId || !uid) return;
    if (confirm.trim() !== '해지') {
      setError("'해지' 두 글자를 정확히 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await scheduleCoupleDeletion(profile.coupleId, uid);
      setPhase('closed');
      setConfirm('');
    } catch (e) {
      console.error('[DisconnectCoupleButton] 예약 실패:', e);
      setError(e instanceof Error ? `예약 실패: ${e.message}` : '예약 처리 중 오류가 발생했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="px-4 mt-6 mb-4">
        <button
          onClick={() => setPhase('choose')}
          className="w-full py-3 rounded-xl text-sm font-medium active:scale-[0.98] transition-transform"
          style={{
            background: 'transparent',
            border: '1px solid #D33A3A',
            color: '#D33A3A',
          }}
        >
          커플 연결 해지하기
        </button>
        <p className="mt-2 text-xs text-center" style={{ color: 'var(--caption)' }}>
          혼자 떠나기 또는 48시간 후 양쪽 데이터 모두 삭제 중에서 선택할 수 있어요.
        </p>
      </div>

      {/* ── Phase: choose — 두 가지 옵션 선택 ── */}
      {phase === 'choose' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={close}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5"
            style={{ background: 'var(--paper)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--ink)' }}>
              어떤 방식으로 해지할까요?
            </h2>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--caption)' }}>
              두 방식의 결과가 달라요. 신중히 선택해 주세요.
            </p>

            {/* 옵션 A — 혼자 떠나기 */}
            <button
              onClick={() => { setPhase('soloWarn'); setError(null); }}
              className="w-full text-left rounded-xl p-3 mb-2 active:scale-[0.99] transition-transform"
              style={{ background: 'var(--background)', border: '1px solid var(--line)' }}
            >
              <div className="text-sm font-bold mb-0.5" style={{ color: 'var(--ink)' }}>혼자 떠나기 (즉시)</div>
              <div className="text-xs leading-snug" style={{ color: 'var(--caption)' }}>
                내 데이터만 사라져요. 상대방은 그대로 일정·감사 기록을 볼 수 있고, 내 이름은 ‘상대방’으로 표시돼요.
              </div>
            </button>

            {/* 옵션 B — 함께 종료 */}
            <button
              onClick={() => { setPhase('schedule'); setError(null); }}
              className="w-full text-left rounded-xl p-3 mb-4 active:scale-[0.99] transition-transform"
              style={{ background: 'var(--background)', border: '1px solid var(--line)' }}
            >
              <div className="text-sm font-bold mb-0.5" style={{ color: '#D33A3A' }}>함께 종료 (48시간 후)</div>
              <div className="text-xs leading-snug" style={{ color: 'var(--caption)' }}>
                양쪽 모든 일정·감사 기록이 영구 삭제돼요. 유예 기간 동안엔 본인만 취소할 수 있어요.
              </div>
            </button>

            <button
              onClick={close}
              className="w-full py-2.5 rounded-xl text-sm font-medium"
              style={{
                background: 'var(--background)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* ── Phase: soloWarn — 1차 경고 (한 번 더 누르면 즉시) ── */}
      {phase === 'soloWarn' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={close}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5"
            style={{ background: 'var(--paper)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-2" style={{ color: '#D33A3A' }}>
              정말 떠나시겠어요?
            </h2>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--ink)' }}>
              <strong>지금 바로</strong> 내 데이터가 사라지고, 토스 로그인 화면으로 돌아가요.
              <br />
              상대방의 일정·감사 기록은 그대로 남고, 내 이름은
              <strong> ‘상대방’</strong>으로 표시돼요.
              <br />
              <span style={{ color: 'var(--caption)' }}>이 동작은 되돌릴 수 없어요.</span>
            </p>

            {error && (
              <p className="mb-3 text-xs" style={{ color: '#D33A3A' }}>{error}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={close}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: 'var(--background)',
                  color: 'var(--ink)',
                  border: '1px solid var(--line)',
                  opacity: busy ? 0.5 : 1,
                }}
              >
                취소
              </button>
              <button
                onClick={handleSoloLeave}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white"
                style={{
                  background: '#D33A3A',
                  opacity: busy ? 0.5 : 1,
                }}
              >
                {busy ? '처리 중…' : '해지하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Phase: schedule — 48시간 예약 ('해지' 입력 게이트) ── */}
      {phase === 'schedule' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={close}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5"
            style={{ background: 'var(--paper)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-2" style={{ color: '#D33A3A' }}>
              커플 연결 해지를 예약할까요?
            </h2>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--ink)' }}>
              지금부터 <strong>48시간 후</strong> 두 사람이 함께 쓰던 모든 일정과 감사 메시지가
              <strong> 영구 삭제</strong>되고, 다시 복구할 수 없어요.
              <br />
              유예 기간 중엔 <strong>본인만</strong> 취소할 수 있어요. 파트너에게도 카운트다운이 보여요.
            </p>

            <label className="block text-xs mb-1.5" style={{ color: 'var(--caption)' }}>
              계속하려면 <strong>해지</strong>를 입력해 주세요.
            </label>
            <input
              type="text"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(null); }}
              disabled={busy}
              autoFocus
              placeholder="해지"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                border: '1px solid var(--line)',
                background: 'var(--background)',
                color: 'var(--ink)',
              }}
            />
            {error && (
              <p className="mt-2 text-xs" style={{ color: '#D33A3A' }}>{error}</p>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={close}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: 'var(--background)',
                  color: 'var(--ink)',
                  border: '1px solid var(--line)',
                  opacity: busy ? 0.5 : 1,
                }}
              >
                취소
              </button>
              <button
                onClick={handleSchedule}
                disabled={busy || confirm.trim() !== '해지'}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white"
                style={{
                  background: '#D33A3A',
                  opacity: busy || confirm.trim() !== '해지' ? 0.5 : 1,
                }}
              >
                {busy ? '예약 중…' : '해지 예약'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
