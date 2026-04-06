from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management.color import no_style
from django.db import connection
from rest_framework import status
from rest_framework.test import APITestCase

from admin_panel.models import AuditLog
from auth_custom.models import UserProfile
from auth_custom.totp_utils import generate_totp_token
from references.models import (
    DigitalDirection,
    Enterprise,
    EnterpriseBlockMapping,
    FunctionalBlock,
    FunctionReference,
)
from technologies.models import Technology, TechnologyProposal

User = get_user_model()


class TestTechnologiesApi(APITestCase):
    TEST_2FA_SECRET = "JBSWY3DPEHPK3PXP"

    def setUp(self):
        cache.clear()
        FunctionalBlock.objects.create(id=1, name="Block 1")
        FunctionalBlock.objects.create(id=2, name="Block 2")
        sequence_sql = connection.ops.sequence_reset_sql(no_style(), [FunctionalBlock])
        if sequence_sql:
            with connection.cursor() as cursor:
                for sql in sequence_sql:
                    cursor.execute(sql)
        DigitalDirection.objects.create(id=1, name="Direction 1", quadrant=1)
        DigitalDirection.objects.create(id=2, name="Direction 2", quadrant=2)
        Enterprise.objects.create(id=1, name="Enterprise 1", code="E1")
        Enterprise.objects.create(id=2, name="Enterprise 2", code="E2")
        FunctionReference.objects.create(name="Function A", block_id=1)
        FunctionReference.objects.create(name="Function B", block_id=2)

        self.owner = User.objects.create_user(username="owner", password="owner123")
        owner_profile, _ = UserProfile.objects.get_or_create(user=self.owner)
        owner_profile.role = UserProfile.ROLE_OWNER
        owner_profile.is_2fa_enabled = True
        owner_profile.totp_secret = self.TEST_2FA_SECRET
        owner_profile.save(update_fields=["role", "is_2fa_enabled", "totp_secret", "updated_at"])

        self.editor = User.objects.create_user(username="editor", password="editor123")
        editor_profile, _ = UserProfile.objects.get_or_create(user=self.editor)
        editor_profile.role = UserProfile.ROLE_EDITOR
        editor_profile.is_2fa_enabled = True
        editor_profile.totp_secret = self.TEST_2FA_SECRET
        editor_profile.save(update_fields=["role", "is_2fa_enabled", "totp_secret", "updated_at"])

        self.guest = User.objects.create_user(username="guest", password="guest123")
        guest_profile, _ = UserProfile.objects.get_or_create(user=self.guest)
        guest_profile.role = UserProfile.ROLE_GUEST
        guest_profile.is_2fa_enabled = True
        guest_profile.totp_secret = self.TEST_2FA_SECRET
        guest_profile.save(update_fields=["role", "is_2fa_enabled", "totp_secret", "updated_at"])

        self.owner_token = self._login("owner", "owner123")
        self.editor_token = self._login("editor", "editor123")
        self.guest_token = self._login("guest", "guest123")

    def tearDown(self):
        cache.clear()

    def _login(self, username, password):
        response = self.client.post(
            "/api/v1/auth/login",
            data={"username": username, "password": password},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get("requires_2fa"))
        session_id = response.data["session_id"]

        verify_response = self.client.post(
            "/api/v1/auth/2fa/verify",
            data={"session_id": session_id, "code": generate_totp_token(self.TEST_2FA_SECRET)},
            format="json",
        )
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)
        return verify_response.data["access_token"]

    @staticmethod
    def payload(name="Tech 1", enterprise_id=1):
        return {
            "name": name,
            "description": "Description",
            "block": 1,
            "blocks": [1, 2],
            "functionCoverage": ["Function A", "Function B"],
            "enterprises": [
                {
                    "enterpriseId": enterprise_id,
                    "technologicalReadiness": 3,
                    "organizationalReadiness": 4,
                    "status": "Внедрена",
                }
            ],
            "directions": [1, 2],
            "trlStage": 5,
            "status": "Внедрена",
            "vendors": [
                {"name": "Vendor 1", "integrators": ["Integrator 1", "Integrator 2"]},
                {"name": "Vendor 2", "integrators": ["Integrator 3"]},
            ],
            "marketExamples": ["Example A"],
            "documentationFiles": ["doc-a.pdf"],
        }

    def test_create_and_get_technology(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        response = self.client.post("/api/v1/technologies", data=self.payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        tech_id = response.data["id"]
        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditLog.ACTION_CREATE,
                entity_type="technology",
                entity_id=str(tech_id),
            ).exists()
        )

        get_response = self.client.get(f"/api/v1/technologies/{tech_id}")
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(get_response.data["name"], "Tech 1")
        self.assertEqual(len(get_response.data["vendors"]), 2)
        self.assertEqual(get_response.data["trlStage"], 5)

    def test_list_filter_by_enterprise_id(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        self.client.post(
            "/api/v1/technologies",
            data=self.payload(name="Tech E1", enterprise_id=1),
            format="json",
        )
        self.client.post(
            "/api/v1/technologies",
            data=self.payload(name="Tech E2", enterprise_id=2),
            format="json",
        )

        response = self.client.get("/api/v1/technologies?enterpriseId=1")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Tech E1")

    def test_update_and_delete_technology(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        create_response = self.client.post(
            "/api/v1/technologies", data=self.payload(), format="json"
        )
        tech_id = create_response.data["id"]

        patch_response = self.client.patch(
            f"/api/v1/technologies/{tech_id}",
            data={"name": "Tech Updated", "trlStage": 7},
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.data["name"], "Tech Updated")
        self.assertEqual(patch_response.data["trlStage"], 7)
        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditLog.ACTION_UPDATE,
                entity_type="technology",
                entity_id=str(tech_id),
            ).exists()
        )

        delete_response = self.client.delete(f"/api/v1/technologies/{tech_id}")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Technology.objects.filter(id=tech_id).exists())
        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditLog.ACTION_DELETE,
                entity_type="technology",
                entity_id=str(tech_id),
            ).exists()
        )

    def test_bulk_upsert(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        created = self.client.post(
            "/api/v1/technologies", data=self.payload(name="Bulk Base"), format="json"
        )
        tech_id = created.data["id"]

        bulk_payload = [
            {
                "id": tech_id,
                "name": "Bulk Updated",
                "trlStage": 6,
            },
            self.payload(name="Bulk New", enterprise_id=2),
        ]
        response = self.client.put("/api/v1/technologies/bulk", data=bulk_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Technology.objects.count(), 2)
        self.assertEqual(Technology.objects.get(id=tech_id).name, "Bulk Updated")
        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditLog.ACTION_UPDATE,
                entity_type="technology_bulk",
            ).exists()
        )

    def test_bulk_upsert_by_name_when_id_is_unknown(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        created = self.client.post(
            "/api/v1/technologies", data=self.payload(name="Bulk Name Match"), format="json"
        )
        tech_id = created.data["id"]

        bulk_payload = [
            {
                "id": 999999,
                "name": "Bulk Name Match",
                "trlStage": 8,
            }
        ]
        response = self.client.put("/api/v1/technologies/bulk", data=bulk_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Technology.objects.count(), 1)
        self.assertEqual(Technology.objects.get(id=tech_id).trl_stage, 8)

    def test_create_duplicate_name_returns_400(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        first = self.client.post(
            "/api/v1/technologies", data=self.payload(name="Tech Duplicate"), format="json"
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        second = self.client.post(
            "/api/v1/technologies", data=self.payload(name="Tech Duplicate"), format="json"
        )
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(second.data["ok"])
        self.assertEqual(second.data["code"], "bad_request")
        self.assertIn("name", second.data["details"])

    def test_invalid_enterprise_filter_returns_400(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        response = self.client.get("/api/v1/technologies?enterpriseId=bad")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["ok"])
        self.assertEqual(response.data["code"], "bad_request")

    def test_requires_authentication(self):
        response = self.client.get("/api/v1/technologies")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data["ok"])
        self.assertEqual(response.data["code"], "unauthorized")

    def test_guest_cannot_write(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.guest_token}")
        response = self.client.post(
            "/api/v1/technologies", data=self.payload(name="Guest Tech"), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(response.data["ok"])
        self.assertEqual(response.data["code"], "forbidden")

    def test_editor_cannot_write_technology_directly(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.editor_token}")
        response = self.client.post(
            "/api/v1/technologies", data=self.payload(name="Editor Tech"), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(response.data["ok"])
        self.assertEqual(response.data["code"], "forbidden")

    def test_create_with_duplicate_directions_returns_400(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        bad_payload = self.payload(name="Duplicate Directions")
        bad_payload["directions"] = [1, 1]
        response = self.client.post("/api/v1/technologies", data=bad_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["ok"])
        self.assertEqual(response.data["code"], "bad_request")
        self.assertIn("directions", response.data["details"])

    def test_create_with_duplicate_enterprise_rows_returns_400(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        bad_payload = self.payload(name="Duplicate Enterprises")
        bad_payload["enterprises"] = [
            {
                "enterpriseId": 1,
                "technologicalReadiness": 3,
                "organizationalReadiness": 3,
                "status": "planned",
            },
            {
                "enterpriseId": 1,
                "technologicalReadiness": 4,
                "organizationalReadiness": 4,
                "status": "planned",
            },
        ]
        response = self.client.post("/api/v1/technologies", data=bad_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["ok"])
        self.assertEqual(response.data["code"], "bad_request")
        self.assertIn("enterprises.enterpriseId", response.data["details"])

    def test_editor_can_create_update_proposal_and_owner_can_approve(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        create_response = self.client.post(
            "/api/v1/technologies",
            data=self.payload(name="Tech For Proposal"),
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        tech_id = create_response.data["id"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.editor_token}")
        proposal_response = self.client.post(
            "/api/v1/technology-proposals",
            data={
                "action": "update",
                "technologyId": tech_id,
                "payload": {"name": "Tech Approved From Proposal", "trlStage": 8},
                "comment": "Need rename and raise TRL",
            },
            format="json",
        )
        self.assertEqual(proposal_response.status_code, status.HTTP_201_CREATED)
        proposal_id = proposal_response.data["id"]
        self.assertEqual(proposal_response.data["status"], "draft")

        mine_response = self.client.get("/api/v1/technology-proposals/mine")
        self.assertEqual(mine_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mine_response.data), 1)
        self.assertEqual(mine_response.data[0]["id"], proposal_id)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        pending_response = self.client.get("/api/v1/technology-proposals/pending")
        self.assertEqual(pending_response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(row["id"] == proposal_id for row in pending_response.data))

        approve_response = self.client.post(
            f"/api/v1/technology-proposals/{proposal_id}/approve",
            data={"review_comment": "Approved"},
            format="json",
        )
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)
        self.assertEqual(approve_response.data["status"], "approved")

        tech_response = self.client.get(f"/api/v1/technologies/{tech_id}")
        self.assertEqual(tech_response.status_code, status.HTTP_200_OK)
        self.assertEqual(tech_response.data["name"], "Tech Approved From Proposal")
        self.assertEqual(tech_response.data["trlStage"], 8)

    def test_guest_cannot_create_proposal(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.guest_token}")
        response = self.client.post(
            "/api/v1/technology-proposals",
            data={
                "action": "create",
                "payload": {"name": "Guest Draft", "blocks": [1], "block": 1},
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_reject_proposal(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.editor_token}")
        proposal_response = self.client.post(
            "/api/v1/technology-proposals",
            data={
                "action": "create",
                "payload": {
                    "name": "Rejected Draft",
                    "description": "draft",
                    "block": 1,
                    "blocks": [1],
                    "functionCoverage": ["Function A"],
                    "enterprises": [
                        {
                            "enterpriseId": 1,
                            "technologicalReadiness": 3,
                            "organizationalReadiness": 3,
                            "status": "planned",
                        }
                    ],
                    "directions": [1],
                    "trlStage": 3,
                    "status": "planned",
                    "vendors": [],
                },
            },
            format="json",
        )
        self.assertEqual(proposal_response.status_code, status.HTTP_201_CREATED)
        proposal_id = proposal_response.data["id"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        reject_response = self.client.post(
            f"/api/v1/technology-proposals/{proposal_id}/reject",
            data={"review_comment": "Needs more detail"},
            format="json",
        )
        self.assertEqual(reject_response.status_code, status.HTTP_200_OK)
        self.assertEqual(reject_response.data["status"], "rejected")

    def test_owner_can_postpone_proposal(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.editor_token}")
        proposal_response = self.client.post(
            "/api/v1/technology-proposals",
            data={
                "action": "create",
                "payload": {
                    "name": "Postponed Draft",
                    "description": "draft",
                    "block": 1,
                    "blocks": [1],
                    "functionCoverage": ["Function A"],
                    "enterprises": [
                        {
                            "enterpriseId": 1,
                            "technologicalReadiness": 3,
                            "organizationalReadiness": 3,
                            "status": "planned",
                        }
                    ],
                    "directions": [1],
                    "trlStage": 3,
                    "status": "planned",
                    "vendors": [],
                },
            },
            format="json",
        )
        proposal_id = proposal_response.data["id"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        postpone_response = self.client.post(
            f"/api/v1/technology-proposals/{proposal_id}/postpone",
            data={"review_comment": "Need to revisit later"},
            format="json",
        )
        self.assertEqual(postpone_response.status_code, status.HTTP_200_OK)
        self.assertEqual(postpone_response.data["status"], "postponed")

    def test_owner_can_approve_postponed_proposal(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.editor_token}")
        proposal_response = self.client.post(
            "/api/v1/technology-proposals",
            data={"action": "create", "payload": self.payload(name="Approve Postponed")},
            format="json",
        )
        proposal_id = proposal_response.data["id"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        self.client.post(
            f"/api/v1/technology-proposals/{proposal_id}/postpone",
            data={"review_comment": "Later"},
            format="json",
        )
        approve_response = self.client.post(
            f"/api/v1/technology-proposals/{proposal_id}/approve",
            data={"review_comment": "Now approved"},
            format="json",
        )
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)
        self.assertEqual(approve_response.data["status"], "approved")

    def test_owner_can_reject_postponed_proposal(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.editor_token}")
        proposal_response = self.client.post(
            "/api/v1/technology-proposals",
            data={"action": "create", "payload": self.payload(name="Reject Postponed")},
            format="json",
        )
        proposal_id = proposal_response.data["id"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        self.client.post(
            f"/api/v1/technology-proposals/{proposal_id}/postpone",
            data={"review_comment": "Later"},
            format="json",
        )
        reject_response = self.client.post(
            f"/api/v1/technology-proposals/{proposal_id}/reject",
            data={"review_comment": "Rejected later"},
            format="json",
        )
        self.assertEqual(reject_response.status_code, status.HTTP_200_OK)
        self.assertEqual(reject_response.data["status"], "rejected")

    def test_editor_history_endpoint_returns_reviewed_and_postponed_items(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.editor_token}")
        approved_response = self.client.post(
            "/api/v1/technology-proposals",
            data={"action": "create", "payload": self.payload(name="History Approved")},
            format="json",
        )
        postponed_response = self.client.post(
            "/api/v1/technology-proposals",
            data={"action": "create", "payload": self.payload(name="History Postponed")},
            format="json",
        )
        approved_id = approved_response.data["id"]
        postponed_id = postponed_response.data["id"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        self.client.post(
            f"/api/v1/technology-proposals/{approved_id}/approve",
            data={"review_comment": "Approved"},
            format="json",
        )
        self.client.post(
            f"/api/v1/technology-proposals/{postponed_id}/postpone",
            data={"review_comment": "Postponed"},
            format="json",
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.editor_token}")
        history_response = self.client.get("/api/v1/technology-proposals/mine/history")
        self.assertEqual(history_response.status_code, status.HTTP_200_OK)
        returned_statuses = {item["status"] for item in history_response.data}
        self.assertIn("approved", returned_statuses)
        self.assertIn("postponed", returned_statuses)

    def test_owner_review_history_endpoint_returns_non_draft_items(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.editor_token}")
        rejected_response = self.client.post(
            "/api/v1/technology-proposals",
            data={"action": "create", "payload": self.payload(name="History Rejected")},
            format="json",
        )
        rejected_id = rejected_response.data["id"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        self.client.post(
            f"/api/v1/technology-proposals/{rejected_id}/reject",
            data={"review_comment": "Rejected"},
            format="json",
        )
        history_response = self.client.get("/api/v1/technology-proposals/history")
        self.assertEqual(history_response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(item["id"] == rejected_id for item in history_response.data))

    def test_editor_can_clear_only_reviewed_proposal_history(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.editor_token}")
        reviewed_response = self.client.post(
            "/api/v1/technology-proposals",
            data={
                "action": "create",
                "payload": {
                    "name": "History Reviewed Draft",
                    "description": "draft",
                    "block": 1,
                    "blocks": [1],
                    "functionCoverage": ["Function A"],
                    "enterprises": [
                        {
                            "enterpriseId": 1,
                            "technologicalReadiness": 3,
                            "organizationalReadiness": 3,
                            "status": "planned",
                        }
                    ],
                    "directions": [1],
                    "trlStage": 3,
                    "status": "planned",
                    "vendors": [],
                },
            },
            format="json",
        )
        draft_response = self.client.post(
            "/api/v1/technology-proposals",
            data={
                "action": "create",
                "payload": {
                    "name": "History Active Draft",
                    "description": "draft",
                    "block": 1,
                    "blocks": [1],
                    "functionCoverage": ["Function A"],
                    "enterprises": [
                        {
                            "enterpriseId": 1,
                            "technologicalReadiness": 2,
                            "organizationalReadiness": 2,
                            "status": "planned",
                        }
                    ],
                    "directions": [1],
                    "trlStage": 2,
                    "status": "planned",
                    "vendors": [],
                },
            },
            format="json",
        )
        self.assertEqual(reviewed_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(draft_response.status_code, status.HTTP_201_CREATED)

        reviewed_id = reviewed_response.data["id"]
        draft_id = draft_response.data["id"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        approve_response = self.client.post(
            f"/api/v1/technology-proposals/{reviewed_id}/approve",
            data={"review_comment": "Approved for history cleanup"},
            format="json",
        )
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.editor_token}")
        clear_response = self.client.delete("/api/v1/technology-proposals/mine/history")
        self.assertEqual(clear_response.status_code, status.HTTP_200_OK)
        self.assertEqual(clear_response.data["deleted_count"], 1)
        self.assertTrue(TechnologyProposal.objects.filter(id=reviewed_id).exists())
        self.assertTrue(
            TechnologyProposal.objects.filter(
                id=reviewed_id,
                hidden_from_creator_history=True,
            ).exists()
        )
        self.assertTrue(TechnologyProposal.objects.filter(id=draft_id).exists())

    def test_editor_can_clear_selected_reviewed_proposals_only(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.editor_token}")
        first_response = self.client.post(
            "/api/v1/technology-proposals",
            data={
                "action": "create",
                "payload": {
                    "name": "History Selected One",
                    "description": "draft",
                    "block": 1,
                    "blocks": [1],
                    "functionCoverage": ["Function A"],
                    "enterprises": [{"enterpriseId": 1, "technologicalReadiness": 3, "organizationalReadiness": 3, "status": "planned"}],
                    "directions": [1],
                    "trlStage": 3,
                    "status": "planned",
                    "vendors": [],
                },
            },
            format="json",
        )
        second_response = self.client.post(
            "/api/v1/technology-proposals",
            data={
                "action": "create",
                "payload": {
                    "name": "History Selected Two",
                    "description": "draft",
                    "block": 1,
                    "blocks": [1],
                    "functionCoverage": ["Function A"],
                    "enterprises": [{"enterpriseId": 1, "technologicalReadiness": 3, "organizationalReadiness": 3, "status": "planned"}],
                    "directions": [1],
                    "trlStage": 3,
                    "status": "planned",
                    "vendors": [],
                },
            },
            format="json",
        )
        first_id = first_response.data["id"]
        second_id = second_response.data["id"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        self.client.post(f"/api/v1/technology-proposals/{first_id}/reject", data={"review_comment": "Reject first"}, format="json")
        self.client.post(f"/api/v1/technology-proposals/{second_id}/reject", data={"review_comment": "Reject second"}, format="json")

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.editor_token}")
        clear_response = self.client.delete(
            "/api/v1/technology-proposals/mine/history",
            data={"ids": [first_id]},
            format="json",
        )
        self.assertEqual(clear_response.status_code, status.HTTP_200_OK)
        self.assertEqual(clear_response.data["deleted_count"], 1)
        self.assertTrue(
            TechnologyProposal.objects.filter(
                id=first_id,
                hidden_from_creator_history=True,
            ).exists()
        )
        self.assertTrue(TechnologyProposal.objects.filter(id=second_id).exists())

    def test_editor_history_cleanup_does_not_remove_owner_review_history(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.editor_token}")
        proposal_response = self.client.post(
            "/api/v1/technology-proposals",
            data={"action": "create", "payload": self.payload(name="History Shared Visibility")},
            format="json",
        )
        self.assertEqual(proposal_response.status_code, status.HTTP_201_CREATED)
        proposal_id = proposal_response.data["id"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        review_response = self.client.post(
            f"/api/v1/technology-proposals/{proposal_id}/approve",
            data={"review_comment": "Keep in owner history"},
            format="json",
        )
        self.assertEqual(review_response.status_code, status.HTTP_200_OK)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.editor_token}")
        clear_response = self.client.delete(
            "/api/v1/technology-proposals/mine/history",
            data={"ids": [proposal_id]},
            format="json",
        )
        self.assertEqual(clear_response.status_code, status.HTTP_200_OK)
        self.assertEqual(clear_response.data["deleted_count"], 1)

        my_history_response = self.client.get("/api/v1/technology-proposals/mine/history")
        self.assertEqual(my_history_response.status_code, status.HTTP_200_OK)
        self.assertFalse(any(item["id"] == proposal_id for item in my_history_response.data))

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        owner_history_response = self.client.get("/api/v1/technology-proposals/history")
        self.assertEqual(owner_history_response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(item["id"] == proposal_id for item in owner_history_response.data))

    def test_editor_can_submit_functional_block_proposal_and_owner_can_approve(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.editor_token}")
        proposal_response = self.client.post(
            "/api/v1/technology-proposals",
            data={
                "action": "create",
                "payload": {
                    "referenceType": "functional_block",
                    "operation": "create_block",
                    "blockName": "Proposed Block",
                    "enterpriseIds": [1, 2],
                    "directionName": "Direction 1",
                },
                "comment": "Need a new functional block",
            },
            format="json",
        )
        self.assertEqual(proposal_response.status_code, status.HTTP_201_CREATED)
        proposal_id = proposal_response.data["id"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        approve_response = self.client.post(
            f"/api/v1/technology-proposals/{proposal_id}/approve",
            data={"review_comment": "Approved block proposal"},
            format="json",
        )
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)
        self.assertEqual(approve_response.data["status"], "approved")
        self.assertTrue(FunctionalBlock.objects.filter(name="Proposed Block").exists())
        block = FunctionalBlock.objects.get(name="Proposed Block")
        self.assertTrue(
            EnterpriseBlockMapping.objects.filter(enterprise_id=1, block=block).exists()
        )
        self.assertTrue(
            EnterpriseBlockMapping.objects.filter(enterprise_id=2, block=block).exists()
        )
