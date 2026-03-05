from rest_framework import status
from rest_framework.test import APITestCase

from references.models import (
    DigitalDirection,
    Enterprise,
    EnterpriseBlockMapping,
    FunctionalBlock,
    FunctionReference,
    Integrator,
    Vendor,
)


class TestReferencesApi(APITestCase):
    def setUp(self):
        FunctionalBlock.objects.create(id=1, name="Block 1")
        FunctionalBlock.objects.create(id=2, name="Block 2")
        FunctionReference.objects.create(name="Function 1", block_id=1)
        DigitalDirection.objects.create(id=1, name="Direction 1", quadrant=2)
        Enterprise.objects.create(id=1, name="Enterprise 1", code="E1")
        EnterpriseBlockMapping.objects.create(enterprise_id=1, block_id=1)
        Vendor.objects.create(name="Vendor 1")
        Integrator.objects.create(name="Integrator 1")

    def test_get_supported_references(self):
        names = [
            "blocks",
            "functions",
            "functionToBlock",
            "digitalDirections",
            "directionToQuadrant",
            "vendors",
            "integrators",
            "enterprises",
            "enterprisesBlocksMapping",
        ]
        for name in names:
            response = self.client.get(f"/api/v1/references/{name}")
            self.assertEqual(response.status_code, status.HTTP_200_OK, msg=name)

    def test_put_vendors(self):
        payload = ["Vendor A", "Vendor B"]
        response = self.client.put("/api/v1/references/vendors", data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        get_response = self.client.get("/api/v1/references/vendors")
        self.assertEqual(get_response.data, ["Vendor A", "Vendor B"])
