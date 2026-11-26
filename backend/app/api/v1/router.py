"""Central API v1 router aggregations."""
from fastapi import APIRouter
from app.api.v1.endpoints import health
from app.modules.administration.endpoints import router as admin_router
from app.modules.animals.endpoints import router as animals_router
from app.modules.authentication.endpoints import router as auth_router
from app.modules.authorization.endpoints import router as rbac_router
from app.modules.campaigns.endpoints import router as campaigns_router
from app.modules.camps.endpoints import router as camps_router
from app.modules.disease_surveillance.endpoints import router as disease_router
from app.modules.farmers.endpoints import router as farmers_router
from app.modules.inventory.endpoints import router as inventory_router
from app.modules.notifications.endpoints import router as notifications_router
from app.modules.sync.endpoints import router as sync_router
from app.modules.vaccinations.endpoints import router as vaccinations_router
from app.modules.technical.endpoints import router as technical_router
from app.modules.reports.endpoints import router as reports_router
from app.modules.reports.analytics_endpoints import router as analytics_router
from app.modules.maps.endpoints import router as maps_router
from app.modules.duty.endpoints import router as duty_router
from app.modules.translation.endpoints import router as translation_router
from app.modules.administration.cooperative_portal_endpoints import router as coop_portal_router
from app.modules.health_cases.endpoints import router as health_cases_router
from app.modules.master_data.endpoints import router as master_data_router

api_router = APIRouter()

# Include health endpoints
api_router.include_router(health.router, tags=["system"])

# Include Animal, Disease and Vaccine Master Data under /master
api_router.include_router(master_data_router, prefix="/master", tags=["Animal & Disease Masters"])

# Include authentication endpoints under /auth
api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])

# Include authorization and RBAC endpoints under /rbac
api_router.include_router(rbac_router, tags=["Authorization & RBAC"])

# Include administrative management endpoints under /administration
api_router.include_router(admin_router, prefix="/administration", tags=["Administrative Management"])

# Include farmer management endpoints under /farmers
api_router.include_router(farmers_router, prefix="/farmers", tags=["Farmer Management"])

# Include animal management endpoints under /animals
api_router.include_router(animals_router, prefix="/animals", tags=["Animal Management"])

# Include campaign management endpoints under /campaigns
api_router.include_router(campaigns_router, prefix="/campaigns", tags=["Campaign Management"])

# Include veterinary camps endpoints under /veterinary-camps and /camps
api_router.include_router(camps_router, prefix="/veterinary-camps", tags=["Veterinary Camps"])
api_router.include_router(camps_router, prefix="/camps", tags=["Veterinary Camps"])

# Include vaccine inventory endpoints under /vaccine-inventory
api_router.include_router(inventory_router, prefix="/vaccine-inventory", tags=["Vaccine Inventory Management"])

# Include vaccination & animal health events under /vaccinations
api_router.include_router(vaccinations_router, prefix="/vaccinations", tags=["Vaccination & Animal Events"])

# Include disease surveillance endpoints under /disease-reports
api_router.include_router(disease_router, prefix="/disease-reports", tags=["Disease Surveillance & Early Warning"])

# Include offline synchronization endpoints under /sync
api_router.include_router(sync_router, prefix="/sync", tags=["Offline Synchronisation"])

# Include in-app notifications endpoints under /notifications
api_router.include_router(notifications_router, prefix="/notifications", tags=["In-App Notifications"])

# Include technical administration endpoints under /technical
api_router.include_router(technical_router, prefix="/technical", tags=["Technical Administration"])

# Include reports and analytics endpoints under /reports
api_router.include_router(reports_router, prefix="/reports", tags=["Reports & Analytics"])

# Include dedicated inference analytics endpoints under /analytics and /reports/analytics
api_router.include_router(analytics_router, prefix="/analytics", tags=["Inference & Analytics"])
api_router.include_router(analytics_router, prefix="/reports/analytics", tags=["Inference & Analytics"])

# Include geospatial and map endpoints under /maps
api_router.include_router(maps_router, prefix="/maps", tags=["Geospatial & Maps"])

# Include duty management, live tracking, and smart complaint assignments under /duty
api_router.include_router(duty_router, prefix="/duty", tags=["Duty & Smart Location Tracking"])

# Include dynamic content translation endpoint under /translation
api_router.include_router(translation_router, prefix="/translation", tags=["Dynamic Translation"])

# Include Dairy Cooperative Portal endpoints under /cooperative
api_router.include_router(coop_portal_router, prefix="/cooperative", tags=["Dairy Cooperative Portal"])

# Include Connected Animal Health, TAHO Assignment, Treatment & Recurring Schedules under /health-cases
api_router.include_router(health_cases_router, tags=["Connected Health & Recurring Vaccination Workflows"])





