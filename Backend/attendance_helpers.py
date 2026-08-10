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

async def get_shift_details_for_date(username: str, target_date: str) -> tuple:
    roaster_col = db.get_collection("roasters")
    roaster = await roaster_col.find_one({
        "date": target_date,
        "assignees": username
    })
    config_collection = db.get_collection("attendance_config")
    config = await config_collection.find_one({}) or {}
    config_shifts = config.get("shifts", [])
    config_roster_rows = config.get("rosterRows", [])
    default_start = config.get("shiftStart", "09:00")

    from attendance import determine_shift_for_user
    shift_name, shift_start_str, shift_end_str = determine_shift_for_user(
        username, roaster, config_shifts, config_roster_rows, default_start
    )
    return shift_name, shift_start_str, shift_end_str

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
    
    # Check if user had a shift on the previous day
    shift_name, prev_start, prev_end = await get_shift_details_for_date(username, prev_day_str)
    
    if prev_start and prev_start.lower() not in ("leave", "off", "none", "default"):
        if is_night_shift(prev_start, prev_end):
            try:
                eh, em = map(int, prev_end.split(":"))
                # Shift end is on today_str (next day)
                prev_shift_end_dt = now_local.replace(hour=eh, minute=em, second=0, microsecond=0)
                
                # Shift start is on prev_day_str
                ps_h, ps_m = map(int, prev_start.split(":"))
                prev_shift_start_dt = now_local.replace(
                    year=prev_day_dt.year, month=prev_day_dt.month, day=prev_day_dt.day,
                    hour=ps_h, minute=ps_m, second=0, microsecond=0
                )
                
                # Active window is Shift Start -> Shift End + 3 Hours Grace Period
                prev_window_end_dt = prev_shift_end_dt + timedelta(hours=3)
                
                if prev_shift_start_dt - timedelta(hours=3) <= now_local <= prev_window_end_dt:
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
        
        details = await get_target_attendance_date_details(username, now_local)
        target_date = details["date"]
        
        open_records = await attendance_collection.find({
            "username": username,
            "loggedOut": {"$ne": True},
            "date": {"$lt": target_date}
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
            
            # 1. Try to use the existing lastLogout on the record if it is valid
            existing_logout_str = rec.get("lastLogout")
            if existing_logout_str:
                try:
                    dt_logout = datetime.fromisoformat(existing_logout_str)
                    # Align timezones
                    if dt_logout.tzinfo is not None and first_login_dt.tzinfo is None:
                        dt_logout = dt_logout.replace(tzinfo=None)
                    elif dt_logout.tzinfo is None and first_login_dt.tzinfo is not None:
                        first_login_dt = first_login_dt.replace(tzinfo=None)
                        
                    if dt_logout > first_login_dt:
                        logout_dt = dt_logout
                except Exception:
                    pass
            
            # 2. Try to use last_active_str if no valid logout_dt yet
            if not logout_dt and last_active_str:
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
                    
            # 3. Fallback to shift end or firstLogin + 8 hours
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
                    
            worked_hours = round((logout_dt - first_login_dt).total_seconds() / 3600.0, 1)
            
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
