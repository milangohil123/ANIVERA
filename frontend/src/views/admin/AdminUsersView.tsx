import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { technicalService, type TechnicalUser } from '../../services/technicalService';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { StateView } from '../../components/common/StateView';
import { ArrowLeft, Search, Users } from 'lucide-react';

export const AdminUsersView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useAuth();

  const [users, setUsers] = useState<TechnicalUser[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await technicalService.listUsers(
        apiBaseUrl,
        roleFilter || undefined,
        statusFilter || undefined,
        searchTerm || undefined
      );
      setUsers(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [apiBaseUrl, roleFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const formatDate = (iso?: string | null): string => {
    if (!iso) return 'ક્યારેય નહીં';
    try {
      const d = new Date(iso);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-10 font-body">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/admin/overview')}
          leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
        >
          ડેશબોર્ડ
        </Button>
        <h2 className="text-sm font-bold text-[#1E293B] font-heading flex items-center gap-1.5">
          <Users className="w-4 h-4 text-[#135D43]" />
          વપરાશકર્તા એકાઉન્ટ ડિરેક્ટરી (Users Directory)
        </h2>
        <div className="w-12" />
      </div>

      {/* Filter and Search Bar */}
      <form onSubmit={handleSearchSubmit} className="bg-white p-3 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="નામ, યૂઝરનેમ અથવા મોબાઇલ..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E2E8F0] text-xs focus:ring-2 focus:ring-[#135D43]"
            />
          </div>

          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs bg-white text-[#1E293B] focus:ring-2 focus:ring-[#135D43]"
            >
              <option value="">-- બધી ભૂમિકાઓ (All Roles) --</option>
              <option value="SYS_ADMIN">SYS_ADMIN (System Admin)</option>
              <option value="DAHO">DAHO (District Animal Officer)</option>
              <option value="VET_OFFICER">VET_OFFICER (Veterinary Officer)</option>
              <option value="FIELD_WORKER">FIELD_WORKER (Field Worker)</option>
              <option value="DAIRY_STAFF">DAIRY_STAFF (Cooperative)</option>
              <option value="FARMER">FARMER (Livestock Owner)</option>
            </select>
          </div>

          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs bg-white text-[#1E293B] focus:ring-2 focus:ring-[#135D43]"
            >
              <option value="">-- બધી સ્થિતિ (All Status) --</option>
              <option value="ACTIVE">ACTIVE (સક્રિય)</option>
              <option value="LOCKED">LOCKED (લૉક)</option>
              <option value="SUSPENDED">SUSPENDED (મોકૂફ)</option>
            </select>
            <Button variant="primary" size="sm" type="submit">
              શોધો
            </Button>
          </div>
        </div>
      </form>

      {/* Users Table */}
      <Card
        header={
          <div className="flex items-center justify-between w-full">
            <h3 className="text-xs font-bold text-[#1E293B]">
              વપરાશકર્તા પરિણામો ({users.length})
            </h3>
            <span className="text-[11px] text-[#64748B]">ટેકનિકલ ઓળખ મેનેજમેન્ટ</span>
          </div>
        }
      >
        {isLoading ? (
          <StateView state="loading" title="લોડ થઈ રહ્યું છે…" />
        ) : errorMsg ? (
          <StateView state="error" message={errorMsg} onRetry={fetchUsers} />
        ) : users.length === 0 ? (
          <StateView
            state="empty"
            title="કોઈ માહિતી નથી"
            message="આ શોધ માપદંડ સાથે મેળ ખાતા કોઈ વપરાશકર્તા મળ્યા નથી."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8FAFB] text-[#64748B] border-b border-[#E2E8F0] uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">નામ / યૂઝરનેમ</th>
                  <th className="py-2.5 px-3">ભૂમિકા (Role)</th>
                  <th className="py-2.5 px-3">મોબાઇલ નંબર</th>
                  <th className="py-2.5 px-3">સ્થિતિ</th>
                  <th className="py-2.5 px-3">છેલ્લું લૉગિન</th>
                  <th className="py-2.5 px-3">નોંધણી તારીખ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-[#1E293B]">{u.full_name}</div>
                      <span className="text-[11px] text-[#64748B] font-mono">
                        {u.username || u.id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[#64748B]">
                      {u.mobile_e164 || '—'}
                    </td>
                    <td className="py-3 px-3">
                      <StatusChip
                        status={u.status === 'ACTIVE' ? 'SUCCESS' : 'DANGER'}
                        text={u.status === 'ACTIVE' ? 'સક્રિય' : 'લૉક (Locked)'}
                      />
                    </td>
                    <td className="py-3 px-3 text-[#64748B]">
                      {formatDate(u.last_login_at)}
                    </td>
                    <td className="py-3 px-3 text-[#64748B]">
                      {formatDate(u.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

