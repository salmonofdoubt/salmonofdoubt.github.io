import unittest
from signals import google_workspace_status
class GoogleStatusTests(unittest.TestCase):
    def test_no_incidents(self):
        self.assertEqual(google_workspace_status([])['status'],'serving')
    def test_ended_incident(self):
        self.assertEqual(google_workspace_status([{'service_name':'Gemini','end':'2026-10-01','status_impact':'SERVICE_OUTAGE'}])['status'],'serving')
    def test_other_product(self):
        self.assertEqual(google_workspace_status([{'service_name':'Gmail','status_impact':'SERVICE_OUTAGE'}])['status'],'serving')
    def test_degraded(self):
        self.assertEqual(google_workspace_status([{'service_name':'Gemini','status_impact':'SERVICE_DISRUPTION'}])['status'],'degraded')
    def test_outage(self):
        self.assertEqual(google_workspace_status([{'affected_products':[{'title':'Gemini'}],'most_recent_update':{'status':'SERVICE_OUTAGE'}}])['status'],'unavailable')
    def test_information_is_not_outage(self):
        self.assertEqual(google_workspace_status([{'service_name':'Gemini','status_impact':'SERVICE_INFORMATION'}])['status'],'unknown')
    def test_changed_schema(self):
        with self.assertRaises(ValueError):google_workspace_status({'unexpected':[]})
