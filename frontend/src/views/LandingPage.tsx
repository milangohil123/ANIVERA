import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  ArrowRight,
  LogIn,
  CheckCircle2,
  Laptop,
  MapPin,
  Syringe,
  Menu,
  X,
  Compass,
  RotateCw,
  QrCode,
  Wifi,
  Layers,
  Activity,
  HeartPulse,
  PhoneCall,
  ChevronRight,
  Users,
} from 'lucide-react';
import { useTranslation } from '../i18n';
import { LanguageSelector } from '../components/common/LanguageSelector';
import { AnimatedCounter } from '../components/common/AnimatedCounter';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Mobile menu toggle
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Platform Explorer Tab
  const [explorerTab, setExplorerTab] = useState<'DAHO' | 'TAHO' | 'VO' | 'FW' | 'COOP' | 'FARMER'>('DAHO');

  // Contact form state
  const [contactForm, setContactForm] = useState({ name: '', email: '', role: 'FARMER', message: '' });
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Flip cards state for SOP
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});

  const toggleFlip = (cardKey: string) => {
    setFlippedCards((prev) => ({ ...prev, [cardKey]: !prev[cardKey] }));
  };

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

  // Explorer Mockup Definitions
  const explorerContent = {
    DAHO: {
      title: 'DAHO વહીવટી મોનિટરિંગ (District Oversight)',
      role: 'જિલ્લા પશુપાલન અધિકારી (DAHO)',
      desc: 'જિલ્લાના તમામ તાલુકા અને ગામડાઓનું રસીકરણ લક્ષ્યાંક, સ્ટોક સંચાલન, રોગ સર્વેલન્સ અને સરકારી નીતિ વિષયક ઝુંબેશ મંજૂરી.',
      kpis: [
        { label: 'કુલ તાલુકા', val: '4', sub: 'બોટાદ જિલ્લો' },
        { label: 'નોંધાયેલા ગામો', val: '192', sub: 'સત્તાવાર કાર્યક્ષેત્ર' },
        { label: 'કુલ પશુધન', val: '20,000+', sub: 'નોંધાયેલ હર્ડ' },
        { label: 'કવરેજ ટકાવારી', val: '83.1%', sub: 'લક્ષિત સિદ્ધિ' },
      ],
      points: [
        'તાલુકાવાર લક્ષ્યાંક વિશ્લેષણ અને દૈનિક પ્રગતિ ટ્રેકિંગ',
        'રોગ સર્વેક્ષણ પૂર્વ ચેતવણી જોખમ નિરીક્ષણ (Early Warning Surveillance)',
        'નવી રસીકરણ ઝુંબેશ રચના અને મંજૂરી (campaign.create)',
        'વેટરનરી ઓફિસર અને ક્ષેત્રીય સ્ટાફ પ્રોવિઝનિંગ & ઓથોરાઇઝેશન',
      ],
    },
    TAHO: {
      title: 'TAHO તાલુકા સંકલન (Taluka Coordination)',
      role: 'તાલુકા પશુપાલન અધિકારી (TAHO)',
      desc: 'તાલુકા સ્તરે વેટરનરી અધિકારીઓ અને ફીલ્ડ વર્કર્સનું ક્ષેત્રીય સંકલન, ગામવાર રસીકરણ ઝુંબેશ અને સ્થાનિક સુપરવિઝન.',
      kpis: [
        { label: 'કાર્યક્ષેત્ર ગામો', val: '48', sub: 'તાલુકો' },
        { label: 'સક્રિય સ્ટાફ', val: '14', sub: 'VO + FW' },
        { label: 'ચાલુ ઝુંબેશો', val: '2', sub: 'FMD / Brucella' },
        { label: 'કવરેજ દર', val: '89.4%', sub: 'તાલુકા સરેરાશ' },
      ],
      points: [
        'ગામવાર રસીકરણ ઝુંબેશ સંચાલન અને લક્ષ્યાંક નિર્ધારણ',
        'વેટરનરી સ્ટાફ અને ફીલ્ડ વર્કર્સની ગામ મુજબ ફાળવણી',
        'ગામીણ GIS નકશા દ્વારા રીઅલ-ટાઇમ પ્રગતિ નિરીક્ષણ',
        'સ્થાનિક પશુપાલક ડિરેક્ટરી અને આરોગ્ય અહેવાલો',
      ],
    },
    VO: {
      title: 'VO ક્લિનિકલ રોગ સમીક્ષા (Veterinary Clinic)',
      role: 'વેટરનરી અધિકારી (VO)',
      desc: 'ગામડાઓમાંથી મળેલા પશુ રોગ અહેવાલોની તપાસ, ક્લિનિકલ નિદાન, સારવાર નોંધણી, અંતિમ રોગ પુષ્ટિ અને પશુ આરોગ્ય કેમ્પ.',
      kpis: [
        { label: 'સોંપાયેલ ગામડાં', val: '3', sub: 'અધિકૃત કાર્યક્ષેત્ર' },
        { label: 'રોગ અહેવાલો', val: '5', sub: '૩ સમીક્ષા બાકી' },
        { label: 'પુષ્ટિ થયેલ કેસ', val: '1', sub: 'FMD સંકલન' },
        { label: 'રસીકરણ દર', val: '88.5%', sub: 'ચોમાસુ રસીકરણ' },
      ],
      points: [
        'ક્લિનિકલ રોગ સમીક્ષા ઇનબોક્સ (FMD, HS, BQ શંકાસ્પદ કેસ)',
        'વિભાગીય રોગ પુષ્ટિ અથવા નકારવાની સત્તા (disease.confirm)',
        'પશુ આરોગ્ય કેમ્પ દરખાસ્તોની મંજૂરી અને તારીખ ફાળવણી',
        'સ્થાનિક રસી સ્ટોક સબ-ડેપો વિતરણ અને કોલ્ડ-ચેઈન ઓડિટ',
      ],
    },
    FW: {
      title: 'FW ક્ષેત્રીય નોંધણી & રસીકરણ (Field Operations)',
      role: 'ફીલ્ડ વર્કર (Field Worker)',
      desc: 'ઘર-ઘર જઈને પશુ નોંધણી, કાનમાં RFID/QR ટૅગિંગ, રસીકરણ નોંધણી અને ૧૦૦% ઓફલાઇન સિંક ક્ષમતા સાથે ક્ષેત્રીય કામગીરી.',
      kpis: [
        { label: 'સોંપાયેલ ગામ', val: '2', sub: 'ક્ષેત્રીય કવરેજ' },
        { label: 'આજે રસીકરણ', val: '38', sub: 'ડોઝ આપેલા' },
        { label: 'બાકી સિંક', val: '0', sub: 'બધા ડેટા સિંક' },
        { label: 'પશુ ટેગિંગ', val: '100%', sub: 'સંપૂર્ણ વેરિફાઇડ' },
      ],
      points: [
        '૧૦૦% ઓફલાઇન કામગીરી — ઇન્ટરનેટ વગર ગામમાં ડેટા એન્ટ્રી',
        'QR સ્કેનિંગ દ્વારા પશુ પ્રોફાઇલ અને ઇતિહાસની ત્વરિત ઓળખ',
        'તાત્કાલિક રોગ લક્ષણ ફોટો સાથે પ્રાથમિક અહેવાલ સબમિશન',
        'સ્વયંસંચાલિત રીકનેક્શન સિંક (Auto conflict-free sync)',
      ],
    },
    COOP: {
      title: 'ડેરી સહકારી મંડળી (Dairy Cooperative)',
      role: 'દૂધ સહકારી મંડળી (Dairy Cooperative)',
      desc: 'દૂધ ઉત્પાદક ખેડૂતોના પશુધનને રોગમુક્ત રાખવા માટે એકત્રિત કવરેજ ડેટા, સામુદાયિક રસીકરણ કેમ્પ અને દૂધ ઉત્પાદકતા સુરક્ષા.',
      kpis: [
        { label: 'જોડાયેલ ગામો', val: '15', sub: 'સહકારી કાર્યક્ષેત્ર' },
        { label: 'સભ્ય પશુઓ', val: '4,850', sub: 'નોંધાયેલ દુધાળા પશુ' },
        { label: 'કુલ કવરેજ', val: '89.2%', sub: 'ડેરી રસીકરણ કવરેજ' },
        { label: 'સહકારી કેમ્પ', val: '3', sub: 'આયોજિત કેમ્પ' },
      ],
      points: [
        'સહકારી મંડળીના જોડાયેલ ગામોની એકત્રિત પ્રગતિ (Aggregate Progress)',
        'દૂધ ઉત્પાદક ખેડૂત રસીકરણ વલણ ગ્રાફ અને રોગ સુરક્ષા',
        'ડેરી સપ્લાય ચેઈન પશુ સુરક્ષા અને સામુદાયિક કેમ્પ દરખાસ્ત',
        'પશુપાલકની ગોપનીયતા જાળવીને ફક્ત ગ્રામ્ય સ્તરનો અહેવાલ',
      ],
    },
    FARMER: {
      title: 'પશુપાલક / ખેડૂત પોર્ટલ (Farmer Direct Portal)',
      role: 'પશુપાલક / ખેડૂત (Livestock Owner)',
      desc: 'પોતાના પશુધનની ડિજિટલ પ્રોફાઇલ, રસીકરણ પ્રમાણપત્રો, આગામી બૂસ્ટર તારીખો અને બીમાર પશુ માટે તાત્કાલિક રોગ અહેવાલ.',
      kpis: [
        { label: 'મારા પશુઓ', val: '4', sub: 'નોંધાયેલ પશુધન' },
        { label: 'આરોગ્ય સ્થિતિ', val: 'ઉત્તમ', sub: 'સંપૂર્ણ રસીકરણ' },
        { label: 'બૂસ્ટર ડ્યુ', val: '15 દિવસ', sub: 'HS/BQ રસી' },
        { label: 'સેવા વિનંતી', val: 'સક્રિય', sub: 'VO મુલાકાત' },
      ],
      points: [
        'સરળ ઓટીપી આધારિત લૉગિન (OTP Login with Registered Mobile)',
        'પશુના કાનના ટેગ નંબરથી સંપૂર્ણ આરોગ્ય ઇતિહાસ અને રસીકરણ કાર્ડ',
        'પશુ બીમાર પડે ત્યારે ફોટો અને લક્ષણો સાથે ત્વરિત સહાય વિનંતી',
        'આગામી રસીકરણ તારીખ માટે સ્વયંસંચાલિત ગુજરાતી એલર્ટ',
      ],
    },
  };

  const currentTab = explorerContent[explorerTab];

  return (
    <div className="min-h-screen bg-[#F0F4F8] text-[#172033] font-body selection:bg-[#135D43] selection:text-white antialiased">
      {/* ---------------------------------------------------------------------- */}
      {/* 1. TOP MODERN AGTECH NAVBAR (Inspired by DRN-OS Reference)              */}
      {/* ---------------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#E2E8F0] shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Logo & Branding */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#135D43] to-[#0A3828] flex items-center justify-center text-white shadow-xs border border-emerald-600/30">
              <ShieldCheck className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-heading font-black text-xl tracking-tight text-[#0F172A]">ANIVERA</span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 font-mono">
                  પશુરક્ષક
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">
                GUJARAT LIVESTOCK HEALTH & EPIDEMIC SURVEILLANCE
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold text-slate-700">
            <a href="#about" className="hover:text-[#135D43] transition-colors">
              ઝાંખી (About)
            </a>
            <a href="#capabilities" className="hover:text-[#135D43] transition-colors">
              ટેકનોલોજી & ક્ષમતાઓ
            </a>
            <a href="#surveillance" className="hover:text-[#135D43] transition-colors">
              રોગ સર્વેલન્સ
            </a>
            <a href="#explorer" className="hover:text-[#135D43] transition-colors">
              વિભાગીય પોર્ટલ્સ
            </a>
            <a href="#impact" className="hover:text-[#135D43] transition-colors">
              રાજ્યવ્યાપી આંકડા
            </a>
            <a href="#contact" className="hover:text-[#135D43] transition-colors">
              સહાય હેલ્પલાઇન
            </a>
          </nav>

          {/* Action Buttons & Language Toggle */}
          <div className="hidden sm:flex items-center gap-2.5">
            <LanguageSelector />

            <button
              onClick={() => navigate('/farmer/login')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition-colors shadow-2xs"
            >
              <span>ખેડૂત લૉગિન</span>
            </button>

            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#135D43] hover:bg-[#0E4632] text-white text-xs font-bold transition-all shadow-xs"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>અધિકારી પ્રવેશ</span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex sm:hidden items-center gap-2">
            <LanguageSelector />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-slate-700 hover:text-slate-900 rounded-lg border border-slate-200"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="sm:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3 animate-fade-in shadow-lg">
            <div className="grid grid-cols-2 gap-2 pb-2">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigate('/farmer/login');
                }}
                className="w-full py-2 px-3 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold text-center"
              >
                ખેડૂત લૉગિન
              </button>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigate('/login');
                }}
                className="w-full py-2 px-3 rounded-lg bg-[#135D43] text-white text-xs font-bold text-center"
              >
                અધિકારી પ્રવેશ
              </button>
            </div>
            <div className="space-y-2 text-xs font-semibold text-slate-700 pt-2 border-t border-slate-100">
              <a
                href="#about"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-1.5 hover:text-[#135D43]"
              >
                ઝાંખી (About)
              </a>
              <a
                href="#capabilities"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-1.5 hover:text-[#135D43]"
              >
                ટેકનોલોજી & ક્ષમતાઓ
              </a>
              <a
                href="#surveillance"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-1.5 hover:text-[#135D43]"
              >
                રોગ સર્વેલન્સ & રસીકરણ
              </a>
              <a
                href="#explorer"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-1.5 hover:text-[#135D43]"
              >
                વિભાગીય પોર્ટલ્સ
              </a>
              <a
                href="#impact"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-1.5 hover:text-[#135D43]"
              >
                રાજ્યવ્યાપી આંકડા
              </a>
              <a
                href="#contact"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-1.5 hover:text-[#135D43]"
              >
                સહાય હેલ્પલાઇન (1800-BOTAD)
              </a>
            </div>
          </div>
        )}
      </header>

      {/* ---------------------------------------------------------------------- */}
      {/* 2. CINEMATIC HERO SECTION (Directly Inspired by DRN-OS AgTech Reference) */}
      {/* ---------------------------------------------------------------------- */}
      <section className="relative overflow-hidden pt-8 pb-16 lg:pt-14 lg:pb-24">
        {/* Subtle Ambient Decorative Gradients & Mesh */}
        <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-emerald-100/50 via-teal-50/20 to-transparent pointer-events-none -z-10" />
        <div className="absolute top-20 right-10 w-96 h-96 rounded-full bg-emerald-300/15 blur-3xl pointer-events-none animate-pulse-glow -z-10" />
        <div className="absolute top-40 left-10 w-80 h-80 rounded-full bg-sky-200/20 blur-3xl pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Pill Badge */}
          <div className="flex items-center justify-center lg:justify-start">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-emerald-200 shadow-2xs backdrop-blur-md mb-6">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#135D43]" />
              </span>
              <span className="text-[11px] font-bold text-emerald-900 tracking-wide uppercase">
                સશક્ત પશુપાલન • ડિજિટલ રોગ નિયંત્રણ પ્લેટફોર્મ (ANIVERA-OS)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Content Column */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <h1 className="text-3xl sm:text-5xl lg:text-[54px] font-black tracking-tight text-[#0F172A] font-heading leading-[1.12]">
                Smarter Farming Starts With{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#135D43] via-[#0E7A57] to-[#0284C7]">
                  Livestock Care
                </span>
                <span className="block text-2xl sm:text-3xl lg:text-[34px] font-bold text-[#1E293B] mt-2 font-body font-normal">
                  આધુનિક પશુ આરોગ્ય, રસીકરણ અને રોગ નિયંત્રણ
                </span>
              </h1>

              <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
                ગુજરાત સરકારનું એકીકૃત ડિજિટલ પશુધન સુરક્ષા નેટવર્ક — ૩૪ જિલ્લાઓ, વેટરનરી અધિકારીઓ, ડેરી સહકારી મંડળીઓ અને પશુપાલકોને વાસ્તવિક સમયના રસીકરણ ટ્રેકિંગ, GIS સ્થાનિક રોગ સર્વેલન્સ અને કોલ્ડ-ચેઈન ઓડિટ સાથે જોડે છે.
              </p>

              {/* Action Buttons Group */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#135D43] hover:bg-[#0E4632] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer group"
                >
                  <LogIn className="w-4 h-4 text-emerald-200 group-hover:translate-x-0.5 transition-transform" />
                  <span>અધિકારી પ્રવેશ (Staff Login)</span>
                  <ArrowRight className="w-4 h-4 text-emerald-200 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={() => navigate('/farmer/login')}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-emerald-50 text-[#135D43] border border-emerald-300 text-sm font-bold flex items-center justify-center gap-2 shadow-xs hover:border-emerald-500 transition-all cursor-pointer"
                >
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>ખેડૂત લૉગિન (Farmer Direct)</span>
                </button>

                <a
                  href="#capabilities"
                  className="text-xs font-bold text-slate-600 hover:text-[#135D43] px-3 py-2 transition-colors flex items-center gap-1"
                >
                  <span>વિશેષતાઓ જુઓ</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Interactive Feature Pills (Like DRN-OS bottom badges) */}
              <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-2 text-xs font-semibold text-slate-700">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-2xs hover:border-emerald-300 transition-colors">
                  <QrCode className="w-3.5 h-3.5 text-[#135D43]" />
                  <span>RFID & QR Ear Tagging</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-2xs hover:border-emerald-300 transition-colors">
                  <MapPin className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>GIS Village-Level Spatial Maps</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-2xs hover:border-emerald-300 transition-colors">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Cold-Chain Integrity</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-2xs hover:border-emerald-300 transition-colors">
                  <Wifi className="w-3.5 h-3.5 text-amber-600" />
                  <span>100% Offline Edge Sync</span>
                </span>
              </div>
            </div>

            {/* Right Visual & Floating Cards Column (Inspired by reference photo) */}
            <div className="lg:col-span-5 relative mt-6 lg:mt-0 flex justify-center">
              {/* Outer Card Shell with Subtle Glass Effect */}
              <div className="relative w-full max-w-md bg-gradient-to-br from-emerald-800 via-[#135D43] to-[#0A3828] rounded-3xl p-6 text-white shadow-2xl overflow-hidden border border-emerald-500/30">
                {/* Background AgTech Decorative Elements */}
                <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-emerald-400/20 blur-2xl pointer-events-none" />
                <div className="absolute -bottom-8 -left-8 w-44 h-44 rounded-full bg-sky-400/20 blur-2xl pointer-events-none" />

                {/* Header in Mockup */}
                <div className="flex items-center justify-between border-b border-white/15 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center font-bold">
                      🐄
                    </div>
                    <div>
                      <div className="text-xs font-bold font-heading">ANIVERA Livestock Console</div>
                      <div className="text-[10px] text-emerald-200">State Animal Health Registry</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-100 border border-emerald-300/30">
                    LIVE TELEMETRY
                  </span>
                </div>

                {/* Central Visual Telemetry */}
                <div className="py-6 space-y-4">
                  <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-100 font-medium">રાજ્યવ્યાપી રસીકરણ સિદ્ધિ</span>
                      <span className="font-mono font-bold text-white text-sm">94.8%</span>
                    </div>
                    {/* Animated Progress Bar */}
                    <div className="w-full h-2.5 bg-black/25 rounded-full overflow-hidden p-0.5">
                      <div className="h-full bg-gradient-to-r from-teal-300 to-emerald-400 rounded-full w-[94.8%] transition-all duration-1000" />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-emerald-200">
                      <span>લક્ષ્યાંક: ૨૦,૦૦,૦૦૦ પશુધન</span>
                      <span className="text-emerald-300 font-bold">FMD મુક્ત ઝુંબેશ</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/15">
                      <div className="text-xl font-bold font-heading text-white">૩૪</div>
                      <div className="text-[10px] text-emerald-200">સક્રિય જિલ્લાઓ</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/15">
                      <div className="text-xl font-bold font-heading text-white">૧૮,૫૦૦+</div>
                      <div className="text-[10px] text-emerald-200">આવરી લીધેલા ગામો</div>
                    </div>
                  </div>
                </div>

                {/* Bottom Status */}
                <div className="pt-2 border-t border-white/15 flex items-center justify-between text-[11px] text-emerald-100">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>રોગ સર્વેલન્સ એલર્ટ: સામાન્ય</span>
                  </div>
                  <span className="font-mono text-emerald-300 text-[10px]">100% ONLINE</span>
                </div>
              </div>

              {/* Floating Glass Information Card 1 (Top Right - Matches Reference Card) */}
              <div className="hidden sm:block absolute -top-6 -right-6 w-64 p-3.5 rounded-2xl bg-white/90 backdrop-blur-md border border-white/80 shadow-xl text-slate-800 animate-float-slow">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Outbreak Prevention
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <div className="text-xs font-bold text-[#0F172A] font-heading">
                  રોગ નિવારણ & સર્વેક્ષણ
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-lg font-black text-emerald-700 font-heading">૦ હોટસ્પોટ</span>
                  <span className="text-[10px] text-slate-500">સમગ્ર તાલુકો નિયંત્રિત</span>
                </div>
                <div className="mt-2 text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                  ૧૦૦% શંકાસ્પદ કેસ વેટરનરી ઓફિસર દ્વારા પ્રમાણિત
                </div>
              </div>

              {/* Floating Glass Information Card 2 (Bottom Left - Matches Reference Smart Tag) */}
              <div className="hidden sm:block absolute -bottom-6 -left-8 w-68 p-3.5 rounded-2xl bg-white/95 backdrop-blur-md border border-white/80 shadow-xl text-slate-800 animate-float-reverse">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#135D43] flex items-center justify-center font-bold text-xs shrink-0">
                    🏷️
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono text-slate-500 truncate">TAG: IN-GJ-BOT-00001</div>
                    <div className="text-xs font-bold text-slate-900 truncate">મુર્રાહ ભેંસ • બોટાદ જિલ્લો</div>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    FMD/Brucella રસીકૃત
                  </span>
                  <span className="text-slate-400 font-mono">VO વેરિફાઇડ</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------- */}
      {/* 3. STATEWIDE IMPACT & TELEMETRY COUNTER SECTION                        */}
      {/* ---------------------------------------------------------------------- */}
      <section id="impact" className="py-12 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <span className="text-xs font-bold text-[#135D43] uppercase tracking-wider">
              ગુજરાત રાજ્ય વહીવટી સ્કોપ
            </span>
            <h2 className="text-2xl font-bold text-slate-900 font-heading mt-1">
              રાજ્યવ્યાપી પશુધન રક્ષણ પ્રગતિ (Statewide Live Progress)
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-[#F8FAFC] border border-slate-200 p-4 rounded-xl text-center space-y-1 hover:border-emerald-300 transition-colors shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#135D43] mx-auto flex items-center justify-center">
                <Compass className="w-4 h-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-black font-heading text-slate-900 mt-2">
                <AnimatedCounter value={34} />
              </div>
              <div className="text-xs font-bold text-slate-700">જિલ્લાઓ (Districts)</div>
              <p className="text-[10px] text-slate-500">સત્તાવાર રાજ્યવ્યાપી કવરેજ</p>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200 p-4 rounded-xl text-center space-y-1 hover:border-emerald-300 transition-colors shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-[#0284C7] mx-auto flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-black font-heading text-slate-900 mt-2">
                <AnimatedCounter value={252} />
              </div>
              <div className="text-xs font-bold text-slate-700">તાલુકાઓ (Talukas)</div>
              <p className="text-[10px] text-slate-500">તાલુકા પશુપાલન અધિકારીઓ</p>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200 p-4 rounded-xl text-center space-y-1 hover:border-emerald-300 transition-colors shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#176B5B] mx-auto flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-black font-heading text-slate-900 mt-2">
                <AnimatedCounter value="18,500+" />
              </div>
              <div className="text-xs font-bold text-slate-700">ગામો (Villages Mapped)</div>
              <p className="text-[10px] text-slate-500">GIS સીમાઓ સાથે સંલગ્ન</p>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200 p-4 rounded-xl text-center space-y-1 hover:border-emerald-300 transition-colors shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 mx-auto flex items-center justify-center">
                <Syringe className="w-4 h-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-black font-heading text-slate-900 mt-2">
                <AnimatedCounter value="20,00,000+" />
              </div>
              <div className="text-xs font-bold text-slate-700">પશુધન રક્ષણ (Protected)</div>
              <p className="text-[10px] text-slate-500">ટેગ થયેલ ગાય, ભેંસ, ઘેટાં-બકરાં</p>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200 p-4 rounded-xl text-center space-y-1 hover:border-emerald-300 transition-colors shadow-2xs col-span-2 sm:col-span-1">
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 mx-auto flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-black font-heading text-slate-900 mt-2">
                <AnimatedCounter value="99.8%" />
              </div>
              <div className="text-xs font-bold text-slate-700">કોલ્ડ-ચેઈન ઓડિટ</div>
              <p className="text-[10px] text-slate-500">રસી ગુણવત્તા વિશ્વસનીયતા</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------- */}
      {/* 4. 6 CORE AGTECH CAPABILITIES PILLARS                                  */}
      {/* ---------------------------------------------------------------------- */}
      <section id="capabilities" className="py-16 bg-[#F0F4F8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <span className="text-xs font-bold text-[#135D43] uppercase tracking-wider">
              હાઈ-ટેક પશુ આરોગ્ય ઇન્ફ્રાસ્ટ્રક્ચર
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 font-heading">
              આધુનિક કૃષિ ટેકનોલોજી & ક્ષેત્રીય ક્ષમતાઓ
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              સરકારી વહીવટ, લેબોરેટરી નિદાન, અને છેવાડાના ખેડૂત સુધી પારદર્શક સેવા વિતરણ
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Pillar 1 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3.5 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#135D43] flex items-center justify-center group-hover:scale-105 transition-transform">
                <Syringe className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold font-heading text-slate-900">
                ૧. રસીકરણ & કોલ્ડ-ચેઈન મેનેજમેન્ટ
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                રાજ્ય કક્ષાના વેરહાઉસથી લઈને છેવાડાના ગામ સુધી રસીના દરેક લોટ (Batch/Lot) અને તાપમાનનું ડિજિટલ ટ્રેકિંગ, જેથી રસીની અસરકારકતા જળવાય.
              </p>
              <div className="pt-2 text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                <span>લોટ નંબર & એક્સપાયરી ઓડિટ</span> <ArrowRight className="w-3 h-3" />
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3.5 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-sky-50 text-[#0284C7] flex items-center justify-center group-hover:scale-105 transition-transform">
                <HeartPulse className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold font-heading text-slate-900">
                ૨. રોગ સર્વેલન્સ & તાત્કાલિક એલર્ટ
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                FMD, લમ્પી, HS કે એન્થ્રેક્સ જેવા ચેપી રોગના લક્ષણો ખેડૂત કે ફીલ્ડ વર્કર દ્વારા સબમિટ થતાં જ વેટરનરી અધિકારી પાસે પહોંચે છે અને ક્વોરેન્ટાઇન ત્રિજ્યા નક્કી થાય છે.
              </p>
              <div className="pt-2 text-[11px] font-bold text-sky-800 flex items-center gap-1">
                <span>રોગ પુષ્ટિ & કેસ ક્લોઝર</span> <ArrowRight className="w-3 h-3" />
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3.5 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-teal-50 text-[#176B5B] flex items-center justify-center group-hover:scale-105 transition-transform">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold font-heading text-slate-900">
                ૩. ગ્રામીણ GIS નકશા & હીટમેપ્સ
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                રાજ્ય, જિલ્લો, તાલુકો અને ૧૯૨+ ગામોનું ભૌગોલિક મેપિંગ. કયા ગામમાં રસીકરણ ઓછું છે તેનું લાલ/પીળા પિન સાથે લાઈવ સેટેલાઇટ મોનિટરિંગ.
              </p>
              <div className="pt-2 text-[11px] font-bold text-teal-800 flex items-center gap-1">
                <span>ઓન-ક્લિક સેટેલાઇટ વિશ્લેષણ</span> <ArrowRight className="w-3 h-3" />
              </div>
            </div>

            {/* Pillar 4 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3.5 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold font-heading text-slate-900">
                ૪. QR & RFID આધારિત પશુ પાસપોર્ટ
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                ભારત પશુધન સ્ટાન્ડર્ડ મુજબ કાનના ટેગનું સ્કેનિંગ. પશુની જાતિ, ઉંમર, દૂધ ઉત્પાદન અને સંપૂર્ણ રસીકરણ હિસ્ટ્રી એક જ ક્લિકમાં ઉપલબ્ધ.
              </p>
              <div className="pt-2 text-[11px] font-bold text-amber-800 flex items-center gap-1">
                <span>ડિજિટલ હેલ્થ પાસપોર્ટ</span> <ArrowRight className="w-3 h-3" />
              </div>
            </div>

            {/* Pillar 5 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3.5 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Wifi className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold font-heading text-slate-900">
                ૫. ૧૦૦% ઓફલાઇન ફીલ્ડ વર્કર સિંક
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                ઇન્ટરનેટ વગરના અંતરિયાળ સીમ વિસ્તારોમાં પણ એપ્લિકેશન અટક્યા વિના ચાલે છે. નેટવર્ક આવતાં જ સેકન્ડોમાં ડેટાબેઝ સાથે સુરક્ષિત ઓટો-સિંક.
              </p>
              <div className="pt-2 text-[11px] font-bold text-indigo-800 flex items-center gap-1">
                <span>એજ કમ્પ્યુટિંગ & કોન્ફ્લિક્ટ રીસોલ્યુશન</span> <ArrowRight className="w-3 h-3" />
              </div>
            </div>

            {/* Pillar 6 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3.5 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold font-heading text-slate-900">
                ૬. સત્તાવાર RBAC સુરક્ષા & ઓડિટ
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                સુપર એડમિન દ્વારા નિયંત્રિત ૮ અધિકૃત ભૂમિકાઓ અને ૫૫ પરવાનગીઓ. કોઈપણ અનધિકૃત એક્સેસ બ્લોક થાય છે અને સુરક્ષા ઓડિટ લૉગ સાચવાય છે.
              </p>
              <div className="pt-2 text-[11px] font-bold text-purple-800 flex items-center gap-1">
                <span>ડાયનેમિક મેટ્રિક્સ સિક્યોરિટી</span> <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------- */}
      {/* 5. INTERACTIVE PLATFORM EXPLORER (Laptop & Mobile Showcase)            */}
      {/* ---------------------------------------------------------------------- */}
      <section id="explorer" className="py-16 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold text-[#135D43] uppercase tracking-wider">
              વિભાગીય પોર્ટલ અન્વેષણ
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
              દરેક હોદ્દા માટેનું ખાસ તૈયાર કરેલું પોર્ટલ
            </h2>
            <p className="text-xs text-slate-600">
              નીચેના ટેબ્સ પર ક્લિક કરીને વિવિધ ભૂમિકાઓ માટેની કન્સોલ ક્ષમતાઓ જુઓ:
            </p>
          </div>

          {/* Role Tabs */}
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {(['DAHO', 'TAHO', 'VO', 'FW', 'COOP', 'FARMER'] as const).map((roleKey) => (
              <button
                key={roleKey}
                onClick={() => setExplorerTab(roleKey)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  explorerTab === roleKey
                    ? 'bg-[#135D43] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {roleKey === 'DAHO'
                  ? 'DAHO (જિલ્લા)'
                  : roleKey === 'TAHO'
                  ? 'TAHO (તાલુકા)'
                  : roleKey === 'VO'
                  ? 'VO (વેટરનરી)'
                  : roleKey === 'FW'
                  ? 'FW (ફીલ્ડ વર્કર)'
                  : roleKey === 'COOP'
                  ? 'ડેરી સહકારી'
                  : 'ખેડૂત પોર્ટલ'}
              </button>
            ))}
          </div>

          {/* Explorer Display Card */}
          <div className="bg-[#F8FAFC] border border-slate-200 rounded-3xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-xs">
            <div className="lg:col-span-5 space-y-4">
              <div className="inline-block px-2.5 py-1 rounded-md bg-emerald-100 text-[#135D43] font-bold text-xs font-heading">
                {currentTab.role}
              </div>
              <h3 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">
                {currentTab.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {currentTab.desc}
              </p>

              <div className="space-y-2 pt-2">
                {currentTab.points.map((pt, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-[#135D43] shrink-0 mt-0.5" />
                    <span>{pt}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <button
                  onClick={() => navigate(explorerTab === 'FARMER' ? '/farmer/login' : '/login')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#135D43] hover:bg-[#0E4632] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>આ પોર્ટલમાં પ્રવેશ કરો</span>
                </button>
              </div>
            </div>

            {/* Right KPI Preview */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-[#135D43]" />
                  <span className="text-xs font-bold text-slate-800 font-heading">
                    {currentTab.role} ડેશબોર્ડ ટેલિમેટ્રી
                  </span>
                </div>
                <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                  LIVE CONSOLE
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {currentTab.kpis.map((k, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-100 text-center">
                    <div className="text-[10px] text-slate-500 font-semibold">{k.label}</div>
                    <div className="text-lg font-bold font-heading text-slate-900 mt-1">{k.val}</div>
                    <div className="text-[9px] text-[#135D43] font-medium">{k.sub}</div>
                  </div>
                ))}
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>અધિકૃત RBAC સ્કોપ નિયંત્રણ દ્વારા સંપૂર્ણ સુરક્ષિત કન્સોલ.</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-800 uppercase font-mono">ENCRYPTED</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------- */}
      {/* 6. SOP GUIDELINES FLIP CARDS SECTION                                   */}
      {/* ---------------------------------------------------------------------- */}
      <section className="py-16 bg-[#F0F4F8] border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold text-[#135D43] uppercase tracking-wider">
              સરકારી SOP માર્ગદર્શિકા
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
              ક્ષેત્રીય સ્ટાફ અને ખેડૂતો માટે સત્તાવાર પ્રોટોકોલ
            </h2>
            <p className="text-xs text-slate-600">
              કાર્ડ પર ક્લિક કરીને નિયમો અને અધિકારોની વિગતો જુઓ (Click to Flip):
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1 */}
            <div
              onClick={() => toggleFlip('sop1')}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-2xs hover:shadow-md transition-all cursor-pointer relative min-h-[180px] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                  <span>પ્રોટોકોલ ૧</span>
                  <RotateCw className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <h4 className="text-sm font-bold font-heading text-slate-900">
                  {flippedCards['sop1'] ? 'સત્તાવાર રસીકરણ નિયમ' : 'રસીકરણ યોગ્યતા (Eligibility)'}
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {flippedCards['sop1']
                    ? 'બીમાર કે તાવવાળા પશુને રસી આપવી નહીં. ગર્ભવતી પશુઓ માટે વેટરનરી અધિકારીની સલાહ ફરજિયાત છે.'
                    : 'તંદુરસ્ત પશુઓની જ રસીકરણ માટે પસંદગી કરવી. કાનમાં ટૅગ નંબર અનિવાર્ય છે.'}
                </p>
              </div>
              <div className="text-[10px] text-emerald-800 font-bold">
                {flippedCards['sop1'] ? '← પાછા ફરો' : 'વિગત જોવા ક્લિક કરો →'}
              </div>
            </div>

            {/* Card 2 */}
            <div
              onClick={() => toggleFlip('sop2')}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-2xs hover:shadow-md transition-all cursor-pointer relative min-h-[180px] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                  <span>પ્રોટોકોલ ૨</span>
                  <RotateCw className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <h4 className="text-sm font-bold font-heading text-slate-900">
                  {flippedCards['sop2'] ? 'કોલ્ડ ચેઈન સ્ટાન્ડર્ડ' : 'તાપમાન જાળવણી (2°C - 8°C)'}
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {flippedCards['sop2']
                    ? 'રસી બોટલ સીધા સૂર્યપ્રકાશમાં ન રાખવી. આઇસ પેક વાળા વેક્સિન કેરિયરમાં જ ક્ષેત્રમાં લઈ જવી.'
                    : 'વેક્સિન સ્ટોકનું તાપમાન ૨ થી ૮ ડિગ્રી સેલ્સિયસ વચ્ચે જ રહેવું જોઈએ.'}
                </p>
              </div>
              <div className="text-[10px] text-emerald-800 font-bold">
                {flippedCards['sop2'] ? '← પાછા ફરો' : 'વિગત જોવા ક્લિક કરો →'}
              </div>
            </div>

            {/* Card 3 */}
            <div
              onClick={() => toggleFlip('sop3')}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-2xs hover:shadow-md transition-all cursor-pointer relative min-h-[180px] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                  <span>પ્રોટોકોલ ૩</span>
                  <RotateCw className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <h4 className="text-sm font-bold font-heading text-slate-900">
                  {flippedCards['sop3'] ? 'ત્વરિત રોગ અહેવાલ' : 'શંકાસ્પદ રોગ રિપોર્ટિંગ'}
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {flippedCards['sop3']
                    ? 'લક્ષણો દેખાયાના ૨૪ કલાકમાં પોર્ટલ પર રોગ અહેવાલ નોંધવો જેથી અન્ય પશુઓમાં ફેલાવો અટકે.'
                    : 'મોં કે ખરીમાં ચાંદા, તીવ્ર લાળ કે ગાંઠો દેખાય તો તરત અહેવાલ મોકલો.'}
                </p>
              </div>
              <div className="text-[10px] text-emerald-800 font-bold">
                {flippedCards['sop3'] ? '← પાછા ફરો' : 'વિગત જોવા ક્લિક કરો →'}
              </div>
            </div>

            {/* Card 4 */}
            <div
              onClick={() => toggleFlip('sop4')}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-2xs hover:shadow-md transition-all cursor-pointer relative min-h-[180px] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                  <span>પ્રોટોકોલ ૪</span>
                  <RotateCw className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <h4 className="text-sm font-bold font-heading text-slate-900">
                  {flippedCards['sop4'] ? 'ડિજિટલ પ્રમાણપત્ર' : 'રસીકરણ પ્રમાણપત્ર (Certificate)'}
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {flippedCards['sop4']
                    ? 'ખેડૂત પોતાના મોબાઇલમાં ખેડૂત પોર્ટલથી રસીકરણ પ્રમાણપત્ર ગમે ત્યારે ડાઉનલોડ કરી શકે છે.'
                    : 'દરેક રસીકરણ પૂર્ણ થયા બાદ પશુના ટેગ સાથે કાયમી ડિજિટલ રેકોર્ડ બને છે.'}
                </p>
              </div>
              <div className="text-[10px] text-emerald-800 font-bold">
                {flippedCards['sop4'] ? '← પાછા ફરો' : 'વિગત જોવા ક્લિક કરો →'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------- */}
      {/* 7. CONTACT & EMERGENCY HELPLINE (1800-BOTAD & 1962)                   */}
      {/* ---------------------------------------------------------------------- */}
      <section id="contact" className="py-16 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-[#135D43] to-[#0A3828] rounded-3xl p-8 sm:p-12 text-white grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-xl">
            <div className="lg:col-span-6 space-y-4">
              <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider font-mono">
                સરકારી પશુપાલન સહાય કેન્દ્ર
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-white">
                પશુ આપાતકાલીન હેલ્પલાઇન અને સહાયતા
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed">
                કોઈપણ રોગચાળો, તાકીદની સારવાર કે રસીકરણ સહાય માટે અમારા ટોલ-ફ્રી નંબર પર તાત્કાલિક સંપર્ક કરો:
              </p>

              <div className="pt-2 space-y-3">
                <div className="flex items-center gap-3 p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/15">
                  <PhoneCall className="w-5 h-5 text-emerald-300 shrink-0" />
                  <div>
                    <div className="text-[10px] text-emerald-200">ટોલ ફ્રી વહીવટી હેલ્પલાઇન</div>
                    <div className="text-base font-bold font-mono text-white">1800-BOTAD (1800-26823)</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/15">
                  <Activity className="w-5 h-5 text-amber-300 shrink-0" />
                  <div>
                    <div className="text-[10px] text-amber-200">ગુજરાત પશુ સંજીવની એમ્બ્યુલન્સ</div>
                    <div className="text-base font-bold font-mono text-white">1962 (ટોલ ફ્રી ઈમરજન્સી)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Contact / Feedback Form */}
            <div className="lg:col-span-6 bg-white text-slate-800 rounded-2xl p-6 shadow-md">
              <h3 className="text-sm font-bold text-slate-900 font-heading mb-1">
                સહાય વિનંતી / પ્રશ્ન મોકલો
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                અમારી વેટરનરી ટીમ તમારા પ્રશ્નનો ઝડપથી નિકાલ કરશે.
              </p>

              {isSubmitted ? (
                <div className="p-6 text-center space-y-2 bg-emerald-50 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <div className="text-xs font-bold text-emerald-900">તમારી વિનંતી નોંધાઈ ગઈ છે!</div>
                  <p className="text-[11px] text-emerald-700">તાલુકા વેટરનરી અધિકારી ટૂંક સમયમાં સંપર્ક કરશે.</p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">આપનું પૂરું નામ *</label>
                      <input
                        type="text"
                        required
                        placeholder="દા.ત. રમેશભાઈ પટેલ"
                        value={contactForm.name}
                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#135D43]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">આપનો હોદ્દો / ભૂમિકા</label>
                      <select
                        value={contactForm.role}
                        onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#135D43]"
                      >
                        <option value="FARMER">પશુપાલક / ખેડૂત</option>
                        <option value="VO">વેટરનરી ઓફિસર</option>
                        <option value="FW">ફીલ્ડ વર્કર</option>
                        <option value="COOP">દૂધ મંડળી પ્રતિનિધિ</option>
                        <option value="OTHER">અન્ય નાગરિક</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">મોબાઇલ નંબર કે ઇમેઇલ</label>
                    <input
                      type="text"
                      placeholder="+91 98XXX XXXXX"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#135D43]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">આપનો સંદેશ / પ્રશ્ન *</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="પશુ રસીકરણ કે આરોગ્ય વિષયક પ્રશ્ન દાખલ કરો..."
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#135D43]"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-[#135D43] hover:bg-[#0E4632] text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    સંદેશ મોકલો (Submit Request)
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------- */}
      {/* 8. MODERN AGTECH GOVERNMENT FOOTER                                     */}
      {/* ---------------------------------------------------------------------- */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white">
                <div className="w-7 h-7 rounded-lg bg-[#135D43] flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-200" />
                </div>
                <span className="font-heading font-black text-base text-white">ANIVERA • પશુરક્ષક</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                પશુપાલન નિયામકની કચેરી, કૃષિ, ખેડૂત કલ્યાણ અને સહકાર વિભાગ, ગુજરાત સરકાર.
              </p>
              <div className="text-[10px] font-mono text-emerald-400">
                GOVERNMENT OF GUJARAT LIVESTOCK HEALTH
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-white uppercase tracking-wider font-heading">
                વિભાગીય પોર્ટલ્સ
              </div>
              <ul className="space-y-1.5 text-[11px]">
                <li>
                  <button onClick={() => navigate('/login')} className="hover:text-emerald-400 transition-colors">
                    સુપર એડમિન પોર્ટલ (State Admin)
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/login')} className="hover:text-emerald-400 transition-colors">
                    DAHO જિલ્લા કન્સોલ
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/login')} className="hover:text-emerald-400 transition-colors">
                    TAHO તાલુકા કન્સોલ
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/login')} className="hover:text-emerald-400 transition-colors">
                    વેટરનરી અધિકારી (VO) પોર્ટલ
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/farmer/login')} className="hover:text-emerald-400 transition-colors">
                    ખેડૂત / પશુપાલક પોર્ટલ (Farmer)
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-white uppercase tracking-wider font-heading">
                પ્રોટોકોલ & સેવાઓ
              </div>
              <ul className="space-y-1.5 text-[11px]">
                <li>FMD / બ્રુસેલોસિસ રસીકરણ ઝુંબેશ</li>
                <li>લમ્પી સ્કિન ડીસીઝ સર્વેક્ષણ</li>
                <li>ભારત પશુધન RFID/QR ટેગ સંકલન</li>
                <li>કોલ્ડ-ચેઈન વેક્સિન ડેપો મોનિટરિંગ</li>
                <li>ઓફલાઇન એજ સિંક્રોનાઇઝેશન</li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-white uppercase tracking-wider font-heading">
                સુરક્ષા & માર્ગદર્શન
              </div>
              <ul className="space-y-1.5 text-[11px]">
                <li>ભૂમિકા આધારિત ઍક્સેસ (RBAC Matrix)</li>
                <li>સુરક્ષા ઓડિટ લૉગ & એન્ક્રિપ્શન</li>
                <li>ટોલ-ફ્રી હેલ્પલાઇન: 1800-BOTAD</li>
                <li>પશુ સંજીવની એમ્બ્યુલન્સ: 1962</li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
            <div>
              © 2026 ANIVERA (PashuRakshak). પશુપાલન વિભાગ, ગુજરાત સરકાર. તમામ હકો અનામત.
            </div>
            <div className="flex items-center gap-4">
              <span>Security Audited</span>
              <span>•</span>
              <span>ISO 27001 Protocol</span>
              <span>•</span>
              <span>Made with ❤️ for Gujarat Farmers</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
