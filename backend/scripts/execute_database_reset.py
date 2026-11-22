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
    # 1. Communications, Sync & Devices
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

async def execute_reset():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.connect() as conn:
        trans = await conn.begin()
        try:
            print("==================================================")
            print("STARTING DATABASE RESET FOR FRESH E2E TESTING")
            print("Target DB: pashurakshak_db (Development)")
            print("==================================================")
            
            # Step 1: Temporarily disable immutability triggers on operational tables
            print("\n[Step 1/7] Disabling immutability triggers for maintenance...")
            await conn.execute(text("ALTER TABLE vaccine_stock_transactions DISABLE TRIGGER trg_stock_txn_immutable;"))
            await conn.execute(text("ALTER TABLE animal_events DISABLE TRIGGER trg_animal_events_immutable;"))
            await conn.execute(text("ALTER TABLE audit_events DISABLE TRIGGER trg_audit_no_update;"))
            print("  Triggers temporarily disabled.")

            # Step 2: Reassign master records created_by to Admin
            print("\n[Step 2/7] Reassigning master records to Admin...")
            admin_id = PRESERVE_ADMIN_IDS[0]
            await conn.execute(text(f"UPDATE vaccine_products SET created_by = '{admin_id}'"))
            await conn.execute(text(f"UPDATE schedule_versions SET created_by = '{admin_id}'"))
            await conn.execute(text(f"UPDATE system_settings SET updated_by = '{admin_id}'"))
            await conn.execute(text(f"UPDATE integration_settings SET updated_by = '{admin_id}'"))
            print("  Master records successfully reassigned to Admin.")
            
            # Step 3: Delete operational records in order
            print("\n[Step 3/7] Deleting operational tables in strict dependency order...")
            deleted_summary = {}
            for table in TABLES_TO_DELETE_ORDERED:
                res = await conn.execute(text(f'DELETE FROM "{table}";'))
                deleted_summary[table] = res.rowcount
                if res.rowcount > 0:
                    print(f"  Deleted {res.rowcount} rows from {table}")
                
            # Step 4: Re-enable immutability triggers
            print("\n[Step 4/7] Re-enabling immutability triggers...")
            await conn.execute(text("ALTER TABLE vaccine_stock_transactions ENABLE TRIGGER trg_stock_txn_immutable;"))
            await conn.execute(text("ALTER TABLE animal_events ENABLE TRIGGER trg_animal_events_immutable;"))
            await conn.execute(text("ALTER TABLE audit_events ENABLE TRIGGER trg_audit_no_update;"))
            print("  Triggers re-enabled successfully.")

            # Step 5: Clear users created_by self-reference
            print("\n[Step 5/7] Clearing operational users self-referential created_by...")
            admin_list_str = ", ".join(f"'{uid}'" for uid in PRESERVE_ADMIN_IDS)
            await conn.execute(text(f"UPDATE users SET created_by = NULL WHERE id NOT IN ({admin_list_str});"))
            
            # Step 6: Delete operational users
            print("\n[Step 6/7] Deleting operational users...")
            u_res = await conn.execute(text(f"DELETE FROM users WHERE id NOT IN ({admin_list_str});"))
            print(f"  Deleted {u_res.rowcount} operational users.")
            
            # Step 7: Post-cleanup Validation before commit
            print("\n[Step 7/7] Validating database integrity before commit...")
            
            # A. Users check
            users_res = await conn.execute(text("SELECT id, username, role, full_name, status, password_hash FROM users;"))
            remaining_users = users_res.fetchall()
            assert len(remaining_users) == 2, f"Expected 2 admin users, found {len(remaining_users)}"
            for u in remaining_users:
                assert u[2] == 'SYS_ADMIN', f"User {u[1]} is not SYS_ADMIN!"
                assert u[4] == 'ACTIVE', f"User {u[1]} is not ACTIVE!"
                assert u[5] is not None and len(u[5]) > 20, f"User {u[1]} password hash missing or corrupted!"
                print(f"  [OK] Admin Preserved: {u[1]} ({u[2]}) - {u[3]} (Hash intact)")
                
            # B. Geography check
            d_count = (await conn.execute(text("SELECT COUNT(*) FROM districts;"))).scalar()
            t_count = (await conn.execute(text("SELECT COUNT(*) FROM talukas;"))).scalar()
            v_count = (await conn.execute(text("SELECT COUNT(*) FROM villages;"))).scalar()
            assert d_count == 53, f"Districts modified! Expected 53, got {d_count}"
            assert t_count == 243, f"Talukas modified! Expected 243, got {t_count}"
            assert v_count == 18823, f"Villages modified! Expected 18823, got {v_count}"
            print(f"  [OK] Geography Preserved: {d_count} districts, {t_count} talukas, {v_count} villages intact.")
            
            # C. System Configuration check
            p_count = (await conn.execute(text("SELECT COUNT(*) FROM permissions;"))).scalar()
            rp_count = (await conn.execute(text("SELECT COUNT(*) FROM role_permissions;"))).scalar()
            s_count = (await conn.execute(text("SELECT COUNT(*) FROM species;"))).scalar()
            prg_count = (await conn.execute(text("SELECT COUNT(*) FROM programmes;"))).scalar()
            sv_count = (await conn.execute(text("SELECT COUNT(*) FROM schedule_versions;"))).scalar()
            assert p_count == 55, f"Permissions modified! Expected 55, got {p_count}"
            assert rp_count == 86, f"Role permissions modified! Expected 86, got {rp_count}"
            assert s_count == 4, f"Species modified! Expected 4, got {s_count}"
            assert prg_count == 5, f"Programmes modified! Expected 5, got {prg_count}"
            assert sv_count == 1, f"Schedule versions modified! Expected 1, got {sv_count}"
            print(f"  [OK] Config Preserved: {p_count} perms, {rp_count} role_perms, {s_count} species, {prg_count} programmes, {sv_count} sched_ver.")
            
            # D. Operational tables check (must all be 0)
            for table in TABLES_TO_DELETE_ORDERED:
                c = (await conn.execute(text(f'SELECT COUNT(*) FROM "{table}";'))).scalar()
                assert c == 0, f"Table {table} still has {c} rows!"
            print("  [OK] All operational tables confirmed completely clean (0 rows).")

            print("\nALL VALIDATIONS PASSED! Committing transaction...")
            await trans.commit()
            print("DATABASE RESET COMMITTED SUCCESSFULLY!")
            return True, deleted_summary
        except Exception as e:
            await trans.rollback()
            print(f"\nCRITICAL ERROR: Transaction rolled back due to error: {e}")
            raise e

if __name__ == "__main__":
    asyncio.run(execute_reset())
