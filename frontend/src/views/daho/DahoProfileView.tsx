import React from 'react';
import { Card } from '../../components/common/Card';
import { useAuth } from '../../context/AuthContext';
import { User, Shield, MapPin, KeyRound, CheckCircle2 } from 'lucide-react';

export const DahoProfileView: React.FC = () => {
  const { session, profile, scope, selectedDistrict, assignedDistricts } = useAuth();

  const user = session?.user;
  const permissions = scope?.permissions || profile?.permissions || [];
  const currentDistrictName = selectedDistrict?.name_gu || assignedDistricts?.[0]?.name_gu || selectedDistrict?.name_en || assignedDistricts?.[0]?.name_en || 'જૂનાગઢ';
  const currentDistrictCode = selectedDistrict?.code || assignedDistricts?.[0]?.code || 'DIST_JUNAGADH';

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="pb-4 border-b border-[#E2E8F0]">
        <h2 className="text-xl font-bold text-[#1E293B] font-heading flex items-center gap-2">
          <User className="w-5 h-5 text-[#135D43]" />
          અધિકારી પ્રોફાઇલ (Official Profile)
        </h2>
        <p className="text-xs text-[#64748B] mt-1">
          તમારા DAHO એકાઉન્ટની વિગતો, જિલ્લા સ્કોપ અને સક્રિય વહીવટી પરવાનગીઓ.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 md:col-span-1 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-[#135D43] text-white flex items-center justify-center font-bold text-2xl mb-4 shadow-sm">
            {user?.fullName ? user.fullName.substring(0, 2) : 'DA'}
          </div>
          <h3 className="font-bold text-base text-[#1E293B]">{user?.fullName || 'જિલ્લા પશુપાલન અધિકારી'}</h3>
          <p className="text-xs text-[#64748B] mt-0.5 font-mono">@{user?.username || 'daho_official'}</p>

          <span className="inline-flex items-center gap-1 mt-3 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <Shield className="w-3.5 h-3.5" />
            હોદ્દો: DAHO (જિલ્લા અધિકારી)
          </span>

          <div className="w-full border-t border-[#E2E8F0] mt-6 pt-4 text-left text-xs text-[#64748B] space-y-2">
            <div className="flex items-center justify-between">
              <span>ખાતાની સ્થિતિ:</span>
              <span className="font-semibold text-emerald-700">સક્રિય (Active)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>વિભાગ:</span>
              <span className="font-semibold text-[#1E293B]">પશુપાલન વિભાગ</span>
            </div>
          </div>
        </Card>

        <div className="space-y-6 md:col-span-2">
          <Card className="p-6">
            <h4 className="font-bold text-sm text-[#1E293B] flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-[#135D43]" />
              સોંપાયેલ જિલ્લા વહીવટી સીમા (District Jurisdiction)
            </h4>
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div className="text-xs text-[#64748B]">અધિકૃત જિલ્લા કોડ:</div>
              <div className="text-base font-bold text-[#135D43] font-mono mt-0.5">
                {currentDistrictCode} ({currentDistrictName} જિલ્લો)
              </div>
              <p className="text-xs text-[#64748B] mt-2">
                આ એકાઉન્ટ માત્ર {currentDistrictName} જિલ્લાના તાલુકા, ગામડાં, પંચાયતો અને સ્ટાફ સંચાલન માટે અધિકૃત છે.
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <h4 className="font-bold text-sm text-[#1E293B] flex items-center gap-2 mb-4">
              <KeyRound className="w-4 h-4 text-[#135D43]" />
              સક્રિય RBAC પરવાનગીઓ (Effective Permissions)
            </h4>
            {permissions.length === 0 ? (
              <p className="text-xs text-[#64748B]">DAHO ડિફોલ્ટ પરવાનગીઓ સક્રિય છે.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {permissions.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono bg-emerald-50 text-emerald-800 border border-emerald-200"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    {p}
                  </span>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

