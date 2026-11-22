/**
 * PashuRakshak Central Strings Module with Unified Multilingual Engine.
 *
 * Implements dynamic reactive translation across Gujarati (Default), English, and Hindi.
 * Backward-compatible with all existing components accessing STRINGS_GU.
 */
import { tStandalone, useTranslation } from '../i18n';

export function useStrings() {
  useTranslation();
  return STRINGS_GU;
}

export const STRINGS_GU = {
  get app() {
    return {
      get title() { return tStandalone('app.title'); },
      get subtitle() { return tStandalone('app.subtitle'); },
      get pilotBadge() { return tStandalone('app.pilotBadge'); },
    };
  },
  get roles() {
    return new Proxy({} as Record<string, string>, {
      get: (_, prop: string) => tStandalone(`roles.${prop}`) || prop,
    });
  },
  get nav() {
    return {
      get daho() {
        return {
          get overview() { return tStandalone('nav.daho.overview'); },
          get cooperatives() { return tStandalone('nav.daho.cooperatives') || 'ડેરી સહકારી મંડળીઓ'; },
          get masterData() { return tStandalone('nav.daho.masterData'); },
          get staff() { return tStandalone('nav.daho.staff'); },
          get campaigns() { return tStandalone('nav.daho.campaigns'); },
          get camps() { return tStandalone('nav.daho.camps'); },
          get inventory() { return tStandalone('nav.daho.inventory'); },
          get surveillance() { return tStandalone('nav.daho.surveillance'); },
          get maps() { return tStandalone('nav.daho.maps'); },
          get reports() { return tStandalone('nav.daho.reports'); },
          get notifications() { return tStandalone('nav.daho.notifications'); },
          get profile() { return tStandalone('nav.daho.profile'); },
        };
      },
      get vo() {
        return {
          get overview() { return tStandalone('nav.vo.overview'); },
          get villages() { return tStandalone('nav.vo.villages') || 'ગામ મોનિટરિંગ'; },
          get staff() { return tStandalone('nav.vo.staff') || 'ક્ષેત્રીય સ્ટાફ સંચાલન'; },
          get farmers() { return tStandalone('nav.vo.farmers') || 'પશુપાલક ડિરેક્ટરી'; },
          get surveillanceReviews() { return tStandalone('nav.vo.surveillanceReviews'); },
          get animals() { return tStandalone('nav.vo.animals'); },
          get vaccinations() { return tStandalone('nav.vo.vaccinations'); },
          get campaigns() { return tStandalone('nav.vo.campaigns'); },
          get camps() { return tStandalone('nav.vo.camps'); },
          get inventory() { return tStandalone('nav.vo.inventory'); },
          get reports() { return tStandalone('nav.vo.reports'); },
          get maps() { return tStandalone('nav.vo.maps') || 'GIS નકશો'; },
          get sync() { return tStandalone('nav.vo.sync'); },
          get notifications() { return tStandalone('nav.vo.notifications'); },
          get profile() { return tStandalone('nav.vo.profile'); },
        };
      },
      get fw() {
        return {
          get home() { return tStandalone('nav.fw.home'); },
          get villages() { return tStandalone('nav.fw.villages') || 'સોંપાયેલ ગામો'; },
          get farmers() { return tStandalone('nav.fw.farmers'); },
          get animals() { return tStandalone('nav.fw.animals'); },
          get scan() { return tStandalone('nav.fw.scan'); },
          get vaccinations() { return tStandalone('nav.fw.vaccinations'); },
          get newReport() { return tStandalone('nav.fw.newReport'); },
          get pending() { return tStandalone('nav.fw.pending'); },
          get maps() { return tStandalone('nav.fw.maps') || 'GIS નકશો'; },
          get reports() { return tStandalone('nav.fw.reports') || 'કામગીરી અહેવાલો'; },
          get sync() { return tStandalone('nav.fw.sync'); },
          get notifications() { return tStandalone('nav.fw.notifications'); },
          get profile() { return tStandalone('nav.fw.profile'); },
          get attachments() { return tStandalone('nav.fw.attachments'); },
        };
      },
      get farmer() {
        return {
          get home() { return tStandalone('nav.farmer.home'); },
          get animals() { return tStandalone('nav.farmer.animals'); },
          get notifications() { return tStandalone('nav.farmer.notifications'); },
          get profile() { return tStandalone('nav.farmer.profile'); },
        };
      },
      get coop() {
        return {
          get overview() { return tStandalone('nav.coop.overview') || 'ડેરી ઝાંખી'; },
          get maps() { return tStandalone('nav.coop.maps') || 'GIS નકશો'; },
          get farmers() { return tStandalone('nav.coop.farmers') || 'સભાસદ પશુપાલકો'; },
          get animals() { return tStandalone('nav.coop.animals') || 'સંલગ્ન પશુધન'; },
          get vaccinations() { return tStandalone('nav.coop.vaccinations') || 'રસીકરણ સ્થિતિ'; },
          get campaigns() { return tStandalone('nav.coop.campaigns') || 'ઝુંબેશ મોનિટરિંગ'; },
          get villageProgress() { return tStandalone('nav.coop.villageProgress') || 'ગામવાર પ્રગતિ'; },
          get camps() { return tStandalone('nav.coop.camps') || 'કેમ્પ સંકલન'; },
          get surveillance() { return tStandalone('nav.coop.surveillance') || 'રોગ દેખરેખ'; },
          get reports() { return tStandalone('nav.coop.reports') || 'અહેવાલો'; },
          get notifications() { return tStandalone('nav.coop.notifications') || 'સૂચનાઓ'; },
          get profile() { return tStandalone('nav.coop.profile') || 'પ્રોફાઇલ'; },
        };
      },
      get admin() {
        return {
          get overview() { return tStandalone('nav.admin.overview'); },
          get geography() { return tStandalone('nav.admin.geography'); },
          get map() { return tStandalone('nav.admin.map'); },
          get daho() { return tStandalone('nav.admin.daho'); },
          get assignments() { return tStandalone('nav.admin.assignments'); },
          get oversight() { return tStandalone('nav.admin.oversight'); },
          get roles() { return tStandalone('nav.admin.roles'); },
          get users() { return tStandalone('nav.admin.users'); },
          get devices() { return tStandalone('nav.admin.devices'); },
          get auditLogs() { return tStandalone('nav.admin.auditLogs'); },
          get systemHealth() { return tStandalone('nav.admin.systemHealth'); },
          get profile() { return tStandalone('nav.admin.profile'); },
        };
      },
    };
  },
  get sync() {
    return {
      get offline() { return tStandalone('sync.offline'); },
      get pending() { return tStandalone('sync.pending'); },
      get syncing() { return tStandalone('sync.syncing'); },
      get synced() { return tStandalone('sync.synced'); },
      get failed() { return tStandalone('sync.failed'); },
      get needsReview() { return tStandalone('common.viewDetails'); },
      get triggerManual() { return tStandalone('sync.syncNow'); },
      get pendingCount() { return tStandalone('sync.pending'); },
      get failedCount() { return tStandalone('sync.failed'); },
    };
  },
  get states() {
    return {
      get loading() { return tStandalone('common.loading'); },
      get empty() { return tStandalone('common.empty'); },
      get error() { return tStandalone('common.errorOccurred'); },
      get accessDenied() { return tStandalone('common.errorOccurred'); },
      get notAvailable() { return tStandalone('common.empty'); },
      get notFound() { return tStandalone('common.noData'); },
    };
  },
  get actions() {
    return {
      get login() { return tStandalone('auth.login'); },
      get logout() { return tStandalone('auth.logout'); },
      get cancel() { return tStandalone('common.cancel'); },
      get confirm() { return tStandalone('common.confirm'); },
      get save() { return tStandalone('common.save'); },
      get submit() { return tStandalone('common.submit'); },
      get search() { return tStandalone('common.search'); },
      get refresh() { return tStandalone('common.refresh'); },
      get retry() { return tStandalone('common.retry'); },
      get back() { return tStandalone('common.back'); },
      get viewDetails() { return tStandalone('common.viewDetails'); },
      get edit() { return tStandalone('common.edit'); },
      get delete() { return tStandalone('common.delete'); },
    };
  },
  get auth() {
    return {
      get staffLoginTitle() { return tStandalone('auth.staffLoginTitle'); },
      get farmerLoginTitle() { return tStandalone('auth.farmerLoginTitle'); },
      get usernameLabel() { return tStandalone('auth.username'); },
      get passwordLabel() { return tStandalone('auth.password'); },
      get mobileLabel() { return tStandalone('auth.mobile'); },
      get otpLabel() { return tStandalone('auth.otp'); },
      get requestOtp() { return tStandalone('auth.requestOtp'); },
      get verifyOtp() { return tStandalone('auth.verifyAndLogin'); },
      get logoutWarningTitle() { return tStandalone('auth.logoutConfirmTitle'); },
      get logoutPendingWarning() { return tStandalone('auth.logoutPendingWarning'); },
    };
  },
  get table() {
    return {
      get prev() { return tStandalone('table.prev'); },
      get next() { return tStandalone('table.next'); },
      get page() { return tStandalone('table.page'); },
      get of() { return tStandalone('table.of'); },
      get rowsPerPage() { return tStandalone('table.rowsPerPage'); },
      get totalRows() { return tStandalone('table.totalRows'); },
      get noData() { return tStandalone('table.noData'); },
    };
  },
};
