import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { transliterateToGujarati } from '../../utils/transliterateGujarati';
import {
  User,
  Shield,
  MapPin,
  Mail,
  Phone,
  Briefcase,
  Layers,
  KeyRound,
  CheckCircle2,
  Calendar,
  ChevronRight,
} from 'lucide-react';

export const TahoProfileView: React.FC = () => {
  const { profile, session, apiBaseUrl } = useAuth();
  const [overview, setOverview] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    adminService
      .getTahoOverview(apiBaseUrl)
      .then((ov) => setOverview(ov))
      .catch((err) => console.warn('Profile overview note:', err))
      .finally(() => setIsLoading(false));
  }, [apiBaseUrl]);

  const userObj = profile || session?.user || {};
  const talukaName = overview?.taluka_name_gu || (overview?.taluka_name_en ? transliterateToGujarati(overview.taluka_name_en) : 'તાલુકો');
  const districtName = overview?.district_name_gu || (overview?.district_name_en ? transliterateToGujarati(overview.district_name_en) : 'જિલ્લો');

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-12 font-body text-slate-800 animate-fade-in">
      {/* 0. Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
        <span>વહીવટ</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span>તાલુકા પશુપાલન અધિકારી (TAHO)</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-[#0F172A] font-medium">પ્રોફાઇલ અને કાર્યક્ષેત્ર વિગતો</span>
      </div>

      {/* 1. Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold text-lg font-heading">
            {userObj.fullName?.[0] || userObj.full_name?.[0] || 'T'}
          </div>
          <div>
            <h1 className="text-lg font-bold font-heading text-slate-900">
              {userObj.fullName || userObj.full_name || 'તાલુકા પશુપાલન અધિકારી'}
            </h1>
            <p className="text-xs text-slate-500 font-mono">
              @{userObj.username} • {userObj.role || 'TAHO'}
            </p>
          </div>
        </div>

        <StatusChip status="ACTIVE" label="સક્રિય એકાઉન્ટ" />
      </div>

      {/* 2. Jurisdiction Card */}
      <Card className="p-5 bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
          <MapPin className="w-4 h-4 text-emerald-700" />
          <span>વહીવટી કાર્યક્ષેત્ર (Administrative Jurisdiction)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-100">
            <span className="text-[10px] text-emerald-800 font-medium block">સોંપાયેલ તાલુકો</span>
            <span className="text-base font-bold font-heading text-emerald-950 mt-0.5 block">
              {talukaName} ({overview?.taluka_name_en || '-'})
            </span>
            <span className="text-[10px] font-mono text-emerald-700">કોડ: {overview?.taluka_code}</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-500 font-medium block">જિલ્લો</span>
            <span className="text-base font-bold font-heading text-slate-900 mt-0.5 block">
              {districtName} ({overview?.district_name_en || '-'})
            </span>
            <span className="text-[10px] text-slate-400">મહેસૂલી જિલ્લો</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-500 font-medium block">સત્તાવાર ગામો</span>
            <span className="text-base font-bold font-heading text-slate-900 mt-0.5 block">
              {overview?.total_villages || 0} ગામો
            </span>
            <span className="text-[10px] text-emerald-700 font-medium">સંપૂર્ણ GIS સીમાઓ સક્રિય</span>
          </div>
        </div>
      </Card>

      {/* 3. Official Contact & Designation Details */}
      <Card className="p-5 bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
          <Briefcase className="w-4 h-4 text-emerald-700" />
          <span>અધિકારીની વિગતો (Officer Profile)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block mb-0.5">સત્તાવાર હોદ્દો:</span>
            <span className="font-semibold text-slate-900">
              {userObj.designation || 'તાલુકા પશુપાલન અધિકારી (TAHO)'}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block mb-0.5">સંસ્થા / વિભાગ:</span>
            <span className="font-semibold text-slate-900">
              {userObj.organisation || 'પશુપાલન નિયામકની કચેરી, ગુજરાત સરકાર'}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block mb-0.5">સત્તાવાર ઇમેઇલ:</span>
            <span className="font-mono text-slate-800">{userObj.email || '-'}</span>
          </div>

          <div>
            <span className="text-slate-500 block mb-0.5">મોબાઇલ નંબર:</span>
            <span className="font-mono text-slate-800">{userObj.mobile || userObj.mobile_e164 || '-'}</span>
          </div>
        </div>
      </Card>

      {/* 4. Security & Access Audit */}
      <Card className="p-5 bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
          <Shield className="w-4 h-4 text-emerald-700" />
          <span>સુરક્ષા & પ્રમાણીકરણ (Security & Audit)</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs pt-1">
          <div className="space-y-1">
            <div className="font-semibold text-slate-800">પાસવર્ડ & સત્ર સુરક્ષા</div>
            <p className="text-[11px] text-slate-500">
              તમારું સત્ર એન્ક્રિપ્ટેડ JWT ટોકન દ્વારા સુરક્ષિત છે. ભૂમિકા: <strong>TAHO</strong>.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => alert('પાસવર્ડ બદલવા માટે તમારા સિસ્ટમ એડમિનિસ્ટ્રેટર (DAHO / SYS_ADMIN) નો સંપર્ક કરો.')}
            leftIcon={<KeyRound className="w-3.5 h-3.5" />}
          >
            પાસવર્ડ બદલો
          </Button>
        </div>
      </Card>
    </div>
  );
};
