import zoneinfo
from datetime import datetime, timedelta
from database import db

def is_night_shift(start_time: str, end_time: str) -> bool:
    try:
        sh, sm = map(int, start_time.split(":"))
        eh, em = map(int, end_time.split(":"))
        # Night shift if start time is later than or equal to end time (crosses midnight)
        return (sh > eh) or (sh == eh and sm >= em)
    except Exception:
        return False

async def get_target_attendance_date_details(username: str, now_local: datetime) -> dict:
    """
    Returns a dictionary with details about which date the current request/logout belongs to.
    Keys returned:
      - "date": str (e.g. "2026-06-16" or "2026-06-17")
      - "is_prev_day": bool (True if mapped to previous day's night shift)
      - "prev_shift_end_dt": datetime (datetime when the previous day's shift ended)
      - "is_closed": bool (Always False now as we record actual stays after shift end)
    """
    today_str = now_local.strftime("%Y-%m-%d")
    prev_day_dt = now_local - timedelta(days=1)
    prev_day_str = prev_day_dt.strftime("%Y-%m-%d")
    
    # Fetch configurations
    config_collection = db.get_collection("attendance_config")
    config = await config_collection.find_one({}) or {}
    config_shifts = config.get("shifts", [])
    config_roster_rows = config.get("rosterRows", [])
    default_start = config.get("shiftStart", "09:00")
    
    # Check if user had a shift on the previous day
    roaster_col = db.get_collection("roasters")
    roaster_prev = await roaster_col.find_one({
        "date": prev_day_str,
        "assignees": username
    })
    
    from attendance import determine_shift_for_user
    prev_shift_name, prev_start, prev_end = determine_shift_for_user(
        username, roaster_prev, config_shifts, config_roster_rows, default_start
    )
    
    if is_night_shift(prev_start, prev_end):
        try:
            eh, em = map(int, prev_end.split(":"))
            prev_shift_end_dt = now_local.replace(hour=eh, minute=em, second=0, microsecond=0)
            
            # Check if today has a shift
            roaster_curr = await roaster_col.find_one({
                "date": today_str,
                "assignees": username
            })
            curr_shift_name, curr_start, curr_end = determine_shift_for_user(
                username, roaster_curr, config_shifts, config_roster_rows, default_start
            )
            
            has_today_shift = True
            if not curr_start or curr_start.lower() in ("leave", "off", "none", "default"):
                has_today_shift = False
                
            if has_today_shift:
                try:
                    csh, csm = map(int, curr_start.split(":"))
                    curr_shift_start_dt = now_local.replace(hour=csh, minute=csm, second=0, microsecond=0)
                    # For night shift users, next day login starts only 1 hour before next shift start
                    cutoff_dt = curr_shift_start_dt - timedelta(hours=1)
                except Exception:
                    try:
                        dsh, dsm = map(int, default_start.split(":"))
                        cutoff_dt = now_local.replace(hour=dsh, minute=dsm, second=0, microsecond=0) - timedelta(hours=1)
                    except Exception:
                        cutoff_dt = prev_shift_end_dt + timedelta(hours=12)
            else:
                cutoff_dt = prev_shift_end_dt + timedelta(hours=12)
                
            attendance_collection = db.get_collection("attendance")
            existing_prev = await attendance_collection.find_one({
                "username": username,
                "date": prev_day_str
            })
            
            # If there is a record for the previous day, and the current time is before the cutoff
            if existing_prev and now_local < cutoff_dt:
                return {
                    "date": prev_day_str,
                    "is_prev_day": True,
                    "prev_shift_end_dt": prev_shift_end_dt,
                    "is_closed": False
                }
        except Exception as e:
            print(f"Error evaluating night shift boundary: {e}")
            
    return {
        "date": today_str,
        "is_prev_day": False,
        "prev_shift_end_dt": None,
        "is_closed": False
    }

async def close_past_open_attendances(username: str, now_local: datetime, last_active_str: str = None):
    """
    Finds and closes any open attendance records for the given user from previous days.
    Uses the user's lastActive string as the logout time if it falls after firstLogin
    and within a 24-hour window; otherwise falls back to the shift end time or firstLogin + 8 hours.
    """
    try:
        attendance_collection = db.get_collection("attendance")
        config_collection = db.get_collection("attendance_config")
        roaster_col = db.get_collection("roasters")
        
        today_str = now_local.strftime("%Y-%m-%d")
        
        open_records = await attendance_collection.find({
            "username": username,
            "loggedOut": False,
            "date": {"$lt": today_str}
        }).to_list(length=None)
        
        if not open_records:
            return
            
        config = await config_collection.find_one({}) or {}
        config_shifts = config.get("shifts", [])
        config_roster_rows = config.get("rosterRows", [])
        default_start = config.get("shiftStart", "09:00")
        
        from attendance import determine_shift_for_user
        
        for rec in open_records:
            rec_date_str = rec.get("date")
            first_login_str = rec.get("firstLogin")
            if not first_login_str:
                continue
                
            first_login_dt = datetime.fromisoformat(first_login_str)
            
            # Determine shift end time
            roaster = await roaster_col.find_one({
                "date": rec_date_str,
                "assignees": username
            })
            _, shift_start, shift_end = determine_shift_for_user(
                username, roaster, config_shifts, config_roster_rows, default_start
            )
            
            logout_dt = None
            if last_active_str:
                try:
                    if last_active_str.endswith("Z"):
                        import zoneinfo
                        tz = zoneinfo.ZoneInfo("Asia/Kolkata")
                        dt_utc = datetime.fromisoformat(last_active_str.replace("Z", "+00:00"))
                        dt_local = dt_utc.astimezone(tz)
                    else:
                        dt_local = datetime.fromisoformat(last_active_str)
                    
                    # Align timezones
                    if dt_local.tzinfo is not None and first_login_dt.tzinfo is None:
                        dt_local = dt_local.replace(tzinfo=None)
                    elif dt_local.tzinfo is None and first_login_dt.tzinfo is not None:
                        first_login_dt = first_login_dt.replace(tzinfo=None)
                        
                    if dt_local > first_login_dt:
                        if (dt_local - first_login_dt).total_seconds() < 86400:
                            logout_dt = dt_local
                except Exception:
                    pass
                    
            if not logout_dt:
                try:
                    eh, em = map(int, shift_end.split(":"))
                    rec_dt = datetime.strptime(rec_date_str, "%Y-%m-%d")
                    if is_night_shift(shift_start, shift_end):
                        logout_dt = rec_dt.replace(hour=eh, minute=em, second=0, microsecond=0) + timedelta(days=1)
                    else:
                        logout_dt = rec_dt.replace(hour=eh, minute=em, second=0, microsecond=0)
                    
                    if first_login_dt.tzinfo:
                        logout_dt = logout_dt.replace(tzinfo=first_login_dt.tzinfo)
                        
                    if logout_dt <= first_login_dt:
                        logout_dt = first_login_dt + timedelta(hours=8)
                except Exception:
                    logout_dt = first_login_dt + timedelta(hours=8)
                    
            worked_hours = round((logout_dt - first_login_dt).total_seconds() / 3600.0, 2)
            
            await attendance_collection.update_one(
                {"_id": rec["_id"]},
                {
                    "$set": {
                        "lastLogout": logout_dt.isoformat(),
                        "workedHours": worked_hours,
                        "loggedOut": True
                    }
                }
            )
    except Exception as e:
        print(f"Error in close_past_open_attendances: {e}")
