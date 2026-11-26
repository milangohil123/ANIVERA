import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Building, ChevronRight, ShieldCheck, Layers, Users, Home } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { Card } from '../../components/common/Card';

export const TahoTalukaSelectorView: React.FC = () => {
  const { session, profile, role, selectedTalukaId, setSelectedTalukaId, assignedTalukas, apiBaseUrl } = useAuth();
  const navigate = useNavigate();

  const [talukas, setTalukas] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // If not TAHO or super admin, redirect
    if (role !== 'TAHO' && role !== 'SYS_ADMIN') {
      navigate('/login');
      return;
    }

    const loadTalukas = async () => {
      try {
        setLoading(true);
        // Load assigned talukas from API
        const tList = await adminService.listTahoAssignedTalukas(apiBaseUrl);
        if (Array.isArray(tList) && tList.length > 0) {
          setTalukas(tList);
          // If only 1 taluka assigned, select it and go directly to dashboard
          if (tList.length === 1) {
            const singleId = tList[0].id || tList[0].taluka_id;
            if (singleId) {
              setSelectedTalukaId(singleId);
              navigate('/taho/overview');
            }
          }
          return;
        }
      } catch (err) {
        console.warn('Could not load assigned talukas from API, fallback to profile:', err);
      } finally {
        setLoading(false);
      }

      // Fallback to assignedTalukas from context
      if (assignedTalukas && assignedTalukas.length > 0) {
        setTalukas(assignedTalukas);
        if (assignedTalukas.length === 1) {
          const singleId = assignedTalukas[0].id || assignedTalukas[0].taluka_id;
          if (singleId) {
            setSelectedTalukaId(singleId);
            navigate('/taho/overview');
          }
        }
      }
    };

    loadTalukas();
  }, [role, apiBaseUrl, assignedTalukas, setSelectedTalukaId, navigate]);

  const handleSelectTaluka = (taluka: any) => {
    const id = taluka.id || taluka.taluka_id;
    if (id) {
      setSelectedTalukaId(id);
      navigate('/taho/overview');
    }
  };

  const officerName = profile?.full_name || session?.user?.fullName || 'તાલુકા પશુપાલન અધિકારી (TAHO)';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-body">
      <div className="max-w-3xl w-full mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>મલ્ટી-તાલુકા અધિકારક્ષેત્ર (Multi-Taluka Jurisdiction)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900">
            સ્વાગત છે, {officerName}
          </h1>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            તમારા ખાતામાં એક કરતાં વધુ તાલુકાઓ સોંપાયેલ છે. કૃપા કરીને તમે જે તાલુકામાં કામગીરી કરવા માંગો છો તે કાર્યક્ષેત્ર તાલુકો પસંદ કરો:
          </p>
        </div>

        {/* Taluka Selection Cards */}
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500 animate-pulse">
            નિયુક્ત તાલુકાઓની માહિતી લોડ થઈ રહી છે...
          </div>
        ) : talukas.length === 0 ? (
          <Card className="p-8 text-center text-slate-600 space-y-3 bg-white border border-slate-200">
            <MapPin className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-semibold">તમારા ખાતામાં હાલમાં કોઈ સક્રિય તાલુકો સોંપાયેલ નથી.</p>
            <p className="text-xs text-slate-500">કૃપા કરીને જિલ્લા પશુપાલન અધિકારી (DAHO) અથવા વહીવટકર્તાનો સંપર્ક કરો.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {talukas.map((t: any) => {
              const tId = t.id || t.taluka_id;
              const isCurrent = selectedTalukaId === tId;
              const nameGu = t.name_gu || t.name_en;
              const nameEn = t.name_en;
              const distName = t.district_name_gu || t.district_name_en || '';
              const villageCount = t.village_count;

              return (
                <div
                  key={tId}
                  onClick={() => handleSelectTaluka(t)}
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
                      <div className="flex items-center gap-1.5">
                        {isCurrent && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                            ચાલુ તાલુકો
                          </span>
                        )}
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                          {t.code}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-slate-900 font-heading">
                        {nameGu}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        {nameEn} Taluka {distName ? `• જિલ્લો: ${distName}` : ''}
                      </p>
                    </div>

                    {villageCount !== undefined && (
                      <div className="flex items-center gap-1 text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                        <Home className="w-3.5 h-3.5 text-slate-400" />
                        <span>કુલ ગામડાં: <strong className="text-slate-800">{villageCount}</strong></span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      આ તાલુકામાં કાર્ય શરૂ કરો
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
