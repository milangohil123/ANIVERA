import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../../components/LoginForm';
import { useAuth, getRolePrefix, normalizeRole } from '../../context/AuthContext';
import { type AuthSession } from '../../services/authService';
import { STRINGS_GU } from '../../constants/stringsGu';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { LanguageSelector } from '../../components/common/LanguageSelector';

export const LoginView: React.FC = () => {
  const { isAuthenticated, rolePrefix, apiBaseUrl } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate(rolePrefix, { replace: true });
    }
  }, [isAuthenticated, rolePrefix, navigate]);

  const handleLoginSuccess = (session: AuthSession) => {
    const target = session.user ? getRolePrefix(normalizeRole(session.user.role)) : '/login';
    navigate(target, { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F1F5FC] font-body selection:bg-[#135D43] selection:text-white">
      {/* Left 45% Brand Panel */}
      <div className="lg:w-[45%] bg-[#135D43] text-white flex flex-col justify-between p-6 sm:p-10 lg:p-16 flex-shrink-0">
        <div>
          {/* Back Button */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-white/80 hover:text-white text-xs font-semibold mb-8 lg:mb-16 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('auth.backToHome')}</span>
          </button>

          {/* Brand Presentation */}
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center font-bold text-2xl font-heading shadow-inner">
              AV
            </div>

            <div className="pt-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-white/15 text-white border border-white/20 mb-3">
                {STRINGS_GU.app.pilotBadge}
              </span>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold font-heading text-white tracking-tight">
                {STRINGS_GU.app.title}
              </h1>
              <p className="text-white/80 text-sm sm:text-base mt-2 leading-relaxed max-w-md">
                {STRINGS_GU.app.subtitle}
              </p>
            </div>
          </div>

          {/* Key Value Highlights */}
          <div className="mt-10 lg:mt-16 space-y-3.5 hidden sm:block">
            <div className="flex items-center gap-3 text-xs sm:text-sm text-white/90">
              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
              </div>
              <span>{t('auth.highlight1Staff')}</span>
            </div>

            <div className="flex items-center gap-3 text-xs sm:text-sm text-white/90">
              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
              </div>
              <span>{t('auth.highlight2Staff')}</span>
            </div>

            <div className="flex items-center gap-3 text-xs sm:text-sm text-white/90">
              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
              </div>
              <span>{t('auth.highlight3Staff')}</span>
            </div>
          </div>
        </div>

        {/* Brand Footer */}
        <div className="pt-8 mt-8 border-t border-white/10 text-xs text-white/60">
          {t('auth.botadPilotFooter')}
        </div>
      </div>

      {/* Right 55% Login Form Area */}
      <div className="lg:w-[55%] flex-1 relative flex items-center justify-center p-6 sm:p-10 lg:p-16 bg-[#F1F5FC]">
        <div className="absolute top-6 right-6 z-20">
          <LanguageSelector variant="light" />
        </div>
        <div className="w-full max-w-md">
          <LoginForm apiBaseUrl={apiBaseUrl} onLoginSuccess={handleLoginSuccess} initialTab="STAFF" />
        </div>
      </div>
    </div>
  );
};
