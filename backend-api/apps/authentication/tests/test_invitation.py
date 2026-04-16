from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from django.contrib.auth import get_user_model
from apps.authentication.models import Role, UserInvitation

User = get_user_model()

class InvitationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.role_admin = Role.objects.create(name='admin')
        self.role_user = Role.objects.create(name='user')
        self.admin_user = User.objects.create_superuser(
            email='admin@example.com',
            username='admin',
            password='password123',
            role=self.role_admin
        )
        self.invite_url = reverse('auth-invite')
        self.accept_url = reverse('auth-invite-accept')

    def test_send_invitation_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        data = {
            'email': 'newuser@example.com',
            'role': 'user'
        }
        response = self.client.post(self.invite_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(UserInvitation.objects.filter(email='newuser@example.com').exists())

    def test_accept_invitation(self):
        # Create invitation first
        invitation = UserInvitation.objects.create(
            email='invited@example.com',
            role=self.role_user,
            invited_by=self.admin_user,
            token='test-token',
            temp_password='hashed-temp-password',
            expires_at='2099-12-31 23:59:59' # Far future
        )
        
        data = {
            'token': 'test-token',
            'password': 'newpassword123',
            'confirm_password': 'newpassword123'
        }
        
        response = self.client.post(self.accept_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check user created
        user = User.objects.get(email='invited@example.com')
        self.assertTrue(user.check_password('newpassword123'))
        self.assertEqual(user.role, self.role_user)
        
        # Check invitation marked used
        invitation.refresh_from_db()
        self.assertTrue(invitation.is_used)

    def test_accept_invitation_invalid_token(self):
        data = {
            'token': 'invalid-token',
            'password': 'newpassword123',
            'confirm_password': 'newpassword123'
        }
        response = self.client.post(self.accept_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_accept_invitation_expired(self):
         invitation = UserInvitation.objects.create(
            email='expired@example.com',
            role=self.role_user,
            invited_by=self.admin_user,
            token='expired-token',
            temp_password='hashed-temp-password',
            expires_at='2020-01-01 00:00:00' # Past
        )
         data = {
            'token': 'expired-token',
            'password': 'newpassword123',
            'confirm_password': 'newpassword123'
        }
         response = self.client.post(self.accept_url, data)
         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
