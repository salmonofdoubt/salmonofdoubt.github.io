import unittest
from unittest.mock import patch
from signals import discover,operator_status
from collector import collect
import urllib.error

class SignalsTests(unittest.TestCase):
    def test_discovery_is_provider_scoped_and_deduplicated(self):
        html='<a href="/api/docs/models/gpt-7-test">model</a><a href="https://evil.example/api/docs/models/gpt-9">fake</a><a href="/api/docs/models/gpt-7-test">repeat</a><a href="/api/docs/models/overview">menu</a>'
        entries=discover(html,'https://developers.openai.com/api/docs/models','OpenAI')
        self.assertEqual([e['id'] for e in entries],['gpt-7-test'])
        self.assertIn('pending',entries[0]['evidence'])
    def test_all_catalogue_adapters(self):
        self.assertEqual(discover('<a href="/gemini-api/docs/models/gemini-4-test">m</a>','https://ai.google.dev/gemini-api/docs/models','Google')[0]['id'],'gemini-4-test')
        self.assertEqual(discover('<a href="/docs/en/models/sonnet-6/overview">m</a>','https://platform.claude.com/docs/en/models/overview','Anthropic')[0]['id'],'claude-sonnet-6')
    def test_status_does_not_borrow_other_product_health(self):
        payload={'components':[{'name':'API','status':'operational'},{'name':'ChatGPT','status':'major_outage'}]}
        self.assertEqual(operator_status(payload,'ChatGPT')['status'],'unavailable')
        self.assertEqual(operator_status(payload,'claude.ai')['status'],'unknown')
        payload['components'][1]['status']='degraded_performance'
        self.assertEqual(operator_status(payload,'ChatGPT')['status'],'degraded')
    def test_failed_status_check_preserves_old_evidence_but_is_blocked(self):
        source={'id':'s','url':'https://status.example/api','kind':'operator_status','title':'status','component_match':'chat'}
        with patch('collector.request',side_effect=urllib.error.HTTPError(source['url'],403,'Denied',{},None)):
            item,_=collect(source,{'last_success':'2020-01-01T00:00:00Z','operator':{'status':'serving'}})
        self.assertEqual(item['status'],'blocked')
        self.assertEqual(item['last_success'],'2020-01-01T00:00:00Z')
if __name__=='__main__':unittest.main()
