import json
import random
from locust import HttpUser, task, between

class DCMLoadTestUser(HttpUser):
    # Think time between user actions (simulates realistic user delays of 1-3 seconds)
    wait_time = between(1, 3)

    def on_start(self):
        """
        Runs automatically when a simulated user is spawned.
        Logs the user in to retrieve the authentication JWT token.
        """
        self.headers = {}
        payload = {
            "username": "dcs_dev",
            "password": "dcs_v$$c"
        }
        try:
            with self.client.post("/api/auth/login", json=payload, catch_response=True) as response:
                if response.status_code == 200:
                    token = response.json().get("token")
                    if token:
                        self.headers = {"Authorization": f"Bearer {token}"}
                        response.success()
                    else:
                        response.failure("Token key not found in login response")
                else:
                    response.failure(f"Login failed with status {response.status_code}")
        except Exception as e:
            response.failure(f"Exception during login: {str(e)}")

    # ==========================================
    # 1. CORE VIEWS & ANALYTICS (Highest Traffic)
    # ==========================================
    @task(10)
    def view_dashboard(self):
        """Simulates viewing the main dashboard statistics."""
        self.client.get("/api/dashboard", headers=self.headers)

    @task(8)
    def get_notifications(self):
        """Simulates client checking recent system notifications."""
        self.client.get("/api/notifications", headers=self.headers)

    # ==========================================
    # 2. WORK TICKETS & INCIDENTS (High Traffic)
    # ==========================================
    @task(6)
    def view_work_tickets(self):
        """Simulates browsing active work tickets."""
        self.client.get("/api/works", headers=self.headers)

    @task(4)
    def view_observations(self):
        """Simulates browsing incident observation logs."""
        self.client.get("/api/observations", headers=self.headers)

    @task(1)
    def create_work_ticket_write(self):
        """Simulates concurrent database write by posting a work ticket."""
        payload = {
            "title": f"Load Test Ticket {random.randint(100, 999)}",
            "description": "Simulating concurrent ticket creation and DB writes.",
            "priority": "Medium",
            "status": "Open",
            "category": "Software"
        }
        self.client.post("/api/works", json=payload, headers=self.headers)

    # ==========================================
    # 3. SALARY MODULE
    # ==========================================
    @task(5)
    def fetch_salary_templates(self):
        """Simulates viewing/fetching salary calculation templates."""
        self.client.get("/api/salary/templates", headers=self.headers)

    # ==========================================
    # 4. INFRASTRUCTURE & VIRTUALIZATION
    # ==========================================
    @task(6)
    def view_vm_details(self):
        """Simulates listing and monitoring virtual machine assets."""
        self.client.get("/api/vm_details", headers=self.headers)

    @task(3)
    def view_physical_servers(self):
        """Simulates checking host/physical servers list."""
        self.client.get("/api/physical_servers", headers=self.headers)

    @task(2)
    def view_hypervisors(self):
        """Simulates browsing host hypervisors."""
        self.client.get("/api/hypervisors", headers=self.headers)

    @task(2)
    def view_datastores(self):
        """Simulates checking virtualization datastores."""
        self.client.get("/api/datastores", headers=self.headers)

    @task(2)
    def view_gpus(self):
        """Simulates checking hardware GPU assets."""
        self.client.get("/api/gpus", headers=self.headers)

    @task(2)
    def view_server_racks(self):
        """Simulates checking datacenter rack layouts."""
        self.client.get("/api/server_racks", headers=self.headers)

    @task(2)
    def view_server_models(self):
        """Simulates checking server hardware models configurations."""
        self.client.get("/api/server_models", headers=self.headers)

    # ==========================================
    # 5. ATTENDANCE & SHIFT ROSTER
    # ==========================================
    @task(4)
    def view_attendance_logs(self):
        """Simulates checking biometric/login attendance logs."""
        self.client.get("/api/attendance", headers=self.headers)

    @task(3)
    def view_duty_roster(self):
        """Simulates staff checking duty roster schedules."""
        self.client.get("/api/roasters", headers=self.headers)

    # ==========================================
    # 6. DAILY CHECKLISTS
    # ==========================================
    @task(3)
    def view_morning_checklists(self):
        """Simulates checking daily morning shift checklists status."""
        self.client.get("/api/morning_checklists", headers=self.headers)

    @task(2)
    def view_bms_checklists(self):
        """Simulates checking BMS environmental logs."""
        self.client.get("/api/bms_checklists", headers=self.headers)

    @task(2)
    def view_cluster_checklists(self):
        """Simulates browsing database cluster verification checks."""
        self.client.get("/api/cluster_checklists", headers=self.headers)

    # ==========================================
    # 7. UTILITIES & DIRECTORIES (Low Traffic)
    # ==========================================
    @task(2)
    def view_phone_directory(self):
        """Simulates checking contacts / telephone directory."""
        self.client.get("/api/phone_directory", headers=self.headers)

    @task(2)
    def view_announcements(self):
        """Simulates checking bulletin / internal announcements."""
        self.client.get("/api/announcements", headers=self.headers)

    @task(1)
    def get_departments(self):
        """Simulates listing department directories."""
        self.client.get("/api/departments", headers=self.headers)

    @task(1)
    def view_roles_configuration(self):
        """Simulates listing role configurations."""
        self.client.get("/api/roles", headers=self.headers)

    @task(1)
    def view_users_list(self):
        """Simulates browsing registered user/staff accounts card deck."""
        self.client.get("/api/users", headers=self.headers)
