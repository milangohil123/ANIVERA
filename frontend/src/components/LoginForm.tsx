import React, { useState } from 'react';
import { authService, type AuthSession } from '../services/authService';
import { Lock, User, Phone, KeyRound, Loader2, LogIn, ShieldAlert } from 'lucide-react';
import { useTranslation } from '../i18n';

interface LoginFormProps {
  apiBaseUrl: string;
  onLoginSuccess: (session: AuthSession) => void;
  initialTab?: 'STAFF' | 'FARMER';
}

export const LoginForm: React.FC<LoginFormProps> = ({
  apiBaseUrl,
  onLoginSuccess,
  initialTab = 'STAFF',
}) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'STAFF' | 'FARMER'>(initialTab);

  // Staff state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Farmer OTP state
  const [mobile, setMobile] = useState('+91');
  const [otpCode, setOtpCode] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  React.useEffect(() => {
    let timer: any = null;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [resendCountdown]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const session = await authService.loginStaff(apiBaseUrl, username, password);
      onLoginSuccess(session);
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      if (rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')) {
        setError(t('auth.serverConnectionError'));
      } else {
        setError(rawMsg || t('auth.loginFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const msg = await authService.requestFarmerOtp(apiBaseUrl, mobile);
      setOtpRequested(true);
      setOtpMessage(msg);
      setResendCountdown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.otpSendFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const session = await authService.verifyFarmerOtp(apiBaseUrl, mobile, otpCode);
      onLoginSuccess(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.otpVerifyFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 w-full transition-all duration-200">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#0F172A] font-heading">
          {tab === 'STAFF' ? t('auth.staffLogin') : t('auth.farmerLogin')}
        </h2>
        <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
          {tab === 'STAFF'
            ? t('auth.staffLoginSubtitle')
            : t('auth.farmerLoginSubtitle')}
        </p>
      </div>

      {/* Login Mode Tabs */}
      <div className="grid grid-cols-2 p-1 bg-[#F1F5F9] rounded-xl mb-6 text-xs font-semibold">
        <button
          type="button"
          onClick={() => {
            setTab('STAFF');
            setError(null);
          }}
          className={`py-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
            tab === 'STAFF'
              ? 'bg-white text-[#135D43] shadow-xs'
              : 'text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <User className="w-4 h-4" />
          <span>{t('auth.staffTab')}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('FARMER');
            setError(null);
          }}
          className={`py-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
            tab === 'FARMER'
              ? 'bg-white text-[#135D43] shadow-xs'
              : 'text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Phone className="w-4 h-4" />
          <span>{t('auth.farmerTab')}</span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-[#DC2626] text-xs flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {tab === 'STAFF' ? (
        <form onSubmit={handleStaffSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
              {t('auth.username')}
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-3 text-[#94A3B8]" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('auth.usernamePlaceholder')}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#135D43] focus:border-[#135D43] transition-all"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
              {t('auth.password')}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-[#94A3B8]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#135D43] focus:border-[#135D43] transition-all"
                disabled={isLoading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-[#135D43] hover:bg-[#0F4C37] text-white font-semibold rounded-xl transition-all duration-200 shadow-xs flex items-center justify-center gap-2 text-sm disabled:opacity-50 mt-2 cursor-pointer"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            <span>{isLoading ? t('auth.verifying') : t('auth.loginBtn')}</span>
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          {!otpRequested ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  {t('auth.registeredMobile')}
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3 text-[#94A3B8]" />
                  <input
                    type="text"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder={t('auth.mobilePlaceholder')}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-sm font-mono text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#135D43] focus:border-[#135D43] transition-all"
                    disabled={isLoading}
                  />
                </div>
                <p className="text-[11px] text-[#64748B] mt-1.5">
                  {t('auth.preRegisteredNote')}
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-[#135D43] hover:bg-[#0F4C37] text-white font-semibold rounded-xl transition-all duration-200 shadow-xs flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                <span>{isLoading ? t('auth.sending') : t('auth.requestOtpBtn')}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {otpMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[#059669] text-xs leading-relaxed">
                  {otpMessage}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  {t('auth.receivedOtp')}
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder={t('auth.otpPlaceholder')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-center text-lg font-mono tracking-widest text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#135D43] focus:border-[#135D43] transition-all"
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-[#64748B] px-1">
                <span>{t('auth.noOtpReceived')}</span>
                {resendCountdown > 0 ? (
                  <span className="text-[#64748B] font-mono">
                    {t('auth.resendCountdown', { seconds: resendCountdown })}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={isLoading}
                    className="text-[#135D43] font-semibold hover:underline cursor-pointer"
                  >
                    {t('auth.resendOtpBtn')}
                  </button>
                )}
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setOtpRequested(false)}
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-3 border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer"
                >
                  {t('auth.backBtn')}
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-[2] py-2.5 px-4 bg-[#135D43] hover:bg-[#0F4C37] text-white font-semibold rounded-xl transition-all duration-200 shadow-xs flex items-center justify-center gap-2 text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  <span>{isLoading ? t('auth.verifying') : t('auth.verifyBtn')}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
