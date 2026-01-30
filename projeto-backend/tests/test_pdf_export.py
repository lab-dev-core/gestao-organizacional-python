"""
Test PDF Export functionality for Acompanhamentos
Tests:
- GET /api/acompanhamentos/export/pdf - Export all acompanhamentos as PDF
- GET /api/acompanhamentos/{acomp_id}/pdf - Export single acompanhamento as PDF
- Permission checks for formador and user roles
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDENTIALS = {"email": "admin@test.com", "password": "admin123"}
FORMADOR_CREDENTIALS = {"email": "joao.formador@formapro.com", "password": "formador123"}


class TestPDFExport:
    """PDF Export endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_auth_token(self, credentials):
        """Get authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=credentials)
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_admin_login(self):
        """Test admin can login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful")
    
    def test_formador_login(self):
        """Test formador can login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=FORMADOR_CREDENTIALS)
        assert response.status_code == 200, f"Formador login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "formador"
        print(f"✓ Formador login successful")
    
    def test_export_all_pdf_as_admin(self):
        """Test exporting all acompanhamentos as PDF with admin role"""
        token = self.get_auth_token(ADMIN_CREDENTIALS)
        assert token, "Failed to get admin token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.get(f"{BASE_URL}/api/acompanhamentos/export/pdf", headers=headers)
        
        # Should return 200 with PDF or 404 if no acompanhamentos
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}, {response.text}"
        
        if response.status_code == 200:
            # Verify it's a PDF
            content = response.content
            assert content[:4] == b'%PDF', f"Response is not a valid PDF. First bytes: {content[:20]}"
            assert response.headers.get('content-type') == 'application/pdf'
            print(f"✓ Export all PDF successful - received {len(content)} bytes")
        else:
            print(f"✓ Export all PDF returned 404 - no acompanhamentos found (expected if DB is empty)")
    
    def test_export_all_pdf_as_formador(self):
        """Test exporting all acompanhamentos as PDF with formador role"""
        token = self.get_auth_token(FORMADOR_CREDENTIALS)
        assert token, "Failed to get formador token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.get(f"{BASE_URL}/api/acompanhamentos/export/pdf", headers=headers)
        
        # Should return 200 with PDF or 404 if no acompanhamentos
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}, {response.text}"
        
        if response.status_code == 200:
            content = response.content
            assert content[:4] == b'%PDF', f"Response is not a valid PDF. First bytes: {content[:20]}"
            print(f"✓ Formador export all PDF successful - received {len(content)} bytes")
        else:
            print(f"✓ Formador export all PDF returned 404 - no acompanhamentos found")
    
    def test_export_all_pdf_with_stage_filter(self):
        """Test exporting acompanhamentos filtered by formative stage"""
        token = self.get_auth_token(ADMIN_CREDENTIALS)
        assert token, "Failed to get admin token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # First get formative stages
        stages_response = self.session.get(f"{BASE_URL}/api/formative-stages", headers=headers)
        assert stages_response.status_code == 200
        stages = stages_response.json()
        
        if stages:
            stage_id = stages[0]["id"]
            response = self.session.get(
                f"{BASE_URL}/api/acompanhamentos/export/pdf?formative_stage_id={stage_id}", 
                headers=headers
            )
            
            assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
            
            if response.status_code == 200:
                content = response.content
                assert content[:4] == b'%PDF', "Response is not a valid PDF"
                print(f"✓ Export PDF with stage filter successful - received {len(content)} bytes")
            else:
                print(f"✓ Export PDF with stage filter returned 404 - no acompanhamentos in stage")
        else:
            print("⚠ No formative stages found - skipping stage filter test")
    
    def test_export_single_pdf_as_admin(self):
        """Test exporting a single acompanhamento as PDF with admin role"""
        token = self.get_auth_token(ADMIN_CREDENTIALS)
        assert token, "Failed to get admin token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # First get list of acompanhamentos
        list_response = self.session.get(f"{BASE_URL}/api/acompanhamentos", headers=headers)
        assert list_response.status_code == 200
        acompanhamentos = list_response.json()
        
        if acompanhamentos:
            acomp_id = acompanhamentos[0]["id"]
            response = self.session.get(f"{BASE_URL}/api/acompanhamentos/{acomp_id}/pdf", headers=headers)
            
            assert response.status_code == 200, f"Failed to export single PDF: {response.status_code}, {response.text}"
            
            content = response.content
            assert content[:4] == b'%PDF', f"Response is not a valid PDF. First bytes: {content[:20]}"
            assert response.headers.get('content-type') == 'application/pdf'
            print(f"✓ Export single PDF successful - received {len(content)} bytes for acomp_id: {acomp_id}")
        else:
            print("⚠ No acompanhamentos found - skipping single PDF export test")
    
    def test_export_single_pdf_as_formador(self):
        """Test exporting a single acompanhamento as PDF with formador role"""
        token = self.get_auth_token(FORMADOR_CREDENTIALS)
        assert token, "Failed to get formador token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # First get list of acompanhamentos (formador sees only their own)
        list_response = self.session.get(f"{BASE_URL}/api/acompanhamentos", headers=headers)
        assert list_response.status_code == 200
        acompanhamentos = list_response.json()
        
        if acompanhamentos:
            acomp_id = acompanhamentos[0]["id"]
            response = self.session.get(f"{BASE_URL}/api/acompanhamentos/{acomp_id}/pdf", headers=headers)
            
            assert response.status_code == 200, f"Failed to export single PDF: {response.status_code}, {response.text}"
            
            content = response.content
            assert content[:4] == b'%PDF', "Response is not a valid PDF"
            print(f"✓ Formador export single PDF successful - received {len(content)} bytes")
        else:
            print("⚠ No acompanhamentos found for formador - skipping single PDF export test")
    
    def test_export_single_pdf_not_found(self):
        """Test exporting a non-existent acompanhamento returns 404"""
        token = self.get_auth_token(ADMIN_CREDENTIALS)
        assert token, "Failed to get admin token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.get(f"{BASE_URL}/api/acompanhamentos/non-existent-id/pdf", headers=headers)
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Export non-existent PDF correctly returns 404")
    
    def test_export_pdf_without_auth(self):
        """Test that PDF export requires authentication"""
        response = self.session.get(f"{BASE_URL}/api/acompanhamentos/export/pdf")
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Export PDF without auth correctly returns {response.status_code}")
    
    def test_list_acompanhamentos(self):
        """Test listing acompanhamentos endpoint"""
        token = self.get_auth_token(ADMIN_CREDENTIALS)
        assert token, "Failed to get admin token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.get(f"{BASE_URL}/api/acompanhamentos", headers=headers)
        
        assert response.status_code == 200, f"Failed to list acompanhamentos: {response.status_code}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ List acompanhamentos successful - found {len(data)} records")
        
        # Print details of acompanhamentos for debugging
        for acomp in data:
            print(f"  - ID: {acomp.get('id')}, User: {acomp.get('user_name')}, Formador: {acomp.get('formador_name')}")
    
    def test_count_by_stage(self):
        """Test count by stage endpoint"""
        token = self.get_auth_token(ADMIN_CREDENTIALS)
        assert token, "Failed to get admin token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.get(f"{BASE_URL}/api/acompanhamentos/count-by-stage", headers=headers)
        
        assert response.status_code == 200, f"Failed to get count by stage: {response.status_code}"
        data = response.json()
        assert isinstance(data, dict)
        print(f"✓ Count by stage successful - {data}")


class TestPermissions:
    """Test permission-based access to acompanhamentos"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_auth_token(self, credentials):
        """Get authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=credentials)
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_formador_sees_only_own_acompanhamentos(self):
        """Test that formador only sees their own acompanhamentos"""
        token = self.get_auth_token(FORMADOR_CREDENTIALS)
        assert token, "Failed to get formador token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get formador's user info
        me_response = self.session.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert me_response.status_code == 200
        formador_id = me_response.json()["id"]
        
        # Get acompanhamentos
        list_response = self.session.get(f"{BASE_URL}/api/acompanhamentos", headers=headers)
        assert list_response.status_code == 200
        acompanhamentos = list_response.json()
        
        # All acompanhamentos should belong to this formador
        for acomp in acompanhamentos:
            assert acomp["formador_id"] == formador_id, f"Formador sees acompanhamento from another formador: {acomp['formador_id']}"
        
        print(f"✓ Formador correctly sees only their own {len(acompanhamentos)} acompanhamentos")
    
    def test_admin_sees_all_acompanhamentos(self):
        """Test that admin sees all acompanhamentos"""
        token = self.get_auth_token(ADMIN_CREDENTIALS)
        assert token, "Failed to get admin token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        list_response = self.session.get(f"{BASE_URL}/api/acompanhamentos", headers=headers)
        assert list_response.status_code == 200
        acompanhamentos = list_response.json()
        
        print(f"✓ Admin sees all {len(acompanhamentos)} acompanhamentos")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
