export interface UserProfileResponse {
  id: string;
  full_name: string;
  username?: string | null;
  email?: string | null;
  mobile_e164?: string | null;
  role: string;
  designation?: string | null;
  organisation?: string | null;
  status: string;
  must_change_password: boolean;
  assigned_villages: string[];
  assigned_districts: string[];
  assigned_talukas?: string[];
  assigned_districts_details?: Array<{ id: string; district_id?: string; code?: string; name_en?: string; name_gu?: string }>;
  assigned_talukas_details?: Array<{ id: string; taluka_id?: string; district_id?: string; code?: string; name_en?: string; name_gu?: string; village_count?: number }>;
  permissions: string[];
  offline_valid_until: string;
}

export interface UserScopeResponse {
  user_id: string;
  role: string;
  status: string;
  permissions: string[];
  assigned_districts: string[];
  assigned_talukas?: string[];
  assigned_villages: string[];
  linked_farmers: string[];
  assigned_cooperatives?: string[];
  cooperative_villages?: string[];
  is_approved_vaccinator?: boolean;
}

export type SupportedRole =
  | 'DAHO'
  | 'TAHO'
  | 'VO'
  | 'VET_OFFICER'
  | 'FIELD_WORKER'
  | 'FW'
  | 'FARMER'
  | 'DAIRY_STAFF'
  | 'COOPERATIVE'
  | 'SYS_ADMIN'
  | 'ADMIN';

