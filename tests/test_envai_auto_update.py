"""Offline deterministic tests for EnvAI auto-update rules."""
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

class ScanningTests(unittest.TestCase):
 def fake(self,path,params=None):
  if path=='/repos/weecology/DeepForest/releases':
   return [{'tag_name':'v1.2.3','name':'New version','published_at':'2026-11-18T10:00:00Z',
    'draft':False,'prerelease':False,'html_url':'https://github.com/weecology/DeepForest/releases/tag/v1.2.3'}]
  if path=='/search/repositories':
   return {'items':[{'full_name':'example/whale-sounds','name':'whale-sounds','description':'Whale monitoring with audio models',
     'topics':['bioacoustics'],'created_at':'2026-11-18T10:00:00Z','html_url':'https://github.com/example/whale-sounds',
     'fork':False,'archived':False,'disabled':False,'stargazers_count':3}]}
  return []
 def test_known_official_release_and_new_unverified_repository(self):
  result,stats=mod.scan(fetch=self.fake,today=TODAY,catalogue=CAT,previous={'releaseEvents':[],'leads':[]})
  self.assertEqual(result['scanStatus'],'ok')
  self.assertEqual(len(result['releaseEvents']),1)
  e=result['releaseEvents'][0]
  self.assertEqual(e['toolId'],'deepforest')
  self.assertEqual(e['eventDate'],'2026-11-18')
  self.assertIn('GitHub release',e['eventType'])
  self.assertEqual(len(result['leads']),1)
  self.assertEqual(result['leads'][0]['domain'],'Water & oceans')
  self.assertEqual(result['leads'][0]['aiType'],'Unverified')
  self.assertNotIn('AI-native',result['leads'][0]['status'])
 def test_repeated_scans_are_idempotent(self):
  first,_=mod.scan(fetch=self.fake,today=TODAY,catalogue=CAT,previous={'releaseEvents':[],'leads':[]})
  second,stats=mod.scan(fetch=self.fake,today=TODAY,catalogue=CAT,previous=first)
  self.assertEqual(stats['releasesAdded'],0)
  self.assertEqual(stats['leadsAdded'],0)
  self.assertEqual(second['releaseEvents'],first['releaseEvents'])
  self.assertEqual(second['leads'],first['leads'])
 def test_api_failure_keeps_prior_data(self):
  previous={'releaseEvents':[{'id':'rel:1','eventDate':'2026-11-17'}],
            'leads':[{'id':'c:1','discoveredAt':'2026-11-17','eventDate':'2026-11-17'}],
            'lastSuccessAt':'2026-11-18'}
  def failure(*args,**kwargs): raise OSError('network down')
  result,stats=mod.scan(fetch=failure,today=TODAY,catalogue=CAT,previous=previous)
  self.assertEqual(result['scanStatus'],'error')
  self.assertEqual(result['lastSuccessAt'],'2026-11-18')
  self.assertEqual(len(result['releaseEvents']),1)
  self.assertEqual(len(result['leads']),1)
 def test_rejects_old_draft_and_unrelated_repositories(self):
  def bogus(path,params=None):
   if path=='/repos/weecology/DeepForest/releases':return [
      {'tag_name':'old','published_at':'2024-01-01T10:00:00Z','html_url':'https://github.com/a/a/releases/tag/old'},
      {'tag_name':'draft','published_at':'2026-11-18T10:00:00Z','draft':True,'html_url':'https://github.com/a/a/releases/tag/draft'}]
   if path=='/search/repositories':return {'items':[
      {'full_name':'example/marketing-site','name':'marketing-site','description':'unrelated marketing',
       'created_at':'2026-11-18T10:00:00Z','html_url':'https://github.com/example/marketing-site'}]}
   return []
  result,_=mod.scan(fetch=bogus,today=TODAY,catalogue=CAT,previous={'releaseEvents':[],'leads':[]})
  self.assertEqual(result['releaseEvents'],[])
  self.assertEqual(result['leads'],[])
 def test_newly_approved_github_tool_is_watched_automatically(self):
  catalog={'items':[{'id':'new-research-tool','title':'New Tool','url':'https://github.com/example/new-research-tool','aiType':'AI-native'}]}
  self.assertEqual(mod.watched_repositories(catalog),{'new-research-tool':'example/new-research-tool'})
 def test_domain_guess_avoids_random_unrelated(self):
  self.assertIsNone(mod.domain_guess('task list and boilerplate calculator'))
  self.assertEqual(mod.domain_guess('whale identification and acoustic marine monitoring'),'Water & oceans')

if __name__=='__main__':unittest.main()
