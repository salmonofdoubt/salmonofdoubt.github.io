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
 {'id':'qgis','title':'QGIS','url':'https://qgis.org/','aiType':'Traditional digital','toolUse':'install'},
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

 def test_official_directory_discovers_reachable_tool_not_repo(self):
  html = ('<h3>Satellite Habitat Monitor</h3><p>AI satellite habitat monitoring '
          'with an interactive environmental map</p>'
          '<a href="https://habitats.example.org/app">Explore tool</a>')
  def directory(url):
   return html if 'sustainability.google' in url else ''
  out, stats = mod.scan(fetch=self.fake, probe=lambda url: True,
      directory_fetch=directory, today=TODAY, catalogue=CAT,
      previous={'releaseEvents':[], 'leads':[]})
  leads = [x for x in out['leads'] if x['id'].startswith('directory:')]
  self.assertEqual(len(leads),1)
  self.assertEqual(leads[0]['url'],'https://habitats.example.org/app')
  self.assertEqual(leads[0]['source'],'Google Sustainability / official tool directory')
  self.assertEqual(leads[0]['aiType'],'Unverified')
  self.assertEqual(leads[0]['domain'],'Land & satellites')
  self.assertEqual(stats['leadsAdded'],2)  # also the GitHub sample candidate
  again,_=mod.scan(fetch=self.fake,probe=lambda url:True,directory_fetch=directory,
      today=TODAY,catalogue=CAT,previous=out)
  self.assertEqual(again['leads'],out['leads'])

 def test_directory_skips_unlabelled_and_duplicate_catalogue_entries(self):
  html = ('<h3>QGIS</h3><a href="https://qgis.org/">Explore tool</a>'
          '<h3>Wildlife Story</h3><a href="https://wildlife.example.org/story">Learn more</a>')
  out,_=mod.scan(fetch=lambda path,params=None:
                 {'items':[]} if path=='/search/repositories' else [],
      probe=lambda url:True, directory_fetch=lambda url:html,
      today=TODAY,catalogue=CAT,
      previous={'releaseEvents':[],'leads':[]})
  self.assertEqual(out['leads'],[])

 def test_health_retirement_requires_two_explicit_missing_checks(self):
  previous={'toolHealth':{},'releaseEvents':[],'leads':[]}
  first=mod.update_health(previous,CAT,lambda url:('missing',404),TODAY)
  self.assertEqual(first['qgis']['state'],'suspect')
  second=mod.update_health({'toolHealth':first},CAT,
                            lambda url:('missing',410),TODAY+dt.timedelta(days=1))
  self.assertEqual(second['qgis']['state'],'retired')
  self.assertEqual(second['qgis']['consecutiveMissing'],2)
  third=mod.update_health({'toolHealth':second},CAT,
                           lambda url:('unknown',403),TODAY+dt.timedelta(days=2))
  self.assertEqual(third['qgis']['state'],'retired')
  restored=mod.update_health({'toolHealth':third},CAT,
                              lambda url:('ok',200),TODAY+dt.timedelta(days=3))
  self.assertEqual(restored['qgis']['state'],'reachable')
  self.assertEqual(restored['qgis']['consecutiveMissing'],0)

 def test_health_does_not_retire_on_transient_error(self):
  first=mod.update_health({},CAT,lambda url:('missing',404),TODAY)
  second=mod.update_health({'toolHealth':first},CAT,
                            lambda url:('unknown',429),TODAY+dt.timedelta(days=1))
  self.assertEqual(second['qgis']['state'],'unconfirmed')
  self.assertEqual(second['qgis']['consecutiveMissing'],0)
  third=mod.update_health({'toolHealth':second},CAT,
                           lambda url:('missing',404),TODAY+dt.timedelta(days=2))
  self.assertEqual(third['qgis']['state'],'suspect')


 def test_official_tool_name_aliases(self):
  self.assertEqual(mod.normalized_title('Copernicus Climate Pulse'),
                   mod.normalized_title('Climate Pulse'))
  self.assertEqual(mod.normalized_title('Copernicus Interactive Climate Atlas'),
                   mod.normalized_title('Climate Atlas'))

 def test_copernicus_catalogue_discovers_new_application(self):
  html=('''<div><a href="/overview?app=wind-forecast-ai">
           Wind Forecast AI Explore the application</a></div>
           <a href="/overview?app=climate-pulse">Climate Pulse</a>''')
  catalog={'items':CAT['items']+[{
    'id':'c3s-pulse','title':'Copernicus Climate Pulse',
    'url':'https://pulse.climate.copernicus.eu/','toolUse':'online'}]}
  out,stats=mod.scan(fetch=lambda path,params=None:
       {'items':[]} if path=='/search/repositories' else [],
       directory_fetch=lambda url:html if url==mod.COPERNICUS_APPS else '',
       probe=lambda url:True, today=TODAY,catalogue=catalog,
       previous={'releaseEvents':[],'leads':[]})
  discoveries=[x for x in out['leads'] if x['id'].startswith('directory:copernicus:')]
  self.assertEqual(len(discoveries),1)
  self.assertEqual(discoveries[0]['title'],'Wind Forecast Ai')
  self.assertEqual(discoveries[0]['domain'],'Climate & energy')
  self.assertEqual(discoveries[0]['aiType'],'Unverified')
  self.assertEqual(discoveries[0]['source'],'Copernicus C3S/CAMS applications')
  self.assertEqual(stats['leadsAdded'],1)
  again,stats2=mod.scan(fetch=lambda path,params=None:
       {'items':[]} if path=='/search/repositories' else [],
       directory_fetch=lambda url:html if url==mod.COPERNICUS_APPS else '',
       probe=lambda url:True, today=TODAY,catalogue=catalog,previous=out)
  self.assertEqual(stats2['leadsAdded'],0)
  self.assertEqual(again['leads'],out['leads'])

 def test_copernicus_parser_rejects_non_app_links(self):
  parser=mod.CopernicusAppLinks()
  parser.feed('''<a href="https://example.org/overview?app=untrusted">Untrusted</a>
  <a href="/search">Catalogue</a><a href="/overview?app=climate-atlas">Climate Atlas</a>
  <a href="/overview?app=../../bad">Malformed</a>''')
  self.assertEqual(len(parser.items),1)
  self.assertEqual(parser.items[0][0],'Climate Atlas')


 def test_official_directory_prefix_cta_and_excludes_project_only(self):
  parser=mod.OfficialToolLinks(('see the *','open the app'))
  parser.feed('''<h3>ERA Explorer</h3><p>Global climate mapping platform</p>
               <a href="https://era-explorer.climate.copernicus.eu/">See the ERA Explorer platform</a>
               <a href="https://example.org/paper">See project</a>''')
  self.assertEqual(len(parser.items),1)
  self.assertEqual(parser.items[0][0],'ERA Explorer')

 def test_curated_climate_catalogue_coverage_and_classification(self):
  data=__import__('json').loads(mod.TOOLS_PATH.read_text(encoding='utf8'))
  climate=[x for x in data['items'] if x['domain']=='Climate & energy'
           and x.get('toolUse') in ('online','access','install')
           and x.get('mapVisible') is not False]
  self.assertGreaterEqual(len(climate),12)
  self.assertEqual(len(climate),len({x['id'] for x in climate}))
  self.assertEqual(set(x['aiType'] for x in climate),
                   {'Traditional digital','AI-augmented','AI-native'})
  for tool in climate:
   self.assertTrue(tool['url'].startswith('https://'),tool['id'])
   self.assertTrue(tool['evidence'].startswith('https://'),tool['id'])
   self.assertNotIn('github.com',tool['url'],tool['id'])
   self.assertTrue(tool.get('classificationEvidence'),tool['id'])


 def test_official_sources_cover_all_four_environmental_fields(self):
  self.assertTrue(any('WRI Aqueduct' in name for name,url,labels in mod.DIRECTORIES))
  self.assertTrue(any('Open Foris' in name for name,url,labels in mod.DIRECTORIES))
  self.assertTrue(any('Atlas of Living Australia' in name for name,url,labels in mod.DIRECTORIES))
  self.assertTrue(any('Copernicus' in name for name,url,labels in mod.DIRECTORIES))
  self.assertEqual(mod.SOURCE_DOMAINS['Atlas of Living Australia services'],
                   'Biodiversity & wildlife')
  self.assertEqual(mod.SOURCE_DOMAINS['Open Foris applications'],
                   'Land & satellites')

 def test_daily_multi_field_discovery_retains_evidence_without_ai_guess(self):
  pages={
   'https://www.wri.org/aqueduct/tools':
     '<h3>New Watershed Mapper</h3><p>River basin assessment portal</p>'
     '<a href="https://water.example.org/app">Launch Tool</a>',
   'https://www.openforis.org/':
     '<h3>New Land Explorer</h3><p>Satellite land mapping application</p>'
     '<a href="https://land.example.org/app">Launch Land Explorer</a>',
   'https://www.ala.org.au/sites-and-services/':
     '<h3>Biodiversity Map Toolkit</h3><p>Species occurrence portal</p>'
     '<a href="https://bio.example.org/app">Spatial Portal</a>',
   mod.COPERNICUS_APPS:
     '<a href="/overview?app=novel-heat-viewer">New Heat Viewer</a>',
  }
  result,stats=mod.scan(fetch=lambda path,params=None:
           {'items':[]} if path=='/search/repositories' else [],
      directory_fetch=lambda url:pages.get(url,''),
      probe=lambda url:True,today=TODAY,catalogue=CAT,
      previous={'releaseEvents':[],'leads':[]})
  grouped={}
  for lead in result['leads']:
   grouped.setdefault(lead['domain'],[]).append(lead)
   self.assertEqual(lead['aiType'],'Unverified')
   self.assertEqual(lead['accessType'],'web')
   self.assertTrue(lead['url'].startswith('https://'))
   self.assertFalse(lead['url'].startswith('https://github.com/'))
   self.assertIn('directory:',lead['id'])
  self.assertEqual(set(grouped),set(mod.DOMAIN_HINTS))
  self.assertEqual(stats['leadsAdded'],4)
  self.assertEqual(sum(result['candidateCountByField'].values()),4)
  self.assertEqual(result['catalogueCountByField']['Climate & energy'],0)

 def test_directory_probe_quota_does_not_favour_one_busy_source(self):
  many=''.join('<h3>New Water Map '+str(i)+'</h3><p>Water mapping tool</p>'
       '<a href="https://water.example.org/'+str(i)+'">Launch Tool</a>'
       for i in range(20))
  result,_=mod.scan(fetch=lambda path,params=None:
                  {'items':[]} if path=='/search/repositories' else [],
      directory_fetch=lambda url:many if 'aqueduct/tools' in url else '',
      probe=lambda url:True,today=TODAY,catalogue=CAT,
      previous={'releaseEvents':[],'leads':[]})
  self.assertLessEqual(len(result['leads']),mod.MAX_NEW_PER_SOURCE)

 def test_all_fields_have_practical_classified_tools(self):
  data=__import__('json').loads(mod.TOOLS_PATH.read_text(encoding='utf8'))
  for field in mod.DOMAIN_HINTS:
   tools=[t for t in data['items'] if t.get('domain')==field
          and t.get('toolUse') in ('online','install','access')
          and t.get('mapVisible') is not False]
   self.assertGreaterEqual(len(tools),12,field)
   self.assertEqual(set(t['aiType'] for t in tools),
                    {'Traditional digital','AI-augmented','AI-native'},field)
   for tool in tools:
    self.assertTrue(tool.get('classificationEvidence'),tool['id'])
    self.assertTrue(tool.get('evidence','').startswith('https://'),tool['id'])


if __name__=='__main__':unittest.main()
