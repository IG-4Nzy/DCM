from fastapi import APIRouter, Depends, Query, HTTPException
from auth_utils import get_current_user
from database import db
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
    active_dept = dept_head_doc["name"] if is_dept_head else user_dept
    
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
        
    # 3. Check checklists status for today (BMS and Morning)
    bms_doc = await bms_col.find_one({"date": date, "department": active_dept})
    bms_status = bms_doc.get("status", "Pending") if bms_doc else "Pending"
    
    morning_doc = await morning_col.find_one({"date": date, "department": active_dept})
    morning_status = morning_doc.get("status", "Pending") if morning_doc else "Pending"
    
    # 4. Determine Friday roaster reminder
    show_roaster_reminder = False
    try:
        dt_obj = datetime.strptime(date, "%Y-%m-%d")
        if dt_obj.weekday() == 4:  # Friday is 4
            show_roaster_reminder = True
    except Exception:
        pass
        
    # 5. Fetch pending works
    works_query = {"status": {"$ne": "Closed"}}
    if is_superuser:
        pass
    elif is_dept_head:
        dept_users = await users_col.find({"department": active_dept}).to_list(length=None)
        dept_user_ids = [str(u["_id"]) for u in dept_users]
        works_query["assignee"] = {"$in": dept_user_ids}
    else:
        works_query["assignee"] = user_id_str
        
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
    obs_query = {"observedDate": date}
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
    att_logs_col = db.get_collection("attendance_logs")
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
        
    return {
        "roasterShifts": enriched_roasters,
        "roasterStatus": roaster_status,
        "checklists": {
            "bms": bms_status,
            "morning": morning_status
        },
        "showRoasterReminder": show_roaster_reminder,
        "pendingWorks": enriched_works,
        "observations": enriched_obs,
        "openObservationsCount": open_obs_count,
        "isDepartmentHead": is_dept_head,
        "userDepartment": active_dept,
        "shiftConfig": shift_config,
        "todayAttendance": enriched_attendance
    }
