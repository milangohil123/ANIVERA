import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { useAuth } from '../../context/AuthContext';
import { fwService, type FWVillageItem } from '../../services/fwService';
import { networkSyncManager } from '../../services/networkSyncManager';
import {
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  MapPin,
  LogOut,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

export const FwProfileView: React.FC = () => {
  const navigate = useNavigate();
  const { profile, session, scope, hasPermission, logout, apiBaseUrl } = useAuth();
  const isVaccinator = Boolean(scope?.is_approved_vaccinator || hasPermission('vaccination.record'));

  const [villages, setVillages] = useState<FWVillageItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchProfileData = async () => {
      try {
        const [vList, counts] = await Promise.all([
          fwService.listAssignedVillages(apiBaseUrl),
          networkSyncManager.getPendingCounts(),
        ]);
        if (isMounted) {
          setVillages(vList);
          setPendingCount(counts.pendingEvents + counts.pendingMedia);
        }
      } catch (e) {
        console.warn('Failed to load FW profile data:', e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchProfileData();
    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  const handleLogout = async () => {
    if (pendingCount > 0) {
      const confirm = window.confirm(
        `ચેતવણી: તમારા ઉપકરણમાં ${pendingCount} રેકોર્ડ્સ ઑફલાઇન સિંક થવાના બાકી છે. લૉગઆઉટ કરવાથી આ ડેટા ડિલીટ નહીં થાય પરંતુ જ્યાં સુધી ફરી લૉગિન ન થાઓ ત્યાં સુધી સિંક નહીં થાય. શું તમે ખરેખર બહાર નીકળવા માંગો છો?`
      );
      if (!confirm) return;
    }
    await logout();
    navigate('/login');
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 pb-10 font-body text-[#172033]">
      {/* Profile Card */}
      <Card noPadding className="p-4 bg-white">
        <div className="flex items-center gap-3 pb-3 border-b border-[#E2E8F0]">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg font-heading">
            {profile?.full_name?.charAt(0) || 'F'}
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1E293B] font-heading">{profile?.full_name || 'ક્ષેત્રીય સ્ટાફ'}</h2>
            <p className="text-xs text-[#64748B] font-mono mt-0.5">@{session?.user.username || 'field_worker'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 text-xs">
          <div>
            <span className="text-[#64748B]">હોદ્દો:</span>
            <p className="font-semibold text-[#1E293B] mt-0.5">ક્ષેત્રીય કાર્યકર</p>
          </div>
          <div>
            <span className="text-[#64748B]">સ્થિતિ:</span>
            <div className="mt-0.5">
              <StatusChip variant="success" label="સક્રિય" />
            </div>
          </div>
        </div>
      </Card>

      {/* Clinical / Vaccinator Authority Status */}
      <Card noPadding className="p-4">
        <h3 className="text-xs font-bold text-[#1E293B] mb-2 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#135D43]" />
          ક્ષેત્રીય સત્તા અને અધિકારપત્ર
        </h3>

        {isVaccinator ? (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">અધિકૃત રસીકરણકર્તા</p>
              <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                તમને રસીકરણ ઇવેન્ટ્સ વહીવટી અને ક્ષેત્રીય સ્તરે નોંધવાની અધિકૃત સત્તા ફાળવેલ છે.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">પ્રાથમિક નોંધણીકાર / સર્વેયર</p>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                તમે ખેડૂત, પશુ, રોગ અહેવાલ અને સારવાર નોંધી શકો છો. રસીકરણ સત્તા માટે વેટરનરી અધિકારીનો સંપર્ક કરવો.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Assigned Villages Scope */}
      <Card noPadding className="p-4">
        <h3 className="text-xs font-bold text-[#1E293B] mb-2 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-[#135D43]" />
          ફાળવેલા ગામડાઓ ({villages.length})
        </h3>

        {isLoading ? (
          <p className="text-xs text-[#64748B]">લોડ થઈ રહ્યું છે...</p>
        ) : villages.length === 0 ? (
          <p className="text-xs text-red-600">હાલમાં કોઈ ગામ ફાળવેલ નથી.</p>
        ) : (
          <div className="space-y-1.5">
            {villages.map((v) => (
              <div key={v.id} className="p-2.5 rounded-lg border bg-gray-50 text-xs flex justify-between items-center">
                <div>
                  <span className="font-semibold text-[#1E293B]">{v.name_gu}</span>
                  <span className="text-[#64748B] font-mono text-[11px] ml-1.5">({v.code})</span>
                </div>
                <StatusChip variant="success" label="અધિકૃત" size="sm" />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Device & Offline Grant Card */}
      <Card noPadding className="p-4">
        <h3 className="text-xs font-bold text-[#1E293B] mb-2 flex items-center gap-1.5">
          <Smartphone className="w-4 h-4 text-[#135D43]" />
          ઉપકરણ અને ઑફલાઇન માન્યતા
        </h3>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center py-1.5 border-b border-[#E2E8F0]">
            <span className="text-[#64748B]">ઉપકરણ ઓળખ (Device ID):</span>
            <span className="font-mono text-[#1E293B]">{session?.deviceId?.substring(0, 16)}...</span>
          </div>

          <div className="flex justify-between items-center py-1.5 border-b border-[#E2E8F0]">
            <span className="text-[#64748B]">ઑફલાઇન મર્યાદા (૭ દિવસ):</span>
            <span className="font-semibold text-emerald-700">સક્રિય માન્યતા</span>
          </div>

          <div className="flex justify-between items-center py-1.5">
            <span className="text-[#64748B]">બાકી સિંક રેકોર્ડ્સ:</span>
            <span className={`font-bold ${pendingCount > 0 ? 'text-amber-700' : 'text-[#1E293B]'}`}>
              {pendingCount} રેકોર્ડ્સ
            </span>
          </div>
        </div>
      </Card>

      {/* Logout Warning & Button */}
      {pendingCount > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            તમારા ઉપકરણમાં <strong>{pendingCount}</strong> રેકોર્ડ્સ સિંક થવાના બાકી છે. લૉગઆઉટ કરવાથી ડેટા નષ્ટ નહીં થાય, પરંતુ નેટવર્ક મળતા પહેલા સિંક કરી લેવું હિતાવહ છે.
          </p>
        </div>
      )}

      <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={handleLogout} leftIcon={<LogOut className="w-4 h-4" />}>
        બહાર નીકળો
      </Button>
    </div>
  );
};

