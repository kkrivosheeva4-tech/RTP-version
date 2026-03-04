from rest_framework import status
from rest_framework.test import APITestCase

from references.models import DigitalDirection, Enterprise, FunctionalBlock, FunctionReference
from technologies.models import Technology


class TestTechnologiesApi(APITestCase):
    def setUp(self):
        FunctionalBlock.objects.create(id=1, name="Block 1")
        FunctionalBlock.objects.create(id=2, name="Block 2")
        DigitalDirection.objects.create(id=1, name="Direction 1", quadrant=1)
        DigitalDirection.objects.create(id=2, name="Direction 2", quadrant=2)
        Enterprise.objects.create(id=1, name="Enterprise 1", code="E1")
        Enterprise.objects.create(id=2, name="Enterprise 2", code="E2")
        FunctionReference.objects.create(name="Function A", block_id=1)
        FunctionReference.objects.create(name="Function B", block_id=2)

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
        response = self.client.post("/api/v1/technologies", data=self.payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        tech_id = response.data["id"]

        get_response = self.client.get(f"/api/v1/technologies/{tech_id}")
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(get_response.data["name"], "Tech 1")
        self.assertEqual(len(get_response.data["vendors"]), 2)
        self.assertEqual(get_response.data["trlStage"], 5)

    def test_list_filter_by_enterprise_id(self):
        self.client.post("/api/v1/technologies", data=self.payload(name="Tech E1", enterprise_id=1), format="json")
        self.client.post("/api/v1/technologies", data=self.payload(name="Tech E2", enterprise_id=2), format="json")

        response = self.client.get("/api/v1/technologies?enterpriseId=1")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Tech E1")

    def test_update_and_delete_technology(self):
        create_response = self.client.post("/api/v1/technologies", data=self.payload(), format="json")
        tech_id = create_response.data["id"]

        patch_response = self.client.patch(
            f"/api/v1/technologies/{tech_id}",
            data={"name": "Tech Updated", "trlStage": 7},
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.data["name"], "Tech Updated")
        self.assertEqual(patch_response.data["trlStage"], 7)

        delete_response = self.client.delete(f"/api/v1/technologies/{tech_id}")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Technology.objects.filter(id=tech_id).exists())

    def test_bulk_upsert(self):
        created = self.client.post("/api/v1/technologies", data=self.payload(name="Bulk Base"), format="json")
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

    def test_invalid_enterprise_filter_returns_400(self):
        response = self.client.get("/api/v1/technologies?enterpriseId=bad")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
