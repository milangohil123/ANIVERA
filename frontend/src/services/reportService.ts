/**
 * PashuRakshak Botad — Reports & Safe Exports API Client.
 *
 * Implements:
 * - Scoped operational reports (Campaign Coverage, Inventory, Surveillance, Registry, Staff Activity).
 * - Safe formula-neutralized CSV downloads.
 * - DD/MM/YYYY date filtering.
 */

export interface CampaignCoverageReportItem {
  campaignId: string;
  campaignName: string;
  villageId: string;
  villageNameGu: string;
  programmeCode: string;
  eligibleCount: number;
  coveredCount: number;
  targetConfigured: boolean;
  note: string;
}

export interface InventoryReportItem {
  lotId: string;
  productCode: string;
  productName: string;
  programmeCode?: string;
  batchNumber: string;
  receivedDoses: number;
  issuedDoses: number;
  adjustedDoses: number;
  currentBalance: number;
  expiryDate?: string;
}

export interface SurveillanceReportItem {
  villageId: string;
  villageNameGu: string;
  diseaseCode: string;
  suspectedCount: number;
  confirmedCount: number;
  notConfirmedCount: number;
  insufficientCount: number;
  latestReportDate?: string;
  dataFreshnessStatus: string;
}

export interface RegistryCountsReportItem {
  villageId: string;
  villageNameGu: string;
  farmerCount: number;
  cattleCount: number;
  buffaloCount: number;
  goatCount: number;
  sheepCount: number;
  totalAnimals: number;
  verifiedAnimals: number;
}

export interface StaffActivityReportItem {
  staffUserId: string;
  staffName: string;
  role: string;
  registrationsCount: number;
  vaccinationsCount: number;
  diseaseReportsCount: number;
}

export interface CoopProgressReportItem {
  villageId: string;
  villageNameGu: string;
  totalAnimals: number;
  vaccinatedCount: number;
  pendingCount: number;
}

export interface ExportLogItem {
  id: string;
  exportType: string;
  filters?: Record<string, any>;
  purpose: string;
  rowCount?: number;
  formulaSafe: boolean;
  createdAt: string;
}

async function downloadBlob(res: Response, defaultFilename: string) {
  if (!res.ok) {
    throw new Error(`Export failed: HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  const disposition = res.headers.get('content-disposition');
  let filename = defaultFilename;
  if (disposition && disposition.indexOf('filename=') !== -1) {
    const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
    if (matches?.[1]) {
      filename = matches[1].replace(/['"]/g, '');
    }
  }

  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export const reportService = {
  // 1. Campaign Coverage
  async getCampaignCoverage(
    apiBaseUrl: string,
    token: string,
    campaignId?: string,
    villageId?: string
  ): Promise<CampaignCoverageReportItem[]> {
    const params = new URLSearchParams();
    if (campaignId) params.append('campaign_id', campaignId);
    if (villageId) params.append('village_id', villageId);

    const res = await fetch(`${apiBaseUrl}/api/v1/reports/campaign-coverage?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to load campaign coverage: HTTP ${res.status}`);
    return res.json();
  },

  async downloadCampaignCoverageCsv(
    apiBaseUrl: string,
    token: string,
    campaignId?: string,
    villageId?: string
  ): Promise<void> {
    const params = new URLSearchParams();
    if (campaignId) params.append('campaign_id', campaignId);
    if (villageId) params.append('village_id', villageId);

    const res = await fetch(`${apiBaseUrl}/api/v1/reports/campaign-coverage/csv?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await downloadBlob(res, `campaign_coverage_${Date.now()}.csv`);
  },

  // 2. Inventory
  async getInventory(
    apiBaseUrl: string,
    token: string,
    districtId?: string
  ): Promise<InventoryReportItem[]> {
    const params = new URLSearchParams();
    if (districtId) params.append('district_id', districtId);

    const res = await fetch(`${apiBaseUrl}/api/v1/reports/inventory?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to load inventory report: HTTP ${res.status}`);
    return res.json();
  },

  async downloadInventoryCsv(
    apiBaseUrl: string,
    token: string,
    districtId?: string
  ): Promise<void> {
    const params = new URLSearchParams();
    if (districtId) params.append('district_id', districtId);

    const res = await fetch(`${apiBaseUrl}/api/v1/reports/inventory/csv?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await downloadBlob(res, `vaccine_inventory_${Date.now()}.csv`);
  },

  // 3. Surveillance
  async getSurveillance(
    apiBaseUrl: string,
    token: string,
    diseaseCode?: string,
    villageId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<SurveillanceReportItem[]> {
    const params = new URLSearchParams();
    if (diseaseCode) params.append('disease_code', diseaseCode);
    if (villageId) params.append('village_id', villageId);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const res = await fetch(`${apiBaseUrl}/api/v1/reports/surveillance?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to load surveillance report: HTTP ${res.status}`);
    return res.json();
  },

  async downloadSurveillanceCsv(
    apiBaseUrl: string,
    token: string,
    diseaseCode?: string,
    villageId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<void> {
    const params = new URLSearchParams();
    if (diseaseCode) params.append('disease_code', diseaseCode);
    if (villageId) params.append('village_id', villageId);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const res = await fetch(`${apiBaseUrl}/api/v1/reports/surveillance/csv?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await downloadBlob(res, `surveillance_${Date.now()}.csv`);
  },

  // 4. Registry Counts
  async getRegistryCounts(
    apiBaseUrl: string,
    token: string,
    villageId?: string
  ): Promise<RegistryCountsReportItem[]> {
    const params = new URLSearchParams();
    if (villageId) params.append('village_id', villageId);

    const res = await fetch(`${apiBaseUrl}/api/v1/reports/registry-counts?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to load registry report: HTTP ${res.status}`);
    return res.json();
  },

  async downloadRegistryCsv(
    apiBaseUrl: string,
    token: string,
    villageId?: string
  ): Promise<void> {
    const params = new URLSearchParams();
    if (villageId) params.append('village_id', villageId);

    const res = await fetch(`${apiBaseUrl}/api/v1/reports/registry-counts/csv?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await downloadBlob(res, `registry_counts_${Date.now()}.csv`);
  },

  // 5. Staff Activity
  async getStaffActivity(
    apiBaseUrl: string,
    token: string,
    roleFilter?: string,
    startDate?: string,
    endDate?: string
  ): Promise<StaffActivityReportItem[]> {
    const params = new URLSearchParams();
    if (roleFilter) params.append('role_filter', roleFilter);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const res = await fetch(`${apiBaseUrl}/api/v1/reports/staff-activity?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to load staff activity: HTTP ${res.status}`);
    return res.json();
  },

  async downloadStaffActivityCsv(
    apiBaseUrl: string,
    token: string,
    roleFilter?: string,
    startDate?: string,
    endDate?: string
  ): Promise<void> {
    const params = new URLSearchParams();
    if (roleFilter) params.append('role_filter', roleFilter);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const res = await fetch(`${apiBaseUrl}/api/v1/reports/staff-activity/csv?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await downloadBlob(res, `staff_activity_${Date.now()}.csv`);
  },

  // 6. Cooperative Progress
  async getCoopProgress(
    apiBaseUrl: string,
    token: string
  ): Promise<CoopProgressReportItem[]> {
    const res = await fetch(`${apiBaseUrl}/api/v1/reports/coop-progress`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to load cooperative progress: HTTP ${res.status}`);
    return res.json();
  },

  async downloadCoopProgressCsv(
    apiBaseUrl: string,
    token: string
  ): Promise<void> {
    const res = await fetch(`${apiBaseUrl}/api/v1/reports/coop-progress/csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await downloadBlob(res, `coop_progress_${Date.now()}.csv`);
  },

  // 7. Export History
  async getExportHistory(
    apiBaseUrl: string,
    token: string,
    limit: number = 20
  ): Promise<ExportLogItem[]> {
    const res = await fetch(`${apiBaseUrl}/api/v1/reports/export-history?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to load export history: HTTP ${res.status}`);
    return res.json();
  },
};

