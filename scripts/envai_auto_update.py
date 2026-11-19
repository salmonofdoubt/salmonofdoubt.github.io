#!/usr/bin/env python3
"""EnvAI daily update worker: evidence-backed Github releases + UNVERIFIED discovery leads.

No third-party packages, private API keys or AI claims required. Only edits
`demos/envai/data/live-updates.json`. A new repository is never called a launch.
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / 'demos/envai/data/live-updates.json'
TOOLS_PATH = ROOT / 'demos/envai/data/tools.json'

# Only repositories already identified as source links for catalogued tools.
# A GitHub release is a factual software RELEASE signal, not a verified
# environmental benefit, research finding, or AI classification.
WATCHED = {
    'glen': 'boettiger-lab/geo-agent',
    'sparrow-engine': 'microsoft/SPARROW-Engine',
    'sparrow-comm': 'microsoft/SPARROW-Comm',
    'megadetector': 'agentmorris/MegaDetector',
    'speciesnet': 'google/cameratrapai',
    'perch': 'google-research/perch-hoplite',
    'naturelm': 'earthspecies/NatureLM-audio',
    'bioCLIP': 'Imageomics/bioclip',
    'deepforest': 'weecology/DeepForest',
    'prithvi': 'NASA-IMPACT/Prithvi-EO-2.0',
    'orcahello': 'orcasound/orcahello',
    'orcai': 'ethz-tb/orcAI',
    'qgis': 'qgis/QGIS',
}
SEARCHES = [
    'topic:biodiversity topic:machine-learning',
    'topic:bioacoustics topic:deep-learning',
    'topic:earth-observation topic:machine-learning',
    '"environmental monitoring" in:description',
    '"ecological monitoring" in:description',
    '"climate forecasting" in:description',
    '"marine conservation" in:description',
]
KEYWORDS = ('ecolog','environment','biodivers','wildlife','conserv','habitat',
            'species','forest','satellite','geospatial','earth observation',
            'climate','ocean','marine','whale','bioacoust','hydrolog',
            'water quality','flood','coastal','fish','coral','pollution',
            'renewable energy','remote sensing')
DOMAIN_HINTS = {
    'Biodiversity & wildlife': ('bird','species','biodivers','wildlife','forest animal','ecolog','conserv','habitat','bioacoust','camera trap','insect'),
    'Land & satellites': ('satellite','land cover','geospatial','earth observation','remote sensing','soil','deforest','gis','landscape'),
    'Climate & energy': ('climate','emission','carbon','solar','weather','renewable energy','energy','warming'),
    'Water & oceans': ('whale','marine','ocean','hydrolog','water','flood','coral','fish','coastal','aquatic'),
}
MAX_LEADS, MAX_RELEASES, LOOKBACK_DAYS = 90, 120, 90


def text(s, maximum=350):
    return re.sub(r'[\x00-\x1f]+', ' ', str(s or '')).strip()[:maximum]


def api(path, params=None):
    url = 'https://api.github.com/' + path.lstrip('/')
    if params:
        url += '?' + urlencode(params)
    headers={'Accept':'application/vnd.github+json','User-Agent':'EnvAI-autoupdate/1.0',
             'X-GitHub-Api-Version':'2022-11-28'}
    token=os.getenv('GITHUB_TOKEN','').strip()
    if token:
        headers['Authorization']='Bearer '+token
    with urlopen(Request(url, headers=headers), timeout=13) as res:
        return json.load(res)


def domain_guess(haystack):
    s=haystack.lower()
    scores={key:sum(1 for x in hints if x in s) for key,hints in DOMAIN_HINTS.items()}
    # Distinctive ecological subjects take priority over generic methods
    # such as acoustic monitoring, which cross several environmental fields.
    for cue in ('whale','orca','marine','ocean','coral','coastal','fish'):
        if cue in s:scores['Water & oceans']+=3
    for cue in ('satellite','land cover','geospatial','earth observation'):
        if cue in s:scores['Land & satellites']+=2
    for cue in ('climate','emission','carbon','renewable energy'):
        if cue in s:scores['Climate & energy']+=2
    domain=max(scores, key=scores.get)
    return domain if scores[domain] else None


def valid_url(url):
    try:
        parsed=urlparse(url)
        return parsed.scheme=='https' and parsed.netloc.lower() in ('github.com','www.github.com')
    except (TypeError,ValueError):
        return False


def parse_stamp(s):
    raw=text(s,30)[:10]
    try:
        return dt.date.fromisoformat(raw)
    except ValueError:
        return None


def watched_repositories(catalogue):
    """Auto-watch approved tools whose project URL identifies one GitHub repo.

    The small explicit watchlist additionally covers project sites not hosted at
    a GitHub URL in the catalogue. Unknown candidate repos are not auto-watched
    as approved release sources.
    """
    watched={key:repo for key,repo in WATCHED.items() if any(t.get('id')==key for t in catalogue['items'])}
    for t in catalogue['items']:
        try:
            p=urlparse(str(t.get('url') or ''))
            if p.scheme!='https' or p.netloc.lower()!='github.com':continue
            path=p.path.strip('/').removesuffix('.git')
            if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',path):continue
            watched.setdefault(t['id'],path)
        except (ValueError,KeyError):pass
    return watched


def existing_state():
    if DATA_PATH.exists():
        try:return json.loads(DATA_PATH.read_text(encoding='utf8'))
        except (ValueError,OSError):pass
    return {'schemaVersion':1,'releaseEvents':[],'leads':[]}


def scan(*, fetch=api, today=None, previous=None, catalogue=None):
    today=today or dt.datetime.now(dt.timezone.utc).date()
    previous=previous if previous is not None else existing_state()
    catalogue=catalogue if catalogue is not None else json.loads(TOOLS_PATH.read_text(encoding='utf8'))
    curated={t['id']:t for t in catalogue['items']}
    watched=watched_repositories(catalogue)
    indexed_urls={text(t.get('url')).lower().rstrip('/') for t in catalogue['items']}
    old_rel={ev['id']:ev for ev in previous.get('releaseEvents',[]) if 'id' in ev}
    old_leads={ev['id']:ev for ev in previous.get('leads',[]) if 'id' in ev}
    cutoff=today-dt.timedelta(days=LOOKBACK_DAYS)
    sources_ok=0;sources_failed=0
    new_release_count=0;new_lead_count=0
    errors=[]

    def get(path,params=None):
        nonlocal sources_ok,sources_failed
        try:
            payload=fetch(path,params)
            if payload is None: raise ValueError('empty API response')
            sources_ok+=1
            return payload
        except (OSError,HTTPError,URLError,TimeoutError,ValueError,TypeError) as e:
            sources_failed+=1;errors.append(text(path+' / '+str(e),180))
            return None

    for tool_id, repo in watched.items():
        if tool_id not in curated:
            errors.append('Watch list missing catalogued tool: '+tool_id)
            continue
        releases=get(f'/repos/{repo}/releases',{'per_page':8})
        if not isinstance(releases,list):continue
        count=0
        for release in releases:
            if release.get('draft'):continue
            stamped=parse_stamp(release.get('published_at'))
            if not stamped or not cutoff<=stamped<=today:continue
            url=text(release.get('html_url'),500)
            if not valid_url(url):continue
            tag=text(release.get('tag_name') or release.get('name'),90)
            if not tag:continue
            event_id='release:'+repo.lower()+':'+tag.lower()
            event={'id':event_id,'toolId':tool_id,'title':curated[tool_id]['title'],
                   'tag':tag,'eventDate':stamped.isoformat(),'eventType':'Official GitHub release'+(' (pre-release)' if release.get('prerelease') else ''),
                   'url':url,'evidence':url,'source':'GitHub release / '+repo,
                   'summary':'A source-dated release from the project’s watched GitHub repository. Features and impact are not independently assessed.',
                   'aiType':curated[tool_id].get('aiType','Unverified')}
            if event_id not in old_rel:new_release_count+=1
            old_rel[event_id]=event
            count+=1
            if count>=3:break

    created_cutoff=today-dt.timedelta(days=21)
    for q in SEARCHES:
        result=get('/search/repositories',{'q':q+' created:>='+created_cutoff.isoformat(),
                                           'sort':'updated','order':'desc','per_page':14})
        if not isinstance(result,dict):continue
        for repo in result.get('items',[]):
            if repo.get('fork') or repo.get('archived') or repo.get('disabled'):continue
            created=parse_stamp(repo.get('created_at'))
            if not created or created>today or created<created_cutoff:continue
            fullname=text(repo.get('full_name'),150)
            name=text(repo.get('name'),100)
            desc=text(repo.get('description'),300)
            topics=' '.join(repo.get('topics') or [])[:220]
            combined=(name+' '+desc+' '+topics).lower()
            if not any(k in combined for k in KEYWORDS):continue
            domain=domain_guess(combined)
            if domain is None:continue
            url=text(repo.get('html_url'),500)
            if not valid_url(url) or url.lower().rstrip('/') in indexed_urls:continue
            entry_id='candidate:'+fullname.lower()
            if entry_id in old_leads:continue
            if repo.get('stargazers_count',0)<0:continue
            lead={'id':entry_id,'title':fullname,'url':url,'evidence':url,
                  'discoveredAt':today.isoformat(),'eventDate':created.isoformat(),
                  'note':f'New GitHub repository (created {created.isoformat()}). '+(desc or 'No project description provided.')+
                         ' Not verified as a functioning tool or product launch.',
                  'source':'GitHub repository search','status':'unverified / awaiting review',
                  'domain':domain,'aiType':'Unverified',
                  'tags':[t for t in (repo.get('topics') or []) if isinstance(t,str)][:8]}
            old_leads[entry_id]=lead
            new_lead_count+=1

    def retain(row):
        day=parse_stamp(row.get('eventDate') or row.get('discoveredAt'))
        return day is not None and day>=cutoff and day<=today
    releases=sorted((e for e in old_rel.values() if retain(e)),key=lambda e:(e['eventDate'],e['id']),reverse=True)[:MAX_RELEASES]
    leads=sorted((e for e in old_leads.values() if retain(e)),key=lambda e:(e.get('discoveredAt',''),e['id']),reverse=True)[:MAX_LEADS]
    status='ok' if sources_ok and not sources_failed else 'partial' if sources_ok else 'error'
    result={'schemaVersion':1,'sourceMode':'scheduled-github-api',
            'lastAttemptAt':today.isoformat(),'lastSuccessAt':today.isoformat() if sources_ok else previous.get('lastSuccessAt'),
            'scanStatus':status,'sourcesChecked':sources_ok+sources_failed,
            'sourcesSucceeded':sources_ok,'sourcesFailed':sources_failed,
            'monitorCount':len(watched),'errorSummary':errors[:4],
            'releaseEvents':releases,'leads':leads,
            'notice':'Official GitHub releases are recorded as dated source signals; newly discovered repositories remain UNVERIFIED and are not approved atlas entries.',
           }
    return result, {'releasesAdded':new_release_count,'leadsAdded':new_lead_count,'sourcesSucceeded':sources_ok,'sourcesFailed':sources_failed}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run',action='store_true',help='Preview result without writing live data')
    args=parser.parse_args()
    result,stats=scan()
    if args.dry_run:
        print(json.dumps({'stats':stats,'status':result['scanStatus'],'sampleReleases':result['releaseEvents'][:2],
                          'sampleLeads':result['leads'][:2]},indent=2))
        return
    DATA_PATH.parent.mkdir(parents=True,exist_ok=True)
    original=DATA_PATH.read_text(encoding='utf8') if DATA_PATH.exists() else None
    out=json.dumps(result,indent=2,ensure_ascii=False)+'\n'
    if out!=original: DATA_PATH.write_text(out,encoding='utf8')
    print(f"EnvAI auto-update: {result['scanStatus']} | {stats} | now {len(result['releaseEvents'])} watched releases and {len(result['leads'])} unverified leads")
    if not result['sourcesSucceeded']:
        print('All sources failed; preserving previously known events. Check GitHub API and workflow permissions.',file=sys.stderr)
        sys.exit(1)

if __name__=='__main__':main()
