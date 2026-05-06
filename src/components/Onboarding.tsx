'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Check, ArrowLeft, CalendarDays, Cake, Copy, Share2 } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import type { CharacterType } from '@/lib/types';
import { CHARACTERS } from '@/lib/characters';
import { createCoupleWithInvite, acceptInvite } from '@/lib/db';

type Step = 'welcome' | 'terms' | 'profile' | 'invite';
type InviteMode = 'choice' | 'show' | 'input';

const TERMS = [
  { id: 'service', required: true,  label: '서비스 이용약관 동의 (필수)' },
  { id: 'privacy', required: true,  label: '개인정보 처리방침 동의 (필수)' },
  { id: 'push',    required: false, label: '마케팅·알림 수신 동의 (선택)' },
];

// 진행 바 퍼센트
const PROGRESS: Record<Step, number> = {
  welcome: 0, terms: 33, profile: 66, invite: 90,
};

export default function Onboarding() {
  const { uid, completeOnboarding, loginWithToss, isToss } = useUser();

  const [step,        setStep]        = useState<Step>('welcome');
  const [agreed,      setAgreed]      = useState<Record<string, boolean>>({});
  const [nickname,    setNickname]    = useState('');
  const [character,   setCharacter]   = useState<CharacterType>('poodle_brown');
  const [anniversary, setAnniversary] = useState('');
  const [myBday,      setMyBday]      = useState('');
  const [partnerBday, setPartnerBday] = useState('');
  const [copied,      setCopied]      = useState(false);

  // ── 토스 로그인 상태 ──
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError,   setLoginError]   = useState<string | null>(null);

  // ── invite 단계 substate ──
  const [inviteMode, setInviteMode] = useState<InviteMode>('choice');
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [inputCode,  setInputCode]  = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError,   setInviteError]   = useState<string | null>(null);

  const allRequired = TERMS.filter(t => t.required).every(t => agreed[t.id]);

  // ── welcome 버튼 ──
  async function handleWelcomeClick() {
    if (!isToss) { setStep('terms'); return; }
    setLoginLoading(true);
    setLoginError(null);
    try {
      await loginWithToss();
      setStep('terms');
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : '로그인에 실패했어요. 다시 시도해 주세요.');
    } finally {
      setLoginLoading(false);
    }
  }

  // ── 프로필 저장 (isOnboarded:true) ──
  async function persistProfile(): Promise<boolean> {
    try {
      await completeOnboarding({
        nickname:        nickname.trim() || '나',
        characterType:   character,
        anniversaryDate: anniversary,
        myBirthday:      myBday,
        partnerBirthday: partnerBday,
      });
      return true;
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : '저장에 실패했어요.');
      return false;
    }
  }

  // ── invite: 내 코드 발급 ──
  async function handleIssueCode() {
    if (!uid) { setInviteError('로그인이 필요해요.'); return; }
    setInviteLoading(true);
    setInviteError(null);
    try {
      const { inviteCode } = await createCoupleWithInvite(uid);
      setIssuedCode(inviteCode);
      setInviteMode('show');
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : '코드 발급에 실패했어요.');
    } finally {
      setInviteLoading(false);
    }
  }

  // ── invite: 코드 입력 → 수락 ──
  async function handleAcceptInvite() {
    if (!uid) { setInviteError('로그인이 필요해요.'); return; }
    const code = inputCode.toUpperCase().trim();
    if (code.length !== 6) { setInviteError('6자리 코드를 입력해주세요.'); return; }

    setInviteLoading(true);
    setInviteError(null);
    try {
      const res = await acceptInvite(code, uid);
      if (!res.ok) {
        const msg: Record<string, string> = {
          not_found:          '코드를 찾을 수 없어요. 다시 확인해 주세요.',
          already_connected:  '이미 사용된 코드예요.',
          self_invite:        '자기 자신은 초대할 수 없어요.',
          unknown:            '오류가 생겼어요. 잠시 후 다시 시도해 주세요.',
        };
        setInviteError(msg[res.reason] ?? msg.unknown);
        return;
      }
      // 성공 → 프로필 저장 → 메인 진입 (onSnapshot이 ready로 전환)
      const saved = await persistProfile();
      if (!saved) return;
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : '오류가 생겼어요.');
    } finally {
      setInviteLoading(false);
    }
  }

  // ── invite: 코드 발급 후 "시작하기" / "일단 먼저 시작" ──
  async function handleFinish() {
    setInviteLoading(true);
    await persistProfile();
    setInviteLoading(false);
  }

  // 코드 복사
  const codeToShow = issuedCode ?? '';
  const handleCopy = async () => {
    if (!codeToShow) return;
    try { await navigator.clipboard.writeText(codeToShow); }
    catch { /* 무시 */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-dvh bg-white flex flex-col">

      {/* ── 상단 네비 (welcome 제외) ── */}
      {step !== 'welcome' && (
        <div className="flex items-center px-4 pt-12 pb-2 gap-3">
          <button
            onClick={() => {
              const order: Step[] = ['welcome','terms','profile','invite'];
              const i = order.indexOf(step);
              if (i > 0) setStep(order[i - 1]);
              if (step === 'invite') { setInviteMode('choice'); setInviteError(null); }
            }}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-50 active:bg-gray-100 transition-colors flex-shrink-0"
          >
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ background: '#3182F6', width: `${PROGRESS[step]}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col px-5 pb-10 pt-4 overflow-y-auto">

        {/* ══ STEP 1: WELCOME ══ */}
        {step === 'welcome' && (
          <div className="flex-1 flex flex-col justify-between animate-fade-in">

            <div className="flex-1 flex flex-col items-center justify-center text-center pt-8 pb-6">
              <div
                className="w-[72px] h-[72px] rounded-[20px] flex items-center justify-center mb-7"
                style={{ background: 'linear-gradient(135deg,#EBF3FE,#F0E6FF)' }}
              >
                <svg width="40" height="40" viewBox="0 0 44 44" fill="none">
                  <rect x="6" y="10" width="32" height="26" rx="5" fill="#3182F6" fillOpacity="0.12"/>
                  <rect x="6" y="10" width="32" height="10" rx="5" fill="#3182F6" fillOpacity="0.25"/>
                  <rect x="13" y="6" width="3" height="8" rx="1.5" fill="#3182F6"/>
                  <rect x="28" y="6" width="3" height="8" rx="1.5" fill="#3182F6"/>
                  <path d="M22 32c-.3 0-8-5.2-8-10.3C14 19 15.8 17 18.2 17c1.3 0 2.8.7 3.8 2 1-1.3 2.5-2 3.8-2C28.2 17 30 19 30 21.7 30 26.8 22.3 32 22 32z" fill="#9B8AA8"/>
                </svg>
              </div>

              <h1 className="text-[28px] font-bold text-gray-900 mb-2.5 tracking-tight">우리 사이</h1>
              <p className="text-[15px] text-gray-500 leading-relaxed">두 사람만을 위한<br/>공유 캘린더예요</p>

              <div className="mt-8 space-y-2 w-full max-w-[300px]">
                {[
                  { icon: '📅', text: '서로의 일정을 공유하고 그 날 감사한 일을 적어요' },
                  { icon: '💕', text: 'D+N, 기념일, 생일을 자동으로 알려줘요' },
                  { icon: '🔔', text: '파트너 일정을 수락·거절할 수 있어요' },
                ].map(f => (
                  <div key={f.icon} className="flex items-center gap-3 text-left bg-gray-50 rounded-2xl px-4 py-3">
                    <span className="text-lg flex-shrink-0">{f.icon}</span>
                    <span className="text-[13px] text-gray-600 leading-snug">{f.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={handleWelcomeClick}
                disabled={loginLoading}
                className="w-full h-[56px] rounded-[16px] flex items-center justify-center font-bold text-[16px] active:scale-[0.98] transition-all disabled:opacity-60"
                style={{ background: '#3182F6', color: '#fff' }}
              >
                {loginLoading ? '로그인 중…' : '토스로 로그인하기'}
              </button>
              {loginError && (
                <p className="text-center text-[12px] text-red-500 px-3">{loginError}</p>
              )}
              <p className="text-center text-[11px] text-gray-400">
                가입하면 이용약관 및 개인정보처리방침에 동의하게 됩니다
              </p>
            </div>
          </div>
        )}

        {/* ══ STEP 2: TERMS ══ */}
        {step === 'terms' && (
          <div className="flex-1 flex flex-col animate-fade-in">
            <div className="mb-8 pt-4">
              <h2 className="text-[22px] font-bold text-gray-900 mb-1">서비스 이용에 동의해 주세요</h2>
              <p className="text-[14px] text-gray-500">필수 항목에 동의해야 시작할 수 있어요</p>
            </div>

            <div className="space-y-3 flex-1">
              <button
                onClick={() => {
                  const all = TERMS.every(t => agreed[t.id]);
                  const next: Record<string,boolean> = {};
                  TERMS.forEach(t => { next[t.id] = !all; });
                  setAgreed(next);
                }}
                className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border-2 border-gray-100 transition-colors"
              >
                <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${
                  TERMS.every(t => agreed[t.id]) ? 'bg-[#3182F6]' : 'border-2 border-gray-200 bg-white'
                }`}>
                  {TERMS.every(t => agreed[t.id]) && <Check size={13} className="text-white" strokeWidth={3}/>}
                </div>
                <span className="text-[15px] font-bold text-gray-900">전체 동의하기</span>
              </button>

              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-50">
                {TERMS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setAgreed(p => ({ ...p, [t.id]: !p[t.id] }))}
                    className="w-full flex items-center gap-4 px-4 py-4 text-left"
                  >
                    <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${
                      agreed[t.id] ? 'bg-[#3182F6]' : 'border-2 border-gray-200'
                    }`}>
                      {agreed[t.id] && <Check size={10} className="text-white" strokeWidth={3}/>}
                    </div>
                    <span className="text-[14px] text-gray-700">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep('profile')}
              disabled={!allRequired}
              className="tds-btn-primary mt-6"
              style={{ background: allRequired ? '#3182F6' : undefined }}
            >
              동의하고 계속하기
            </button>
          </div>
        )}

        {/* ══ STEP 3: PROFILE ══ */}
        {step === 'profile' && (
          <div className="flex-1 flex flex-col animate-fade-in">
            <div className="mb-6 pt-4">
              <h2 className="text-[22px] font-bold text-gray-900 mb-1">프로필을 만들어요</h2>
              <p className="text-[14px] text-gray-500">파트너에게 이렇게 보여요</p>
            </div>

            <div className="mb-5">
              <label className="block text-[13px] font-medium text-gray-500 mb-2">나의 별명</label>
              <input
                type="text"
                value={nickname}
                onChange={e => setNickname(e.target.value.slice(0, 10))}
                placeholder="이름 또는 별명"
                autoFocus
                className="tds-input text-[16px]"
              />
            </div>

            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays size={14} style={{ color: '#3182F6' }}/>
                <label className="text-[13px] font-medium" style={{ color: '#3182F6' }}>
                  사귄 날짜 <span className="text-red-400 font-normal">(필수)</span>
                </label>
              </div>
              <input
                type="date"
                value={anniversary}
                onChange={e => setAnniversary(e.target.value)}
                className="tds-input"
              />
            </div>

            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <Cake size={14} className="text-amber-400"/>
                <label className="text-[13px] font-medium text-gray-500">생일 (선택 · MM-DD)</label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={myBday} onChange={e => setMyBday(e.target.value.slice(0,5))}
                  placeholder={`내 생일 (12-05)`} maxLength={5} className="tds-input text-[13px] py-2.5"/>
                <input type="text" value={partnerBday} onChange={e => setPartnerBday(e.target.value.slice(0,5))}
                  placeholder="상대방 (04-19)" maxLength={5} className="tds-input text-[13px] py-2.5"/>
              </div>
            </div>

            <div className="flex-1">
              <label className="block text-[13px] font-medium text-gray-500 mb-2.5">나의 캐릭터</label>
              <div className="grid grid-cols-5 gap-2">
                {CHARACTERS.map(c => {
                  const sel = character === c.type;
                  return (
                    <button
                      key={c.type}
                      onClick={() => setCharacter(c.type)}
                      className={`relative flex flex-col items-center gap-1 py-2 rounded-2xl border-2 transition-all active:scale-95 ${
                        sel ? 'border-[#3182F6] bg-[#EBF3FE]' : 'border-gray-100 bg-white'
                      }`}
                    >
                      {sel && (
                        <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-[#3182F6] rounded-full flex items-center justify-center">
                          <Check size={9} className="text-white" strokeWidth={3}/>
                        </span>
                      )}
                      <div className="w-10 h-10 relative">
                        <Image src={c.image} alt={c.label} fill className="object-contain"
                          onError={e => {
                            const p = (e.target as HTMLImageElement).parentElement;
                            if (p) p.innerHTML = `<span style="font-size:24px;display:flex;align-items:center;justify-content:center;width:100%;height:100%">${c.emoji}</span>`;
                          }}
                        />
                      </div>
                      <span className={`text-[10px] font-medium ${sel ? 'text-[#3182F6]' : 'text-gray-400'}`}>
                        {c.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => { setStep('invite'); setInviteMode('choice'); setInviteError(null); }}
              disabled={!nickname.trim() || !anniversary}
              className="tds-btn-primary mt-5"
              style={{ background: '#3182F6' }}
            >
              파트너 초대하러 가기
            </button>
          </div>
        )}

        {/* ══ STEP 4: INVITE ══ */}
        {step === 'invite' && (
          <div className="flex-1 flex flex-col animate-fade-in">

            {/* (a) 갈래 선택 */}
            {inviteMode === 'choice' && (
              <>
                <div className="mb-7 pt-4">
                  <h2 className="text-[22px] font-bold text-gray-900 mb-1">파트너와 연결해요</h2>
                  <p className="text-[14px] text-gray-500">초대 코드를 발급하거나, 받은 코드를 입력하세요</p>
                </div>

                <div className="flex-1 space-y-3">
                  <button
                    onClick={handleIssueCode}
                    disabled={inviteLoading}
                    className="w-full flex flex-col items-start gap-1 p-5 bg-gray-50 rounded-2xl border-2 border-transparent active:border-[#3182F6] transition-all disabled:opacity-60"
                  >
                    <span className="text-[15px] font-bold text-gray-900">📨 내가 초대할게요</span>
                    <span className="text-[13px] text-gray-500">초대 코드를 받아 파트너에게 전달</span>
                  </button>
                  <button
                    onClick={() => { setInviteMode('input'); setInviteError(null); }}
                    disabled={inviteLoading}
                    className="w-full flex flex-col items-start gap-1 p-5 bg-gray-50 rounded-2xl border-2 border-transparent active:border-[#3182F6] transition-all disabled:opacity-60"
                  >
                    <span className="text-[15px] font-bold text-gray-900">🔑 코드 받았어요</span>
                    <span className="text-[13px] text-gray-500">파트너에게 받은 6자리 코드 입력</span>
                  </button>
                </div>

                {inviteError && (
                  <p className="text-center text-[12px] text-red-500 mb-3">{inviteError}</p>
                )}

                <div className="space-y-2 mt-5">
                  <button
                    onClick={handleFinish}
                    disabled={inviteLoading}
                    className="tds-btn-ghost"
                  >
                    {inviteLoading ? '저장 중…' : '나중에 연결할게요'}
                  </button>
                </div>
              </>
            )}

            {/* (b) 발급된 코드 표시 */}
            {inviteMode === 'show' && (
              <>
                <div className="mb-7 pt-4">
                  <h2 className="text-[22px] font-bold text-gray-900 mb-1">파트너에게 코드를 전달해요</h2>
                  <p className="text-[14px] text-gray-500">상대방이 코드를 입력하면 자동으로 연결돼요</p>
                </div>

                <div className="flex-1">
                  <div className="bg-gray-50 rounded-2xl p-6 text-center mb-5">
                    <p className="text-[12px] text-gray-400 mb-2">초대 코드</p>
                    <p className="text-[38px] font-bold tracking-[0.25em] text-gray-900 font-mono mb-5">
                      {codeToShow}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopy}
                        className="flex-1 h-[48px] flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-[14px] text-[14px] font-medium text-gray-600 active:scale-[0.98] transition-all"
                      >
                        {copied ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>}
                        {copied ? '복사됨!' : '코드 복사'}
                      </button>
                      <button
                        onClick={async () => {
                          if (navigator.share) {
                            await navigator.share({ title: '우리 사이', text: `초대 코드: ${codeToShow}` }).catch(() => {});
                          } else {
                            handleCopy();
                          }
                        }}
                        className="flex-1 h-[48px] flex items-center justify-center gap-2 rounded-[14px] text-[14px] font-bold text-white active:scale-[0.98] transition-all"
                        style={{ background: '#3182F6' }}
                      >
                        <Share2 size={16}/>
                        공유하기
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mt-5">
                  <button
                    onClick={handleFinish}
                    disabled={inviteLoading}
                    className="tds-btn-primary"
                    style={{ background: '#3182F6' }}
                  >
                    {inviteLoading ? '저장 중…' : '우리 사이 시작하기 🎉'}
                  </button>
                </div>
              </>
            )}

            {/* (c) 코드 입력 */}
            {inviteMode === 'input' && (
              <>
                <div className="mb-7 pt-4">
                  <h2 className="text-[22px] font-bold text-gray-900 mb-1">받은 코드를 입력해요</h2>
                  <p className="text-[14px] text-gray-500">파트너에게 받은 6자리 코드를 적어주세요</p>
                </div>

                <div className="flex-1">
                  <input
                    type="text"
                    value={inputCode}
                    onChange={e => setInputCode(e.target.value.toUpperCase().slice(0, 6))}
                    placeholder="ABC123"
                    autoFocus
                    maxLength={6}
                    className="tds-input text-center text-[24px] tracking-[0.3em] font-mono"
                  />
                  {inviteError && (
                    <p className="text-center text-[12px] text-red-500 mt-3">{inviteError}</p>
                  )}
                </div>

                <div className="space-y-2 mt-5">
                  <button
                    onClick={handleAcceptInvite}
                    disabled={inviteLoading || inputCode.length !== 6}
                    className="tds-btn-primary"
                    style={{ background: '#3182F6' }}
                  >
                    {inviteLoading ? '연결 중…' : '연결하고 시작하기'}
                  </button>
                  <button
                    onClick={() => { setInviteMode('choice'); setInviteError(null); setInputCode(''); }}
                    className="tds-btn-ghost"
                  >
                    뒤로
                  </button>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
