import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Building, ChevronRight, ShieldCheck, Layers } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { Card } from '../../components/common/Card';

export const DahoDistrictSelectorView: React.FC = () => {
  const { session, profile, role, selectedDistrictId, setSelectedDistrictId, assignedDistricts, apiBaseUrl } = useAuth();
  const navigate = useNavigate();

  const [districts, setDistricts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // If not DAHO or super admin, redirect to respective prefix
    if (role !== 'DAHO' && role !== 'SYS_ADMIN') {
      navigate('/login');
      return;
    }

    const loadDistricts = async () => {
      try {
        setLoading(true);
        // Load assigned districts from API or context
        const distList = await adminService.getDahoAssignedDistricts(apiBaseUrl);
        setDistricts(distList);

        // If only 1 district assigned, select it and go directly to dashboard
        if (distList.length === 1) {
          const singleId = distList[0].id || distList[0].district_id;
          if (singleId) {
            setSelectedDistrictId(singleId);
            navigate('/daho');
          }
        }
      } catch (err) {
        console.warn('Could not load assigned districts from API, using profile:', err);
        if (assignedDistricts.length > 0) {
          setDistricts(assignedDistricts);
          if (assignedDistricts.length === 1) {
            const singleId = assignedDistricts[0].id || assignedDistricts[0].district_id;
            if (singleId) {
              setSelectedDistrictId(singleId);
              navigate('/daho');
            }
          }
        }
      } finally {
        setLoading(false);
      }
    };

    loadDistricts();
  }, [role, apiBaseUrl, assignedDistricts, setSelectedDistrictId, navigate]);

  const handleSelectDistrict = (dist: any) => {
    const id = dist.id || dist.district_id;
    if (id) {
      setSelectedDistrictId(id);
      navigate('/daho');
    }
  };

  const officerName = profile?.full_name || session?.user?.fullName || 'અધિકારી (Officer)';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-body">
      <div className="max-w-3xl w-full mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>મલ્ટી-ડિસ્ટ્રિક્ટ અધિકારક્ષેત્ર (Multi-District Jurisdiction)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900">
            સ્વાગત છે, {officerName}
          </h1>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            તમારા ખાતામાં એક કરતાં વધુ જિલ્લાઓ સોંપાયેલ છે. કૃપા કરીને તમે જે જિલ્લામાં કામગીરી કરવા માંગો છો તે જિલ્લો પસંદ કરો:
          </p>
        </div>

        {/* District Selection Cards */}
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500 animate-pulse">
            નિયુક્ત જિલ્લાઓની માહિતી લોડ થઈ રહી છે...
          </div>
        ) : districts.length === 0 ? (
          <Card className="p-8 text-center text-slate-600 space-y-3 bg-white border border-slate-200">
            <MapPin className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm">તમારા ખાતામાં હાલમાં કોઈ સક્રિય જિલ્લો સોંપાયેલ નથી.</p>
            <p className="text-xs text-slate-500">કૃપા કરીને રાજ્ય વહીવટકર્તા (SUPER_ADMIN) નો સંપર્ક કરો.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {districts.map((d: any) => {
              const dId = d.id || d.district_id;
              const isCurrent = selectedDistrictId === dId;
              const nameGu = d.name_gu || d.name_en;
              const nameEn = d.name_en;

              return (
                <div
                  key={dId}
                  onClick={() => handleSelectDistrict(d)}
                  className={`cursor-pointer rounded-xl border p-5 transition-all shadow-xs hover:shadow-md flex flex-col justify-between bg-white ${
                    isCurrent
                      ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                      : 'border-slate-200 hover:border-emerald-400'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 font-bold">
                        <Building className="w-5 h-5 text-emerald-700" />
                      </div>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                        {d.code}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-slate-900 font-heading">
                        {nameGu}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">{nameEn} District</p>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      ડેશબોર્ડ ખોલો
                    </span>
                    <div className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-emerald-600 flex items-center justify-center text-slate-600 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
