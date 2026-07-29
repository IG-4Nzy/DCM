from fastapi import APIRouter, Depends, Query, HTTPException
from auth_utils import get_current_user
from database import db, get_local_now
from roasters import reconcile_roster_leaves
from datetime import datetime, timedelta
from bson import ObjectId
from typing import List, Optional

router = APIRouter()

@router.get("/summary")
async def get_dashboard_summary(
    date: str = Query(..., description="Current client date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    username = current_user.get("sub")
    is_superuser = current_user.get("isSuperuser", False)
    
    users_col = db.get_collection("users")
    depts_col = db.get_collection("departments")
    roasters_col = db.get_collection("roasters")
    bms_col = db.get_collection("bms_checklists")
    morning_col = db.get_collection("morning_checklists")
    cluster_col = db.get_collection("cluster_checklists")
    works_col = db.get_collection("works")
    obs_col = db.get_collection("observations")
    roaster_status_col = db.get_collection("roaster_status")
    
    # 1. Fetch current user record
    user_rec = await users_col.find_one({"username": username})
    if not user_rec:
        raise HTTPException(status_code=404, detail="User record not found")
        
    user_dept = user_rec.get("department", "General")
    user_id_str = str(user_rec["_id"])
    
    # Check if user is department head
    dept_head_doc = await depts_col.find_one({"departmentHead": username})
    is_dept_head = dept_head_doc is not None
    active_dept = str(dept_head_doc["_id"]) if is_dept_head else user_dept
    
    active_dept_doc = await depts_col.find_one({"_id": ObjectId(active_dept)}) if ObjectId.is_valid(active_dept) else None
    active_dept_name = active_dept_doc["name"] if active_dept_doc else active_dept
    
    # Reconcile roster leaves for past dates in this department
    await reconcile_roster_leaves(active_dept, get_local_now())
    
    # 2. Fetch roaster shifts for today
    roaster_query = {"date": date}
    if not is_superuser:
        roaster_query["department"] = active_dept
        
    roasters_cursor = roasters_col.find(roaster_query)
    roasters_list = await roasters_cursor.to_list(length=100)
    
    # Enrich assignees in roasters with full names and initial details
    enriched_roasters = []
    for r in roasters_list:
        r_dict = dict(r)
        r_dict["_id"] = str(r["_id"])
        assignees = r.get("assignees", [])
        enriched_assignees = []
        for assignee_username in assignees:
            ass_user = await users_col.find_one({"username": assignee_username})
            if ass_user:
                fname = ass_user.get("firstName", "")
                lname = ass_user.get("lastName", "")
                fullname = f"{fname} {lname}".strip() or assignee_username
                enriched_assignees.append({
                    "username": assignee_username,
                    "fullName": fullname,
                    "initials": ((fname[:1] + lname[:1]) if fname and lname else assignee_username[:2]).upper()
                })
            else:
                enriched_assignees.append({
                    "username": assignee_username,
                    "fullName": assignee_username,
                    "initials": assignee_username[:2].upper()
                })
        r_dict["assigneeDetails"] = enriched_assignees
        enriched_roasters.append(r_dict)
        
    # Get roster status for the week
    try:
        dt_obj = datetime.strptime(date, "%Y-%m-%d")
        start_of_week = dt_obj - timedelta(days=dt_obj.weekday())
        week_start_str = start_of_week.strftime("%Y-%m-%d")
    except Exception:
        week_start_str = date
        
    status_doc = await roaster_status_col.find_one({"weekStartDate": week_start_str, "department": active_dept})
    roaster_status = status_doc.get("status", "Pending") if status_doc else "Pending"
        
    # 3. Check checklists status for today (BMS, Morning, and Cluster)
    user_privs = current_user.get("privileges", [])
    
    async def get_checklist_overall_status(collection, view_all_priv):
        if view_all_priv and (is_superuser or view_all_priv in user_privs):
            total_depts = await depts_col.count_documents({})
            completed = await collection.count_documents({"date": date, "status": "Completed"})
            draft = await collection.count_documents({"date": date, "status": "Draft"})
            if total_depts > 0 and completed == total_depts:
                return "Completed"
            elif completed > 0 or draft > 0:
                return "Draft"
            else:
                return "Pending"
        else:
            doc = await collection.find_one({"date": date, "department": active_dept})
            return doc.get("status", "Pending") if doc else "Pending"

    bms_status = await get_checklist_overall_status(bms_col, "View All Department BMS Checklist")
    morning_status = await get_checklist_overall_status(morning_col, None)
    cluster_status = await get_checklist_overall_status(cluster_col, "View All Department Cluster Checklist")
    
    # 4. Determine Friday roaster reminder
    show_roaster_reminder = False
    try:
        dt_obj = datetime.strptime(date, "%Y-%m-%d")
        if dt_obj.weekday() >= 4:  # Friday is 4, Saturday is 5, Sunday is 6
            start_of_week = dt_obj - timedelta(days=dt_obj.weekday())
            next_week_start = start_of_week + timedelta(days=7)
            next_week_start_str = next_week_start.strftime("%Y-%m-%d")
            next_week_end_str = (next_week_start + timedelta(days=6)).strftime("%Y-%m-%d")
            
            next_week_roster = await roasters_col.find_one({
                "date": {"$gte": next_week_start_str, "$lte": next_week_end_str},
                "department": active_dept
            })
            if not next_week_roster:
                show_roaster_reminder = True
    except Exception:
        pass
        
    # 5. Fetch pending works
    works_query = {"status": {"$nin": ["Closed", "Completed"]}}
    if is_superuser:
        pass
    elif is_dept_head:
        dept_users = await users_col.find({"department": active_dept}).to_list(length=None)
        dept_user_ids = [str(u["_id"]) for u in dept_users]
        works_query["$or"] = [
            {"assignee": {"$in": dept_user_ids}},
            {"assignees": {"$in": dept_user_ids}}
        ]
    else:
        works_query["$or"] = [
            {"assignee": user_id_str},
            {"assignees": user_id_str}
        ]
        
    works_cursor = works_col.find(works_query).sort("dueDate", 1)
    works_list = await works_cursor.to_list(length=100)
    
    enriched_works = []
    for w in works_list:
        w_dict = dict(w)
        w_dict["_id"] = str(w["_id"])
        # Fetch assignee name and details
        ass_id = w.get("assignee")
        if ass_id:
            try:
                ass_user = await users_col.find_one({"_id": ObjectId(ass_id)})
                if ass_user:
                    fname = ass_user.get("firstName", "")
                    lname = ass_user.get("lastName", "")
                    fullname = f"{fname} {lname}".strip() or ass_user.get("username", "Unknown")
                    w_dict["assigneeName"] = fullname
                    w_dict["assigneeInitials"] = ((fname[:1] + lname[:1]) if fname and lname else fullname[:2]).upper()
                else:
                    w_dict["assigneeName"] = "Unknown"
                    w_dict["assigneeInitials"] = "??"
            except Exception:
                w_dict["assigneeName"] = "Unknown"
                w_dict["assigneeInitials"] = "??"
        else:
            w_dict["assigneeName"] = "Unassigned"
            w_dict["assigneeInitials"] = "UN"
        enriched_works.append(w_dict)
        
    # 6. Fetch observations for today
    obs_query = {
        "$or": [
            {"observedDate": date},
            {"lastStatusUpdatedOn": {"$regex": f"^{date}"}}
        ]
    }
    if not is_superuser:
        dept_users = await users_col.find({"department": active_dept}).to_list(length=None)
        dept_usernames = [u["username"] for u in dept_users]
        obs_query["loggedBy"] = {"$in": dept_usernames}
        
    obs_cursor = obs_col.find(obs_query).sort("observedTime", -1)
    obs_list = await obs_cursor.to_list(length=100)
    
    enriched_obs = []
    for o in obs_list:
        o_dict = dict(o)
        o_dict["_id"] = str(o["_id"])
        enriched_obs.append(o_dict)
        
    # 7. Fetch total open observations count (unresolved)
    open_obs_query = {"status": {"$ne": "Resolved"}}
    if not is_superuser:
        dept_users = await users_col.find({"department": active_dept}).to_list(length=None)
        dept_usernames = [u["username"] for u in dept_users]
        open_obs_query["loggedBy"] = {"$in": dept_usernames}
    open_obs_count = await obs_col.count_documents(open_obs_query)
    
    # 8. Fetch attendance configuration (shift timings for late/early detection)
    att_config_col = db.get_collection("attendance_config")
    att_config_doc = await att_config_col.find_one({})
    shift_config = {
        "shiftStart": "09:00",
        "lateGracePeriod": 30,
        "shifts": [],
        "rosterRows": []
    }
    if att_config_doc:
        shift_config["shiftStart"] = att_config_doc.get("shiftStart", "09:00")
        shift_config["lateGracePeriod"] = att_config_doc.get("lateGracePeriod", 30)
        shift_config["shifts"] = att_config_doc.get("shifts", [])
        shift_config["rosterRows"] = att_config_doc.get("rosterRows", [])


    
    # 9. Fetch today's attendance logs for this department
    att_logs_col = db.get_collection("attendance")
    att_query = {"date": date}
    if not is_superuser:
        dept_users_for_att = await users_col.find({"department": active_dept}).to_list(length=None)
        dept_usernames_for_att = [u["username"] for u in dept_users_for_att]
        att_query["username"] = {"$in": dept_usernames_for_att}
    
    att_cursor = att_logs_col.find(att_query)
    att_list = await att_cursor.to_list(length=500)
    
    enriched_attendance = []
    for a in att_list:
        a_dict = {
            "username": a.get("username", ""),
            "firstLogin": a.get("firstLogin", ""),
            "lastLogout": a.get("lastLogout", ""),
            "shiftStart": a.get("shiftStart", ""),
            "shiftEnd": a.get("shiftEnd", ""),
            "shift": a.get("shift", ""),
            "regularizeStatus": a.get("regularizeStatus", ""),
        }
        # Add full name
        att_user = await users_col.find_one({"username": a_dict["username"]})
        if att_user:
            fname = att_user.get("firstName", "")
            lname = att_user.get("lastName", "")
            a_dict["fullName"] = f"{fname} {lname}".strip() or a_dict["username"]
            a_dict["initials"] = ((fname[:1] + lname[:1]) if fname and lname else a_dict["username"][:2]).upper()
        else:
            a_dict["fullName"] = a_dict["username"]
            a_dict["initials"] = a_dict["username"][:2].upper()
        enriched_attendance.append(a_dict)
        
    # 10. Fetch pending (non-completed) requests
    requests_col = db.get_collection("requests")
    req_query = {"status": {"$ne": "Completed"}}
    if not is_superuser:
        req_query["$or"] = [
            {"createdBy": username},
            {"currentAssignedUsers": username}
        ]
    requests_cursor = requests_col.find(req_query).sort("createdAt", -1)
    requests_list = await requests_cursor.to_list(length=100)
    
    enriched_requests = []
    for r in requests_list:
        r_dict = dict(r)
        r_dict["_id"] = str(r["_id"])
        created_by_username = r.get("createdBy", "")
        if created_by_username:
            created_user = await users_col.find_one({"username": created_by_username})
            if created_user:
                fname = created_user.get("firstName", "")
                lname = created_user.get("lastName", "")
                fullname = f"{fname} {lname}".strip() or created_by_username
                r_dict["createdByFullName"] = fullname
                r_dict["createdByInitials"] = ((fname[:1] + lname[:1]) if fname and lname else created_by_username[:2]).upper()
            else:
                r_dict["createdByFullName"] = created_by_username
                r_dict["createdByInitials"] = created_by_username[:2].upper()
        else:
            r_dict["createdByFullName"] = "System"
            r_dict["createdByInitials"] = "SY"
        enriched_requests.append(r_dict)

    # 11. Fetch periodic activities due in <= 7 days (or overdue)
    periodic_col = db.get_collection("periodic_activities")
    periodic_query: dict = {"department": active_dept}
    
    periodic_cursor = periodic_col.find(periodic_query)
    periodic_list = await periodic_cursor.to_list(length=1000)
    
    alert_activities = []
    try:
        current_date_obj = datetime.strptime(date, "%Y-%m-%d")
        for pa in periodic_list:
            due_date_str = pa.get("dueDate", "")
            try:
                due_date_obj = datetime.strptime(due_date_str, "%Y-%m-%d")
                delta_days = (due_date_obj - current_date_obj).days
                if delta_days <= 7:
                    pa_dict = dict(pa)
                    pa_dict["_id"] = str(pa["_id"])
                    pa_dict["daysRemaining"] = delta_days
                    alert_activities.append(pa_dict)
            except Exception:
                pass

            # Check AMC services if isAmc is True
            if pa.get("isAmc") and pa.get("services"):
                for s in pa["services"]:
                    if s.get("status") == "pending":
                        s_due_str = s.get("dueDate", "")
                        try:
                            s_due_obj = datetime.strptime(s_due_str, "%Y-%m-%d")
                            delta_days = (s_due_obj - current_date_obj).days
                            if delta_days <= 7:
                                pa_dict = dict(pa)
                                pa_dict["_id"] = f"{str(pa['_id'])}-service-{s.get('id')}"
                                pa_dict["name"] = f"Service: {pa.get('name')} (Due: {s_due_str})"
                                pa_dict["dueDate"] = s_due_str
                                pa_dict["daysRemaining"] = delta_days
                                pa_dict["isAmcService"] = True
                                pa_dict["serviceId"] = s.get("id")
                                alert_activities.append(pa_dict)
                        except Exception:
                            pass
    except Exception:
        pass
        
    # 12. Fetch active announcements for the current user
    announcement_col = db.get_collection("announcements")
    announcement_query = {
        "$or": [
            {"mentionType": "all"},
            {"$and": [{"mentionType": "department"}, {"mentionedDepartment": active_dept}]},
            {"$and": [{"mentionType": "staff"}, {"mentionedStaff": username}]},
            {"createdBy": username}
        ]
    }
    announcements_cursor = announcement_col.find(announcement_query)
    announcements_list = await announcements_cursor.to_list(length=1000)
    
    enriched_announcements = []
    current_date_obj = None
    try:
        current_date_obj = datetime.strptime(date, "%Y-%m-%d")
    except Exception:
        pass

    for ann in announcements_list:
        ann_dict = dict(ann)
        ann_dict["_id"] = str(ann["_id"])
        
        # Calculate daysRemaining if "date" (optional target/due date) is provided
        due_date_str = ann.get("date")
        is_expired = False
        if due_date_str and current_date_obj:
            try:
                due_date_obj = datetime.strptime(due_date_str, "%Y-%m-%d")
                delta = (due_date_obj - current_date_obj).days
                if delta < 0:
                    is_expired = True
                ann_dict["daysRemaining"] = delta
            except Exception:
                ann_dict["daysRemaining"] = None
        else:
            ann_dict["daysRemaining"] = None

        if is_expired:
            continue

        # Fetch creator full name
        created_by_username = ann.get("createdBy", "")
        if created_by_username:
            created_user = await users_col.find_one({"username": created_by_username})
            if created_user:
                fname = created_user.get("firstName", "")
                lname = created_user.get("lastName", "")
                fullname = f"{fname} {lname}".strip()
                ann_dict["createdByFullName"] = fullname or created_by_username
            else:
                ann_dict["createdByFullName"] = created_by_username
        else:
            ann_dict["createdByFullName"] = ""
            
        enriched_announcements.append(ann_dict)

    # 13. Fetch top 5 open operational logs
    op_logs_col = db.get_collection("operation_logs")
    op_logs_cursor = op_logs_col.find({"status": "open"}).sort("createdAt", -1).limit(5)
    op_logs_list = await op_logs_cursor.to_list(length=5)
    
    enriched_op_logs = []
    for l in op_logs_list:
        l_dict = dict(l)
        l_dict["_id"] = str(l["_id"])
        enriched_op_logs.append(l_dict)

    # 14. Count VMs and Servers where user is admin (or no admin assigned)
    vms_col = db.get_collection("vm_details")
    nodes_col = db.get_collection("node_details")
    physical_servers_col = db.get_collection("physical_servers")
    
    no_admin_conditions = [
        {"admin": None},
        {"admin": ""},
        {"admin": []},
        {"admin": {"$exists": False}}
    ]
    admin_query = {"$or": [{"admin": {"$in": [username, user_id_str]}}, *no_admin_conditions]}
    admin_vm_count = await vms_col.count_documents(admin_query)

    node_query = {
        "$and": [
            admin_query,
            {"isAppliance": {"$ne": True}},
            {"isStorage": {"$ne": True}},
            {"isPhysical": {"$ne": True}}
        ]
    }
    admin_node_count = await nodes_col.count_documents(node_query)
    admin_config_nodes_col = db.get_collection("nodes")
    admin_config_node_count = await admin_config_nodes_col.count_documents(node_query)
    total_admin_servers = admin_node_count + admin_config_node_count

    return {
        "roasterShifts": enriched_roasters,
        "roasterStatus": roaster_status,
        "checklists": {
            "bms": bms_status,
            "morning": morning_status,
            "cluster": cluster_status
        },
        "showRoasterReminder": show_roaster_reminder,
        "pendingWorks": enriched_works,
        "pendingRequests": enriched_requests,
        "observations": enriched_obs,
        "openObservationsCount": open_obs_count,
        "isDepartmentHead": is_dept_head,
        "userDepartment": active_dept,
        "userDepartmentName": active_dept_name,
        "shiftConfig": shift_config,
        "todayAttendance": enriched_attendance,
        "periodicActivities": alert_activities,
        "announcements": enriched_announcements,
        "openOperationLogs": enriched_op_logs,
        "myVMsCount": admin_vm_count,
        "myServersCount": total_admin_servers,
        "userId": user_id_str
    }

