import React from 'react';
import { Card } from '../../components/common/Card';
import { useAuth } from '../../context/AuthContext';
import { User, Shield, MapPin, KeyRound, CheckCircle2, ShieldCheck, ShieldAlert } from 'lucide-react';

export const VoProfileView: React.FC = () => {
  const { session, profile, scope, hasPermission } = useAuth();

  const user = session?.user;
  const permissions = scope?.permissions || profile?.permissions || [];
  const assignedVillages = scope?.assigned_villages || profile?.assigned_villages || [];
  const isVaccinator = scope?.is_approved_vaccinator || hasPermission('vaccination.record');
  const canConfirmDisease = hasPermission('disease.confirm');

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="pb-4 border-b border-[#E2E8F0]">
        <h2 className="text-xl font-bold text-[#1E293B] font-heading flex items-center gap-2">
          <User className="w-5 h-5 text-[#135D43]" />
          વેટરનરી ઓફિસર પ્રોફાઇલ
        </h2>
        <p className="text-xs text-[#64748B] mt-1">
          તમારા એકાઉન્ટની વિગતો, અધિકૃત ગામડાં અને ક્લિનિકલ સત્તાવાર દરજ્જો.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 md:col-span-1 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-[#135D43] text-white flex items-center justify-center font-bold text-2xl mb-4 shadow-sm">
            {user?.fullName ? user.fullName.substring(0, 2) : 'VO'}
          </div>
          <h3 className="font-bold text-base text-[#1E293B]">{user?.fullName || 'ડૉ. વેટરનરી ઓફિસર'}</h3>
          <p className="text-xs text-[#64748B] mt-0.5 font-mono">@{user?.username || 'vo_botad'}</p>

          <span className="inline-flex items-center gap-1 mt-3 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <Shield className="w-3.5 h-3.5" />
            હોદ્દો: પશુ ચિકિત્સક અધિકારી (VO)
          </span>

          <div className="w-full border-t border-[#E2E8F0] mt-6 pt-4 text-left text-xs text-[#64748B] space-y-2">
            <div className="flex items-center justify-between">
              <span>ખાતાની સ્થિતિ:</span>
              <span className="font-semibold text-emerald-700">સક્રિય</span>
            </div>
            <div className="flex items-center justify-between">
              <span>હોસ્પિટલ / દવાખાનું:</span>
              <span className="font-semibold text-[#1E293B]">સરકારી પશુ દવાખાનું</span>
            </div>
          </div>
        </Card>

        <div className="space-y-6 md:col-span-2">
          {/* Clinical Authority Cards */}
          <Card className="p-6">
            <h4 className="font-bold text-sm text-[#1E293B] flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-[#135D43]" />
              ક્લિનિકલ અને રોગ નિયંત્રણ સત્તા દરજ્જો
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className={`p-3 rounded-xl border ${canConfirmDisease ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="font-bold text-gray-900 flex items-center gap-1.5">
                  {canConfirmDisease ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-gray-400" />}
                  રોગ પુષ્ટિ સત્તા
                </div>
                <div className="text-gray-600 mt-1">
                  {canConfirmDisease ? 'અધિકૃત: કેસ પુષ્ટિ કરી શકો છો.' : 'મર્યાદિત: માત્ર સમીક્ષા નોંધ ઉમેરી શકો છો.'}
                </div>
              </div>

              <div className={`p-3 rounded-xl border ${isVaccinator ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="font-bold text-gray-900 flex items-center gap-1.5">
                  {isVaccinator ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-gray-400" />}
                  રસીકરણ અધિકાર દરજ્જો
                </div>
                <div className="text-gray-600 mt-1">
                  {isVaccinator ? 'માન્ય: રસીકરણ સીધું નોંધી શકો છો.' : 'મર્યાદિત: માત્ર ક્લિનિકલ સારવાર નોંધી શકાય.'}
                </div>
              </div>
            </div>
          </Card>

          {/* Assigned Villages Jurisdiction */}
          <Card className="p-6">
            <h4 className="font-bold text-sm text-[#1E293B] flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-[#135D43]" />
              સોંપાયેલ અધિકૃત ગામડાં ({assignedVillages.length} ગામ)
            </h4>
            {assignedVillages.length === 0 ? (
              <p className="text-xs text-[#64748B]">તમને હજુ સુધી કોઈ ગામ સોંપાયેલ નથી. કૃપા કરીને DAHO નો સંપર્ક કરો.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {assignedVillages.map((vId) => (
                  <span
                    key={vId}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono bg-emerald-50 text-emerald-800 border border-emerald-200"
                  >
                    <MapPin className="w-3 h-3 text-[#135D43]" />
                    {vId.substring(0, 8)}...
                  </span>
                ))}
              </div>
            )}
          </Card>

          {/* Permissions */}
          <Card className="p-6">
            <h4 className="font-bold text-sm text-[#1E293B] flex items-center gap-2 mb-3">
              <KeyRound className="w-4 h-4 text-[#135D43]" />
              સક્રિય સિસ્ટમ પરવાનગીઓ
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {permissions.map((p) => (
                <span
                  key={p}
                  className="px-2 py-0.5 rounded text-[11px] font-mono bg-gray-100 text-gray-700 border"
                >
                  {p}
                </span>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

