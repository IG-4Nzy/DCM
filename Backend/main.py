from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routes import router as items_router
from auth import router as auth_router
from users import router as users_router
from roles import router as roles_router
from works import router as works_router
from departments import router as departments_router
from roasters import router as roasters_router
from observations import router as observations_router
from inventory import router as inventory_router
from cluster_types import router as cluster_types_router
from hypervisors import router as hypervisors_router
from nodes import router as nodes_router
from server_racks import router as server_racks_router
from server_models import router as server_models_router
from gpus import router as gpus_router
from node_details import router as node_details_router
from clusters import router as clusters_router
from ad_details import router as ad_details_router
from vcenter_details import router as vcenter_details_router
from vm_details import router as vm_details_router
from physical_servers import router as physical_servers_router
from datastores import router as datastores_router
from requests_router import router as requests_router
from request_routings import router as request_routings_router
from attendance import router as attendance_router
from audit_logs import router as audit_logs_router
from operation_logs import router as operation_logs_router
from ip_list import router as ip_list_router
from documentations import router as documentations_router
from bms_checklists import router as bms_checklists_router
from bms_checklist_config import router as bms_checklist_config_router
from salary import router as salary_router
from cluster_checklists import router as cluster_checklists_router
from cluster_checklist_config import router as cluster_checklist_config_router
from morning_checklists import router as morning_checklists_router
from morning_checklist_config import router as morning_checklist_config_router
from routers.vcenter_monitor import router as vcenter_monitor_router
from routers.server_ping_monitoring import router as server_ping_monitoring_router, server_ping_scheduler
from dashboard import router as dashboard_router
from notifications import router as notifications_router
from periodic_activities import router as periodic_activities_router
from announcements import router as announcements_router
from phone_directory import router as phone_directory_router
from infrastructure_history import router as infrastructure_history_router
from routers.about import router as about_router
from routers.mail_config import router as mail_config_router
from work_logs import router as work_logs_router
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from database import db
from datetime import datetime, timezone
import jwt
from auth_utils import SECRET_KEY, ALGORITHM, secure_decode_jwt

# Initialize structured logging
from services.vcenter.logging_config import setup_logging
setup_logging(log_dir="logs", log_level="INFO")

def get_action_name(method: str, path: str) -> str:
    parts = [p for p in path.split("/") if p]
    if not parts:
        return f"{method} Request"
    
    # Check auth
    if "auth" in parts:
        if "login" in parts: return "User Login"
        if "register" in parts: return "User Registration"
        if "logout" in parts: return "User Logout"
        return "Auth Action"
        
    # Check users
    if "users" in parts:
        if method == "POST": return "Create User"
        if method == "PUT": return "Update User"
        if method == "DELETE": return "Delete User"
        if method == "GET": return "View Users List" if len(parts) == 2 else "View User Details"
        
    # Check roles
    if "roles" in parts:
        if method == "POST": return "Create Role"
        if method == "PUT": return "Update Role"
        if method == "DELETE": return "Delete Role"
        return "Role Action"
        
    # Check inventory
    if "inventory" in parts:
        if method == "POST": return "Create Inventory Item"
        if method == "PUT": return "Update Inventory Stock"
        if method == "DELETE": return "Delete Inventory Item"
        return "Inventory Action"

    # Check requests
    if "requests" in parts:
        if "advance" in parts: return "Advance Request Stage"
        if "reject" in parts or "cancel" in parts: return "Reject/Cancel Request"
        if method == "POST": return "Create Request"
        if method == "PUT": return "Update Request"
        if method == "DELETE": return "Delete Request"
        if method == "GET": return "View Request" if len(parts) > 2 else "View Requests List"
        return "Request Action"

    # Check BMS checklists
    if "bms-checklists" in parts:
        if method == "POST": return "Create BMS Checklist"
        if method == "PUT": return "Update BMS Checklist"
        if method == "DELETE": return "Delete BMS Checklist"
        return "BMS Checklist Action"

    # Check BMS checklist config
    if "bms-checklist-config" in parts:
        if method == "POST": return "Save BMS Checklist Config"
        return "BMS Checklist Config Action"

    # Check Cluster checklists
    if "cluster-checklists" in parts:
        if method == "POST": return "Create Cluster Checklist"
        if method == "PUT": return "Update Cluster Checklist"
        if method == "DELETE": return "Delete Cluster Checklist"
        return "Cluster Checklist Action"

    # Check Cluster checklist config
    if "cluster-checklist-config" in parts:
        if method == "POST": return "Save Cluster Checklist Config"
        return "Cluster Checklist Config Action"

    # Check Morning checklists
    if "morning-checklists" in parts:
        if method == "POST": return "Create Morning Checklist"
        if method == "PUT": return "Update Morning Checklist"
        if method == "DELETE": return "Delete Morning Checklist"
        return "Morning Checklist Action"

    # Check Morning checklist config
    if "morning-checklist-config" in parts:
        if method == "POST": return "Create Morning Checklist Field"
        if method == "PUT": return "Update Morning Checklist Field"
        if method == "DELETE": return "Delete Morning Checklist Field"
        return "Morning Checklist Config Action"

    # Check periodic activities
    if "periodic-activities" in parts:
        if method == "POST": return "Create Periodic Activity"
        if method == "PUT": return "Update Periodic Activity"
        if method == "DELETE": return "Delete Periodic Activity"
        return "Periodic Activity Action"

    # Check roasters
    if "roasters" in parts:
        if method == "POST": return "Create/Publish Roaster"
        if method == "PUT": return "Update Roaster"
        if method == "DELETE": return "Delete Roaster"
        return "Roaster Action"

    # Check works
    if "works" in parts:
        if method == "POST": return "Create Work Assignment"
        if method == "PUT": return "Update Work Assignment"
        if method == "DELETE": return "Delete Work Assignment"
        return "Work Action"

    # Check operation logs
    if "operation-logs" in parts:
        if method == "POST": return "Create Operation Log"
        if method == "PUT": return "Update Operation Log"
        if method == "DELETE": return "Delete Operation Log"
        return "Operation Log Action"

    # Check phone directory
    if "phone-directory" in parts:
        if method == "POST": return "Create Phone Entry"
        if method == "PUT": return "Update Phone Entry"
        if method == "DELETE": return "Delete Phone Entry"
        return "Phone Directory Action"

    # Default fallback
    action_type = parts[1] if len(parts) > 1 else parts[0]
    action_type = action_type.replace("-", " ").title()
    return f"{method} {action_type}"

def clean_document_for_logging(doc: dict) -> dict:
    if not isinstance(doc, dict):
        return doc
    cleaned = {}
    for k, v in doc.items():
        if k == "_id":
            cleaned[k] = str(v)
        elif isinstance(v, datetime):
            cleaned[k] = v.isoformat()
        elif isinstance(v, dict):
            cleaned[k] = clean_document_for_logging(v)
        elif isinstance(v, list):
            cleaned[k] = [
                clean_document_for_logging(item) if isinstance(item, dict) 
                else str(item) if hasattr(item, '__str__') and len(str(item)) == 24
                else item for item in v
            ]
        else:
            if hasattr(v, '__str__') and len(str(v)) == 24 and not isinstance(v, (str, int, float, bool)):
                cleaned[k] = str(v)
            else:
                cleaned[k] = v
    return cleaned

def get_audit_details(username: str, method: str, path: str, status_code: int, body: dict, before: dict, after: dict) -> str:
    default_desc = f"{method} {path} (Status: {status_code})"
    if status_code >= 400:
        return f'"{username}" attempted {method} {path} but failed with status {status_code}'

    parts = [p for p in path.split("/") if p]
    if not parts:
        return default_desc

    current_time_str = datetime.now(timezone.utc).strftime("%d-%m-%Y %I:%M:%S %p") + " UTC"

    if "auth" in parts:
        if "login" in parts:
            return f'"{username}" logged in successfully'
        if "register" in parts:
            reg_user = body.get("username", "new user")
            return f'"{username}" registered user - {reg_user}'
        if "logout" in parts:
            return f'"{username}" logged out'
        return f'"{username}" performed auth action'

    if "users" in parts:
        if method == "POST":
            target_user = body.get("username", "unknown")
            return f'"{username}" created user - {target_user}'
        if method == "PUT":
            target_user = before.get("username") if before else body.get("username", "unknown")
            return f'"{username}" updated user - {target_user}'
        if method == "DELETE":
            target_user = before.get("username") if before else "unknown"
            return f'"{username}" deleted user - {target_user}'

    if "roles" in parts:
        if method == "POST":
            role_name = body.get("name", "unknown")
            return f'"{username}" created role - {role_name}'
        if method == "PUT":
            role_name = before.get("name") if before else body.get("name", "unknown")
            return f'"{username}" updated privileges for role - {role_name}'
        if method == "DELETE":
            role_name = before.get("name") if before else "unknown"
            return f'"{username}" deleted role - {role_name}'

    if "inventory" in parts:
        if "give" in parts:
            item_name = before.get("itemName") if before else "unknown item"
            given_to = body.get("givenTo", "unknown")
            return f'"{username}" checked out {item_name} to {given_to}'
        if "return" in parts:
            item_name = before.get("itemName") if before else "unknown item"
            holder_id = body.get("holderId")
            holder_name = "someone"
            if before and before.get("currentHolders"):
                for h in before["currentHolders"]:
                    if h.get("id") == holder_id:
                        holder_name = h.get("givenTo", "someone")
                        break
            return f'"{username}" received returned {item_name} from {holder_name}'
            
        if method == "POST":
            item_name = body.get("itemName", "unknown")
            is_ret = " (Returnable)" if body.get("isReturnable") else ""
            return f'"{username}" created inventory item - {item_name}{is_ret}'
        if method == "PUT":
            item_name = before.get("itemName") if before else body.get("itemName", "unknown")
            qty_before = before.get("quantity", 0) if before else 0
            qty_after = after.get("quantity", 0) if after else body.get("quantity", 0)
            if qty_before != qty_after:
                diff = qty_after - qty_before
                act_str = f"added {diff} items to" if diff > 0 else f"removed {abs(diff)} items from"
                return f'"{username}" {act_str} stock of {item_name} (New total: {qty_after})'
            return f'"{username}" updated inventory item - {item_name}'
        if method == "DELETE":
            item_name = before.get("itemName") if before else "unknown"
            return f'"{username}" deleted inventory item - {item_name}'

    if "requests" in parts:
        if "advance" in parts:
            req_type = before.get("requestType", "Request") if before else "Request"
            stage = after.get("status", "unknown stage") if after else "unknown stage"
            return f'"{username}" advanced {req_type} to stage - {stage}'
        if "reject" in parts:
            req_type = before.get("requestType", "Request") if before else "Request"
            return f'"{username}" rejected {req_type}'
        if "cancel" in parts:
            req_type = before.get("requestType", "Request") if before else "Request"
            return f'"{username}" cancelled {req_type}'
        if method == "POST":
            req_type = body.get("requestType", "Request")
            return f'"{username}" created request - {req_type}'
        if method == "PUT":
            req_type = before.get("requestType", "Request") if before else body.get("requestType", "Request")
            return f'"{username}" updated details of request - {req_type}'
        if method == "DELETE":
            req_type = before.get("requestType", "Request") if before else "Request"
            return f'"{username}" deleted request - {req_type}'

    if "roasters" in parts:
        if method == "POST":
            return f'"{username}" created and published a new shift roaster'
        if method == "PUT":
            return f'"{username}" updated roaster at {current_time_str}'
        if method == "DELETE":
            return f'"{username}" deleted shift roaster'

    if "works" in parts:
        if method == "POST":
            work_name = body.get("workName", "unknown work")
            return f'"{username}" created work assignment - {work_name}'
        if method == "PUT":
            work_name = before.get("workName") if before else body.get("workName", "unknown work")
            status_before = before.get("status") if before else None
            status_after = after.get("status") if after else body.get("status")
            if status_before != status_after and status_after:
                return f'"{username}" marked work "{work_name}" to {status_after}'
            return f'"{username}" updated work assignment - {work_name}'
        if method == "DELETE":
            work_name = before.get("workName") if before else "unknown"
            return f'"{username}" deleted work assignment - {work_name}'

    if "observations" in parts:
        if method == "POST":
            obs_title = body.get("title", "unknown title")
            return f'"{username}" reported observation - {obs_title}'
        if method == "PUT":
            obs_title = before.get("title") if before else body.get("title", "unknown title")
            return f'"{username}" updated observation - {obs_title}'
        if method == "DELETE":
            obs_title = before.get("title") if before else "unknown"
            return f'"{username}" deleted observation - {obs_title}'

    if "bms-checklists" in parts:
        if method == "POST":
            chk_date = body.get("date", "unknown date")
            return f'"{username}" completed BMS checklist for {chk_date}'
        if method == "PUT":
            chk_date = before.get("date") if before else body.get("date", "unknown date")
            return f'"{username}" updated BMS checklist for {chk_date}'
        if method == "DELETE":
            chk_date = before.get("date") if before else "unknown date"
            return f'"{username}" deleted BMS checklist for {chk_date}'

    if "cluster-checklists" in parts:
        if method == "POST":
            chk_date = body.get("date", "unknown date")
            return f'"{username}" completed Cluster checklist for {chk_date}'
        if method == "PUT":
            chk_date = before.get("date") if before else body.get("date", "unknown date")
            return f'"{username}" updated Cluster checklist for {chk_date}'
        if method == "DELETE":
            chk_date = before.get("date") if before else "unknown date"
            return f'"{username}" deleted Cluster checklist for {chk_date}'

    if "morning-checklists" in parts:
        if method == "POST":
            chk_date = body.get("date", "unknown date")
            return f'"{username}" completed Morning checklist for {chk_date}'
        if method == "PUT":
            chk_date = before.get("date") if before else body.get("date", "unknown date")
            return f'"{username}" updated Morning checklist for {chk_date}'
        if method == "DELETE":
            chk_date = before.get("date") if before else "unknown date"
            return f'"{username}" deleted Morning checklist for {chk_date}'

    if "periodic-activities" in parts:
        if method == "POST":
            act_name = body.get("title", "unknown activity")
            return f'"{username}" created periodic activity - {act_name}'
        if method == "PUT":
            act_name = before.get("title") if before else body.get("title", "unknown activity")
            return f'"{username}" updated periodic activity - {act_name}'
        if method == "DELETE":
            act_name = before.get("title") if before else "unknown"
            return f'"{username}" deleted periodic activity - {act_name}'

    if "departments" in parts:
        if method == "POST":
            dept_name = body.get("name", "unknown department")
            return f'"{username}" created department - {dept_name}'
        if method == "PUT":
            dept_name = before.get("name") if before else body.get("name", "unknown department")
            return f'"{username}" updated department - {dept_name}'
        if method == "DELETE":
            dept_name = before.get("name") if before else "unknown"
            return f'"{username}" deleted department - {dept_name}'

    if "phone-directory" in parts:
        if method == "POST":
            name = body.get("name", "unknown entry")
            return f'"{username}" created phone directory entry - {name}'
        if method == "PUT":
            name = before.get("name") if before else body.get("name", "unknown entry")
            return f'"{username}" updated phone directory entry - {name}'
        if method == "DELETE":
            name = before.get("name") if before else "unknown entry"
            return f'"{username}" deleted phone directory entry - {name}'

    return default_desc

class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method
        
        if path.startswith("/uploads") or path.startswith("/static") or path == "/" or path == "/favicon.ico" or method == "GET" or "heartbeat" in path or "notifications" in path or "logs" in path:
            return await call_next(request)
            
        parts = [p for p in path.split("/") if p]
        doc_id = None
        collection_name = None
        before_state = None
        
        body_json = {}
        if method in ["POST", "PUT", "PATCH"]:
            try:
                body_bytes = await request.body()
                async def receive():
                    return {"type": "http.request", "body": body_bytes, "more_body": False}
                request._receive = receive
                if body_bytes:
                    import json
                    body_json = json.loads(body_bytes.decode('utf-8'))
            except Exception:
                pass
        
        if method in ["PUT", "PATCH", "DELETE"] and parts:
            if "users" in parts: collection_name = "users"
            elif "roles" in parts: collection_name = "roles"
            elif "inventory" in parts: collection_name = "inventory"
            elif "departments" in parts: collection_name = "departments"
            elif "works" in parts: collection_name = "works"
            elif "roasters" in parts: collection_name = "roasters"
            elif "requests" in parts: collection_name = "requests"
            elif "attendance" in parts: collection_name = "attendance"
            elif "clusters" in parts: collection_name = "clusters"
            elif "server-racks" in parts: collection_name = "server_racks"
            elif "server-models" in parts: collection_name = "server_models"
            elif "node-details" in parts: collection_name = "node_details"
            elif "vm-details" in parts: collection_name = "vm_details"
            elif "documentations" in parts: collection_name = "documentations"
            elif "bms-checklists" in parts: collection_name = "bms_checklists"
            elif "bms-checklist-config" in parts: collection_name = "bms_checklist_config"
            elif "cluster-checklists" in parts: collection_name = "cluster_checklists"
            elif "cluster-checklist-config" in parts: collection_name = "cluster_checklist_config"
            elif "morning-checklists" in parts: collection_name = "morning_checklists"
            elif "periodic-activities" in parts: collection_name = "periodic_activities"
            elif "observations" in parts: collection_name = "observations"
            elif "ip-list" in parts: collection_name = "ip_list"
            
            from bson import ObjectId
            for p in reversed(parts):
                if len(p) == 24 and all(c in "0123456789abcdefABCDEF" for c in p):
                    doc_id = p
                    break
                    
            if collection_name and doc_id:
                try:
                    col = db.get_collection(collection_name)
                    doc = await col.find_one({"$or": [{"_id": ObjectId(doc_id)}, {"_id": doc_id}]})
                    if doc:
                        before_state = clean_document_for_logging(doc)
                except Exception as e:
                    import traceback
                    with open("middleware_error.log", "a") as f:
                        f.write(f"Before state error: {e}\n{traceback.format_exc()}\n")
                    print(f"Failed to fetch before state: {e}")
                    
        response = await call_next(request)
        
        after_state = None
        if response.status_code < 400 and method in ["PUT", "PATCH"] and collection_name and doc_id:
            try:
                from bson import ObjectId
                col = db.get_collection(collection_name)
                doc = await col.find_one({"$or": [{"_id": ObjectId(doc_id)}, {"_id": doc_id}]})
                if doc:
                    after_state = clean_document_for_logging(doc)
            except Exception as e:
                import traceback
                with open("middleware_error.log", "a") as f:
                    f.write(f"After state error: {e}\n{traceback.format_exc()}\n")
                print(f"Failed to fetch after state: {e}")
                
        ip_address = request.client.host if request.client else "unknown"
        
        username = "anonymous"
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = secure_decode_jwt(token, SECRET_KEY, ALGORITHM)
                username = payload.get("sub", "anonymous")
            except Exception:
                pass
                
        action = get_action_name(method, path)
        details = get_audit_details(username, method, path, response.status_code, body_json, before_state, after_state)
        
        try:
            logs_col = db.get_collection("audit_logs")
            log_record = {
                "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "user": username,
                "action": action,
                "details": details,
                "ipAddress": ip_address
            }
            if before_state is not None:
                log_record["beforeState"] = before_state
            if after_state is not None:
                log_record["afterState"] = after_state
                
            await logs_col.insert_one(log_record)
        except Exception as e:
            print(f"Failed to write audit log: {e}")
            
        return response

app = FastAPI(
    title="DCM Backend",
    description="FastAPI backend with MongoDB for DCM project",
    version="1.0.0",
    redirect_slashes=False
)

class APIRewriteMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            # Prepend /api if not already prefixed
            if not path.startswith("/api") and not path.startswith("/uploads") and path not in ["/", "/docs", "/redoc", "/openapi.json"]:
                path = f"/api{path}"

            # If the path does not end with a slash and has no file extension or sub-path query/ID extension, append '/' for collection endpoints
            # Starlette routes defined as @router.get("/") match /api/<name>/
            if path.startswith("/api/") and not path.endswith("/") and path not in ["/api/config", "/api/health"]:
                # Check if it's a base endpoint (e.g. /api/users, /api/roles) without further segments or extensions
                segments = path[len("/api/"):].split("/")
                if len(segments) == 1 and "." not in segments[0]:
                    path = f"{path}/"

            scope["path"] = path
            scope["raw_path"] = path.encode("utf-8")
        await self.app(scope, receive, send)

app.add_middleware(APIRewriteMiddleware)

@app.middleware("http")
async def validate_query_params(request: Request, call_next):
    # Check limit parameter in query params
    limit_str = request.query_params.get("limit")
    if limit_str is not None:
        try:
            limit_val = int(limit_str)
            if limit_val > 1000:
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Limit parameter cannot exceed 1000"}
                )
            if limit_val < 1:
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Limit parameter must be at least 1"}
                )
        except ValueError:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=400,
                content={"detail": "Limit parameter must be a valid integer"}
            )
            
    # Check skip parameter in query params
    skip_str = request.query_params.get("skip")
    if skip_str is not None:
        try:
            skip_val = int(skip_str)
            if skip_val < 0:
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Skip parameter cannot be negative"}
                )
            if skip_val > 1000000:
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Skip parameter is too large"}
                )
        except ValueError:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=400,
                content={"detail": "Skip parameter must be a valid integer"}
            )

    # Check sort/sortBy parameter
    sort_by_str = request.query_params.get("sortBy") or request.query_params.get("sort_by")
    if sort_by_str is not None:
        import re
        if not re.match(r"^[a-zA-Z0-9._-]+$", sort_by_str):
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid sort field format"}
            )

    # Check sort order parameter
    order_str = request.query_params.get("order") or request.query_params.get("sortOrder") or request.query_params.get("direction")
    if order_str is not None:
        if order_str.lower() not in ("asc", "desc", "1", "-1"):
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid sort order"}
            )

    return await call_next(request)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "font-src 'self' data:; "
        "img-src 'self' data: blob:; "
        "media-src 'self' data: blob:; "
        "connect-src 'self' http: https: ws: wss:; "
        "form-action 'self'; "
        "frame-ancestors 'self'; "
        "base-uri 'self'; "
        "require-trusted-types-for 'script'; "
        "trusted-types *;"
    )
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    response.headers["Server"] = "Webserver"
    if "X-Powered-By" in response.headers:
        del response.headers["X-Powered-By"]
    return response

@app.middleware("http")
async def csrf_origin_validator(request: Request, call_next):
    if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
        origin = request.headers.get("Origin")
        referer = request.headers.get("Referer")
        
        import re
        pattern = r"^https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|dcms\.vssc\.dos\.gov\.in)(:\d+)?$"
        
        # Check Origin
        if origin:
            if not re.match(pattern, origin):
                from fastapi.responses import JSONResponse
                return JSONResponse(status_code=403, content={"detail": "Origin not allowed"})
        # Check Referer (fallback if Origin is not present)
        elif referer:
            ref_origin = re.match(r"^(https?://[^/]+)", referer)
            if ref_origin:
                ref_origin_str = ref_origin.group(1)
                if not re.match(pattern, ref_origin_str):
                    from fastapi.responses import JSONResponse
                    return JSONResponse(status_code=403, content={"detail": "Referer not allowed"})
                
    return await call_next(request)

app.add_middleware(AuditLogMiddleware)

import os

# Allow CORS for frontend (strictly limited to local/intranet origins and dcms.vssc.dos.gov.in)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|dcms\.vssc\.dos\.gov\.in)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Date"],
)

from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Sanitize validation errors to prevent reflecting raw user input in JSON
    errors = []
    for error in exc.errors():
        errors.append({
            "loc": [str(loc) for loc in error.get("loc", [])],
            "msg": error.get("msg"),
            "type": error.get("type")
        })
    return JSONResponse(
        status_code=422,
        content={"detail": errors}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Return generic internal server error to prevent path/stack trace disclosure
    if isinstance(exc, StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail}
        )
    # Log the error internally
    import traceback
    with open("error.log", "a") as f:
        f.write(f"Unhandled exception: {exc}\n{traceback.format_exc()}\n")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"}
    )

def mount_api_router(router, tag, path_name):
    clean = path_name.strip("/")
    app.include_router(router, tags=[tag], prefix=f"/api/{clean}")
    app.include_router(router, tags=[tag], prefix=f"/{clean}")

app.include_router(items_router, tags=["items"], prefix="/items")
app.include_router(items_router, tags=["items"], prefix="/api/items")

mount_api_router(auth_router, "auth", "auth")
mount_api_router(users_router, "users", "users")
mount_api_router(roles_router, "roles", "roles")
mount_api_router(works_router, "works", "works")
mount_api_router(departments_router, "departments", "departments")
mount_api_router(roasters_router, "roasters", "roasters")
mount_api_router(observations_router, "observations", "observations")
mount_api_router(inventory_router, "inventory", "inventory")
mount_api_router(cluster_types_router, "cluster_types", "cluster-types")
mount_api_router(hypervisors_router, "hypervisors", "hypervisors")
mount_api_router(nodes_router, "nodes", "nodes")
mount_api_router(server_racks_router, "server_racks", "server-racks")
mount_api_router(server_models_router, "server_models", "server-models")
mount_api_router(gpus_router, "gpus", "gpus")
mount_api_router(node_details_router, "node_details", "node-details")
mount_api_router(clusters_router, "clusters", "clusters")
mount_api_router(ad_details_router, "ad_details", "ad-details")
mount_api_router(vcenter_details_router, "vcenter_details", "vcenter-details")
mount_api_router(vm_details_router, "vm_details", "vm-details")
mount_api_router(physical_servers_router, "physical_servers", "physical-servers")
mount_api_router(datastores_router, "datastores", "datastores")
mount_api_router(requests_router, "requests", "requests")
mount_api_router(request_routings_router, "request_routings", "request-routings")
mount_api_router(attendance_router, "attendance", "attendance")
mount_api_router(audit_logs_router, "audit_logs", "logs")
mount_api_router(documentations_router, "documentations", "documentations")
mount_api_router(bms_checklists_router, "bms_checklists", "bms-checklists")
mount_api_router(bms_checklist_config_router, "bms_checklist_config", "bms-checklist-config")
mount_api_router(cluster_checklists_router, "cluster_checklists", "cluster-checklists")
mount_api_router(cluster_checklist_config_router, "cluster_checklist_config", "cluster-checklist-config")
mount_api_router(morning_checklists_router, "morning_checklists", "morning-checklists")
mount_api_router(morning_checklist_config_router, "morning_checklist_config", "morning-checklist-config")
mount_api_router(periodic_activities_router, "periodic_activities", "periodic-activities")
mount_api_router(announcements_router, "announcements", "announcements")
mount_api_router(phone_directory_router, "phone_directory", "phone-directory")
mount_api_router(operation_logs_router, "operation_logs", "operation-logs")
mount_api_router(ip_list_router, "ip-list", "ip-list")
mount_api_router(dashboard_router, "dashboard", "dashboard")
mount_api_router(notifications_router, "notifications", "notifications")
mount_api_router(server_ping_monitoring_router, "server_ping_monitoring", "server-ping-monitoring")
mount_api_router(salary_router, "salary", "salary")
mount_api_router(about_router, "about", "about")
mount_api_router(infrastructure_history_router, "infrastructure_history", "infrastructure-history")
mount_api_router(mail_config_router, "mail_config", "mail-config")
mount_api_router(work_logs_router, "work_logs", "work-logs")

# Mount the new split telemetry monitor endpoints under same prefix for backwards compatibility
mount_api_router(vcenter_monitor_router, "vcenter_telemetry", "vcenter-details")

import os
os.makedirs("uploads/works", exist_ok=True)
os.makedirs("uploads/observations", exist_ok=True)
os.makedirs("uploads/documentations", exist_ok=True)
os.makedirs("logs", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/", tags=["root"])
async def root():
    return {"message": "Welcome to the DCM API"}

@app.get("/config", tags=["config"])
@app.get("/api/config", tags=["config"])
async def get_app_config():
    deploy_val = os.getenv("deploy", os.getenv("DEPLOY", os.getenv("DEPLOY_ENV", "prod"))).lower().strip()
    return {"deploy": deploy_val}


# ─────────────────────────────────────────────────────────
# LIFECYCLE EVENTS — Background Scheduler & Client Cleanup
# ─────────────────────────────────────────────────────────

from tasks.telemetry_scheduler import vcenter_telemetry_scheduler
from services.vcenter.client import vcenter_http_client

@app.on_event("startup")
async def on_startup():
    """Start background telemetry scheduler on app boot and create DB performance indexes."""
    try:
        await db.user_activity.create_index("username")
        await db.user_activity.create_index("lastActive")
        await db.monitored_servers.create_index("isEnabled")
        await db.monitoring_status.create_index("serverId")
        await db.vcenter_telemetry.create_index([("vcenterId", 1), ("timestamp", -1)])
        await db.ping_drop_logs.create_index([("timestamp", -1)])
        await db.works.create_index([("status", 1), ("assignee", 1)])
        await db.requests.create_index([("status", 1), ("createdBy", 1)])
        await db.audit_logs.create_index([("timestamp", -1)])
    except Exception as e:
        print(f"Database index initialization notice: {e}")

    vcenter_telemetry_scheduler.start()
    server_ping_scheduler.start()

@app.on_event("shutdown")
async def on_shutdown():
    """Gracefully stop scheduler and close shared HTTPX client pool."""
    await vcenter_telemetry_scheduler.stop()
    await server_ping_scheduler.stop()
    await vcenter_http_client.close_client()
