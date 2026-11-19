import React from 'react';
import { Card } from '../../components/common/Card';
import { Bell, Info, ShieldCheck, AlertTriangle } from 'lucide-react';

export const DahoNotificationsView: React.FC = () => {
  const alerts = [
    {
      id: '1',
      title: 'સિસ્ટમ સ્થિરતા અને સિંક પ્રક્રિયા સક્રિય છે',
      time: 'આજે',
      type: 'info',
      desc: 'જિલ્લા પશુ ચિકિત્સા પોર્ટલ અને ઓફલાઇન ડેટા સિંક્રનાઇઝેશન સુરક્ષિત રીતે કાર્યરત છે.',
    },
    {
      id: '2',
      title: 'પાયલોટ પ્રોજેક્ટ બોટાદ વહીવટી સ્કોપ',
      time: 'સક્રિય',
      type: 'success',
      desc: 'તમામ માસ્ટર ડેટા અને સ્ટાફ સોંપણીઓ બોટાદ જિલ્લા સીમામાં સખત રીતે સુરક્ષિત છે.',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-[#E2E8F0]">
        <h2 className="text-xl font-bold text-[#1E293B] font-heading flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#135D43]" />
          વહીવટી સૂચનાઓ (Administrative Notifications)
        </h2>
        <p className="text-xs text-[#64748B] mt-1">
          જિલ્લા કક્ષાની અગત્યની સૂચનાઓ, આરોગ્ય ચેતવણીઓ અને સરકારી પરિપત્રો.
        </p>
      </div>

      <div className="space-y-3">
        {alerts.map((a) => (
          <Card key={a.id} className="p-4 flex items-start gap-3">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                a.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700'
                  : a.type === 'warning'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-blue-50 text-blue-700'
              }`}
            >
              {a.type === 'success' ? (
                <ShieldCheck className="w-5 h-5" />
              ) : a.type === 'warning' ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <Info className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm text-[#1E293B]">{a.title}</h4>
                <span className="text-xs text-[#94A3B8]">{a.time}</span>
              </div>
              <p className="text-xs text-[#64748B] mt-1">{a.desc}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

