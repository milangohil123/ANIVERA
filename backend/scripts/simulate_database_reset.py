import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding='utf-8')
import asyncio
from app.core.config import settings
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# Admin users to preserve
PRESERVE_ADMIN_IDS = [
    '66c1d5e3-c531-4ddc-a272-3cae34377e25', # admin_botad
    'cd8b6237-133a-4f9d-b3c7-b16d12e77546', # admin_jamnagar_test
]

TABLES_TO_DELETE_ORDERED = [
    # 1. Communications & Sync logs
    "sync_conflicts",
    "sync_receipts",
    "sync_batches",
    "fw_locations",
    "fw_duty_sessions",
    "notifications",
    "email_logs",
    "export_log",
    "refresh_tokens",
    "otp_challenges",
    "help_request_attempts",
    "help_requests",
    "field_worker_availability_records",
    
    # 2. Disease, treatments & clinical
    "complaint_group_items",
    "complaint_assignment_groups",
    "fw_assignment_history",
    "investigation_actions",
    "investigations",
    "alert_reports",
    "disease_alerts",
    "disease_alert_rules",
    "treatment_attachments",
    "treatment_verifications",
    "treatment_details",
    "treatment_records",
    "health_case_assignments",
    "disease_reviews",
    "disease_report_attachments",
    "disease_report_status_history",
    "disease_reports",
    
    # 3. Vaccinations & Camps
    "reminder_delivery_attempts",
    "reminders",
    "animal_vaccination_cycles",
    "schedule_animal_enrollments",
    "cooperative_vaccination_schedules",
    "vaccination_details",
    "camp_staff",
    "camp_status_history",
    "camps",
    "campaign_assignments",
    "campaign_animal_targets",
    "campaign_villages",
    "campaign_programmes",
    "campaigns",
    "vaccine_stock_transactions",
    "vaccine_stock_lots",
    "vaccinator_authorizations",
    
    # 4. Dairy Cooperatives
    "cooperative_memberships",
    "cooperative_staff_assignments",
    "cooperative_villages",
    "cooperatives",
    
    # 5. Animals & Tracking
    "follow_up_tasks",
    "observation_details",
    "event_corrections",
    "animal_events",
    "animal_external_identifiers",
    "animal_qr_tokens",
    "label_batch_items",
    "label_batches",
    "ownership_transfers",
    "animal_ownership_history",
    "animal_verifications",
    "animal_merge_log",
    "animals",
    "flocks",
    
    # 6. Farmers
    "farmer_account_provisioning",
    "farmer_user_links",
    "farmer_verifications",
    "farmers",
    
    # 7. User assignments & Operational profiles
    "user_village_assignments",
    "taho_taluka_assignments",
    "daho_district_assignments",
    "gram_panchayat_staff_assignments",
    "gram_panchayat_villages",
    "gram_panchayats",
    "veterinary_officer_profiles",
    "user_permission_grants",
    "import_rows",
    "import_jobs",
    "jobs",
    "custom_jurisdictions",
    "devices",
    "audit_events",
]

async def dry_run():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.connect() as conn:
        trans = await conn.begin()
        try:
            print("--- DRY RUN: TESTING CLEANUP TRANSACTION ---")
            
            # Step 1: Temporarily disable immutability triggers on operational tables
            print("1. Disabling immutability triggers for maintenance...")
            await conn.execute(text("ALTER TABLE vaccine_stock_transactions DISABLE TRIGGER trg_stock_txn_immutable;"))
            await conn.execute(text("ALTER TABLE animal_events DISABLE TRIGGER trg_animal_events_immutable;"))
            await conn.execute(text("ALTER TABLE audit_events DISABLE TRIGGER trg_audit_no_update;"))

            # Step 2: Reassign master tables created_by to Admin
            print("2. Reassigning master records to Admin...")
            admin_id = PRESERVE_ADMIN_IDS[0]
            await conn.execute(text(f"UPDATE vaccine_products SET created_by = '{admin_id}'"))
            await conn.execute(text(f"UPDATE schedule_versions SET created_by = '{admin_id}'"))
            await conn.execute(text(f"UPDATE system_settings SET updated_by = '{admin_id}'"))
            await conn.execute(text(f"UPDATE integration_settings SET updated_by = '{admin_id}'"))
            
            # Step 3: Delete operational records in order
            print("3. Deleting operational tables in strict dependency order...")
            for table in TABLES_TO_DELETE_ORDERED:
                res = await conn.execute(text(f'DELETE FROM "{table}";'))
                print(f"   Deleted {res.rowcount} rows from {table}")
                
            # Step 4: Re-enable immutability triggers
            print("4. Re-enabling immutability triggers...")
            await conn.execute(text("ALTER TABLE vaccine_stock_transactions ENABLE TRIGGER trg_stock_txn_immutable;"))
            await conn.execute(text("ALTER TABLE animal_events ENABLE TRIGGER trg_animal_events_immutable;"))
            await conn.execute(text("ALTER TABLE audit_events ENABLE TRIGGER trg_audit_no_update;"))

            # Step 5: Clear users created_by self-reference
            print("5. Clearing operational users self-referential created_by...")
            admin_list_str = ", ".join(f"'{uid}'" for uid in PRESERVE_ADMIN_IDS)
            await conn.execute(text(f"UPDATE users SET created_by = NULL WHERE id NOT IN ({admin_list_str});"))
            
            # Step 6: Delete operational users
            print("6. Deleting operational users...")
            u_res = await conn.execute(text(f"DELETE FROM users WHERE id NOT IN ({admin_list_str});"))
            print(f"   Deleted {u_res.rowcount} operational users.")
            
            # Step 7: Verify remaining users
            users_res = await conn.execute(text("SELECT id, username, role, full_name FROM users;"))
            remaining_users = users_res.fetchall()
            print(f"\nRemaining Users ({len(remaining_users)}):")
            for u in remaining_users:
                print(f"   {u[1]} ({u[2]}) - {u[3]} [ID: {u[0]}]")
                
            # Step 8: Verify Geography intact
            d_count = (await conn.execute(text("SELECT COUNT(*) FROM districts;"))).scalar()
            t_count = (await conn.execute(text("SELECT COUNT(*) FROM talukas;"))).scalar()
            v_count = (await conn.execute(text("SELECT COUNT(*) FROM villages;"))).scalar()
            print(f"\nPreserved Geography: {d_count} districts, {t_count} talukas, {v_count} villages.")
            
            # Step 9: Verify System Config intact
            p_count = (await conn.execute(text("SELECT COUNT(*) FROM permissions;"))).scalar()
            rp_count = (await conn.execute(text("SELECT COUNT(*) FROM role_permissions;"))).scalar()
            s_count = (await conn.execute(text("SELECT COUNT(*) FROM species;"))).scalar()
            prg_count = (await conn.execute(text("SELECT COUNT(*) FROM programmes;"))).scalar()
            sv_count = (await conn.execute(text("SELECT COUNT(*) FROM schedule_versions;"))).scalar()
            print(f"Preserved Config: {p_count} permissions, {rp_count} role_perms, {s_count} species, {prg_count} programmes, {sv_count} schedule_versions.")

            print("\nDRY RUN SUCCESSFUL! Rolling back transaction (no changes made yet)...")
            await trans.rollback()
            print("Rollback complete.")
        except Exception as e:
            await trans.rollback()
            print(f"DRY RUN FAILED with exception: {e}")
            raise e

if __name__ == "__main__":
    asyncio.run(dry_run())
