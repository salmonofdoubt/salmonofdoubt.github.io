"""Offline tests for EnvAI: only direct, reachable, tool-like websites appear."""
from __future__ import annotations
import datetime as dt
import importlib.util
from pathlib import Path
import unittest

SCRIPT=Path(__file__).resolve().parents[1]/'scripts/envai_auto_update.py'
spec=importlib.util.spec_from_file_location('envai_auto_update',SCRIPT)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
TODAY=dt.date(2026,11,19)
CAT={'items':[
 {'id':'deepforest','title':'DeepForest','url':'https://github.com/weecology/DeepForest','aiType':'AI-native'},
 {'id':'qgis','title':'QGIS','url':'https://qgis.org/','aiType':'Traditional digital'},
]}

def repo(**overrides):
    data={'full_name':'example/whale-map','name':'whale-map',
      'description':'Interactive whale sightings map and monitoring dashboard',
      'homepage':'https://whale-map.example.org/explore',
      'topics':['marine-conservation','webapp'],'created_at':'2026-11-18T10:00:00Z',
      'html_url':'https://github.com/example/whale-map','fork':False,
      'archived':False,'disabled':False,'stargazers_count':3}
    return {**data,**overrides}

class ScanningTests(unittest.TestCase):
 def fake(self,path,params=None):
  if path=='/repos/weecology/DeepForest/releases':
   return [{'tag_name':'v1.2.3','name':'New version','published_at':'2026-11-18T10:00:00Z',
    'draft':False,'prerelease':False,'html_url':'https://github.com/weecology/DeepForest/releases/tag/v1.2.3'}]
  if path=='/search/repositories':
   return {'items':[repo()]}
  return []
 def scan(self,**kwargs):
  return mod.scan(fetch=self.fake,probe=lambda url: True,today=TODAY,catalogue=CAT,
     previous={'releaseEvents':[],'leads':[]},**kwargs)
 def test_official_release_and_direct_tool_website(self):
  result,stats=self.scan()
  self.assertEqual(result['scanStatus'],'ok')
  self.assertEqual(len(result['releaseEvents']),1)
  self.assertEqual(result['releaseEvents'][0]['toolId'],'deepforest')
  self.assertEqual(result['releaseEvents'][0]['eventDate'],'2026-11-18')
  self.assertEqual(len(result['leads']),1)
  lead=result['leads'][0]
  self.assertEqual(lead['domain'],'Water & oceans')
  self.assertEqual(lead['url'],'https://whale-map.example.org/explore')
  self.assertEqual(lead['evidence'],'https://github.com/example/whale-map')
  self.assertEqual(lead['accessType'],'web')
  self.assertTrue(lead['siteReachable'])
  self.assertEqual(lead['aiType'],'Unverified')
  self.assertIn('not verified',lead['status'])
  self.assertEqual(stats['leadsAdded'],1)
 def test_repeated_scans_are_idempotent(self):
  first,_=self.scan()
  second,stats=mod.scan(fetch=self.fake,probe=lambda url:True,today=TODAY,catalogue=CAT,previous=first)
  self.assertEqual(stats['releasesAdded'],0)
  self.assertEqual(stats['leadsAdded'],0)
  self.assertEqual(second['releaseEvents'],first['releaseEvents'])
  self.assertEqual(second['leads'],first['leads'])
 def test_failed_source_keeps_previous_valid_data(self):
  previous={'releaseEvents':[{'id':'rel:1','eventDate':'2026-11-17'}],
            'leads':[{'id':'c:1','url':'https://demo.example.org','accessType':'web','siteReachable':True,
                      'discoveredAt':'2026-11-17','eventDate':'2026-11-17'}],
            'lastSuccessAt':'2026-11-18'}
  def failure(*args,**kwargs): raise OSError('network down')
  result,_=mod.scan(fetch=failure,probe=lambda url:True,today=TODAY,catalogue=CAT,previous=previous)
  self.assertEqual(result['scanStatus'],'error')
  self.assertEqual(result['lastSuccessAt'],'2026-11-18')
  self.assertEqual(len(result['releaseEvents']),1)
  self.assertEqual(len(result['leads']),1)
 def test_repo_only_missing_homepage_and_reading_list_hidden(self):
  for candidate in [repo(homepage=''),repo(homepage='https://github.com/example/whale-map'),
                    repo(name='awesome-whale-resources',description='Awesome marine conservation resources'),
                    repo(homepage='https://medium.com/whales'),
                    repo(homepage='http://whalemap.example.com')]:
   def fake(path,params=None):
    return {'items':[candidate]} if path=='/search/repositories' else []
   out,_=mod.scan(fetch=fake,probe=lambda url:True,today=TODAY,catalogue=CAT,
     previous={'releaseEvents':[],'leads':[]})
   self.assertEqual(out['leads'],[])
 def test_reachable_website_required(self):
  result,_=mod.scan(fetch=self.fake,probe=lambda url:False,today=TODAY,catalogue=CAT,
       previous={'releaseEvents':[],'leads':[]})
  self.assertEqual(result['leads'],[])
 def test_old_repo_only_leads_removed(self):
  previous={'leads':[{'id':'candidate:a/b','title':'a/b','url':'https://github.com/a/b',
                     'discoveredAt':'2026-11-18','eventDate':'2026-11-18'}], 'releaseEvents':[]}
  result,_=mod.scan(fetch=lambda path,params=None: {'items':[]} if path=='/search/repositories' else [],
     probe=lambda url:True,today=TODAY,catalogue=CAT,previous=previous)
  self.assertEqual(result['leads'],[])
 def test_newly_approved_github_tool_is_watched(self):
  catalog={'items':[{'id':'new-tool','title':'New Tool','url':'https://github.com/example/new-tool','aiType':'AI-native'}]}
  self.assertEqual(mod.watched_repositories(catalog),{'new-tool':'example/new-tool'})
 def test_domain_guess_and_homepage_rules(self):
  self.assertIsNone(mod.domain_guess('task list and boilerplate calculator'))
  self.assertEqual(mod.domain_guess('whale identification and acoustic marine monitoring'),'Water & oceans')
  self.assertIsNone(mod.usable_homepage('https://github.com/org/repo'))
  self.assertIsNotNone(mod.usable_homepage('https://example.github.io/whale-map'))

if __name__=='__main__':unittest.main()
