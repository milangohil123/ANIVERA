import {
  LayoutDashboard,
  Database,
  Users,
  Megaphone,
  Tent,
  Package,
  Activity,
  MapPin,
  BarChart3,
  User,
  PawPrint,
  Syringe,
  QrCode,
  RefreshCw,
  Clock,
  Smartphone,
  History,
  Shield,
  Layers,
  UserCheck,
  Building2,
} from 'lucide-react';
import { STRINGS_GU } from './stringsGu';
import { type NavItemDef } from '../layouts/WebSidebarLayout';

const ICON_CLASS = "w-[18px] h-[18px] shrink-0";

export const DAHO_NAV_ITEMS: NavItemDef[] = [
  { path: '/daho/overview', get label() { return STRINGS_GU.nav.daho.overview; }, icon: <LayoutDashboard className={ICON_CLASS} /> },
  { path: '/daho/cooperatives', get label() { return STRINGS_GU.nav.daho.cooperatives; }, icon: <Building2 className={ICON_CLASS} /> },
  { path: '/daho/master-data', get label() { return STRINGS_GU.nav.daho.masterData; }, icon: <Database className={ICON_CLASS} /> },
  { path: '/daho/staff', get label() { return STRINGS_GU.nav.daho.staff; }, icon: <Users className={ICON_CLASS} /> },
  { path: '/daho/campaigns', get label() { return STRINGS_GU.nav.daho.campaigns; }, icon: <Megaphone className={ICON_CLASS} /> },
  { path: '/daho/camps', get label() { return STRINGS_GU.nav.daho.camps; }, icon: <Tent className={ICON_CLASS} /> },
  { path: '/daho/inventory', get label() { return STRINGS_GU.nav.daho.inventory; }, icon: <Package className={ICON_CLASS} /> },
  { path: '/daho/surveillance', get label() { return STRINGS_GU.nav.daho.surveillance; }, icon: <Activity className={ICON_CLASS} /> },
  { path: '/daho/maps', get label() { return STRINGS_GU.nav.daho.maps; }, icon: <MapPin className={ICON_CLASS} /> },
  { path: '/daho/reports', get label() { return STRINGS_GU.nav.daho.reports; }, icon: <BarChart3 className={ICON_CLASS} /> },
  { path: '/daho/profile', get label() { return STRINGS_GU.nav.daho.profile; }, icon: <User className={ICON_CLASS} /> },
];

export const TAHO_NAV_ITEMS: NavItemDef[] = [
  { path: '/taho/overview', label: 'તાલુકા વિહંગાવલોકન', icon: <LayoutDashboard className={ICON_CLASS} /> },
  { path: '/taho/maps', label: 'ગ્રામીણ GIS નકશો', icon: <MapPin className={ICON_CLASS} /> },
  { path: '/taho/staff', label: 'સ્ટાફ વહીવટ (VO/FW)', icon: <Users className={ICON_CLASS} /> },
  { path: '/taho/campaigns', label: 'રસીકરણ ઝુંબેશો', icon: <Megaphone className={ICON_CLASS} /> },
  { path: '/taho/vaccinations', label: 'રસીકરણ મોનિટરિંગ', icon: <Syringe className={ICON_CLASS} /> },
  { path: '/taho/animals', label: 'પશુધન રજીસ્ટર', icon: <PawPrint className={ICON_CLASS} /> },
  { path: '/taho/farmers', label: 'પશુપાલક ડિરેક્ટરી', icon: <Users className={ICON_CLASS} /> },
  { path: '/taho/surveillance', label: 'રોગ સર્વેલન્સ', icon: <Activity className={ICON_CLASS} /> },
  { path: '/taho/reports', label: 'રિપોર્ટ્સ અને પૃથ્થકરણ', icon: <BarChart3 className={ICON_CLASS} /> },
  { path: '/taho/profile', label: 'પ્રોફાઇલ', icon: <User className={ICON_CLASS} /> },
];

export const VO_NAV_ITEMS: NavItemDef[] = [
  { path: '/vo/overview', get label() { return STRINGS_GU.nav.vo.overview; }, icon: <LayoutDashboard className={ICON_CLASS} /> },
  { path: '/vo/villages', label: 'ગામ મોનિટરિંગ', icon: <MapPin className={ICON_CLASS} /> },
  { path: '/vo/staff', label: 'ક્ષેત્રીય સ્ટાફ સંચાલન', icon: <Users className={ICON_CLASS} /> },
  { path: '/vo/farmers', label: 'પશુપાલક ડિરેક્ટરી', icon: <Users className={ICON_CLASS} /> },
  { path: '/vo/animals', get label() { return STRINGS_GU.nav.vo.animals; }, icon: <PawPrint className={ICON_CLASS} /> },
  { path: '/vo/vaccinations', get label() { return STRINGS_GU.nav.vo.vaccinations; }, icon: <Syringe className={ICON_CLASS} /> },
  { path: '/vo/campaigns', get label() { return STRINGS_GU.nav.vo.campaigns; }, icon: <Megaphone className={ICON_CLASS} /> },
  { path: '/vo/camps', get label() { return STRINGS_GU.nav.vo.camps; }, icon: <Tent className={ICON_CLASS} /> },
  { path: '/vo/inventory', get label() { return STRINGS_GU.nav.vo.inventory; }, icon: <Package className={ICON_CLASS} /> },
  { path: '/vo/surveillance-reviews', get label() { return STRINGS_GU.nav.vo.surveillanceReviews; }, icon: <Activity className={ICON_CLASS} /> },
  { path: '/vo/maps', get label() { return STRINGS_GU.nav.vo.maps || 'GIS નકશો'; }, icon: <MapPin className={ICON_CLASS} /> },
  { path: '/vo/reports', get label() { return STRINGS_GU.nav.vo.reports; }, icon: <BarChart3 className={ICON_CLASS} /> },
  { path: '/vo/sync', get label() { return STRINGS_GU.nav.vo.sync; }, icon: <RefreshCw className={ICON_CLASS} /> },
  { path: '/vo/profile', get label() { return STRINGS_GU.nav.vo.profile; }, icon: <User className={ICON_CLASS} /> },
];

export const FW_NAV_ITEMS: NavItemDef[] = [
  { path: '/fw/home', get label() { return STRINGS_GU.nav.fw.home || 'હોમ'; }, icon: <LayoutDashboard className={ICON_CLASS} /> },
  { path: '/fw/villages', get label() { return STRINGS_GU.nav.fw.villages || 'સોંપાયેલ ગામો'; }, icon: <MapPin className={ICON_CLASS} /> },
  { path: '/fw/farmers', get label() { return STRINGS_GU.nav.fw.farmers || 'પશુપાલક યાદી'; }, icon: <Users className={ICON_CLASS} /> },
  { path: '/fw/animals', get label() { return STRINGS_GU.nav.fw.animals || 'પશુ નોંધણી'; }, icon: <PawPrint className={ICON_CLASS} /> },
  { path: '/fw/scan', get label() { return STRINGS_GU.nav.fw.scan || 'QR સ્કેન'; }, icon: <QrCode className={ICON_CLASS} /> },
  { path: '/fw/vaccinations', get label() { return STRINGS_GU.nav.fw.vaccinations || 'રસીકરણ નોંધણી'; }, icon: <Syringe className={ICON_CLASS} /> },
  { path: '/fw/reports/new', get label() { return STRINGS_GU.nav.fw.newReport || 'નવો રોગ અહેવાલ'; }, icon: <Activity className={ICON_CLASS} /> },
  { path: '/fw/pending', get label() { return STRINGS_GU.nav.fw.pending || 'બાકી કામગીરી'; }, icon: <Clock className={ICON_CLASS} /> },
  { path: '/fw/maps', get label() { return STRINGS_GU.nav.fw.maps || 'GIS નકશો'; }, icon: <MapPin className={ICON_CLASS} /> },
  { path: '/fw/reports', get label() { return STRINGS_GU.nav.fw.reports || 'કામગીરી અહેવાલો'; }, icon: <BarChart3 className={ICON_CLASS} /> },
  { path: '/fw/sync', get label() { return STRINGS_GU.nav.fw.sync || 'સિંક ડેટા'; }, icon: <RefreshCw className={ICON_CLASS} /> },
  { path: '/fw/profile', get label() { return STRINGS_GU.nav.fw.profile || 'પ્રોફાઇલ'; }, icon: <User className={ICON_CLASS} /> },
];

export const FARMER_NAV_ITEMS: NavItemDef[] = [
  { path: '/farmer/home', get label() { return STRINGS_GU.nav.farmer.home; }, icon: <LayoutDashboard className={ICON_CLASS} /> },
  { path: '/farmer/animals', get label() { return STRINGS_GU.nav.farmer.animals; }, icon: <PawPrint className={ICON_CLASS} /> },
  { path: '/farmer/profile', get label() { return STRINGS_GU.nav.farmer.profile; }, icon: <User className={ICON_CLASS} /> },
];

export const COOP_NAV_ITEMS: NavItemDef[] = [
  { path: '/coop/overview', get label() { return STRINGS_GU.nav.coop.overview || 'ડેરી ઝાંખી'; }, icon: <LayoutDashboard className={ICON_CLASS} /> },
  { path: '/coop/maps', get label() { return STRINGS_GU.nav.coop.maps || 'GIS નકશો'; }, icon: <MapPin className={ICON_CLASS} /> },
  { path: '/coop/farmers', get label() { return STRINGS_GU.nav.coop.farmers || 'સભાસદ પશુપાલકો'; }, icon: <Users className={ICON_CLASS} /> },
  { path: '/coop/animals', get label() { return STRINGS_GU.nav.coop.animals || 'સંલગ્ન પશુધન'; }, icon: <PawPrint className={ICON_CLASS} /> },
  { path: '/coop/vaccinations', get label() { return STRINGS_GU.nav.coop.vaccinations || 'રસીકરણ સ્થિતિ'; }, icon: <Syringe className={ICON_CLASS} /> },
  { path: '/coop/campaigns', get label() { return STRINGS_GU.nav.coop.campaigns || 'ઝુંબેશ મોનિટરિંગ'; }, icon: <Megaphone className={ICON_CLASS} /> },
  { path: '/coop/village-progress', get label() { return STRINGS_GU.nav.coop.villageProgress || 'ગામવાર પ્રગતિ'; }, icon: <Activity className={ICON_CLASS} /> },
  { path: '/coop/camps', get label() { return STRINGS_GU.nav.coop.camps || 'કેમ્પ સંકલન'; }, icon: <Tent className={ICON_CLASS} /> },
  { path: '/coop/surveillance', get label() { return STRINGS_GU.nav.coop.surveillance || 'રોગ દેખરેખ'; }, icon: <Activity className={ICON_CLASS} /> },
  { path: '/coop/reports', get label() { return STRINGS_GU.nav.coop.reports || 'અહેવાલો'; }, icon: <BarChart3 className={ICON_CLASS} /> },
  { path: '/coop/profile', get label() { return STRINGS_GU.nav.coop.profile || 'પ્રોફાઇલ'; }, icon: <User className={ICON_CLASS} /> },
];

export const ADMIN_NAV_ITEMS: NavItemDef[] = [
  { path: '/admin/overview', get label() { return STRINGS_GU.nav.admin.overview; }, icon: <LayoutDashboard className={ICON_CLASS} /> },
  { path: '/admin/map', get label() { return STRINGS_GU.nav.admin.map; }, icon: <MapPin className={ICON_CLASS} /> },
  { path: '/admin/geography', get label() { return STRINGS_GU.nav.admin.geography; }, icon: <Database className={ICON_CLASS} /> },
  { path: '/admin/daho', get label() { return STRINGS_GU.nav.admin.daho; }, icon: <Shield className={ICON_CLASS} /> },
  { path: '/admin/assignments', get label() { return STRINGS_GU.nav.admin.assignments; }, icon: <Layers className={ICON_CLASS} /> },
  { path: '/admin/oversight', get label() { return STRINGS_GU.nav.admin.oversight; }, icon: <BarChart3 className={ICON_CLASS} /> },
  { path: '/admin/roles', get label() { return STRINGS_GU.nav.admin.roles; }, icon: <UserCheck className={ICON_CLASS} /> },
  { path: '/admin/users', get label() { return STRINGS_GU.nav.admin.users; }, icon: <Users className={ICON_CLASS} /> },
  { path: '/admin/audit-logs', get label() { return STRINGS_GU.nav.admin.auditLogs; }, icon: <History className={ICON_CLASS} /> },
  { path: '/admin/system-health', get label() { return STRINGS_GU.nav.admin.systemHealth; }, icon: <Activity className={ICON_CLASS} /> },
  { path: '/admin/devices', get label() { return STRINGS_GU.nav.admin.devices; }, icon: <Smartphone className={ICON_CLASS} /> },
  { path: '/admin/profile', get label() { return STRINGS_GU.nav.admin.profile; }, icon: <User className={ICON_CLASS} /> },
];
