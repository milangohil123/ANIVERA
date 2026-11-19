import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  WifiOff,
  Stethoscope,
  ArrowRight,
  LogIn,
  CheckCircle2,
  Laptop,
  Smartphone,
  MapPin,
  Syringe,
  Building2,
  Lock,
  Eye,
  Send,
  Check,
  RefreshCw,
  QrCode,
  Thermometer,
  Shield,
  Database,
  Award,
  Menu,
  X,
  Compass,
  RotateCw,
} from 'lucide-react';
import { useTranslation } from '../i18n';
import { LanguageSelector } from '../components/common/LanguageSelector';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Mobile navigation drawer toggle
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Hero section dual preview selector for small mobile devices
  const [heroDeviceView, setHeroDeviceView] = useState<'LAPTOP' | 'MOBILE'>('LAPTOP');

  // Interactive Platform Explorer device switcher
  const [deviceMode, setDeviceMode] = useState<'DESKTOP' | 'MOBILE'>('DESKTOP');
  const [desktopTab, setDesktopTab] = useState<number>(0);
  const [mobileTab, setMobileTab] = useState<number>(0);

  // Flip cards state for Government SOP guidelines
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});

  const toggleFlip = (cardKey: string) => {
    setFlippedCards((prev) => ({ ...prev, [cardKey]: !prev[cardKey] }));
  };

  // Contact form state
  const [contactForm, setContactForm] = useState({ name: '', email: '', role: 'FARMER', message: '' });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (contactForm.name && contactForm.message) {
      setIsSubmitted(true);
      setTimeout(() => {
        setIsSubmitted(false);
        setContactForm({ name: '', email: '', role: 'FARMER', message: '' });
      }, 4000);
    }
  };

  // --------------------------------------------------------------------------
  // Desktop How-To-Use Panel Definitions (Laptop Showcase)
  // --------------------------------------------------------------------------
  const desktopPanels = [
    {
      id: 'daho',
      title: 'DAHO વહીવટી ઝાંખી',
      role: 'જિલ્લા પશુપાલન અધિકારી',
      badge: 'DAHO_SCOPE',
      desc: 'સમગ્ર બોટાદ જિલ્લાના ૪ તાલુકા અને ૧૯૨ ગામોના રસીકરણ લક્ષ્યાંકો, સ્ટોક સંચાલન અને નીતિ વિષયક ઝુંબેશ મંજૂરી.',
      highlights: [
        'તાલુકાવાર લક્ષ્યાંક વિશ્લેષણ (બોટાદ, ગઢડા, બરવાળા, રાણપુર)',
        'રોગ સર્વેક્ષણ પૂર્વ ચેતવણી જોખમ નિરીક્ષણ (Early Warning Surveillance)',
        'નવી રસીકરણ ઝુંબેશ રચના અને મંજૂરી (campaign.create)',
        'વેટરનરી ઓફિસર અને ક્ષેત્રીય સ્ટાફ પ્રોવિઝનિંગ & ઓથોરાઇઝેશન',
      ],
      mockupData: {
        headerTitle: 'ANIVERA • જિલ્લા ઝાંખી (DAHO Administration)',
        kpis: [
          { label: 'કુલ તાલુકા', val: '4', sub: 'બોટાદ જિલ્લો' },
          { label: 'નોંધાયેલા ગામો', val: '192', sub: 'સત્તાવાર કાર્યક્ષેત્ર' },
          { label: 'કુલ પશુધન', val: '20,000+', sub: 'નોંધાયેલ હર્ડ' },
          { label: 'કવરેજ ટકાવારી', val: '83.1%', sub: 'લક્ષિત સિદ્ધિ' },
        ],
        statusText: 'જિલ્લા સ્તરીય સત્તા (campaign.create, district.admin) સક્રિય છે.',
      },
    },
    {
      id: 'vo',
      title: 'VO ક્લિનિકલ રોગ સમીક્ષા',
      role: 'વેટરનરી અધિકારી',
      badge: 'VO_SCOPE',
      desc: 'અધિકૃત ગામડાઓમાંથી મળેલા પશુ રોગ અહેવાલોની ચકાસણી, લેબ નિદાન, અંતિમ રોગ પુષ્ટિ અને પશુ આરોગ્ય કેમ્પનું આયોજન.',
      highlights: [
        'ક્લિનિકલ રોગ સમીક્ષા ઇનબોક્સ (FMD, HS, BQ શંકાસ્પદ કેસ)',
        'વિભાગીય રોગ પુષ્ટિ અથવા નકારવાની સત્તા (disease.confirm)',
        'પશુ આરોગ્ય કેમ્પ દરખાસ્તોની મંજૂરી અને તારીખ ફાળવણી',
        'સ્થાનિક રસી સ્ટોક સબ-ડેપો વિતરણ અને કોલ્ડ-ચેઈન ઓડિટ',
      ],
      mockupData: {
        headerTitle: 'ANIVERA • ક્લિનિકલ ઝાંખી (Veterinary Officer)',
        kpis: [
          { label: 'સોંપાયેલ ગામડાં', val: '3', sub: 'અધિકૃત કાર્યક્ષેત્ર' },
          { label: 'રોગ અહેવાલો', val: '5', sub: '3 સમીક્ષા બાકી' },
          { label: 'પુષ્ટિ થયેલ કેસ', val: '1', sub: 'FMD બરવાળા સીમ' },
          { label: 'રસીકરણ દર', val: '88.5%', sub: 'ચોમાસુ રસીકરણ' },
        ],
        statusText: 'ક્લિનિકલ રોગ પુષ્ટિ સત્તા (disease.confirm) સક્રિય છે.',
      },
    },
    {
      id: 'gis',
      title: 'GIS ભૌગોલિક ગૂગલ નકશો',
      role: 'જિલ્લા અને ક્લિનિકલ સ્ટાફ',
      badge: 'GIS_LAYER',
      desc: 'બોટાદ જિલ્લાનો વાસ્તવિક ગૂગલ મેપ જેમાં દરેક ગામ રસીકરણ ટકાવારી મુજબ રંગીન પિન સાથે લાઈવ દેખાય છે.',
      highlights: [
        '૧૦૦% વાસ્તવિક ગૂગલ રોડ મેપ અને સેટેલાઇટ હાઇબ્રિડ લેયર',
        'ગ્રીન (≥70%), પીળો (30-69%), લાલ (<30%) અને ગ્રે (0%) પિન્સ',
        'ટોચ પર સીધું જ ગૂગલ મેપ ખોલવા માટે Open in Maps બટન',
        'ગામ પર ક્લિક કરતાં પશુ સંખ્યા, રસીકરણ પ્રગતિ અને સર્ચ ફિલ્ટર',
      ],
      mockupData: {
        headerTitle: 'ANIVERA • કાર્યક્ષેત્ર ભૌગોલિક નકશો (Geospatial Map)',
        kpis: [
          { label: 'બોટાદ ગ્રામ', val: '84%', sub: 'લીલો પિન (સફળ)' },
          { label: 'ગઢડા ઉત્તર', val: '74%', sub: 'લીલો પિન (સફળ)' },
          { label: 'બરવાળા સીમ', val: '84%', sub: 'લીલો પિન (સફળ)' },
          { label: 'પાળિયાદ', val: '10%', sub: 'લાલ પિન (તાકીદ)' },
        ],
        statusText: 'રીઅલ-ટાઇમ જીઓસ્પેશિયલ બોટાદ મોનિટરિંગ સક્રિય.',
      },
    },
    {
      id: 'coop',
      title: 'દૂધ સહકારી મંડળી',
      role: 'ડેરી સ્ટાફ અને સહકારી સંઘ',
      badge: 'COOP_AGGREGATE',
      desc: 'દૂધ સપ્લાયર પરિવારોના પશુધનને રોગમુક્ત રાખવા માટે એકત્રિત કવરેજ ડેટા અને સામુદાયિક રસીકરણ કેમ્પનું આયોજન.',
      highlights: [
        'સહકારી મંડળીના જોડાયેલ ગામોની એકત્રિત પ્રગતિ (Aggregate Progress)',
        'દૂધ ઉત્પાદક ખેડૂત રસીકરણ વલણ ગ્રાફ',
        'સહકારી ડેરી સપ્લાય ચેઈન પશુ સુરક્ષા',
        'પશુપાલકની ગોપનીયતા જાળવીને ફક્ત ગ્રામ્ય સ્તરનો અહેવાલ',
      ],
      mockupData: {
        headerTitle: 'ANIVERA • દૂધ સહકારી મંડળી ડેશબોર્ડ',
        kpis: [
          { label: 'જોડાયેલ ગામો', val: '15', sub: 'સહકારી કાર્યક્ષેત્ર' },
          { label: 'સભ્ય પશુઓ', val: '4,850', sub: 'નોંધાયેલ દુધાળા પશુ' },
          { label: 'કુલ કવરેજ', val: '89.2%', sub: 'ડેરી રસીકરણ કવરેજ' },
          { label: 'આરોગ્ય કેમ્પ', val: '3', sub: 'આયોજિત કેમ્પ' },
        ],
        statusText: 'સહકારી ડેટા ગોપનીયતા નીતિ સક્રિય (Aggregate Only).',
      },
    },
    {
      id: 'admin',
      title: 'સિસ્ટમ એડમિન અને સુરક્ષા',
      role: 'તકનીકી વહીવટકર્તા',
      badge: 'SYS_ADMIN',
      desc: 'ઉપકરણ મંજૂરી (Device Provisioning), 7-દિવસીય ક્રિપ્ટોગ્રાફિક ગ્રાન્ટ્સ, અફર ઓડિટ લોગ અને સર્વર મોનિટરિંગ.',
      highlights: [
        'ક્ષેત્રીય સ્ટાફ મોબાઈલ ડિવાઇસ મંજૂરી અને કી વિતરણ',
        'અફર સરકારી ઓડિટ લોગ્સ (Immutable SHA-256 Audit)',
        'સિસ્ટમ હેલ્થ, CPU, મેમરી અને ડેટાબેઝ બેકઅપ',
        'ઓફલાઇન ડેટા કોન્ફ્લિક્ટ રીઝોલ્યુશન મોનિટરિંગ',
      ],
      mockupData: {
        headerTitle: 'ANIVERA • સિસ્ટમ એડમિનિસ્ટ્રેશન & સિક્યુરિટી',
        kpis: [
          { label: 'માન્ય ઉપકરણો', val: '28', sub: 'ચકાસાયેલ સ્માર્ટફોન' },
          { label: 'ઓડિટ ઇવેન્ટ્સ', val: '14,892', sub: 'અફર સુરક્ષિત લોગ' },
          { label: 'સિંક સફળતા', val: '99.98%', sub: 'Zero Data Loss' },
          { label: 'સર્વર સ્થિતિ', val: 'Healthy', sub: 'Latency < 24ms' },
        ],
        statusText: 'Zero-Trust સુરક્ષા મોડેલ સક્રિય.',
      },
    },
  ];

  // --------------------------------------------------------------------------
  // Mobile Workflows Definitions (Phone Mockup Showcase)
  // --------------------------------------------------------------------------
  const mobileWorkflows = [
    {
      id: 'scan',
      title: '૧. QR સ્કેન & પશુ ટેગિંગ',
      role: 'Field Worker (FW)',
      desc: 'પશુના કાન પર લાગેલા ૧૨-અંકના Barcode/QR કોડને મોબાઈલ કેમેરાથી તુરંત સ્કેન કરીને પશુની ઓળખ મેળવો.',
      screenHeader: 'પશુ QR ટેગ સ્કેનર',
      screenBody: (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-center shadow-xs">
            <div className="w-14 h-14 mx-auto rounded-xl border-2 border-dashed border-[#135D43] flex items-center justify-center bg-emerald-50">
              <QrCode className="w-7 h-7 text-[#135D43]" />
            </div>
            <p className="text-xs font-mono text-[#135D43] mt-2 font-bold tracking-wider">9001 8274 6190</p>
            <p className="text-[11px] text-slate-500 font-medium">ટેગ સફળતાપૂર્વક ચકાસાયેલ છે</p>
          </div>
          <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1.5 shadow-xs">
            <div className="flex justify-between text-slate-600">
              <span>પશુપાલક:</span>
              <span className="font-semibold text-slate-900">રમેશભાઈ ડાભી</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>ગામ:</span>
              <span className="font-semibold text-slate-900">બોટાદ ગ્રામ</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>પ્રજાતિ:</span>
              <span className="font-bold text-[#135D43]">ગીર ગાય • માદા</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'vaccinate',
      title: '૨. ઘેર-ઘેર ઓફલાઇન રસીકરણ',
      role: 'Field Worker (FW)',
      desc: 'ઇન્ટરનેટ ન હોય તો પણ ઘેર-ઘેર જઈને રસીનો પ્રકાર, વાયલ બેચ નંબર અને ડોઝ તુરંત સેવ કરો.',
      screenHeader: 'રસીકરણ એન્ટ્રી (ઓફલાઇન સક્ષમ)',
      screenBody: (
        <div className="space-y-2.5">
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs shadow-xs">
            <div className="flex items-center gap-2 text-[#135D43] font-bold">
              <Syringe className="w-4 h-4" />
              <span>FMD (ખરવા-મોવાસા) રસી</span>
            </div>
            <p className="text-[11px] text-emerald-800 mt-1">બેચ: FMD-2026-B08 • મુદત: 2027</p>
          </div>
          <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1 text-xs shadow-xs">
            <span className="text-[11px] text-slate-500">કોલ્ડ-ચેઈન ચકાસણી:</span>
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-slate-600">તાપમાન:</span>
              <span className="text-[#135D43] font-bold">4.2°C (માન્ય 2-8°C)</span>
            </div>
          </div>
          <button className="w-full py-2.5 bg-[#135D43] text-white rounded-lg text-xs font-semibold hover:bg-[#0F4C37] transition-all shadow-xs flex items-center justify-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>રસીકરણ રેકોર્ડ સેવ કરો</span>
          </button>
        </div>
      ),
    },
    {
      id: 'report',
      title: '૩. તાત્કાલિક રોગ અહેવાલ',
      role: 'Field Worker / Farmer',
      desc: 'પશુમાં રોગના લક્ષણ દેખાય તો તરત જ ફોટો પાડી GPS લોકેશન સાથે VO સમીક્ષા માટે અહેવાલ મોકલો.',
      screenHeader: 'શંકાસ્પદ રોગ પ્રાથમિક રિપોર્ટ',
      screenBody: (
        <div className="space-y-2.5 text-xs">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 shadow-xs">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">લક્ષણો:</span>
            <p className="text-xs font-medium text-amber-900 mt-0.5">મોઢામાં ફોલ્લા, વધુ પડતી લાળ, લંગડાપણું</p>
          </div>
          <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs shadow-xs">
            <span className="text-slate-500">GPS લોકેશન:</span>
            <span className="font-mono font-medium text-slate-800">22.1850° N, 71.6850° E</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-[10px] text-slate-600">
            ફોટો SHA-256 હેશિંગ સાથે જોડાશે
          </div>
          <button className="w-full py-2.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-all shadow-xs flex items-center justify-center gap-1.5">
            <span>વેટરનરી ઓફિસરને મોકલો</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
    {
      id: 'sync',
      title: '૪. બેકગ્રાઉન્ડ ઓટો-સિંક',
      role: 'System PWA Background',
      desc: 'નેટવર્ક આવે ત્યારે એક પણ ક્લિક કર્યા વિના તમામ રેકોર્ડ્સ સરકારી સર્વર સાથે ઓટો-સિંક થાય છે.',
      screenHeader: 'ઓફલાઇન ડેટા સિંક્રનાઇઝેશન',
      screenBody: (
        <div className="space-y-3 text-center py-2">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#135D43] border border-emerald-200 flex items-center justify-center mx-auto shadow-xs">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-slate-900">ઓટોમેટિક સિંક ચાલુ છે</h5>
            <p className="text-[11px] text-slate-500 mt-0.5">8 ઇવેન્ટ્સ • 2 ફોટોગ્રાફ્સ અપલોડ થઈ રહ્યાં છે</p>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div className="bg-[#135D43] h-1.5 rounded-full" style={{ width: '85%' }} />
          </div>
          <span className="text-[11px] font-mono text-[#135D43] block font-bold">Zero Data Loss Guaranteed</span>
        </div>
      ),
    },
    {
      id: 'farmer',
      title: '૫. ખેડૂત ડિજિટલ પાસબુક',
      role: 'Farmer / પશુપાલક',
      desc: 'પશુપાલક પોતાના મોબાઈલ નંબર વડે OTP લૉગિન કરીને પોતાના તમામ પશુઓની ડિજિટલ રસીકરણ પાસબુક જોઈ શકે છે.',
      screenHeader: 'મારી પશુધન હેલ્થ પાસબુક',
      screenBody: (
        <div className="space-y-2 text-xs">
          <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1 shadow-xs">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-900">ગાય (કાન ટેગ #6190)</span>
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200">
                સુરક્ષિત
              </span>
            </div>
            <p className="text-[11px] text-slate-500">છેલ્લી રસી: FMD બૂસ્ટર (૧૪ ફેબ્રુઆરી)</p>
          </div>
          <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1 shadow-xs">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-900">ભેંસ (કાન ટેગ #5520)</span>
              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-200">
                આગામી રસી બાકી
              </span>
            </div>
            <p className="text-[11px] text-slate-500">HS રસીકરણ કેમ્પ: ૨૫ માર્ચ (ગામ શાળા)</p>
          </div>
          <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-center text-[10px] text-[#135D43] font-medium">
            સરકારી સહાય અને દૂધ મંડળી બોનસ માટે માન્ય પાસબુક
          </div>
        </div>
      ),
    },
  ];

  // --------------------------------------------------------------------------
  // Government SOP Role Guides (Flip Cards)
  // --------------------------------------------------------------------------
  const govFlipCards = [
    {
      key: 'daho_sop',
      roleTitle: 'DAHO — જિલ્લા પશુપાલન અધિકારી',
      dept: 'જિલ્લા પંચાયત, બોટાદ',
      icon: <Award className="w-5 h-5 text-[#135D43]" />,
      frontBadge: 'સર્વોચ્ચ જિલ્લા વહીવટકર્તા',
      frontSummary: 'જિલ્લા સ્તરે તમામ ૪ તાલુકાઓના રસીકરણ લક્ષ્યાંકો નક્કી કરવા, નવી ઝુંબેશ શરૂ કરવી અને રસી સ્ટોકનું નિરીક્ષણ કરવું.',
      backTitle: 'DAHO સત્તાવાર SOP પ્રોટોકોલ:',
      backPoints: [
        '૧. નવી રસીકરણ ઝુંબેશ રચના અને મંજૂરી (campaign.create)',
        '૨. તાલુકાવાર રસી બેચ સ્ટોક અને કોલ્ડ-ચેઈન લોજિસ્ટિક્સ મંજૂરી',
        '૩. રોગચાળાની સ્થિતિમાં કટોકટી જાહેર કરવી અને ક્વોરેન્ટાઇન સીમા નક્કી કરવી',
        '૪. સમગ્ર સ્ટાફ (VO અને FW) નું પ્રોવિઝનિંગ અને મોનિટરિંગ',
      ],
      authorityTag: 'STATUTORY_AUTHORITY: DISTRICT_ADMIN',
    },
    {
      key: 'vo_sop',
      roleTitle: 'VO — વેટરનરી અધિકારી',
      dept: 'પશુ દવાખાનું / પ્રાથમિક આરોગ્ય કેન્દ્ર',
      icon: <Stethoscope className="w-5 h-5 text-[#135D43]" />,
      frontBadge: 'ક્લિનિકલ નિર્ણય સત્તા',
      frontSummary: 'ગામડાંઓમાંથી આવતા શંકાસ્પદ કેસની લેબ ચકાસણી, રોગ પુષ્ટિ / નકાર અને સામૂહિક પશુ આરોગ્ય કેમ્પનું સંચાલન.',
      backTitle: 'VO સત્તાવાર SOP પ્રોટોકોલ:',
      backPoints: [
        '૧. રોગ અહેવાલની સત્તાવાર પુષ્ટિ અથવા નકાર (disease.confirm)',
        '૨. પશુ આરોગ્ય કેમ્પનું આયોજન અને સ્ટાફ ડ્યુટી ફાળવણી (camp.create)',
        '૩. સબ-સેન્ટર રસી સ્ટોકની ચકાસણી અને કોલ્ડ-ચેઈન (2-8°C) ઓડિટ',
        '૪. ક્ષેત્રીય સ્ટાફની સારવાર અને રસીકરણ કામગીરીની ટેકનિકલ ચકાસણી',
      ],
      authorityTag: 'CLINICAL_AUTHORITY: DISEASE_CONFIRM',
    },
    {
      key: 'fw_sop',
      roleTitle: 'Field Worker — ક્ષેત્રીય કાર્યકર',
      dept: 'ઘેર-ઘેર રસીકરણ અને સર્વેક્ષણ ટીમ',
      icon: <Syringe className="w-5 h-5 text-[#135D43]" />,
      frontBadge: 'ગ્રાઉન્ડ લેવલ એક્ઝિક્યુશન',
      frontSummary: 'ગામડાંઓમાં ઘેર-ઘેર જઈ પશુઓની QR ટેગિંગ નોંધણી, રસીકરણ ડોઝ આપવો અને શંકાસ્પદ રોગના લક્ષણો નોંધવા.',
      backTitle: 'FW સત્તાવાર SOP પ્રોટોકોલ:',
      backPoints: [
        '૧. ૧૨-અંકના QR બારકોડ વડે પશુ અને પશુપાલકની નોંધણી (animal.register)',
        '૨. કોલ્ડ-બોક્સમાંથી રસી લઈ ઘેર-ઘેર ડોઝ આપવો (vaccination.record)',
        '૩. રોગચાળાના લક્ષણો જણાતાં તુરંત ફોટો સાથે અહેવાલ મોકલવો',
        '૪. નેટવર્ક આવતાં તમામ ઓફલાઇન રેકોર્ડ્સ ઓટો-સિંક કરવા',
      ],
      authorityTag: 'FIELD_AUTHORITY: VACCINATION_RECORD',
    },
    {
      key: 'coop_sop',
      roleTitle: 'દૂધ સહકારી & પશુપાલક',
      dept: 'દૂધ ઉત્પાદક સહકારી મંડળી / ખેડૂત પરિવાર',
      icon: <Building2 className="w-5 h-5 text-[#135D43]" />,
      frontBadge: 'સહકારી સંકલન & પશુ રક્ષણ',
      frontSummary: 'દૂધ સપ્લાય કરતા ખેડૂતોના પશુધનનું રસીકરણ કવરેજ સુનિશ્ચિત કરવું જેથી દૂધ ઉત્પાદનમાં ઘટાડો ન થાય.',
      backTitle: 'સહકારી મંડળી SOP પ્રોટોકોલ:',
      backPoints: [
        '૧. મંડળી હેઠળના તમામ સભ્ય પશુપાલકોનું રસીકરણ કવરેજ મોનિટરિંગ',
        '૨. ગામમાં પશુ આરોગ્ય કેમ્પ માટે સ્થળ અને વ્યવસ્થાનું આયોજન',
        '૩. ખેડૂતને આગામી રસીકરણ તારીખ અંગે માહિતગાર કરવા',
        '૪. ગોપનીયતા જાળવીને ફક્ત એકત્રિત (Aggregate) આંકડા ચકાસવા',
      ],
      authorityTag: 'COOP_AUTHORITY: AGGREGATE_REVIEW',
    },
  ];

  const currentDesktop = desktopPanels[desktopTab];
  const currentMobile = mobileWorkflows[mobileTab];

  return (
    <div className="min-h-screen bg-white text-slate-800 font-body selection:bg-[#135D43] selection:text-white">
      {/* ==================================================================== */}
      {/* 1. TOP STICKY NAVBAR (Luxurious Chocolate Black Theme #171210)       */}
      {/* ==================================================================== */}
      <header className="sticky top-0 z-50 bg-[#171210] border-b border-[#2C211D] shadow-md transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo & State Tag */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2D211C] to-[#140F0D] border border-[#44332B] text-emerald-400 flex items-center justify-center font-bold text-sm tracking-tight shadow-sm shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold text-white font-heading tracking-tight">
                  ANIVERA
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2C211D] text-emerald-300 border border-[#44332B]">
                  બોટાદ પાઇલટ
                </span>
              </div>
              <span className="text-[10px] text-[#A89A92] hidden md:block">
                પશુપાલન વિભાગ, ગુજરાત સરકાર
              </span>
            </div>
          </div>

          {/* Center Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-semibold text-[#D5CBC5]">
            <a href="#how-to-use" className="hover:text-white transition-colors duration-150">
              ઉપયોગ પદ્ધતિ (How To Use)
            </a>
            <a href="#features" className="hover:text-white transition-colors duration-150">
              મુખ્ય સુવિધાઓ
            </a>
            <a href="#security" className="hover:text-white transition-colors duration-150">
              સુરક્ષા & SOP
            </a>
            <a href="#analytics" className="hover:text-white transition-colors duration-150">
              લાઇવ એનાલિટિક્સ
            </a>
            <a href="#contact" className="hover:text-white transition-colors duration-150">
              સંપર્ક
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <LanguageSelector variant="dark" />

            <button
              onClick={() => navigate('/farmer/login')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-200 bg-[#261E1A] hover:bg-[#342924] border border-[#3E302A] rounded-lg transition-all shadow-xs cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-300" />
              <span>{t('auth.farmerTab')}</span>
            </button>

            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#135D43] hover:bg-[#0E4A35] rounded-lg transition-all shadow-xs cursor-pointer border border-emerald-600/40"
            >
              <LogIn className="w-3.5 h-3.5 text-emerald-200" />
              <span>{t('auth.staffTab')}</span>
            </button>

            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="lg:hidden p-2 rounded-lg text-[#D5CBC5] hover:text-white hover:bg-[#261E1A] border border-[#3E302A] transition-colors"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-[#1C1613] border-t border-[#2C211D] px-4 pt-3 pb-5 space-y-3 shadow-xl animate-fade-in text-xs font-medium">
            <div className="flex flex-col space-y-2 text-[#D5CBC5]">
              <a
                href="#how-to-use"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-[#261E1A] hover:text-white transition-colors"
              >
                ઉપયોગ પદ્ધતિ (How To Use)
              </a>
              <a
                href="#features"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-[#261E1A] hover:text-white transition-colors"
              >
                મુખ્ય સુવિધાઓ
              </a>
              <a
                href="#security"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-[#261E1A] hover:text-white transition-colors"
              >
                સુરક્ષા & SOP
              </a>
              <a
                href="#analytics"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-[#261E1A] hover:text-white transition-colors"
              >
                લાઇવ એનાલિટિક્સ
              </a>
              <a
                href="#contact"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-[#261E1A] hover:text-white transition-colors"
              >
                સંપર્ક કાર્યાલય
              </a>
            </div>

            <div className="pt-3 border-t border-[#2C211D] grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigate('/farmer/login');
                }}
                className="w-full py-2.5 px-3 rounded-lg bg-[#261E1A] text-amber-200 border border-[#3E302A] font-semibold text-center flex items-center justify-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5 text-amber-300" />
                <span>ખેડૂત લૉગિન</span>
              </button>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigate('/login');
                }}
                className="w-full py-2.5 px-3 rounded-lg bg-[#135D43] text-white font-semibold text-center flex items-center justify-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>સ્ટાફ લૉગિન</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ==================================================================== */}
      {/* 2. HERO SECTION — PURE WHITE BACKDROP & DUAL HARDWARE SHOWCASE       */}
      {/* ==================================================================== */}
      <section className="relative pt-10 pb-16 sm:pt-16 sm:pb-24 bg-white border-b border-slate-200 overflow-hidden">
        {/* Subtle grid accent background */}
        <div className="absolute inset-0 bg-[radial-gradient(#E2E8F0_1px,transparent_1px)] [background-size:24px_24px] opacity-60 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 relative z-10">
          {/* Micro-Pill Tag */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-xs font-semibold shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#135D43]" />
            <span>ગુજરાત પશુપાલન વિભાગ • બોટાદ પાઇલટ પ્રોજેક્ટ</span>
          </div>

          {/* Minimal, High-Contrast Headline — ZERO EMOJIS */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-[#0F172A] font-heading tracking-tight leading-[1.18] max-w-4xl mx-auto">
            ટ્રેક કરો. રક્ષણ આપો. સશક્ત બનાવો.
            <span className="block mt-2 text-[#135D43]">
              ANIVERA — અદ્યતન ડિજિટલ પશુ સ્વાસ્થ્ય પ્રણાલી
            </span>
          </h1>

          {/* Minimal Subtitle */}
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
            બોટાદ જિલ્લાના ૪ તાલુકા અને ૧૯૨ ગામો માટે અત્યાધુનિક પશુ રસીકરણ ટ્રેકિંગ, ક્ષેત્ર આધારિત રોગ દેખરેખ અને સંપૂર્ણ
            ઓફલાઇન-ફર્સ્ટ ડિજિટલ પશુ સ્વાસ્થ્ય વ્યવસ્થાપન પ્રણાલી.
          </p>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#135D43] text-white text-xs sm:text-sm font-semibold hover:bg-[#0F4C37] transition-all shadow-xs cursor-pointer"
            >
              <span>સિસ્ટમ પ્રવેશ કરો</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href="#how-to-use"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-all shadow-xs"
            >
              <Laptop className="w-4 h-4 text-[#135D43]" />
              <span>કેવી રીતે ઉપયોગ કરવો?</span>
            </a>

            <button
              onClick={() => navigate('/farmer/login')}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-emerald-50 text-[#135D43] border border-emerald-200 text-xs sm:text-sm font-semibold hover:bg-emerald-100 transition-all shadow-xs cursor-pointer"
            >
              <Smartphone className="w-4 h-4 text-[#135D43]" />
              <span>પશુપાલક OTP પ્રવેશ</span>
            </button>
          </div>

          {/* Key Assurance Indicators */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-600 font-medium">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#135D43]" />
              <span>૧૦૦% ઓફલાઇન સક્ષમ (PWA)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#135D43]" />
              <span>રીઅલ-ટાઇમ GIS ગૂગલ નકશો</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#135D43]" />
              <span>અફર સરકારી ઓડિટ લોગ</span>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* DUAL HARDWARE MOCKUP PRESENTATION (LAPTOP + MOBILE PROPERLY)      */}
          {/* Responsive side-by-side on desktop, toggleable or stacked mobile   */}
          {/* ---------------------------------------------------------------- */}
          <div className="pt-8 max-w-6xl mx-auto">
            {/* Small screen device switcher (visible only on mobile) */}
            <div className="flex sm:hidden items-center justify-center mb-4">
              <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setHeroDeviceView('LAPTOP')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    heroDeviceView === 'LAPTOP'
                      ? 'bg-[#135D43] text-white shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  <Laptop className="w-3.5 h-3.5" />
                  <span>ડેસ્કટોપ ડેશબોર્ડ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHeroDeviceView('MOBILE')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    heroDeviceView === 'MOBILE'
                      ? 'bg-[#135D43] text-white shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>મોબાઇલ એપ્લિકેશન</span>
                </button>
              </div>
            </div>

            {/* Desktop & Tablet: Dual Composition; Mobile: Responsive Active View */}
            <div className="relative flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-8">
              {/* 1. LAPTOP MOCKUP (DAHO / VO Overview) */}
              <div
                className={`w-full lg:max-w-3xl transition-all duration-300 ${
                  heroDeviceView === 'MOBILE' ? 'hidden sm:block' : 'block'
                }`}
              >
                <div className="w-full shadow-2xl rounded-t-2xl border border-slate-300 bg-slate-900 p-2 sm:p-2.5 pb-0 text-left">
                  {/* Screen Bezel */}
                  <div className="rounded-t-xl overflow-hidden bg-white border border-slate-300 shadow-inner">
                    {/* macOS Window Top Bar */}
                    <div className="h-9 bg-slate-100 border-b border-slate-200 px-3.5 flex items-center justify-between text-slate-600 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
                        <span className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
                        <span className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
                      </div>
                      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-3 py-1 text-[11px] text-slate-600 font-mono shadow-xs max-w-xs sm:max-w-sm w-full mx-2 justify-center truncate">
                        <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span className="truncate">anivera.gujarat.gov.in/botad/overview</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#135D43] font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="hidden sm:inline">LIVE • બોટાદ પાઇલટ</span>
                      </div>
                    </div>

                    {/* Live Pilot Data Content in Clean White/Light Theme */}
                    <div className="p-4 sm:p-6 text-slate-900 bg-slate-50/50 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                        <div>
                          <h4 className="text-sm sm:text-base font-bold text-slate-900 font-heading">
                            ANIVERA — બોટાદ જિલ્લો લાઇવ પશુ સ્વાસ્થ્ય ઝાંખી
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            ૪ તાલુકા • ૧૯૨ ગામો • રસીકરણ પ્રગતિ મોનિટરિંગ
                          </p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#135D43] border border-emerald-200">
                          83.1% પૂર્ણ
                        </span>
                      </div>

                      {/* 4 Mini KPIs Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                          <span className="text-[11px] text-slate-500 font-medium block">સોંપાયેલ પશુધન</span>
                          <span className="text-lg sm:text-xl font-bold text-slate-900 font-heading block mt-0.5">3,480</span>
                          <span className="text-[10px] sm:text-[11px] text-slate-600 block mt-0.5 font-medium">3 ગામ • બોટાદ</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                          <span className="text-[11px] text-slate-500 font-medium block">રસીકરણ ડોઝ</span>
                          <span className="text-lg sm:text-xl font-bold text-[#135D43] font-heading block mt-0.5">2,892</span>
                          <span className="text-[10px] sm:text-[11px] text-slate-600 block mt-0.5 font-medium">83.1% સિદ્ધિ</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                          <span className="text-[11px] text-slate-500 font-medium block">બાકી / મુદત</span>
                          <span className="text-lg sm:text-xl font-bold text-amber-600 font-heading block mt-0.5">248</span>
                          <span className="text-[10px] sm:text-[11px] text-amber-700 block mt-0.5 font-medium">18 તાત્કાલિક</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                          <span className="text-[11px] text-slate-500 font-medium block">રોગ સર્વેક્ષણ</span>
                          <span className="text-lg sm:text-xl font-bold text-slate-900 font-heading block mt-0.5">3</span>
                          <span className="text-[10px] sm:text-[11px] text-slate-600 block mt-0.5 font-medium">VO સમીક્ષા</span>
                        </div>
                      </div>

                      {/* Village Distribution Mini Bars */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2 text-xs">
                        <div className="flex justify-between items-center text-slate-700 font-semibold text-[11px]">
                          <span>ગામવાર રસીકરણ કવરેજ દર:</span>
                          <span className="text-[#135D43]">સરેરાશ 83.1%</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                          <div className="space-y-1">
                            <div className="flex justify-between text-slate-600">
                              <span>બોટાદ ગ્રામ</span>
                              <span className="font-bold text-[#135D43]">84%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-[#135D43] h-1.5 rounded-full" style={{ width: '84%' }} />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-slate-600">
                              <span>ગઢડા ઉત્તર</span>
                              <span className="font-bold text-blue-600">74%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: '74%' }} />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-slate-600">
                              <span>બરવાળા સીમ</span>
                              <span className="font-bold text-[#135D43]">84%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-[#135D43] h-1.5 rounded-full" style={{ width: '84%' }} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bottom ticker bar */}
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="truncate">તાજેતરનું રસીકરણ: <strong className="text-slate-800">ANM-BOT-000891 (FMD ડોઝ)</strong></span>
                        </div>
                        <span className="font-mono text-[#135D43] font-semibold hidden sm:inline">ઓટો-સિંક: 100% સક્રિય</span>
                      </div>
                    </div>
                  </div>

                  {/* Laptop Aluminum Base / Chin */}
                  <div className="h-5 sm:h-6 bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 rounded-b-xl border-t border-slate-300/80 flex items-center justify-center shadow-md relative">
                    <div className="w-16 sm:w-24 h-1.5 bg-slate-500/40 rounded-full" />
                  </div>
                </div>
              </div>

              {/* 2. SMARTPHONE MOCKUP (Field Worker Mobile App) */}
              <div
                className={`w-full max-w-[280px] sm:max-w-[310px] shrink-0 transition-all duration-300 text-left ${
                  heroDeviceView === 'LAPTOP' ? 'hidden sm:block' : 'block'
                }`}
              >
                <div className="rounded-[44px] bg-slate-900 p-3 shadow-2xl border-[4px] border-slate-700 relative">
                  {/* Hardware buttons */}
                  <div className="absolute -left-[6px] top-20 w-[3px] h-8 bg-slate-600 rounded-l" />
                  <div className="absolute -left-[6px] top-30 w-[3px] h-8 bg-slate-600 rounded-l" />
                  <div className="absolute -right-[6px] top-24 w-[3px] h-11 bg-slate-600 rounded-r" />

                  {/* Phone Screen Display */}
                  <div className="bg-slate-50 rounded-[36px] p-3 text-slate-900 min-h-[440px] flex flex-col justify-between overflow-hidden border border-slate-200 relative shadow-inner">
                    <div className="space-y-2.5">
                      {/* Dynamic Island Header */}
                      <div className="w-24 h-4.5 bg-black rounded-full mx-auto mb-2 flex items-center justify-between px-2 text-[8px] text-white">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span className="font-mono text-[9px] text-white">09:41</span>
                        <span className="text-[7px]">5G 98%</span>
                      </div>

                      {/* Screen Header Badge */}
                      <div className="py-1.5 border-b border-slate-200 flex items-center justify-between">
                        <div>
                          <h5 className="text-xs font-bold text-slate-900 font-heading">ક્ષેત્રીય રસીકરણ PWA</h5>
                          <p className="text-[10px] text-slate-500">બોટાદ ગ્રામ • FW પોર્ટલ</p>
                        </div>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-[#135D43] border border-emerald-200">
                          ઓફલાઇન સક્રિય
                        </span>
                      </div>

                      {/* Barcode / Animal Card Preview */}
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-[#135D43] flex items-center justify-center shrink-0 border border-emerald-100">
                            <QrCode className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">પશુ ટેગ નંબર (RFID/QR)</span>
                            <span className="font-mono font-bold text-xs text-[#135D43]">9001 8274 6190</span>
                          </div>
                        </div>
                        <div className="pt-1.5 border-t border-slate-100 text-[11px] flex justify-between text-slate-700">
                          <span>માલિક: રમેશભાઈ</span>
                          <span className="font-semibold text-emerald-800">ગીર ગાય (માદા)</span>
                        </div>
                      </div>

                      {/* Vaccine Batch Entry Preview */}
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-1 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#135D43] flex items-center gap-1 text-[11px]">
                            <Syringe className="w-3.5 h-3.5" />
                            FMD રસીકરણ ડોઝ
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white text-emerald-800 border border-emerald-200 font-bold">
                            4.2°C Cold
                          </span>
                        </div>
                        <p className="text-[10px] text-emerald-900 font-mono">બેચ: FMD-2026-B08 • સમાપ્તિ: 2027</p>
                      </div>

                      {/* Action CTA */}
                      <button className="w-full py-2 bg-[#135D43] text-white rounded-lg text-xs font-bold shadow-xs flex items-center justify-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        <span>રસીકરણ સાચવો (1-Click)</span>
                      </button>
                    </div>

                    {/* Bottom Virtual Home Indicator */}
                    <div className="pt-2 text-center">
                      <div className="w-24 h-1 bg-slate-300 rounded-full mx-auto" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 3. SECTION 3 — HIGHLIGHT FEATURE: HOW TO USE (LAPTOP vs MOBILE)      */}
      {/* ==================================================================== */}
      <section id="how-to-use" className="py-16 sm:py-24 bg-slate-50 border-b border-slate-200 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#135D43] block font-mono">
              INTERACTIVE PLATFORM EXPLORER
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 font-heading tracking-tight">
              ANIVERA કેવી રીતે કાર્ય કરે છે?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              ડેસ્કટોપ (Laptop) પર વહીવટી અને ક્લિનિકલ પેનલ્સ તથા સ્માર્ટફોન (Mobile) પર ક્ષેત્રીય કામગીરી
              કેવી રીતે થાય છે તે નીચે હાર્ડવેર ફ્રેમ દ્વારા સમજો:
            </p>
          </div>

          {/* Device Toggle Buttons (Laptop vs Mobile) — ZERO EMOJIS */}
          <div className="flex items-center justify-center">
            <div className="inline-flex bg-slate-200/80 p-1 rounded-xl shadow-inner border border-slate-300/60">
              <button
                type="button"
                onClick={() => setDeviceMode('DESKTOP')}
                className={`flex items-center gap-2 px-4 sm:px-6 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 ${
                  deviceMode === 'DESKTOP'
                    ? 'bg-[#135D43] text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Laptop className="w-4 h-4" />
                <span>Laptop Desktop (વહીવટી અને ક્લિનિકલ પેનલ્સ)</span>
              </button>

              <button
                type="button"
                onClick={() => setDeviceMode('MOBILE')}
                className={`flex items-center gap-2 px-4 sm:px-6 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 ${
                  deviceMode === 'MOBILE'
                    ? 'bg-[#135D43] text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Mobile Phone (ક્ષેત્રીય સ્ટાફ & ખેડૂત મોબાઇલ)</span>
              </button>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* OPTION A: LAPTOP DESKTOP SHOWCASE (5 Core Panels)                */}
          {/* ---------------------------------------------------------------- */}
          {deviceMode === 'DESKTOP' && (
            <div className="space-y-6">
              {/* 5 Tab Selector Pills */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                {desktopPanels.map((panel, idx) => (
                  <button
                    key={panel.id}
                    onClick={() => setDesktopTab(idx)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border ${
                      desktopTab === idx
                        ? 'bg-[#135D43] text-white border-[#135D43] shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900 shadow-2xs'
                    }`}
                  >
                    {panel.title}
                  </button>
                ))}
              </div>

              {/* Panel Details & Description Banner */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs max-w-4xl mx-auto shadow-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{currentDesktop.title}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold border border-slate-200">
                      {currentDesktop.badge}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-1">{currentDesktop.desc}</p>
                </div>
                <button
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 bg-[#135D43] text-white font-semibold rounded-lg text-xs hover:bg-[#0F4C37] shrink-0 self-start md:self-auto shadow-xs transition-all flex items-center gap-1.5"
                >
                  <span>આ પેનલમાં પ્રવેશ કરો</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Responsive Laptop Frame Hosting Active Desktop Tab */}
              <div className="max-w-4xl mx-auto">
                <div className="w-full shadow-2xl rounded-t-2xl border border-slate-300 bg-slate-900 p-2 sm:p-2.5 pb-0">
                  {/* Screen Bezel */}
                  <div className="rounded-t-xl overflow-hidden bg-white border border-slate-300 shadow-inner">
                    {/* Window Top Bar */}
                    <div className="h-9 bg-slate-100 border-b border-slate-200 px-3.5 flex items-center justify-between text-slate-600 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
                        <span className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
                        <span className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
                        <span className="ml-2 font-bold text-slate-800 text-xs font-heading">
                          {currentDesktop.mockupData.headerTitle}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#135D43] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                        ANIVERA • v0.3
                      </span>
                    </div>

                    {/* Screen Viewport with Active Panel Content */}
                    <div className="p-4 sm:p-6 text-slate-900 bg-slate-50/50 text-left space-y-4">
                      {/* 4 KPIs in one row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {currentDesktop.mockupData.kpis.map((kpi, kIdx) => (
                          <div key={kIdx} className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                            <span className="text-[11px] text-slate-500 font-medium block">{kpi.label}</span>
                            <span className="text-base sm:text-lg font-bold text-slate-900 font-heading block mt-0.5">
                              {kpi.val}
                            </span>
                            <span className="text-[11px] text-[#135D43] block mt-0.5 font-medium">
                              {kpi.sub}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Feature Highlights Grid */}
                      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                        <p className="text-xs font-bold text-slate-800 mb-2">
                          મુખ્ય ક્ષમતાઓ અને સરકારી પ્રોટોકોલ:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {currentDesktop.highlights.map((h, hIdx) => (
                            <div key={hIdx} className="flex items-start gap-2 text-slate-700">
                              <Check className="w-4 h-4 text-[#135D43] shrink-0 mt-0.5" />
                              <span className="text-xs leading-snug">{h}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Integrated Status Footer */}
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                        <span className="truncate">{currentDesktop.mockupData.statusText}</span>
                        <span className="text-[#135D43] font-semibold shrink-0">૧૦૦% સુરક્ષિત ડેટાબેઝ</span>
                      </div>
                    </div>
                  </div>

                  {/* Laptop Aluminum Base */}
                  <div className="h-5 sm:h-6 bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 rounded-b-xl border-t border-slate-300/80 flex items-center justify-center shadow-md relative">
                    <div className="w-16 sm:w-24 h-1.5 bg-slate-500/40 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* OPTION B: MOBILE PHONE SHOWCASE (5 Mobile Workflows)             */}
          {/* ---------------------------------------------------------------- */}
          {deviceMode === 'MOBILE' && (
            <div className="space-y-6">
              {/* Mobile Tab Selector Pills */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                {mobileWorkflows.map((wf, idx) => (
                  <button
                    key={wf.id}
                    onClick={() => setMobileTab(idx)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border ${
                      mobileTab === idx
                        ? 'bg-[#135D43] text-white border-[#135D43] shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900 shadow-2xs'
                    }`}
                  >
                    {wf.title}
                  </button>
                ))}
              </div>

              {/* Mobile Description Banner */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 max-w-2xl mx-auto text-center space-y-1 shadow-xs">
                <span className="text-xs font-bold text-slate-900 block">{currentMobile.title}</span>
                <p className="text-xs text-slate-600">{currentMobile.desc}</p>
              </div>

              {/* Realistic Smartphone Hardware Mockup Frame */}
              <div className="max-w-xs mx-auto">
                <div className="w-[290px] sm:w-[320px] mx-auto rounded-[46px] bg-slate-900 p-3 shadow-2xl border-[4px] border-slate-700 relative">
                  {/* Side buttons */}
                  <div className="absolute -left-[6px] top-24 w-[3px] h-9 bg-slate-600 rounded-l" />
                  <div className="absolute -left-[6px] top-36 w-[3px] h-9 bg-slate-600 rounded-l" />
                  <div className="absolute -right-[6px] top-28 w-[3px] h-12 bg-slate-600 rounded-r" />

                  {/* Phone Screen Display */}
                  <div className="bg-slate-50 rounded-[38px] p-3.5 text-slate-900 min-h-[440px] flex flex-col justify-between overflow-hidden border border-slate-200 relative shadow-inner">
                    <div>
                      {/* Dynamic Island Header */}
                      <div className="w-24 h-5 bg-black rounded-full mx-auto mb-2 flex items-center justify-between px-2 text-[8px] text-white">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span className="font-mono text-[9px] text-white">09:41</span>
                        <span className="text-[7px]">5G 98%</span>
                      </div>

                      {/* Screen Title */}
                      <div className="py-2 border-b border-slate-200 mb-2.5 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900 font-heading">{currentMobile.screenHeader}</h4>
                        <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-[#135D43] border border-emerald-200">
                          PWA OFFLINE
                        </span>
                      </div>

                      {/* Interactive Mobile Workflow Body */}
                      {currentMobile.screenBody}
                    </div>

                    {/* Bottom Virtual Home Indicator */}
                    <div className="pt-2 text-center">
                      <div className="w-28 h-1 bg-slate-300 rounded-full mx-auto" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* FLIP CARDS: Official Government SOP & Role Operational Guides    */}
          {/* ---------------------------------------------------------------- */}
          <div className="pt-10 space-y-4">
            <div className="text-center space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#135D43] block font-mono">
                GOVERNMENT STANDARD OPERATING PROCEDURES
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 font-heading">
                સરકારી SOP કાર્ડ્સ (ક્લિક કરીને ફ્લિપ કરો)
              </h3>
              <p className="text-xs text-slate-600">
                દરેક કાર્ડ પર ક્લિક કરીને અધિકૃત સરકારી પ્રોટોકોલ અને Standard Operating Procedures જુઓ:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {govFlipCards.map((card) => {
                const isFlipped = !!flippedCards[card.key];
                return (
                  <div
                    key={card.key}
                    onClick={() => toggleFlip(card.key)}
                    className="relative cursor-pointer min-h-[280px] rounded-2xl border border-slate-200 bg-white p-5 hover:border-[#135D43]/50 hover:shadow-md transition-all duration-300 flex flex-col justify-between shadow-2xs"
                  >
                    {!isFlipped ? (
                      // FRONT OF CARD
                      <div className="space-y-3 flex flex-col justify-between h-full">
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                              {card.icon}
                            </div>
                            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              CLICK TO FLIP
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-slate-900 font-heading">
                            {card.roleTitle}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">{card.dept}</p>

                          <div className="my-2.5">
                            <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {card.frontBadge}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed mt-1">
                            {card.frontSummary}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-[#135D43] font-semibold">
                          <span>SOP પ્રોટોકોલ જુઓ</span>
                          <span className="flex items-center gap-1">
                            <span>ફ્લિપ કરો</span>
                            <RotateCw className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    ) : (
                      // BACK OF CARD (SOP Details)
                      <div className="space-y-3 flex flex-col justify-between h-full bg-slate-50 -m-5 p-5 rounded-2xl border border-[#135D43]/40">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-mono text-[#135D43] font-bold">
                              OFFICIAL SOP PROTOCOL
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200 flex items-center gap-1">
                              <RotateCw className="w-3 h-3 text-[#135D43]" />
                              <span>BACK</span>
                            </span>
                          </div>

                          <h5 className="text-xs font-bold text-slate-900 font-heading">
                            {card.backTitle}
                          </h5>

                          <div className="space-y-1.5 mt-2.5 text-slate-700 text-xs leading-snug">
                            {card.backPoints.map((pt, pIdx) => (
                              <p key={pIdx} className="flex items-start gap-1.5">
                                <span className="text-[#135D43] mt-0.5 font-bold">•</span>
                                <span>{pt}</span>
                              </p>
                            ))}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200">
                          <span className="text-[9px] font-mono text-slate-500 block truncate">
                            {card.authorityTag}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 4. CORE VALUE PILLARS (6 Capability Cards)                           */}
      {/* ==================================================================== */}
      <section id="features" className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#135D43] block font-mono">
              SYSTEM CAPABILITIES
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 font-heading tracking-tight">
              પશુ સ્વાસ્થ્ય સંચાલનના ૬ આધારસ્તંભ
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              સરકારી વહીવટથી માંડીને છેવાડાના ખેડૂત સુધી વિશ્વસનીય અને પારદર્શક સેવા:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-[#135D43]/50 hover:shadow-md transition-all duration-200 space-y-3 shadow-2xs">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#135D43] border border-emerald-100 flex items-center justify-center font-bold">
                <Syringe className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 font-heading">
                ૧. ઘેર-ઘેર રસીકરણ ટ્રેકિંગ
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                ૧૨-અંકના Barcode/QR કોડ વડે દરેક પશુની ઓળખ અને રસીકરણનો વાસ્તવિક સમયનો રેકોર્ડ.
                કોઈપણ ખોટા કે અમાન્ય રેકોર્ડિંગની શક્યતા શૂન્ય.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-[#135D43]/50 hover:shadow-md transition-all duration-200 space-y-3 shadow-2xs">
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-bold">
                <MapPin className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 font-heading">
                ૨. જીઓસ્પેશિયલ GIS નકશો & સરહદ
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                ગૂગલ મેપ આધારિત લાઇવ જીઓ-વિઝ્યુલાઇઝેશન: ગામવાર રસીકરણ કવરેજ ટકાવારી (લીલો, પીળો, લાલ)
                અને રોગચાળાના સંકેતોનું તાત્કાલિક મેપિંગ.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-[#135D43]/50 hover:shadow-md transition-all duration-200 space-y-3 shadow-2xs">
              <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center font-bold">
                <WifiOff className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 font-heading">
                ૩. ૧૦૦% ઓફલાઇન-ફર્સ્ટ PWA ટેકનોલોજી
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                સીમ વિસ્તારો કે અંતરિયાળ ગામડાંઓમાં ઇન્ટરનેટ ન હોય તો પણ સંપૂર્ણ કાર્યરત રહે છે. નેટવર્ક આવતાં
                આપમેળે બેકગ્રાઉન્ડમાં ડેટા સિંક થાય છે.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-[#135D43]/50 hover:shadow-md transition-all duration-200 space-y-3 shadow-2xs">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center font-bold">
                <Stethoscope className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 font-heading">
                ૪. ક્લિનિકલ વહીવટી માળખું (DAHO • VO • FW)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                રોગની પુષ્ટિ ફક્ત અધિકૃત વેટરનરી અધિકારી જ કરી શકે છે અને ઝુંબેશ નીતિ ફક્ત DAHO દ્વારા મંજૂર થાય છે.
                સખત સરકારી પ્રોટોકોલનું પાલન.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-[#135D43]/50 hover:shadow-md transition-all duration-200 space-y-3 shadow-2xs">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#135D43] border border-emerald-100 flex items-center justify-center font-bold">
                <Thermometer className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 font-heading">
                ૫. રસી લોટ અને કોલ્ડ ચેઇન સ્ટોરેજ (2-8°C)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                દરેક રસીની એક્સપાયરી ડેટ, ઉત્પાદક બેચ નંબર અને આદર્શ સ્ટોરેજ તાપમાનનું સતત મોનિટરિંગ.
                ગુણવત્તાયુક્ત રસીકરણની ખાતરી.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-[#135D43]/50 hover:shadow-md transition-all duration-200 space-y-3 shadow-2xs">
              <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-800 border border-slate-200 flex items-center justify-center font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 font-heading">
                ૬. દૂધ ઉત્પાદક સહકારી મંડળી સંકલન
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                દૂધ મંડળીઓ પોતાના સભ્ય ખેડૂતોના પશુઓની એકત્રિત રસીકરણ પ્રગતિ જોઈ શકે છે અને સામુદાયિક આરોગ્ય કેમ્પનું
                આયોજન કરી શકે છે.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 5. ENTERPRISE GOVERNANCE & SECURITY MATRIX                           */}
      {/* ==================================================================== */}
      <section id="security" className="py-16 sm:py-24 bg-slate-50 text-slate-900 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-mono font-semibold tracking-wider text-[#135D43] uppercase block">
              ENTERPRISE GOVERNANCE & SECURITY
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold font-heading text-slate-900 tracking-tight">
              અત્યાધુનિક સરકારી ડેટા સુરક્ષા અને ઓડિટ નિયંત્રણ
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              સરકારી નિયમો અનુસાર ડેટાની વિશ્વસનીયતા, ગોપનીયતા અને અધિકૃતતા સુનિશ્ચિત કરવા માટે નિર્મિત:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2.5 shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#135D43] border border-emerald-100 flex items-center justify-center">
                <Shield className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 font-heading">અફર ઓડિટ ટ્રેઇલ (Immutable Audit)</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                દરેક રસીકરણ અને રોગ સમીક્ષા યુઝર આઈડી, ડિવાઇસ આઈડી અને ટાઇમસ્ટેમ્પ સાથે કાયમી નોંધાય છે જેને બદલી શકાતી નથી.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2.5 shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 font-heading">Multi-Tier RBAC અધિકારક્ષેત્ર</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                કોઈપણ ક્ષેત્રીય કાર્યકર સીધી રોગ પુષ્ટિ કરી શકતો નથી. ફક્ત અધિકૃત વેટરનરી અધિકારી જ ક્લિનિકલ નિર્ણય લઈ શકે છે.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2.5 shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-100 flex items-center justify-center">
                <Smartphone className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 font-heading">7-Day ઓફલાઇન ઉપકરણ માન્યતા</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                ઓફલાઇન કાર્ય માટે ઉપકરણને 7 દિવસની ક્રિપ્ટોગ્રાફિક ગ્રાન્ટ મળે છે. મુદત વીત્યા પછી પુનઃ પ્રમાણીકરણ ફરજિયાત બને છે.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2.5 shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center">
                <Eye className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 font-heading">ડેટા એન્ક્રિપ્શન અને SHA-256</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                રોગ અહેવાલના ફોટોગ્રાફ્સનું SHA-256 હેશિંગ થાય છે અને તમામ કનેક્શન SSL એન્ક્રિપ્ટેડ ટનલ વડે સુરક્ષિત રહે છે.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2.5 shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#135D43] border border-emerald-100 flex items-center justify-center">
                <Compass className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 font-heading">કાર્યક્ષેત્ર સીમા સુરક્ષા (Geo-Fencing)</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                દરેક સ્ટાફ સભ્ય ફક્ત પોતાને સોંપાયેલા ગામડાંઓમાં જ ડેટા એન્ટ્રી કરી શકે છે. ક્રોસ-વિલેજ અનધિકૃત એન્ટ્રી અટકાવેલ છે.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2.5 shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 border border-slate-200 flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 font-heading">Zero Data Loss ગેરંટી</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                સિંક નિષ્ફળ જાય કે લોગઆઉટ થાય તો પણ લોકલ IndexedDB માં સંગ્રહાયેલ એક પણ રસી કે પશુનો રેકોર્ડ ક્યારેય ડીલીટ થતો નથી.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 6. REAL-TIME SPECIES ANALYTICS & PILOT PROGRESS                      */}
      {/* ==================================================================== */}
      <section id="analytics" className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Column: Visual Chart Card */}
            <div className="lg:col-span-7 bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 font-heading">
                    બોટાદ જિલ્લો: પ્રજાતિવાર અને રોગવાર સિદ્ધિ
                  </h4>
                  <p className="text-[11px] text-slate-500">વાસ્તવિક ક્ષેત્રીય રસીકરણ મોનિટરિંગ</p>
                </div>
                <span className="text-xs font-bold text-[#135D43] bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  83.1% કવરેજ
                </span>
              </div>

              {/* Progress Bars */}
              <div className="space-y-3.5 text-xs">
                <div>
                  <div className="flex justify-between font-medium text-slate-700 mb-1">
                    <span>ગાય (Cattle) — દૂધાળા પશુ</span>
                    <span className="font-mono font-bold text-[#135D43]">1,420 / 1,650 (86%)</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-[#135D43] h-2 rounded-full" style={{ width: '86%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-medium text-slate-700 mb-1">
                    <span>ભેંસ (Buffalo) — દૂધાળા પશુ</span>
                    <span className="font-mono font-bold text-blue-700">1,180 / 1,400 (84%)</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '84%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-medium text-slate-700 mb-1">
                    <span>નાના પશુ (બકરી/ઘેટાં)</span>
                    <span className="font-mono font-bold text-amber-700">292 / 430 (68%)</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-amber-500 h-2 rounded-full" style={{ width: '68%' }} />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span>કુલ રક્ષિત પશુ: <strong className="text-slate-900 font-mono">2,892 ડોઝ</strong></span>
                <span>તાલુકા: <strong className="text-slate-900">બોટાદ • ગઢડા • બરવાળા • રાણપુર</strong></span>
              </div>
            </div>

            {/* Right Column: Analytics Capabilities */}
            <div className="lg:col-span-5 space-y-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#135D43] block font-mono">
                DATA-DRIVEN GOVERNANCE
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading tracking-tight">
                પારદર્શક, સચોટ અને તાત્કાલિક નિર્ણય શક્તિ
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                કાગળ આધારિત રજીસ્ટરોની ભૂલો અને વિલંબ દૂર કરી, ANIVERA પ્લેટફોર્મ ક્ષણે-ક્ષણનો ડેટા રજૂ કરે છે જેથી
                કોઈપણ ગામમાં રોગચાળો ફેલાય તે પહેલાં જ પગલાં લઈ શકાય.
              </p>

              <div className="space-y-2 pt-2 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#135D43]" />
                  <span>રોગચાળો ફેલાતા અટકાવવા Early Warning Alert સિસ્ટમ</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#135D43]" />
                  <span>દૈનિક અને સાપ્તાહિક રસીકરણ ઝડપ ટ્રેકિંગ (Velocity Chart)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#135D43]" />
                  <span>સરકારી અહેવાલો માટે 1-ક્લિક Excel/PDF નિકાસ</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 7. VERIFIED PILOT METRICS COUNTER                                    */}
      {/* ==================================================================== */}
      <section className="py-12 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center shadow-2xs">
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading font-mono">
                20,000+
              </p>
              <p className="text-xs font-medium text-slate-600 mt-1">લક્ષિત પશુધન નોંધણી</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center shadow-2xs">
              <p className="text-2xl sm:text-3xl font-extrabold text-[#135D43] font-heading font-mono">
                192
              </p>
              <p className="text-xs font-medium text-slate-600 mt-1">બોટાદ જિલ્લાના ગામો</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center shadow-2xs">
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading font-mono">
                4
              </p>
              <p className="text-xs font-medium text-slate-600 mt-1">વહીવટી તાલુકા</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center shadow-2xs">
              <p className="text-2xl sm:text-3xl font-extrabold text-[#135D43] font-heading font-mono">
                100%
              </p>
              <p className="text-xs font-medium text-slate-600 mt-1">ઓફલાઇન ફિલ્ડ સક્ષમ</p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 8. CONTACT & GOVERNMENT QUERY SECTION                                */}
      {/* ==================================================================== */}
      <section id="contact" className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-10 space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#135D43] block font-mono">
              OFFICIAL ASSISTANCE & QUERIES
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
              જિલ્લા પશુપાલન વિભાગનો સંપર્ક કરો
            </h3>
            <p className="text-xs text-slate-600">
              સિસ્ટમ ઉપયોગ, રસીકરણ કેમ્પ અથવા કટોકટી રોગચાળા સહાય માટે સંદેશ મોકલો:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Left Office Info (5 cols) */}
            <div className="md:col-span-5 bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4 text-xs shadow-2xs">
              <h4 className="text-sm font-bold text-slate-900 font-heading">સત્તાવાર કાર્યાલય સરનામું</h4>
              <p className="text-slate-700 leading-relaxed">
                જિલ્લા પશુપાલન અધિકારીશ્રીની કચેરી (DAHO),<br />
                જિલ્લા સેવા સદન, બોટાદ - 364710,<br />
                ગુજરાત, ભારત.
              </p>

              <div className="pt-2 border-t border-slate-200 space-y-2 text-slate-600">
                <div>
                  <span className="text-slate-500 block text-[10px]">ઈમેલ:</span>
                  <span className="font-mono font-medium text-slate-900">daho-botad@gujarat.gov.in</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">પશુ સંજીવની ઇમરજન્સી હેલ્પલાઇન:</span>
                  <span className="font-mono font-bold text-[#135D43]">1962 (ટોલ ફ્રી)</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[#135D43] text-[11px] leading-tight font-medium">
                નોંધ: આ પોર્ટલ ગુજરાત સરકારના પશુપાલન વિભાગના બોટાદ પાયલોટ પ્રોજેક્ટ હેઠળ કાર્યરત છે.
              </div>
            </div>

            {/* Right Contact Form (7 cols) */}
            <div className="md:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
              {isSubmitted ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#135D43] border border-emerald-200 flex items-center justify-center mx-auto shadow-xs">
                    <Check className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">તમારો સંદેશ સફળતાપૂર્વક મોકલાઈ ગયો છે!</h4>
                  <p className="text-xs text-slate-600">
                    જિલ્લા કચેરી સ્ટાફ ટૂંક સમયમાં તમારો સંપર્ક કરશે.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">તમારું નામ *</label>
                      <input
                        type="text"
                        required
                        placeholder="નામ દાખલ કરો..."
                        value={contactForm.name}
                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                        className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-[#135D43] focus:ring-1 focus:ring-[#135D43] text-xs shadow-2xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">ઈમેલ અથવા મોબાઇલ નંબર</label>
                      <input
                        type="text"
                        placeholder="સંપર્ક વિગત..."
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-[#135D43] focus:ring-1 focus:ring-[#135D43] text-xs shadow-2xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">તમારો હોદ્દો / ભૂમિકા</label>
                    <select
                      value={contactForm.role}
                      onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-[#135D43] text-xs shadow-2xs"
                    >
                      <option value="FARMER">પશુપાલક / ખેડૂત</option>
                      <option value="FW">ક્ષેત્રીય કાર્યકર (Field Worker)</option>
                      <option value="VO">વેટરનરી ઓફિસર (VO)</option>
                      <option value="COOP">દૂધ સહકારી મંડળી સભ્ય</option>
                      <option value="OTHER">અન્ય સરકારી અધિકારી</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">સંદેશ / પ્રશ્ન *</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="તમારી વિગત અહીં લખો..."
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-[#135D43] text-xs shadow-2xs"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#135D43] text-white font-semibold rounded-lg text-xs hover:bg-[#0F4C37] transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>સંદેશ મોકલો</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 9. GOVERNMENT & ANIVERA OFFICIAL FOOTER                              */}
      {/* ==================================================================== */}
      <footer className="bg-[#171210] border-t border-[#2C211D] py-10 text-xs text-[#A89A92]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2D211C] to-[#140F0D] border border-[#44332B] text-emerald-400 flex items-center justify-center font-bold text-xs shadow-sm">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <span className="font-bold text-white font-heading text-sm">ANIVERA</span>
                <span className="text-[11px] text-[#A89A92] block">
                  ડિજિટલ પશુ સ્વાસ્થ્ય અને રસીકરણ વ્યવસ્થાપન પ્રણાલી
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-[#D5CBC5]">
              <a href="#how-to-use" className="hover:text-white transition-colors duration-150">
                ઉપયોગ પદ્ધતિ
              </a>
              <a href="#features" className="hover:text-white transition-colors duration-150">
                સુવિધાઓ
              </a>
              <a href="#security" className="hover:text-white transition-colors duration-150">
                સુરક્ષા SOP
              </a>
              <a href="#analytics" className="hover:text-white transition-colors duration-150">
                એનાલિટિક્સ
              </a>
              <button onClick={() => navigate('/login')} className="hover:text-white transition-colors duration-150 cursor-pointer">
                સ્ટાફ લોગિન
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-[#2C211D] flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[#8C7E76]">
            <p>© 2026 ANIVERA — પશુપાલન વિભાગ, બોટાદ જિલ્લો, ગુજરાત સરકાર. All Rights Reserved.</p>
            <p>Designed for Gujarat Livestock Health Governance</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;