import requests
import sys
import json
from datetime import datetime

class OrganizationalSystemTester:
    def __init__(self, base_url="https://formationportal.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_resources = {
            'users': [],
            'locations': [],
            'functions': [],
            'stages': [],
            'documents': [],
            'videos': []
        }

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if files:
                # Remove Content-Type for file uploads
                headers.pop('Content-Type', None)
                
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json() if response.content else {}
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")

            return success, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        return self.run_test("Health Check", "GET", "health", 200)

    def test_register_admin(self):
        """Test user registration with admin role"""
        test_user_data = {
            "full_name": "Admin Test User",
            "email": f"admin_test_{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "TestPass123!",
            "role": "admin"
        }
        
        success, response = self.run_test(
            "Register Admin User",
            "POST",
            "auth/register",
            200,
            data=test_user_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            self.created_resources['users'].append(response['user']['id'])
            print(f"   Admin user created with ID: {self.user_id}")
            return True
        return False

    def test_login(self, email, password):
        """Test login"""
        success, response = self.run_test(
            "Login",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            return True
        return False

    def test_get_me(self):
        """Test get current user"""
        return self.run_test("Get Current User", "GET", "auth/me", 200)

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        return self.run_test("Dashboard Stats", "GET", "stats/dashboard", 200)

    def test_user_management(self):
        """Test user CRUD operations"""
        print("\n📋 Testing User Management...")
        
        # List users
        success, _ = self.run_test("List Users", "GET", "users", 200)
        if not success:
            return False

        # Create user
        user_data = {
            "full_name": "Test User",
            "email": f"test_user_{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "TestPass123!",
            "role": "user"
        }
        
        success, response = self.run_test("Create User", "POST", "users", 200, data=user_data)
        if not success:
            return False
            
        created_user_id = response.get('id')
        if created_user_id:
            self.created_resources['users'].append(created_user_id)

        # Get user
        if created_user_id:
            success, _ = self.run_test("Get User", "GET", f"users/{created_user_id}", 200)
            if not success:
                return False

        # Update user
        if created_user_id:
            update_data = {"full_name": "Updated Test User"}
            success, _ = self.run_test("Update User", "PUT", f"users/{created_user_id}", 200, data=update_data)
            if not success:
                return False

        return True

    def test_location_management(self):
        """Test location CRUD operations"""
        print("\n📍 Testing Location Management...")
        
        # List locations
        success, _ = self.run_test("List Locations", "GET", "locations", 200)
        if not success:
            return False

        # Create location
        location_data = {
            "name": f"Test Location {datetime.now().strftime('%H%M%S')}",
            "capacity": 50,
            "status": "active"
        }
        
        success, response = self.run_test("Create Location", "POST", "locations", 200, data=location_data)
        if not success:
            return False
            
        location_id = response.get('id')
        if location_id:
            self.created_resources['locations'].append(location_id)

        # Get location
        if location_id:
            success, _ = self.run_test("Get Location", "GET", f"locations/{location_id}", 200)
            if not success:
                return False

        # Update location
        if location_id:
            update_data = {"capacity": 100}
            success, _ = self.run_test("Update Location", "PUT", f"locations/{location_id}", 200, data=update_data)
            if not success:
                return False

        return True

    def test_function_management(self):
        """Test function CRUD operations"""
        print("\n⚙️ Testing Function Management...")
        
        # List functions
        success, _ = self.run_test("List Functions", "GET", "functions", 200)
        if not success:
            return False

        # Create function
        function_data = {
            "name": f"Test Function {datetime.now().strftime('%H%M%S')}",
            "description": "Test function description",
            "hierarchy_level": 1
        }
        
        success, response = self.run_test("Create Function", "POST", "functions", 200, data=function_data)
        if not success:
            return False
            
        function_id = response.get('id')
        if function_id:
            self.created_resources['functions'].append(function_id)

        # Get function
        if function_id:
            success, _ = self.run_test("Get Function", "GET", f"functions/{function_id}", 200)
            if not success:
                return False

        return True

    def test_formative_stage_management(self):
        """Test formative stage CRUD operations"""
        print("\n🎓 Testing Formative Stage Management...")
        
        # List stages
        success, _ = self.run_test("List Formative Stages", "GET", "formative-stages", 200)
        if not success:
            return False

        # Create stage
        stage_data = {
            "name": f"Test Stage {datetime.now().strftime('%H%M%S')}",
            "description": "Test stage description",
            "order": 1,
            "estimated_duration": "30 days"
        }
        
        success, response = self.run_test("Create Formative Stage", "POST", "formative-stages", 200, data=stage_data)
        if not success:
            return False
            
        stage_id = response.get('id')
        if stage_id:
            self.created_resources['stages'].append(stage_id)

        # Get stage
        if stage_id:
            success, _ = self.run_test("Get Formative Stage", "GET", f"formative-stages/{stage_id}", 200)
            if not success:
                return False

        return True

    def test_document_management(self):
        """Test document operations"""
        print("\n📄 Testing Document Management...")
        
        # List documents
        success, _ = self.run_test("List Documents", "GET", "documents", 200)
        if not success:
            return False

        # Get document categories
        success, _ = self.run_test("Get Document Categories", "GET", "documents/categories", 200)
        if not success:
            return False

        return True

    def test_video_management(self):
        """Test video operations"""
        print("\n🎥 Testing Video Management...")
        
        # List videos
        success, _ = self.run_test("List Videos", "GET", "videos", 200)
        if not success:
            return False

        # Get video categories
        success, _ = self.run_test("Get Video Categories", "GET", "videos/categories", 200)
        if not success:
            return False

        return True

    def test_audit_logs(self):
        """Test audit log access"""
        print("\n📊 Testing Audit Logs...")
        return self.run_test("List Audit Logs", "GET", "audit-logs", 200)

    def cleanup_resources(self):
        """Clean up created test resources"""
        print("\n🧹 Cleaning up test resources...")
        
        # Delete created users (except the admin we're using)
        for user_id in self.created_resources['users']:
            if user_id != self.user_id:
                self.run_test(f"Delete User {user_id}", "DELETE", f"users/{user_id}", 200)
        
        # Delete created locations
        for location_id in self.created_resources['locations']:
            self.run_test(f"Delete Location {location_id}", "DELETE", f"locations/{location_id}", 200)
        
        # Delete created functions
        for function_id in self.created_resources['functions']:
            self.run_test(f"Delete Function {function_id}", "DELETE", f"functions/{function_id}", 200)
        
        # Delete created stages
        for stage_id in self.created_resources['stages']:
            self.run_test(f"Delete Stage {stage_id}", "DELETE", f"formative-stages/{stage_id}", 200)

def main():
    print("🚀 Starting Organizational Management System API Tests")
    print("=" * 60)
    
    tester = OrganizationalSystemTester()
    
    try:
        # Test health check first
        success, _ = tester.test_health_check()
        if not success:
            print("❌ Health check failed, stopping tests")
            return 1

        # Test user registration and authentication
        if not tester.test_register_admin():
            print("❌ Admin registration failed, stopping tests")
            return 1

        # Test authentication endpoints
        if not tester.test_get_me():
            print("❌ Get current user failed")
            return 1

        # Test dashboard stats
        success, _ = tester.test_dashboard_stats()
        if not success:
            print("❌ Dashboard stats failed")

        # Test all management modules
        if not tester.test_user_management():
            print("❌ User management tests failed")

        if not tester.test_location_management():
            print("❌ Location management tests failed")

        if not tester.test_function_management():
            print("❌ Function management tests failed")

        if not tester.test_formative_stage_management():
            print("❌ Formative stage management tests failed")

        if not tester.test_document_management():
            print("❌ Document management tests failed")

        if not tester.test_video_management():
            print("❌ Video management tests failed")

        # Test audit logs
        success, _ = tester.test_audit_logs()
        if not success:
            print("❌ Audit logs test failed")

        # Clean up
        tester.cleanup_resources()

    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return 1

    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())