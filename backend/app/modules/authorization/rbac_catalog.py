"""RBAC Catalog: Canonical Roles, Permission Categories, and Initial Working Capabilities."""
from typing import Any, Dict, List, Set

def get_role_aliases(role: str) -> List[str]:
    """Map any canonical role or legacy role name to all its recognized equivalents."""
    norm = (role or "").strip().upper()
    if norm in ("SUPER_ADMIN", "SYS_ADMIN", "ADMIN"):
        return ["SUPER_ADMIN", "SYS_ADMIN", "ADMIN"]
    elif norm in ("VET_OFFICER", "VO"):
        return ["VET_OFFICER", "VO"]
    elif norm in ("FIELD_WORKER", "FW"):
        return ["FIELD_WORKER", "FW"]
    elif norm in ("COOPERATIVE", "DAIRY_STAFF", "COOP"):
        return ["COOPERATIVE", "DAIRY_STAFF", "COOP"]
    elif norm in ("TAHO", "TALUKA_OFFICER"):
        return ["TAHO", "TALUKA_OFFICER"]
    elif norm in ("GRAM_PANCHAYAT", "PANCHAYAT", "GP"):
        return ["GRAM_PANCHAYAT", "PANCHAYAT", "GP"]
    elif norm in ("FARMER",):
        return ["FARMER"]
    elif norm in ("DAHO",):
        return ["DAHO"]
    return [norm] if norm else []

ROLE_DEFINITIONS: List[Dict[str, Any]] = [
    {
        "code": "SUPER_ADMIN",
        "alias": "SYS_ADMIN",
        "name_en": "System Admin",
        "name_gu": "સિસ્ટમ એડમિન (સુપર એડમિન)",
        "badge_color": "purple",
        "geographic_scope_type": "STATE",
        "geographic_scope_desc": "સમગ્ર ગુજરાત રાજ્ય (Statewide)",
        "description": "રાજ્ય સ્તરે સંપૂર્ણ તકનીકી, ભૌગોલિક અને વહીવટી નિયંત્રણ."
    },
    {
        "code": "DAHO",
        "name_en": "District Animal Husbandry Officer",
        "name_gu": "જિલ્લા પશુપાલન અધિકારી (DAHO)",
        "badge_color": "emerald",
        "geographic_scope_type": "DISTRICT",
        "geographic_scope_desc": "અધિકૃત જિલ્લો (District Scope)",
        "description": "જિલ્લા સ્તરે વહીવટી, ઝુંબેશ મંજૂરી, રોગ દેખરેખ અને ડેરી મંડળી નિયંત્રણ."
    },
    {
        "code": "TAHO",
        "name_en": "Taluka Animal Husbandry Officer",
        "name_gu": "તાલુકા પશુપાલન અધિકારી (TAHO)",
        "badge_color": "blue",
        "geographic_scope_type": "TALUKA",
        "geographic_scope_desc": "અધિકૃત તાલુકો (Taluka Scope)",
        "description": "તાલુકા સ્તરે વેટરનરી સ્ટાફ સંકલન, રસીકરણ ઝુંબેશ અને કેસ ફાળવણી."
    },
    {
        "code": "VO",
        "alias": "VET_OFFICER",
        "name_en": "Veterinary Officer",
        "name_gu": "વેટરનરી ઓફિસર (VO)",
        "badge_color": "teal",
        "geographic_scope_type": "VILLAGE_GROUP",
        "geographic_scope_desc": "સોંપાયેલ સારવાર કેન્દ્રો અને ગામો",
        "description": "ક્ષેત્રીય રોગ નિદાન, સારવાર, રસી ચકાસણી અને પશુ આરોગ્ય કેમ્પ."
    },
    {
        "code": "FW",
        "alias": "FIELD_WORKER",
        "name_en": "Field Worker",
        "name_gu": "ફીલ્ડ વર્કર (FW)",
        "badge_color": "amber",
        "geographic_scope_type": "VILLAGES",
        "geographic_scope_desc": "સોંપાયેલ ગામો (Assigned Villages)",
        "description": "ઘર-ઘર જઈને પશુ નોંધણી, ટૅગિંગ, રસી આપનાર અને ક્ષેત્રીય ડેટા સંગ્રહ."
    },
    {
        "code": "COOPERATIVE",
        "alias": "DAIRY_STAFF",
        "name_en": "Dairy Cooperative",
        "name_gu": "ડેરી સહકારી મંડળી",
        "badge_color": "indigo",
        "geographic_scope_type": "COOP_VILLAGES",
        "geographic_scope_desc": "મંડળી સંલગ્ન ગામો",
        "description": "દૂધ ઉત્પાદક સહકારી મંડળી સંચાલન, સભાસદ ખેડૂત પશુધન રસીકરણ."
    },
    {
        "code": "FARMER",
        "name_en": "Farmer / Livestock Owner",
        "name_gu": "પશુપાલક / ખેડૂત",
        "badge_color": "green",
        "geographic_scope_type": "SELF",
        "geographic_scope_desc": "પોતાનું પશુધન (Registered Animals)",
        "description": "પોતાના પશુધનનું રક્ષણ, રોગ અહેવાલ, સારવાર ટ્રેકિંગ અને સેવા વિનંતી."
    },
    {
        "code": "GRAM_PANCHAYAT",
        "name_en": "Gram Panchayat",
        "name_gu": "ગ્રામ પંચાયત",
        "badge_color": "slate",
        "geographic_scope_type": "VILLAGE",
        "geographic_scope_desc": "પંચાયત અધિકારક્ષેત્ર ગામ",
        "description": "ગામ સ્તરે રસીકરણ ઝુંબેશ જાગૃતિ, પ્રગતિ દેખરેખ અને સમુદાય સહયોગ."
    }
]

PERMISSION_CATEGORIES: List[Dict[str, Any]] = [
    {
        "id": "geo_gis",
        "name_en": "Geographic & GIS Management",
        "name_gu": "ભૌગોલિક અને GIS સંચાલન",
        "icon": "MapPin",
        "permissions": [
            {"code": "geo.state.manage", "name_en": "State boundary management", "name_gu": "રાજ્ય સીમા સંચાલન", "desc": "Manage Gujarat state geographic boundaries and master parameters"},
            {"code": "geo.district.manage", "name_en": "District boundary management", "name_gu": "જિલ્લા સીમા સંચાલન", "desc": "Manage district boundaries, assignment definitions and jurisdictions"},
            {"code": "geo.taluka.manage", "name_en": "Taluka boundary management", "name_gu": "તાલુકા સીમા સંચાલન", "desc": "Manage taluka geographic boundaries and taluka mappings"},
            {"code": "geo.village.manage", "name_en": "Village boundary management", "name_gu": "ગામ સીમા સંચાલન", "desc": "Manage village boundaries, revenue codes and assignment links"},
            {"code": "map.view", "name_en": "GIS map viewing", "name_gu": "GIS નકશો જોવો", "desc": "View state, district, taluka, and village level spatial layers"},
            {"code": "map.manage", "name_en": "GIS data management", "name_gu": "GIS ડેટા સંચાલન", "desc": "Import, validate, and publish GIS vector and raster data"}
        ]
    },
    {
        "id": "user_staff",
        "name_en": "User & Staff Management",
        "name_gu": "વપરાશકર્તા અને સ્ટાફ સંચાલન",
        "icon": "Users",
        "permissions": [
            {"code": "user.daho.create", "name_en": "Create DAHO", "name_gu": "DAHO ની રચના", "desc": "Create and onboard District Animal Husbandry Officers"},
            {"code": "user.taho.create", "name_en": "Create TAHO", "name_gu": "TAHO ની રચના", "desc": "Create and onboard Taluka Animal Husbandry Officers"},
            {"code": "user.vo.create", "name_en": "Create VO", "name_gu": "VO ની રચના", "desc": "Create and assign Veterinary Officers"},
            {"code": "user.fw.create", "name_en": "Create FW", "name_gu": "FW ની રચના", "desc": "Create and assign Field Workers / Livestock Inspectors"},
            {"code": "user.staff.manage", "name_en": "Manage staff", "name_gu": "સ્ટાફ સંચાલન", "desc": "Update staff profiles, contact numbers, and credentials"},
            {"code": "user.role.assign", "name_en": "Assign roles", "name_gu": "ભૂમિકા સોંપણી", "desc": "Assign and reassign roles to system users"},
            {"code": "user.status.manage", "name_en": "Activate/deactivate users", "name_gu": "વપરાશકર્તા સક્રિય/નિષ્ક્રિય", "desc": "Change user operational status (ACTIVE/INACTIVE/SUSPENDED)"}
        ]
    },
    {
        "id": "campaign",
        "name_en": "Campaign Management",
        "name_gu": "ઝુંબેશ સંચાલન",
        "icon": "Megaphone",
        "permissions": [
            {"code": "campaign.create", "name_en": "Create campaign", "name_gu": "ઝુંબેશ બનાવો", "desc": "Initiate new mass vaccination or tagging campaigns"},
            {"code": "campaign.edit", "name_en": "Edit campaign", "name_gu": "ઝુંબેશ સંપાદિત કરો", "desc": "Update campaign targets, dates, and village scope"},
            {"code": "campaign.assign", "name_en": "Assign campaign", "name_gu": "ઝુંબેશ સોંપણી", "desc": "Assign campaign responsibilities to talukas, VOs and FWs"},
            {"code": "campaign.approve", "name_en": "Approve campaign", "name_gu": "ઝુંબેશ મંજૂર કરો", "desc": "Authorize and activate scheduled campaigns"},
            {"code": "campaign.monitor", "name_en": "Monitor campaign", "name_gu": "ઝુંબેશ દેખરેખ", "desc": "Monitor campaign coverage, progress and daily target tracking"},
            {"code": "campaign.close", "name_en": "Close campaign", "name_gu": "ઝુંબેશ પૂર્ણ કરો", "desc": "Formally conclude and archive completed campaigns"}
        ]
    },
    {
        "id": "animal_farmer",
        "name_en": "Animal & Farmer Management",
        "name_gu": "પશુ અને ખેડૂત સંચાલન",
        "icon": "PawPrint",
        "permissions": [
            {"code": "animal.register", "name_en": "Register animal", "name_gu": "પશુ નોંધણી", "desc": "Register cattle, buffalo, sheep and goats with tag numbers"},
            {"code": "farmer.register", "name_en": "Register farmer", "name_gu": "ખેડૂત નોંધણી", "desc": "Onboard and verify livestock owners in villages"},
            {"code": "animal.view", "name_en": "View animal records", "name_gu": "પશુ રેકોર્ડ જોવો", "desc": "Access animal lifecycle, breed, sex and vaccination history"},
            {"code": "animal.edit", "name_en": "Edit authorized animal information", "name_gu": "પશુ વિગતો સુધારો", "desc": "Update animal details, tag replacements, and status"},
            {"code": "farmer.view", "name_en": "View farmer records", "name_gu": "ખેડૂત રેકોર્ડ જોવો", "desc": "Access farmer profile, holdings, and contact info"},
            {"code": "animal.status.manage", "name_en": "Manage animal status", "name_gu": "પશુ સ્થિતિ સંચાલન", "desc": "Mark animal as active, sold, transferred, or deceased"}
        ]
    },
    {
        "id": "vaccination",
        "name_en": "Vaccination Management",
        "name_gu": "રસીકરણ સંચાલન",
        "icon": "Syringe",
        "permissions": [
            {"code": "vaccination.create", "name_en": "Create vaccination records", "name_gu": "રસીકરણ નોંધણી", "desc": "Record administered vaccines, batch numbers, and dates"},
            {"code": "vaccination.history.view", "name_en": "View vaccination history", "name_gu": "રસીકરણ ઇતિહાસ જોવો", "desc": "Inspect prior immunization records for animals and herds"},
            {"code": "vaccination.campaign.manage", "name_en": "Vaccination campaign management", "name_gu": "રસીકરણ ઝુંબેશ વહીવટ", "desc": "Manage field vaccination operations and team logistics"},
            {"code": "vaccination.verify", "name_en": "Verify vaccination records", "name_gu": "રસીકરણ ચકાસણી", "desc": "Authorize and verify entered vaccination events"},
            {"code": "vaccination.reminders.manage", "name_en": "Manage vaccination reminders", "name_gu": "રસીકરણ રિમાઇન્ડર વહીવટ", "desc": "Schedule booster alerts and automated farmer reminders"}
        ]
    },
    {
        "id": "surveillance",
        "name_en": "Disease Surveillance & Treatment",
        "name_gu": "રોગ સર્વેલન્સ અને સારવાર",
        "icon": "Activity",
        "permissions": [
            {"code": "disease.report", "name_en": "Disease reporting", "name_gu": "રોગ અહેવાલ નોંધણી", "desc": "Report suspected disease outbreaks, symptoms, and cases"},
            {"code": "disease.case.assign", "name_en": "Assign disease cases", "name_gu": "રોગ કેસ સોંપણી", "desc": "Dispatch investigation duty to veterinary staff"},
            {"code": "disease.investigation.record", "name_en": "Record investigation", "name_gu": "તપાસ નોંધણી", "desc": "Document clinical symptoms, sample collection, and post-mortem"},
            {"code": "disease.treatment.record", "name_en": "Record treatment", "name_gu": "સારવાર નોંધણી", "desc": "Log medications, vaccines, and treatment protocols administered"},
            {"code": "disease.treatment.verify", "name_en": "Verify treatment", "name_gu": "સારવાર ચકાસણી", "desc": "Confirm clinical recovery and outcome verification"},
            {"code": "disease.case.close", "name_en": "Close disease case", "name_gu": "રોગ કેસ પૂર્ણ કરો", "desc": "Officially close resolved or contained disease alerts"}
        ]
    },
    {
        "id": "cooperative",
        "name_en": "Dairy Cooperative Management",
        "name_gu": "ડેરી સહકારી મંડળી સંચાલન",
        "icon": "Building2",
        "permissions": [
            {"code": "coop.create", "name_en": "Create cooperative", "name_gu": "મંડળી બનાવો", "desc": "Register new dairy cooperative societies and societies code"},
            {"code": "coop.manage", "name_en": "Manage cooperative", "name_gu": "મંડળી સંચાલન", "desc": "Update cooperative details, staff coordinators and portal access"},
            {"code": "coop.villages.manage", "name_en": "Manage cooperative villages", "name_gu": "સંલગ્ન ગામ સંચાલન", "desc": "Assign non-overlapping villages to milk collection societies"},
            {"code": "coop.schedules.create", "name_en": "Create recurring vaccination schedules", "name_gu": "નિયમિત રસીકરણ સમયપત્રક", "desc": "Propose cyclic vaccination drives for member cattle"},
            {"code": "coop.schedules.approve", "name_en": "Approve cooperative schedules", "name_gu": "મંડળી સમયપત્રક મંજૂર", "desc": "DAHO/TAHO approval for cooperative-organized drives"},
            {"code": "coop.monitor", "name_en": "Monitor cooperative activities", "name_gu": "મંડળી પ્રવૃત્તિ મોનિટરિંગ", "desc": "Review milk yield coverage and vaccination compliance"}
        ]
    },
    {
        "id": "panchayat",
        "name_en": "Gram Panchayat Management",
        "name_gu": "ગ્રામ પંચાયત સંચાલન",
        "icon": "Layers",
        "permissions": [
            {"code": "panchayat.reports.view", "name_en": "View village reports", "name_gu": "ગામ અહેવાલો જુઓ", "desc": "Inspect village-level animal census and disease reports"},
            {"code": "panchayat.campaigns.monitor", "name_en": "Monitor village campaigns", "name_gu": "ગામ ઝુંબેશ મોનિટરિંગ", "desc": "Track ongoing vaccination progress in the village jurisdiction"},
            {"code": "panchayat.progress.view", "name_en": "View aggregate vaccination progress", "name_gu": "કુલ રસીકરણ પ્રગતિ", "desc": "Review herd immunity levels and pending livestock"}
        ]
    },
    {
        "id": "reports",
        "name_en": "Reports & Analytics",
        "name_gu": "અહેવાલો અને પૃથ્થકરણ",
        "icon": "BarChart3",
        "permissions": [
            {"code": "reports.district", "name_en": "District reports", "name_gu": "જિલ્લા અહેવાલો", "desc": "Generate and view district consolidation reports"},
            {"code": "reports.taluka", "name_en": "Taluka reports", "name_gu": "તાલુકા અહેવાલો", "desc": "Generate and view taluka level performance summaries"},
            {"code": "reports.village", "name_en": "Village reports", "name_gu": "ગામ અહેવાલો", "desc": "Generate village vaccination and disease summaries"},
            {"code": "reports.analytics.disease", "name_en": "Disease analytics", "name_gu": "રોગ પૃથ્થકરણ", "desc": "Analyze early-warning trends, hotspots and mortality stats"},
            {"code": "reports.analytics.vaccination", "name_en": "Vaccination analytics", "name_gu": "રસીકરણ પૃથ્થકરણ", "desc": "Analyze coverage percentage, drop-off rates, and cold chain"},
            {"code": "reports.export", "name_en": "Export reports", "name_gu": "અહેવાલો એક્સપોર્ટ", "desc": "Export official PDF, Excel, and CSV datasets"}
        ]
    },
    {
        "id": "system",
        "name_en": "System & Security",
        "name_gu": "સિસ્ટમ અને સુરક્ષા",
        "icon": "ShieldCheck",
        "permissions": [
            {"code": "system.permissions.manage", "name_en": "Manage permissions", "name_gu": "પરવાનગી સંચાલન", "desc": "Configure individual permission definitions and grants"},
            {"code": "system.roles.manage", "name_en": "Manage roles", "name_gu": "ભૂમિકા સંચાલન", "desc": "Configure role-permission matrix and security policies"},
            {"code": "system.logs.view", "name_en": "View access logs", "name_gu": "ઍક્સેસ લૉગ્સ જુઓ", "desc": "Audit access events, role assignments, and security operations"},
            {"code": "system.settings.manage", "name_en": "Manage system settings", "name_gu": "સિસ્ટમ સેટિંગ્સ સંચાલન", "desc": "Manage integration keys, thresholds, and operational flags"}
        ]
    }
]

ALL_PERMISSION_CODES: List[str] = [
    p["code"] for cat in PERMISSION_CATEGORIES for p in cat["permissions"]
]

# Baseline Capabilities Matching Current App Implementation (Section 5)
DEFAULT_ROLE_CAPABILITIES: Dict[str, List[str]] = {
    "SUPER_ADMIN": [
        "geo.state.manage", "geo.district.manage", "geo.taluka.manage", "geo.village.manage", "map.view", "map.manage",
        "user.daho.create", "user.taho.create", "user.vo.create", "user.fw.create", "user.staff.manage", "user.role.assign", "user.status.manage",
        "campaign.monitor",
        "animal.view", "farmer.view",
        "reports.district", "reports.taluka", "reports.village", "reports.analytics.disease", "reports.analytics.vaccination", "reports.export",
        "system.permissions.manage", "system.roles.manage", "system.logs.view", "system.settings.manage"
    ],
    "SYS_ADMIN": [
        "geo.state.manage", "geo.district.manage", "geo.taluka.manage", "geo.village.manage", "map.view", "map.manage",
        "user.daho.create", "user.taho.create", "user.vo.create", "user.fw.create", "user.staff.manage", "user.role.assign", "user.status.manage",
        "campaign.monitor", "animal.view", "farmer.view",
        "reports.district", "reports.taluka", "reports.village", "reports.analytics.disease", "reports.analytics.vaccination", "reports.export",
        "system.permissions.manage", "system.roles.manage", "system.logs.view", "system.settings.manage"
    ],
    "DAHO": [
        "geo.district.manage", "map.view",
        "user.taho.create", "user.vo.create", "user.fw.create", "user.staff.manage", "user.status.manage",
        "campaign.create", "campaign.edit", "campaign.assign", "campaign.approve", "campaign.monitor", "campaign.close",
        "animal.view", "farmer.view",
        "vaccination.history.view", "vaccination.campaign.manage", "vaccination.verify",
        "disease.report", "disease.case.assign", "disease.investigation.record", "disease.treatment.verify", "disease.case.close",
        "coop.create", "coop.manage", "coop.villages.manage", "coop.schedules.approve", "coop.monitor",
        "reports.district", "reports.taluka", "reports.village", "reports.analytics.disease", "reports.analytics.vaccination", "reports.export"
    ],
    "TAHO": [
        "map.view",
        "user.vo.create", "user.fw.create", "user.staff.manage", "user.status.manage",
        "campaign.create", "campaign.edit", "campaign.assign", "campaign.monitor",
        "animal.view", "farmer.view",
        "vaccination.history.view", "vaccination.campaign.manage",
        "disease.report", "disease.case.assign",
        "reports.taluka", "reports.village", "reports.analytics.disease", "reports.analytics.vaccination", "reports.export"
    ],
    "VET_OFFICER": [
        "map.view", "user.staff.manage", "campaign.monitor",
        "animal.register", "farmer.register", "animal.view", "animal.edit", "farmer.view", "animal.status.manage",
        "vaccination.create", "vaccination.history.view", "vaccination.verify", "vaccination.reminders.manage",
        "disease.report", "disease.investigation.record", "disease.treatment.record", "disease.treatment.verify", "disease.case.close",
        "coop.monitor", "reports.village", "reports.analytics.disease", "reports.analytics.vaccination", "reports.export"
    ],
    "VO": [
        "map.view", "user.staff.manage", "campaign.monitor",
        "animal.register", "farmer.register", "animal.view", "animal.edit", "farmer.view", "animal.status.manage",
        "vaccination.create", "vaccination.history.view", "vaccination.verify", "vaccination.reminders.manage",
        "disease.report", "disease.investigation.record", "disease.treatment.record", "disease.treatment.verify", "disease.case.close",
        "coop.monitor", "reports.village", "reports.analytics.disease", "reports.analytics.vaccination", "reports.export"
    ],
    "FIELD_WORKER": [
        "map.view", "campaign.monitor",
        "animal.register", "farmer.register", "animal.view", "farmer.view",
        "vaccination.create", "vaccination.history.view",
        "disease.report", "disease.treatment.record",
        "reports.village"
    ],
    "FW": [
        "map.view", "campaign.monitor",
        "animal.register", "farmer.register", "animal.view", "farmer.view",
        "vaccination.create", "vaccination.history.view",
        "disease.report", "disease.treatment.record",
        "reports.village"
    ],
    "COOPERATIVE": [
        "map.view", "campaign.monitor",
        "animal.view", "farmer.view", "vaccination.history.view",
        "coop.manage", "coop.schedules.create", "coop.monitor",
        "reports.village", "reports.analytics.vaccination"
    ],
    "DAIRY_STAFF": [
        "map.view", "campaign.monitor",
        "animal.view", "farmer.view", "vaccination.history.view",
        "coop.manage", "coop.schedules.create", "coop.monitor",
        "reports.village", "reports.analytics.vaccination"
    ],
    "FARMER": [
        "animal.register", "animal.view", "vaccination.history.view", "disease.report"
    ],
    "GRAM_PANCHAYAT": [
        "map.view", "campaign.monitor",
        "panchayat.reports.view", "panchayat.campaigns.monitor", "panchayat.progress.view",
        "reports.village", "reports.analytics.vaccination"
    ]
}

# Bidirectional compatibility mapping between Matrix Canonical permissions and domain service permission checks
PERMISSION_COMPATIBILITY_MAP: Dict[str, Set[str]] = {
    # GIS
    "map.view": {"map.view"},
    "map.manage": {"map.manage"},
    "geo.state.manage": {"geo.state.manage", "geography.manage"},
    "geo.district.manage": {"geo.district.manage", "district.manage", "district.setup.manage", "geography.manage"},
    "geo.taluka.manage": {"geo.taluka.manage", "taluka.manage"},
    "geo.village.manage": {"geo.village.manage", "village.manage"},

    # Users & Staff
    "user.daho.create": {"user.daho.create", "daho.manage", "user.manage"},
    "user.taho.create": {"user.taho.create", "user.manage"},
    "user.vo.create": {"user.vo.create", "veterinary_officer.manage", "user.manage"},
    "user.fw.create": {"user.fw.create", "field_worker.manage", "user.manage"},
    "user.staff.manage": {"user.staff.manage", "user.manage"},
    "user.role.assign": {"user.role.assign", "user.manage", "assignment.manage"},
    "user.status.manage": {"user.status.manage", "user.manage"},

    # Campaigns
    "campaign.create": {"campaign.create", "campaign.manage", "campaign.configure"},
    "campaign.edit": {"campaign.edit", "campaign.manage", "campaign.configure"},
    "campaign.assign": {"campaign.assign", "campaign.assign_workers", "campaign.manage"},
    "campaign.approve": {"campaign.approve", "campaign.manage"},
    "campaign.monitor": {"campaign.monitor", "campaign.view", "campaign.view_assigned", "campaign.read"},
    "campaign.close": {"campaign.close", "campaign.manage"},

    # Animal & Farmer
    "animal.register": {"animal.register", "animal.create", "event.create"},
    "animal.view": {"animal.view", "animal.read", "own.read", "aggregate.view", "event.read"},
    "animal.edit": {"animal.edit", "animal.verify"},
    "animal.status.manage": {"animal.status.manage", "animal.edit"},
    "farmer.register": {"farmer.register", "farmer.create"},
    "farmer.view": {"farmer.view", "farmer.read", "own.read"},

    # Vaccination
    "vaccination.create": {"vaccination.create", "vaccination.record", "event.create"},
    "vaccination.history.view": {"vaccination.history.view", "vaccination.read", "event.read", "own.read"},
    "vaccination.campaign.manage": {"vaccination.campaign.manage", "campaign.manage"},
    "vaccination.verify": {"vaccination.verify", "vaccinator.approve"},
    "vaccination.reminders.manage": {"vaccination.reminders.manage"},

    # Surveillance
    "disease.report": {"disease.report"},
    "disease.case.assign": {"disease.case.assign", "disease.review"},
    "disease.investigation.record": {"disease.investigation.record", "disease.review", "disease.read"},
    "disease.treatment.record": {"disease.treatment.record", "disease.review", "event.create"},
    "disease.treatment.verify": {"disease.treatment.verify", "disease.review", "disease.confirm"},
    "disease.case.close": {"disease.case.close", "disease.confirm"},

    # Cooperative
    "coop.create": {"coop.create", "cooperative.manage"},
    "coop.manage": {"coop.manage", "cooperative.manage"},
    "coop.villages.manage": {"coop.villages.manage", "cooperative.manage"},
    "coop.schedules.create": {"coop.schedules.create", "camp.propose"},
    "coop.schedules.approve": {"coop.schedules.approve", "camp.manage"},
    "coop.monitor": {"coop.monitor", "aggregate.view", "camp.view"},

    # Reports & System
    "reports.district": {"reports.district", "aggregate.view", "export.run"},
    "reports.taluka": {"reports.taluka", "aggregate.view", "export.run"},
    "reports.village": {"reports.village", "aggregate.view", "export.run"},
    "reports.analytics.disease": {"reports.analytics.disease", "disease.read", "aggregate.view"},
    "reports.analytics.vaccination": {"reports.analytics.vaccination", "vaccination.read", "aggregate.view"},
    "reports.export": {"reports.export", "export.run"},
    "system.permissions.manage": {"system.permissions.manage", "technical.manage"},
    "system.roles.manage": {"system.roles.manage", "technical.manage"},
    "system.logs.view": {"system.logs.view", "audit.read"},
    "system.settings.manage": {"system.settings.manage", "technical.manage"},
}

def expand_permissions(perms: Set[str]) -> Set[str]:
    """Expand granted permission codes with equivalent legacy/domain capabilities."""
    expanded = set(perms)
    for p in perms:
        if p in PERMISSION_COMPATIBILITY_MAP:
            expanded.update(PERMISSION_COMPATIBILITY_MAP[p])
    for canonical, equivalents in PERMISSION_COMPATIBILITY_MAP.items():
        if any(eq in perms for eq in equivalents):
            expanded.add(canonical)
            expanded.update(equivalents)
    return expanded
